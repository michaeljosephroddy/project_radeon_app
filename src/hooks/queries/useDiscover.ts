import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const DISCOVER_STALE_TIME = 1000 * 60 * 2;

export function useDiscover(params: { query?: string; city?: string; limit?: number }, enabled = true) {
    const limit = params.limit ?? 20;
    return useInfiniteQuery({
        queryKey: queryKeys.discover({ query: params.query, city: params.city, limit }),
        queryFn: ({ pageParam }) => api.discoverUsers({
            query: params.query,
            city: params.city,
            page: pageParam as number | undefined,
            limit,
        }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.page + 1 : undefined,
        staleTime: DISCOVER_STALE_TIME,
        enabled,
    });
}
