import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

let socket = null;

export function useSocket() {
  const token = useAuthStore((s) => s.token);
  const initialized = useRef(false);

  useEffect(() => {
    if (!token || initialized.current) return;
    initialized.current = true;

    socket = io('/', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => console.log('🔌 Socket connected'));
    socket.on('disconnect', () => console.log('🔌 Socket disconnected'));

    return () => {
      socket?.disconnect();
      initialized.current = false;
    };
  }, [token]);

  return socket;
}

export function getSocket() { return socket; }
