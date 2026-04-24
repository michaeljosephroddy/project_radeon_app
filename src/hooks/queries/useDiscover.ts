import { useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { getInfiniteQueryPolicy } from '../../query/queryPolicies';
import { queryKeys } from '../../query/queryKeys';

const DISCOVER_STALE_TIME = 1000 * 60;

export function useDiscover(params: {
    query?: string;
    city?: string;
    gender?: string;
    ageMin?: number;
    ageMax?: number;
    distanceKm?: number;
    sobriety?: string;
    lat?: number;
    lng?: number;
    limit?: number;
}, enabled = true) {
    const limit = params.limit ?? 20;
    const queryKey = queryKeys.discover({
        query: params.query,
        city: params.city,
        gender: params.gender,
        ageMin: params.ageMin,
        ageMax: params.ageMax,
        distanceKm: params.distanceKm,
        sobriety: params.sobriety,
        lat: params.lat,
        lng: params.lng,
        limit,
    });
    const policy = getInfiniteQueryPolicy(queryKey);

    return useInfiniteQuery({
        queryKey,
        queryFn: ({ pageParam }) => api.discoverUsers({
            query: params.query,
            city: params.city,
            gender: params.gender,
            ageMin: params.ageMin,
            ageMax: params.ageMax,
            distanceKm: params.distanceKm,
            sobriety: params.sobriety,
            lat: params.lat,
            lng: params.lng,
            page: pageParam as number | undefined,
            limit,
        }),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.page + 1 : undefined,
        staleTime: DISCOVER_STALE_TIME,
        refetchOnMount: policy?.refetchOnMount,
        enabled,
    });
}
