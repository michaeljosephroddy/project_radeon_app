import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const DATING_LIKES_PREVIEW_STALE_TIME = 1000 * 30;

export function useDatingLikesPreview(enabled = true) {
    return useQuery({
        queryKey: queryKeys.datingLikesPreview(),
        queryFn: () => api.previewDatingLikes(),
        staleTime: DATING_LIKES_PREVIEW_STALE_TIME,
        enabled,
    });
}
