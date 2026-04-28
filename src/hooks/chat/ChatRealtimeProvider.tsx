import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../../api/client';
import { useAuth } from '../useAuth';
import {
    updateOtherUserLastReadMessageId,
    upsertChatInAllQueries,
    upsertMessageInCache,
} from '../../query/chatCache';
import { queryClient } from '../../query/queryClient';
import { queryKeys } from '../../query/queryKeys';

interface PendingAck {
    optimisticId: string;
    resolve: (payload: api.ChatMessageAckEnvelope) => void;
    reject: (error: Error) => void;
    timeoutId: ReturnType<typeof setTimeout>;
}

interface SendRealtimeMessageParams {
    chatId: string;
    body: string;
    clientMessageId: string;
    optimisticId: string;
}

interface ChatRealtimeContextValue {
    isConnected: boolean;
    sendMessage: (params: SendRealtimeMessageParams) => Promise<api.ChatMessageAckEnvelope>;
    markRead: (chatId: string, lastReadMessageId?: string) => boolean;
    subscribeChat: (chatId: string) => void;
    unsubscribeChat: (chatId: string) => void;
}

const ChatRealtimeContext = createContext<ChatRealtimeContextValue | null>(null);
const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 15000;
const ACK_TIMEOUT_MS = 10000;

export function ChatRealtimeProvider({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
    const shouldReconnectRef = useRef(false);
    const connectRef = useRef<() => Promise<void>>(async () => {});
    const pendingAcksRef = useRef(new Map<string, PendingAck>());
    const subscriptionsRef = useRef(new Set<string>());
    const lastCursorRef = useRef<string | null>(null);

    const clearPendingAcks = useCallback((reason: string) => {
        for (const pending of pendingAcksRef.current.values()) {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error(reason));
        }
        pendingAcksRef.current.clear();
    }, []);

    const handleRealtimeEvent = useCallback((event: api.ChatRealtimeServerEvent) => {
        if (event.cursor && event.type.startsWith('chat.')) {
            lastCursorRef.current = event.cursor;
        }

        switch (event.type) {
        case 'connection.ready':
            return;
        case 'system.resync_required': {
            lastCursorRef.current = null;
            void queryClient.invalidateQueries({ queryKey: ['chats'] });
            for (const chatId of subscriptionsRef.current) {
                void queryClient.invalidateQueries({ queryKey: queryKeys.chatMessages(chatId) });
            }
            return;
        }
        case 'chat.message.ack': {
            const payload = event.data as api.ChatMessageAckEnvelope;
            const pending = pendingAcksRef.current.get(payload.client_message_id);
            if (pending) {
                clearTimeout(pending.timeoutId);
                pendingAcksRef.current.delete(payload.client_message_id);
                upsertMessageInCache(queryClient, payload.chat_id, payload.message, pending.optimisticId);
                if (payload.summary) {
                    upsertChatInAllQueries(queryClient, payload.summary);
                    queryClient.setQueryData(queryKeys.chat(payload.chat_id), payload.summary);
                }
                pending.resolve(payload);
            }
            return;
        }
        case 'chat.message.failed': {
            const payload = event.data as api.ChatMessageFailedEnvelope;
            const pending = pendingAcksRef.current.get(payload.client_message_id);
            if (pending) {
                clearTimeout(pending.timeoutId);
                pendingAcksRef.current.delete(payload.client_message_id);
                pending.reject(new Error(payload.error));
            }
            return;
        }
        case 'chat.message.created': {
            const payload = event.data as api.ChatMessageEnvelope;
            const pendingClientMessageId = payload.message.client_message_id ?? undefined;
            const pending = pendingClientMessageId
                ? pendingAcksRef.current.get(pendingClientMessageId)
                : undefined;

            if (pending && pendingClientMessageId) {
                clearTimeout(pending.timeoutId);
                pendingAcksRef.current.delete(pendingClientMessageId);
                pending.resolve({
                    chat_id: payload.chat_id,
                    client_message_id: pendingClientMessageId,
                    message: payload.message,
                    summary: payload.summary,
                });
            }

            upsertMessageInCache(queryClient, payload.chat_id, payload.message, pending?.optimisticId);
            if (payload.summary) {
                upsertChatInAllQueries(queryClient, payload.summary);
                queryClient.setQueryData(queryKeys.chat(payload.chat_id), payload.summary);
            }
            return;
        }
        case 'chat.read.updated': {
            const payload = event.data as api.ChatReadReceiptEnvelope;
            if (payload.user_id !== user?.id) {
                updateOtherUserLastReadMessageId(queryClient, payload.chat_id, payload.last_read_message_id ?? null);
            }
            return;
        }
        case 'chat.summary.updated': {
            const payload = event.data as api.Chat;
            upsertChatInAllQueries(queryClient, payload);
            queryClient.setQueryData(queryKeys.chat(payload.id), payload);
            return;
        }
        default:
            return;
        }
    }, [user?.id]);

    const scheduleReconnect = useCallback(() => {
        if (!shouldReconnectRef.current || reconnectTimeoutRef.current) return;
        const delay = reconnectDelayRef.current;
        reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, MAX_RECONNECT_DELAY_MS);
            void connectRef.current();
        }, delay);
    }, []);

    const cleanupSocket = useCallback(() => {
        const socket = socketRef.current;
        socketRef.current = null;
        if (!socket) return;

        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close();
    }, []);

    const connect = useCallback(async () => {
        if (!shouldReconnectRef.current || socketRef.current) return;

        const token = await api.getToken();
        if (!token) return;

        const socket = new WebSocket(api.getChatWebSocketUrl(token));
        socketRef.current = socket;

        socket.onopen = () => {
            reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;
            setIsConnected(true);
            socket.send(JSON.stringify({
                type: 'resume',
                data: {
                    last_cursor: lastCursorRef.current ?? undefined,
                },
            }));
            for (const chatId of subscriptionsRef.current) {
                socket.send(JSON.stringify({
                    type: 'subscribe_chat',
                    data: { chat_id: chatId },
                }));
            }
        };

        socket.onmessage = (messageEvent) => {
            try {
                const event = JSON.parse(messageEvent.data as string) as api.ChatRealtimeServerEvent;
                handleRealtimeEvent(event);
            } catch {
                // Ignore malformed realtime payloads and keep the connection alive.
            }
        };

        socket.onerror = () => {
            // Connection state is finalized in onclose.
        };

        socket.onclose = () => {
            if (socketRef.current === socket) {
                socketRef.current = null;
            }
            setIsConnected(false);
            clearPendingAcks('Chat connection closed.');
            scheduleReconnect();
        };
    }, [clearPendingAcks, handleRealtimeEvent, scheduleReconnect]);

    connectRef.current = connect;

    useEffect(() => {
        shouldReconnectRef.current = isAuthenticated;

        if (isAuthenticated) {
            void connect();
            return () => {
                shouldReconnectRef.current = false;
                if (reconnectTimeoutRef.current) {
                    clearTimeout(reconnectTimeoutRef.current);
                    reconnectTimeoutRef.current = null;
                }
                clearPendingAcks('Chat connection closed.');
                cleanupSocket();
                setIsConnected(false);
            };
        }

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }
        clearPendingAcks('Not authenticated.');
        cleanupSocket();
        lastCursorRef.current = null;
        setIsConnected(false);
        return undefined;
    }, [clearPendingAcks, cleanupSocket, connect, isAuthenticated]);

    const sendMessage = useCallback((params: SendRealtimeMessageParams) => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error('Chat connection unavailable.'));
        }

        return new Promise<api.ChatMessageAckEnvelope>((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                pendingAcksRef.current.delete(params.clientMessageId);
                reject(new Error('Chat message timed out.'));
            }, ACK_TIMEOUT_MS);

            pendingAcksRef.current.set(params.clientMessageId, {
                optimisticId: params.optimisticId,
                resolve,
                reject,
                timeoutId,
            });

            socket.send(JSON.stringify({
                type: 'send_message',
                data: {
                    chat_id: params.chatId,
                    client_message_id: params.clientMessageId,
                    body: params.body,
                },
            }));
        });
    }, []);

    const markRead = useCallback((chatId: string, lastReadMessageId?: string) => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return false;
        }

        socket.send(JSON.stringify({
            type: 'mark_read',
            data: {
                chat_id: chatId,
                last_read_message_id: lastReadMessageId,
            },
        }));
        return true;
    }, []);

    const subscribeChat = useCallback((chatId: string) => {
        subscriptionsRef.current.add(chatId);
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({
            type: 'subscribe_chat',
            data: { chat_id: chatId },
        }));
    }, []);

    const unsubscribeChat = useCallback((chatId: string) => {
        subscriptionsRef.current.delete(chatId);
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({
            type: 'unsubscribe_chat',
            data: { chat_id: chatId },
        }));
    }, []);

    const value = useMemo(() => ({
        isConnected,
        sendMessage,
        markRead,
        subscribeChat,
        unsubscribeChat,
    }), [isConnected, markRead, sendMessage, subscribeChat, unsubscribeChat]);

    return (
        <ChatRealtimeContext.Provider value={value}>
            {children}
        </ChatRealtimeContext.Provider>
    );
}

export function useChatRealtime() {
    const context = useContext(ChatRealtimeContext);
    if (!context) throw new Error('useChatRealtime must be used within ChatRealtimeProvider');
    return context;
}
