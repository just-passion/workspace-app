import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

const PALETTE = ['#4F6EF7', '#22D3A4', '#F5A623', '#A78BFA', '#F87171'];
const AVATAR_COLORS = [
  { bg: 'rgba(79,110,247,0.2)', border: 'rgba(79,110,247,0.35)', color: '#7B97FF' },
  { bg: 'rgba(167,139,250,0.2)', border: 'rgba(167,139,250,0.35)', color: '#A78BFA' },
  { bg: 'rgba(34,211,164,0.2)', border: 'rgba(34,211,164,0.35)', color: '#22D3A4' },
  { bg: 'rgba(245,166,35,0.2)', border: 'rgba(245,166,35,0.35)', color: '#F5A623' },
];

function ProjectCard({ project, index, onClick }) {
  const color = PALETTE[index % PALETTE.length];
  const members = project.members || [];

  const { data: statsData } = useQuery({
    queryKey: ['project-stats', project.id],
    queryFn: () => api.get(`/projects/${project.id}/stats`).then(r => r.data),
    staleTime: 60000,
  });
  const stats = statsData || { total: 0, done: 0, progress: 0 };

  return (
    <div onClick={onClick} className="project-card">
      <div className="project-accent-bar" style={{ background: `linear-gradient(90deg, ${color}, ${color}66)` }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px', marginTop: '6px' }}>
        <h3 style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-1)', letterSpacing: '-0.02em' }}>{project.name}</h3>
        <span className="badge" style={{ background: color + '1A', color, borderColor: color + '40' }}>
          {project.status}
        </span>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.5, marginBottom: '16px', minHeight: '20px' }}>
        {project.description || 'No description'}
      </p>

      {/* Progress bar */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-3)', marginBottom: '6px' }}>
          <span>Progress</span>
          <span style={{ color, fontWeight: 600 }}>{stats.progress}%</span>
        </div>
        <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${stats.progress}%`, background: color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Members + task count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex' }}>
          {members.slice(0, 4).map((m, i) => {
            const av = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const name = m.user?.name || m.userId || '?';
            return (
              <div key={m.id || i} className="avatar" style={{
                width: '26px', height: '26px', fontSize: '10px',
                background: av.bg, border: `2px solid ${av.border}`, color: av.color,
                marginRight: i < Math.min(members.length, 4) - 1 ? '-8px' : 0,
                zIndex: 10 - i, position: 'relative',
              }}>
                {name[0]?.toUpperCase()}
              </div>
            );
          })}
          {members.length > 4 && (
            <div className="avatar" style={{ width: '26px', height: '26px', fontSize: '9px', background: 'rgba(255,255,255,0.06)', border: '2px solid var(--border)', color: 'var(--text-3)', marginLeft: '-8px', zIndex: 6, position: 'relative' }}>
              +{members.length - 4}
            </div>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
          {stats.total} task{stats.total !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const workspaceId = useAuthStore((s) => s.workspaceId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const { data } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get('/projects').then(r => r.data),
  });
  const projects = data?.projects || [];

  const createMutation = useMutation({
    mutationFn: (d) => api.post('/projects', { ...d, workspaceId }),
    onSuccess: () => {
      qc.invalidateQueries(['projects']);
      qc.invalidateQueries(['workspace-projects', workspaceId]);
      setShowForm(false);
      setForm({ name: '', description: '' });
      toast.success('Project created!');
    },
    onError: () => toast.error('Failed to create project'),
  });

  return (
    <div className="page-scroll">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">{projects.length} project{projects.length !== 1 ? 's' : ''} in your workspace</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus size={14} /> New Project
        </button>
      </div>

      {showForm && (
        <div className="card animate-slide-up" style={{ padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)' }}>New Project</h2>
            <button onClick={() => setShowForm(false)} className="btn btn-ghost" style={{ padding: '4px' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label className="input-label">Project Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Website Redesign" className="input" autoFocus />
            </div>
            <div>
              <label className="input-label">Description</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What is this project about?" className="input" />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button onClick={() => form.name.trim() && createMutation.mutate(form)}
                disabled={!form.name.trim() || createMutation.isPending} className="btn btn-primary">
                {createMutation.isPending ? 'Creating…' : 'Create Project'}
              </button>
              <button onClick={() => setShowForm(false)} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
        {projects.length === 0 && !showForm ? (
          <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
            <p className="empty-state-text">No projects yet. Create your first one.</p>
            <button onClick={() => setShowForm(true)} className="btn btn-primary">+ New Project</button>
          </div>
        ) : projects.map((p, i) => (
          <ProjectCard key={p.id} project={p} index={i} onClick={() => navigate(`/project/${p.id}`)} />
        ))}
      </div>
    </div>
  );
}
