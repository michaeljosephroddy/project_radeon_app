import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';

const RECOVERY_MEETINGS_STALE_TIME = 1000 * 60 * 10;

export function useRecoveryMeetings(params: api.RecoveryMeetingFilters & { limit?: number }, enabled = true) {
    const limit = params.limit ?? 20;
    const queryKey = queryKeys.recoveryMeetings({ ...params, limit });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam, signal }) => api.getRecoveryMeetings({
            ...params,
            cursor: pageParam as string | undefined,
            limit,
            signal,
        }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: RECOVERY_MEETINGS_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
    });
}
