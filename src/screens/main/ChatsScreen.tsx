import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';

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

interface ChatsScreenProps {
    isActive: boolean;
    refreshKey: number;
    onOpenChat: (chat: api.Chat) => void;
}

interface ChatItemProps {
    item: api.Chat;
    onOpenChat: (chat: api.Chat) => void;
}

// Renders a single row in the chats list.
function ChatItem({ item, onOpenChat }: ChatItemProps) {
    const displayName = item.is_group
        ? (item.name ?? 'Group')
        : formatUsername(item.username);

    return (
        <TouchableOpacity
            style={styles.item}
            onPress={() => onOpenChat(item)}
        >
            <View style={styles.avatarWrap}>
                <Avatar username={item.is_group ? 'group' : (item.username ?? 'unknown')} avatarUrl={item.is_group ? undefined : item.avatar_url} size={40} fontSize={13} />
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
                </View>
                {item.last_message && (
                    <Text style={styles.preview} numberOfLines={1}>{item.last_message}</Text>
                )}
            </View>
            <Text style={styles.time}>{timeLabel(item.last_message_at)}</Text>
        </TouchableOpacity>
    );
}

// Renders the chats tab and refreshes chat summaries when needed.
export function ChatsScreen({ isActive, refreshKey, onOpenChat }: ChatsScreenProps) {
    const [chats, setChats] = useState<api.Chat[]>([]);
    const [loading, setLoading] = useState(isActive);
    const [refreshing, setRefreshing] = useState(false);
    const [query, setQuery] = useState('');
    const hasLoadedRef = useRef(false);
    const previousRefreshKeyRef = useRef(refreshKey);

    const load = useCallback(async () => {
        try {
            const data = await api.getChats();
            setChats(data ?? []);
        } catch { }
    }, []);

    useEffect(() => {
        if (!isActive) return;

        const isFirstLoad = !hasLoadedRef.current;
        if (isFirstLoad) setLoading(true);

        load().finally(() => {
            hasLoadedRef.current = true;
            if (isFirstLoad) setLoading(false);
        });
    }, [isActive, load]);

    useEffect(() => {
        const refreshKeyChanged = refreshKey !== previousRefreshKeyRef.current;
        previousRefreshKeyRef.current = refreshKey;

        // The parent increments refreshKey when a conversation closes so the chat
        // list can refresh previews without remounting the whole tab.
        if (isActive && refreshKeyChanged) load();
    }, [isActive, refreshKey, load]);

    // Refreshes the chat list for pull-to-refresh.
    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const normalizedQuery = query.trim().toLowerCase();
    const filteredChats = chats.filter(chat => {
        if (!normalizedQuery) return true;
        const searchTarget = chat.is_group
            ? (chat.name ?? '')
            : (chat.username ?? '');
        return searchTarget.toLowerCase().includes(normalizedQuery);
    });

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    return (
        <FlatList
            data={filteredChats}
            keyExtractor={chat => chat.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
                <>
                    <View style={styles.searchBar}>
                        <Text style={styles.searchIcon}>⌕</Text>
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            style={styles.searchInput}
                            placeholder="Search chats"
                            placeholderTextColor={Colors.light.textTertiary}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>

                    {filteredChats.length > 0 && (
                        <Text style={styles.sectionLabel}>CHATS</Text>
                    )}
                </>
            }
            ListEmptyComponent={
                chats.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No chats yet.</Text>
                        <Text style={styles.emptySubtext}>Connect with people to start chatting.</Text>
                    </View>
                ) : normalizedQuery ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No matching chats.</Text>
                        <Text style={styles.emptySubtext}>Try a different username search.</Text>
                    </View>
                ) : null
            }
            renderItem={({ item }) => <ChatItem item={item} onOpenChat={onOpenChat} />}
        />
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: Spacing.md, paddingBottom: 32 },

    searchBar: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 9,
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    searchIcon: { fontSize: 14, color: Colors.light.textTertiary },
    searchInput: { flex: 1, fontSize: Typography.sizes.base, color: Colors.light.textPrimary },

    sectionLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '500',
        color: Colors.light.textTertiary,
        letterSpacing: 0.7,
    },

    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 11,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
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
        borderColor: Colors.light.background,
    },
    groupBadgeText: { fontSize: 8, color: Colors.info, fontWeight: '600' },
    meta: { flex: 1, minWidth: 0 },
    metaTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    name: { fontSize: Typography.sizes.md, fontWeight: '500', color: Colors.light.textPrimary },
    groupPill: {
        backgroundColor: Colors.bg.raised,
        borderRadius: Radii.full,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    groupPillText: { fontSize: 9, color: Colors.info, fontWeight: '500' },
    preview: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
        marginTop: 1,
    },
    time: { fontSize: Typography.sizes.xs, color: Colors.light.textTertiary },

    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: Typography.sizes.lg, fontWeight: '500', color: Colors.light.textPrimary },
    emptySubtext: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm, textAlign: 'center' },
});
