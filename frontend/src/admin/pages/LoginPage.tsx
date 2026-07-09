import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ShieldCheck } from 'lucide-react'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'
import { clearTokens } from '../../core/tokenStorage'
import { useNavigate } from 'react-router-dom'

const schema = z.object({
  phone_number: z.string().min(7, 'Enter a valid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormData = z.infer<typeof schema>

const css = '' +
  '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
  'body { background: #0a0a0a; font-family: system-ui, -apple-system, sans-serif; }' +
  '.page { min-height: 100vh; background: #0a0a0a; display: flex; align-items: center; justify-content: center; padding: 24px; }' +
  '.card { background: #141414; border: 1px solid #222; border-radius: 2px; padding: 48px 40px; width: 100%; max-width: 430px; }' +
  '.card-top { text-align: center; margin-bottom: 36px; }' +
  '.admin-badge { width: 52px; height: 52px; background: #007A47; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }' +
  '.card-title { font-family: ui-serif, Georgia, serif; font-size: 28px; color: #fff; letter-spacing: -0.8px; margin-bottom: 6px; }' +
  '.card-sub { font-size: 13px; color: #555; }' +  '.card-sub-2 { font-size: 13px; color: #555; }' +
  '.field { margin-bottom: 18px; }' +
  '.field-label { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #555; margin-bottom: 8px; display: block; }' +
  '.field-input { width: 100%; height: 48px; padding: 0 42px 0 14px; background: #1a1a1a; border: 1.5px solid #2a2a2a; border-radius: 10px; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #fff; outline: none; transition: border-color 0.15s; box-sizing: border-box; }' +
  '.field-input:focus { border-color: #007A47; }' +
  '.field-input::placeholder { color: #444; }' +
  '.input-wrap { position: relative; }' +
  '.show-btn { position: absolute; right: 0; top: 0; height: 48px; width: 44px; display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; color: #444; font-size: 11px; font-weight: 700; text-transform: uppercase; font-family: system-ui, -apple-system, sans-serif; transition: color 0.15s; }' +
  '.show-btn:hover { color: #007A47; }' +
  '.field-error { color: #ef4444; font-size: 12px; margin-top: 5px; }' +
  '.submit-btn { width: 100%; height: 50px; background: #007A47; border: none; border-radius: 10px; color: #fff; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; margin-top: 8px; transition: background 0.2s; }' +
  '.submit-btn:hover:not(:disabled) { background: #006339; }' +
  '.submit-btn:disabled { background: #1a3d2b; color: #2d6b4a; cursor: not-allowed; }' +
  '.spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 8px; }' +
  '@keyframes spin { to { transform: rotate(360deg); } }'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      clearTokens()
      const res = await api.post('/auth/login/', data)
      return res.data
    },
    onSuccess: async (data) => {
      if (data.user.role !== 'admin') {
        toast.error('Super admin access only.')
        return
      }
      setAuth(data.user, data.access, data.refresh)
      navigate('/admin')
      api.get('/users/me/', {
        headers: { Authorization: `Bearer ${data.access}` },
      }).then((userRes) => {
        setAuth(userRes.data, data.access, data.refresh)
      }).catch(() => {
        // The login payload is enough to enter the app; profile refresh can retry later.
      })
    },
    onError: (error: any) => {
      console.error('[Login Error]', error?.message, error?.response?.status, error?.response?.data)
      const body = error?.response?.data
      const apiError = body?.error
      const message = typeof apiError === 'string'
        ? apiError
        : apiError?.message || body?.detail || body?.message || null
      if (message) {
        toast.error(message)
      } else if (!error?.response) {
        const code = String(error?.code || '').toUpperCase()
        const rawMessage = String(error?.message || '')
        const timeoutLike = code === 'ECONNABORTED' || rawMessage.toLowerCase().includes('timeout')
        toast.error(
          timeoutLike
            ? 'The connection is taking too long. Please check your internet connection and try again.'
            : 'Unable to connect right now. Please check your internet connection and try again.',
          { duration: 8000 },
        )
      } else {
        toast.error('We could not sign you in right now. Please try again shortly.')
      }
    },
  })

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <div className="card">
          <div className="card-top">
            <div className="admin-badge"><ShieldCheck size={24} color="#fff" /></div>
            <h1 className="card-title">Super Admin Portal</h1>
            <p className="card-sub">Global management console</p>
            <p className="card-sub">Restricted Portal</p>
          </div>
          <form onSubmit={handleSubmit(d => mutation.mutate(d))}>
            <div className="field">
              <label className="field-label">Phone Number</label>
              <input {...register('phone_number')} placeholder="+234 801 234 5678" className="field-input" style={{ paddingRight: '14px' }} />
              {errors.phone_number && <div className="field-error">{errors.phone_number.message}</div>}
            </div>
            <div className="field">
              <label className="field-label">Password</label>
              <div className="input-wrap">
                <input {...register('password')} type={showPassword ? 'text' : 'password'} placeholder="Enter password" className="field-input" />
                <button type="button" className="show-btn" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'hide' : 'show'}</button>
              </div>
              {errors.password && <div className="field-error">{errors.password.message}</div>}
            </div>
            <button type="submit" className="submit-btn" disabled={mutation.isPending}>
              {mutation.isPending ? <><span className="spinner" />Signing in...</> : 'Sign In'}
            </button>
            <p style={{ marginTop: '14px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
              Campus moderator? <a href="/login" style={{ color: '#007A47', textDecoration: 'none', fontWeight: 600 }}>Use Campus Admin Login</a>
            </p>
          </form>
        </div>
      </div>
    </>
  )
}
