import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

interface PostCardProps {
    post: api.Post;
    currentUserId: string;
    isFollowing: boolean;
    onPressUser: () => void;
}

function PostCard({ post, currentUserId, isFollowing, onPressUser }: PostCardProps) {
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(0);
    const isOwn = post.user_id === currentUserId;

    const handleReact = async () => {
        try {
            const res = await api.reactToPost(post.id);
            setLiked(res.reacted);
            setLikeCount(prev => res.reacted ? prev + 1 : prev - 1);
        } catch { }
    };

    return (
        <View style={styles.postCard}>
            <View style={styles.postHead}>
                <TouchableOpacity onPress={isOwn ? undefined : onPressUser} disabled={isOwn}>
                    <Avatar firstName={post.first_name} lastName={post.last_name} avatarUrl={post.avatar_url} size={36} />
                </TouchableOpacity>
                <View style={styles.postHeadBody}>
                    <Text style={styles.postName}>{post.first_name} {post.last_name}</Text>
                    <Text style={styles.postMeta}>{timeAgo(post.created_at)}</Text>
                </View>
                {!isOwn && (
                    <TouchableOpacity
                        style={[styles.followPill, isFollowing && styles.followingPill]}
                        onPress={onPressUser}
                    >
                        <Text style={[styles.followPillText, isFollowing && styles.followingPillText]}>
                            {isFollowing ? 'Following' : '+ Follow'}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.postBody}>{post.body}</Text>
            <View style={styles.postFoot}>
                <TouchableOpacity style={styles.postAction} onPress={handleReact}>
                    <Ionicons
                        name={liked ? 'heart' : 'heart-outline'}
                        size={16}
                        color={liked ? Colors.danger : Colors.light.textTertiary}
                    />
                    <Text style={[styles.postActionText, liked && styles.liked]}>
                        {likeCount > 0 ? likeCount : 'Like'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.postAction}>
                    <Ionicons name="chatbubble-outline" size={15} color={Colors.light.textTertiary} />
                    <Text style={styles.postActionText}>Comment</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

interface FeedScreenProps {
    followingIds: Set<string>;
    onFollowChange: (userId: string, following: boolean) => void;
    onOpenUserProfile: (profile: { userId: string; firstName: string; lastName: string; avatarUrl?: string }) => void;
    onFollowingLoaded: (ids: Set<string>) => void;
}

export function FeedScreen({ followingIds, onFollowChange, onOpenUserProfile, onFollowingLoaded }: FeedScreenProps) {
    const { user } = useAuth();
    const [posts, setPosts] = useState<api.Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [composing, setComposing] = useState(false);
    const [draft, setDraft] = useState('');
    const [posting, setPosting] = useState(false);

    const load = useCallback(async () => {
        try {
            const [feedData, followingData] = await Promise.all([
                api.getFeed(),
                api.getFollowing(),
            ]);
            setPosts(feedData ?? []);
            onFollowingLoaded(new Set((followingData ?? []).map(f => f.user_id)));
        } catch { }
    }, []);

    useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const handlePost = async () => {
        if (!draft.trim()) return;
        setPosting(true);
        try {
            await api.createPost(draft.trim());
            setDraft('');
            setComposing(false);
            await load();
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setPosting(false);
        }
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={posts}
                keyExtractor={p => p.id}
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                ListHeaderComponent={
                    <View style={styles.composeBar}>
                        {user && <Avatar firstName={user.first_name} lastName={user.last_name} avatarUrl={user.avatar_url} size={28} />}
                        {composing ? (
                            <TextInput
                                style={styles.composeInput}
                                placeholder="What's on your mind?"
                                placeholderTextColor={Colors.light.textTertiary}
                                value={draft}
                                onChangeText={setDraft}
                                multiline
                                autoFocus
                            />
                        ) : (
                            <TouchableOpacity style={{ flex: 1 }} onPress={() => setComposing(true)}>
                                <Text style={styles.composePlaceholder}>What's on your mind?</Text>
                            </TouchableOpacity>
                        )}
                        {composing && (
                            <TouchableOpacity
                                style={[styles.postBtn, posting && { opacity: 0.6 }]}
                                onPress={handlePost}
                                disabled={posting}
                            >
                                <Text style={styles.postBtnText}>Post</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No posts yet.</Text>
                        <Text style={styles.emptySubtext}>Follow people to see their posts here.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <PostCard
                        post={item}
                        currentUserId={user?.id ?? ''}
                        isFollowing={followingIds.has(item.user_id)}
                        onPressUser={() => onOpenUserProfile({
                            userId: item.user_id,
                            firstName: item.first_name,
                            lastName: item.last_name,
                            avatarUrl: item.avatar_url,
                        })}
                    />
                )}
                contentContainerStyle={styles.list}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: Spacing.md, paddingBottom: 32 },

    composeBar: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        padding: Spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    composeInput: {
        flex: 1,
        fontSize: Typography.sizes.base,
        color: Colors.light.textPrimary,
        maxHeight: 100,
    },
    composePlaceholder: { flex: 1, fontSize: Typography.sizes.base, color: Colors.light.textTertiary, textAlignVertical: 'center' },
    postBtn: {
        backgroundColor: Colors.success,
        borderRadius: Radii.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    postBtnText: { color: Colors.textOn.primary, fontSize: Typography.sizes.sm, fontWeight: '600' },

    postCard: {
        backgroundColor: Colors.light.background,
        borderRadius: Radii.lg,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
    },
    postHeadBody: { flex: 1 },
    postHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        padding: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    postName: { fontSize: Typography.sizes.md, fontWeight: '500', color: Colors.light.textPrimary },
    postMeta: { fontSize: Typography.sizes.xs, color: Colors.light.textTertiary, marginTop: 1 },
    postBody: {
        fontSize: Typography.sizes.base,
        color: Colors.light.textSecondary,
        lineHeight: 19,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    postFoot: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
    },
    postAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    postActionText: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary },
    liked: { color: Colors.danger },

    followPill: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.full,
        paddingHorizontal: 12,
        paddingVertical: 4,
    },
    followingPill: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    followPillText: { fontSize: Typography.sizes.xs, color: '#FFFFFF', fontWeight: '500' },
    followingPillText: { color: Colors.light.textTertiary },

    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: Typography.sizes.lg, fontWeight: '500', color: Colors.light.textPrimary },
    emptySubtext: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm, textAlign: 'center' },
});
