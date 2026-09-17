'use client';
import * as React from 'react';
import type { Socket } from 'socket.io-client';
import { withBase } from '@/lib/base-path';

type Listener = (payload: unknown) => void;

let socket: Socket | null = null;
let connecting: Promise<Socket | null> | null = null;
let connected = false;
const listeners = new Map<string, Set<Listener>>();
const statusListeners = new Set<(c: boolean) => void>();

/** WebSocket base URL: explicit env, else the API on port 4000 next to the web app in dev, else same origin. */
export function realtimeUrl() {
  if (process.env.NEXT_PUBLIC_WS_URL) return process.env.NEXT_PUBLIC_WS_URL;
  const { protocol, hostname, port } = window.location;
  const devPort = port && port !== '80' && port !== '443';
  return `${protocol}//${hostname}${devPort ? ':4000' : port ? `:${port}` : ''}`;
}

function setConnected(c: boolean) {
  connected = c;
  statusListeners.forEach((fn) => fn(c));
}

async function ensureSocket() {
  if (socket) return socket;
  connecting ??= import('socket.io-client')
    .then(({ io }) => {
      const s = io(`${realtimeUrl()}/v1/ws`, { path: withBase('/socket.io'), transports: ['websocket'], withCredentials: true, reconnectionDelayMax: 15_000 });
      s.on('ready', () => setConnected(true));
      s.on('disconnect', () => setConnected(false));
      s.on('connect_error', () => setConnected(false));
      s.on('unauthorized', async () => {
        // access cookie may have expired: refresh the session, then reconnect once
        const ok = await fetch(withBase('/api/v1/auth/refresh'), { method: 'POST', credentials: 'include' }).then((r) => r.ok).catch(() => false);
        if (ok) setTimeout(() => s.connect(), 300);
      });
      s.onAny((event: string, payload: unknown) => listeners.get(event)?.forEach((fn) => fn(payload)));
      socket = s;
      return s;
    })
    .catch(() => null);
  return connecting;
}

/** Subscribe to realtime events (`message`, `read`, `notification`). Returns whether the socket is live (else callers poll). */
export function useRealtime(event: string, handler: Listener) {
  const ref = React.useRef(handler);
  ref.current = handler;
  const [live, setLive] = React.useState(connected);
  React.useEffect(() => {
    const fn: Listener = (p) => ref.current(p);
    const set = listeners.get(event) ?? new Set();
    set.add(fn);
    listeners.set(event, set);
    statusListeners.add(setLive);
    void ensureSocket();
    return () => {
      set.delete(fn);
      statusListeners.delete(setLive);
    };
  }, [event]);
  return live;
}
