import React, { useCallback } from "react";
import { useCreatePostMutation } from "../../hooks/queries/useCreatePostMutation";
import { PostComposer, PostComposerSubmitInput } from "./createPost/PostComposer";

interface CreatePostScreenProps {
  onBack: () => void;
  closeOnSubmit?: boolean;
  guidedHighlightSubmit?: boolean;
  onPostCreated?: (post: { id: string }) => void | Promise<void>;
}

export function CreatePostScreen({
  onBack,
  closeOnSubmit = true,
  guidedHighlightSubmit = false,
  onPostCreated,
}: CreatePostScreenProps): React.ReactElement {
  const createPostMutation = useCreatePostMutation();

  const handleSubmit = useCallback(
    async (input: PostComposerSubmitInput): Promise<void> => {
      const post = await createPostMutation.mutateAsync({
        body: input.body,
        images: input.images,
        tags: input.tags,
      });
      await onPostCreated?.(post);
    },
    [createPostMutation, onPostCreated],
  );

  return (
    <PostComposer
      isSubmitting={createPostMutation.isPending}
      closeOnSubmit={closeOnSubmit}
      guidedHighlightSubmit={guidedHighlightSubmit}
      onBack={onBack}
      onSubmit={handleSubmit}
    />
  );
}
