import { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import * as api from '../api/client';
import { queryKeys } from './queryKeys';

function getChatQueryParams(queryKey: QueryKey): { query?: string; limit?: number } | null {
    if (!Array.isArray(queryKey) || queryKey[0] !== 'chats') return null;
    const params = queryKey[1];
    if (!params || typeof params !== 'object') return {};
    return params as { query?: string; limit?: number };
}

function getChatSearchLabel(chat: api.Chat): string {
    if (chat.is_group) return chat.name?.trim().toLowerCase() ?? '';
    return chat.username?.trim().toLowerCase() ?? '';
}

function chatMatchesQuery(chat: api.Chat, query?: string): boolean {
    const normalizedQuery = query?.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return getChatSearchLabel(chat).includes(normalizedQuery);
}

function sortMessages(messages: api.Message[]): api.Message[] {
    return [...messages].sort((left, right) => {
        const leftSeq = left.chat_seq ?? Number.MAX_SAFE_INTEGER;
        const rightSeq = right.chat_seq ?? Number.MAX_SAFE_INTEGER;
        if (left.chat_seq != null && right.chat_seq != null && leftSeq !== rightSeq) {
            return leftSeq - rightSeq;
        }

        const leftTime = new Date(left.sent_at).getTime();
        const rightTime = new Date(right.sent_at).getTime();
        if (leftTime !== rightTime) return leftTime - rightTime;
        return left.id.localeCompare(right.id);
    });
}

function flattenChatPages(data?: InfiniteData<api.CursorResponse<api.Chat>>): api.Chat[] {
    return data?.pages.flatMap((page) => page.items ?? []) ?? [];
}

export function flattenMessagePages(data?: InfiniteData<api.MessagePage>): api.Message[] {
    const pages = data?.pages ?? [];
    const items = [...pages].reverse().flatMap((page) => page.items ?? []);
    const deduped = new Map<string, api.Message>();
    for (const message of items) {
        deduped.set(message.id, message);
    }
    return sortMessages([...deduped.values()]);
}

export function updateChatPagesData(
    data: InfiniteData<api.CursorResponse<api.Chat>> | undefined,
    chatId: string,
    updater: (chat: api.Chat) => api.Chat,
    moveToFront: boolean,
): InfiniteData<api.CursorResponse<api.Chat>> | undefined {
    if (!data) return data;

    const flattened = flattenChatPages(data);
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
            return { ...page, items };
        }),
    };
}

function upsertChatPageData(
    data: InfiniteData<api.CursorResponse<api.Chat>> | undefined,
    chat: api.Chat,
    query?: string,
): InfiniteData<api.CursorResponse<api.Chat>> | undefined {
    if (!data) return data;
    if (!chatMatchesQuery(chat, query)) return data;

    const flattened = flattenChatPages(data);
    const existingIndex = flattened.findIndex((item) => item.id === chat.id);
    const nextChats = [...flattened];

    if (existingIndex >= 0) {
        nextChats.splice(existingIndex, 1);
    }
    nextChats.unshift(chat);

    if (data.pages.length === 0) {
        return {
            pages: [{ items: [chat], limit: 20, has_more: false, next_cursor: null }],
            pageParams: [undefined],
        };
    }

    let cursor = 0;
    return {
        ...data,
        pages: data.pages.map((page, index) => {
            const count = index === 0
                ? Math.max(page.items?.length ?? 0, 1)
                : (page.items?.length ?? 0);
            const items = nextChats.slice(cursor, cursor + count);
            cursor += count;
            return { ...page, items };
        }),
    };
}

function updateMessagePagesData(
    data: InfiniteData<api.MessagePage> | undefined,
    updater: (messages: api.Message[]) => api.Message[],
): InfiniteData<api.MessagePage> | undefined {
    if (!data) return data;

    const flattened = updater(flattenMessagePages(data));
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

export function updateChatInAllQueries(
    queryClient: QueryClient,
    chatId: string,
    updater: (chat: api.Chat) => api.Chat,
    moveToFront = false,
): void {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: ['chats'] })) {
        queryClient.setQueryData<InfiniteData<api.CursorResponse<api.Chat>>>(
            query.queryKey,
            (current) => updateChatPagesData(current, chatId, updater, moveToFront),
        );
    }
}

export function upsertChatInAllQueries(queryClient: QueryClient, chat: api.Chat): void {
    for (const query of queryClient.getQueryCache().findAll({ queryKey: ['chats'] })) {
        const params = getChatQueryParams(query.queryKey);
        queryClient.setQueryData<InfiniteData<api.CursorResponse<api.Chat>>>(
            query.queryKey,
            (current) => upsertChatPageData(current, chat, params?.query),
        );
    }
}

export function updateChatMessages(
    queryClient: QueryClient,
    chatId: string,
    updater: (messages: api.Message[]) => api.Message[],
): void {
    queryClient.setQueryData<InfiniteData<api.MessagePage>>(
        queryKeys.chatMessages(chatId),
        (current) => updateMessagePagesData(current, updater),
    );
}

export function upsertMessageInCache(
    queryClient: QueryClient,
    chatId: string,
    message: api.Message,
    optimisticId?: string,
): void {
    updateChatMessages(queryClient, chatId, (current) => {
        const nextMessages = [...current];
        const existingIndex = nextMessages.findIndex((item) => (
            item.id === message.id
            || (optimisticId != null && item.id === optimisticId)
            || (
                message.client_message_id != null
                && item.client_message_id != null
                && item.client_message_id === message.client_message_id
            )
        ));

        if (existingIndex >= 0) {
            nextMessages[existingIndex] = {
                ...nextMessages[existingIndex],
                ...message,
            };
        } else {
            nextMessages.push(message);
        }

        return sortMessages(nextMessages);
    });
}

export function removeMessageFromCache(queryClient: QueryClient, chatId: string, messageId: string): void {
    updateChatMessages(queryClient, chatId, (current) => current.filter((message) => message.id !== messageId));
}

export function updateOtherUserLastReadMessageId(
    queryClient: QueryClient,
    chatId: string,
    lastReadMessageId?: string | null,
): void {
    queryClient.setQueryData<InfiniteData<api.MessagePage>>(
        queryKeys.chatMessages(chatId),
        (current) => {
            if (!current) return current;
            const firstPage = current.pages[0];
            if (!firstPage) return current;
            return {
                ...current,
                pages: [
                    {
                        ...firstPage,
                        other_user_last_read_message_id: lastReadMessageId ?? null,
                    },
                    ...current.pages.slice(1),
                ],
            };
        },
    );
}
