export interface PostDisplayModel {
    id: string;
    authorId: string;
    username: string;
    avatarUrl?: string;
    body: string;
    createdAt: string;
    sourceLabel?: string | null;
    badgeLabel?: string;
    imageUrl?: string;
    tags: string[];
    reactionCount: number;
    commentCount: number;
    viewerHasReacted: boolean;
    isPinned?: boolean;
    isOwn?: boolean;
    isAnonymous?: boolean;
}
