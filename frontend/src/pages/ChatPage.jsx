import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { getSocket } from '../hooks/useSocket';
import { useAuthStore } from '../store/authStore';
import { Send, Plus, Hash, MessageCircle, X, Users, UserPlus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const AVATAR_COLORS = [
  { bg: 'rgba(79,110,247,0.2)', color: '#7B97FF' },
  { bg: 'rgba(167,139,250,0.2)', color: '#A78BFA' },
  { bg: 'rgba(34,211,164,0.2)', color: '#22D3A4' },
  { bg: 'rgba(245,166,35,0.2)', color: '#F5A623' },
];

function MembersPanel({ channel, workspaceId, onClose }) {
  const qc = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');

  const { data } = useQuery({
    queryKey: ['channel-members', channel._id],
    queryFn: () => api.get(`/channels/${channel._id}/members`).then(r => r.data),
    enabled: !!channel._id,
  });
  const members = data?.members || [];

  const addMember = useMutation({
    mutationFn: (email) => api.post(`/channels/${channel._id}/members`, { email }),
    onSuccess: () => { qc.invalidateQueries(['channel-members', channel._id]); setInviteEmail(''); toast.success('Member added!'); },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to add member'),
  });

  const removeMember = useMutation({
    mutationFn: (userId) => api.delete(`/channels/${channel._id}/members/${userId}`),
    onSuccess: () => { qc.invalidateQueries(['channel-members', channel._id]); toast.success('Member removed'); },
    onError: () => toast.error('Failed to remove member'),
  });

  return (
    <div style={{ width: '260px', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>Members ({members.length})</span>
        <button onClick={onClose} className="btn btn-ghost" style={{ padding: '2px' }}><X size={14} /></button>
      </div>

      {/* Add member */}
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
            placeholder="Add by email…" type="email" className="input"
            style={{ flex: 1, fontSize: '12px', padding: '5px 8px' }}
            onKeyDown={e => { if (e.key === 'Enter' && inviteEmail.trim()) addMember.mutate(inviteEmail.trim()); }} />
          <button className="btn btn-primary" style={{ padding: '5px 8px' }}
            disabled={!inviteEmail.trim() || addMember.isPending}
            onClick={() => addMember.mutate(inviteEmail.trim())}>
            <UserPlus size={13} />
          </button>
        </div>
      </div>

      {/* Member list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {members.length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-3)', padding: '8px' }}>No members yet</p>}
        {members.map((m, i) => {
          const av = AVATAR_COLORS[i % AVATAR_COLORS.length];
          return (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                {m.name?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.email}</div>
              </div>
              <button className="btn btn-ghost" style={{ padding: '2px', color: 'var(--text-3)', flexShrink: 0 }}
                onClick={() => removeMember.mutate(m.id)} title="Remove">
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const workspaceId = useAuthStore((s) => s.workspaceId);
  const [activeChannel, setActiveChannel] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState([]);
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState('public');
  const [showMembers, setShowMembers] = useState(false);
  const bottomRef = useRef(null);
  const typingTimeout = useRef(null);
  const qc = useQueryClient();

  const { data: channelsData } = useQuery({
    queryKey: ['channels', workspaceId],
    queryFn: () => api.get('/channels', { params: { workspaceId } }).then(r => r.data),
    enabled: !!workspaceId,
  });
  const channels = channelsData?.channels || [];
  const publicChannels = channels.filter(c => c.type !== 'direct');
  const dmChannels = channels.filter(c => c.type === 'direct');

  const { data: membersData } = useQuery({
    queryKey: ['chat-members', workspaceId],
    queryFn: () => api.get('/channels/workspace-members', { params: { workspaceId } }).then(r => r.data),
    enabled: !!workspaceId,
  });
  const wsMembers = (membersData?.members || []).filter(m => m.id !== user?.id);

  useEffect(() => {
    if (publicChannels.length > 0 && !activeChannel) setActiveChannel(publicChannels[0]);
  }, [channels.length]);

  const { data: msgData } = useQuery({
    queryKey: ['messages', activeChannel?._id],
    queryFn: () => activeChannel ? api.get(`/channels/${activeChannel._id}/messages`).then(r => r.data) : null,
    enabled: !!activeChannel,
  });

  useEffect(() => { if (msgData?.messages) setMessages(msgData.messages); }, [msgData]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !activeChannel) return;
    socket.emit('join_channel', activeChannel._id);
    socket.on('receive_message', (msg) => setMessages(prev => [...prev, msg]));
    socket.on('user_typing', ({ userId: uid, userName }) => {
      if (uid !== user.id) setTyping(prev => [...new Set([...prev, userName])]);
    });
    socket.on('user_stop_typing', () => setTyping([]));
    return () => { socket.off('receive_message'); socket.off('user_typing'); socket.off('user_stop_typing'); };
  }, [activeChannel?._id, user.id]);

  // Close members panel when channel changes
  useEffect(() => { setShowMembers(false); }, [activeChannel?._id]);

  const createChannel = useMutation({
    mutationFn: ({ name, type }) => api.post('/channels', { workspaceId, name, type, members: [user.id] }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries(['channels', workspaceId]);
      setActiveChannel(data.channel);
      setShowNewChannel(false);
      setNewChannelName('');
    },
    onError: (err) => toast.error(err?.response?.data?.error || 'Failed to create channel'),
  });

  const startDM = useMutation({
    mutationFn: (memberId) => api.get('/channels/direct', { params: { workspaceId, userId: memberId } }),
    onSuccess: ({ data }) => {
      qc.invalidateQueries(['channels', workspaceId]);
      setActiveChannel(data.channel);
    },
    onError: () => toast.error('Failed to open DM'),
  });

  function handleTyping(e) {
    setMessage(e.target.value);
    const socket = getSocket();
    if (!socket || !activeChannel) return;
    socket.emit('typing', { channelId: activeChannel._id });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socket.emit('stop_typing', { channelId: activeChannel._id }), 1500);
  }

  function sendMessage(e) {
    e.preventDefault();
    if (!message.trim() || !activeChannel) return;
    const socket = getSocket();
    if (socket) socket.emit('send_message', { channelId: activeChannel._id, message: message.trim() });
    api.post(`/channels/${activeChannel._id}/messages`, { message: message.trim() });
    setMessages(prev => [...prev, { senderId: user.id, senderName: user.name, message: message.trim(), createdAt: new Date() }]);
    setMessage('');
  }

  function dmDisplayName(channel) {
    const otherMemberId = channel.members?.find(m => m !== user.id);
    const member = wsMembers.find(m => m.id === otherMemberId);
    return member?.name || channel.name;
  }

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Channels sidebar */}
      <div className="chat-sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span className="chat-sidebar-label">Channels</span>
          <button onClick={() => setShowNewChannel(v => !v)} className="btn btn-ghost" style={{ padding: '2px' }} title="New channel">
            <Plus size={13} />
          </button>
        </div>

        {showNewChannel && (
          <div style={{ marginBottom: '10px', background: 'rgba(255,255,255,0.04)', borderRadius: 'var(--radius)', padding: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input value={newChannelName} onChange={e => setNewChannelName(e.target.value)}
              placeholder="channel-name" autoFocus className="input" style={{ fontSize: '12px', padding: '5px 8px' }}
              onKeyDown={e => {
                if (e.key === 'Enter' && newChannelName.trim()) createChannel.mutate({ name: newChannelName.trim(), type: newChannelType });
                if (e.key === 'Escape') setShowNewChannel(false);
              }} />
            <select value={newChannelType} onChange={e => setNewChannelType(e.target.value)}
              className="input" style={{ fontSize: '12px', padding: '5px 8px', cursor: 'pointer' }}>
              <option value="public">Public</option>
              <option value="private">Private</option>
            </select>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-primary" style={{ flex: 1, fontSize: '11px', padding: '4px' }}
                disabled={!newChannelName.trim() || createChannel.isPending}
                onClick={() => createChannel.mutate({ name: newChannelName.trim(), type: newChannelType })}>
                Create
              </button>
              <button className="btn btn-ghost" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => setShowNewChannel(false)}>
                <X size={12} />
              </button>
            </div>
          </div>
        )}

        {publicChannels.map(c => (
          <div key={c._id} onClick={() => setActiveChannel(c)}
            className={`channel-item${activeChannel?._id === c._id ? ' active' : ''}`}>
            <Hash size={13} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
            {c.type === 'private' && <span style={{ fontSize: '9px', color: 'var(--text-3)' }}>🔒</span>}
          </div>
        ))}

        {publicChannels.length === 0 && (
          <button onClick={() => { setNewChannelName('general'); setShowNewChannel(true); }} className="btn btn-ghost" style={{ fontSize: '12px', color: 'var(--accent-light)', padding: '4px 0' }}>
            + Create #general
          </button>
        )}

        {/* Direct Messages */}
        <div style={{ marginTop: '16px', marginBottom: '6px' }}>
          <span className="chat-sidebar-label">Direct Messages</span>
        </div>

        {dmChannels.map((c, i) => {
          const av = AVATAR_COLORS[i % AVATAR_COLORS.length];
          const name = dmDisplayName(c);
          return (
            <div key={c._id} onClick={() => setActiveChannel(c)}
              className={`channel-item${activeChannel?._id === c._id ? ' active' : ''}`}>
              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>
                {name?.[0]?.toUpperCase()}
              </div>
              {name}
            </div>
          );
        })}

        {wsMembers.length > 0 && (
          <>
            <div style={{ fontSize: '10px', color: 'var(--text-3)', margin: '8px 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>All Members</div>
            {wsMembers.map((m, i) => {
              const av = AVATAR_COLORS[i % AVATAR_COLORS.length];
              return (
                <div key={m.id} onClick={() => startDM.mutate(m.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '13px', color: 'var(--text-2)', transition: 'background 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: av.bg, color: av.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, flexShrink: 0 }}>
                    {m.name?.[0]?.toUpperCase()}
                  </div>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                  <MessageCircle size={10} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Chat area */}
      {activeChannel ? (
        <div style={{ flex: 1, display: 'flex', minWidth: 0 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="chat-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {activeChannel.type === 'direct' ? <MessageCircle size={14} style={{ color: 'var(--text-3)' }} /> : <Hash size={14} style={{ color: 'var(--text-3)' }} />}
                  {activeChannel.type === 'direct' ? dmDisplayName(activeChannel) : activeChannel.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>
                  {activeChannel.type === 'direct' ? 'Direct message' : `${activeChannel.members?.length || 0} members`}
                </div>
              </div>
              {activeChannel.type !== 'direct' && (
                <button onClick={() => setShowMembers(v => !v)} className="btn btn-ghost"
                  style={{ padding: '6px 10px', fontSize: '12px', color: showMembers ? 'var(--accent)' : 'var(--text-3)' }}>
                  <Users size={14} /> Members
                </button>
              )}
            </div>

            <div className="chat-messages">
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-3)', fontSize: '13px' }}>
                  <Hash size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                  <p>This is the beginning of #{activeChannel.name}</p>
                </div>
              )}
              {messages.map((m, i) => {
                const isOwn = m.senderId === user.id;
                const senderName = m.senderName || m.senderId;
                const showAvatar = i === 0 || messages[i-1]?.senderId !== m.senderId;
                return (
                  <div key={i} className={`message-row${isOwn ? ' message-own' : ''}`}
                    style={{ flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                    <div className="avatar" style={{ visibility: showAvatar ? 'visible' : 'hidden' }}>
                      {senderName?.[0]?.toUpperCase()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                      {showAvatar && (
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>{senderName}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      )}
                      <div className="message-bubble">{m.message}</div>
                    </div>
                  </div>
                );
              })}
              {typing.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-3)', fontStyle: 'italic', paddingLeft: '42px' }}>
                  {typing.join(', ')} {typing.length === 1 ? 'is' : 'are'} typing…
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="chat-input-area">
              <form onSubmit={sendMessage} className="chat-input-wrapper">
                <input value={message} onChange={handleTyping}
                  placeholder={activeChannel.type === 'direct' ? `Message ${dmDisplayName(activeChannel)}…` : `Message #${activeChannel.name}…`}
                  style={{ flex: 1, background: 'transparent', fontSize: '13px', color: 'var(--text-1)', border: 'none', outline: 'none', fontFamily: 'Geist, sans-serif' }} />
                <button type="submit" disabled={!message.trim()}
                  style={{ background: 'none', border: 'none', cursor: message.trim() ? 'pointer' : 'not-allowed', color: message.trim() ? 'var(--accent)' : 'var(--text-3)', transition: 'color 0.15s', padding: 0 }}>
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>

          {/* Members panel */}
          {showMembers && activeChannel.type !== 'direct' && (
            <MembersPanel channel={activeChannel} workspaceId={workspaceId} onClose={() => setShowMembers(false)} />
          )}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>No channels yet</p>
          <button onClick={() => { setNewChannelName('general'); setShowNewChannel(true); }} className="btn btn-primary">
            + Create #general channel
          </button>
        </div>
      )}
    </div>
  );
}
