import { useQuery } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

export function useFriends(enabled = true, limit = 100) {
    return useQuery({
        queryKey: ['friends', { limit }],
        queryFn: async () => {
            const page = await api.getFriends(undefined, limit);
            return page.items ?? [];
        },
        staleTime: 1000 * 60 * 5,
        enabled,
    });
}
