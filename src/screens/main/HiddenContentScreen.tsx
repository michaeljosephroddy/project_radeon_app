import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Avatar } from '../../components/Avatar';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import * as api from '../../api/client';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatReadableTimestamp } from '../../utils/date';
import { formatUsername } from '../../utils/identity';

interface HiddenContentScreenProps {
    onBack: () => void;
    onOpenUserProfile: (profile: { userId: string; username: string; avatarUrl?: string }) => void;
}

export function HiddenContentScreen({ onBack, onOpenUserProfile }: HiddenContentScreenProps) {
    const [items, setItems] = useState<api.HiddenFeedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [pendingRestoreIds, setPendingRestoreIds] = useState<Set<string>>(new Set());
    const cursorRef = useRef<string | undefined>(undefined);

    const loadHiddenItems = useCallback(async (cursor?: string, replace = true) => {
        const page = await api.getHiddenFeedItems(cursor, 20);
        cursorRef.current = page.next_cursor ?? undefined;
        setHasMore(page.has_more);
        setItems((current) => replace ? (page.items ?? []) : [...current, ...(page.items ?? [])]);
    }, []);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        void loadHiddenItems(undefined, true)
            .catch(() => {
                if (!cancelled) {
                    Alert.alert('Error', 'Could not load hidden content.');
                }
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [loadHiddenItems]);

    const handleLoadMore = useCallback(async () => {
        if (isLoadingMore || !hasMore) return;
        setIsLoadingMore(true);
        try {
            await loadHiddenItems(cursorRef.current, false);
        } catch {
            Alert.alert('Error', 'Could not load more hidden content.');
        } finally {
            setIsLoadingMore(false);
        }
    }, [hasMore, isLoadingMore, loadHiddenItems]);
    const pagination = useGuardedEndReached(handleLoadMore);

    const handleRestore = useCallback((hiddenItem: api.HiddenFeedItem) => {
        setPendingRestoreIds((current) => new Set(current).add(hiddenItem.item_id));
        void (async () => {
            try {
                await api.unhideFeedItem({ itemId: hiddenItem.item_id, itemKind: hiddenItem.item_kind });
                setItems((current) => current.filter((item) => item.item_id !== hiddenItem.item_id));
            } catch (error) {
                Alert.alert('Could not restore item', error instanceof Error ? error.message : 'Please try again.');
            } finally {
                setPendingRestoreIds((current) => {
                    const next = new Set(current);
                    next.delete(hiddenItem.item_id);
                    return next;
                });
            }
        })();
    }, []);

    const renderItem = useCallback(({ item }: { item: api.HiddenFeedItem }) => {
        const isPending = pendingRestoreIds.has(item.item_id);
        const feedItem = item.item;
        const original = feedItem.original_post;
        const subtitle = feedItem.kind === 'reshare' && original
            ? `Reshare of ${formatUsername(original.author.username)}`
            : 'Post';
        const previewText = feedItem.kind === 'reshare' && original
            ? (feedItem.body.trim() || original.body.trim() || 'No text')
            : (feedItem.body.trim() || 'No text');

        return (
            <View style={styles.card}>
                <TouchableOpacity
                    style={styles.cardMain}
                    onPress={() => onOpenUserProfile({
                        userId: feedItem.author.user_id,
                        username: feedItem.author.username,
                        avatarUrl: feedItem.author.avatar_url ?? undefined,
                    })}
                >
                    <Avatar username={feedItem.author.username} avatarUrl={feedItem.author.avatar_url ?? undefined} size={42} />
                    <View style={styles.cardBody}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardAuthor}>{formatUsername(feedItem.author.username)}</Text>
                            <Text style={styles.cardMeta}>{formatReadableTimestamp(item.hidden_at)}</Text>
                        </View>
                        <Text style={styles.cardSubtitle}>{subtitle}</Text>
                        <Text style={styles.cardPreview} numberOfLines={3}>{previewText}</Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.restoreButton, isPending && styles.restoreButtonDisabled]}
                    onPress={() => handleRestore(item)}
                    disabled={isPending}
                >
                    {isPending
                        ? <ActivityIndicator size="small" color={Colors.primary} />
                        : <Text style={styles.restoreButtonText}>Restore</Text>}
                </TouchableOpacity>
            </View>
        );
    }, [handleRestore, onOpenUserProfile, pendingRestoreIds]);

    if (isLoading) {
        return (
            <SafeAreaView style={styles.container} edges={['bottom']}>
                <ScreenHeader onBack={onBack} title="Hidden content" />
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <ScreenHeader onBack={onBack} title="Hidden content" />
            <FlatList
                data={items}
                keyExtractor={(item) => `${item.item_kind}:${item.item_id}`}
                renderItem={renderItem}
                contentContainerStyle={items.length > 0 ? styles.listContent : styles.emptyContent}
                onEndReached={pagination.onEndReached}
                onEndReachedThreshold={0.4}
                onMomentumScrollBegin={pagination.onMomentumScrollBegin}
                onScrollBeginDrag={pagination.onScrollBeginDrag}
                ListEmptyComponent={<Text style={styles.emptyText}>You have not hidden any posts yet.</Text>}
                ListFooterComponent={isLoadingMore ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    listContent: {
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    emptyContent: {
        flexGrow: 1,
        padding: Spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyText: {
        fontSize: Typography.sizes.base,
        color: Colors.light.textSecondary,
        textAlign: 'center',
    },
    card: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.lg,
        borderWidth: 1,
        borderColor: Colors.light.border,
        padding: Spacing.md,
        gap: Spacing.sm,
    },
    cardMain: {
        flexDirection: 'row',
        gap: Spacing.sm,
    },
    cardBody: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: Spacing.sm,
        alignItems: 'center',
    },
    cardAuthor: {
        flex: 1,
        fontSize: Typography.sizes.base,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    cardMeta: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
    },
    cardSubtitle: {
        fontSize: Typography.sizes.sm,
        color: Colors.primary,
        fontWeight: '600',
    },
    cardPreview: {
        fontSize: Typography.sizes.sm,
        lineHeight: 20,
        color: Colors.light.textSecondary,
    },
    restoreButton: {
        alignSelf: 'flex-start',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderRadius: Radii.pill,
        backgroundColor: Colors.light.background,
        borderWidth: 1,
        borderColor: Colors.primary,
    },
    restoreButtonDisabled: {
        opacity: 0.7,
    },
    restoreButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.primary,
    },
    footerLoader: {
        paddingVertical: Spacing.md,
    },
});
