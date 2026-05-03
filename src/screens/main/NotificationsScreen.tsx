import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import * as api from '../../api/client';
import { useNotifications } from '../../hooks/queries/useNotifications';
import { useNotificationSummary } from '../../hooks/queries/useNotificationSummary';
import { queryKeys } from '../../query/queryKeys';
import { Colors, ControlSizes, Header, Radius, Spacing, TextStyles } from '../../theme';
import { formatReadableTimestamp } from '../../utils/date';
import { formatUsername } from '../../utils/identity';
import { dedupeById } from '../../utils/list';

interface NotificationsScreenProps {
    isActive: boolean;
    onBack: () => void;
    onOpenChat: (chatId: string) => Promise<void> | void;
    onOpenMention: (target: { postId: string; commentId?: string }) => void;
    onOpenGroup: (groupId: string, postId?: string) => void;
}

interface NotificationRowProps {
    item: api.NotificationItem;
    pending: boolean;
    onPress: (item: api.NotificationItem) => void;
}

const PAGE_SIZE = 20;

function readPayloadString(payload: Record<string, unknown>, key: string): string | null {
    const value = payload[key];
    return typeof value === 'string' && value.trim() ? value : null;
}

function getNotificationIcon(type: string): keyof typeof Ionicons.glyphMap {
    if (type === 'chat.message') return 'chatbubble-outline';
    if (type === 'comment.mention') return 'at-outline';
    if (type === 'support.offer') return 'heart-outline';
    if (type.startsWith('group.')) return 'people-outline';
    return 'notifications-outline';
}

function getNotificationTitle(item: api.NotificationItem): string {
    if (item.type === 'chat.message') {
        return `${formatUsername(item.title)} sent you a message`;
    }
    if (item.type === 'comment.mention') {
        return `${formatUsername(item.title)} mentioned you`;
    }
    if (item.type === 'group.join_request') return `New request in ${item.title}`;
    if (item.type === 'group.join_approved') return `You're in ${item.title}`;
    if (item.type === 'group.post') return `New post in ${item.title}`;
    if (item.type === 'group.comment') return `New comment in ${item.title}`;
    if (item.type === 'group.admin_contact') return `Admin inbox: ${item.title}`;
    if (item.type === 'group.admin_reply') return `Admin reply from ${item.title}`;
    if (item.type === 'group.report') return `New report in ${item.title}`;
    if (item.type === 'support.offer') return `Support offer in ${item.title}`;
    return item.title;
}

const NotificationRow = React.memo(function NotificationRow({ item, pending, onPress }: NotificationRowProps) {
    const isUnread = !item.read_at;
    const handlePress = useCallback(() => onPress(item), [item, onPress]);

    return (
        <TouchableOpacity
            style={[styles.row, isUnread && styles.rowUnread, pending && styles.rowPending]}
            onPress={handlePress}
            disabled={pending}
        >
            <View style={styles.avatarSlot}>
                {item.type === 'chat.message' ? (
                    <Avatar username={item.title || 'chat'} size={36} fontSize={12} />
                ) : (
                    <View style={styles.iconCircle}>
                        <Ionicons name={getNotificationIcon(item.type)} size={19} color={Colors.primary} />
                    </View>
                )}
                {isUnread ? <View style={styles.unreadDot} /> : null}
            </View>
            <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, isUnread && styles.rowTitleUnread]} numberOfLines={2}>
                    {getNotificationTitle(item)}
                </Text>
                <Text style={styles.rowText} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.rowMeta}>{formatReadableTimestamp(item.created_at)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.text.muted} />
        </TouchableOpacity>
    );
}, areNotificationRowPropsEqual);

