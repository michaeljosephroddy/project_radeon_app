import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const INTERESTS_STALE_TIME = 1000 * 60 * 60 * 24;

export function useInterests(enabled = true) {
    return useQuery({
        queryKey: queryKeys.interests(),
        queryFn: api.getInterests,
        staleTime: INTERESTS_STALE_TIME,
        enabled,
    });
}
