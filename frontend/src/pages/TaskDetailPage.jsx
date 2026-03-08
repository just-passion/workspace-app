import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { Send, Paperclip } from 'lucide-react';
import toast from 'react-hot-toast';

const PRIO_COLORS   = { high: '#F87171', medium: '#F5A623', low: '#22D3A4' };
const STATUS_COLORS = { backlog: '#4A5578', todo: '#F5A623', in_progress: '#4F6EF7', done: '#22D3A4' };

export default function TaskDetailPage() {
  const { id } = useParams();
  const user = useAuthStore((s) => s.user);
  const qc = useQueryClient();
  const [comment, setComment] = useState('');

  const { data: taskData } = useQuery({ queryKey: ['task', id], queryFn: () => api.get(`/tasks/${id}`).then(r => r.data) });
  const { data: commentsData } = useQuery({ queryKey: ['task-comments', id], queryFn: () => api.get(`/tasks/${id}/comments`).then(r => r.data) });

  const task = taskData?.task;
  const comments = commentsData?.comments || [];

  const addComment = useMutation({
    mutationFn: () => api.post(`/tasks/${id}/comments`, { comment }),
    onSuccess: () => { qc.invalidateQueries(['task-comments', id]); setComment(''); },
    onError: () => toast.error('Failed to add comment'),
  });

  if (!task) return (
    <div style={{ padding: '28px', display: 'flex', gap: '12px', flexDirection: 'column' }}>
      {[80, 200, 140].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? '24px' : '14px', width: `${w}px` }} />
      ))}
    </div>
  );

  const statusColor = STATUS_COLORS[task.status] || '#4F6EF7';
  const prioColor   = PRIO_COLORS[task.priority]   || '#F5A623';

  return (
    <div className="page-scroll">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '18px', maxWidth: '960px' }}>
        {/* Main */}
        <div>
          <div className="task-detail-card">
            {/* Status + Priority */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <span className="badge" style={{ background: statusColor + '1A', color: statusColor, borderColor: statusColor + '40' }}>
                {task.status?.replace('_', ' ')}
              </span>
              <span className="badge" style={{ background: prioColor + '1A', color: prioColor, borderColor: prioColor + '40' }}>
                {task.priority} priority
              </span>
            </div>

            <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.03em', color: 'var(--text-1)', marginBottom: '10px' }}>
              {task.title}
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.65, marginBottom: '20px' }}>
              {task.description || 'No description provided.'}
            </p>

            <div className="divider" />

            <div className="task-meta-group">
              <div className="task-meta-item">
                <span className="task-meta-label">Assignee</span>
                <span className="task-meta-value">{task.assigneeId || 'Unassigned'}</span>
              </div>
              <div className="task-meta-item">
                <span className="task-meta-label">Due Date</span>
                <span className="task-meta-value">{task.dueDate ? new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date'}</span>
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
              {comments.map((c, i) => (
                <div key={i} className="message-row">
                  <div className="avatar">{c.userId?.[0]?.toUpperCase()}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>{c.userId}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="comment-bubble">{c.comment}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <input value={comment} onChange={e => setComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && comment.trim() && addComment.mutate()}
                placeholder="Write a comment…" className="input" style={{ flex: 1 }} />
              <button onClick={() => comment.trim() && addComment.mutate()} disabled={!comment.trim()} className="btn btn-primary" style={{ padding: '9px 14px' }}>
                <Send size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div>
          <div className="card" style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '12px' }}>Attachments</h2>
            {(!task.attachments || task.attachments.length === 0) ? (
              <p style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '12px' }}>No attachments</p>
            ) : task.attachments.map((a, i) => (
              <div key={i} className="card" style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-2)', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Paperclip size={12} style={{ color: 'var(--text-3)' }} />
                {a.name}
              </div>
            ))}
            <button className="task-add-btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Paperclip size={12} /> Attach File
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
