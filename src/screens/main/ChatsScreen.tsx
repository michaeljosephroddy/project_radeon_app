import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { InfiniteData, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { SearchBar } from '../../components/ui/SearchBar';
import { ScrollToTopButton } from '../../components/ui/ScrollToTopButton';
import { SectionLabel } from '../../components/ui/SectionLabel';
import * as api from '../../api/client';
import { useGuardedEndReached } from '../../hooks/useGuardedEndReached';
import { useLazyActivation } from '../../hooks/useLazyActivation';
import { useRefetchOnActiveIfStale } from '../../hooks/useRefetchOnActiveIfStale';
import { useScrollToTopButton } from '../../hooks/useScrollToTopButton';
import { useChats } from '../../hooks/queries/useChats';
import { useAuth } from '../../hooks/useAuth';
import { resetInfiniteQueryToFirstPage } from '../../query/infiniteQueryPolicy';
import { queryKeys } from '../../query/queryKeys';
import { dedupeById } from '../../utils/list';
import { getListPerformanceProps } from '../../utils/listPerformance';
import { Colors, Typography, Spacing, Radius } from '../../theme';
import { formatUsername } from '../../utils/identity';
import { screenStandards } from '../../styles/screenStandards';

// Formats chat timestamps into short labels that fit the list layout.
function timeLabel(dateStr?: string): string {
    if (!dateStr) return '';
    // Chat timestamps are intentionally coarse so the list stays compact.
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return 'yesterday';
    const d = new Date(dateStr);
    return d.toLocaleDateString('default', { weekday: 'short' });
}

function unreadCountLabel(unreadCount: number): string {
    return unreadCount > 99 ? '99+' : String(unreadCount);
}

interface ChatsScreenProps {
    isActive: boolean;
    onOpenChat: (chat: api.Chat) => void;
}

interface ChatItemProps {
    item: api.Chat;
    currentUserId?: string;
    onOpenChat: (chat: api.Chat) => void;
    onDeleteChat: (chat: api.Chat) => void;
    actionPending?: boolean;
}

function getSupportPendingLabel(chat: api.Chat, currentUserId?: string): string | null {
    const status = chat.support_context?.status;
    if (!status || status === 'accepted') return null;

    if (status === 'declined') return 'Declined';
    if (status === 'closed') return 'Closed';

    if (status === 'pending_requester_acceptance') {
        return chat.support_context?.awaiting_user_id === currentUserId ? 'Waiting' : 'Pending';
    }

    return null;
}

// Renders a single row in the chats list.
const ChatItem = React.memo(function ChatItem({ item, currentUserId, onOpenChat, onDeleteChat, actionPending = false }: ChatItemProps) {
    const displayName = item.is_group
        ? (item.name ?? 'Group')
        : formatUsername(item.username);
    const actionLabel = item.is_group ? 'Leave' : 'Delete';
    const pendingLabel = getSupportPendingLabel(item, currentUserId);
    const unreadCount = Math.max(0, item.unread_count ?? 0);
    const hasUnread = unreadCount > 0;
    const handleDelete = useCallback(() => onDeleteChat(item), [item, onDeleteChat]);
    const handleOpen = useCallback(() => onOpenChat(item), [item, onOpenChat]);
    const renderRightActions = useCallback(() => (
        <TouchableOpacity
            style={[styles.deleteAction, actionPending && styles.deleteActionDisabled]}
            onPress={handleDelete}
            disabled={actionPending}
        >
            <Text style={styles.deleteActionText}>{actionPending ? '...' : actionLabel}</Text>
        </TouchableOpacity>
    ), [actionLabel, actionPending, handleDelete]);

    return (
        <Swipeable
            overshootRight={false}
            renderRightActions={renderRightActions}
        >
            <TouchableOpacity
                style={styles.item}
                onPress={handleOpen}
            >
                <View style={styles.avatarWrap}>
                    <Avatar username={item.is_group ? 'group' : (item.username ?? 'unknown')} avatarUrl={item.is_group ? undefined : item.avatar_url} size={44} fontSize={14} />
                    {item.is_group && (
                        <View style={styles.groupBadge}>
                            <Text style={styles.groupBadgeText}>G</Text>
                        </View>
                    )}
                </View>
                <View style={styles.meta}>
                    <View style={styles.metaTop}>
                        <Text style={styles.name}>{displayName}</Text>
                        {item.is_group && (
                            <View style={styles.groupPill}>
                                <Text style={styles.groupPillText}>group</Text>
                            </View>
                        )}
                        {pendingLabel ? (
                            <View style={styles.pendingPill}>
                                <Text style={styles.pendingPillText}>{pendingLabel}</Text>
                            </View>
                        ) : null}
                    </View>
                    {item.last_message && (
                        <Text style={[styles.preview, hasUnread && styles.previewUnread]} numberOfLines={1}>{item.last_message}</Text>
                    )}
                </View>
                <View style={styles.trailing}>
                    <Text style={styles.time}>{timeLabel(item.last_message_at)}</Text>
                    {hasUnread ? (
                        <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{unreadCountLabel(unreadCount)}</Text>
                        </View>
                    ) : null}
                </View>
            </TouchableOpacity>
        </Swipeable>
    );
}, areChatItemPropsEqual);

// Renders the chats tab and refreshes chat summaries when needed.
export function ChatsScreen({ isActive, onOpenChat }: ChatsScreenProps) {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const flatListRef = useRef<FlatList<api.Chat> | null>(null);
    const hasActivated = useLazyActivation(isActive);
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
    const chatsListProps = getListPerformanceProps('chatList');
    const chatsQuery = useChats({ query: debouncedQuery, limit: 20 }, hasActivated);
    useRefetchOnActiveIfStale(isActive, chatsQuery);
    const chatsScrollToTop = useScrollToTopButton({ threshold: 260 });
    const chats = useMemo(
        () => dedupeById(chatsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? []),
        [chatsQuery.data],
    );
    const isSearchFetching = debouncedQuery.length > 0
        && chatsQuery.isFetching
        && !chatsQuery.isRefetching
        && !chatsQuery.isFetchingNextPage;

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedQuery(query.trim()), 400);
        return () => clearTimeout(timer);
    }, [query]);

    // Refreshes the chat list for pull-to-refresh.
    const onRefresh = async () => {
        resetInfiniteQueryToFirstPage(queryClient, queryKeys.chats({ query: debouncedQuery, limit: 20 }));
        await chatsQuery.refetch();
    };

    // Continue from the current query/page pair instead of mixing pages from
    // different search terms into the same in-memory list.
    const onEndReached = async () => {
        if (!isActive || chatsQuery.isLoading || chatsQuery.isRefetching || chatsQuery.isFetchingNextPage || !chatsQuery.hasNextPage) return;
        await chatsQuery.fetchNextPage();
    };
    const chatsListPagination = useGuardedEndReached(onEndReached);

    const handleDeleteChat = useCallback((chat: api.Chat) => {
        const title = chat.is_group ? 'Leave this group?' : 'Delete this chat?';
        const message = chat.is_group
            ? 'You will be removed from this group conversation.'
            : 'This conversation will be deleted.';

        Alert.alert(title, message, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: chat.is_group ? 'Leave' : 'Delete',
                style: 'destructive',
                onPress: async () => {
                    setPendingDeleteIds(prev => new Set(prev).add(chat.id));
                    const chatQueryKey = queryKeys.chats({ query: debouncedQuery, limit: 20 });
                    const previousChats = queryClient.getQueryData<InfiniteData<api.CursorResponse<api.Chat>>>(chatQueryKey);
                    queryClient.setQueryData<InfiniteData<api.CursorResponse<api.Chat>>>(
                        chatQueryKey,
                        (current) => {
                            if (!current) return current;
                            return {
                                ...current,
                                pages: current.pages.map((page) => ({
                                    ...page,
                                    items: (page.items ?? []).filter((item) => item.id !== chat.id),
                                })),
                            };
                        },
                    );

                    try {
                        await api.deleteChat(chat.id);
                    } catch (e: unknown) {
                        queryClient.setQueryData(chatQueryKey, previousChats);
                        Alert.alert(chat.is_group ? 'Could not leave group' : 'Could not delete chat', e instanceof Error ? e.message : 'Something went wrong.');
                    } finally {
                        setPendingDeleteIds(prev => {
                            const next = new Set(prev);
                            next.delete(chat.id);
                            return next;
                        });
                    }
                },
            },
        ]);
    }, [debouncedQuery, queryClient]);

    const renderItem = useCallback(({ item }: { item: api.Chat }) => (
        <ChatItem
            item={item}
            currentUserId={user?.id}
            onOpenChat={onOpenChat}
            onDeleteChat={handleDeleteChat}
            actionPending={pendingDeleteIds.has(item.id)}
        />
    ), [handleDeleteChat, onOpenChat, pendingDeleteIds, user?.id]);
    const ItemSeparator = useCallback(() => <View style={styles.separator} />, []);

    if (chatsQuery.isLoading && chats.length === 0 && debouncedQuery.length === 0) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    return (
        <View style={styles.container}>
            <FlatList
            ref={flatListRef}
            data={chats}
            keyExtractor={chat => chat.id}
            {...chatsListProps}
            refreshControl={
                <RefreshControl
                    refreshing={chatsQuery.isRefetching && !chatsQuery.isFetchingNextPage}
                    onRefresh={onRefresh}
                    tintColor={Colors.primary}
                />
            }
            contentContainerStyle={screenStandards.listContent}
            keyboardShouldPersistTaps="handled"
            onEndReached={chatsListPagination.onEndReached}
            onEndReachedThreshold={0.4}
            onMomentumScrollBegin={chatsListPagination.onMomentumScrollBegin}
            onScrollBeginDrag={chatsListPagination.onScrollBeginDrag}
            onScroll={chatsScrollToTop.onScroll}
            scrollEventThrottle={16}
            ListHeaderComponent={
                <>
                    <SearchBar
                        style={styles.searchBar}
                        variant="pill"
                        leading={<Ionicons name="search-outline" size={18} color={Colors.text.muted} />}
                        primaryField={{
                            value: query,
                            onChangeText: setQuery,
                            placeholder: 'Search chats',
                            autoCapitalize: 'none',
                            autoCorrect: false,
                        }}
                    />
                    {isSearchFetching ? (
                        <View style={styles.searchStatusRow}>
                            <ActivityIndicator size="small" color={Colors.primary} />
                            <Text style={styles.searchStatusText}>Searching chats…</Text>
                        </View>
                    ) : null}

                    {chats.length > 0 && (
                        <SectionLabel>CHATS</SectionLabel>
                    )}
                </>
            }
            ListEmptyComponent={
                !chatsQuery.isLoading && chats.length === 0 ? (
                    <EmptyState
                        title="No chats yet."
                        description={debouncedQuery.length > 0 ? 'No chats match your search.' : 'Connect with people to start chatting.'}
                    />
                ) : null
            }
            ListFooterComponent={chatsQuery.isFetchingNextPage ? <ActivityIndicator style={styles.footerLoader} color={Colors.primary} /> : null}
            renderItem={renderItem}
            ItemSeparatorComponent={ItemSeparator}
            />
            {isActive && chatsScrollToTop.isVisible ? (
                <ScrollToTopButton onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
            ) : null}
        </View>
    );
}

