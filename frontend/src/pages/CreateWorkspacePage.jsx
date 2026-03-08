import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import toast from 'react-hot-toast';

const TEAM_SIZES = ['1–5', '6–25', '26–100', '100+'];

export default function CreateWorkspacePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [form, setForm] = useState({ name: '', description: '' });
  const [teamSize, setTeamSize] = useState('6–25');
  const [loading, setLoading] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Workspace name is required');
    setLoading(true);
    try {
      const { data } = await api.post('/workspaces', {
        name: form.name.trim(),
        description: form.description,
      });
      // Persist workspaceId directly into the Zustand store + localStorage
      useAuthStore.setState({ workspaceId: data.workspace.id });
      toast.success('Workspace created!');
      navigate('/workspace');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ width: '460px' }}>

        <div style={{ marginBottom: '28px' }}>
          <div style={{ fontSize: '28px', textAlign: 'center', marginBottom: '10px' }}>⚡</div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '6px', textAlign: 'center' }}>
            Create a Workspace
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)', textAlign: 'center' }}>
            Your team's shared hub for projects and tasks
          </p>
        </div>

        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="input-label">Workspace Name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder={user?.name ? `${user.name}'s Workspace` : 'e.g. Acme Corp'}
              className="input"
              autoFocus
              required
            />
          </div>

          <div>
            <label className="input-label">Description</label>
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What's this workspace for?"
              className="input"
            />
          </div>

          <div>
            <label className="input-label" style={{ display: 'block', marginBottom: '8px' }}>Team Size</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {TEAM_SIZES.map(size => (
                <button key={size} type="button" onClick={() => setTeamSize(size)}
                  style={{
                    padding: '9px', cursor: 'pointer', textAlign: 'center', fontSize: '13px',
                    borderRadius: 'var(--radius)', fontFamily: 'Geist, sans-serif',
                    transition: 'all 0.15s',
                    background: teamSize === size ? 'rgba(79,110,247,0.15)' : 'rgba(0,0,0,0.2)',
                    border: `1px solid ${teamSize === size ? 'var(--accent)' : 'var(--border)'}`,
                    color: teamSize === size ? 'var(--accent-light)' : 'var(--text-3)',
                    fontWeight: teamSize === size ? 700 : 400,
                  }}>
                  {size}
                </button>
              ))}
            </div>
          </div>

          <button type="submit" disabled={loading || !form.name.trim()} className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '14px', marginTop: '4px' }}>
            {loading ? 'Creating…' : 'Create Workspace →'}
          </button>
        </form>
      </div>
    </div>
  );
}
