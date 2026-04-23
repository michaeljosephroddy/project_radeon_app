import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import * as api from '../../../api/client';
import { useChatMessages } from '../../../hooks/queries/useChatMessages';
import { queryKeys } from '../../../query/queryKeys';

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

function updateChatsQueryData(
    data: InfiniteData<api.PaginatedResponse<api.Chat>> | undefined,
    chatId: string,
    updater: (chat: api.Chat) => api.Chat,
    moveToFront: boolean,
): InfiniteData<api.PaginatedResponse<api.Chat>> | undefined {
    if (!data) return data;

    const flattened = data.pages.flatMap((page) => page.items ?? []);
    const chatIndex = flattened.findIndex((chat) => chat.id === chatId);
    if (chatIndex === -1) return data;

    const nextChats = [...flattened];
    const updatedChat = updater(nextChats[chatIndex]);
    nextChats[chatIndex] = updatedChat;

    if (moveToFront) {
        nextChats.splice(chatIndex, 1);
        nextChats.unshift(updatedChat);
    }

    let cursor = 0;
    return {
        ...data,
        pages: data.pages.map((page) => {
            const count = page.items?.length ?? 0;
            const items = nextChats.slice(cursor, cursor + count);
            cursor += count;

            return {
                ...page,
                items,
            };
        }),
    };
}

function flattenMessages(data?: InfiniteData<api.MessagePage>): api.Message[] {
    const pages = data?.pages ?? [];
    return [...pages]
        .reverse()
        .flatMap((page) => page.items ?? []);
}

function updateMessagePages(
    data: InfiniteData<api.MessagePage> | undefined,
    updater: (messages: api.Message[]) => api.Message[],
): InfiniteData<api.MessagePage> | undefined {
    if (!data) return data;

    const flattened = updater(flattenMessages(data));
    const firstPage = data.pages[0];
    if (!firstPage) return data;

    return {
        ...data,
        pages: [
            { ...firstPage, items: flattened },
            ...data.pages.slice(1).map((page) => ({ ...page, items: [] })),
        ],
    };
}

export function useChatThreadController({
    chatId,
    currentUser,
}: UseChatThreadControllerParams) {
    const queryClient = useQueryClient();
    const [sending, setSending] = useState(false);
    const [mutation, setMutation] = useState<MessageMutation>({ kind: 'replace', version: 0 });
    const messagesQuery = useChatMessages(chatId, 50, Boolean(chatId));
    const messages = useMemo(
        () => flattenMessages(messagesQuery.data),
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
        queryClient.setQueriesData<InfiniteData<api.PaginatedResponse<api.Chat>>>(
            { queryKey: ['chats'] },
            (current) => updateChatsQueryData(current, chatId, updater, moveToFront),
        );
    }, [chatId, queryClient]);

    const syncReadState = useCallback(async (lastReadMessageId?: string) => {
        if (!lastReadMessageId) return;
        if (lastSyncedReadMessageIds.get(chatId) === lastReadMessageId) return;

        try {
            await api.markChatRead(chatId, lastReadMessageId);
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
    }, [chatId, updateChatListEntry]);

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

    const updateCachedMessages = useCallback((
        updater: (current: api.Message[]) => api.Message[],
        kind: MessageMutation['kind'],
    ) => {
        queryClient.setQueryData<InfiniteData<api.MessagePage>>(
            queryKeys.chatMessages(chatId),
            (current) => updateMessagePages(current, updater),
        );
        markMutation(kind);
    }, [chatId, markMutation, queryClient]);

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
            const { id } = await api.sendMessage(chatId, body);
            updateCachedMessages(
                (current) => current.map((message) => (
                    message.id === optimisticMessage.id
                        ? { ...optimisticMessage, id }
                        : message
                )),
                'replace',
            );
            void syncReadState(id);
        } catch {
            updateCachedMessages(
                (current) => current.filter((message) => message.id !== optimisticMessage.id),
                'remove',
            );
            Alert.alert('Message failed', 'Your message could not be sent.');
        } finally {
            setSending(false);
        }
    }, [chatId, currentUser, syncReadState, updateCachedMessages, updateChatListEntry]);

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
