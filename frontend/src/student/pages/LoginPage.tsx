import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'

const schema = z.object({
  phone_number: z.string().min(7, 'Enter a valid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await api.post('/auth/login/', data)
      return res.data
    },
    onSuccess: async (data) => {
      const userRes = await api.get('/users/me/', {
        headers: { Authorization: `Bearer ${data.access}` },
      })
      setAuth(userRes.data, data.access, data.refresh)
      toast.success(`Welcome back, ${data.user.full_name}`)
      const role = data.user.role
      if (role === 'admin') navigate('/admin')
      else if (role === 'driver') navigate('/driver')
      else navigate('/student')
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.error?.message || 'Invalid credentials.'
      toast.error(msg)
    },
  })

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-family: 'Instrument Sans', sans-serif;
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
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 110% 110%, rgba(0,0,0,0.18) 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at -10% -10%, rgba(255,255,255,0.07) 0%, transparent 60%);
        }

        .panel-left-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .left-top {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-badge {
          width: 36px;
          height: 36px;
          background: #ffffff;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 13px;
          color: #007A47;
          letter-spacing: -0.5px;
          flex-shrink: 0;
        }

        .logo-name {
          color: #fff;
          font-weight: 600;
          font-size: 17px;
          letter-spacing: -0.3px;
        }

        .left-mid {
          position: relative;
          z-index: 2;
          margin-top: auto;
          margin-bottom: auto;
          padding: 60px 0;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 100px;
          padding: 5px 12px 5px 8px;
          margin-bottom: 32px;
        }

        .tag-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #5ddf9e;
          box-shadow: 0 0 0 3px rgba(93,223,158,0.25);
          animation: blink 2s ease infinite;
        }

        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.5} }

        .tag-text {
          color: rgba(255,255,255,0.9);
          font-size: 11px;
          font-weight: 500;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .headline {
          font-family: 'Instrument Serif', serif;
          font-size: 52px;
          line-height: 1.05;
          color: #ffffff;
          letter-spacing: -1.5px;
          margin-bottom: 24px;
        }

        .headline em {
          font-style: italic;
          color: rgba(255,255,255,0.7);
        }

        .subline {
          color: rgba(255,255,255,0.6);
          font-size: 15px;
          line-height: 1.7;
          font-weight: 400;
          max-width: 300px;
        }

        .left-bottom {
          position: relative;
          z-index: 2;
          border-top: 1px solid rgba(255,255,255,0.12);
          padding-top: 28px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .stat-num {
          font-family: 'Instrument Serif', serif;
          font-size: 26px;
          color: #ffffff;
          letter-spacing: -0.5px;
          line-height: 1;
          margin-bottom: 4px;
        }

        .stat-lbl {
          font-size: 11px;
          color: rgba(255,255,255,0.45);
          letter-spacing: 0.8px;
          text-transform: uppercase;
          font-weight: 500;
        }

        /* ── RIGHT PANEL ── */
        .panel-right {
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 52px;
        }

        .form-box {
          width: 100%;
          max-width: 360px;
        }

        .form-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #007A47;
          margin-bottom: 12px;
        }

        .form-title {
          font-family: 'Instrument Serif', serif;
          font-size: 36px;
          color: #0a0a0a;
          letter-spacing: -1px;
          line-height: 1.1;
          margin-bottom: 8px;
        }

        .form-sub {
          font-size: 14px;
          color: #9ca3af;
          font-weight: 400;
          margin-bottom: 40px;
        }

        .field {
          margin-bottom: 22px;
        }

        .field-label {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          letter-spacing: 0.4px;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .input-wrap {
          position: relative;
        }

        .field-input {
          width: 100%;
          height: 50px;
          padding: 0 50px 0 16px;
          background: #fafafa;
          border: 1.5px solid #e8e8e8;
          border-radius: 12px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 15px;
          color: #0a0a0a;
          outline: none;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }

        .field-input.focused {
          border-color: #007A47;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(0,122,71,0.08);
        }

        .field-input.has-error {
          border-color: #ef4444;
          background: #fff9f9;
        }

        .field-input::placeholder { color: #c4c4c4; }

        .show-btn {
          position: absolute;
          right: 0;
          top: 0;
          height: 50px;
          width: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          cursor: pointer;
          color: #9ca3af;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          font-family: 'Instrument Sans', sans-serif;
          transition: color 0.15s;
        }

        .show-btn:hover { color: #007A47; }

        .field-error {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #ef4444;
          font-size: 12px;
          margin-top: 6px;
          font-weight: 400;
        }

        .submit-btn {
          width: 100%;
          height: 52px;
          background: #007A47;
          border: none;
          border-radius: 12px;
          color: #ffffff;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: 0.2px;
          cursor: pointer;
          margin-top: 8px;
          position: relative;
          overflow: hidden;
          transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
          box-shadow: 0 4px 20px rgba(0,122,71,0.3);
        }

        .submit-btn:hover:not(:disabled) {
          background: #006339;
          box-shadow: 0 6px 24px rgba(0,122,71,0.4);
          transform: translateY(-1px);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
          box-shadow: 0 2px 12px rgba(0,122,71,0.25);
        }

        .submit-btn:disabled {
          background: #a7d9c0;
          box-shadow: none;
          cursor: not-allowed;
        }

        .spinner {
          display: inline-block;
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          vertical-align: middle;
          margin-right: 8px;
        }

        @keyframes spin { to { transform: rotate(360deg); } }

        .divider {
          display: flex;
          align-items: center;
          gap: 14px;
          margin: 28px 0 24px;
        }

        .divider-line { flex: 1; height: 1px; background: #f0f0f0; }
        .divider-txt { font-size: 12px; color: #d1d5db; font-weight: 500; }

        .footer-links {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .footer-links p {
          font-size: 13.5px;
          color: #9ca3af;
          text-align: center;
        }

        .footer-links a {
          color: #007A47;
          font-weight: 600;
          text-decoration: none;
        }

        .footer-links a:hover { text-decoration: underline; }

        @media (max-width: 820px) {
          .page { grid-template-columns: 1fr; }
          .panel-left { display: none; }
          .panel-right { padding: 40px 28px; }
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
            <div className="tag">
              <span className="tag-dot" />
              <span className="tag-text">Now accepting riders</span>
            </div>
            <h2 className="headline">
              Move smarter,<br /><em>every day.</em>
            </h2>
            <p className="subline">
              Reliable rides connecting students and drivers. Book in seconds, track in real time, arrive with confidence.
            </p>
          </div>

          <div className="left-bottom">
            <div>
              <div className="stat-num">2 min</div>
              <div className="stat-lbl">Avg pickup</div>
            </div>
            <div>
              <div className="stat-num">24 / 7</div>
              <div className="stat-lbl">Available</div>
            </div>
            <div>
              <div className="stat-num">Vetted</div>
              <div className="stat-lbl">All drivers</div>
            </div>
          </div>
        </div>

        <div className="panel-right">
          <div className="form-box">

            <div className="form-eyebrow">Student Portal</div>
            <h1 className="form-title">Welcome<br />back</h1>
            <p className="form-sub">Sign in to book your next ride</p>

            <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>

              <div className="field">
                <div className="field-label">Phone Number</div>
                <div className="input-wrap">
                  <input
                    {...register('phone_number')}
                    placeholder="+234 801 234 5678"
                    className={`field-input${focused === 'phone' ? ' focused' : ''}${errors.phone_number ? ' has-error' : ''}`}
                    onFocus={() => setFocused('phone')}
                    onBlur={() => setFocused(null)}
                  />
                </div>
                {errors.phone_number && (
                  <div className="field-error">{errors.phone_number.message}</div>
                )}
              </div>

              <div className="field">
                <div className="field-label">
                  <span>Password</span>
                </div>
                <div className="input-wrap">
                  <input
                    {...register('password')}
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    className={`field-input${focused === 'pass' ? ' focused' : ''}${errors.password ? ' has-error' : ''}`}
                    onFocus={() => setFocused('pass')}
                    onBlur={() => setFocused(null)}
                  />
                  <button type="button" className="show-btn" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? 'hide' : 'show'}
                  </button>
                </div>
                {errors.password && (
                  <div className="field-error">{errors.password.message}</div>
                )}
              </div>

              <button type="submit" className="submit-btn" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <><span className="spinner" />Signing in...</>
                ) : 'Sign In'}
              </button>

            </form>

            <div className="divider">
              <div className="divider-line" />
              <span className="divider-txt">or</span>
              <div className="divider-line" />
            </div>

            <div className="footer-links">
              <p>No account yet? <Link to="/register">Create one</Link></p>
              <p>Are you a driver? <Link to="/driver/login">Driver login</Link></p>
            </div>

          </div>
        </div>

      </div>
    </>
  )
}