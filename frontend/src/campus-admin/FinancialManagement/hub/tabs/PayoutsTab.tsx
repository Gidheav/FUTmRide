// ─────────────────────────────────────────────────────────────────────────────
// PayoutsTab.tsx — Hub Payouts tab with full OTP flow
// Source: FinancialSanctum lines 1250–1800
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import type { BankAcct, WithdrawalRecord } from '../../types/financial.types';
import { naira, fmtD, effectiveStatus } from '../../helpers/hub.helpers';
import { WSTATUS, THIN } from '../../constants/hub.constants';
import { Card } from '../../components/Card';
import Icon from '../../../../components/common/Icon';
import apiService from '../../../../services/api.service';
// ─────────────────────────────────────────────────────────────────────────────
// hub/tabs/PayoutsTab.tsx
// Extracted from FinancialSanctum.tsx lines 1232–2108
// Destination: src/admin/FinancialManagement/hub/tabs/PayoutsTab.tsx
// ─────────────────────────────────────────────────────────────────────────────



const OtpDots = memo(({ value, maxLen = 6 }: { value: string; maxLen?: number }) => (
  <div className="flex items-center justify-center gap-2.5 py-1">
    {Array.from({ length: maxLen }, (_, i) => {
      const ch = value[i] || '';
      const isActive = i === value.length;
      return (
        <div key={i} className="transition-all duration-100"
          style={{
            width: 44, height: 56, borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, fontFamily: 'monospace', fontWeight: 700,
            border: `2px solid ${ch ? '#f59e0b' : isActive ? 'rgba(245,158,11,0.5)' : '#334155'}`,
            background: ch ? 'rgba(245,158,11,0.12)' : isActive ? 'rgba(245,158,11,0.05)' : '#1e293b',
            color: ch ? '#fbbf24' : '#475569',
            transform: ch ? 'scale(1.05)' : 'scale(1)',
          }}>
          {ch || (isActive ? '|' : '·')}
        </div>
      );
    })}
  </div>
));
OtpDots.displayName = 'OtpDots';

// ═══════════════════════════════════════════════════════════════════════════
// TAB: PAYOUTS — FIXED with full OTP flow
// Steps: form → initiating → otp → verifying → done
// ═══════════════════════════════════════════════════════════════════════════

type WStep = 'form' | 'initiating' | 'otp' | 'verifying' | 'done';
type WFinal = 'completed' | 'failed' | 'unknown';

