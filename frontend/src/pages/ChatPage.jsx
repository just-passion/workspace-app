import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { getSocket } from '../hooks/useSocket';
import { useAuthStore } from '../store/authStore';
import { Send, Plus, Hash } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const workspaceId = useAuthStore((s) => s.workspaceId);
  const [activeChannel, setActiveChannel] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState([]);
  const bottomRef = useRef(null);
  const qc = useQueryClient();

  const { data: channelsData } = useQuery({
    queryKey: ['channels', workspaceId],
    queryFn: () => api.get('/channels', { params: { workspaceId } }).then(r => r.data),
    enabled: !!workspaceId,
  });
  const channels = channelsData?.channels || [];

  useEffect(() => {
    if (channels.length > 0 && !activeChannel) setActiveChannel(channels[0]);
  }, [channels]);

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
    socket.on('user_typing', ({ userId, userName }) => {
      if (userId !== user.id) setTyping(prev => [...new Set([...prev, userName])]);
    });
    socket.on('user_stop_typing', () => setTyping([]));
    return () => { socket.off('receive_message'); socket.off('user_typing'); socket.off('user_stop_typing'); };
  }, [activeChannel, user.id]);

  const createChannel = useMutation({
    mutationFn: () => api.post('/channels', { workspaceId, name: 'general', type: 'public', members: [user.id] }),
    onSuccess: () => qc.invalidateQueries(['channels', workspaceId]),
    onError: () => toast.error('Failed to create channel'),
  });

  let typingTimeout = null;
  function handleTyping(e) {
    setMessage(e.target.value);
    const socket = getSocket();
    if (!socket || !activeChannel) return;
    socket.emit('typing', { channelId: activeChannel._id });
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => socket.emit('stop_typing', { channelId: activeChannel._id }), 1500);
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

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Channels sidebar */}
      <div className="chat-sidebar">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span className="chat-sidebar-label">Channels</span>
          <button onClick={() => createChannel.mutate()} className="btn btn-ghost" style={{ padding: '2px' }} title="New channel">
            <Plus size={13} />
          </button>
        </div>

        {channels.filter(c => c.type !== 'direct').map(c => (
          <div key={c._id} onClick={() => setActiveChannel(c)}
            className={`channel-item${activeChannel?._id === c._id ? ' active' : ''}`}>
            <Hash size={13} style={{ flexShrink: 0 }} />
            {c.name}
          </div>
        ))}

        {channels.length === 0 && (
          <button onClick={() => createChannel.mutate()} className="btn btn-ghost" style={{ fontSize: '12px', color: 'var(--accent-light)', padding: '4px 0' }}>
            + Create #general
          </button>
        )}
      </div>

      {/* Chat area */}
      {activeChannel ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="chat-header">
            <div style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Hash size={14} style={{ color: 'var(--text-3)' }} />
              {activeChannel.name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>
              {activeChannel.members?.length || 0} members
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((m, i) => {
              const isOwn = m.senderId === user.id;
              return (
                <div key={i} className={`message-row${isOwn ? ' message-own' : ''}`}
                  style={{ flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                  <div className="avatar">{(m.senderName || m.senderId)?.[0]?.toUpperCase()}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexDirection: isOwn ? 'row-reverse' : 'row' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>{m.senderName || m.senderId}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
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
                placeholder={`Message #${activeChannel.name}…`}
                style={{ flex: 1, background: 'transparent', fontSize: '13px', color: 'var(--text-1)', border: 'none', outline: 'none', fontFamily: 'Geist, sans-serif' }} />
              <button type="submit" disabled={!message.trim()}
                style={{ background: 'none', border: 'none', cursor: message.trim() ? 'pointer' : 'not-allowed', color: message.trim() ? 'var(--accent)' : 'var(--text-3)', transition: 'color 0.15s', padding: 0 }}>
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <p style={{ color: 'var(--text-3)', fontSize: '14px' }}>No channels yet</p>
          <button onClick={() => createChannel.mutate()} className="btn btn-primary">
            + Create #general channel
          </button>
        </div>
      )}
    </div>
  );
}
