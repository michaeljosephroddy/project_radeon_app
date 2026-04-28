import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';

const SUPPORT_REQUESTS_STALE_TIME = 1000 * 30;

export function useSupportRequests(channel: 'immediate' | 'community', limit = 20, enabled = true) {
    const queryKey = queryKeys.supportRequests({ scope: 'open', channel, limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.getSupportRequests(channel, pageParam as string | undefined, limit),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: SUPPORT_REQUESTS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
    });
}

export function useMySupportRequests(limit = 20, enabled = true) {
    const queryKey = queryKeys.supportRequests({ scope: 'mine', limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.getMySupportRequests(pageParam as string | undefined, limit),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: SUPPORT_REQUESTS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
    });
}
