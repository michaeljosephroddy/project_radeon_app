import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const DISCOVER_PREVIEW_STALE_TIME = 1000 * 15;

interface UseDiscoverPreviewParams extends api.DiscoverFiltersPayload {
    query?: string;
    city?: string;
    lat?: number;
    lng?: number;
}

export function useDiscoverPreview(params: UseDiscoverPreviewParams, enabled = true) {
    return useQuery({
        queryKey: queryKeys.discoverPreview({
            query: params.query,
            city: params.city,
            gender: params.gender,
            intent: params.intent,
            ageMin: params.ageMin,
            ageMax: params.ageMax,
            distanceKm: params.distanceKm,
            sobriety: params.sobriety,
            interests: params.interests,
            lat: params.lat,
            lng: params.lng,
        }),
        queryFn: () => api.previewDiscoverUsers(params),
        staleTime: DISCOVER_PREVIEW_STALE_TIME,
        enabled,
    });
}
