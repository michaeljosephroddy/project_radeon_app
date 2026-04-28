import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as api from '../../../api/client';
import { useChatRealtime } from '../../../hooks/chat/ChatRealtimeProvider';
import { useChatMessages } from '../../../hooks/queries/useChatMessages';
import {
    flattenMessagePages,
    removeMessageFromCache,
    updateChatInAllQueries,
    updateChatMessages,
    upsertMessageInCache,
} from '../../../query/chatCache';

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

const lastSyncedReadMessageIds = new Map<string, string>();
const lastSeenMessageIds = new Map<string, string>();

function resolveLatestSeenMessageId(
    chatId: string,
    incomingMessageId: string | null,
    messages: api.Message[],
): string | null {
    const currentMessageId = lastSeenMessageIds.get(chatId) ?? null;
    if (!incomingMessageId) return currentMessageId;
    if (!currentMessageId) return incomingMessageId;
    if (incomingMessageId === currentMessageId) return currentMessageId;

    const messageIndexes = new Map(
        messages.map((message, index) => [message.id, index]),
    );
    const incomingIndex = messageIndexes.get(incomingMessageId);
    const currentIndex = messageIndexes.get(currentMessageId);

    if (typeof incomingIndex === 'number' && typeof currentIndex === 'number') {
        return incomingIndex >= currentIndex ? incomingMessageId : currentMessageId;
    }

    if (typeof incomingIndex === 'number') return incomingMessageId;
    if (typeof currentIndex === 'number') return currentMessageId;
    return incomingMessageId;
}

export function useChatThreadController({
    chatId,
    currentUser,
}: UseChatThreadControllerParams) {
    const queryClient = useQueryClient();
    const realtime = useChatRealtime();
    const [sending, setSending] = useState(false);
    const [mutation, setMutation] = useState<MessageMutation>({ kind: 'replace', version: 0 });
    const messagesQuery = useChatMessages(chatId, 50, Boolean(chatId));
    const messages = useMemo(
        () => flattenMessagePages(messagesQuery.data),
        [messagesQuery.data],
    );
    const incomingOtherUserLastReadMessageId = messagesQuery.data?.pages[0]?.other_user_last_read_message_id ?? null;
    const otherUserLastReadMessageId = useMemo(
        () => resolveLatestSeenMessageId(chatId, incomingOtherUserLastReadMessageId, messages),
        [chatId, incomingOtherUserLastReadMessageId, messages],
    );

    const updateChatListEntry = useCallback((
        updater: (chat: api.Chat) => api.Chat,
        moveToFront = false,
    ) => {
        updateChatInAllQueries(queryClient, chatId, updater, moveToFront);
    }, [chatId, queryClient]);

    const syncReadState = useCallback(async (lastReadMessageId?: string) => {
        if (!lastReadMessageId) return;
        if (lastSyncedReadMessageIds.get(chatId) === lastReadMessageId) return;

        try {
            const sentOverRealtime = realtime.markRead(chatId, lastReadMessageId);
            if (!sentOverRealtime) {
                await api.markChatRead(chatId, lastReadMessageId);
            }
            lastSyncedReadMessageIds.set(chatId, lastReadMessageId);
            updateChatListEntry(
                (chat) => ({
                    ...chat,
                    unread_count: 0,
                }),
            );
        } catch {
            // Read-state sync is best-effort and should not interrupt the thread UI.
        }
    }, [chatId, realtime, updateChatListEntry]);

    const markMutation = useCallback((kind: MessageMutation['kind']) => {
        setMutation((prev) => ({ kind, version: prev.version + 1 }));
    }, []);

    useEffect(() => {
        setMutation({ kind: 'replace', version: 0 });
    }, [chatId]);

    useEffect(() => {
        if (!otherUserLastReadMessageId) return;
        lastSeenMessageIds.set(chatId, otherUserLastReadMessageId);
    }, [chatId, otherUserLastReadMessageId]);

    useEffect(() => {
        if (messages.length === 0) return;
        void syncReadState(messages[messages.length - 1]?.id);
    }, [messages, syncReadState]);

    useEffect(() => {
        if (!chatId) return undefined;
        realtime.subscribeChat(chatId);
        return () => {
            realtime.unsubscribeChat(chatId);
        };
    }, [chatId, realtime]);

    const updateCachedMessages = useCallback((
        updater: (current: api.Message[]) => api.Message[],
        kind: MessageMutation['kind'],
    ) => {
        updateChatMessages(queryClient, chatId, updater);
        markMutation(kind);
    }, [chatId, markMutation, queryClient]);

    const sendMessage = useCallback(async (rawBody: string) => {
        const body = rawBody.trim();
        if (!body || !currentUser) return;
        const clientMessageId = `client-${chatId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const optimisticId = `optimistic-${chatId}-${Date.now()}`;

        const optimisticMessage: api.Message = {
            id: optimisticId,
            chat_id: chatId,
            sender_id: currentUser.id,
            username: currentUser.username,
            avatar_url: currentUser.avatar_url,
            kind: 'user',
            body,
            sent_at: new Date().toISOString(),
            client_message_id: clientMessageId,
        };

        setSending(true);
        updateChatListEntry(
            (chat) => ({
                ...chat,
                last_message: body,
                last_message_at: optimisticMessage.sent_at,
                unread_count: 0,
            }),
            true,
        );
        updateCachedMessages(
            (current) => [...current, optimisticMessage],
            'append',
        );

        try {
            if (realtime.isConnected) {
                const ack = await realtime.sendMessage({
                    chatId,
                    body,
                    clientMessageId,
                    optimisticId,
                });
                void syncReadState(ack.message.id);
            } else {
                const { id } = await api.sendMessage(chatId, body);
                upsertMessageInCache(queryClient, chatId, {
                    ...optimisticMessage,
                    id,
                }, optimisticId);
                markMutation('replace');
                void syncReadState(id);
            }
        } catch (error: unknown) {
            removeMessageFromCache(queryClient, chatId, optimisticId);
            markMutation('remove');
            Alert.alert(
                'Message failed',
                error instanceof Error ? error.message : 'Your message could not be sent.',
            );
        } finally {
            setSending(false);
        }
    }, [chatId, currentUser, markMutation, queryClient, realtime, syncReadState, updateCachedMessages, updateChatListEntry]);

    const loadOlderMessages = useCallback(async () => {
        if (!messagesQuery.hasNextPage || messagesQuery.isFetchingNextPage) return;
        await messagesQuery.fetchNextPage();
        markMutation('prepend');
    }, [markMutation, messagesQuery]);

    const reloadMessages = useCallback(async () => {
        await messagesQuery.refetch();
        markMutation('replace');
    }, [markMutation, messagesQuery]);

    return {
        messages,
        otherUserLastReadMessageId,
        loading: messagesQuery.isLoading,
        loadError: messagesQuery.isError ? 'Could not load messages.' : null,
        loadingOlder: messagesQuery.isFetchingNextPage,
        hasMore: messagesQuery.hasNextPage ?? false,
        sending,
        mutation,
        sendMessage,
        loadOlderMessages,
        reloadMessages,
    };
}
