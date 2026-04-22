import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';

interface CreatePostMutationInput {
    body?: string;
    images?: api.PostImage[];
    currentUserId?: string;
}

export function useCreatePostMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ body, images }: CreatePostMutationInput) => api.createPost({ body, images }),
        onSuccess: async (_data, variables) => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: queryKeys.feed() }),
                variables.currentUserId
                    ? queryClient.invalidateQueries({ queryKey: queryKeys.userPosts(variables.currentUserId) })
                    : Promise.resolve(),
            ]);
        },
    });
}