export function NotificationsScreen({
    isActive,
    onBack,
    onOpenChat,
    onOpenMention,
    onOpenGroup,
}: NotificationsScreenProps) {
    const queryClient = useQueryClient();
    const notificationsQuery = useNotifications(PAGE_SIZE, isActive);
    const summaryQuery = useNotificationSummary(isActive);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [markingAllRead, setMarkingAllRead] = useState(false);
    const notifications = useMemo(
        () => dedupeById(notificationsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []),
        [notificationsQuery.data],
    );
    const unreadCount = summaryQuery.data?.unread_count ?? 0;

    const invalidateNotifications = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications({ limit: PAGE_SIZE }) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.notificationSummary() });
    }, [queryClient]);

    const handleRefresh = useCallback(async () => {
        await Promise.all([
            notificationsQuery.refetch(),
            summaryQuery.refetch(),
        ]);
    }, [notificationsQuery, summaryQuery]);

    const handleEndReached = useCallback(() => {
        if (!notificationsQuery.hasNextPage || notificationsQuery.isFetchingNextPage) return;
        void notificationsQuery.fetchNextPage();
    }, [notificationsQuery]);

    const handleMarkAllRead = useCallback(async () => {
        if (unreadCount <= 0 || markingAllRead) return;
        setMarkingAllRead(true);
        try {
            await api.markAllNotificationsRead();
            invalidateNotifications();
        } catch (error: unknown) {
            Alert.alert('Could not update notifications', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setMarkingAllRead(false);
        }
    }, [invalidateNotifications, markingAllRead, unreadCount]);

    const handlePressNotification = useCallback(async (item: api.NotificationItem) => {
        if (pendingId) return;
        setPendingId(item.id);
        try {
            if (!item.read_at) {
                await api.markNotificationRead(item.id);
                invalidateNotifications();
            }

            if (item.type === 'chat.message') {
                const chatId = readPayloadString(item.payload, 'chat_id');
                if (!chatId) {
                    Alert.alert('Notification unavailable', 'This chat notification can no longer be opened.');
                    return;
                }
                await onOpenChat(chatId);
                return;
            }

            if (item.type === 'comment.mention') {
                const postId = readPayloadString(item.payload, 'post_id');
                if (!postId) {
                    Alert.alert('Notification unavailable', 'This mention notification can no longer be opened.');
                    return;
                }
                onOpenMention({
                    postId,
                    commentId: readPayloadString(item.payload, 'comment_id') ?? undefined,
                });
                return;
            }

            if (item.type.startsWith('group.')) {
                const groupId = readPayloadString(item.payload, 'group_id');
                if (!groupId) {
                    Alert.alert('Notification unavailable', 'This group notification can no longer be opened.');
                    return;
                }
                onOpenGroup(groupId, readPayloadString(item.payload, 'post_id') ?? undefined);
                return;
            }

            if (item.type === 'support.offer') {
                const groupId = readPayloadString(item.payload, 'group_id');
                if (!groupId) {
                    Alert.alert('Notification unavailable', 'This support notification can no longer be opened.');
                    return;
                }
                onOpenGroup(groupId, readPayloadString(item.payload, 'post_id') ?? undefined);
                return;
            }
        } catch (error: unknown) {
            Alert.alert('Could not open notification', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setPendingId(null);
        }
    }, [invalidateNotifications, onOpenChat, onOpenGroup, onOpenMention, pendingId]);

    const renderItem = useCallback(({ item }: { item: api.NotificationItem }) => (
        <NotificationRow item={item} pending={pendingId === item.id} onPress={handlePressNotification} />
    ), [handlePressNotification, pendingId]);

    const keyExtractor = useCallback((item: api.NotificationItem) => item.id, []);
    const ItemSeparator = useCallback(() => <View style={styles.separator} />, []);

    const isInitialLoading = notificationsQuery.isLoading && notifications.length === 0;

    return (
        <View style={styles.container}>
            <ScreenHeader
                title="Notifications"
                onBack={onBack}
                style={styles.header}
                trailing={unreadCount > 0 ? (
                    <TouchableOpacity
                        style={styles.headerAction}
                        onPress={handleMarkAllRead}
                        disabled={markingAllRead}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        {markingAllRead ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                            <Ionicons name="checkmark-done" size={Header.iconSize} color={Colors.primary} />
                        )}
                    </TouchableOpacity>
                ) : null}
            />

            {isInitialLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={keyExtractor}
                    renderItem={renderItem}
                    ItemSeparatorComponent={ItemSeparator}
                    contentContainerStyle={notifications.length === 0 ? styles.emptyContent : styles.listContent}
                    refreshControl={(
                        <RefreshControl
                            refreshing={notificationsQuery.isRefetching && !notificationsQuery.isFetchingNextPage}
                            onRefresh={handleRefresh}
                            tintColor={Colors.primary}
                        />
                    )}
                    onEndReached={handleEndReached}
                    onEndReachedThreshold={0.5}
                    ListEmptyComponent={(
                        <EmptyState
                            title="No notifications yet."
                            description="Mentions and message activity will appear here."
                        />
                    )}
                    ListFooterComponent={notificationsQuery.isFetchingNextPage ? (
                        <ActivityIndicator style={styles.footerLoader} color={Colors.primary} />
                    ) : null}
                />
            )}
        </View>
    );
}

function areNotificationRowPropsEqual(prev: NotificationRowProps, next: NotificationRowProps): boolean {
    return prev.item === next.item
        && prev.pending === next.pending
        && prev.onPress === next.onPress;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    header: {
        borderBottomColor: Colors.border.default,
    },
    headerAction: {
        width: Header.iconSize + Spacing.sm,
        height: Header.iconSize + Spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.xl,
    },
    emptyContent: {
        flexGrow: 1,
        paddingHorizontal: Spacing.md,
        justifyContent: 'center',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.md,
    },
    rowUnread: {
        backgroundColor: Colors.bg.page,
    },
    rowPending: {
        opacity: 0.65,
    },
    avatarSlot: {
        position: 'relative',
        width: 42,
        alignItems: 'center',
    },
    iconCircle: {
        width: ControlSizes.iconButton,
        height: ControlSizes.iconButton,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.raised,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unreadDot: {
        position: 'absolute',
        top: 0,
        right: 1,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.danger,
        borderWidth: 1.5,
        borderColor: Colors.bg.page,
    },
    rowBody: {
        flex: 1,
        minWidth: 0,
    },
    rowTitle: {
        ...TextStyles.bodyEmphasis,
        fontWeight: '500',
    },
    rowTitleUnread: {
        fontWeight: '700',
    },
    rowText: {
        marginTop: Spacing.xs,
        ...TextStyles.secondary,
    },
    rowMeta: {
        marginTop: Spacing.xs,
        ...TextStyles.meta,
    },
    separator: {
        height: 1,
        backgroundColor: Colors.border.default,
    },
    footerLoader: {
        paddingVertical: Spacing.md,
    },
});
