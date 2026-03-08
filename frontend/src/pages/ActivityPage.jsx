import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const AVATAR_COLORS = [
  { bg: 'rgba(79,110,247,0.2)', border: 'rgba(79,110,247,0.35)', color: '#7B97FF' },
  { bg: 'rgba(167,139,250,0.2)', border: 'rgba(167,139,250,0.35)', color: '#A78BFA' },
  { bg: 'rgba(34,211,164,0.2)', border: 'rgba(34,211,164,0.35)', color: '#22D3A4' },
  { bg: 'rgba(245,166,35,0.2)', border: 'rgba(245,166,35,0.35)', color: '#F5A623' },
  { bg: 'rgba(248,113,113,0.2)', border: 'rgba(248,113,113,0.35)', color: '#F87171' },
];

const EVENT_LABELS = {
  task_created:       { verb: 'created task',    color: '#4F6EF7' },
  task_updated:       { verb: 'updated task',    color: '#A78BFA' },
  task_status_changed:{ verb: 'moved task',      color: '#F5A623' },
  comment_added:      { verb: 'commented on',    color: '#22D3A4' },
  task_assigned:      { verb: 'assigned task',   color: '#4F6EF7' },
  project_created:    { verb: 'created project', color: '#22D3A4' },
  member_joined:      { verb: 'joined project',  color: '#F5A623' },
};

function timeAgo(date) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  if (h < 48) return 'Yesterday';
  return `${Math.floor(h / 24)}d ago`;
}

export default function ActivityPage() {
  const workspaceId = useAuthStore((s) => s.workspaceId);

  const { data, isLoading } = useQuery({
    queryKey: ['activity-feed', workspaceId],
    queryFn: () => api.get(`/activity/${workspaceId}`).then(r => r.data),
    enabled: !!workspaceId,
    refetchInterval: 20000,
  });

  const activity = data?.activity || [];

  return (
    <div className="page-scroll" style={{ maxWidth: '700px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 className="page-title">Activity Feed</h1>
        <p className="page-subtitle">All events across your workspace</p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: '68px', borderRadius: 'var(--radius-lg)' }} />)}
        </div>
      ) : activity.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">No activity yet. Start by creating a project or task.</p>
        </div>
      ) : (
        <div>
          {activity.map((a, i) => {
            const av = AVATAR_COLORS[i % AVATAR_COLORS.length];
            const ev = EVENT_LABELS[a.eventType] || { verb: a.eventType?.replace(/_/g, ' '), color: '#4F6EF7' };
            const meta = a.metadata || {};
            const isLast = i === activity.length - 1;

            return (
              <div key={a.id || i} style={{ display: 'flex', gap: '14px', paddingBottom: '16px', position: 'relative' }}>
                {/* Timeline line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="avatar" style={{ width: '36px', height: '36px', fontSize: '13px', background: av.bg, border: `2px solid ${av.border}`, color: av.color, flexShrink: 0 }}>
                    {(a.actor?.name || a.userId)?.[0]?.toUpperCase() || '?'}
                  </div>
                  {!isLast && (
                    <div style={{ width: '2px', flex: 1, background: 'var(--border)', marginTop: '6px', minHeight: '20px' }} />
                  )}
                </div>

                {/* Event card */}
                <div style={{ flex: 1, paddingBottom: '4px' }}>
                  <div className="card" style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-1)', lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 700 }}>{a.actor?.name || a.userId}</span>
                        <span style={{ color: 'var(--text-3)' }}> {ev.verb} </span>
                        {(meta.title || meta.taskId) && (
                          <span style={{ color: ev.color, fontWeight: 600 }}>{meta.title || meta.taskId}</span>
                        )}
                        {meta.status && (
                          <span style={{ color: 'var(--text-3)' }}> → <span style={{ color: ev.color }}>{meta.status?.replace('_', ' ')}</span></span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-3)', flexShrink: 0, marginLeft: '12px' }}>
                        {timeAgo(a.createdAt)}
                      </span>
                    </div>
                    {meta.projectId && (
                      <div style={{ marginTop: '8px' }}>
                        <span className="badge" style={{ background: 'rgba(107,114,128,0.12)', color: 'var(--text-3)', borderColor: 'rgba(107,114,128,0.2)', borderRadius: '4px', fontSize: '11px' }}>
                          📁 {meta.projectId}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
