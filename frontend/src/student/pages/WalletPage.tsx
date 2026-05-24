import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, TrendingUp, TrendingDown, CreditCard, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../core/api'

const css = '' +
  '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
  'body { background: #f4f6f3; font-family: var(--font-sans); }' +
  '.page { min-height: 100vh; background: #f4f6f3; }' +
  '.nav { background: #fff; border-bottom: 1px solid #e8e8e8; padding: 0 40px; height: 64px; display: flex; align-items: center; gap: 16px; position: sticky; top: 0; z-index: 100; }' +
  '.nav-back { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; border: 1px solid #e8e8e8; background: #fff; color: #374151; cursor: pointer; text-decoration: none; transition: background 0.15s; }' +
  '.nav-back:hover { background: #f4f6f3; }' +
  '.nav-badge { width: 34px; height: 34px; background: #007A47; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 13px; }' +
  '.nav-title { font-weight: 700; font-size: 16px; color: #0a0a0a; }' +
  '.main { max-width: 760px; margin: 0 auto; padding: 36px 40px; }' +
  '.balance-card { background: #0a0a0a; border-radius: 20px; padding: 32px 36px; margin-bottom: 24px; position: relative; overflow: hidden; }' +
  '.balance-card::before { content: ""; position: absolute; top: -60px; right: -60px; width: 200px; height: 200px; border-radius: 50%; background: rgba(0,122,71,0.15); }' +
  '.balance-label { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.4); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px; }' +
  '.balance-amount { font-family: var(--font-serif); font-size: 44px; color: #fff; letter-spacing: -2px; line-height: 1; margin-bottom: 20px; }' +
  '.topup-row { display: flex; align-items: center; gap: 10px; }' +
  '.amount-input { height: 46px; padding: 0 14px; background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.12); border-radius: 10px; font-family: var(--font-sans); font-size: 15px; color: #fff; outline: none; transition: border-color 0.15s; width: 160px; }' +
  '.amount-input:focus { border-color: #007A47; }' +
  '.amount-input::placeholder { color: rgba(255,255,255,0.3); }' +
  '.gateway-select { height: 46px; padding: 0 14px; background: rgba(255,255,255,0.08); border: 1.5px solid rgba(255,255,255,0.12); border-radius: 10px; font-family: var(--font-sans); font-size: 14px; color: #fff; outline: none; cursor: pointer; }' +
  '.gateway-select option { background: #1a1a1a; color: #fff; }' +
  '.topup-btn { height: 46px; padding: 0 20px; background: #007A47; border: none; border-radius: 10px; font-family: var(--font-sans); font-size: 14px; font-weight: 700; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: background 0.15s; white-space: nowrap; }' +
  '.topup-btn:hover:not(:disabled) { background: #006339; }' +
  '.topup-btn:disabled { opacity: 0.5; cursor: not-allowed; }' +
  '.spinner { display: inline-block; width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }' +
  '@keyframes spin { to { transform: rotate(360deg); } }' +
  '.section { background: #fff; border-radius: 16px; border: 1px solid #eaeaea; overflow: hidden; }' +
  '.section-head { padding: 18px 24px; border-bottom: 1px solid #f3f4f6; }' +
  '.section-title { font-size: 14px; font-weight: 700; color: #0a0a0a; }' +
  '.tx-row { padding: 14px 24px; border-bottom: 1px solid #f9fafb; display: flex; align-items: center; gap: 12px; }' +
  '.tx-row:last-child { border-bottom: none; }' +
  '.tx-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }' +
  '.tx-icon.credit { background: #f0fdf4; }' +
  '.tx-icon.debit { background: #fef2f2; }' +
  '.tx-info { flex: 1; min-width: 0; }' +
  '.tx-narration { font-size: 13px; font-weight: 600; color: #0a0a0a; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
  '.tx-date { font-size: 11px; color: #9ca3af; }' +
  '.tx-amount { font-size: 14px; font-weight: 700; text-align: right; flex-shrink: 0; }' +
  '.tx-amount.credit { color: #16a34a; }' +
  '.tx-amount.debit { color: #dc2626; }' +
  '.empty { padding: 48px 24px; text-align: center; color: #9ca3af; font-size: 14px; }' +
  '.skeleton { background: #f3f4f6; height: 58px; animation: shimmer 1.2s infinite; }' +
  '@keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.5} }' +
  '.pagination { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 24px; }' +
  '.page-btn { height: 34px; padding: 0 14px; border-radius: 8px; border: 1.5px solid #e8e8e8; background: #fff; font-family: var(--font-sans); font-size: 13px; font-weight: 600; color: #374151; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.15s; }' +
  '.page-btn:hover:not(:disabled) { border-color: #007A47; color: #007A47; }' +
  '.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }' +
  '.page-info { font-size: 13px; color: #9ca3af; padding: 0 8px; }' +
  '@media (max-width: 640px) { .nav { padding: 0 16px; } .main { padding: 24px 16px; } .topup-row { flex-wrap: wrap; } .balance-amount { font-size: 32px; } }'

const naira = (val: string | number) =>
  '\u20A6' + parseFloat(String(val || 0)).toLocaleString('en-NG', { minimumFractionDigits: 2 })

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