export const PayoutsTab = memo(() => {

  // ── Balance ──────────────────────────────────────────────────────────────
  const [balance,      setBalance]      = useState<number | null>(null); // kobo
  const [balLoading,   setBalLoading]   = useState(true);
  const [balError,     setBalError]     = useState('');
  const [balFetchedAt, setBalFetchedAt] = useState<Date | null>(null);

  // ── Lists ─────────────────────────────────────────────────────────────────
  const [bankAccounts, setBankAccounts] = useState<BankAcct[]>([]);
  const [withdrawals,  setWithdrawals]  = useState<WithdrawalRecord[]>([]);
  const [histLoading,  setHistLoading]  = useState(true);
  const [banks,        setBanks]        = useState<Array<{code: string; name: string}>>([]);

  // ── Modal ────────────────────────────────────────────────────────────────
  const [showWithdraw, setShowWithdraw] = useState(false);

  // ── Withdrawal form ───────────────────────────────────────────────────────
  const [wAmt,          setWAmt]          = useState('');
  const [wBankId,       setWBankId]       = useState('');
  const [wBankMode,     setWBankMode]     = useState<'saved'|'new'>('saved');
  const [wNewBankCode,  setWNewBankCode]  = useState('');
  const [wNewAcctNum,   setWNewAcctNum]   = useState('');
  const [wNewAcctName,  setWNewAcctName]  = useState('');
  const [wNewVerified,  setWNewVerified]  = useState(false);
  const [wErr,          setWErr]          = useState('');
  const [wLoading,      setWLoading]      = useState(false);
  const [wVerifying,    setWVerifying]    = useState(false);

  // ── Step machine ──────────────────────────────────────────────────────────
  const [wStep,        setWStep]        = useState<WStep>('form');
  const [wFinalStatus, setWFinalStatus] = useState<WFinal>('unknown');
  const [wStepMsg,     setWStepMsg]     = useState('');

  // ── OTP fields ────────────────────────────────────────────────────────────
  const [otpWdrId,   setOtpWdrId]   = useState('');
  const [otpTxCode,  setOtpTxCode]  = useState('');
  const [otpVal,     setOtpVal]     = useState('');
  const [otpErr,     setOtpErr]     = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const otpInputRef  = useRef<HTMLInputElement>(null);

  // Focus OTP input when we enter that step
  useEffect(() => {
    if (wStep === 'otp') setTimeout(() => otpInputRef.current?.focus(), 120);
  }, [wStep]);

  // ── Fetch banks ───────────────────────────────────────────────────────────
  const fetchBanks = useCallback(async () => {
    try {
      const res = await apiService.get<Array<{code: string; name: string}>>('withdrawals/banks/');
      setBanks(Array.isArray(res) ? res : []);
    } catch {
      console.error('Failed to fetch banks');
    }
  }, []);

  // ── Fetch balance ─────────────────────────────────────────────────────────
  const fetchBalance = useCallback(async () => {
    setBalLoading(true);
    setBalError('');
    try {
      const res = await apiService.get<{ balance: number }>('payments/admin/paystack-balance/');
      setBalance(res.balance);
      setBalFetchedAt(new Date());
    } catch {
      setBalError('Unable to fetch balance. Check Paystack key / network.');
    } finally {
      setBalLoading(false);
    }
  }, []);

  // ── Fetch history + accounts ──────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const [acctRes, histRes] = await Promise.allSettled([
        apiService.get<any>('withdrawals/bank-accounts/'),
        apiService.get<any>('admin/withdrawals/'),
      ]);
      if (acctRes.status === 'fulfilled') {
        const list: BankAcct[] = Array.isArray(acctRes.value) ? acctRes.value : (acctRes.value?.results ?? []);
        setBankAccounts(list);
        if (list.length > 0) { setWBankId(list[0].id); setWBankMode('saved'); } else { setWBankMode('new'); }
      }
      if (histRes.status === 'fulfilled') {
        const list: WithdrawalRecord[] = Array.isArray(histRes.value) ? histRes.value : (histRes.value?.results ?? []);
        setWithdrawals(list);
      }
    } finally {
      setHistLoading(false);
    }
  }, []);

  useEffect(() => { fetchBalance(); fetchHistory(); fetchBanks(); }, [fetchBalance, fetchHistory, fetchBanks]);

  // ── Reset modal ───────────────────────────────────────────────────────────
  const resetModal = useCallback(() => {
    setShowWithdraw(false);
    setWStep('form');
    setWFinalStatus('unknown');
    setWStepMsg('');
    setWAmt('');
    setWNewBankCode(''); setWNewAcctNum(''); setWNewAcctName(''); setWNewVerified(false);
    setWErr('');
    setWLoading(false);
    setWVerifying(false);
    setOtpVal(''); setOtpErr('');
    setOtpLoading(false);
    setOtpWdrId(''); setOtpTxCode('');
  }, []);

  // ── Apply OTP-required state — opens the OTP input screen ────────────────
  const applyOtpRequired = (wdrId: string, txCode: string) => {
    setOtpWdrId(wdrId);
    setOtpTxCode(txCode);
    setOtpVal('');
    setOtpErr('');
    setWStep('otp');
  };

  // ── Verify account (NEW account flow) ──────────────────────────────────────
  const verifyNewAccount = async () => {
    setWErr('');
    if (!wNewBankCode.trim()) { setWErr('Select a bank.'); return; }
    if (!wNewAcctNum.trim() || wNewAcctNum.trim().length !== 10) { setWErr('Account number must be exactly 10 digits.'); return; }
    
    setWVerifying(true);
    try {
      const res = await apiService.post<any>('withdrawals/bank-accounts/', {
        bank_code: wNewBankCode.trim(),
        account_number: wNewAcctNum.trim(),
      });

      // Success: account resolved and verified
      setWNewAcctName(res.account_name || '');
      setWNewVerified(true);
      setWBankId(res.id);
      setWErr('');
    } catch (e: any) {
      console.error('[VERIFY] Error:', e);
      console.error('[VERIFY] Response data:', e?.response?.data);
      
      const detail = e?.response?.data?.detail ?? '';
      const msg = detail.includes('Cannot resolve account') 
        ? `✗ Account not found in ${banks.find(b => b.code === wNewBankCode)?.name}. Check account number with your bank.`
        : detail || 'Failed to verify account. Check account number and bank.';
      setWErr(msg);
      setWNewVerified(false);
    } finally {
      setWVerifying(false);
    }
  };

  // ── Submit withdrawal ─────────────────────────────────────────────────────
  const submitWithdrawal = async () => {
    setWErr('');
    const amt = parseFloat(wAmt);
    if (!wAmt || isNaN(amt) || amt <= 0) { setWErr('Enter a valid amount.'); return; }
    if (balance !== null && amt * 100 > balance) {
      setWErr(`Amount exceeds available balance (${naira(balance)}).`); return;
    }
    let bankAccountId = wBankId;
    
    // Validate bank account selection
    if (wBankMode === 'saved') {
      if (!bankAccountId) { setWErr('Select a saved bank account.'); return; }
    } else {
      if (!wNewVerified) { setWErr('Verify your account first.'); return; }
      bankAccountId = wBankId; // Already set by verification
    }

    setWLoading(true);
    try {
      // Bank account already created/verified, proceed directly to withdrawal

      // ② Create withdrawal
      const created = await apiService.post<any>('withdrawals/', {
        bank_account: bankAccountId,
        amount: amt.toFixed(2),
        currency: 'NGN',
      });
      const wdrId = created.id;

      // ③ Approve — process_withdrawal() is synchronous on your backend.
      //    Paystack sends the OTP within ~2ms of this returning.
      //    We do NOT poll. We go straight to the OTP input screen.
      await apiService.post<any>(`admin/withdrawals/${wdrId}/approve/`, {});

      setWLoading(false);
      fetchHistory();

      // ④ Fetch the withdrawal record ONCE to grab the transfer code for display.
      //    We do this in the background — the OTP screen opens immediately
      //    regardless of whether this fetch succeeds.
      setOtpWdrId(wdrId);
      setOtpTxCode('');   // will be filled in below if fetch succeeds
      setOtpVal('');
      setOtpErr('');
      setWStep('otp');    // ← GO STRAIGHT TO OTP SCREEN — no polling

      // Background fetch of transfer code (display only, not required to submit OTP)
      apiService.get<any>(`admin/withdrawals/${wdrId}/`).then(w => {
        const txc =
          w?.paystack_transfer_code
          ?? w?.transaction?.paystack_transfer_code
          ?? w?.withdrawal?.paystack_transfer_code
          ?? '';
        if (txc) setOtpTxCode(txc);
      }).catch(() => { /* transfer code display is optional */ });
    } catch (e: any) {
      const msg = e?.response?.data?.detail
        ?? e?.response?.data?.amount?.[0]
        ?? e?.message
        ?? 'Withdrawal failed.';
      setWErr(msg);
      setWStep('form');
    } finally {
      setWLoading(false);
    }
  };

  // ── Submit OTP → POST to finalize-otp → poll final status ────────────────
  const submitOtp = async () => {
    if (otpVal.trim().length < 4) { setOtpErr('Enter the OTP sent to your email / SMS.'); return; }
    setOtpLoading(true);
    setOtpErr('');
    setWStep('verifying');

    try {
      // POST withdrawals/{id}/finalize-otp/
      // Body matches what testWithdrawals.py posts to Paystack's finalize endpoint
      const result = await apiService.post<any>(`withdrawals/${otpWdrId}/finalize-otp/`, {
        transfer_code: otpTxCode,
        otp: otpVal.trim(),
      });

      // Some backends set the withdrawal to 'completed' immediately after OTP
      if (result?.withdrawal_status === 'completed') {
        setWFinalStatus('completed');
        setWStep('done');
        fetchHistory(); fetchBalance();
        return;
      }

      // Otherwise poll for final status (webhook may arrive async)
      let attempts = 0;
      const pollFinal = async () => {
        attempts++;
        try {
          const w = await apiService.get<any>(`admin/withdrawals/${otpWdrId}/`);
          if (w.status === 'completed') {
            setWFinalStatus('completed');
            setWStep('done');
            fetchHistory(); fetchBalance();
          } else if (w.status === 'failed') {
            setWFinalStatus('failed');
            setWStepMsg(w.failure_reason || 'Transfer failed after OTP confirmation.');
            setWStep('done');
            fetchHistory();
          } else if (attempts < 15) {
            setTimeout(pollFinal, 3000);
          } else {
            // OTP accepted; Paystack webhook will finalise — tell user to check history
            setWFinalStatus('unknown');
            setWStepMsg('OTP accepted. Paystack is finalising the transfer — check Payout History shortly.');
            setWStep('done');
            fetchHistory();
          }
        } catch {
          if (attempts < 15) setTimeout(pollFinal, 3000);
        }
      };
      setTimeout(pollFinal, 3000);
    } catch (e: any) {
      const msg = e?.response?.data?.detail
        ?? e?.response?.data?.message
        ?? e?.message
        ?? 'OTP rejected. Try again.';
      setOtpErr(msg);
      setWStep('otp');    // ← return to OTP screen on error, NOT to form
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Resume a processing/otp_required withdrawal from the table ─────────────
  const resumeWithdrawal = useCallback(async (w: WithdrawalRecord) => {
    const eff = effectiveStatus(w);
    if (!['processing', 'otp_required'].includes(eff)) return;
    resetModal();

    if (eff === 'otp_required') {
      setShowWithdraw(true);
      setWStep('initiating'); // brief spinner while fetching transfer code
      try {
        const detail = await apiService.get<any>(`admin/withdrawals/${w.id}/`);
        const txCode = detail?.paystack_transfer_code
          ?? detail?.transaction?.paystack_transfer_code ?? '';
        setOtpWdrId(w.id);
        setOtpTxCode(txCode);
        setOtpVal('');
        setOtpErr('');
        setWStep('otp');
      } catch {
        setWStep('form');
      }
    } else {
      // status === 'processing' — open in initiating step and poll
      setShowWithdraw(true);
      setOtpWdrId(w.id);
      setWStep('initiating');
      let attempts = 0;
      const poll = () => {
        attempts++;
        apiService.get<any>(`admin/withdrawals/${w.id}/`).then(detail => {
          if (detail.status === 'otp_required') {
            const txCode = detail?.paystack_transfer_code
              ?? detail?.transaction?.paystack_transfer_code ?? '';
            setOtpWdrId(w.id);
            setOtpTxCode(txCode);
            setOtpVal(''); setOtpErr('');
            setWStep('otp');
          } else if (detail.status === 'completed') {
            setWFinalStatus('completed'); setWStep('done');
            fetchHistory(); fetchBalance();
          } else if (detail.status === 'failed') {
            setWFinalStatus('failed');
            setWStepMsg(detail.failure_reason || 'Transfer failed.');
            setWStep('done'); fetchHistory();
          } else if (attempts < 8) {
            setTimeout(poll, 3000);
          } else {
            setWFinalStatus('unknown');
            setWStepMsg('Still processing — check Payout History for the final status.');
            setWStep('done');
          }
        }).catch(() => { if (attempts < 8) setTimeout(poll, 3000); });
      };
      setTimeout(poll, 2000);
    }
  }, [resetModal, fetchHistory, fetchBalance]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const completedWdrs = withdrawals.filter(w => w.status === 'completed');
  const failedWdrs    = withdrawals.filter(w => ['failed', 'timed_out'].includes(effectiveStatus(w)));
  const pendingWdrs   = withdrawals.filter(w => ['pending','approved','processing','otp_required'].includes(effectiveStatus(w)));
  const totalOut      = completedWdrs.reduce((s, w) => s + Number(w.amount), 0);

  // ── Modal header meta ─────────────────────────────────────────────────────
  const modalAccentColor =
    wStep === 'otp' || wStep === 'verifying' ? '#f59e0b'
    : wStep === 'done' && wFinalStatus === 'completed' ? '#10b981'
    : wStep === 'done' && wFinalStatus === 'failed' ? '#ef4444'
    : '#10b981';

  const modalTitle =
    wStep === 'form'        ? 'Initiate Withdrawal'
    : wStep === 'initiating'? 'Processing Transfer…'
    : wStep === 'otp'       ? 'OTP Verification Required'
    : wStep === 'verifying' ? 'Confirming OTP…'
    : wFinalStatus === 'completed' ? 'Withdrawal Sent!'
    : wFinalStatus === 'failed'    ? 'Withdrawal Failed'
    :                                'Transfer In Progress';

  const modalSubtitle =
    wStep === 'form'        ? 'Funds deducted from Paystack balance'
    : wStep === 'initiating'? 'Waiting for Paystack to request OTP…'
    : wStep === 'otp'       ? 'Enter the one-time password Paystack sent you'
    : wStep === 'verifying' ? 'Submitting OTP to Paystack…'
    : wFinalStatus === 'completed' ? 'Funds are on their way to your bank'
    : wFinalStatus === 'failed'    ? 'See reason below'
    :                                'Paystack will confirm shortly';

  const canCloseModal = wStep === 'form' || wStep === 'done';

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-5">

      {/* ── Balance + Initiate ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        <Card className="md:col-span-2 p-6" glow="#10b981">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-sans font-semibold uppercase tracking-widest mb-3" style={{color:'var(--fh-text3)'}}>Paystack Available Balance</p>
              {balLoading
                ? <div className="h-10 w-52 fh-input rounded-lg animate-pulse" />
                : balError
                ? <p className="text-sm font-sans text-red-400">{balError}</p>
                : <p className="text-4xl font-mono font-bold tracking-tight" style={{color:'#10b981'}}>{balance !== null ? naira(balance) : '—'}</p>
              }
              {balFetchedAt && !balLoading && !balError && (
                <p className="text-[10px] font-sans mt-1.5" style={{color:'var(--fh-text3)'}}>Fetched at {balFetchedAt.toLocaleTimeString()}</p>
              )}
            </div>
            <button onClick={fetchBalance} disabled={balLoading}
              className="ml-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border fh-input text-[10px] font-sans font-semibold transition-colors disabled:opacity-40 flex-shrink-0 hover:border-emerald-600 hover:text-emerald-400">
              <Icon name="refresh" size={12} className={balLoading ? 'fh-spin' : ''} />UPDATE
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <button
              onClick={() => {
                resetModal();
                setShowWithdraw(true);
                setWBankMode(bankAccounts.length > 0 ? 'saved' : 'new');
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-sans font-semibold text-black transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 0 18px #10b98140' }}>
              <Icon name="send" size={15} />Initiate Withdrawal
            </button>
            <p className="text-[11px] font-sans text-slate-600 leading-relaxed">
              Amount must not exceed balance shown above.<br />
              Paystack will send an <span className="text-amber-400/80 font-semibold">OTP</span> to confirm before disbursing.
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-[9px] font-sans font-semibold uppercase tracking-widest mb-4" style={{color:'var(--fh-text3)'}}>Withdrawal Summary</p>
          <div className="space-y-3">
            {[
              { label:'Total Withdrawn', value:`₦${totalOut.toLocaleString()}`,       color:'#10b981' },
              { label:'Completed',       value:completedWdrs.length.toString(),        color:'#10b981' },
              { label:'In Progress',     value:pendingWdrs.length.toString(),          color:'#f59e0b' },
              { label:'Failed',          value:failedWdrs.length.toString(),           color:'#f87171' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between py-1 border-b border-slate-800 dark:border-slate-800 last:border-0">
                <span className="text-[11px] font-sans" style={{color:'var(--fh-text3)'}}>{s.label}</span>
                <span className="text-sm font-mono font-bold" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Withdrawal History ── */}
      <Card>
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-[9px] font-sans font-semibold text-slate-600 uppercase tracking-widest">Withdrawal History</span>
          <button onClick={fetchHistory} className="flex items-center gap-1.5 text-[10px] font-sans text-slate-600 hover:text-emerald-400 transition-colors">
            <Icon name="refresh" size={11} />Refresh
          </button>
        </div>
        {histLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full fh-spin" />
          </div>
        ) : withdrawals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Icon name="send" size={32} className="text-slate-700" />
            <p className="text-xs font-sans text-slate-600">No withdrawals yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto" style={THIN}>
            <table className="w-full min-w-[580px] border-collapse">
              <thead>
                <tr className="fh-thead">
                  {['#','REFERENCE','AMOUNT','STATUS','DATE','NOTE'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left">
                      <span className="text-[9px] font-sans font-semibold uppercase tracking-widest text-slate-600">{h}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w, i) => {
                  const eff = effectiveStatus(w);
                  const sm  = WSTATUS[eff] ?? { color:'#64748b', bg:'bg-slate-800', label: eff };
                  const isResumable = ['processing', 'otp_required'].includes(eff);
                  const getNoteText = () => {
                    switch (eff) {
                      case 'completed':
                        return 'Completed successfully';
                      case 'failed':
                        return w.failure_reason || 'Transfer failed';
                      case 'timed_out':
                        return 'Timed out — Paystack did not confirm within 30 min';
                      case 'pending':
                        return 'Awaiting approval';
                      case 'approved':
                        return 'Approved, awaiting processing';
                      case 'processing':
                        return 'Processing transfer';
                      case 'otp_required':
                        return 'OTP verification pending';
                      case 'cancelled':
                        return 'Withdrawal cancelled';
                      default:
                        return w.failure_reason || '—';
                    }
                  };
                  const noteText = getNoteText();
                  return (
                    <tr
                      key={w.id}
                      onClick={isResumable ? () => resumeWithdrawal(w) : undefined}
                      title={isResumable ? 'Click to resume — re-enter OTP or check status' : undefined}
                      className={`border-b transition-colors ${
                        i%2===0 ? 'fh-row-even' : 'fh-row-odd'
                      } ${
                        isResumable ? 'cursor-pointer hover:bg-amber-900/10' : ''
                      }`}>
                      <td className="px-4 py-2.5"><span className="text-[9px] font-mono text-slate-600">{i+1}</span></td>
                      <td className="px-4 py-2.5"><span className="text-[10px] font-mono fh-input px-1.5 py-0.5 rounded">{w.reference}</span></td>
                      <td className="px-4 py-2.5"><span className="text-sm font-mono font-bold text-emerald-400">₦{Number(w.amount).toLocaleString()}</span></td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm text-[10px] font-sans font-semibold ${sm.bg} ${
                          isResumable ? 'animate-pulse' : ''
                        }`} style={{ 
                          color: sm.color,
                          backgroundColor: sm.color + '15',
                          border: '1px solid ' + sm.color + '40'
                        }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: sm.color }} />
                          {sm.label.toUpperCase()}
                          {isResumable && <span className="text-[8px] opacity-60 ml-0.5">↩ resume</span>}
                        </span>
                      </td>
                      <td className="px-4 py-2.5"><span className="text-[10px] font-mono" style={{color:'var(--fh-text3)'}}>{fmtD(w.requested_at)}</span></td>
                      <td className="px-4 py-2.5 max-w-[200px]"><span className="text-[10px] font-sans truncate block" style={{color:'var(--fh-text3)'}} title={noteText}>{noteText}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>


      {/* ══════════════════════ WITHDRAWAL MODAL ══════════════════════ */}
      {showWithdraw && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget && canCloseModal) resetModal(); }}>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            style={{ maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Step accent bar */}
            <div className="h-1 w-full transition-all duration-500"
              style={{ background: `linear-gradient(90deg, ${modalAccentColor}, ${modalAccentColor}80)` }} />

            {/* Modal header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300"
                  style={{ background: `${modalAccentColor}20` }}>
                  {wStep === 'otp' || wStep === 'verifying'
                    ? <Icon name="lock" size={18} style={{ color: '#f59e0b' }} />
                    : wStep === 'done' && wFinalStatus === 'completed'
                    ? <Icon name="check_circle" size={18} style={{ color: '#10b981' }} />
                    : wStep === 'done' && wFinalStatus === 'failed'
                    ? <Icon name="error_outline" size={18} style={{ color: '#ef4444' }} />
                    : <Icon name="send" size={18} style={{ color: '#10b981' }} />}
                </div>
                <div>
                  <p className="text-sm font-sans font-semibold" style={{color:'var(--fh-text1)'}}>{modalTitle}</p>
                  <p className="text-[10px] font-sans" style={{color:'var(--fh-text3)'}}>{modalSubtitle}</p>
                </div>
              </div>
              <button onClick={resetModal} disabled={!canCloseModal}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <Icon name="close" size={16} />
              </button>
            </div>


            {/* ── STEP: form ── */}
            {wStep === 'form' && (
              <>
                <div className="px-6 py-5 space-y-4">

                  {/* Balance pill */}
                  {balance !== null && (
                    <div className="flex items-center justify-between p-3 rounded-xl border"
                      style={{ 
                        backgroundColor: 'var(--fh-surface2)',
                        borderColor: 'var(--fh-border2)'
                      }}>
                      <span className="text-[11px] font-sans" style={{color:'var(--fh-text3)'}}>Available Balance</span>
                      <span className="text-xl font-mono font-bold" style={{color:'#10b981'}}>{naira(balance)}</span>
                    </div>
                  )}

                  {/* Bank selector */}
                  <div>
                    <label className="text-[10px] font-sans font-semibold uppercase tracking-widest block mb-1.5" style={{color:'var(--fh-text3)'}}>Destination Account</label>
                    <div className="flex gap-2 mb-2">
                      <button type="button" onClick={() => setWBankMode('saved')} disabled={bankAccounts.length === 0}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-sans border transition-colors ${wBankMode==='saved' ? 'border-emerald-600 text-emerald-400 bg-emerald-900/20' : 'border-slate-700 text-slate-400 hover:border-slate-600'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                        Use Saved
                      </button>
                      <button type="button" onClick={() => setWBankMode('new')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-sans border transition-colors ${wBankMode==='new' ? 'border-emerald-600 text-emerald-400 bg-emerald-900/20' : 'border-slate-700 text-slate-400 hover:border-slate-600'}`}>
                        Enter New
                      </button>
                    </div>

                    {wBankMode === 'saved' ? (
                      bankAccounts.length === 0
                        ? <div className="p-3 rounded-lg border border-amber-700/40 bg-amber-900/20 text-[11px] font-sans text-amber-400">No saved bank accounts. Switch to "Enter New".</div>
                        : (
                          <select value={wBankId} onChange={e => setWBankId(e.target.value)}
                            className="fh-input w-full rounded-lg px-3 py-2.5 text-sm font-sans focus:outline-none focus:border-emerald-600">
                            {bankAccounts.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.account_name} — {b.bank_name} (****{b.account_number.slice(-4)})
                              </option>
                            ))}
                          </select>
                        )
                    ) : (
                      <div className="space-y-3">
                        {/* Bank Dropdown */}
                        <div>
                          <label className="text-[9px] font-sans uppercase tracking-widest block mb-1" style={{color:'var(--fh-text3)'}}>Select Bank *</label>
                          <select value={wNewBankCode} onChange={e => setWNewBankCode(e.target.value)} disabled={wNewVerified}
                            className="fh-input w-full rounded-lg px-3 py-2.5 text-sm font-sans focus:outline-none focus:border-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed">
                            <option value="">Choose a bank...</option>
                            {banks.map(b => (
                              <option key={b.code} value={b.code}>{b.name}</option>
                            ))}
                          </select>
                        </div>

                        {/* Account Number */}
                        <div>
                          <label className="text-[9px] font-sans uppercase tracking-widest block mb-1" style={{color:'var(--fh-text3)'}}>Account Number *</label>
                          <input type="text" inputMode="numeric" maxLength={10} value={wNewAcctNum}
                            onChange={e => setWNewAcctNum(e.target.value.replace(/\D/g,''))} 
                            disabled={wNewVerified}
                            placeholder="0123456789"
                            className="fh-input w-full rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30 disabled:opacity-60 disabled:cursor-not-allowed" />
                          <small className="text-[9px] font-sans mt-0.5" style={{color:'var(--fh-text3)'}}>10 digits only</small>
                        </div>

                        {/* Account Name (Read-only after verification) */}
                        <div>
                          <label className="text-[9px] font-sans uppercase tracking-widest block mb-1" style={{color:'var(--fh-text3)'}}>Account Holder Name</label>
                          <input type="text" value={wNewAcctName} readOnly
                            placeholder={wNewVerified ? '' : 'Auto-resolved after verification'}
                            className="fh-input w-full rounded-lg px-3 py-2.5 text-sm font-sans focus:outline-none bg-slate-900/50 text-slate-400" />
                          {wNewVerified && <small className="text-[9px] font-sans mt-0.5 text-emerald-400">✓ Verified</small>}
                        </div>

                        {/* Verify Button */}
                        <button type="button" onClick={verifyNewAccount} disabled={!wNewBankCode || wNewAcctNum.length !== 10 || wVerifying || wNewVerified}
                          className="w-full py-2 rounded-lg text-sm font-sans font-semibold border border-emerald-600/50 text-emerald-400 hover:bg-emerald-900/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                          {wVerifying ? 'Verifying...' : wNewVerified ? '✓ Verified' : 'Verify Account'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="text-[10px] font-sans font-semibold uppercase tracking-widest block mb-1.5" style={{color:'var(--fh-text3)'}}>Amount (₦)</label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-mono" style={{color:'var(--fh-text3)'}}>₦</span>
                      <input type="number" min="1" step="1" value={wAmt} onChange={e => setWAmt(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submitWithdrawal()} placeholder="0"
                        className="fh-input w-full pl-8 pr-4 py-3 rounded-lg text-lg font-mono focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600/30" />
                    </div>
                    {balance !== null && wAmt && Number(wAmt) > 0 && (
                      <p className={`text-[10px] font-sans mt-1.5 px-0.5 ${Number(wAmt)*100 > balance ? 'text-red-400' : 'text-emerald-400'}`}>
                        {Number(wAmt)*100 > balance
                          ? `⚠ Exceeds balance by ${naira(Number(wAmt)*100 - balance)}`
                          : `✓ Remaining after withdrawal: ${naira(balance - Number(wAmt)*100)}`}
                      </p>
                    )}
                  </div>

                  {/* OTP notice */}
                  <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-700/25 bg-amber-900/10">
                    <Icon name="info" size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] font-sans text-amber-400/80 leading-relaxed">
                      After submitting, Paystack will send an <strong>OTP</strong> to your registered email or phone.
                      You will be prompted to enter it here before funds are disbursed.
                    </p>
                  </div>

                  {wErr && (
                    <div className="flex items-start gap-2 p-3 rounded-lg border border-red-700/40 bg-red-900/20">
                      <Icon name="error_outline" size={13} className="text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] font-sans text-red-400">{wErr}</p>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-slate-800 flex gap-3">
                  <button onClick={resetModal}
                    className="flex-1 py-2.5 rounded-xl border border-slate-700 text-sm font-sans text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors">
                    Cancel
                  </button>
                  <button onClick={submitWithdrawal}
                    disabled={wLoading || !wAmt || (wBankMode==='saved' && !wBankId) || (wBankMode==='new' && !wNewVerified) || (balance !== null && Number(wAmt)*100 > balance)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-sans font-semibold text-black flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                    {wLoading
                      ? <><div className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full fh-spin" />Submitting…</>
                      : <><Icon name="send" size={14} />Withdraw {wAmt ? `₦${Number(wAmt).toLocaleString()}` : ''}</>}
                  </button>
                </div>
              </>
            )}


            {/* ── STEP: initiating ── */}
            {wStep === 'initiating' && (
              <div className="px-6 py-12 text-center space-y-5">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full fh-ping" style={{ background:'rgba(16,185,129,0.15)' }} />
                  <div className="relative w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background:'rgba(16,185,129,0.1)', border:'1.5px solid rgba(16,185,129,0.3)' }}>
                    <div className="w-9 h-9 border-2 border-emerald-800 border-t-emerald-400 rounded-full fh-spin" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-sans font-semibold" style={{color:'var(--fh-text1)'}}>Initiating Transfer…</p>
                  <p className="text-xs font-sans mt-2 leading-relaxed" style={{color:'var(--fh-text3)'}}>
                    Paystack is creating the transfer. This typically takes a few seconds.<br />
                    <span className="text-amber-400/80 font-medium">Do not close this window.</span>
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 text-[10px] font-sans text-slate-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 fh-bounce-1" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 fh-bounce-2" />
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 fh-bounce-3" />
                  <span className="ml-2">waiting for Paystack OTP request</span>
                </div>
              </div>
            )}


            {/* ── STEP: otp ── THE MISSING SCREEN — NOW FIXED ── */}
            {wStep === 'otp' && (
              <div className="px-6 py-6 space-y-5">

                {/* Icon + heading */}
                <div className="text-center">
                  <div className="relative w-20 h-20 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full"
                      style={{ background:'rgba(245,158,11,0.08)', border:'1.5px solid rgba(245,158,11,0.25)' }} />
                    <div className="relative w-20 h-20 rounded-full flex items-center justify-center">
                      <Icon name="mark_email_unread" size={32} style={{ color: '#f59e0b' }} />
                    </div>
                  </div>
                  <p className="text-base font-sans font-bold" style={{color:'var(--fh-text1)'}}>Enter OTP to Authorise</p>
                  <p className="text-xs font-sans mt-2 leading-relaxed" style={{color:'var(--fh-text3)'}}>
                    Paystack has sent a one-time password to your<br />
                    registered <strong style={{color:'var(--fh-text2)'}}>email</strong> or <strong style={{color:'var(--fh-text2)'}}>phone number</strong>.<br />
                    Enter it below to disburse funds.
                  </p>
                </div>

                {/* Transfer code strip */}
                {otpTxCode && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg fh-input border border-slate-700 dark:border-slate-600">
                    <span className="text-[10px] font-sans" style={{color:'var(--fh-text3)'}}>Transfer code</span>
                    <span className="text-[10px] font-mono text-amber-500">{otpTxCode}</span>
                  </div>
                )}

                {/* OTP digit boxes */}
                <OtpDots value={otpVal} maxLen={6} />

                {/* Real input (drives the display above) */}
                <input
                  ref={otpInputRef}
                  type="tel"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpVal}
                  onChange={e => {
                    setOtpErr('');
                    setOtpVal(e.target.value.replace(/\D/g,'').slice(0,6));
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && otpVal.length >= 4) submitOtp(); }}
                  placeholder="Enter OTP"
                  className="fh-input w-full text-center text-xl font-mono tracking-widest py-3.5 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
                  style={{ letterSpacing: '0.35em' }}
                  autoComplete="one-time-code"
                />

                {otpErr && (
                  <div className="flex items-start gap-2 p-3 rounded-lg border border-red-700/40 bg-red-900/20">
                    <Icon name="error_outline" size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] font-sans text-red-400">{otpErr}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={resetModal}
                    className="flex-1 py-2.5 rounded-xl border border-slate-700 text-sm font-sans text-slate-400 hover:border-slate-600 hover:text-slate-300 transition-colors">
                    Cancel
                  </button>
                  <button onClick={submitOtp} disabled={otpLoading || otpVal.length < 4}
                    className="flex-1 py-2.5 rounded-xl text-sm font-sans font-semibold text-black flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                    {otpLoading
                      ? <><div className="w-4 h-4 border-2 border-black/40 border-t-black rounded-full fh-spin" />Confirming…</>
                      : <><Icon name="check" size={14} />Confirm OTP ({otpVal.length}/6)</>}
                  </button>
                </div>

              </div>
            )}


            {/* ── STEP: verifying ── */}
            {wStep === 'verifying' && (
              <div className="px-6 py-12 text-center space-y-5">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full fh-ping" style={{ background:'rgba(245,158,11,0.12)' }} />
                  <div className="relative w-20 h-20 rounded-full flex items-center justify-center"
                    style={{ background:'rgba(245,158,11,0.1)', border:'1.5px solid rgba(245,158,11,0.3)' }}>
                    <div className="w-9 h-9 border-2 border-amber-800 border-t-amber-400 rounded-full fh-spin" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-sans font-semibold" style={{color:'var(--fh-text1)'}}>Confirming Transfer…</p>
                  <p className="text-xs font-sans mt-2 leading-relaxed" style={{color:'var(--fh-text3)'}}>
                    OTP submitted. Waiting for Paystack to confirm disbursement.<br />
                    <span className="text-amber-400/80 font-medium">Do not close this window.</span>
                  </p>
                </div>
              </div>
            )}


            {/* ── STEP: done ── */}
            {wStep === 'done' && (
              <div className="px-6 py-8 text-center space-y-5">
                <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{
                  background: wFinalStatus==='completed' ? 'rgba(16,185,129,0.12)' : wFinalStatus==='failed' ? 'rgba(239,68,68,0.12)' : 'rgba(148,163,184,0.12)',
                  border: wFinalStatus==='completed' ? '1.5px solid rgba(16,185,129,0.35)' : wFinalStatus==='failed' ? '1.5px solid rgba(239,68,68,0.35)' : '1.5px solid rgba(148,163,184,0.35)',
                }}>
                  {wFinalStatus==='completed'
                    ? <Icon name="check_circle"  size={36} style={{ color: '#10b981' }} />
                    : wFinalStatus==='failed'
                    ? <Icon name="error_outline" size={36} style={{ color: '#ef4444' }} />
                    : <Icon name="schedule"      size={36} style={{ color: '#94a3b8' }} />}
                </div>
                <div>
                  <p className="text-base font-sans font-bold" style={{ color: wFinalStatus==='completed' ? '#10b981' : wFinalStatus==='failed' ? '#ef4444' : '#94a3b8' }}>
                    {wFinalStatus==='completed' ? '✓ Transfer Successful!' : wFinalStatus==='failed' ? '✗ Transfer Failed' : 'Processing — Check Back Soon'}
                  </p>
                  <p className="text-xs font-sans mt-2 leading-relaxed max-w-xs mx-auto" style={{color:'var(--fh-text3)'}}>
                    {wFinalStatus==='completed'
                      ? 'Funds have been sent to the destination bank account. Check Payout History below for details.'
                      : wStepMsg || (wFinalStatus==='failed'
                        ? 'The withdrawal could not be completed. Contact support if funds were deducted.'
                        : 'Paystack is finalising the transfer. It will appear in Payout History once confirmed.')}
                  </p>
                </div>
                <button onClick={resetModal}
                  className="w-full py-3 rounded-xl text-sm font-sans font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: wFinalStatus==='completed' ? 'linear-gradient(135deg,#10b981,#059669)' : wFinalStatus==='failed' ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#475569,#334155)' }}>
                  {wFinalStatus==='completed' ? '✓ Done' : 'Close'}
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
});
PayoutsTab.displayName = 'PayoutsTab';

export default PayoutsTab;