import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, TextInput,
    StyleSheet, RefreshControl, ActivityIndicator,
    Alert, FlatList, SectionList,
} from 'react-native';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

type Section = { title: string; data: api.FollowUser[] };

export function CommunityScreen() {
    const [following, setFollowing] = useState<api.FollowUser[]>([]);
    const [followers, setFollowers] = useState<api.FollowUser[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [unfollowing, setUnfollowing] = useState<Set<string>>(new Set());

    const load = useCallback(async () => {
        try {
            const [followingData, followersData] = await Promise.all([
                api.getFollowing(),
                api.getFollowers(),
            ]);
            setFollowing(followingData ?? []);
            setFollowers(followersData ?? []);
        } catch { }
    }, []);

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, [load]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const handleUnfollow = async (user: api.FollowUser) => {
        setUnfollowing(prev => new Set(prev).add(user.user_id));
        setFollowing(prev => prev.filter(u => u.user_id !== user.user_id));
        try {
            await api.unfollowUser(user.user_id);
        } catch (e: unknown) {
            setFollowing(prev => [user, ...prev]);
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setUnfollowing(prev => { const s = new Set(prev); s.delete(user.user_id); return s; });
        }
    };

    const filterUser = (u: api.FollowUser) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return `${u.first_name} ${u.last_name}`.toLowerCase().includes(q) ||
            (u.city?.toLowerCase().includes(q) ?? false);
    };

    const filteredFollowing = following.filter(filterUser);
    const filteredFollowers = followers.filter(filterUser);

    const sections: Section[] = [
        { title: `FOLLOWING  ${following.length}`, data: filteredFollowing },
        { title: `FOLLOWERS  ${followers.length}`, data: filteredFollowers },
    ];

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    return (
        <SectionList
            sections={sections}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            ListHeaderComponent={
                <View style={styles.searchBar}>
                    <Text style={styles.searchIcon}>⌕</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or city…"
                        placeholderTextColor={Colors.light.textTertiary}
                        value={search}
                        onChangeText={setSearch}
                        returnKeyType="search"
                        autoCorrect={false}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Text style={styles.searchClear}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>
            }
            renderSectionHeader={({ section }) => (
                <Text style={styles.sectionLabel}>{section.title}</Text>
            )}
            renderItem={({ item, section }) => {
                const isFollowingSection = section.title.startsWith('FOLLOWING');
                return (
                    <View style={styles.row}>
                        <Avatar
                            firstName={item.first_name}
                            lastName={item.last_name}
                            avatarUrl={item.avatar_url}
                            size={48}
                            fontSize={16}
                        />
                        <View style={styles.rowInfo}>
                            <Text style={styles.rowName}>{item.first_name} {item.last_name}</Text>
                            {item.city && <Text style={styles.rowCity}>{item.city}</Text>}
                        </View>
                        {isFollowingSection && (
                            <TouchableOpacity
                                style={styles.unfollowBtn}
                                onPress={() => handleUnfollow(item)}
                                disabled={unfollowing.has(item.user_id)}
                            >
                                <Text style={styles.unfollowBtnText}>Unfollow</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                );
            }}
            renderSectionFooter={({ section }) => {
                if (section.data.length > 0) return null;
                const isFollowingSection = section.title.startsWith('FOLLOWING');
                return (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            {isFollowingSection
                                ? search.trim() ? 'No one matched.' : 'Not following anyone yet.'
                                : search.trim() ? 'No one matched.' : 'No followers yet.'}
                        </Text>
                        {isFollowingSection && !search.trim() && (
                            <Text style={styles.emptySubtext}>
                                Find people through events or the feed and follow them from their profile.
                            </Text>
                        )}
                    </View>
                );
            }}
            stickySectionHeadersEnabled={false}
            SectionSeparatorComponent={() => <View style={styles.sectionSeparator} />}
        />
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { paddingBottom: 32 },

    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        gap: Spacing.sm,
        marginHorizontal: Spacing.md,
        marginTop: Spacing.md,
        marginBottom: Spacing.md,
    },
    searchIcon: { fontSize: 16, color: Colors.light.textTertiary },
    searchInput: { flex: 1, fontSize: Typography.sizes.base, color: Colors.light.textPrimary },
    searchClear: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary, padding: 2 },

    sectionLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '600',
        color: Colors.light.textTertiary,
        letterSpacing: 0.7,
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
    },
    sectionSeparator: {
        height: Spacing.lg,
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        gap: Spacing.md,
    },
    rowInfo: {
        flex: 1,
        gap: 2,
    },
    rowName: {
        fontSize: Typography.sizes.base,
        fontWeight: '500',
        color: Colors.light.textPrimary,
    },
    rowCity: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },

    unfollowBtn: {
        borderWidth: 1,
        borderColor: Colors.light.border,
        borderRadius: Radii.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    unfollowBtnText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '500',
        color: Colors.light.textSecondary,
    },

    empty: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
    emptyText: {
        fontSize: Typography.sizes.base,
        fontWeight: '500',
        color: Colors.light.textSecondary,
    },
    emptySubtext: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
        marginTop: Spacing.xs,
        lineHeight: 18,
    },
});
