import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { io, type Socket } from 'socket.io-client';

import { api, BASE_URL } from '@/lib/api';
import type { ChatEvent, ChatMessage } from '@/lib/chat';
import { useAuth } from '@/store/auth';
import { useFleet } from '@/store/fleet';

type Listener = (event: ChatEvent) => void;

type ChatContextValue = {
  /** Скільки непрочитаних повідомлень у всіх чатах */
  unread: number;
  connected: boolean;
  /** Підписка на події чату; повертає функцію відписки */
  subscribe: (listener: Listener) => () => void;
  /** Повідомити співрозмовнику, що я друкую */
  sendTyping: (conversationId: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

/**
 * Одне живе з'єднання на весь застосунок. Сокет лише доставляє події (нове повідомлення, «прочитано»,
 * «друкує…»); відправка й історія йдуть через REST, тож чат працює і тоді, коли сокет тимчасово обірвався.
 */
export function ChatProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const { ready } = useFleet();
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const listeners = useRef(new Set<Listener>());
  const socketRef = useRef<Socket | null>(null);

  const emit = useCallback((event: ChatEvent) => listeners.current.forEach((l) => l(event)), []);

  const refreshUnread = useCallback(() => {
    api<{ count: number }>('GET', '/chats/unread')
      .then((r) => setUnread(r.count))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token || !ready) return;
    const socket = io(BASE_URL, { transports: ['websocket'], auth: { token }, reconnectionDelayMax: 10_000 });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      refreshUnread();
      // Після обриву могли прийти повідомлення, яких не було видно: екрани перезавантажать дані
      emit({ type: 'resume' });
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('message', (p: { conversationId: string; senderId: string; message: ChatMessage }) => {
      emit({ type: 'message', conversationId: p.conversationId, senderId: p.senderId, message: p.message });
      refreshUnread();
    });
    socket.on('read', (p: { conversationId: string; by: 'owner' | 'renter'; at: string }) => {
      emit({ type: 'read', ...p });
      refreshUnread();
    });
    socket.on('typing', (p: { conversationId: string; userId: string }) => emit({ type: 'typing', ...p }));
    socket.on('removed', (p: { conversationId: string }) => {
      emit({ type: 'removed', conversationId: p.conversationId });
      refreshUnread();
    });

    refreshUnread();
    // Повернувшись у застосунок, перепідключаємось і підтягуємо пропущене
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (!socket.connected) socket.connect();
      refreshUnread();
      emit({ type: 'resume' });
    });

    return () => {
      sub.remove();
      socket.close();
      socketRef.current = null;
      setConnected(false);
      setUnread(0);
    };
  }, [token, ready, emit, refreshUnread]);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const sendTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit('typing', { conversationId });
  }, []);

  const value = useMemo(() => ({ unread, connected, subscribe, sendTyping }), [unread, connected, subscribe, sendTyping]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside ChatProvider');
  return ctx;
}

/** Підписка екрана на події чату на час його життя */
export function useChatEvents(handler: Listener) {
  const { subscribe } = useChat();
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => subscribe((event) => latest.current(event)), [subscribe]);
}
