import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';

const SUPPORT_PROFILE_STALE_TIME = 1000 * 60;
const SUPPORT_REQUESTS_STALE_TIME = 1000 * 30;

export function useSupportProfile(enabled = true) {
    return useQuery({
        queryKey: queryKeys.supportProfile(),
        queryFn: () => api.getMySupportProfile(),
        staleTime: SUPPORT_PROFILE_STALE_TIME,
        enabled,
    });
}

export function useSupportRequests(limit = 20, enabled = true) {
    const queryKey = queryKeys.supportRequests({ scope: 'open', limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.getSupportRequests(pageParam as string | undefined, limit),
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
