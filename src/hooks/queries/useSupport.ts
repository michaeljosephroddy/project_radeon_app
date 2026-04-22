import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const SUPPORT_STALE_TIME = 1000 * 10;

export function useSupportProfile(enabled = true) {
    return useQuery({
        queryKey: queryKeys.supportProfile(),
        queryFn: () => api.getMySupportProfile(),
        staleTime: SUPPORT_STALE_TIME,
        enabled,
    });
}

export function useSupportRequests(limit = 20, enabled = true) {
    return useInfiniteQuery({
        queryKey: queryKeys.supportRequests({ scope: 'open', limit }),
        queryFn: ({ pageParam }) => api.getSupportRequests(pageParam as string | undefined, limit),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: SUPPORT_STALE_TIME,
        enabled,
    });
}

export function useMySupportRequests(limit = 20, enabled = true) {
    return useInfiniteQuery({
        queryKey: queryKeys.supportRequests({ scope: 'mine', limit }),
        queryFn: ({ pageParam }) => api.getMySupportRequests(pageParam as string | undefined, limit),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: SUPPORT_STALE_TIME,
        enabled,
    });
}
