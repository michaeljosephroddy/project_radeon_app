import { InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';
import { dedupeById } from '../../utils/list';

const DATING_MATCHES_STALE_TIME = 1000 * 30;

export function useDatingMatches(params: { limit?: number } = {}, enabled = true) {
    const limit = params.limit ?? 20;
    const queryKey = queryKeys.datingMatches({ limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    const query = useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam, signal }) => api.listDatingMatches({
            cursor: pageParam as string | undefined,
            limit,
            signal,
        }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: DATING_MATCHES_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
        placeholderData: (previousData) => previousData,
    });

    const matches = useMemo(
        () => dedupeById((query.data?.pages ?? []).flatMap((page) => page.items ?? [])),
        [query.data?.pages],
    );
    const unseenCount = query.data?.pages[0]?.unseen_count ?? 0;

    return {
        ...query,
        matches,
        unseenCount,
    };
}

export function useMarkDatingMatchesSeen() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: api.markDatingMatchesSeen,
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey: ['dating-matches'] });
            queryClient.setQueriesData<InfiniteData<api.DatingMatchesPage>>({ queryKey: ['dating-matches'] }, (current) => {
                if (!current) return current;
                return {
                    ...current,
                    pages: current.pages.map((page) => ({ ...page, unseen_count: 0 })),
                };
            });
        },
        onSettled: () => {
            void queryClient.invalidateQueries({ queryKey: ['dating-matches'] });
        },
    });
}

export function useUnmatchDatingMatch() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (matchId: string) => api.unmatchDatingMatch(matchId),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['dating-matches'] });
            void queryClient.invalidateQueries({ queryKey: ['dating-discover'] });
            void queryClient.invalidateQueries({ queryKey: ['chats'] });
        },
    });
}
