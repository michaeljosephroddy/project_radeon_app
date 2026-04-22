import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const USER_PROFILE_STALE_TIME = 1000 * 60 * 5;

export function useUserProfile(userId: string, enabled = true) {
    return useQuery({
        queryKey: queryKeys.user(userId),
        queryFn: () => api.getUser(userId),
        staleTime: USER_PROFILE_STALE_TIME,
        enabled: enabled && Boolean(userId),
    });
}
