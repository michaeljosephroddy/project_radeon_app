import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const CHAT_MESSAGES_STALE_TIME = 1000 * 15;

export function useChatMessages(chatId: string, limit = 50, enabled = true) {
    return useInfiniteQuery({
        queryKey: queryKeys.chatMessages(chatId),
        queryFn: ({ pageParam }) => api.getMessages(chatId, {
            before: pageParam as string | undefined,
            limit,
        }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_before ?? undefined,
        staleTime: CHAT_MESSAGES_STALE_TIME,
        enabled: enabled && Boolean(chatId),
    });
}
