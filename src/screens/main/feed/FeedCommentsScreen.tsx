import React, { useMemo } from 'react';
import { appAlert } from '@/components/ui/appAlert';
import * as api from '../../../api/client';
import {
    CommentThreadAdapter,
    displayCommentToFeedComment,
    feedCommentToDisplayModel,
} from '../../../components/comments/commentTypes';
import { CommentThreadScreen } from '../../../components/comments/CommentThreadScreen';
import type { CardActionMenuAction } from '../../../components/ui/CardActionMenu';

export interface CommentThreadTarget {
    itemId: string;
    itemKind: api.FeedItemKind;
    commentCount: number;
    title?: string;
}

interface FeedCommentsScreenProps {
    thread: CommentThreadTarget;
    currentUser: api.User;
    focusComposer: boolean;
    onBack: () => void;
    onPressUser: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onCommentCreated?: (comment: api.Comment) => void;
}

export function FeedCommentsScreen({
    thread,
    currentUser,
    focusComposer,
    onBack,
    onPressUser,
    onCommentCreated,
}: FeedCommentsScreenProps): React.ReactElement {
    const adapter = useMemo<CommentThreadAdapter>(() => ({
        loadComments: async (cursor?: string) => {
            const result = await api.getFeedItemComments(thread.itemId, thread.itemKind, cursor);
            return {
                ...result,
                items: (result.items ?? []).map(feedCommentToDisplayModel),
            };
        },
        createComment: async (body: string, mentionUserIds: string[] = []) => {
            const comment = await api.addFeedItemComment(thread.itemId, thread.itemKind, body, mentionUserIds);
            return feedCommentToDisplayModel(comment);
        },
        searchMentionUsers: async (query: string) => {
            const result = await api.discoverUsers({ query, limit: 5 });
            return result.items ?? [];
        },
    }), [thread.itemId, thread.itemKind]);

    const title = thread.title?.trim()
        ? thread.title
        : thread.commentCount > 0
            ? `${thread.commentCount} Comment${thread.commentCount === 1 ? '' : 's'}`
            : 'Comments';
    const getCommentActions = (comment: { id: string; userId: string }): CardActionMenuAction[] => {
        if (comment.userId === currentUser.id || comment.id.startsWith('optimistic-')) return [];
        return [{
            label: 'Report',
            destructive: true,
            onPress: () => {
                appAlert.alert('Report comment?', 'This sends the comment to the moderation team.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Report',
                        style: 'destructive',
                        onPress: () => {
                            void api.reportContent({
                                target_type: thread.itemKind === 'reshare' ? 'feed_share_comment' : 'feed_comment',
                                target_id: comment.id,
                                reason: 'safety_concern',
                                context: { item_id: thread.itemId, item_kind: thread.itemKind },
                            }).then(() => {
                                appAlert.alert('Report sent', 'Thanks for helping keep SoberSpace safe.');
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
        <CommentThreadScreen
            title={title}
            adapter={adapter}
            currentUser={currentUser}
            focusComposer={focusComposer}
            onBack={onBack}
            onPressUser={onPressUser}
            onCommentCreated={(comment) => onCommentCreated?.(displayCommentToFeedComment(comment))}
            getCommentActions={getCommentActions}
        />
    );
}
