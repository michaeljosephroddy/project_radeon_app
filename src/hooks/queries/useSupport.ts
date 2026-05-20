import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';

const SUPPORT_REQUESTS_STALE_TIME = 1000 * 30;

export function useSupportRequests(filter: api.SupportRequestFilter = 'all', limit = 20, enabled = true) {
    const queryKey = queryKeys.supportRequests({ scope: 'open', filter, limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.getSupportRequests(filter, pageParam as string | undefined, limit),
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

export function useSupportOffers(
    requestId: string | null,
    status: api.SupportOfferStatusFilter = 'pending',
    limit = 25,
    enabled = true,
) {
    const queryKey = queryKeys.supportOffers(requestId ?? '', { status, limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.getSupportOffers(requestId ?? '', {
            page: pageParam as number,
            limit,
            status,
        }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.page + 1 : undefined,
        staleTime: SUPPORT_REQUESTS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled: enabled && Boolean(requestId),
    });
}

export function useSupportReplies(requestId: string | null, limit = 25, enabled = true) {
    const queryKey = queryKeys.supportReplies(requestId ?? '', { limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.getSupportReplies(requestId ?? '', pageParam as string | undefined, limit),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: SUPPORT_REQUESTS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled: enabled && Boolean(requestId),
    });
}