function areChatItemPropsEqual(prev: ChatItemProps, next: ChatItemProps) {
    return prev.item === next.item
        && prev.currentUserId === next.currentUserId
        && prev.onOpenChat === next.onOpenChat
        && prev.onDeleteChat === next.onDeleteChat
        && prev.actionPending === next.actionPending;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bg.page },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    searchBar: {
        marginBottom: Spacing.md,
    },
    searchStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    searchStatusText: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },

    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 11,
        backgroundColor: Colors.bg.page,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: Colors.border.default,
    },
    deleteAction: {
        width: 68,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.danger,
        borderRadius: Radius.md,
        marginVertical: 7,
    },
    deleteActionDisabled: { opacity: 0.6 },
    deleteActionText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.textOn.primary,
    },
    avatarWrap: { position: 'relative' },
    groupBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: Colors.bg.raised,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: Colors.bg.page,
    },
    groupBadgeText: { fontSize: 8, color: Colors.primary, fontWeight: '600' },
    meta: { flex: 1, minWidth: 0 },
    metaTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    name: { fontSize: Typography.sizes.md, fontWeight: '500', color: Colors.text.primary },
    groupPill: {
        backgroundColor: Colors.bg.raised,
        borderRadius: Radius.pill,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    groupPillText: { fontSize: 9, color: Colors.primary, fontWeight: '500' },
    pendingPill: {
        backgroundColor: Colors.primary,
        borderRadius: Radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    pendingPillText: { fontSize: Typography.sizes.xs, color: Colors.textOn.primary, fontWeight: '700' },
    preview: {
        marginTop: 1,
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
    },
    previewUnread: {
        color: Colors.text.primary,
        fontWeight: '600',
    },
    trailing: {
        minWidth: 34,
        alignSelf: 'stretch',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingVertical: 1,
    },
    unreadBadge: {
        minWidth: 22,
        height: 22,
        paddingHorizontal: Spacing.xs,
        borderRadius: Radius.pill,
        backgroundColor: Colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
    },
    unreadBadgeText: {
        fontSize: Typography.sizes.xs,
        color: Colors.textOn.danger,
        fontWeight: '700',
    },
    time: { fontSize: Typography.sizes.xs, color: Colors.text.muted },
    footerLoader: { paddingVertical: Spacing.md },
});
