import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/client';
import { useAuth } from '../useAuth';
import { queryKeys } from '../../query/queryKeys';

interface CreatePostMutationInput {
    body?: string;
    images?: api.PostImage[];
    tags?: string[];
}

export function useCreatePostMutation() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: (input: CreatePostMutationInput) => api.createPost(input),
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.homeFeed() }),
                user?.id
                    ? queryClient.invalidateQueries({ queryKey: queryKeys.userPosts(user.id) })
                    : Promise.resolve(),
            ]);
        },
    });
}
