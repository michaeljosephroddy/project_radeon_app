import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as api from '../../../api/client';

export interface ChatThreadCurrentUser {
    id: string;
    username: string;
    avatar_url?: string;
}

export interface MessageMutation {
    kind: 'replace' | 'append' | 'prepend' | 'remove';
    version: number;
}

interface UseChatThreadControllerParams {
    chatId: string;
    currentUser?: ChatThreadCurrentUser;
}

export function useChatThreadController({
    chatId,
    currentUser,
}: UseChatThreadControllerParams) {
    const [messages, setMessages] = useState<api.Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextBefore, setNextBefore] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [mutation, setMutation] = useState<MessageMutation>({ kind: 'replace', version: 0 });
    const requestIdRef = useRef(0);

    const syncReadState = useCallback(async (lastReadMessageId?: string) => {
        try {
            await api.markChatRead(chatId, lastReadMessageId);
        } catch {
            // Read-state sync is best-effort and should not interrupt the thread UI.
        }
    }, [chatId]);

    const markMutation = useCallback((kind: MessageMutation['kind']) => {
        setMutation(prev => ({ kind, version: prev.version + 1 }));
    }, []);

    const loadInitialMessages = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setLoading(true);
        setLoadError(null);

        try {
            const data = await api.getMessages(chatId, { limit: 50 });
            if (requestId !== requestIdRef.current) return;
            setMessages(data.items ?? []);
            setHasMore(data.has_more);
            setNextBefore(data.next_before ?? null);
            markMutation('replace');
            const latestMessage = (data.items ?? [])[data.items.length - 1];
            void syncReadState(latestMessage?.id);
        } catch {
            if (requestId !== requestIdRef.current) return;
            setMessages([]);
            setHasMore(false);
            setNextBefore(null);
            setLoadError('Could not load messages.');
            markMutation('replace');
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [chatId, markMutation, syncReadState]);

    useEffect(() => {
        setMessages([]);
        setHasMore(false);
        setNextBefore(null);
        setMutation({ kind: 'replace', version: 0 });
        loadInitialMessages();
    }, [chatId, loadInitialMessages]);

    const sendMessage = useCallback(async (rawBody: string) => {
        const body = rawBody.trim();
        if (!body || !currentUser) return;

        const optimisticMessage: api.Message = {
            id: `optimistic-${chatId}-${Date.now()}`,
            sender_id: currentUser.id,
            username: currentUser.username,
            avatar_url: currentUser.avatar_url,
            body,
            sent_at: new Date().toISOString(),
        };

        setSending(true);
        setMessages(current => [...current, optimisticMessage]);
        markMutation('append');

        try {
            const { id } = await api.sendMessage(chatId, body);
            setMessages(current => current.map(message => (
                message.id === optimisticMessage.id
                    ? { ...optimisticMessage, id }
                    : message
            )));
            void syncReadState(id);
        } catch {
            setMessages(current => current.filter(message => message.id !== optimisticMessage.id));
            markMutation('remove');
            Alert.alert('Message failed', 'Your message could not be sent.');
        } finally {
            setSending(false);
        }
    }, [chatId, currentUser, markMutation, syncReadState]);

    const loadOlderMessages = useCallback(async () => {
        if (!nextBefore || loadingOlder) return;
        const requestId = requestIdRef.current;

        setLoadingOlder(true);

        try {
            const page = await api.getMessages(chatId, { before: nextBefore, limit: 50 });
            if (requestId !== requestIdRef.current) return;
            setMessages(current => [...(page.items ?? []), ...current]);
            setHasMore(page.has_more);
            setNextBefore(page.next_before ?? null);
            markMutation('prepend');
        } finally {
            if (requestId === requestIdRef.current) setLoadingOlder(false);
        }
    }, [chatId, loadingOlder, markMutation, nextBefore]);

    return {
        messages,
        loading,
        loadError,
        loadingOlder,
        hasMore,
        sending,
        mutation,
        sendMessage,
        loadOlderMessages,
        reloadMessages: loadInitialMessages,
    };
}
