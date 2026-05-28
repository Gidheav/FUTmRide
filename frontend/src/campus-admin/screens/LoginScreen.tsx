import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Building2 } from 'lucide-react'
import api from '../../core/api'
import { useAuthStore } from '../../core/authStore'
import { useNavigate } from 'react-router-dom'

const schema = z.object({
  phone_number: z.string().min(7, 'Enter a valid phone number'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})
type FormData = z.infer<typeof schema>

const css = '' +
  '*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }' +
  'body { background: #0e1a2a; font-family: system-ui, -apple-system, sans-serif; }' +
  '.page { min-height: 100vh; background: radial-gradient(circle at 10% -10%, rgba(16,185,129,0.2), transparent 40%), #0e1a2a; display: flex; align-items: center; justify-content: center; padding: 24px; }' +
  '.card { background: rgba(255,255,255,0.95); border: 1px solid #dbe2ea; border-radius: 20px; padding: 40px; width: 100%; max-width: 420px; }' +
  '.card-top { text-align: center; margin-bottom: 28px; }' +
  '.admin-badge { width: 52px; height: 52px; background: #0f766e; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }' +
  '.card-title { font-family: ui-serif, Georgia, serif; font-size: 30px; color: #0f172a; letter-spacing: -0.7px; margin-bottom: 6px; }' +
  '.card-sub { font-size: 13px; color: #64748b; }' +
  '.field { margin-bottom: 16px; }' +
  '.field-label { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; display: block; }' +
  '.field-input { width: 100%; height: 48px; padding: 0 42px 0 14px; background: #f8fafc; border: 1.5px solid #dbe2ea; border-radius: 10px; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; color: #0f172a; outline: none; transition: border-color 0.15s; box-sizing: border-box; }' +
  '.field-input:focus { border-color: #0f766e; }' +
  '.field-input::placeholder { color: #94a3b8; }' +
  '.input-wrap { position: relative; }' +
  '.show-btn { position: absolute; right: 0; top: 0; height: 48px; width: 44px; display: flex; align-items: center; justify-content: center; background: none; border: none; cursor: pointer; color: #64748b; font-size: 11px; font-weight: 700; text-transform: uppercase; font-family: system-ui, -apple-system, sans-serif; transition: color 0.15s; }' +
  '.show-btn:hover { color: #0f766e; }' +
  '.field-error { color: #dc2626; font-size: 12px; margin-top: 5px; }' +
  '.submit-btn { width: 100%; height: 50px; background: #0f766e; border: none; border-radius: 10px; color: #fff; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 700; cursor: pointer; margin-top: 6px; transition: background 0.2s; }' +
  '.submit-btn:hover:not(:disabled) { background: #0b5e58; }' +
  '.submit-btn:disabled { background: #9ca3af; color: #e2e8f0; cursor: not-allowed; }' +
  '.spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; vertical-align: middle; margin-right: 8px; }' +
  '.alt { margin-top: 14px; text-align: center; font-size: 12px; color: #64748b; }' +
  '.alt a { color: #0f766e; text-decoration: none; font-weight: 600; }' +
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
      let phone = data.phone_number.trim()
      if (phone.startsWith('0') && phone.length === 11) phone = '+234' + phone.slice(1)
      const res = await api.post('/auth/login/', { ...data, phone_number: phone })
      return res.data
    },
    onSuccess: async (data) => {
      if (data.user.role !== 'campus_admin') {
        toast.error('Campus admin access only.')
        return
      }
      const userRes = await api.get('/users/me/', {
        headers: { Authorization: `Bearer ${data.access}` },
      })
      setAuth(userRes.data, data.access, data.refresh)
      navigate('/')
    },
    onError: (error: any) => {
      const apiError = error?.response?.data?.error
      const message = typeof apiError === 'string'
        ? apiError
        : apiError?.message || 'Invalid credentials.'
      toast.error(message)
    },
  })

  return (
    <>
      <style>{css}</style>
      <div className="page">
        <div className="card">
          <div className="card-top">
            <div className="admin-badge"><Building2 size={24} color="#fff" /></div>
            <h1 className="card-title">Campus Admin</h1>
            <p className="card-sub">Moderator console for campus operations</p>
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
            <p className="alt">Super admin? <a href="/admin/login">Use Super Admin Login</a></p>
          </form>
        </div>
      </div>
    </>
  )
}
