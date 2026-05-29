import React, { useMemo } from 'react';
import { appAlert } from '@/components/ui/appAlert';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../../../api/client';
import { CommentThreadModal } from '../../../components/comments/CommentThreadModal';
import { CommentThreadAdapter, groupCommentToDisplayModel } from '../../../components/comments/commentTypes';
import type { CardActionMenuAction } from '../../../components/ui/CardActionMenu';

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
    const getCommentActions = (comment: { id: string; userId: string }): CardActionMenuAction[] => {
        if (comment.userId === currentUser.id || comment.id.startsWith('optimistic-')) return [];
        return [{
            label: 'Report',
            destructive: true,
            onPress: () => {
                appAlert.alert('Report comment?', 'This sends the comment to group moderators.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Report',
                        style: 'destructive',
                        onPress: () => {
                            void api.reportGroupTarget(post.group_id, {
                                target_type: 'comment',
                                target_id: comment.id,
                                reason: 'Safety concern',
                                details: null,
                            }).then(() => {
                                appAlert.alert('Report sent', 'Thanks for helping keep this group safe.');
                            }).catch((error: unknown) => {
                                appAlert.alert('Report failed', error instanceof Error ? error.message : 'Please try again.');
                            });
                        },
                    },
                ]);
            },
        }];
    };

    return (
        <CommentThreadModal
            title={title}
            adapter={adapter}
            currentUser={currentUser}
            focusComposer={false}
            onClose={onClose}
            onPressUser={onPressUser}
            onCommentCreated={() => {
                void queryClient.invalidateQueries({ queryKey: ['groups', 'posts', post.group_id] });
            }}
            getCommentActions={getCommentActions}
        />
    );
}
