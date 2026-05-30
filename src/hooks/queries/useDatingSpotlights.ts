import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

export function useDatingSpotlights(enabled = true) {
    return useQuery({
        queryKey: queryKeys.datingSpotlights(),
        queryFn: () => api.getDatingSpotlightStatus(),
        enabled,
    });
}

export function useActivateDatingSpotlight() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (kind: api.DatingSpotlightKind) => api.activateDatingSpotlight(kind),
        onSuccess: (status) => {
            queryClient.setQueryData(queryKeys.datingSpotlights(), status);
            void queryClient.invalidateQueries({ queryKey: ['dating-discover'] });
            void queryClient.invalidateQueries({ queryKey: ['dating-discover-preview'] });
        },
    });
}
