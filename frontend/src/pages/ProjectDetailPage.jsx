import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../services/api';
import { getSocket } from '../hooks/useSocket';
import { Plus, ArrowLeft, UserPlus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const COLUMNS = ['backlog', 'todo', 'in_progress', 'done'];
const COL_LABELS = { backlog: 'Backlog', todo: 'To Do', in_progress: 'In Progress', done: 'Done' };
const COL_COLORS = { backlog: '#4A5578', todo: '#F5A623', in_progress: '#4F6EF7', done: '#22D3A4' };
const PRIO_COLORS = { high: '#F87171', medium: '#F5A623', low: '#22D3A4' };
const AVATAR_COLORS = [
  { bg: 'rgba(79,110,247,0.2)', border: 'rgba(79,110,247,0.35)', color: '#7B97FF' },
  { bg: 'rgba(167,139,250,0.2)', border: 'rgba(167,139,250,0.35)', color: '#A78BFA' },
  { bg: 'rgba(34,211,164,0.2)', border: 'rgba(34,211,164,0.35)', color: '#22D3A4' },
  { bg: 'rgba(245,166,35,0.2)', border: 'rgba(245,166,35,0.35)', color: '#F5A623' },
];
const TABS = ['Board', 'Members', 'Settings'];

function TaskCard({ task, isDragging, onClick }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: task._id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}
      onClick={(e) => { e.stopPropagation(); onClick && onClick(task); }}
      className="task-card">
      <p className="task-card-title">{task.title}</p>
      {task.description && (
        <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '10px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {task.description}
        </p>
      )}
      <div className="task-card-footer">
        <span className="badge" style={{ background: PRIO_COLORS[task.priority] + '1A', color: PRIO_COLORS[task.priority], borderColor: PRIO_COLORS[task.priority] + '40', borderRadius: '4px', fontSize: '10px' }}>
          {task.priority}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {task.dueDate && (
            <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>
              {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
            </span>
          )}
          {task.assigneeId && (
            <div className="avatar avatar-sm" style={{ background: 'rgba(79,110,247,0.2)', border: '1px solid rgba(79,110,247,0.35)', color: '#7B97FF' }}>
              {task.assigneeId?.[0]?.toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div style={{ marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-3)', marginBottom: '5px' }}>
        <span>{label}</span><span style={{ color, fontWeight: 600 }}>{value}</span>
      </div>
      <div style={{ height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

export default function ProjectDetailPage() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [activeTask, setActiveTask] = useState(null);
  const [showNewTask, setShowNewTask] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [activeTab, setActiveTab] = useState('Board');
  const [inviteEmail, setInviteEmail] = useState('');

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const { data: tasksData } = useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.get(`/projects/${projectId}/tasks`).then(r => r.data),
  });

  const { data: projectData } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.get(`/projects/${projectId}`).then(r => r.data),
  });

  const { data: statsData } = useQuery({
    queryKey: ['project-stats', projectId],
    queryFn: () => api.get(`/projects/${projectId}/stats`).then(r => r.data),
    refetchInterval: 30000,
  });

  const tasks = tasksData?.tasks || [];
  const project = projectData?.project;
  const members = project?.members || [];
  const stats = statsData || { total: 0, done: 0, inProgress: 0, remaining: 0, progress: 0 };

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col] = tasks.filter(t => t.status === col);
    return acc;
  }, {});

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('join_project', projectId);
    socket.on('task_created', () => qc.invalidateQueries(['tasks', projectId]));
    socket.on('task_updated', () => qc.invalidateQueries(['tasks', projectId]));
    socket.on('task_moved',   () => qc.invalidateQueries(['tasks', projectId]));
    return () => { socket.off('task_created'); socket.off('task_updated'); socket.off('task_moved'); };
  }, [projectId, qc]);

  const moveMutation = useMutation({
    mutationFn: ({ taskId, status }) => api.patch(`/tasks/${taskId}/status`, { status }),
    onSuccess: () => qc.invalidateQueries(['tasks', projectId]),
  });

  const createMutation = useMutation({
    mutationFn: ({ title, status }) => api.post('/tasks', { title, status, projectId }),
    onSuccess: () => {
      qc.invalidateQueries(['tasks', projectId]);
      qc.invalidateQueries(['project-stats', projectId]);
      setNewTitle('');
      setShowNewTask(null);
    },
    onError: () => toast.error('Failed to create task'),
  });

  const deleteMutation = useMutation({
    mutationFn: (taskId) => api.delete(`/tasks/${taskId}`),
    onSuccess: () => { qc.invalidateQueries(['tasks', projectId]); toast.success('Task deleted'); },
  });

  const updateProjectMutation = useMutation({
    mutationFn: (body) => api.put(`/projects/${projectId}`, body),
    onSuccess: () => { qc.invalidateQueries(['project', projectId]); toast.success('Project updated'); },
  });

  function handleDragStart({ active }) {
    setActiveTask(tasks.find(t => t._id === active.id));
  }

  function handleDragEnd({ active, over }) {
    setActiveTask(null);
    if (!over) return;
    const newStatus = over.id;
    const task = tasks.find(t => t._id === active.id);
    if (task && COLUMNS.includes(newStatus) && task.status !== newStatus) {
      moveMutation.mutate({ taskId: task._id, status: newStatus });
    }
  }

  // ── Board Tab ──────────────────────────────────────────────────────────
  const BoardTab = (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '18px' }}>
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="kanban-board">
          {COLUMNS.map(col => (
            <div key={col} id={col} className="kanban-column" style={{ borderTop: `2px solid ${COL_COLORS[col]}` }}>
              <div className="kanban-column-header">
                <span className="kanban-column-title" style={{ color: COL_COLORS[col] }}>{COL_LABELS[col]}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="kanban-column-count">{grouped[col]?.length}</span>
                  <button onClick={() => setShowNewTask(col)} className="btn btn-ghost" style={{ padding: '2px', color: 'var(--text-3)' }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>
              <div className="kanban-column-body">
                <SortableContext items={grouped[col]?.map(t => t._id) || []} strategy={verticalListSortingStrategy}>
                  {grouped[col]?.map(task => (
                    <TaskCard key={task._id} task={task} isDragging={activeTask?._id === task._id}
                      onClick={() => navigate(`/task/${task._id}`)} />
                  ))}
                </SortableContext>
                {showNewTask === col && (
                  <div className="inline-task-form">
                    <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newTitle.trim()) createMutation.mutate({ title: newTitle.trim(), status: col });
                        if (e.key === 'Escape') setShowNewTask(null);
                      }}
                      style={{ width: '100%', background: 'transparent', color: 'var(--text-1)', fontSize: '13px', border: 'none', outline: 'none', fontFamily: 'Geist, sans-serif' }}
                      placeholder="Task name… (Enter to save)" />
                  </div>
                )}
                <button onClick={() => setShowNewTask(col)} className="task-add-btn">+ Add task</button>
              </div>
            </div>
          ))}
        </div>
        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} />}
        </DragOverlay>
      </DndContext>

      {/* Right sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Members */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>Members</h3>
            <button onClick={() => setActiveTab('Members')} className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: '12px' }}>
              <UserPlus size={13} />
            </button>
          </div>
          {members.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-3)' }}>No members yet</p>
          ) : members.map((m, i) => {
            const av = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const name = m.user?.name || m.userId || '?';
            return (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: i < members.length - 1 ? '10px' : 0 }}>
                <div className="avatar" style={{ width: '26px', height: '26px', fontSize: '10px', background: av.bg, border: `2px solid ${av.border}`, color: av.color }}>
                  {name[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-1)', flex: 1 }}>{name}</span>
                <span className="badge" style={{ background: 'rgba(107,114,128,0.12)', color: 'var(--text-3)', borderColor: 'rgba(107,114,128,0.2)', fontSize: '10px', textTransform: 'capitalize' }}>
                  {m.role}
                </span>
              </div>
            );
          })}
        </div>

        {/* Progress */}
        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '14px' }}>Progress</h3>
          <ProgressBar label="Completed" value={stats.done}       total={stats.total} color="#22D3A4" />
          <ProgressBar label="In Progress" value={stats.inProgress} total={stats.total} color="#4F6EF7" />
          <ProgressBar label="Remaining"  value={stats.remaining}  total={stats.total} color="#4A5578" />
          <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius)', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 800, color: '#22D3A4' }}>{stats.progress}%</div>
            <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>Overall Progress</div>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Members Tab ────────────────────────────────────────────────────────
  const MembersTab = (
    <div style={{ maxWidth: '560px' }}>
      <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '16px' }}>Invite Member</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder="User ID or email…" className="input" style={{ flex: 1 }} />
          <button className="btn btn-primary" disabled={!inviteEmail.trim()}
            onClick={() => {
              api.post(`/projects/${projectId}/members`, { userId: inviteEmail })
                .then(() => { qc.invalidateQueries(['project', projectId]); setInviteEmail(''); toast.success('Member invited!'); })
                .catch(() => toast.error('Failed to invite member'));
            }}>
            <UserPlus size={14} /> Invite
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '16px' }}>
          Team ({members.length})
        </h3>
        {members.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>No members yet</p>
        ) : members.map((m, i) => {
          const av = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const name = m.user?.name || m.userId || '?';
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="avatar" style={{ width: '34px', height: '34px', fontSize: '13px', background: av.bg, border: `2px solid ${av.border}`, color: av.color }}>
                {name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)' }}>{name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{m.user?.email || ''}</div>
              </div>
              <span className="badge" style={{ background: 'rgba(107,114,128,0.12)', color: 'var(--text-3)', borderColor: 'rgba(107,114,128,0.2)', textTransform: 'capitalize' }}>
                {m.role}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Settings Tab ───────────────────────────────────────────────────────
  const [settingsForm, setSettingsForm] = useState({ name: project?.name || '', description: project?.description || '', status: project?.status || 'active' });
  useEffect(() => {
    if (project) setSettingsForm({ name: project.name || '', description: project.description || '', status: project.status || 'active' });
  }, [project]);

  const SettingsTab = (
    <div style={{ maxWidth: '480px' }}>
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '20px' }}>Project Settings</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label className="input-label">Project Name</label>
            <input value={settingsForm.name} onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="input-label">Description</label>
            <textarea value={settingsForm.description} onChange={e => setSettingsForm(f => ({ ...f, description: e.target.value }))}
              className="input" rows={3} style={{ resize: 'vertical', fontFamily: 'Geist, sans-serif' }} />
          </div>
          <div>
            <label className="input-label">Status</label>
            <select value={settingsForm.status} onChange={e => setSettingsForm(f => ({ ...f, status: e.target.value }))}
              className="input" style={{ cursor: 'pointer' }}>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }}
            onClick={() => updateProjectMutation.mutate(settingsForm)}
            disabled={updateProjectMutation.isPending}>
            {updateProjectMutation.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '24px', marginTop: '14px', borderColor: 'rgba(248,113,113,0.2)' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#F87171', marginBottom: '8px' }}>Danger Zone</h3>
        <p style={{ fontSize: '13px', color: 'var(--text-3)', marginBottom: '14px' }}>Deleting a project is permanent and cannot be undone.</p>
        <button className="btn" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171', gap: '6px' }}
          onClick={() => {
            if (window.confirm('Delete this project? This cannot be undone.')) {
              api.delete(`/projects/${projectId}`)
                .then(() => { toast.success('Project deleted'); navigate('/projects'); })
                .catch(() => toast.error('Failed to delete project'));
            }
          }}>
          <Trash2 size={14} /> Delete Project
        </button>
      </div>
    </div>
  );

  return (
    <div className="page-scroll">
      {/* Header */}
      <div className="page-header">
        <div>
          <button onClick={() => navigate('/projects')} className="btn btn-ghost" style={{ padding: '2px 6px', marginBottom: '6px', fontSize: '12px', color: 'var(--text-3)' }}>
            <ArrowLeft size={13} /> Projects
          </button>
          <h1 className="page-title">{project?.name || 'Project'}</h1>
          <p className="page-subtitle">Kanban Board · {tasks.length} task{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setActiveTab('Members')} className="btn btn-secondary">
            <UserPlus size={14} /> Invite
          </button>
          <button onClick={() => setShowNewTask('todo')} className="btn btn-primary">
            <Plus size={14} /> Add Task
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '22px' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid',
              fontFamily: 'Geist, sans-serif',
              transition: 'all 0.15s',
              background: activeTab === tab ? 'var(--accent)' : 'transparent',
              borderColor: activeTab === tab ? 'var(--accent)' : 'var(--border)',
              color: activeTab === tab ? '#fff' : 'var(--text-3)',
            }}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Board'    && BoardTab}
      {activeTab === 'Members'  && MembersTab}
      {activeTab === 'Settings' && SettingsTab}
    </div>
  );
}
