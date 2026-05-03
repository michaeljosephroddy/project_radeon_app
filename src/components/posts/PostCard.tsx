import React, { useCallback } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import { Colors, ControlSizes, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { formatReadableTimestamp } from '../../utils/date';
import { formatUsername } from '../../utils/identity';
import { PostDisplayModel } from './postTypes';

export interface PostCardProps {
    post: PostDisplayModel;
    onReact: () => void;
    onOpenComments: () => void;
    onPressUser?: () => void;
    onOpenActions?: () => void;
    onShare?: () => void;
    showShareAction?: boolean;
}

export const PostCard = React.memo(function PostCard({
    post,
    onReact,
    onOpenComments,
    onPressUser,
    onOpenActions,
    onShare,
    showShareAction = false,
}: PostCardProps): React.ReactElement {
    const handlePressUser = useCallback(() => {
        if (!post.isOwn) onPressUser?.();
    }, [onPressUser, post.isOwn]);

    return (
        <View style={styles.postCard}>
            <View style={styles.postHead}>
                <TouchableOpacity onPress={handlePressUser} disabled={post.isOwn || !onPressUser}>
                    <Avatar username={post.username} avatarUrl={post.avatarUrl} size={44} />
                </TouchableOpacity>
                <View style={styles.postHeadBody}>
                    <View style={styles.postTitleRow}>
                        <Text style={styles.postName}>{formatUsername(post.username)}</Text>
                        <Text style={styles.postMeta}>{formatReadableTimestamp(post.createdAt)}</Text>
                    </View>
                    {post.sourceLabel ? <Text style={styles.postSource}>{post.sourceLabel}</Text> : null}
                    {post.badgeLabel || post.isPinned ? (
                        <View style={styles.badgeRow}>
                            {post.isPinned ? (
                                <View style={styles.badge}>
                                    <Ionicons name="pin" size={12} color={Colors.primary} />
                                    <Text style={styles.badgeText}>Pinned</Text>
                                </View>
                            ) : null}
                            {post.badgeLabel ? (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{post.badgeLabel}</Text>
                                </View>
                            ) : null}
                        </View>
                    ) : null}
                </View>
                {onOpenActions ? (
                    <TouchableOpacity style={styles.headActionButton} onPress={onOpenActions}>
                        <Ionicons name="ellipsis-horizontal" size={18} color={Colors.text.muted} />
                    </TouchableOpacity>
                ) : null}
            </View>
            {!!post.body ? (
                <View style={styles.postContent}>
                    <Text style={styles.postBody}>{post.body}</Text>
                </View>
            ) : null}
            {post.imageUrl ? (
                <Image
                    source={{ uri: post.imageUrl }}
                    style={styles.postImage}
                    resizeMode="cover"
                />
            ) : null}
            {renderPostTags(post.tags)}
            <View style={styles.postFoot}>
                <TouchableOpacity style={styles.postAction} onPress={onReact}>
                    <Ionicons
                        name={post.viewerHasReacted ? 'heart' : 'heart-outline'}
                        size={16}
                        color={post.viewerHasReacted ? Colors.danger : Colors.text.muted}
                    />
                    <Text style={[styles.postActionText, post.viewerHasReacted && styles.liked]}>
                        {post.reactionCount > 0 ? post.reactionCount : 'Like'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postAction} onPress={onOpenComments}>
                    <Ionicons
                        name="chatbubble-outline"
                        size={15}
                        color={Colors.text.muted}
                    />
                    <Text style={styles.postActionText}>
                        {post.commentCount > 0 ? `${post.commentCount} comments` : 'Comment'}
                    </Text>
                </TouchableOpacity>
                {showShareAction && onShare ? (
                    <TouchableOpacity style={styles.postAction} onPress={onShare}>
                        <Ionicons
                            name="repeat-outline"
                            size={16}
                            color={Colors.text.muted}
                        />
                        <Text style={styles.postActionText}>Share</Text>
                    </TouchableOpacity>
                ) : null}
            </View>
        </View>
    );
}, arePostCardPropsEqual);

function renderPostTags(tags: string[]): React.ReactElement | null {
    if (tags.length === 0) return null;
    return (
        <View style={styles.postTags}>
            {tags.map((tag) => (
                <Text key={tag} style={styles.postTag}>#{tag}</Text>
            ))}
        </View>
    );
}

function arePostCardPropsEqual(prev: PostCardProps, next: PostCardProps): boolean {
    return prev.post === next.post
        && prev.onReact === next.onReact
        && prev.onOpenComments === next.onOpenComments
        && prev.onPressUser === next.onPressUser
        && prev.onOpenActions === next.onOpenActions
        && prev.onShare === next.onShare
        && prev.showShareAction === next.showShareAction;
}

const styles = StyleSheet.create({
    postCard: {
        backgroundColor: Colors.bg.page,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.default,
    },
    postHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        padding: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    postHeadBody: {
        flex: 1,
        minWidth: 0,
    },
    postTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        flexWrap: 'wrap',
    },
    postName: {
        ...TextStyles.cardTitle,
    },
    postMeta: {
        ...TextStyles.meta,
    },
    postSource: {
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
        color: Colors.primary,
        marginTop: 2,
    },
    badgeRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        marginTop: 5,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primarySubtle,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
    },
    badgeText: {
        fontSize: TextStyles.caption.fontSize,
        fontWeight: TextStyles.caption.fontWeight,
        color: Colors.primary,
    },
    headActionButton: {
        width: ControlSizes.iconButtonLarge,
        height: ControlSizes.iconButtonLarge,
        alignItems: 'center',
        justifyContent: 'center',
    },
    postContent: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    postBody: {
        ...TextStyles.postBody,
    },
    postImage: {
        width: '100%',
        aspectRatio: 1.2,
        backgroundColor: Colors.bg.surface,
    },
    postTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
        marginTop: Spacing.sm,
    },
    postTag: {
        overflow: 'hidden',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 4,
        backgroundColor: Colors.primarySubtle,
        color: Colors.primary,
        fontSize: TextStyles.caption.fontSize,
        fontWeight: TextStyles.caption.fontWeight,
    },
    postFoot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    postAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    postActionText: {
        ...TextStyles.secondary,
        color: Colors.text.muted,
    },
    liked: {
        color: Colors.danger,
    },
});
