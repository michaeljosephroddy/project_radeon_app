import { useEffect, useRef } from 'react';

interface RefetchableQuery {
    dataUpdatedAt: number;
    isFetching: boolean;
    isLoading: boolean;
    isStale: boolean;
    refetch: () => Promise<unknown>;
}

export function useRefetchOnActiveIfStale(isActive: boolean, query: RefetchableQuery): void {
    const wasActiveRef = useRef(isActive);

    useEffect(() => {
        const wasActive = wasActiveRef.current;
        wasActiveRef.current = isActive;

        if (!isActive || wasActive) return;
        if (!query.isStale || query.isFetching || query.isLoading) return;
        if (query.dataUpdatedAt === 0) return;

        void query.refetch();
    }, [
        isActive,
        query.dataUpdatedAt,
        query.isFetching,
        query.isLoading,
        query.isStale,
        query.refetch,
    ]);
}
