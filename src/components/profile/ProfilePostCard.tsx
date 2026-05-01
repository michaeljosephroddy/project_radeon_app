import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import * as api from '../../api/client';
import { Colors, Radius, Spacing, Typography } from '../../theme';
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
            <View style={styles.postContent}>
                {!!post.body && <Text style={styles.postBody}>{post.body}</Text>}
                {image ? (
                    <Image
                        source={{ uri: image.image_url }}
                        style={styles.postImage}
                        resizeMode="cover"
                    />
                ) : null}
            </View>
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
        fontSize: Typography.sizes.md,
        fontWeight: '500',
        color: Colors.text.primary,
    },
    postMeta: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.muted,
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
        fontSize: Typography.sizes.base,
        color: Colors.text.secondary,
        lineHeight: 19,
    },
    postImage: {
        width: '100%',
        aspectRatio: 1.2,
        borderRadius: Radius.md,
        marginTop: Spacing.sm,
        backgroundColor: Colors.bg.surface,
    },
    postFoot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    postAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
    },
    postActionText: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
});
