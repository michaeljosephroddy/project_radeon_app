import React, { useCallback } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import * as api from '../../../api/client';
import { useCreateGroupPostMutation } from '../../../hooks/queries/useGroups';
import { PostComposer, PostComposerSubmitInput } from '../createPost/PostComposer';

interface GroupCreatePostScreenProps {
    group: api.Group;
    onBack: () => void;
}

export function GroupCreatePostScreen({
    group,
    onBack,
}: GroupCreatePostScreenProps): React.ReactElement {
    const ScreenContainer = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
    const createGroupPostMutation = useCreateGroupPostMutation(group.id);

    const handleSubmit = useCallback(
        async (input: PostComposerSubmitInput): Promise<void> => {
            await createGroupPostMutation.mutateAsync({
                body: input.body ?? 'Shared a photo',
                post_type: 'standard',
                images: input.images.map((image) => ({
                    image_url: image.image_url,
                    width: image.width,
                    height: image.height,
                })),
            });
        },
        [createGroupPostMutation],
    );

    return (
        <ScreenContainer
            style={styles.container}
            {...(Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {})}
        >
            <PostComposer
                title={`Post to ${group.name}`}
                isSubmitting={createGroupPostMutation.isPending}
                tagsEnabled={false}
                draftsEnabled={false}
                onBack={onBack}
                onSubmit={handleSubmit}
            />
        </ScreenContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});
