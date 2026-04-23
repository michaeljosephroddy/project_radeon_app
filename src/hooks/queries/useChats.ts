import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';

const CHATS_STALE_TIME = 1000 * 30;

export function useChats(params: { query?: string; limit?: number }, enabled = true) {
    const limit = params.limit ?? 20;
    const queryKey = queryKeys.chats({ query: params.query, limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.getChats({
            query: params.query,
            page: pageParam as number | undefined,
            limit,
        }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.page + 1 : undefined,
        staleTime: CHATS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
    });
}
