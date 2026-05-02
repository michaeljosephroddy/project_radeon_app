import * as api from '../../api/client';
import { PostDisplayModel } from './postTypes';

export function feedItemToPostDisplayModel(item: api.FeedItem, currentUserId: string): PostDisplayModel {
    return {
        id: item.id,
        authorId: item.author.user_id,
        username: item.author.username,
        avatarUrl: item.author.avatar_url ?? undefined,
        body: item.body,
        createdAt: item.created_at,
        sourceLabel: item.source_label,
        imageUrl: item.images[0]?.image_url ?? undefined,
        tags: item.tags,
        reactionCount: item.like_count,
        commentCount: item.comment_count,
        viewerHasReacted: item.viewer_state.is_liked,
        isOwn: item.author.user_id === currentUserId,
    };
}

export function groupPostToPostDisplayModel(post: api.GroupPost, currentUserId: string): PostDisplayModel {
    return {
        id: post.id,
        authorId: post.user_id,
        username: post.anonymous ? 'Anonymous member' : post.username,
        avatarUrl: post.anonymous ? undefined : post.avatar_url ?? undefined,
        body: post.body,
        createdAt: post.created_at,
        badgeLabel: groupPostTypeLabel(post.post_type),
        imageUrl: post.images[0]?.thumb_url ?? post.images[0]?.image_url ?? undefined,
        tags: [],
        reactionCount: post.reaction_count,
        commentCount: post.comment_count,
        viewerHasReacted: post.viewer_has_reacted,
        isPinned: Boolean(post.pinned_at),
        isOwn: post.user_id === currentUserId,
        isAnonymous: post.anonymous,
    };
}

export function groupPostTypeLabel(type: api.GroupPostType): string {
    if (type === 'need_support') return 'Needs support';
    if (type === 'admin_announcement') return 'Announcement';
    if (type === 'check_in') return 'Check-in';
    if (type === 'milestone') return 'Milestone';
    return 'Post';
}
