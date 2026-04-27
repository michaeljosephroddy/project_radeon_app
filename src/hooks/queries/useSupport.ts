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

export function useSupportHome(enabled = true) {
    return useQuery({
        queryKey: queryKeys.supportHome(),
        queryFn: () => api.getSupportHome(),
        staleTime: SUPPORT_REQUESTS_STALE_TIME,
        enabled,
    });
}

export function useSupportResponderProfile(enabled = true) {
    return useQuery({
        queryKey: queryKeys.supportResponderProfile(),
        queryFn: () => api.getMySupportResponderProfile(),
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

export function useRespondedSupportRequests(limit = 20, enabled = true) {
    const queryKey = queryKeys.supportRequests({ scope: 'responded', limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.getRespondedSupportRequests(pageParam as string | undefined, limit),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: SUPPORT_REQUESTS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
    });
}

export function useSupportQueue(limit = 20, enabled = true) {
    const queryKey = queryKeys.supportQueue({ limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.getSupportQueue(pageParam as string | undefined, limit),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: SUPPORT_REQUESTS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
    });
}

export function useSupportSessions(limit = 20, enabled = true) {
    const queryKey = queryKeys.supportSessions({ limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.getSupportSessions(pageParam as string | undefined, limit),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: SUPPORT_REQUESTS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
    });
}
