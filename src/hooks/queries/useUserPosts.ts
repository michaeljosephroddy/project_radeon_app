import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';

const USER_POSTS_STALE_TIME = 1000 * 60;

export function useUserPosts(userId: string, limit = 20, enabled = true) {
    const isEnabled = enabled && Boolean(userId);
    const queryKey = queryKeys.userPosts(userId, limit);
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.getUserPosts(userId, pageParam as string | undefined, limit),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: USER_POSTS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled: isEnabled,
    });
}
