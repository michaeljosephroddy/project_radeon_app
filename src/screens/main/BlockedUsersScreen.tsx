import { appAlert } from '@/components/ui/appAlert';
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
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/client';
import { Avatar } from '../../components/Avatar';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { ContentInsets, Colors, Radius, Spacing, Typography } from '../../theme';
import { formatReadableTimestamp } from '../../utils/date';
import { formatUsername } from '../../utils/identity';

const PAGE_SIZE = 25;

interface BlockedUsersScreenProps {
    onBack: () => void;
}

interface RemovedBlockedUser {
    item: api.BlockedUser;
    index: number;
}

export function BlockedUsersScreen({ onBack }: BlockedUsersScreenProps) {
    const queryClient = useQueryClient();
    const [items, setItems] = useState<api.BlockedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [pendingUnblockIds, setPendingUnblockIds] = useState<Set<string>>(new Set());
    const cursorRef = useRef<string | undefined>(undefined);

    const applyPage = useCallback((page: api.CursorResponse<api.BlockedUser>, replace: boolean): void => {
        cursorRef.current = page.next_cursor ?? undefined;
        setHasMore(page.has_more);
        setItems((current) => replace ? (page.items ?? []) : [...current, ...(page.items ?? [])]);
        setLoadError(false);
    }, []);

    const loadFirstPage = useCallback(async (): Promise<void> => {
        const page = await api.getBlockedUsers(undefined, PAGE_SIZE);
        applyPage(page, true);
    }, [applyPage]);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        void api.getBlockedUsers(undefined, PAGE_SIZE)
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
            appAlert.alert('Could not refresh blocked users', error instanceof Error ? error.message : 'Please try again.');
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
            const page = await api.getBlockedUsers(cursorRef.current, PAGE_SIZE);
            applyPage(page, false);
        } catch (error: unknown) {
            appAlert.alert('Could not load more blocked users', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setIsLoadingMore(false);
        }
    }, [applyPage, hasMore, isLoadingMore]);
    const pagination = useGuardedEndReached(handleLoadMore);

    const invalidateSafetyCaches = useCallback(async (userId: string): Promise<void> => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['discover-suggested'] }),
            queryClient.invalidateQueries({ queryKey: ['discover-filtered'] }),
            queryClient.invalidateQueries({ queryKey: ['discover-search'] }),
            queryClient.invalidateQueries({ queryKey: ['dating-discover'] }),
            queryClient.invalidateQueries({ queryKey: ['user', userId] }),
        ]);
    }, [queryClient]);

    const confirmUnblock = useCallback((blockedUser: api.BlockedUser): void => {
        if (pendingUnblockIds.has(blockedUser.user.id)) return;

        appAlert.alert(
            'Unblock user?',
            `${formatUsername(blockedUser.user.username)} may be able to message you or appear in discovery again.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Unblock',
                    onPress: () => {
                        void (async () => {
                            const index = items.findIndex((item) => item.user.id === blockedUser.user.id);
                            const removed: RemovedBlockedUser | null = index >= 0 ? { item: blockedUser, index } : null;
                            setPendingUnblockIds((current) => new Set(current).add(blockedUser.user.id));
                            setItems((current) => current.filter((item) => item.user.id !== blockedUser.user.id));

                            try {
                                await api.unblockUser(blockedUser.user.id);
                                await invalidateSafetyCaches(blockedUser.user.id);
                            } catch (error: unknown) {
                                if (removed) {
                                    setItems((current) => {
                                        if (current.some((item) => item.user.id === removed?.item.user.id)) return current;
                                        const next = [...current];
                                        next.splice(Math.min(removed.index, next.length), 0, removed.item);
                                        return next;
                                    });
                                }
                                appAlert.alert('Could not unblock user', error instanceof Error ? error.message : 'Please try again.');
                            } finally {
                                setPendingUnblockIds((current) => {
                                    const next = new Set(current);
                                    next.delete(blockedUser.user.id);
                                    return next;
                                });
                            }
                        })();
                    },
                },
            ],
        );
    }, [invalidateSafetyCaches, items, pendingUnblockIds]);

    const renderItem = useCallback(({ item }: { item: api.BlockedUser }) => {
        const isPending = pendingUnblockIds.has(item.user.id);
        const location = [item.user.city, item.user.country].filter(Boolean).join(', ');

        return (
            <View style={styles.row}>
                <Avatar username={item.user.username} avatarUrl={item.user.avatar_url ?? undefined} size={44} fontSize={14} />
                <View style={styles.rowBody}>
                    <Text style={styles.username} numberOfLines={1}>{formatUsername(item.user.username)}</Text>
                    {location ? <Text style={styles.location} numberOfLines={1}>{location}</Text> : null}
                    <Text style={styles.blockedAt} numberOfLines={1}>Blocked {formatReadableTimestamp(item.blocked_at)}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.unblockButton, isPending && styles.unblockButtonDisabled]}
                    onPress={() => confirmUnblock(item)}
                    disabled={isPending}
                >
                    {isPending
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <Text style={styles.unblockButtonText}>Unblock</Text>}
                </TouchableOpacity>
            </View>
        );
    }, [confirmUnblock, pendingUnblockIds]);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={['bottom']}>
                <ScreenHeader onBack={onBack} title="Blocked users" />
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (loadError && items.length === 0) {
        return (
            <SafeAreaView style={styles.container} edges={['bottom']}>
                <ScreenHeader onBack={onBack} title="Blocked users" />
                <View style={styles.center}>
                    <Text style={styles.errorText}>Could not load blocked users.</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                        <Text style={styles.retryButtonText}>Retry</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader onBack={onBack} title="Blocked users" />
            <FlatList
                data={items}
                keyExtractor={(item) => item.user.id}
                renderItem={renderItem}
                contentContainerStyle={items.length > 0 ? styles.listContent : styles.emptyContent}
                onEndReached={pagination.onEndReached}
                onEndReachedThreshold={0.4}
                onMomentumScrollBegin={pagination.onMomentumScrollBegin}
                onScrollBeginDrag={pagination.onScrollBeginDrag}
                refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
                ListEmptyComponent={<Text style={styles.emptyText}>You have not blocked anyone.</Text>}
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
    blockedAt: {
        fontSize: Typography.sizes.xs,
        color: Colors.text.muted,
    },
    unblockButton: {
        minWidth: 88,
        minHeight: 38,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unblockButtonDisabled: {
        opacity: 0.7,
    },
    unblockButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.primary,
    },
    footerLoader: {
        paddingVertical: Spacing.md,
    },
});
