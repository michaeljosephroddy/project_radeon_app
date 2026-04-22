import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const MEETUPS_STALE_TIME = 1000 * 60 * 3;

export function useMeetups(params: { q?: string; city?: string; limit?: number }, enabled = true) {
    const limit = params.limit ?? 20;
    return useInfiniteQuery({
        queryKey: queryKeys.meetups({ q: params.q, city: params.city, limit }),
        queryFn: ({ pageParam }) => api.getMeetups({
            q: params.q,
            city: params.city,
            page: pageParam as number | undefined,
            limit,
        }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.page + 1 : undefined,
        staleTime: MEETUPS_STALE_TIME,
        enabled,
    });
}

export function useMyMeetups(limit = 20, enabled = true) {
    return useInfiniteQuery({
        queryKey: queryKeys.myMeetups({ limit }),
        queryFn: ({ pageParam }) => api.getMyMeetups(pageParam as number | undefined, limit),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.page + 1 : undefined,
        staleTime: MEETUPS_STALE_TIME,
        enabled,
    });
}
