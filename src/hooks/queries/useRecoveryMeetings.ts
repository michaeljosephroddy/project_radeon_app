import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryClient } from '../../query/queryClient';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';

const RECOVERY_MEETINGS_STALE_TIME = 1000 * 60 * 30;

export function useRecoveryMeetings(params: api.RecoveryMeetingFilters & { limit?: number }, enabled = true) {
    const limit = params.limit ?? 20;
    const queryKey = queryKeys.recoveryMeetings({ ...params, limit });
    const policy = getInfiniteQueryPolicy(queryKey);
    const hasExplicitLocation = Boolean(
        params.place_id
        || params.location
        || params.city
        || params.country
        || params.region
    );

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam, signal }) => api.getRecoveryMeetings({
            ...params,
            cursor: pageParam as string | undefined,
            limit,
            signal,
        }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage: api.CursorResponse<api.RecoveryMeeting>) => lastPage.next_cursor ?? undefined,
        staleTime: RECOVERY_MEETINGS_STALE_TIME,
        placeholderData: hasExplicitLocation ? undefined : keepPreviousData,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
    });
}

export async function prefetchRecoveryMeetings(params: api.RecoveryMeetingFilters & { limit?: number }): Promise<void> {
    const limit = params.limit ?? 20;
    await queryClient.prefetchInfiniteQuery({
        queryKey: queryKeys.recoveryMeetings({ ...params, limit }),
        queryFn: ({ pageParam, signal }) => api.getRecoveryMeetings({
            ...params,
            cursor: pageParam as string | undefined,
            limit,
            signal,
        }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage: api.CursorResponse<api.RecoveryMeeting>) => lastPage.next_cursor ?? undefined,
        staleTime: RECOVERY_MEETINGS_STALE_TIME,
    });
}

export function useRecoveryMeeting(meetingId: string | null | undefined, enabled = true) {
    return useQuery({
        queryKey: queryKeys.recoveryMeeting(meetingId ?? ''),
        queryFn: () => api.getRecoveryMeeting(meetingId ?? ''),
        staleTime: RECOVERY_MEETINGS_STALE_TIME,
        enabled: enabled && Boolean(meetingId),
    });
}

export function usePlaceAutocomplete(
    query: string,
    params?: { country_code?: string; limit?: number },
    enabled = true,
) {
    const normalizedQuery = query.trim();
    const limit = params?.limit ?? 8;
    return useQuery({
        queryKey: queryKeys.placeAutocomplete({
            query: normalizedQuery,
            country_code: params?.country_code,
            limit,
        }),
        queryFn: ({ signal }) => api.getPlaceAutocomplete(normalizedQuery, { ...params, limit, signal }),
        staleTime: RECOVERY_MEETINGS_STALE_TIME,
        enabled: enabled && normalizedQuery.length >= 2,
    });
}
