import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Send, Paperclip, ArrowLeft, Pencil, X, Check, Calendar, User } from 'lucide-react';
import toast from 'react-hot-toast';

const PRIO_COLORS   = { high: '#F87171', medium: '#F5A623', low: '#22D3A4' };
const STATUS_COLORS = { backlog: '#4A5578', todo: '#F5A623', in_progress: '#4F6EF7', done: '#22D3A4' };
const STATUS_OPTIONS = ['backlog', 'todo', 'in_progress', 'done'];
const PRIO_OPTIONS   = ['low', 'medium', 'high'];

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CommentInput({ onSubmit, workspaceId }) {
  const [value, setValue] = useState('');
  const [mentionQuery, setMentionQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [caretPos, setCaretPos] = useState(0);
  const [mentions, setMentions] = useState([]);
  const inputRef = useRef(null);

  const { data: usersData } = useQuery({
    queryKey: ['user-search', mentionQuery, workspaceId],
    queryFn: () => api.get('/users/search', { params: { q: mentionQuery, workspaceId } }).then(r => r.data),
    enabled: showDropdown,
    staleTime: 2000,
  });
  const suggestions = usersData?.users || [];

  function handleChange(e) {
    const val = e.target.value;
    setValue(val);
    const pos = e.target.selectionStart;
    setCaretPos(pos);
    const textBefore = val.slice(0, pos);
    const match = textBefore.match(/@(\w*)$/);
    if (match) { setMentionQuery(match[1]); setShowDropdown(true); }
    else { setShowDropdown(false); setMentionQuery(''); }
  }

  function insertMention(user) {
    const textBefore = value.slice(0, caretPos);
    const textAfter = value.slice(caretPos);
    const replaced = textBefore.replace(/@(\w*)$/, `@${user.name} `);
    setValue(replaced + textAfter);
    setMentions(prev => [...prev, user.id]);
    setShowDropdown(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') { setShowDropdown(false); return; }
    if (e.key === 'Enter' && !showDropdown && value.trim()) {
      e.preventDefault();
      onSubmit(value.trim(), mentions);
      setValue(''); setMentions([]);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {showDropdown && suggestions.length > 0 && (
        <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 50, overflow: 'hidden' }}>
          {suggestions.map(u => (
            <div key={u.id} onMouseDown={() => insertMention(u)}
              style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-1)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(79,110,247,0.2)', color: '#7B97FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                {u.name[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>{u.name}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{u.email}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px' }}>
        <input ref={inputRef} value={value} onChange={handleChange} onKeyDown={handleKeyDown}
          placeholder="Write a comment… (use @ to mention)" className="input" style={{ flex: 1 }} />
        <button onClick={() => { if (value.trim()) { onSubmit(value.trim(), mentions); setValue(''); setMentions([]); } }}
          disabled={!value.trim()} className="btn btn-primary" style={{ padding: '9px 14px' }}>
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const workspaceId = useAuthStore((s) => s.workspaceId);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const fileInputRef = useRef(null);

  const { data: taskData, isLoading } = useQuery({
    queryKey: ['task', id],
    queryFn: () => api.get(`/tasks/${id}`).then(r => r.data),
  });
  const { data: commentsData } = useQuery({
    queryKey: ['task-comments', id],
    queryFn: () => api.get(`/tasks/${id}/comments`).then(r => r.data),
  });

  const task = taskData?.task;
  const { data: projectData } = useQuery({
    queryKey: ['project', task?.projectId],
    queryFn: () => api.get(`/projects/${task.projectId}`).then(r => r.data),
    enabled: !!task?.projectId,
  });
  const projectMembers = projectData?.project?.members || [];

  const userMap = {};
  projectMembers.forEach(m => { if (m.user) userMap[m.userId] = m.user.name; });
  if (user) userMap[user.id] = user.name;

  const comments = commentsData?.comments || [];

  const addComment = useMutation({
    mutationFn: ({ comment, mentions }) => api.post(`/tasks/${id}/comments`, { comment, mentions }),
    onSuccess: () => qc.invalidateQueries(['task-comments', id]),
    onError: () => toast.error('Failed to add comment'),
  });

  const updateTask = useMutation({
    mutationFn: (body) => api.put(`/tasks/${id}`, body),
    onSuccess: () => { qc.invalidateQueries(['task', id]); setEditing(false); toast.success('Task updated'); },
    onError: () => toast.error('Failed to update task'),
  });

  const moveTask = useMutation({
    mutationFn: (status) => api.patch(`/tasks/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries(['task', id]),
  });

  const uploadFile = useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return api.post(`/tasks/${id}/attachments`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => { qc.invalidateQueries(['task', id]); toast.success('File attached!'); },
    onError: () => toast.error('Upload failed'),
  });

  if (isLoading) return (
    <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {[80, 300, 200].map((w, i) => <div key={i} className="skeleton" style={{ height: i === 0 ? '24px' : '14px', width: `${w}px` }} />)}
    </div>
  );

  if (!task) return <div style={{ padding: '28px', color: 'var(--text-3)' }}>Task not found.</div>;

  const statusColor = STATUS_COLORS[task.status] || '#4F6EF7';
  const prioColor   = PRIO_COLORS[task.priority]   || '#F5A623';
  const assigneeName = task.assigneeId ? (userMap[task.assigneeId] || task.assigneeId) : 'Unassigned';
  const creatorName  = task.createdBy  ? (userMap[task.createdBy]  || task.createdBy)  : '?';

  return (
    <div className="page-scroll">
      <button onClick={() => navigate(-1)} className="btn btn-ghost" style={{ padding: '2px 6px', marginBottom: '14px', fontSize: '12px', color: 'var(--text-3)' }}>
        <ArrowLeft size={13} /> Back
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 270px', gap: '18px', maxWidth: '960px' }}>
        <div>
          <div className="task-detail-card">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
              {editing ? (
                <>
                  <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                    className="input" style={{ width: 'auto', padding: '3px 8px', fontSize: '12px', cursor: 'pointer' }}>
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                  </select>
                  <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                    className="input" style={{ width: 'auto', padding: '3px 8px', fontSize: '12px', cursor: 'pointer' }}>
                    {PRIO_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </>
              ) : (
                <>
                  <span className="badge" style={{ background: statusColor + '1A', color: statusColor, borderColor: statusColor + '40' }}>
                    {task.status?.replace('_', ' ')}
                  </span>
                  <span className="badge" style={{ background: prioColor + '1A', color: prioColor, borderColor: prioColor + '40' }}>
                    {task.priority} priority
                  </span>
                </>
              )}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                {editing ? (
                  <>
                    <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => updateTask.mutate(editForm)}>
                      <Check size={13} /> Save
                    </button>
                    <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setEditing(false)}>
                      <X size={13} /> Cancel
                    </button>
                  </>
                ) : (
                  <button className="btn btn-ghost" style={{ padding: '4px 8px' }}
                    onClick={() => { setEditing(true); setEditForm({ title: task.title, description: task.description, status: task.status, priority: task.priority, dueDate: task.dueDate ? new Date(task.dueDate).toISOString().slice(0,10) : '', assigneeId: task.assigneeId || '' }); }}>
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            </div>

            {editing ? (
              <>
                <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="input" style={{ fontSize: '18px', fontWeight: 800, marginBottom: '12px', letterSpacing: '-0.02em' }} />
                <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  className="input" rows={4} style={{ fontSize: '13px', lineHeight: 1.65, resize: 'vertical', fontFamily: 'Geist, sans-serif', marginBottom: '12px' }}
                  placeholder="Add a description…" />
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><User size={12} /> Assignee</label>
                    <select value={editForm.assigneeId || ''} onChange={e => setEditForm(f => ({ ...f, assigneeId: e.target.value }))} className="input" style={{ cursor: 'pointer' }}>
                      <option value="">Unassigned</option>
                      {projectMembers.map(m => <option key={m.userId} value={m.userId}>{m.user?.name || m.userId}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> Due Date</label>
                    <input type="date" value={editForm.dueDate || ''} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} className="input" style={{ cursor: 'pointer' }} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-1)', marginBottom: '10px' }}>{task.title}</h1>
                <p style={{ fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.65, marginBottom: '20px' }}>{task.description || 'No description provided.'}</p>
              </>
            )}

            <div className="divider" />
            <div className="task-meta-group">
              <div className="task-meta-item">
                <span className="task-meta-label">Assignee</span>
                <span className="task-meta-value" style={{ color: task.assigneeId ? 'var(--text-1)' : 'var(--text-3)' }}>{assigneeName}</span>
              </div>
              <div className="task-meta-item">
                <span className="task-meta-label">Due Date</span>
                <span className="task-meta-value" style={{ color: task.dueDate ? (new Date(task.dueDate) < new Date() ? '#F87171' : 'var(--text-1)') : 'var(--text-3)' }}>
                  {task.dueDate ? new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'}
                </span>
              </div>
              <div className="task-meta-item">
                <span className="task-meta-label">Created by</span>
                <span className="task-meta-value">{creatorName}</span>
              </div>
              <div className="task-meta-item">
                <span className="task-meta-label">Created</span>
                <span className="task-meta-value">{new Date(task.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              </div>
            </div>
          </div>

          {/* Comments */}
          <div className="task-detail-card">
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '20px', letterSpacing: '-0.01em' }}>
              Comments <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>({comments.length})</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
              {comments.length === 0 && <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>No comments yet. Be the first to comment.</p>}
              {comments.map((c, i) => {
                const commenterName = userMap[c.userId] || c.userId;
                const rendered = c.comment.replace(/@([\w\s]+?)(?=\s|$)/g, '<span style="color:#7B97FF;font-weight:600">@$1</span>');
                return (
                  <div key={i} className="message-row">
                    <div className="avatar">{commenterName?.[0]?.toUpperCase()}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>{commenterName}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{timeAgo(c.createdAt)}</span>
                      </div>
                      <div className="comment-bubble" dangerouslySetInnerHTML={{ __html: rendered }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <CommentInput workspaceId={workspaceId} onSubmit={(text, mentions) => addComment.mutate({ comment: text, mentions })} />
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '12px' }}>Move to Column</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {STATUS_OPTIONS.map(s => {
                const sc = STATUS_COLORS[s]; const isActive = task.status === s;
                return (
                  <button key={s} onClick={() => !isActive && moveTask.mutate(s)}
                    style={{ padding: '7px 12px', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: isActive ? 700 : 400, cursor: isActive ? 'default' : 'pointer', border: '1px solid', fontFamily: 'Geist, sans-serif', transition: 'all 0.15s', textAlign: 'left', background: isActive ? sc + '1A' : 'transparent', borderColor: isActive ? sc + '50' : 'var(--border)', color: isActive ? sc : 'var(--text-3)' }}>
                    {s.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '14px' }}>Activity</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div className="avatar avatar-sm" style={{ background: 'rgba(79,110,247,0.2)', border: '1px solid rgba(79,110,247,0.35)', color: '#7B97FF' }}>
                  {creatorName?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-2)' }}><b>{creatorName}</b> created this task</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{timeAgo(task.createdAt)}</div>
                </div>
              </div>
              {comments.map((c, i) => {
                const name = userMap[c.userId] || c.userId;
                return (
                  <div key={i} style={{ display: 'flex', gap: '8px' }}>
                    <div className="avatar avatar-sm" style={{ background: 'rgba(167,139,250,0.2)', border: '1px solid rgba(167,139,250,0.35)', color: '#A78BFA' }}>
                      {name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-2)' }}><b>{name}</b> added a comment</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-3)' }}>{timeAgo(c.createdAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ padding: '16px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '12px' }}>Attachments</h3>
            {(!task.attachments || task.attachments.length === 0) ? (
              <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '12px' }}>No attachments</p>
            ) : task.attachments.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noreferrer"
                className="card" style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-2)', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center', textDecoration: 'none' }}>
                <Paperclip size={12} style={{ color: 'var(--text-3)' }} /> {a.name}
              </a>
            ))}
            <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={e => e.target.files[0] && uploadFile.mutate(e.target.files[0])} />
            <button className="task-add-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              onClick={() => fileInputRef.current?.click()} disabled={uploadFile.isPending}>
              <Paperclip size={12} /> {uploadFile.isPending ? 'Uploading…' : 'Attach File'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
