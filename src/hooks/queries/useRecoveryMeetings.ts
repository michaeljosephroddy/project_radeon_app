import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
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

export function useRecoveryMeeting(meetingId: string | null | undefined, enabled = true) {
    return useQuery({
        queryKey: queryKeys.recoveryMeeting(meetingId ?? ''),
        queryFn: () => api.getRecoveryMeeting(meetingId ?? ''),
        staleTime: RECOVERY_MEETINGS_STALE_TIME,
        enabled: enabled && Boolean(meetingId),
    });
}

export function useRecoveryMeetingFilterOptions(
    params: api.RecoveryMeetingFilterOptionParams,
    enabled = true,
) {
    const normalizedQuery = params.q.trim();
    const limit = params.limit ?? 10;
    return useQuery({
        queryKey: queryKeys.recoveryMeetingFilterOptions({
            level: params.level,
            query: normalizedQuery,
            country: params.country,
            region: params.region,
            fellowship: params.fellowship,
            limit,
        }),
        queryFn: () => api.getRecoveryMeetingFilterOptions({ ...params, q: normalizedQuery, limit }),
        staleTime: RECOVERY_MEETINGS_STALE_TIME,
        enabled: enabled && normalizedQuery.length >= 2,
    });
}

export function useRecoveryMeetingLocationSuggestions(
    query: string,
    params?: { country?: string; region?: string; fellowship?: string; limit?: number },
    enabled = true,
) {
    const normalizedQuery = query.trim();
    const limit = params?.limit ?? 8;
    return useQuery({
        queryKey: queryKeys.recoveryMeetingLocationSuggestions({
            query: normalizedQuery,
            country: params?.country,
            region: params?.region,
            fellowship: params?.fellowship,
            limit,
        }),
        queryFn: () => api.getRecoveryMeetingLocationSuggestions(normalizedQuery, { ...params, limit }),
        staleTime: RECOVERY_MEETINGS_STALE_TIME,
        enabled: enabled && normalizedQuery.length >= 2 && Boolean(params?.country?.trim()),
    });
}

export function useRecoveryMeetingRegionSuggestions(
    query: string,
    params?: { country?: string; fellowship?: string; limit?: number },
    enabled = true,
) {
    const normalizedQuery = query.trim();
    const limit = params?.limit ?? 8;
    return useQuery({
        queryKey: queryKeys.recoveryMeetingRegionSuggestions({
            query: normalizedQuery,
            country: params?.country,
            fellowship: params?.fellowship,
            limit,
        }),
        queryFn: () => api.getRecoveryMeetingRegionSuggestions(normalizedQuery, { ...params, limit }),
        staleTime: RECOVERY_MEETINGS_STALE_TIME,
        enabled: enabled && normalizedQuery.length >= 2 && Boolean(params?.country?.trim()),
    });
}

export function useRecoveryMeetingCountrySuggestions(
    query: string,
    params?: { fellowship?: string; limit?: number },
    enabled = true,
) {
    const normalizedQuery = query.trim();
    const limit = params?.limit ?? 8;
    return useQuery({
        queryKey: queryKeys.recoveryMeetingCountrySuggestions({
            query: normalizedQuery,
            fellowship: params?.fellowship,
            limit,
        }),
        queryFn: () => api.getRecoveryMeetingCountrySuggestions(normalizedQuery, { ...params, limit }),
        staleTime: RECOVERY_MEETINGS_STALE_TIME,
        enabled: enabled && normalizedQuery.length >= 2,
    });
}
