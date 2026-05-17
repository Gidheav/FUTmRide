import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'

const studentEmailRegex = /^[A-Za-z]+\.[mM]\d+@st\.futminna\.edu\.ng$/

const schema = z.object({
  email: z
    .string()
    .min(1, 'University email is required')
    .regex(studentEmailRegex, 'Use name.m1234567@st.futminna.edu.ng'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth, isAuthenticated, user } = useAuthStore()

  useEffect(() => {
    if (isAuthenticated && user) {
      if (user.role === 'driver') navigate('/driver', { replace: true })
      else if (user.role === 'admin') navigate('/admin', { replace: true })
      else if (user.role === 'campus_admin') navigate('/campus-admin', { replace: true })
      else navigate('/student', { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const email = data.email.trim().toLowerCase()
      const res = await api.post('/auth/login/', { email, password: data.password })
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
      else if (role === 'campus_admin') navigate('/campus-admin')
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
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap');

        * { box-sizing: border-box; }

        .replica-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: #f9f9f9;
          color: #1a1c1c;
          font-family: var(--font-sans);
        }

        .replica-hero {
          display: none;
          position: relative;
          overflow: hidden;
          background: #e8e8e8;
        }

        .replica-hero img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .replica-hero-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0, 33, 12, 0.8), transparent 55%);
        }

        .replica-hero-copy {
          position: absolute;
          left: 32px;
          right: 32px;
          bottom: 32px;
          color: #ffffff;
          z-index: 2;
        }

        .replica-hero-copy h1 {
          margin: 0 0 8px;
          font-family: var(--font-sans);
          font-weight: 800;
          font-size: 32px;
          line-height: 40px;
          letter-spacing: -0.02em;
        }

        .replica-hero-copy p {
          margin: 0;
          max-width: 520px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 18px;
          line-height: 28px;
        }

        .replica-right {
          width: 100%;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: #f9f9f9;
        }

        .replica-card {
          width: 100%;
          max-width: 420px;
          background: #ffffff;
          border-radius: 12px;
          padding: 24px 32px;
          display: flex;
          flex-direction: column;
          gap: 32px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.06);
        }

        .replica-head {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .replica-brand {
          margin: 0;
          color: #0fa958;
          font-family: var(--font-sans);
          font-weight: 800;
          font-size: 32px;
          line-height: 40px;
          letter-spacing: -0.02em;
        }

        .replica-title {
          margin: 12px 0 0;
          color: #1a1c1c;
          font-family: var(--font-sans);
          font-weight: 700;
          font-size: 24px;
          line-height: 32px;
          letter-spacing: -0.01em;
        }

        .replica-sub {
          margin: 0;
          color: #5e5e5e;
          font-size: 16px;
          line-height: 24px;
        }

        .replica-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .replica-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .replica-label {
          color: #3d4a3e;
          font-size: 14px;
          line-height: 16px;
          letter-spacing: 0.01em;
          font-weight: 600;
        }

        .replica-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .replica-forgot {
          color: #0fa958;
          font-size: 12px;
          line-height: 14px;
          font-weight: 600;
          text-decoration: none;
          letter-spacing: 0.02em;
        }

        .replica-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .replica-input-icon {
          position: absolute;
          left: 12px;
          font-family: 'Material Symbols Outlined';
          font-size: 20px;
          color: #5e5e5e;
          pointer-events: none;
          line-height: 1;
        }

        .replica-input {
          width: 100%;
          background: #f3f3f3;
          color: #1a1c1c;
          border-radius: 8px;
          border: none;
          outline: none;
          padding: 12px 12px 12px 40px;
          font-size: 16px;
          line-height: 24px;
          font-family: var(--font-sans);
          transition: box-shadow 0.15s ease;
        }

        .replica-input::placeholder {
          color: #939393;
        }

        .replica-input:focus {
          box-shadow: 0 0 0 2px #0fa958;
        }

        .replica-error {
          color: #ba1a1a;
          font-size: 12px;
          line-height: 14px;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        .replica-submit {
          width: 100%;
          margin-top: 8px;
          background: #0fa958;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 12px;
          cursor: pointer;
          font-size: 14px;
          line-height: 16px;
          font-weight: 600;
          letter-spacing: 0.01em;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
          box-shadow: 0 4px 14px rgba(15, 169, 88, 0.2);
        }

        .replica-submit:hover:not(:disabled) {
          background: #006d36;
        }

        .replica-submit:active:not(:disabled) {
          transform: scale(0.98);
        }

        .replica-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .replica-submit-icon {
          font-family: 'Material Symbols Outlined';
          font-size: 18px;
          line-height: 1;
        }

        .replica-info {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 8px;
          border: 1px solid #e8e8e8;
        }

        .replica-info-icon {
          font-family: 'Material Symbols Outlined';
          font-size: 20px;
          color: #0fa958;
          font-variation-settings: 'FILL' 1;
          line-height: 1;
          margin-top: 1px;
          flex: 0 0 auto;
        }

        .replica-info p {
          margin: 0;
          color: #5e5e5e;
          font-size: 14px;
          line-height: 20px;
        }

        .replica-foot {
          padding-top: 8px;
          border-top: 1px solid #e8e8e8;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .replica-foot p {
          margin: 0;
          text-align: center;
          color: #5e5e5e;
          font-size: 16px;
          line-height: 24px;
        }

        .replica-create {
          width: 100%;
          background: #f3f3f3;
          color: #1a1c1c;
          text-decoration: none;
          border-radius: 8px;
          padding: 12px;
          font-size: 14px;
          line-height: 16px;
          font-weight: 600;
          letter-spacing: 0.01em;
          text-align: center;
          transition: background-color 0.2s ease;
        }

        .replica-create:hover {
          background: #e8e8e8;
        }

        @media (min-width: 768px) {
          .replica-page {
            flex-direction: row;
          }

          .replica-hero {
            display: flex;
            width: 50%;
          }

          .replica-right {
            width: 50%;
          }
        }

        @media (min-width: 1024px) {
          .replica-hero {
            width: 58.333333%;
          }

          .replica-right {
            width: 41.666667%;
          }
        }
      `}</style>

      <div className="replica-page">
        <div className="replica-hero">
          <img
            alt="Campus transit"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBWYnkvBpkrfo8o23O39L1f2NkNgu3dcDKurLlR1i0kfZw02alyBYIBGeFPX0MooKLXcybx09JUz9Z1VStkp15m_K9ZeujTtyaWgFuRjFSqB0hSZNyLy5X2C5PUIRJkL9cw1OfhWFiHR7fb_kjK4Ve_kbg8tmO_13jxLpXRuWpC8R2is1aJmkspagAUcMEwhF8UxmIOdhMPjgYcOL8OCpjSiPBcVjkgNBc09JHa0oyB1khTKwocExKsqv_vIut7ymqdOJduGy1Barc"
          />
          <div className="replica-hero-gradient" />
          <div className="replica-hero-copy">
            <h1>Safe transit, <br />simplified for students.</h1>
            <p>Join thousands of students using CampusRide for secure, reliable campus transportation.</p>
          </div>
        </div>

        <div className="replica-right">
          <div className="replica-card">
            <div className="replica-head">
              <h2 className="replica-brand">CampusRide</h2>
              <h3 className="replica-title">Welcome back</h3>
              <p className="replica-sub">Log in with your university credentials to continue.</p>
            </div>

            <form className="replica-form" onSubmit={handleSubmit((data) => mutation.mutate(data))}>
              <div className="replica-field">
                <label className="replica-label" htmlFor="email">University Email</label>
                <div className="replica-input-wrap">
                  <span className="replica-input-icon">mail</span>
                  <input
                    id="email"
                    type="email"
                    placeholder="adeniran.m2302417@st.futminna.edu.ng"
                    className="replica-input"
                    {...register('email')}
                  />
                </div>
                {errors.email && <div className="replica-error">{errors.email.message}</div>}
              </div>

              <div className="replica-field">
                <div className="replica-label-row">
                  <label className="replica-label" htmlFor="password">Password</label>
                  <Link className="replica-forgot" to="/password-reset">Forgot?</Link>
                </div>
                <div className="replica-input-wrap">
                  <span className="replica-input-icon">lock</span>
                  <input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="replica-input"
                    {...register('password')}
                  />
                </div>
                {errors.password && <div className="replica-error">{errors.password.message}</div>}
              </div>

              <button className="replica-submit" type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Signing in...' : 'Login Securely'}
                <span className="replica-submit-icon">arrow_forward</span>
              </button>
            </form>

            <div className="replica-info">
              <span className="replica-info-icon">verified_user</span>
              <p>Student ID verification is required for all new riders to ensure campus safety and exclusive access.</p>
            </div>

            <div className="replica-foot">
              <p>New to CampusRide?</p>
              <Link className="replica-create" to="/register">Create Account</Link>
              <p>Are you a driver? <Link className="replica-forgot" to="/driver/login">Driver login</Link></p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
