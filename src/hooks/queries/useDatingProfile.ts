import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

const OPTIMISTIC_PHOTO_ID_PREFIX = 'optimistic-dating-photo-';
const DEFAULT_OPTIMISTIC_PHOTO_WIDTH = 1080;
const DEFAULT_OPTIMISTIC_PHOTO_HEIGHT = 1350;

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
        onMutate: (input) => {
            void queryClient.cancelQueries({ queryKey: queryKeys.datingProfile() });
            const previousProfile = queryClient.getQueryData<api.DatingProfile>(queryKeys.datingProfile());
            if (!previousProfile) {
                return { previousProfile };
            }

            const currentPhotos = previousProfile.photos ?? [];
            const optimisticPhoto: api.DatingPhoto = {
                id: input.optimisticPhotoId ?? `${OPTIMISTIC_PHOTO_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`,
                image_url: input.uri,
                width: input.width ?? DEFAULT_OPTIMISTIC_PHOTO_WIDTH,
                height: input.height ?? DEFAULT_OPTIMISTIC_PHOTO_HEIGHT,
                position: currentPhotos.reduce((max, photo) => Math.max(max, photo.position), -1) + 1,
                created_at: new Date().toISOString(),
            };

            queryClient.setQueryData(queryKeys.datingProfile(), {
                ...previousProfile,
                photos: [...currentPhotos, optimisticPhoto],
            });

            return { previousProfile };
        },
        onError: (_error, _input, context) => {
            if (context?.previousProfile) {
                queryClient.setQueryData(queryKeys.datingProfile(), context.previousProfile);
            }
        },
        onSuccess: (profile) => {
            queryClient.setQueryData(queryKeys.datingProfile(), profile);
            void queryClient.invalidateQueries({ queryKey: ['dating-discover'] });
            void queryClient.invalidateQueries({ queryKey: ['dating-likes'] });
            void queryClient.invalidateQueries({ queryKey: ['dating-likes-preview'] });
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

export function useReorderDatingProfilePhotos() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (photoIds: string[]) => api.reorderDatingProfilePhotos(photoIds),
        onMutate: async (photoIds) => {
            await queryClient.cancelQueries({ queryKey: queryKeys.datingProfile() });
            const previousProfile = queryClient.getQueryData<api.DatingProfile>(queryKeys.datingProfile());
            if (previousProfile) {
                const order = new Map(photoIds.map((photoId, index) => [photoId, index]));
                const nextPhotos = [...previousProfile.photos]
                    .sort((a, b) => (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.id) ?? Number.MAX_SAFE_INTEGER))
                    .map((photo, index) => ({ ...photo, position: index }));
                queryClient.setQueryData(queryKeys.datingProfile(), { ...previousProfile, photos: nextPhotos });
            }
            return { previousProfile };
        },
        onError: (_error, _photoIds, context) => {
            if (context?.previousProfile) {
                queryClient.setQueryData(queryKeys.datingProfile(), context.previousProfile);
            }
        },
        onSuccess: (profile) => {
            queryClient.setQueryData(queryKeys.datingProfile(), profile);
            void queryClient.invalidateQueries({ queryKey: ['dating-discover'] });
            void queryClient.invalidateQueries({ queryKey: ['dating-likes'] });
            void queryClient.invalidateQueries({ queryKey: ['dating-likes-preview'] });
        },
    });
}
