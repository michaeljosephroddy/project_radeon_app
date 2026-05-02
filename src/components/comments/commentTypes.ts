import * as api from '../../api/client';

export interface CommentDisplayModel {
    id: string;
    userId: string;
    username: string;
    avatarUrl?: string;
    body: string;
    createdAt: string;
    mentions?: api.CommentMention[];
}

export interface CommentThreadAdapter {
    loadComments: (cursor?: string) => Promise<api.CursorResponse<CommentDisplayModel>>;
    createComment: (body: string, mentionUserIds?: string[]) => Promise<CommentDisplayModel>;
    searchMentionUsers?: (query: string) => Promise<api.User[]>;
}

export interface CommentThreadUserProfile {
    userId: string;
    username: string;
    avatarUrl?: string;
}

export function feedCommentToDisplayModel(comment: api.Comment): CommentDisplayModel {
    return {
        id: comment.id,
        userId: comment.user_id,
        username: comment.username,
        avatarUrl: comment.avatar_url,
        body: comment.body,
        createdAt: comment.created_at,
        mentions: comment.mentions,
    };
}

export function groupCommentToDisplayModel(comment: api.GroupComment): CommentDisplayModel {
    return {
        id: comment.id,
        userId: comment.user_id,
        username: comment.username,
        avatarUrl: comment.avatar_url ?? undefined,
        body: comment.body,
        createdAt: comment.created_at,
    };
}

export function displayCommentToFeedComment(comment: CommentDisplayModel): api.Comment {
    return {
        id: comment.id,
        user_id: comment.userId,
        username: comment.username,
        avatar_url: comment.avatarUrl,
        body: comment.body,
        created_at: comment.createdAt,
        mentions: comment.mentions ?? [],
    };
}
