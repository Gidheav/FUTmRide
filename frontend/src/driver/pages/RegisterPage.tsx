import { Link } from 'react-router-dom'

export default function RegisterPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', background: '#f4f6f3' }}>
      <div style={{ textAlign: 'center', maxWidth: '400px', padding: '40px' }}>
        <div style={{ width: '48px', height: '48px', background: '#007A47', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '16px', margin: '0 auto 20px' }}>LR</div>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#0a0a0a', marginBottom: '10px' }}>Driver Registration</h1>
        <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '24px' }}>Driver registration is handled by our admin team. Please contact us to begin the onboarding process.</p>
        <Link to="/driver/login" style={{ display: 'inline-block', background: '#007A47', color: '#fff', padding: '12px 24px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>Back to Driver Login</Link>
      </div>
    </div>
  )
}