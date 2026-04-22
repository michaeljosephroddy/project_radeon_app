import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const USER_POSTS_STALE_TIME = 1000 * 60 * 2;

export function useUserPosts(userId: string, limit = 20, enabled = true) {
    return useInfiniteQuery({
        queryKey: queryKeys.userPosts(userId, limit),
        queryFn: ({ pageParam }) => api.getUserPosts(userId, pageParam as string | undefined, limit),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: USER_POSTS_STALE_TIME,
        enabled: enabled && Boolean(userId),
    });
}
