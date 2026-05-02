import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import * as api from '../../api/client';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { formatUsername } from '../../utils/identity';

export interface ProfilePostCardProps {
    post: api.Post;
    onPressComments?: (post: api.Post) => void;
}

function formatPostTimestamp(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

export function ProfilePostCard({ post, onPressComments }: ProfilePostCardProps): React.ReactElement {
    const image = post.images[0];

    return (
        <View style={styles.postCard}>
            <View style={styles.postHead}>
                <Avatar username={post.username} avatarUrl={post.avatar_url} size={44} fontSize={14} />
                <View style={styles.postHeadBody}>
                    <View style={styles.postTitleRow}>
                        <Text style={styles.postName}>{formatUsername(post.username)}</Text>
                        <Text style={styles.postMeta}>{formatPostTimestamp(post.created_at)}</Text>
                    </View>
                    {post.source_label ? <Text style={styles.postSource}>{post.source_label}</Text> : null}
                </View>
            </View>
            {!!post.body ? (
                <View style={styles.postContent}>
                    <Text style={styles.postBody}>{post.body}</Text>
                </View>
            ) : null}
            {image ? (
                <Image
                    source={{ uri: image.image_url }}
                    style={styles.postImage}
                    resizeMode="cover"
                />
            ) : null}
            {post.tags.length > 0 ? (
                <View style={styles.postTags}>
                    {post.tags.map((tag) => (
                        <Text key={tag} style={styles.postTag}>#{tag}</Text>
                    ))}
                </View>
            ) : null}
            <View style={styles.postFoot}>
                <View style={styles.postAction}>
                    <Ionicons name="heart-outline" size={16} color={Colors.text.muted} />
                    <Text style={styles.postActionText}>
                        {post.like_count > 0 ? post.like_count : 'Like'}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.postAction}
                    onPress={() => onPressComments?.(post)}
                    disabled={!onPressComments}
                >
                    <Ionicons name="chatbubble-outline" size={15} color={Colors.text.muted} />
                    <Text style={styles.postActionText}>
                        {post.comment_count > 0 ? `${post.comment_count} comments` : 'Comment'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
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
        gap: Spacing.xs,
    },
    postActionText: {
        ...TextStyles.secondary,
        color: Colors.text.muted,
    },
});
