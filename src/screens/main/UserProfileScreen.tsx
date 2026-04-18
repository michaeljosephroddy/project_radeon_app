import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';

// Formats profile post timestamps into compact relative labels.
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
    friendIds: Set<string>;
    incomingFriendRequestIds: Set<string>;
    outgoingFriendRequestIds: Set<string>;
    onBack: () => void;
    onFriendshipChange: (userId: string, status: 'none' | 'incoming' | 'outgoing' | 'friends') => void;
    refreshFriendshipState: () => Promise<void>;
    onOpenChat: (chat: api.Chat) => void;
}

// Renders another user's profile plus friendship and direct-message actions.
export function UserProfileScreen({
    userId, username, avatarUrl,
    friendIds = new Set<string>(),
    incomingFriendRequestIds = new Set<string>(),
    outgoingFriendRequestIds = new Set<string>(),
    onBack, onFriendshipChange, refreshFriendshipState, onOpenChat,
}: UserProfileScreenProps) {
    const [profile, setProfile] = useState<api.User | null>(null);
    const [posts, setPosts] = useState<api.Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const friendshipStatus = friendIds.has(userId)
        ? 'friends'
        : incomingFriendRequestIds.has(userId)
            ? 'incoming'
            : outgoingFriendRequestIds.has(userId)
                ? 'outgoing'
                : 'none';
    const [friendActionLoading, setFriendActionLoading] = useState(false);
    const [dmLoading, setDmLoading] = useState(false);

    // Loads the profile metadata and posts for the viewed user.
    const load = useCallback(async () => {
        try {
            // Profile metadata and posts are independent, so fetch them in parallel
            // to shorten the time before the profile screen becomes useful.
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
        refreshFriendshipState().catch(() => {});
    }, [load, refreshFriendshipState]);

    // Refreshes both the viewed profile data and shared friendship state.
    const onRefresh = async () => {
        setRefreshing(true);
        await Promise.all([load(), refreshFriendshipState()]);
        setRefreshing(false);
    };

    // Optimistically updates the friendship state for the viewed user.
    const handleFriendAction = async () => {
        if (friendshipStatus === 'friends') {
            setFriendActionLoading(true);
            onFriendshipChange(userId, 'none');
            try {
                await api.removeFriend(userId);
                await refreshFriendshipState();
            } catch {
                onFriendshipChange(userId, 'friends');
            } finally {
                setFriendActionLoading(false);
            }
            return;
        }

        setFriendActionLoading(true);
        const current = friendshipStatus;
        try {
            if (current === 'incoming') {
                onFriendshipChange(userId, 'friends');
                await api.updateFriendRequest(userId, 'accept');
            } else if (current === 'outgoing') {
                onFriendshipChange(userId, 'none');
                await api.cancelFriendRequest(userId);
            } else {
                onFriendshipChange(userId, 'outgoing');
                await api.sendFriendRequest(userId);
            }
            await refreshFriendshipState();
        } catch {
            onFriendshipChange(userId, current);
        } finally {
            setFriendActionLoading(false);
        }
    };

    // Creates or opens a direct message thread with the viewed user.
    const handleDM = async () => {
        setDmLoading(true);
        try {
            const { id } = await api.createChat([userId]);
            // Jump straight into the newly created DM using enough metadata to render
            // the chat overlay before the chats list refreshes.
            onOpenChat({
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

    const friendButtonLabel = friendshipStatus === 'friends'
        ? 'Friends'
        : friendshipStatus === 'incoming'
            ? 'Accept Friend'
            : friendshipStatus === 'outgoing'
                ? 'Requested'
                : 'Add Friend';

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
                    style={[styles.followBtn, friendshipStatus === 'friends' && styles.followingBtn, friendActionLoading && { opacity: 0.6 }]}
                    onPress={handleFriendAction}
                    disabled={friendActionLoading}
                >
                    <Text style={[styles.followBtnText, friendshipStatus === 'friends' && styles.followingBtnText]}>
                        {friendButtonLabel}
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
                        <View style={styles.postFoot}>
                            <View style={styles.postAction}>
                                <Ionicons name="heart-outline" size={16} color={Colors.light.textTertiary} />
                                <Text style={styles.postActionText}>
                                    {item.like_count > 0 ? item.like_count : 'Like'}
                                </Text>
                            </View>
                            <View style={styles.postAction}>
                                <Ionicons name="chatbubble-outline" size={15} color={Colors.light.textTertiary} />
                                <Text style={styles.postActionText}>
                                    {item.comment_count > 0 ? `${item.comment_count} comments` : 'Comment'}
                                </Text>
                            </View>
                        </View>
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

    empty: { alignItems: 'center', paddingTop: 40 },
    emptyText: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary },
});
