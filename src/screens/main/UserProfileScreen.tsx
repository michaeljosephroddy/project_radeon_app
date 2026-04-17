import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
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

interface UserProfileScreenProps {
    userId: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    initialIsFollowing: boolean;
    onBack: () => void;
    onFollowChange: (userId: string, following: boolean) => void;
}

export function UserProfileScreen({
    userId, firstName, lastName, avatarUrl,
    initialIsFollowing, onBack, onFollowChange,
}: UserProfileScreenProps) {
    const [profile, setProfile] = useState<api.User | null>(null);
    const [posts, setPosts] = useState<api.Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
    const [followLoading, setFollowLoading] = useState(false);

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
    }, [load]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const handleFollow = async () => {
        setFollowLoading(true);
        const next = !isFollowing;
        setIsFollowing(next);
        onFollowChange(userId, next);
        try {
            if (next) {
                await api.followUser(userId);
            } else {
                await api.unfollowUser(userId);
            }
        } catch {
            setIsFollowing(!next);
            onFollowChange(userId, !next);
        } finally {
            setFollowLoading(false);
        }
    };

    const ProfileHeader = (
        <View style={styles.profileHeader}>
            <Avatar
                firstName={firstName}
                lastName={lastName}
                avatarUrl={avatarUrl}
                size={80}
                fontSize={28}
            />
            <Text style={styles.name}>{firstName} {lastName}</Text>

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
                    {(profile?.interests?.length ?? 0) > 0 && (
                        <View style={styles.interests}>
                            {profile!.interests.map(interest => (
                                <View key={interest} style={styles.interestPill}>
                                    <Text style={styles.interestPillText}>{interest}</Text>
                                </View>
                            ))}
                        </View>
                    )}
                </>
            )}

            <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followingBtn, followLoading && { opacity: 0.6 }]}
                onPress={handleFollow}
                disabled={followLoading}
            >
                <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                    {isFollowing ? 'Following' : 'Follow'}
                </Text>
            </TouchableOpacity>

            <Text style={styles.postsLabel}>POSTS</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{firstName} {lastName}</Text>
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
                            <Avatar firstName={item.first_name} lastName={item.last_name} avatarUrl={item.avatar_url} size={36} fontSize={13} />
                            <View style={styles.postHeadBody}>
                                <Text style={styles.postName}>{item.first_name} {item.last_name}</Text>
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
    interests: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.xs,
        justifyContent: 'center',
        marginTop: Spacing.xs,
    },
    interestPill: {
        borderRadius: Radii.full,
        borderWidth: 1,
        borderColor: Colors.success,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: Colors.successSubtle,
    },
    interestPillText: { fontSize: Typography.sizes.xs, color: Colors.success, fontWeight: '500' },

    followBtn: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.md,
        paddingVertical: 10,
        paddingHorizontal: Spacing.xl,
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    followingBtn: {
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        borderColor: Colors.light.border,
    },
    followBtnText: { fontSize: Typography.sizes.base, fontWeight: '600', color: '#FFFFFF' },
    followingBtnText: { color: Colors.light.textSecondary },

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
