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

    const syncReadState = useCallback(async (lastReadMessageId?: string) => {
        try {
            await api.markChatRead(chatId, lastReadMessageId);
        } catch {
            // Read-state sync is best-effort and should not interrupt the thread UI.
        }
    }, [chatId]);

    const markMutation = useCallback((kind: MessageMutation['kind']) => {
        setMutation((prev) => ({ kind, version: prev.version + 1 }));
    }, []);

    useEffect(() => {
        setMutation({ kind: 'replace', version: 0 });
    }, [chatId]);

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
    }, [chatId, currentUser, syncReadState, updateCachedMessages]);

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
