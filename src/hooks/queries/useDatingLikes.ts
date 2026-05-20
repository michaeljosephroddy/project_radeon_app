import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';
import { dedupeById } from '../../utils/list';

const DATING_LIKES_STALE_TIME = 1000 * 30;

export function useDatingLikes(params: { limit?: number } = {}, enabled = true) {
    const limit = params.limit ?? 20;
    const queryKey = queryKeys.datingLikes({ limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    const query = useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam, signal }) => api.listDatingLikes({
            cursor: pageParam as string | undefined,
            limit,
            signal,
        }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: DATING_LIKES_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
        placeholderData: (previousData) => previousData,
    });

    const users = useMemo(
        () => dedupeById((query.data?.pages ?? []).flatMap((page) => page.items ?? [])),
        [query.data?.pages],
    );

    return {
        ...query,
        users,
    };
}
