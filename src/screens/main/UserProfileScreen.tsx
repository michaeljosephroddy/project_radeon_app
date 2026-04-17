import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

interface UserProfileScreenProps {
    userId: string;
    username: string;
    avatarUrl?: string;
    followingIds: Set<string>;
    onBack: () => void;
    onFollowChange: (userId: string, following: boolean) => void;
    refreshFollowingIds: () => Promise<void>;
    onOpenConversation: (conv: api.Conversation) => void;
}

export function UserProfileScreen({
    userId, username, avatarUrl,
    followingIds, onBack, onFollowChange, refreshFollowingIds, onOpenConversation,
}: UserProfileScreenProps) {
    const [profile, setProfile] = useState<api.User | null>(null);
    const [posts, setPosts] = useState<api.Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const isFollowing = followingIds.has(userId);
    const [followLoading, setFollowLoading] = useState(false);
    const [dmLoading, setDmLoading] = useState(false);

    const load = useCallback(async () => {
        try {
            const [profileData, postsData] = await Promise.all([
                api.getUser(userId),
                api.getUserPosts(userId),
            ]);
            setProfile(profileData);
            setPosts(postsData ?? []);
        } catch { }
    }, [userId]);

    useEffect(() => {
        load().finally(() => setLoading(false));
        refreshFollowingIds();
    }, [load]);

    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([load(), refreshFollowingIds()]);
        setRefreshing(false);
    };

    const handleFollow = async () => {
        setFollowLoading(true);
        const next = !isFollowing;
        onFollowChange(userId, next);
        try {
            if (next) {
                await api.followUser(userId);
            } else {
                await api.unfollowUser(userId);
            }
            await refreshFollowingIds();
        } catch {
            onFollowChange(userId, !next);
        } finally {
            setFollowLoading(false);
        }
    };

    const handleDM = async () => {
        setDmLoading(true);
        try {
            const { id } = await api.createConversation([userId]);
            onOpenConversation({
                id,
                is_group: false,
                username,
                avatar_url: avatarUrl,
                created_at: new Date().toISOString(),
            });
        } catch { } finally {
            setDmLoading(false);
        }
    };

    const ProfileHeader = (
        <View style={styles.profileHeader}>
            <Avatar
                username={username}
                avatarUrl={avatarUrl}
                size={80}
                fontSize={28}
            />
            <Text style={styles.name}>{formatUsername(username)}</Text>

            {loading ? (
                <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.sm }} />
            ) : (
                <>
                    {profile?.city && (
                        <Text style={styles.meta}>{profile.city}{profile.country ? `, ${profile.country}` : ''}</Text>
                    )}
                    {profile?.sober_since && (
                        <Text style={styles.meta}>Sober since {profile.sober_since}</Text>
                    )}
                </>
            )}

            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[styles.followBtn, isFollowing && styles.followingBtn, followLoading && { opacity: 0.6 }]}
                    onPress={handleFollow}
                    disabled={followLoading}
                >
                    <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                        {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.dmBtn, dmLoading && { opacity: 0.6 }]}
                    onPress={handleDM}
                    disabled={dmLoading}
                >
                    <Text style={styles.dmBtnText}>Message</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.postsLabel}>POSTS</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{formatUsername(username)}</Text>
                <View style={styles.backBtn} />
            </View>

            <FlatList
                data={posts}
                keyExtractor={p => p.id}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                ListHeaderComponent={ProfileHeader}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.empty}>
                            <Text style={styles.emptyText}>No posts yet.</Text>
                        </View>
                    ) : null
                }
                renderItem={({ item }) => (
                    <View style={styles.postCard}>
                        <View style={styles.postHead}>
                            <Avatar username={item.username} avatarUrl={item.avatar_url} size={36} fontSize={13} />
                            <View style={styles.postHeadBody}>
                                <Text style={styles.postName}>{formatUsername(item.username)}</Text>
                                <Text style={styles.postMeta}>{timeAgo(item.created_at)}</Text>
                            </View>
                        </View>
                        <Text style={styles.postBody}>{item.body}</Text>
                    </View>
                )}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
    },
    backBtn: { width: 40 },
    backIcon: { fontSize: 20, color: Colors.primary },
    headerTitle: {
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },

    list: { paddingBottom: 32 },

    profileHeader: {
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.md,
        gap: 6,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
        marginBottom: Spacing.sm,
    },
    name: {
        fontSize: Typography.sizes.xl,
        fontWeight: '600',
        color: Colors.light.textPrimary,
        marginTop: Spacing.sm,
    },
    meta: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },
    actionRow: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.sm,
    },
    followBtn: {
        flex: 1,
        backgroundColor: Colors.primary,
        borderRadius: Radii.md,
        paddingVertical: 10,
        alignItems: 'center',
    },
    followingBtn: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: Colors.light.border,
    },
    followBtnText: { fontSize: Typography.sizes.base, fontWeight: '600', color: '#FFFFFF' },
    followingBtnText: { color: Colors.light.textSecondary },
    dmBtn: {
        flex: 1,
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        paddingVertical: 10,
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: Colors.light.border,
    },
    dmBtnText: { fontSize: Typography.sizes.base, fontWeight: '600', color: Colors.light.textPrimary },

    postsLabel: {
        alignSelf: 'flex-start',
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
        color: Colors.light.textTertiary,
        letterSpacing: 0.7,
        marginTop: Spacing.md,
    },

    postCard: {
        backgroundColor: Colors.light.background,
        borderRadius: Radii.lg,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
        overflow: 'hidden',
    },
    postHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        padding: Spacing.md,
        paddingBottom: Spacing.sm,
    },
    postHeadBody: { flex: 1 },
    postName: { fontSize: Typography.sizes.md, fontWeight: '500', color: Colors.light.textPrimary },
    postMeta: { fontSize: Typography.sizes.xs, color: Colors.light.textTertiary, marginTop: 1 },
    postBody: {
        fontSize: Typography.sizes.base,
        color: Colors.light.textSecondary,
        lineHeight: 19,
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
    },

    empty: { alignItems: 'center', paddingTop: 40 },
    emptyText: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary },
});
