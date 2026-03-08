import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import toast from 'react-hot-toast';

const TEAM_SIZES = ['1–5', '6–25', '26–100', '100+'];

export default function CreateWorkspacePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const setWorkspaceId = useAuthStore((s) => s.setWorkspaceId);
  const [form, setForm] = useState({ name: '', description: '' });
  const [teamSize, setTeamSize] = useState('6–25');

  const createMutation = useMutation({
    mutationFn: () => api.post('/workspaces', { name: form.name, description: form.description }).then(r => r.data),
    onSuccess: (data) => {
      // Persist the new workspaceId
      useAuthStore.setState({ workspaceId: data.workspace.id });
      toast.success('Workspace created!');
      navigate('/workspace');
    },
    onError: () => toast.error('Failed to create workspace'),
  });

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ width: '460px' }}>
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '6px' }}>
            Create a Workspace
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>
            Your team's shared hub for projects and tasks
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="input-label">Workspace Name</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Acme Corp"
              className="input"
              autoFocus
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
            <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Team Size</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {TEAM_SIZES.map(size => (
                <button
                  key={size}
                  onClick={() => setTeamSize(size)}
                  style={{
                    padding: '9px',
                    background: teamSize === size ? 'var(--accent-dim)' : 'rgba(0,0,0,0.2)',
                    border: `1px solid ${teamSize === size ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius)',
                    textAlign: 'center',
                    fontSize: '13px',
                    color: teamSize === size ? 'var(--accent-light)' : 'var(--text-3)',
                    cursor: 'pointer',
                    fontWeight: teamSize === size ? 700 : 400,
                    fontFamily: 'Geist, sans-serif',
                    transition: 'all 0.15s',
                  }}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => form.name.trim() && createMutation.mutate()}
            disabled={!form.name.trim() || createMutation.isPending}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '11px', fontSize: '14px', marginTop: '4px' }}
          >
            {createMutation.isPending ? 'Creating…' : 'Create Workspace →'}
          </button>

          <button
            onClick={() => navigate('/workspace')}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
