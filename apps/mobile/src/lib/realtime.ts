import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api } from './api';
import { API_URL } from './config';

/**
 * socket.io client for the API gateway (`/v1/ws`), authenticated with `auth.token` (Bearer access token).
 * One shared connection; screens also poll REST so chat works when the socket is down.
 */
let socket: Socket | null = null;
let refs = 0;

function connect(): Socket {
  if (socket) return socket;
  socket = io(`${API_URL}/v1/ws`, {
    transports: ['websocket'],
    // called on every (re)connect → always a fresh access token
    auth: (cb) => {
      void api.accessToken().then((token) => cb({ token: token ?? '' }));
    },
    reconnectionDelayMax: 30_000,
  });
  return socket;
}

export function useRealtime(enabled: boolean, handlers: Record<string, (payload: unknown) => void>): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;
  const events = Object.keys(handlers).sort().join(',');

  useEffect(() => {
    if (!enabled) return;
    const s = connect();
    refs++;
    const onReady = () => setConnected(true);
    const onDown = () => setConnected(false);
    const bound = events
      .split(',')
      .filter(Boolean)
      .map((ev) => [ev, (p: unknown) => handlersRef.current[ev]?.(p)] as const);
    s.on('ready', onReady);
    s.on('disconnect', onDown);
    s.on('unauthorized', onDown);
    for (const [ev, fn] of bound) s.on(ev, fn);
    if (s.connected) setConnected(true);
    return () => {
      s.off('ready', onReady);
      s.off('disconnect', onDown);
      s.off('unauthorized', onDown);
      for (const [ev, fn] of bound) s.off(ev, fn);
      refs--;
      if (refs <= 0 && socket) {
        socket.disconnect();
        socket = null;
        refs = 0;
      }
    };
  }, [enabled, events]);

  return { connected };
}
