import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';

const RECOVERY_MEETINGS_STALE_TIME = 1000 * 60 * 10;
const LOCAL_MIX_FELLOWSHIPS = ['aa', 'ca', 'na'] as const;

export interface RecoveryMeetingLocalFallback {
    location?: string;
    country?: string;
    label: string;
}

export interface LocalMixedRecoveryMeetings {
    items: api.RecoveryMeeting[];
    fellowshipCounts: Record<string, number>;
}

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
        placeholderData: (previousData) => previousData,
        enabled,
    });
}

export function useLocalMixedRecoveryMeetings(
    fallbacks: RecoveryMeetingLocalFallback[],
    enabled = true,
    limit = 20,
) {
    return useQuery({
        queryKey: queryKeys.recoveryMeetingsLocalMixed({ fallbacks, limit }),
        queryFn: ({ signal }) => loadLocalMixedRecoveryMeetings(fallbacks, limit, signal),
        staleTime: RECOVERY_MEETINGS_STALE_TIME,
        placeholderData: (previousData) => previousData,
        enabled: enabled && fallbacks.length > 0,
    });
}

async function loadLocalMixedRecoveryMeetings(
    fallbacks: RecoveryMeetingLocalFallback[],
    limit: number,
    signal?: AbortSignal,
): Promise<LocalMixedRecoveryMeetings> {
    const perFellowshipLimit = Math.max(6, Math.ceil(limit / LOCAL_MIX_FELLOWSHIPS.length) + 3);
    const localFallbacks = fallbacks.filter((fallback) => Boolean(fallback.location));
    const broadFallbacks = fallbacks.filter((fallback) => !fallback.location);
    const localGroups = await loadLocalMixedFellowshipGroups(localFallbacks, perFellowshipLimit, signal);
    const hasAnyLocalItems = localGroups.some((group) => group.items.length > 0);
    const groups = hasAnyLocalItems
        ? localGroups
        : await loadLocalMixedFellowshipGroups(broadFallbacks, perFellowshipLimit, signal);

    return {
        items: interleaveRecoveryMeetingGroups(groups, limit),
        fellowshipCounts: Object.fromEntries(groups.map((group) => [group.fellowship, group.items.length])),
    };
}

async function loadLocalMixedFellowshipGroups(
    fallbacks: RecoveryMeetingLocalFallback[],
    limit: number,
    signal?: AbortSignal,
): Promise<Array<{ fellowship: string; items: api.RecoveryMeeting[] }>> {
    return Promise.all(LOCAL_MIX_FELLOWSHIPS.map(async (fellowship) => {
        for (const fallback of fallbacks.length ? fallbacks : [{ label: 'All meetings' }]) {
            const page = await api.getRecoveryMeetings({
                fellowship,
                location: fallback.location,
                country: fallback.country,
                limit,
                signal,
            });
            if (page.items.length > 0) {
                return { fellowship, items: page.items };
            }
        }
        return { fellowship, items: [] as api.RecoveryMeeting[] };
    }));
}

function interleaveRecoveryMeetingGroups(
    groups: Array<{ fellowship: string; items: api.RecoveryMeeting[] }>,
    limit: number,
): api.RecoveryMeeting[] {
    const seen = new Set<string>();
    const items: api.RecoveryMeeting[] = [];
    const maxGroupLength = Math.max(0, ...groups.map((group) => group.items.length));
    for (let index = 0; index < maxGroupLength && items.length < limit; index += 1) {
        for (const group of groups) {
            const item = group.items[index];
            if (!item || seen.has(item.id)) {
                continue;
            }
            seen.add(item.id);
            items.push(item);
            if (items.length >= limit) {
                break;
            }
        }
    }
    return items;
}

export function useRecoveryMeeting(meetingId: string | null | undefined, enabled = true) {
    return useQuery({
        queryKey: queryKeys.recoveryMeeting(meetingId ?? ''),
        queryFn: () => api.getRecoveryMeeting(meetingId ?? ''),
        staleTime: RECOVERY_MEETINGS_STALE_TIME,
        enabled: enabled && Boolean(meetingId),
    });
}

export function useRecoveryMeetingLocationSuggestions(
    query: string,
    params?: { country?: string; fellowship?: string; limit?: number },
    enabled = true,
) {
    const normalizedQuery = query.trim();
    const limit = params?.limit ?? 8;
    return useQuery({
        queryKey: queryKeys.recoveryMeetingLocationSuggestions({
            query: normalizedQuery,
            country: params?.country,
            fellowship: params?.fellowship,
            limit,
        }),
        queryFn: () => api.getRecoveryMeetingLocationSuggestions(normalizedQuery, { ...params, limit }),
        staleTime: RECOVERY_MEETINGS_STALE_TIME,
        enabled: enabled && normalizedQuery.length >= 2,
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
