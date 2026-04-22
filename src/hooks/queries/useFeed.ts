import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const FEED_STALE_TIME = 1000 * 30;

export function useFeed(limit = 20, enabled = true) {
    return useInfiniteQuery({
        queryKey: queryKeys.feed(limit),
        queryFn: ({ pageParam }) => api.getFeed(pageParam as string | undefined, limit),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: FEED_STALE_TIME,
        enabled,
    });
}
