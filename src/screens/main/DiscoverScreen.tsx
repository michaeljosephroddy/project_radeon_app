import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ListRenderItemInfo,
    RefreshControl,
    ActivityIndicator,
} from 'react-native';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { HeroCard } from '../../components/ui/HeroCard';
import { SearchBar } from '../../components/ui/SearchBar';
import * as api from '../../api/client';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useRefetchOnActiveIfStale } from '../../hooks/useRefetchOnActiveIfStale';
import { useDiscover } from '../../hooks/queries/useDiscover';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { Colors, Typography, Spacing } from '../../utils/theme';
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
    const flatListRef = useRef<FlatList<api.User> | null>(null);
    const hasActivated = useLazyActivation(isActive);
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [pendingFriendActions, setPendingFriendActions] = useState<Set<string>>(new Set());
    const discoverListProps = getListPerformanceProps('twoColumnGrid');
    const discoverQuery = useDiscover({ query: debouncedQuery, limit: 20 }, hasActivated);
    useRefetchOnActiveIfStale(isActive, discoverQuery);
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
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.discover({ query: debouncedQuery, limit: 20 }));
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
    const discoverListPagination = useGuardedEndReached(handleLoadMore);

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
            ref={flatListRef}
            data={users}
            keyExtractor={item => item.id}
            {...discoverListProps}
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
            onEndReached={discoverListPagination.onEndReached}
            onEndReachedThreshold={0.4}
            onMomentumScrollBegin={discoverListPagination.onMomentumScrollBegin}
            onScrollBeginDrag={discoverListPagination.onScrollBeginDrag}
            ListHeaderComponent={
                <View style={styles.headerBlock}>
                    <HeroCard
                        eyebrow="DISCOVER"
                        title="Find people in the community."
                        description="Search by username now."
                    />

                    <SearchBar
                        leading={<Ionicons name="search" size={18} color={Colors.light.textTertiary} />}
                        primaryField={{
                            value: query,
                            onChangeText: setQuery,
                            placeholder: 'Search by username',
                            autoCapitalize: 'none',
                            autoCorrect: false,
                        }}
                    />

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
                <EmptyState
                    title="No people found."
                    description="Try a different username search. Suggestions can become smarter once ranking logic is added."
                    style={styles.empty}
                    titleStyle={styles.emptyTitle}
                    descriptionStyle={styles.emptyText}
                />
            }
            ListFooterComponent={discoverQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
            renderItem={({ item }: ListRenderItemInfo<api.User>) => {
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
    empty: { paddingTop: 72 },
    emptyTitle: { fontWeight: '600' },
    emptyText: { lineHeight: 20 },
    footerLoader: {
        paddingVertical: Spacing.md,
    },
});
