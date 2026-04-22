import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    TextInput,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { useDiscover } from '../../hooks/queries/useDiscover';
import { queryKeys } from '../../query/queryKeys';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';

interface DiscoverScreenProps {
    isActive: boolean;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}

function updateDiscoverUsers(
    data: InfiniteData<api.PaginatedResponse<api.User>> | undefined,
    userId: string,
    friendshipStatus: api.User['friendship_status'],
): InfiniteData<api.PaginatedResponse<api.User>> | undefined {
    if (!data) return data;

    return {
        ...data,
        pages: data.pages.map((page) => ({
            ...page,
            items: (page.items ?? []).map((item) => (
                item.id === userId ? { ...item, friendship_status: friendshipStatus } : item
            )),
        })),
    };
}

// Renders the discover tab with debounced user search and friendship actions.
export function DiscoverScreen({
    isActive,
    onOpenUserProfile,
}: DiscoverScreenProps) {
    const queryClient = useQueryClient();
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [pendingFriendActions, setPendingFriendActions] = useState<Set<string>>(new Set());
    const discoverQuery = useDiscover({ query: debouncedQuery, limit: 20 }, isActive);
    const users = useMemo(
        () => discoverQuery.data?.pages.flatMap((page) => page.items ?? []) ?? [],
        [discoverQuery.data],
    );

    useEffect(() => {
        // Debounce typing so search stays responsive without issuing a request on
        // every keystroke.
        const timer = setTimeout(() => setDebouncedQuery(query.trim()), 250);
        return () => clearTimeout(timer);
    }, [query]);

    const onRefresh = async () => {
        await discoverQuery.refetch();
    };

    const handleFriendAction = useCallback(async (user: api.User) => {
        const current = user.friendship_status;
        if (current === 'friends') return;

        setPendingFriendActions(prev => new Set(prev).add(user.id));

        try {
            if (current === 'incoming') {
                await api.updateFriendRequest(user.id, 'accept');
                queryClient.setQueryData<InfiniteData<api.PaginatedResponse<api.User>>>(
                    queryKeys.discover({ query: debouncedQuery, limit: 20 }),
                    (data) => updateDiscoverUsers(data, user.id, 'friends'),
                );
            } else if (current === 'outgoing') {
                await api.cancelFriendRequest(user.id);
                queryClient.setQueryData<InfiniteData<api.PaginatedResponse<api.User>>>(
                    queryKeys.discover({ query: debouncedQuery, limit: 20 }),
                    (data) => updateDiscoverUsers(data, user.id, 'none'),
                );
            } else {
                await api.sendFriendRequest(user.id);
                queryClient.setQueryData<InfiniteData<api.PaginatedResponse<api.User>>>(
                    queryKeys.discover({ query: debouncedQuery, limit: 20 }),
                    (data) => updateDiscoverUsers(data, user.id, 'outgoing'),
                );
            }
        } catch {
            queryClient.setQueryData<InfiniteData<api.PaginatedResponse<api.User>>>(
                queryKeys.discover({ query: debouncedQuery, limit: 20 }),
                (data) => updateDiscoverUsers(data, user.id, current),
            );
        } finally {
            setPendingFriendActions(prev => {
                const updated = new Set(prev);
                updated.delete(user.id);
                return updated;
            });
        }
    }, [debouncedQuery, queryClient]);

    // Infinite scroll only asks for the next discover page for the active
    // query, keeping paging and search state tied together.
    const handleLoadMore = async () => {
        if (!isActive || discoverQuery.isFetchingNextPage || discoverQuery.isRefetching || discoverQuery.isLoading || !discoverQuery.hasNextPage) return;
        await discoverQuery.fetchNextPage();
    };

    // Builds the small result-count label shown above the grid.
    const resultLabel = (() => {
        if (debouncedQuery) {
            return users.length === 1 ? '1 result' : `${users.length} results`;
        }
        return users.length === 1 ? '1 person' : `${users.length} people`;
    })();

    if (discoverQuery.isLoading && users.length === 0) {
        return (
            <View style={styles.center}>
                <ActivityIndicator color={Colors.primary} />
            </View>
        );
    }

    return (
        <FlatList
            data={users}
            keyExtractor={item => item.id}
            numColumns={2}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.list}
            refreshControl={
                <RefreshControl
                    refreshing={discoverQuery.isRefetching && !discoverQuery.isFetchingNextPage}
                    onRefresh={onRefresh}
                    tintColor={Colors.primary}
                />
            }
            keyboardShouldPersistTaps="handled"
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.4}
            ListHeaderComponent={
                <View style={styles.headerBlock}>
                    <View style={styles.heroCard}>
                        <Text style={styles.heroEyebrow}>DISCOVER</Text>
                        <Text style={styles.heroTitle}>Find people in the community.</Text>
                        <Text style={styles.heroText}>
                            Search by username now.
                        </Text>
                    </View>

                    <View style={styles.searchShell}>
                        <Ionicons name="search" size={18} color={Colors.light.textTertiary} />
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search by username"
                            placeholderTextColor={Colors.light.textTertiary}
                            style={styles.searchInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    <View style={styles.resultsRow}>
                        <Text style={styles.resultsLabel}>{resultLabel}</Text>
                        {!!debouncedQuery && (
                            <TouchableOpacity onPress={() => setQuery('')}>
                                <Text style={styles.clearText}>Clear</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            }
            ListEmptyComponent={
                <View style={styles.empty}>
                    <Text style={styles.emptyTitle}>No people found.</Text>
                    <Text style={styles.emptyText}>
                        Try a different username search. Suggestions can become smarter once ranking logic is added.
                    </Text>
                </View>
            }
            ListFooterComponent={discoverQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
            renderItem={({ item }) => {
                const friendshipStatus = item.friendship_status;
                const pending = pendingFriendActions.has(item.id);
                const buttonLabel = friendshipStatus === 'friends'
                    ? 'Friends'
                    : friendshipStatus === 'incoming'
                        ? 'Accept'
                        : friendshipStatus === 'outgoing'
                            ? 'Requested'
                            : '+ Friend';

                return (
                    <View style={styles.cardWrap}>
                        <View style={styles.card}>
                            <TouchableOpacity
                                activeOpacity={0.9}
                                style={styles.cardPress}
                                onPress={() => onOpenUserProfile({
                                    userId: item.id,
                                    username: item.username,
                                    avatarUrl: item.avatar_url,
                                })}
                            >
                                <View style={styles.avatarStage}>
                                    <Avatar
                                        username={item.username}
                                        avatarUrl={item.avatar_url}
                                        size={92}
                                        fontSize={28}
                                    />
                                </View>
                                <Text style={styles.cardName} numberOfLines={1}>
                                    {formatUsername(item.username)}
                                </Text>
                                <Text style={styles.cardMeta} numberOfLines={1}>
                                    {item.city ? `${item.city}${item.country ? `, ${item.country}` : ''}` : 'Community member'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.followButton,
                                    friendshipStatus === 'outgoing' && styles.requestedButton,
                                    friendshipStatus === 'friends' && styles.followingButton,
                                    pending && styles.buttonDisabled,
                                ]}
                                onPress={() => handleFriendAction(item)}
                                disabled={pending || friendshipStatus === 'friends'}
                            >
                                <Text style={[styles.followButtonText, friendshipStatus === 'friends' && styles.followingButtonText]}>
                                    {buttonLabel}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                );
            }}
        />
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.background,
    },
    list: {
        paddingHorizontal: Spacing.md,
        paddingBottom: 32,
    },
    headerBlock: {
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
        gap: Spacing.md,
    },
    heroCard: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.lg,
        padding: Spacing.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    heroEyebrow: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.primary,
        letterSpacing: 0.8,
        marginBottom: 6,
    },
    heroTitle: {
        fontSize: Typography.sizes.xl,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    heroText: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textSecondary,
        lineHeight: 19,
        marginTop: Spacing.sm,
    },
    searchShell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        borderWidth: 1,
        borderColor: Colors.light.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: Typography.sizes.base,
        color: Colors.light.textPrimary,
        padding: 0,
    },
    resultsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    resultsLabel: {
        fontSize: Typography.sizes.sm,
        fontWeight: '500',
        color: Colors.light.textSecondary,
    },
    clearText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.primary,
    },
    gridRow: {
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    cardWrap: {
        flex: 1,
        maxWidth: '48.5%',
    },
    card: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: Colors.light.border,
        overflow: 'hidden',
    },
    cardPress: {
        flex: 1,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
    },
    avatarStage: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.sm,
        marginBottom: Spacing.sm,
    },
    cardName: {
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: Colors.light.textPrimary,
        textAlign: 'center',
    },
    cardMeta: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
        textAlign: 'center',
        marginTop: 4,
        minHeight: 18,
    },
    followButton: {
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: Colors.light.border,
    },
    requestedButton: {
        backgroundColor: Colors.success,
    },
    followingButton: {
        backgroundColor: Colors.light.background,
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    followButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.textOn.primary,
    },
    followingButtonText: {
        color: Colors.light.textSecondary,
    },
    empty: {
        alignItems: 'center',
        paddingTop: 72,
        paddingHorizontal: Spacing.lg,
    },
    emptyTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    emptyText: {
        fontSize: Typography.sizes.base,
        color: Colors.light.textTertiary,
        textAlign: 'center',
        lineHeight: 20,
        marginTop: Spacing.sm,
    },
    footerLoader: {
        paddingVertical: Spacing.md,
    },
});
