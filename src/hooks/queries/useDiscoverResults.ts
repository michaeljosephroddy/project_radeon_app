import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';
import { dedupeById } from '../../utils/list';
import { useMemo } from 'react';

const DISCOVER_STALE_TIME = 1000 * 60;

interface UseDiscoverResultsParams extends api.DiscoverFiltersPayload {
    mode: 'suggested' | 'search' | 'filtered';
    query?: string;
    city?: string;
    lat?: number;
    lng?: number;
    limit?: number;
}

export function useDiscoverResults(params: UseDiscoverResultsParams, enabled = true) {
    const limit = params.limit ?? 20;
    const queryKey = params.mode === 'search'
        ? queryKeys.discoverSearch({
            query: params.query,
            city: params.city,
            gender: params.gender,
            ageMin: params.ageMin,
            ageMax: params.ageMax,
            distanceKm: params.distanceKm,
            sobriety: params.sobriety,
            interests: params.interests,
            lat: params.lat,
            lng: params.lng,
            limit,
        })
        : params.mode === 'filtered'
            ? queryKeys.discoverFiltered({
                city: params.city,
                gender: params.gender,
                ageMin: params.ageMin,
                ageMax: params.ageMax,
                distanceKm: params.distanceKm,
                sobriety: params.sobriety,
                interests: params.interests,
                lat: params.lat,
                lng: params.lng,
                limit,
            })
            : queryKeys.discoverSuggested({
                lat: params.lat,
                lng: params.lng,
                limit,
            });
    const policy = getInfiniteQueryPolicy(queryKey);

    const query = useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam, signal }) => api.discoverUsers({
            query: params.query,
            city: params.city,
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
        staleTime: DISCOVER_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
        placeholderData: params.mode === 'search' ? undefined : (previousData) => previousData,
    });

    const users = useMemo(
        () => dedupeById(
            (query.data?.pages ?? [])
                .flatMap((page) => page.items ?? [])
                .filter((item) => item.friendship_status !== 'self'),
        ),
        [query.data?.pages],
    );

    return {
        ...query,
        users,
    };
}
