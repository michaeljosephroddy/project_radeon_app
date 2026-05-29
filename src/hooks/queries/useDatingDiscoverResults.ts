import { useInfiniteQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';
import { dedupeById } from '../../utils/list';

const DATING_DISCOVER_STALE_TIME = 1000 * 30;

interface UseDatingDiscoverResultsParams extends Omit<api.DiscoverFiltersPayload, 'intent'> {
    lat?: number;
    lng?: number;
    limit?: number;
}

export function useDatingDiscoverResults(params: UseDatingDiscoverResultsParams, enabled = true) {
    const limit = params.limit ?? 10;
    const queryKey = queryKeys.datingDiscover({
        gender: params.gender,
        ageMin: params.ageMin,
        ageMax: params.ageMax,
        distanceKm: params.distanceKm,
        sobriety: params.sobriety,
        interests: params.interests,
        lat: params.lat,
        lng: params.lng,
        limit,
    });
    const policy = getInfiniteQueryPolicy(queryKey);

    const query = useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam, signal }) => api.discoverDatingUsers({
            gender: params.gender,
            ageMin: params.ageMin,
            ageMax: params.ageMax,
            distanceKm: params.distanceKm,
            sobriety: params.sobriety,
            interests: params.interests,
            lat: params.lat,
            lng: params.lng,
            cursor: pageParam as string | undefined,
            limit,
            signal,
        }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        staleTime: DATING_DISCOVER_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
        placeholderData: (previousData) => previousData,
    });

    const profiles = useMemo(
        () => dedupeById((query.data?.pages ?? []).flatMap((page) => page.items ?? [])),
        [query.data?.pages],
    );

    return {
        ...query,
        profiles,
    };
}
