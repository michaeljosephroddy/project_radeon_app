import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const CHATS_STALE_TIME = 1000 * 20;

export function useChats(params: { query?: string; limit?: number }, enabled = true) {
    const limit = params.limit ?? 20;
    return useInfiniteQuery({
        queryKey: queryKeys.chats({ query: params.query, limit }),
        queryFn: ({ pageParam }) => api.getChats({
            query: params.query,
            page: pageParam as number | undefined,
            limit,
        }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.page + 1 : undefined,
        staleTime: CHATS_STALE_TIME,
        enabled,
    });
}
