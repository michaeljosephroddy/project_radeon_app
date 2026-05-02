import React, { useCallback } from "react";
import { useCreatePostMutation } from "../../hooks/queries/useCreatePostMutation";
import { PostComposer, PostComposerSubmitInput } from "./createPost/PostComposer";

interface CreatePostScreenProps {
  onBack: () => void;
}

export function CreatePostScreen({
  onBack,
}: CreatePostScreenProps): React.ReactElement {
  const createPostMutation = useCreatePostMutation();

  const handleSubmit = useCallback(
    async (input: PostComposerSubmitInput): Promise<void> => {
      await createPostMutation.mutateAsync({
        body: input.body,
        images: input.images,
        tags: input.tags,
      });
    },
    [createPostMutation],
  );

  return (
    <PostComposer
      isSubmitting={createPostMutation.isPending}
      onBack={onBack}
      onSubmit={handleSubmit}
    />
  );
}
