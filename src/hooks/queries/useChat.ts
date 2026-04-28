import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const CHAT_STALE_TIME = 1000 * 15;

export function useChat(chatId: string, initialData?: api.Chat) {
    return useQuery({
        queryKey: queryKeys.chat(chatId),
        queryFn: () => api.getChat(chatId),
        enabled: Boolean(chatId),
        initialData,
        staleTime: CHAT_STALE_TIME,
    });
}
