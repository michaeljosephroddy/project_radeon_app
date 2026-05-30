import { appAlert } from '@/components/ui/appAlert';
import { useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '../../api/client';
import { Avatar } from '../../components/Avatar';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { AvatarSizes, ContentInsets, Colors, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { formatReadableTimestamp } from '../../utils/date';
import { formatUsername } from '../../utils/identity';

const PAGE_SIZE = 25;

interface MutedAuthorsScreenProps {
    onBack: () => void;
}

interface RemovedMutedAuthor {
    item: api.MutedFeedAuthor;
    index: number;
}

export function MutedAuthorsScreen({ onBack }: MutedAuthorsScreenProps) {
    const queryClient = useQueryClient();
    const [items, setItems] = useState<api.MutedFeedAuthor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [pendingUnmuteIds, setPendingUnmuteIds] = useState<Set<string>>(new Set());
    const cursorRef = useRef<string | undefined>(undefined);

    const applyPage = useCallback((page: api.CursorResponse<api.MutedFeedAuthor>, replace: boolean): void => {
        cursorRef.current = page.next_cursor ?? undefined;
        setHasMore(page.has_more);
        setItems((current) => replace ? (page.items ?? []) : [...current, ...(page.items ?? [])]);
        setLoadError(false);
    }, []);

    const loadFirstPage = useCallback(async (): Promise<void> => {
        const page = await api.getMutedFeedAuthors(undefined, PAGE_SIZE);
        applyPage(page, true);
    }, [applyPage]);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        void api.getMutedFeedAuthors(undefined, PAGE_SIZE)
            .then((page) => {
                if (!cancelled) applyPage(page, true);
            })
            .catch(() => {
                if (!cancelled) setLoadError(true);
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [applyPage]);

    const handleRefresh = useCallback(async (): Promise<void> => {
        setIsRefreshing(true);
        try {
            await loadFirstPage();
        } catch (error: unknown) {
            appAlert.alert('Could not refresh muted authors', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setIsRefreshing(false);
        }
    }, [loadFirstPage]);

    const handleRetry = useCallback((): void => {
        setIsLoading(true);
        void loadFirstPage()
            .catch(() => setLoadError(true))
            .finally(() => setIsLoading(false));
    }, [loadFirstPage]);

    const handleLoadMore = useCallback(async (): Promise<void> => {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        try {
            const page = await api.getMutedFeedAuthors(cursorRef.current, PAGE_SIZE);
            applyPage(page, false);
        } catch (error: unknown) {
            appAlert.alert('Could not load more muted authors', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setIsLoadingMore(false);
        }
    }, [applyPage, hasMore, isLoadingMore]);
    const pagination = useGuardedEndReached(handleLoadMore);

    const invalidateFeed = useCallback(async (): Promise<void> => {
        await queryClient.invalidateQueries({ queryKey: ['home-feed'] });
    }, [queryClient]);

    const confirmUnmute = useCallback((mutedAuthor: api.MutedFeedAuthor): void => {
        if (pendingUnmuteIds.has(mutedAuthor.author.id)) return;

        appAlert.alert(
            'Unmute author?',
            `Posts from ${formatUsername(mutedAuthor.author.username)} may appear in your feed again.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unmute',
                    onPress: () => {
                        void (async () => {
                            const index = items.findIndex((item) => item.author.id === mutedAuthor.author.id);
                            const removed: RemovedMutedAuthor | null = index >= 0 ? { item: mutedAuthor, index } : null;
                            setPendingUnmuteIds((current) => new Set(current).add(mutedAuthor.author.id));
                            setItems((current) => current.filter((item) => item.author.id !== mutedAuthor.author.id));

                            try {
                                await api.unmuteFeedAuthor(mutedAuthor.author.id);
                                await invalidateFeed();
                            } catch (error: unknown) {
                                if (removed) {
                                    setItems((current) => {
                                        if (current.some((item) => item.author.id === removed.item.author.id)) return current;
                                        const next = [...current];
                                        next.splice(Math.min(removed.index, next.length), 0, removed.item);
                                        return next;
                                    });
                                }
                                appAlert.alert('Could not unmute author', error instanceof Error ? error.message : 'Please try again.');
                            } finally {
                                setPendingUnmuteIds((current) => {
                                    const next = new Set(current);
                                    next.delete(mutedAuthor.author.id);
                                    return next;
                                });
                            }
                        })();
                    },
                },
            ],
        );
    }, [invalidateFeed, items, pendingUnmuteIds]);

    const renderItem = useCallback(({ item }: { item: api.MutedFeedAuthor }) => {
        const isPending = pendingUnmuteIds.has(item.author.id);
        const location = [item.author.city, item.author.country].filter(Boolean).join(', ');

        return (
            <View style={styles.row}>
                <Avatar username={item.author.username} avatarUrl={item.author.avatar_url ?? undefined} size={AvatarSizes.list} fontSize={TextStyles.label.fontSize} />
                <View style={styles.rowBody}>
                    <Text style={styles.username} numberOfLines={1}>{formatUsername(item.author.username)}</Text>
                    {location ? <Text style={styles.location} numberOfLines={1}>{location}</Text> : null}
                    <Text style={styles.mutedAt} numberOfLines={1}>Muted {formatReadableTimestamp(item.muted_at)}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.unmuteButton, isPending && styles.unmuteButtonDisabled]}
                    onPress={() => confirmUnmute(item)}
                    disabled={isPending}
                >
                    {isPending
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <Text style={styles.unmuteButtonText}>Unmute</Text>}
                </TouchableOpacity>
            </View>
        );
    }, [confirmUnmute, pendingUnmuteIds]);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScreenHeader onBack={onBack} title="Muted authors" />
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (loadError && items.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScreenHeader onBack={onBack} title="Muted authors" />
                <View style={styles.center}>
                    <Text style={styles.errorText}>Could not load muted authors.</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <ScreenHeader onBack={onBack} title="Muted authors" />
            <FlatList
                data={items}
                keyExtractor={(item) => item.author.id}
                renderItem={renderItem}
                contentContainerStyle={items.length > 0 ? styles.listContent : styles.emptyContent}
                onEndReached={pagination.onEndReached}
                onEndReachedThreshold={0.4}
                onMomentumScrollBegin={pagination.onMomentumScrollBegin}
                onScrollBeginDrag={pagination.onScrollBeginDrag}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
                ListEmptyComponent={<Text style={styles.emptyText}>You have not muted anyone.</Text>}
                ListFooterComponent={isLoadingMore ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: Spacing.xl,
    },
    listContent: {
        paddingTop: Spacing.md,
        paddingBottom: Spacing.md,
    },
    emptyContent: {
        flexGrow: 1,
        padding: Spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: Typography.sizes.base,
        color: Colors.text.secondary,
        textAlign: 'center',
    },
    errorText: {
        fontSize: Typography.sizes.base,
        color: Colors.text.secondary,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: Spacing.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    retryButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.primary,
    },
    row: {
        minHeight: 76,
        paddingVertical: Spacing.md,
        paddingHorizontal: ContentInsets.screenHorizontal,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.emphasis,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    rowBody: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    username: {
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    location: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
    },
    mutedAt: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.muted,
    },
    unmuteButton: {
        minWidth: 88,
        minHeight: 38,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unmuteButtonDisabled: {
        opacity: 0.7,
    },
    unmuteButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.primary,
    },
    footerLoader: {
        paddingVertical: Spacing.md,
    },
});
