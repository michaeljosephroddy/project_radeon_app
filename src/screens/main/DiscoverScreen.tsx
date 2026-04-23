import React, { useEffect, useState, useMemo, useRef } from 'react';
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
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { HeroCard } from '../../components/ui/HeroCard';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import { SearchBar } from '../../components/ui/SearchBar';
import * as api from '../../api/client';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useRefetchOnActiveIfStale } from '../../hooks/useRefetchOnActiveIfStale';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
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

// Renders the discover tab with debounced user search and profile-first cards.
export function DiscoverScreen({
    isActive,
    onOpenUserProfile,
}: DiscoverScreenProps) {
    const queryClient = useQueryClient();
    const flatListRef = useRef<FlatList<api.User> | null>(null);
    const hasActivated = useLazyActivation(isActive);
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const discoverListProps = getListPerformanceProps('twoColumnGrid');
    const discoverQuery = useDiscover({ query: debouncedQuery, limit: 20 }, hasActivated);
    useRefetchOnActiveIfStale(isActive, discoverQuery);
    const discoverScrollToTop = useScrollToTopButton({ threshold: 360 });
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
        <View style={styles.container}>
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
            onScroll={discoverScrollToTop.onScroll}
            scrollEventThrottle={16}
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
            renderItem={({ item }: ListRenderItemInfo<api.User>) => (
                <View style={styles.cardWrap}>
                    <TouchableOpacity
                        activeOpacity={0.9}
                        style={styles.card}
                        onPress={() => onOpenUserProfile({
                            userId: item.id,
                            username: item.username,
                            avatarUrl: item.avatar_url,
                        })}
                    >
                        <View style={styles.cardPress}>
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
                        </View>
                    </TouchableOpacity>
                </View>
            )}
            />
            {discoverScrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
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
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.lg,
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
    empty: { paddingTop: 72 },
    emptyTitle: { fontWeight: '600' },
    emptyText: { lineHeight: 20 },
    footerLoader: {
        paddingVertical: Spacing.md,
    },
});
