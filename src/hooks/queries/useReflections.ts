import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';
import { getLocalDateString } from '../../utils/date';

export function useTodayReflection(enabled = true) {
    return useQuery({
        queryKey: queryKeys.todayReflection(),
        queryFn: api.getTodayReflection,
        enabled,
        staleTime: 1000 * 30,
    });
}

export function useReflectionHistory(limit = 20, enabled = true) {
    return useInfiniteQuery({
        queryKey: queryKeys.reflectionHistory(limit),
        queryFn: ({ pageParam }) => api.listReflections(pageParam as string | undefined, limit),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
        enabled,
        staleTime: 1000 * 30,
    });
}

export function useReflection(reflectionId: string | null, enabled = true) {
    return useQuery({
        queryKey: queryKeys.reflection(reflectionId ?? ''),
        queryFn: () => api.getReflection(reflectionId ?? ''),
        enabled: enabled && Boolean(reflectionId),
        staleTime: 1000 * 30,
    });
}

export function useSaveTodayReflectionMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: api.upsertTodayReflection,
        onSuccess: async (reflection) => {
            queryClient.setQueryData(queryKeys.todayReflection(), reflection);
            queryClient.setQueryData(queryKeys.reflection(reflection.id), reflection);
            await queryClient.invalidateQueries({ queryKey: queryKeys.reflections() });
        },
    });
}

export function useCreateReflectionMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: api.createReflection,
        onSuccess: async (reflection) => {
            queryClient.setQueryData(queryKeys.reflection(reflection.id), reflection);
            await queryClient.invalidateQueries({ queryKey: queryKeys.reflections() });
        },
    });
}

export function useDeleteReflectionMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (reflectionId: string) => api.deleteReflection(reflectionId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.reflections() });
        },
    });
}

export function useUpdateReflectionMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, input }: { id: string; input: Partial<api.UpsertDailyReflectionInput> }) => api.updateReflection(id, input),
        onSuccess: async (reflection) => {
            queryClient.setQueryData(queryKeys.reflection(reflection.id), reflection);
            if (reflection.reflection_date === getLocalDateString()) {
                queryClient.setQueryData(queryKeys.todayReflection(), reflection);
            }
            await queryClient.invalidateQueries({ queryKey: queryKeys.reflections() });
        },
    });
}

export function useShareReflectionMutation(currentUserId?: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (reflectionId: string) => api.shareReflection(reflectionId),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.reflections() }),
                queryClient.invalidateQueries({ queryKey: queryKeys.homeFeed() }),
                currentUserId
                    ? queryClient.invalidateQueries({ queryKey: queryKeys.userPosts(currentUserId) })
                    : Promise.resolve(),
            ]);
        },
    });
}
