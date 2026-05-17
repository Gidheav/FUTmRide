import { useState, useEffect } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'

const studentEmailRegex = /^[A-Za-z]+\.[mM]\d+@st\.futminna\.edu\.ng$/

const schema = z
  .object({
    first_name: z.string().optional().or(z.literal('')),
    last_name: z.string().optional().or(z.literal('')),
    phone_number: z.string().optional().or(z.literal('')),
    email: z.string().optional().or(z.literal('')),
    role: z.enum(['student', 'driver']),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirm_password: z.string(),
    data_consent_given: z.boolean().optional(),
  })
  .refine(d => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })
  .superRefine((data, ctx) => {
    if (data.role === 'student') {
      if (!data.email) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'University email is required', path: ['email'] })
      } else if (!studentEmailRegex.test(data.email)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Use name.m1234567@st.futminna.edu.ng', path: ['email'] })
      }
    } else {
      if (!data.first_name) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'First name is required', path: ['first_name'] })
      }
      if (!data.last_name) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Last name is required', path: ['last_name'] })
      }
      if (!data.phone_number) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Phone number is required', path: ['phone_number'] })
      }
      if (!data.data_consent_given) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'You must accept to continue', path: ['data_consent_given'] })
      }
    }
  })

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuthStore()
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [focused, setFocused] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'driver') navigate('/driver', { replace: true })
      else if (user.role === 'admin') navigate('/admin', { replace: true })
      else if (user.role === 'campus_admin') navigate('/campus-admin', { replace: true })
      else navigate('/student', { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'student' },
  })

  const selectedRole = watch('role')

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      let phone = data.phone_number?.trim() || ''
      if (phone.startsWith('0') && phone.length === 11) phone = '+234' + phone.slice(1)
      const res = await api.post('/auth/register/', {
        ...data,
        phone_number: phone || undefined,
        email: data.role === 'student' ? data.email?.trim().toLowerCase() : data.email || undefined,
        data_consent_given: data.role === 'student' ? true : data.data_consent_given,
      })
      return { data: res.data, phone: data.phone_number }
    },
    onSuccess: ({ data, phone }) => {
      const msg = data.message || 'Account created. Please verify your phone.'
      toast.success(msg)
      navigate(`/verify`, { state: { phone } })
    },
    onError: (error: any) => {
      console.error('REGISTER ERROR FULL:', JSON.stringify(error?.response?.data, null, 2))
      const msg = error?.response?.data?.error?.message || 'Registration failed.'
      toast.error(msg)
    },
  })

  const fp = (name: string) => ({
    onFocus: () => setFocused(name),
    onBlur: () => setFocused(null),
  })

  const ic = (name: string, hasError: boolean) =>
    `field-input${focused === name ? ' focused' : ''}${hasError ? ' has-error' : ''}`

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-family: var(--font-sans);
        }

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
          width: 36px; height: 36px; background: #fff; border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 13px; color: #007A47; letter-spacing: -0.5px;
        }
        .logo-name { color: #fff; font-weight: 600; font-size: 17px; letter-spacing: -0.3px; }

        .left-mid {
          position: relative; z-index: 2;
          margin-top: auto; margin-bottom: auto; padding: 60px 0;
        }
        .tag {
          display: inline-flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18);
          border-radius: 100px; padding: 5px 12px 5px 8px; margin-bottom: 32px;
        }
        .tag-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #5ddf9e; box-shadow: 0 0 0 3px rgba(93,223,158,0.25);
          animation: blink 2s ease infinite;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .tag-text { color: rgba(255,255,255,0.9); font-size: 11px; font-weight: 500; letter-spacing: 1px; text-transform: uppercase; }
        .headline {
          font-family: var(--font-serif); font-size: 48px;
          line-height: 1.05; color: #fff; letter-spacing: -1.5px; margin-bottom: 24px;
        }
        .headline em { font-style: italic; color: rgba(255,255,255,0.65); }
        .subline { color: rgba(255,255,255,0.6); font-size: 15px; line-height: 1.7; max-width: 300px; }

        .steps {
          position: relative; z-index: 2;
          border-top: 1px solid rgba(255,255,255,0.12);
          padding-top: 28px; display: flex; flex-direction: column; gap: 16px;
        }
        .step { display: flex; align-items: flex-start; gap: 14px; }
        .step-num {
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 12px; font-weight: 600; flex-shrink: 0; margin-top: 1px;
        }
        .step-info-title { color: #fff; font-size: 13px; font-weight: 600; margin-bottom: 2px; }
        .step-info-desc { color: rgba(255,255,255,0.5); font-size: 12px; line-height: 1.5; }

        /* RIGHT */
        .panel-right {
          background: #fff; display: flex;
          align-items: flex-start; justify-content: center;
          padding: 52px; overflow-y: auto;
        }
        .form-box { width: 100%; max-width: 400px; padding: 8px 0; }
        .form-eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: #007A47; margin-bottom: 12px; }
        .form-title { font-family: var(--font-serif); font-size: 34px; color: #0a0a0a; letter-spacing: -1px; line-height: 1.1; margin-bottom: 6px; }
        .form-sub { font-size: 14px; color: #9ca3af; margin-bottom: 36px; }

        .role-toggle {
          display: grid; grid-template-columns: 1fr 1fr;
          background: #f3f4f6; border-radius: 12px; padding: 4px;
          margin-bottom: 28px; gap: 4px;
        }
        .role-btn {
          padding: 10px; border: none; border-radius: 9px; cursor: pointer;
          font-family: system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 600;
          transition: all 0.18s; background: transparent; color: #9ca3af;
        }
        .role-btn.active { background: #007A47; color: #fff; box-shadow: 0 2px 8px rgba(0,122,71,0.25); }

        .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .field { margin-bottom: 18px; }
        .field-label { font-size: 12px; font-weight: 600; color: #374151; letter-spacing: 0.4px; text-transform: uppercase; margin-bottom: 7px; }
        .input-wrap { position: relative; }
        .field-input {
          width: 100%; height: 48px; padding: 0 46px 0 14px;
          background: #fafafa; border: 1.5px solid #e8e8e8; border-radius: 10px;
          font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #0a0a0a;
          outline: none; transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }
        .field-input.no-icon { padding-right: 14px; }
        .field-input.focused { border-color: #007A47; background: #fff; box-shadow: 0 0 0 4px rgba(0,122,71,0.08); }
        .field-input.has-error { border-color: #ef4444; background: #fff9f9; }
        .field-input::placeholder { color: #c4c4c4; }
        .show-btn {
          position: absolute; right: 0; top: 0; height: 48px; width: 46px;
          display: flex; align-items: center; justify-content: center;
          background: none; border: none; cursor: pointer; color: #9ca3af;
          font-size: 11px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;
          font-family: system-ui, -apple-system, sans-serif; transition: color 0.15s;
        }
        .show-btn:hover { color: #007A47; }
        .field-error { color: #ef4444; font-size: 12px; margin-top: 5px; }

        .consent {
          display: flex; align-items: flex-start; gap: 10px;
          margin: 20px 0 8px; padding: 14px; background: #f0fdf6;
          border: 1px solid #bbf7d0; border-radius: 10px;
        }
        .consent input[type=checkbox] {
          width: 16px; height: 16px; accent-color: #007A47; cursor: pointer; flex-shrink: 0; margin-top: 1px;
        }
        .consent-text { font-size: 12.5px; color: #374151; line-height: 1.6; }
        .consent-error { color: #ef4444; font-size: 12px; margin-top: 6px; }

        .submit-btn {
          width: 100%; height: 50px; background: #007A47; border: none; border-radius: 10px;
          color: #fff; font-family: system-ui, -apple-system, sans-serif; font-size: 15px; font-weight: 600;
          cursor: pointer; margin-top: 16px;
          transition: background 0.2s, transform 0.1s, box-shadow 0.2s;
          box-shadow: 0 4px 20px rgba(0,122,71,0.3);
        }
        .submit-btn:hover:not(:disabled) { background: #006339; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,122,71,0.38); }
        .submit-btn:active:not(:disabled) { transform: translateY(0); }
        .submit-btn:disabled { background: #a7d9c0; box-shadow: none; cursor: not-allowed; }

        .spinner { display: inline-block; width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 8px; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .footer { text-align: center; margin-top: 24px; font-size: 13.5px; color: #9ca3af; }
        .footer a { color: #007A47; font-weight: 600; text-decoration: none; }
        .footer a:hover { text-decoration: underline; }

        @media (max-width: 820px) {
          .page { grid-template-columns: 1fr; }
          .panel-left { display: none; }
          .panel-right { padding: 36px 24px; }
          .row-2 { grid-template-columns: 1fr; }
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
            <div className="tag"><span className="tag-dot" /><span className="tag-text">Join today</span></div>
            <h2 className="headline">Start your<br /><em>journey here.</em></h2>
            <p className="subline">Create your account and get your first ride in under 2 minutes.</p>
          </div>
          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <div>
                <div className="step-info-title">Create your account</div>
                <div className="step-info-desc">Enter your details and verify your phone number</div>
              </div>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <div>
                <div className="step-info-title">Book your first ride</div>
                <div className="step-info-desc">Set pickup and drop-off, confirm your fare</div>
              </div>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <div>
                <div className="step-info-title">Track in real time</div>
                <div className="step-info-desc">Watch your driver arrive live on the map</div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel-right">
          <div className="form-box">
            <div className="form-eyebrow">Get started</div>
            <h1 className="form-title">Create your<br />account</h1>
            <p className="form-sub">Takes less than 2 minutes</p>

            <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>


              <div className="role-toggle">
                <button type="button" className={`role-btn${selectedRole === 'student' ? ' active' : ''}`} onClick={() => setValue('role', 'student')}>I am a Student</button>
                <button type="button" className={`role-btn${selectedRole === 'driver' ? ' active' : ''}`} onClick={() => setValue('role', 'driver')}>I am a Driver</button>
              </div>

              {selectedRole === 'driver' && (
                <>
                  <div className="row-2">
                    <div className="field">
                      <div className="field-label">First Name</div>
                      <input {...register('first_name')} placeholder="Aisha" className={ic('fname', !!errors.first_name) + ' no-icon'} {...fp('fname')} />
                      {errors.first_name && <div className="field-error">{errors.first_name.message}</div>}
                    </div>
                    <div className="field">
                      <div className="field-label">Last Name</div>
                      <input {...register('last_name')} placeholder="Bello" className={ic('lname', !!errors.last_name) + ' no-icon'} {...fp('lname')} />
                      {errors.last_name && <div className="field-error">{errors.last_name.message}</div>}
                    </div>
                  </div>

                  <div className="field">
                    <div className="field-label">Phone Number</div>
                    <input {...register('phone_number')} placeholder="09031234567 or +2349031234567" className={ic('phone', !!errors.phone_number) + ' no-icon'} {...fp('phone')} />
                    {errors.phone_number && <div className="field-error">{errors.phone_number.message}</div>}
                  </div>
                </>
              )}

              <div className="field">
                <div className="field-label">
                  University Email
                  {selectedRole !== 'student' && (
                    <span style={{ color: '#c4c4c4', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                      {' '}(optional)
                    </span>
                  )}
                </div>
                <input
                  {...register('email')}
                  placeholder="adeniran.m2302417@st.futminna.edu.ng"
                  className={ic('email', !!errors.email) + ' no-icon'}
                  {...fp('email')}
                />
                {errors.email && <div className="field-error">{errors.email.message}</div>}
              </div>

              <div className="field">
                <div className="field-label">Password</div>
                <div className="input-wrap">
                  <input {...register('password')} type={showPass ? 'text' : 'password'} placeholder="Min. 8 characters" className={ic('pass', !!errors.password)} {...fp('pass')} />
                  <button type="button" className="show-btn" onClick={() => setShowPass(!showPass)}>{showPass ? 'hide' : 'show'}</button>
                </div>
                {errors.password && <div className="field-error">{errors.password.message}</div>}
              </div>

              <div className="field">
                <div className="field-label">Confirm Password</div>
                <div className="input-wrap">
                  <input {...register('confirm_password')} type={showConfirm ? 'text' : 'password'} placeholder="Repeat password" className={ic('confirm', !!errors.confirm_password)} {...fp('confirm')} />
                  <button type="button" className="show-btn" onClick={() => setShowConfirm(!showConfirm)}>{showConfirm ? 'hide' : 'show'}</button>
                </div>
                {errors.confirm_password && <div className="field-error">{errors.confirm_password.message}</div>}
              </div>

              {selectedRole === 'driver' && (
                <>
                  <div className="consent">
                    <input type="checkbox" id="consent" {...register('data_consent_given')} />
                    <label htmlFor="consent" className="consent-text">
                      I agree to the processing of my personal data for ride services in accordance with applicable data protection regulations.
                    </label>
                  </div>
                  {errors.data_consent_given && <div className="consent-error">{errors.data_consent_given.message}</div>}
                </>
              )}

              <button type="submit" className="submit-btn" disabled={mutation.isPending}>
                {mutation.isPending ? <><span className="spinner" />Creating account...</> : 'Create Account'}
              </button>

            </form>

            <div className="footer" style={{marginTop:'24px'}}>
              Already have an account? <Link to="/login">Sign in</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}