import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

export function useDatingProfile(enabled = true) {
    return useQuery({
        queryKey: queryKeys.datingProfile(),
        queryFn: () => api.getMyDatingProfile(),
        enabled,
    });
}

export function useUpdateDatingProfile() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (input: api.UpdateDatingProfileInput) => api.updateMyDatingProfile(input),
        onSuccess: (profile) => {
            queryClient.setQueryData(queryKeys.datingProfile(), profile);
            void queryClient.invalidateQueries({ queryKey: ['dating-discover'] });
            void queryClient.invalidateQueries({ queryKey: ['dating-likes'] });
            void queryClient.invalidateQueries({ queryKey: ['dating-likes-preview'] });
        },
    });
}

export function useUploadDatingProfilePhoto() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: api.uploadDatingProfilePhoto,
        onSuccess: (profile) => {
            queryClient.setQueryData(queryKeys.datingProfile(), profile);
        },
    });
}

export function useDeleteDatingProfilePhoto() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (photoId: string) => api.deleteDatingProfilePhoto(photoId),
        onSuccess: (profile) => {
            queryClient.setQueryData(queryKeys.datingProfile(), profile);
            void queryClient.invalidateQueries({ queryKey: ['dating-discover'] });
        },
    });
}
