import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (form.password !== form.confirm) return toast.error('Passwords do not match');
    setLoading(true);
    try {
      await register(form.name, form.email, form.password);
      toast.success('Account created!');
      navigate('/workspace');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  const Field = ({ label, name, type = 'text', placeholder }) => (
    <div>
      <label className="input-label">{label}</label>
      <input type={type} required value={form[name]}
        onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
        className="input" placeholder={placeholder} />
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div className="auth-logo">⚡</div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '6px' }}>Create account</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>Start collaborating with your team</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Full Name"        name="name"     placeholder="John Doe" />
          <Field label="Email"            name="email"    type="email"    placeholder="you@company.com" />
          <Field label="Password"         name="password" type="password" placeholder="••••••••" />
          <Field label="Confirm Password" name="confirm"  type="password" placeholder="••••••••" />
          <button type="submit" disabled={loading} className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px', marginTop: '4px', fontSize: '14px' }}>
            {loading ? 'Creating…' : 'Create Account →'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-3)', marginTop: '20px' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--accent-light)', textDecoration: 'none', fontWeight: 600 }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
