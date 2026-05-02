import React, { useMemo } from 'react';
import * as api from '../../../api/client';
import {
    CommentThreadAdapter,
    displayCommentToFeedComment,
    feedCommentToDisplayModel,
} from '../../../components/comments/commentTypes';
import { CommentThreadModal } from '../../../components/comments/CommentThreadModal';

export interface CommentThreadTarget {
    itemId: string;
    itemKind: api.FeedItemKind;
    commentCount: number;
    title?: string;
}

interface FeedCommentsModalProps {
    thread: CommentThreadTarget;
    currentUser: api.User;
    focusComposer: boolean;
    onClose: () => void;
    onPressUser: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
    onCommentCreated?: (comment: api.Comment) => void;
}

export function FeedCommentsModal({
    thread,
    currentUser,
    focusComposer,
    onClose,
    onPressUser,
    onCommentCreated,
}: FeedCommentsModalProps): React.ReactElement {
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

    return (
        <CommentThreadModal
            title={title}
            adapter={adapter}
            currentUser={currentUser}
            initialCommentCount={thread.commentCount}
            focusComposer={focusComposer}
            onClose={onClose}
            onPressUser={onPressUser}
            onCommentCreated={(comment) => onCommentCreated?.(displayCommentToFeedComment(comment))}
        />
    );
}
