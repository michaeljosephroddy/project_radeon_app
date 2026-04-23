import { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import type { PersistedClient } from '@tanstack/query-persist-client-core';
import { getInfiniteQueryPolicy } from './queryPolicies';

interface InfiniteQueryDataShape<TData = unknown, TPageParam = unknown> extends InfiniteData<TData, TPageParam> {
    pages: TData[];
    pageParams: TPageParam[];
}

function isInfiniteQueryData(value: unknown): value is InfiniteQueryDataShape {
    if (!value || typeof value !== 'object') return false;

    const candidate = value as Partial<InfiniteQueryDataShape>;
    return Array.isArray(candidate.pages) && Array.isArray(candidate.pageParams);
}

function trimInfiniteQueryData<TData, TPageParam>(
    data: InfiniteQueryDataShape<TData, TPageParam>,
    maxPages: number,
): InfiniteQueryDataShape<TData, TPageParam> {
    if (data.pages.length <= maxPages) return data;

    return {
        ...data,
        pages: data.pages.slice(0, maxPages),
        pageParams: data.pageParams.slice(0, maxPages),
    };
}

function trimInfiniteQueryCacheEntry(queryKey: QueryKey, data: unknown, maxPages: number | undefined): unknown {
    if (!maxPages || !isInfiniteQueryData(data)) return data;
    return trimInfiniteQueryData(data, maxPages);
}

export function trimPersistedInfiniteQueries(client: PersistedClient): PersistedClient {
    return {
        ...client,
        clientState: {
            ...client.clientState,
            queries: client.clientState.queries.map((query) => ({
                ...query,
                state: {
                    ...query.state,
                    data: trimInfiniteQueryCacheEntry(
                        query.queryKey,
                        query.state.data,
                        getInfiniteQueryPolicy(query.queryKey)?.persistedPages,
                    ),
                },
            })),
        },
    };
}

export function resetInfiniteQueryToFirstPage(queryClient: QueryClient, queryKey: QueryKey): void {
    queryClient.setQueryData(queryKey, (current: unknown) => {
        if (!isInfiniteQueryData(current)) return current;
        if (current.pages.length <= 1) return current;

        return {
            ...current,
            pages: current.pages.slice(0, 1),
            pageParams: current.pageParams.slice(0, 1),
        };
    });
}
