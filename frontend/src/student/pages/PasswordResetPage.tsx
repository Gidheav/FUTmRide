import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../core/api'

const requestSchema = z.object({
  phone_number: z.string().min(7, 'Enter a valid phone number'),
})
type RequestData = z.infer<typeof requestSchema>

const resetSchema = z.object({
  password: z.string().min(8, 'Minimum 8 characters'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})
type ResetData = z.infer<typeof resetSchema>

export default function PasswordResetPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(60)
  
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (step === 2 && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [step, countdown])

  const requestForm = useForm<RequestData>({ resolver: zodResolver(requestSchema) })
  const resetForm = useForm<ResetData>({ resolver: zodResolver(resetSchema) })

  const requestMutation = useMutation({
    mutationFn: async (data: RequestData) => {
      let p = data.phone_number.trim()
      if (p.startsWith('0') && p.length === 11) p = '+234' + p.slice(1)
      const res = await api.post('/auth/password-reset/request/', { phone_number: p })
      return { data: res.data, submittedPhone: p }
    },
    onSuccess: ({ data, submittedPhone }) => {
      setPhone(submittedPhone)
      setStep(2)
      setCountdown(60)
      toast.success(data.message || 'If an account exists, an OTP has been sent.')
    },
    onError: () => {
      toast.error('Failed to request password reset.')
    },
  })

  const resetMutation = useMutation({
    mutationFn: async (data: ResetData) => {
      const otp = code.join('')
      if (otp.length !== 6) throw new Error('Incomplete OTP')
      
      const res = await api.post('/auth/password-reset/confirm/', {
        phone_number: phone,
        code: otp,
        new_password: data.password,
        confirm_password: data.confirm_password,
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Password reset successfully. You can now log in.')
      navigate('/login')
    },
    onError: (error: any) => {
      const msg = error.message === 'Incomplete OTP' 
        ? 'Please enter the 6-digit OTP.' 
        : error?.response?.data?.error?.message || 'Failed to reset password.'
      toast.error(msg)
    },
  })

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      const pasted = value.slice(0, 6).split('')
      setCode((prev) => {
        const next = [...prev]
        pasted.forEach((char, i) => { if (index + i < 6) next[index + i] = char })
        return next
      })
      inputRefs.current[Math.min(index + pasted.length, 5)]?.focus()
      return
    }
    if (!/^\d*$/.test(value)) return
    setCode((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
    if (value && index < 5) inputRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f9fafb; font-family: system-ui, -apple-system, sans-serif; }
        
        .reset-page {
          min-height: 100vh; display: flex; flex-direction: column;
          align-items: center; justify-content: center; padding: 24px;
        }

        .reset-header { text-align: center; margin-bottom: 40px; }
        .logo-badge {
          width: 48px; height: 48px; background: #007A47; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 16px; color: #fff; margin: 0 auto 16px;
        }

        .card {
          width: 100%; max-width: 440px; background: #fff; border-radius: 16px;
          padding: 40px; box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08);
        }

        .form-title { font-family: ui-serif, Georgia, serif; font-size: 32px; color: #0a0a0a; text-align: center; margin-bottom: 8px; line-height: 1.1; }
        .form-sub { font-size: 15px; color: #6b7280; text-align: center; margin-bottom: 32px; line-height: 1.5; }
        
        .field { margin-bottom: 20px; }
        .field-label { font-size: 12px; font-weight: 600; color: #374151; letter-spacing: 0.4px; text-transform: uppercase; margin-bottom: 8px; }
        .field-input {
          width: 100%; height: 50px; padding: 0 16px; background: #fafafa; border: 1.5px solid #e8e8e8;
          border-radius: 12px; font-family: system-ui, -apple-system, sans-serif; font-size: 15px; outline: none; transition: 0.2s;
        }
        .field-input:focus { border-color: #007A47; background: #fff; box-shadow: 0 0 0 4px rgba(0,122,71,0.08); }
        .field-error { color: #ef4444; font-size: 13px; margin-top: 6px; }

        .input-wrap { position: relative; }
        .show-btn {
          position: absolute; right: 0; top: 0; height: 50px; width: 50px; display: flex; align-items: center; justify-content: center;
          background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 11px; font-weight: 700; text-transform: uppercase;
        }
        .show-btn:hover { color: #007A47; }

        .otp-container { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 24px; }
        .otp-input {
          width: 50px; height: 56px; border: 1.5px solid #e8e8e8; border-radius: 12px; background: #fafafa;
          text-align: center; font-size: 20px; font-weight: 600; outline: none; transition: 0.2s;
        }
        .otp-input:focus { border-color: #007A47; background: #fff; box-shadow: 0 0 0 4px rgba(0,122,71,0.08); }

        .submit-btn {
          width: 100%; height: 52px; background: #007A47; border: none; border-radius: 12px; color: #fff;
          font-family: inherit; font-size: 15px; font-weight: 600; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 14px rgba(0,122,71,0.25);
        }
        .submit-btn:hover:not(:disabled) { background: #006339; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,122,71,0.3); }
        .submit-btn:disabled { background: #a7d9c0; box-shadow: none; cursor: not-allowed; }

        .footer-link { display: block; text-align: center; margin-top: 24px; color: #6b7280; font-size: 14px; text-decoration: none; font-weight: 500; }
        .footer-link:hover { color: #007A47; }
        .resend-box { text-align: center; font-size: 13.5px; color: #6b7280; margin-bottom: 24px; }
        
        @media (max-width: 480px) { .card { padding: 32px 24px; } .otp-input { width: 44px; height: 52px; } }
      `}</style>
      
      <div className="reset-page">
        <div className="reset-header">
          <div className="logo-badge">LR</div>
        </div>

        <div className="card">
          {step === 1 ? (
            <>
              <h1 className="form-title">Reset password</h1>
              <p className="form-sub">Enter your phone number to receive a recovery code.</p>
              
              <form onSubmit={requestForm.handleSubmit(d => requestMutation.mutate(d))}>
                <div className="field">
                  <div className="field-label">Phone Number</div>
                  <input {...requestForm.register('phone_number')} placeholder="+234 800 000 0000" className="field-input" />
                  {requestForm.formState.errors.phone_number && <div className="field-error">{requestForm.formState.errors.phone_number.message}</div>}
                </div>
                <button type="submit" className="submit-btn" disabled={requestMutation.isPending}>
                  {requestMutation.isPending ? 'Sending...' : 'Send Recovery Code'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="form-title">Set new password</h1>
              <p className="form-sub">Enter the code sent to <strong>{phone}</strong></p>
              
              <form onSubmit={resetForm.handleSubmit(d => resetMutation.mutate(d))}>
                <div className="otp-container">
                  {code.map((c, i) => (
                    <input
                      key={i}
                      ref={el => { inputRefs.current[i] = el }}
                      value={c}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      maxLength={6}
                      className="otp-input"
                      inputMode="numeric"
                    />
                  ))}
                </div>
                
                <div className="resend-box">
                  {countdown > 0 ? (
                    `Resend code in ${countdown}s`
                  ) : (
                    <span style={{ cursor: 'pointer', color: '#007A47', fontWeight: 600 }} onClick={() => requestMutation.mutate({ phone_number: phone })}>
                      Resend code now
                    </span>
                  )}
                </div>

                <div className="field">
                  <div className="field-label">New Password</div>
                  <div className="input-wrap">
                    <input {...resetForm.register('password')} type={showPass ? 'text' : 'password'} className="field-input" placeholder="Min. 8 characters" style={{ paddingRight: 50 }} />
                    <button type="button" className="show-btn" onClick={() => setShowPass(!showPass)}>{showPass ? 'hide' : 'show'}</button>
                  </div>
                  {resetForm.formState.errors.password && <div className="field-error">{resetForm.formState.errors.password.message}</div>}
                </div>

                <div className="field">
                  <div className="field-label">Confirm Password</div>
                  <div className="input-wrap">
                    <input {...resetForm.register('confirm_password')} type={showConfirm ? 'text' : 'password'} className="field-input" placeholder="Repeat password" style={{ paddingRight: 50 }} />
                    <button type="button" className="show-btn" onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? 'hide' : 'show'}</button>
                  </div>
                  {resetForm.formState.errors.confirm_password && <div className="field-error">{resetForm.formState.errors.confirm_password.message}</div>}
                </div>

                <button type="submit" className="submit-btn" disabled={resetMutation.isPending}>
                  {resetMutation.isPending ? 'Resetting...' : 'Reset Password'}
                </button>
              </form>
            </>
          )}

          <Link to="/login" className="footer-link">← Back to sign in</Link>
        </div>
      </div>
    </>
  )
}
