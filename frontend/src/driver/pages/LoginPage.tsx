import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Car, Users, Clock, ShieldCheck } from 'lucide-react'
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
      let phone = data.phone_number.trim()
      if (phone.startsWith('0') && phone.length === 11) phone = '+234' + phone.slice(1)
      const res = await api.post('/auth/login/', { ...data, phone_number: phone })
      return res.data
    },
    onSuccess: async (data) => {
      if (data.user.role !== 'driver') {
        toast.error('This login is for drivers only.')
        return
      }
      const userRes = await api.get('/users/me/', {
        headers: { Authorization: `Bearer ${data.access}` },
      })
      setAuth(userRes.data, data.access, data.refresh)
      toast.success(`Welcome back, ${data.user.full_name}`)
      navigate('/driver')
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
        .page { min-height: 100vh; display: grid; grid-template-columns: 1fr 1fr; font-family: system-ui, -apple-system, sans-serif; }

        .panel-left { background: #0a0a0a; position: relative; display: flex; flex-direction: column; padding: 52px; overflow: hidden; }
        .panel-left-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 48px 48px; }
        .panel-left-glow { position: absolute; bottom: -100px; left: -100px; width: 400px; height: 400px; border-radius: 50%; background: radial-gradient(circle, rgba(0,122,71,0.2) 0%, transparent 70%); }

        .left-top { position: relative; z-index: 2; display: flex; align-items: center; gap: 10px; }
        .logo-badge { width: 36px; height: 36px; background: #007A47; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: #fff; letter-spacing: -0.5px; }
        .logo-name { color: #fff; font-weight: 600; font-size: 17px; letter-spacing: -0.3px; }
        .driver-tag { margin-left: 4px; background: rgba(0,122,71,0.3); border: 1px solid rgba(0,122,71,0.5); border-radius: 6px; padding: 2px 8px; font-size: 10px; font-weight: 700; color: #4ade80; letter-spacing: 0.8px; text-transform: uppercase; }

        .left-mid { position: relative; z-index: 2; margin-top: auto; margin-bottom: auto; padding: 60px 0; }
        .tag { display: inline-flex; align-items: center; gap: 7px; background: rgba(0,122,71,0.15); border: 1px solid rgba(0,122,71,0.3); border-radius: 100px; padding: 5px 12px 5px 8px; margin-bottom: 32px; }
        .tag-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; animation: blink 2s ease infinite; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .tag-text { color: #4ade80; font-size: 11px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; }
        .headline { font-family: ui-serif, Georgia, serif; font-size: 48px; line-height: 1.05; color: #fff; letter-spacing: -1.5px; margin-bottom: 24px; }
        .headline em { font-style: italic; color: rgba(255,255,255,0.45); }
        .subline { color: rgba(255,255,255,0.45); font-size: 15px; line-height: 1.7; max-width: 300px; }

        .perks { position: relative; z-index: 2; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 28px; display: flex; flex-direction: column; gap: 14px; }
        .perk { display: flex; align-items: center; gap: 12px; }
        .perk-icon { width: 32px; height: 32px; border-radius: 8px; background: rgba(0,122,71,0.2); border: 1px solid rgba(0,122,71,0.3); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .perk-text { font-size: 13px; color: rgba(255,255,255,0.55); }
        .perk-text strong { color: rgba(255,255,255,0.85); font-weight: 600; }

        .panel-right { background: #ffffff; display: flex; align-items: center; justify-content: center; padding: 52px; }
        .form-box { width: 100%; max-width: 360px; }
        .form-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #007A47; margin-bottom: 12px; }
        .form-title { font-family: ui-serif, Georgia, serif; font-size: 34px; color: #0a0a0a; letter-spacing: -1px; line-height: 1.1; margin-bottom: 6px; }
        .form-sub { font-size: 14px; color: #9ca3af; margin-bottom: 36px; }

        .field { margin-bottom: 20px; }
        .field-label { font-size: 12px; font-weight: 600; color: #374151; letter-spacing: 0.4px; text-transform: uppercase; margin-bottom: 7px; }
        .input-wrap { position: relative; }
        .field-input { width: 100%; height: 50px; padding: 0 46px 0 14px; background: #fafafa; border: 1.5px solid #e8e8e8; border-radius: 10px; font-family: system-ui, -apple-system, sans-serif; font-size: 15px; color: #0a0a0a; outline: none; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s; box-sizing: border-box; }
        .field-input.no-icon { padding-right: 14px; }
        .field-input.focused { border-color: #007A47; background: #fff; box-shadow: 0 0 0 4px rgba(0,122,71,0.08); }
        .field-input.has-error { border-color: #ef4444; }
        .field-input::placeholder { color: #c4c4c4; }
        .show-btn { position: absolute; right: 0; top: 0; height: 50px; width: 46px; display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; font-family: system-ui, -apple-system, sans-serif; transition: color 0.15s; }
        .show-btn:hover { color: #007A47; }
        .field-error { color: #ef4444; font-size: 12px; margin-top: 5px; }

        .submit-btn { width: 100%; height: 52px; background: #007A47; border: none; border-radius: 10px; color: #fff; font-family: system-ui, -apple-system, sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; transition: background 0.2s, transform 0.1s, box-shadow 0.2s; box-shadow: 0 4px 20px rgba(0,122,71,0.3); }
        .submit-btn:hover:not(:disabled) { background: #006339; box-shadow: 0 6px 24px rgba(0,122,71,0.4); transform: translateY(-1px); }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { background: #a7d9c0; box-shadow: none; cursor: not-allowed; }
        .spinner { display: inline-block; width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 8px; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .divider { display: flex; align-items: center; gap: 14px; margin: 28px 0 24px; }
        .divider-line { flex: 1; height: 1px; background: #f0f0f0; }
        .divider-txt { font-size: 12px; color: #d1d5db; font-weight: 500; }
        .footer-links { display: flex; flex-direction: column; gap: 10px; }
        .footer-links p { font-size: 13.5px; color: #9ca3af; text-align: center; }
        .footer-links a { color: #007A47; font-weight: 600; text-decoration: none; }
        .footer-links a:hover { text-decoration: underline; }

        @media (max-width: 820px) {
          .page { grid-template-columns: 1fr; }
          .panel-left { display: none; }
          .panel-right { padding: 40px 28px; }
        }
      `}</style>

      <div className="page">
        <div className="panel-left">
          <div className="panel-left-grid" />
          <div className="panel-left-glow" />
          <div className="left-top">
            <div className="logo-badge">LR</div>
            <span className="logo-name">LR Ride</span>
            <span className="driver-tag">Driver</span>
          </div>
          <div className="left-mid">
            <div className="tag"><span className="tag-dot" /><span className="tag-text">Drivers online now</span></div>
            <h2 className="headline">Earn on<br /><em>your schedule.</em></h2>
            <p className="subline">Accept rides, track your earnings, and stay in control — all from one place.</p>
          </div>
          <div className="perks">
            <div className="perk">
              <div className="perk-icon"><Car size={15} color="#4ade80" /></div>
              <div className="perk-text"><strong>Flexible hours</strong> — drive when you want</div>
            </div>
            <div className="perk">
              <div className="perk-icon"><Users size={15} color="#4ade80" /></div>
              <div className="perk-text"><strong>Verified riders</strong> — safe, accountable trips</div>
            </div>
            <div className="perk">
              <div className="perk-icon"><Clock size={15} color="#4ade80" /></div>
              <div className="perk-text"><strong>Fast payouts</strong> — earnings straight to wallet</div>
            </div>
            <div className="perk">
              <div className="perk-icon"><ShieldCheck size={15} color="#4ade80" /></div>
              <div className="perk-text"><strong>Fully insured</strong> — protected on every trip</div>
            </div>
          </div>
        </div>

        <div className="panel-right">
          <div className="form-box">
            <div className="form-eyebrow">Driver Portal</div>
            <h1 className="form-title">Welcome<br />back</h1>
            <p className="form-sub">Sign in to start accepting rides</p>

            <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
              <div className="field">
                <div className="field-label">Phone Number</div>
                <input
                  {...register('phone_number')}
                  placeholder="+234 801 234 5678"
                  className={`field-input no-icon${focused === 'phone' ? ' focused' : ''}${errors.phone_number ? ' has-error' : ''}`}
                  onFocus={() => setFocused('phone')}
                  onBlur={() => setFocused(null)}
                />
                {errors.phone_number && <div className="field-error">{errors.phone_number.message}</div>}
              </div>

              <div className="field">
                <div className="field-label">Password</div>
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
                {errors.password && <div className="field-error">{errors.password.message}</div>}
              </div>

              <button type="submit" className="submit-btn" disabled={mutation.isPending}>
                {mutation.isPending ? <><span className="spinner" />Signing in...</> : 'Sign In'}
              </button>
            </form>

            <div className="divider">
              <div className="divider-line" /><span className="divider-txt">or</span><div className="divider-line" />
            </div>

            <div className="footer-links">
              <p>No driver account? <Link to="/driver/register">Register as driver</Link></p>
              <p>Are you a student? <Link to="/login">Student login</Link></p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}