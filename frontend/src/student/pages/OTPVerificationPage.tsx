import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../core/api'

export default function OTPVerificationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Phone usually comes from Register screen via React Router state
  const phone_number = location.state?.phone || ''

  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [countdown, setCountdown] = useState(60)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!phone_number) {
      toast.error('No phone number provided. Please register or log in first.')
      navigate('/login')
    }
  }, [phone_number, navigate])

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const verifyMutation = useMutation({
    mutationFn: async (otp: string) => {
      const res = await api.post('/auth/otp/verify/', {
        phone_number,
        code: otp,
        purpose: 'phone_verification',
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Phone verified successfully! You can now log in.')
      navigate('/login')
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error?.message || 'Invalid verification code.'
      toast.error(msg)
    },
  })

  const resendMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/auth/otp/request/', {
        phone_number,
        purpose: 'phone_verification',
      })
      return res.data
    },
    onSuccess: () => {
      toast.success('Verification code resent')
      setCountdown(60)
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error?.message || 'Failed to resend code.'
      toast.error(msg)
    },
  })

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pasted = value.slice(0, 6).split('')
      setCode((prev) => {
        const next = [...prev]
        pasted.forEach((char, i) => {
          if (index + i < 6) next[index + i] = char
        })
        return next
      })
      const nextIndex = Math.min(index + pasted.length, 5)
      inputRefs.current[nextIndex]?.focus()
      return
    }

    if (!/^\d*$/.test(value)) return

    setCode((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    const otp = code.join('')
    if (otp.length !== 6) {
      toast.error('Please enter all 6 digits')
      return
    }
    verifyMutation.mutate(otp)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-family: system-ui, -apple-system, sans-serif;
        }

        /* ── LEFT PANEL ── */
        .panel-left {
          background: #007A47;
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 52px;
          overflow: hidden;
        }

        .panel-left-bg {
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 110% 110%, rgba(0,0,0,0.18) 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at -10% -10%, rgba(255,255,255,0.07) 0%, transparent 60%);
        }

        .panel-left-grid {
          position: absolute; inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .left-top {
          position: relative; z-index: 2;
          display: flex; align-items: center; gap: 10px;
        }

        .logo-badge {
          width: 36px; height: 36px; background: #ffffff; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 13px; color: #007A47; letter-spacing: -0.5px; flex-shrink: 0;
        }

        .logo-name { color: #fff; font-weight: 600; font-size: 17px; letter-spacing: -0.3px; }

        .left-mid {
          position: relative; z-index: 2;
          margin-top: auto; margin-bottom: auto; padding: 60px 0;
        }

        .headline {
          font-family: ui-serif, Georgia, serif; font-size: 52px;
          line-height: 1.05; color: #ffffff; letter-spacing: -1.5px; margin-bottom: 24px;
        }
        .headline em { font-style: italic; color: rgba(255,255,255,0.7); }

        .subline {
          color: rgba(255,255,255,0.6); font-size: 15px; line-height: 1.7; font-weight: 400; max-width: 300px;
        }

        /* ── RIGHT PANEL ── */
        .panel-right {
          background: #ffffff; display: flex; align-items: center; justify-content: center; padding: 52px;
        }

        .form-box { width: 100%; max-width: 380px; }

        .form-eyebrow {
          font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase;
          color: #007A47; margin-bottom: 12px;
        }

        .form-title {
          font-family: ui-serif, Georgia, serif; font-size: 36px; color: #0a0a0a;
          letter-spacing: -1px; line-height: 1.1; margin-bottom: 8px;
        }

        .form-sub { font-size: 14px; color: #9ca3af; font-weight: 400; margin-bottom: 40px; line-height: 1.5; }
        .form-sub strong { color: #4b5563; }

        .otp-container {
          display: flex; justify-content: space-between; gap: 8px; margin-bottom: 32px;
        }

        .otp-input {
          width: 50px; height: 56px; border: 1.5px solid #e8e8e8; border-radius: 12px;
          background: #fafafa; text-align: center; font-size: 20px; font-weight: 600;
          font-family: system-ui, -apple-system, sans-serif; transition: all 0.2s; outline: none;
        }
        .otp-input:focus { border-color: #007A47; background: #fff; box-shadow: 0 0 0 4px rgba(0,122,71,0.08); }

        .submit-btn {
          width: 100%; height: 52px; background: #007A47; border: none; border-radius: 12px;
          color: #ffffff; font-family: system-ui, -apple-system, sans-serif; font-size: 15px; font-weight: 600;
          letter-spacing: 0.2px; cursor: pointer; margin-top: 8px; transition: all 0.2s;
          box-shadow: 0 4px 20px rgba(0,122,71,0.3);
        }
        .submit-btn:hover:not(:disabled) { background: #006339; box-shadow: 0 6px 24px rgba(0,122,71,0.4); transform: translateY(-1px); }
        .submit-btn:disabled { background: #a7d9c0; box-shadow: none; cursor: not-allowed; }

        .resend-box { text-align: center; margin-top: 24px; font-size: 13.5px; color: #6b7280; }
        .resend-btn {
          background: none; border: none; color: #007A47; font-weight: 600;
          font-family: system-ui, -apple-system, sans-serif; font-size: 13.5px; cursor: pointer;
        }
        .resend-btn:hover { text-decoration: underline; }
        .resend-btn:disabled { color: #9ca3af; cursor: not-allowed; text-decoration: none; }

        .spinner {
          display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite;
          vertical-align: middle; margin-right: 8px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 820px) {
          .page { grid-template-columns: 1fr; }
          .panel-left { display: none; }
          .panel-right { padding: 40px 28px; }
          .otp-input { width: 44px; height: 52px; }
        }
      `}</style>

      <div className="page">
        <div className="panel-left">
          <div className="panel-left-bg" />
          <div className="panel-left-grid" />
          <div className="left-top">
            <div className="logo-badge">LR</div>
            <span className="logo-name">LR Ride</span>
          </div>
          <div className="left-mid">
            <h2 className="headline">Secure your<br /><em>account.</em></h2>
            <p className="subline">We use phone verification to ensure all riders and drivers in our ecosystem are real and vetted.</p>
          </div>
        </div>

        <div className="panel-right">
          <div className="form-box">
            <div className="form-eyebrow">Verification</div>
            <h1 className="form-title">Enter code</h1>
            <p className="form-sub">We sent a 6-digit code to <strong>{phone_number}</strong>. Enter it below to verify your account.</p>

            <form onSubmit={handleVerify}>
              <div className="otp-container">
                {code.map((data, index) => (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={data}
                    className="otp-input"
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                  />
                ))}
              </div>

              <button type="submit" className="submit-btn" disabled={verifyMutation.isPending}>
                {verifyMutation.isPending ? <><span className="spinner" />Verifying...</> : 'Verify Account'}
              </button>
            </form>

            <div className="resend-box">
              {countdown > 0 ? (
                <span>Resend code in {countdown}s</span>
              ) : (
                <span>
                  Didn't receive it?{' '}
                  <button type="button" className="resend-btn" onClick={() => resendMutation.mutate()} disabled={resendMutation.isPending}>
                    {resendMutation.isPending ? 'Resending...' : 'Resend now'}
                  </button>
                </span>
              )}
            </div>
            
            <div className="resend-box" style={{marginTop: '16px'}}>
              <Link to="/login" style={{color: '#007A47', fontWeight: 500, textDecoration: 'none'}}>
                ← Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
