import React, { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../../../api/client';
import { CommentThreadModal } from '../../../components/comments/CommentThreadModal';
import { CommentThreadAdapter, groupCommentToDisplayModel } from '../../../components/comments/commentTypes';

interface GroupCommentsModalProps {
    post: api.GroupPost;
    currentUser: api.User;
    onClose: () => void;
    onPressUser: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}

export function GroupCommentsModal({
    post,
    currentUser,
    onClose,
    onPressUser,
}: GroupCommentsModalProps): React.ReactElement {
    const queryClient = useQueryClient();
    const adapter = useMemo<CommentThreadAdapter>(() => ({
        loadComments: async (cursor?: string) => {
            const result = await api.listGroupComments(post.group_id, post.id, cursor);
            return {
                ...result,
                items: (result.items ?? []).map(groupCommentToDisplayModel),
            };
        },
        createComment: async (body: string) => {
            const comment = await api.createGroupComment(post.group_id, post.id, body);
            return groupCommentToDisplayModel(comment);
        },
    }), [post.group_id, post.id]);

    const title = post.comment_count > 0
        ? `${post.comment_count} Comment${post.comment_count === 1 ? '' : 's'}`
        : 'Comments';

    return (
        <CommentThreadModal
            title={title}
            adapter={adapter}
            currentUser={currentUser}
            initialCommentCount={post.comment_count}
            focusComposer={false}
            onClose={onClose}
            onPressUser={onPressUser}
            onCommentCreated={() => {
                void queryClient.invalidateQueries({ queryKey: ['groups', 'posts', post.group_id] });
            }}
        />
    );
}