export default function WalletPage() {
  const [amount, setAmount] = useState('')
  const [gateway, setGateway] = useState<'paystack' | 'flutterwave'>('paystack')
  const [page, setPage] = useState(1)
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()

  const callbackReference = searchParams.get('reference') || searchParams.get('tx_ref') || ''

  const { data: profile } = useQuery({
    queryKey: ['student-profile'],
    queryFn: async () => {
      const res = await api.get('/users/me/student-profile/')
      return res.data
    },
  })

  const { data: txData, isLoading } = useQuery({
    queryKey: ['wallet-transactions', page],
    queryFn: async () => {
      const res = await api.get(`/payments/wallet/transactions/?page=${page}&page_size=15`)
      return res.data
    },
  })

  const topupMutation = useMutation({
    mutationFn: async (payload: { idempotencyKey: string }) => {
      const res = await api.post(
        '/payments/wallet/topup/',
        {
          amount: parseFloat(amount),
          gateway,
          callback_url: `${window.location.origin}/student/wallet`,
        },
        { headers: { 'Idempotency-Key': payload.idempotencyKey } },
      )
      return res.data
    },
    onSuccess: (data) => {
      const url = data.payment_url
      if (url) window.location.href = url
    },
    onError: () => toast.error('Failed to initiate top-up. Please try again.'),
  })

  const handleTopUp = () => {
    const val = parseFloat(amount)
    if (!val || val < 100) {
      toast.error('Minimum top-up amount is NGN 100.')
      return
    }
    const idempotencyKey = crypto.randomUUID()
    topupMutation.mutate({ idempotencyKey })
  }

  const { data: topupStatus } = useQuery({
    queryKey: ['wallet-topup-status', callbackReference],
    queryFn: async () => {
      const res = await api.get(`/payments/wallet/topup/status/${callbackReference}/`)
      return res.data
    },
    enabled: Boolean(callbackReference),
    refetchInterval: (query: any) => {
      const d = query?.state?.data;
      if (!d) return 5000
      return ['initiated', 'pending'].includes(d.status) ? 5000 : false
    },
  })

  useEffect(() => {
    if (!topupStatus) return
    if (topupStatus.status === 'success') {
      toast.success('Wallet top-up confirmed.')
      queryClient.invalidateQueries({ queryKey: ['student-profile'] })
      queryClient.invalidateQueries({ queryKey: ['wallet-transactions'] })
      setSearchParams({})
    } else if (['failed', 'abandoned'].includes(topupStatus.status)) {
      toast.error('Top-up failed or was cancelled.')
      setSearchParams({})
    }
  }, [topupStatus, queryClient, setSearchParams])

  const transactions = txData?.results || []
  const pagination = txData?.pagination

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <nav className="nav">
          <Link to="/student" className="nav-back"><ArrowLeft size={16} /></Link>
          <div className="nav-badge">LR</div>
          <span className="nav-title">Wallet</span>
        </nav>

        <main className="main">
          <div className="balance-card">
            <div className="balance-label">Available Balance</div>
            <div className="balance-amount">
              {profile ? naira(profile.wallet_balance) : '--'}
            </div>
            <div className="topup-row">
              <input
                className="amount-input"
                type="number"
                placeholder="Amount (NGN)"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="100"
              />
              <select
                className="gateway-select"
                value={gateway}
                onChange={e => setGateway(e.target.value as 'paystack' | 'flutterwave')}
              >
                <option value="paystack">Paystack</option>
                <option value="flutterwave">Flutterwave</option>
              </select>
              <button className="topup-btn" onClick={handleTopUp} disabled={topupMutation.isPending}>
                {topupMutation.isPending
                  ? <><span className="spinner" /> Processing...</>
                  : <><Plus size={15} /> Top Up</>
                }
              </button>
            </div>
          </div>

          <div className="section">
            <div className="section-head">
              <div className="section-title">Transaction History</div>
            </div>
            {isLoading ? (
              [1, 2, 3, 4].map(i => <div key={i} className="skeleton" />)
            ) : transactions.length === 0 ? (
              <div className="empty">No transactions yet. Top up your wallet to get started.</div>
            ) : (
              transactions.map((tx: any) => (
                <div className="tx-row" key={tx.id}>
                  <div className={`tx-icon ${tx.transaction_type}`}>
                    {tx.transaction_type === 'credit'
                      ? <TrendingUp size={17} color="#16a34a" />
                      : <TrendingDown size={17} color="#dc2626" />
                    }
                  </div>
                  <div className="tx-info">
                    <div className="tx-narration">{tx.narration}</div>
                    <div className="tx-date">{fmt(tx.created_at)} &middot; Ref: {tx.reference}</div>
                  </div>
                  <div className={`tx-amount ${tx.transaction_type}`}>
                    {tx.transaction_type === 'credit' ? '+' : '-'}{naira(tx.amount)}
                  </div>
                </div>
              ))
            )}
            {pagination && pagination.total_pages > 1 && (
              <div className="pagination">
                <button className="page-btn" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                  <ArrowLeft size={13} /> Prev
                </button>
                <span className="page-info">Page {page} of {pagination.total_pages}</span>
                <button className="page-btn" disabled={page === pagination.total_pages} onClick={() => setPage(p => p + 1)}>
                  Next <CreditCard size={13} />
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  )
}