import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';

const MEETUPS_STALE_TIME = 1000 * 60 * 2;

export function useMeetupCategories(enabled = true) {
    return useQuery({
        queryKey: queryKeys.meetupCategories(),
        queryFn: () => api.getMeetupCategories(),
        staleTime: 1000 * 60 * 30,
        enabled,
    });
}

export function useMeetups(params: api.MeetupFilters & { limit?: number }, enabled = true) {
    const limit = params.limit ?? 20;
    const queryKey = queryKeys.meetups({ ...params, limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam, signal }) => api.getMeetups({
            ...params,
            cursor: pageParam as string | undefined,
            limit,
            signal,
        }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: MEETUPS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
    });
}

export function useMyMeetups(scope: api.MyMeetupScope, limit = 20, enabled = true) {
    const queryKey = queryKeys.myMeetups({ scope, limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.getMyMeetups(scope, pageParam as string | undefined, limit),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: MEETUPS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
    });
}
