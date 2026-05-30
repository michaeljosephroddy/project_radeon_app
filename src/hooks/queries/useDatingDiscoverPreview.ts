import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const DATING_DISCOVER_PREVIEW_STALE_TIME = 1000 * 15;

interface UseDatingDiscoverPreviewParams extends api.DiscoverFiltersPayload {
    lat?: number;
    lng?: number;
}

export function useDatingDiscoverPreview(params: UseDatingDiscoverPreviewParams, enabled = true) {
    return useQuery({
        queryKey: queryKeys.datingDiscoverPreview({
            gender: params.gender,
            ageMin: params.ageMin,
            ageMax: params.ageMax,
            distanceKm: params.distanceKm,
            sobriety: params.sobriety,
            interests: params.interests,
            lat: params.lat,
            lng: params.lng,
        }),
        queryFn: () => api.previewDatingDiscover(params),
        staleTime: DATING_DISCOVER_PREVIEW_STALE_TIME,
        enabled,
    });
}
