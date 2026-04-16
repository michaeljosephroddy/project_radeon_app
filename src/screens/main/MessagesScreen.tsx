import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, RefreshControl, ActivityIndicator, TextInput,
} from 'react-native';
import { Avatar } from '../../components/Avatar';
import { MatchBadge } from '../../components/MatchBadge';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

function timeLabel(dateStr?: string): string {
    if (!dateStr) return '';
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

interface MessagesScreenProps {
    onOpenConversation: (conv: api.Conversation) => void;
}

interface ConvItemProps {
    item: api.Conversation;
    onOpenConversation: (conv: api.Conversation) => void;
}

function ConvItem({ item, onOpenConversation }: ConvItemProps) {
    const firstName = item.is_group ? '' : (item.first_name ?? '');
    const lastName = item.is_group ? '' : (item.last_name ?? '');
    const displayName = item.is_group
        ? (item.name ?? 'Group')
        : [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';

    return (
        <TouchableOpacity
            style={styles.item}
            onPress={() => onOpenConversation(item)}
        >
            <View style={styles.avatarWrap}>
                <Avatar firstName={firstName} lastName={lastName} avatarUrl={item.is_group ? undefined : item.avatar_url} size={40} fontSize={13} />
                {item.is_group && (
                    <View style={styles.groupBadge}>
                        <Text style={styles.groupBadgeText}>G</Text>
                    </View>
                )}
            </View>
            <View style={styles.meta}>
                <View style={styles.metaTop}>
                    <Text style={styles.name}>{displayName}</Text>
                    {item.connection_type === 'MATCH' && <MatchBadge />}
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

export function MessagesScreen({ onOpenConversation }: MessagesScreenProps) {
    const [convs, setConvs] = useState<api.Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const [data] = await Promise.all([
                api.getConversations(),
            ]);
            setConvs(data ?? []);
        } catch { }
    }, []);

    useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    return (
        <FlatList
            data={convs}
            keyExtractor={c => c.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
                <>
                    {/* Search */}
                    <View style={styles.searchBar}>
                        <Text style={styles.searchIcon}>⌕</Text>
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search messages"
                            placeholderTextColor={Colors.light.textTertiary}
                        />
                    </View>

                    {/* Message requests */}

                    {convs.length > 0 && (
                        <Text style={styles.sectionLabel}>MESSAGES</Text>
                    )}
                </>
            }
            ListEmptyComponent={
                convs.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No messages yet.</Text>
                        <Text style={styles.emptySubtext}>Connect with people to start chatting.</Text>
                    </View>
                ) : null
            }
            renderItem={({ item }) => <ConvItem item={item} onOpenConversation={onOpenConversation} />}
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

    requestsSection: { marginBottom: Spacing.md },
    requestsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: Spacing.sm,
    },
    sectionLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '500',
        color: Colors.light.textTertiary,
        letterSpacing: 0.7,
    },
    divider: {
        height: 0.5,
        backgroundColor: Colors.light.border,
        marginTop: Spacing.sm,
        marginBottom: Spacing.md,
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
        backgroundColor: Colors.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: Colors.light.background,
    },
    groupBadgeText: { fontSize: 8, color: Colors.primaryDark, fontWeight: '600' },
    meta: { flex: 1, minWidth: 0 },
    metaTop: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    name: { fontSize: Typography.sizes.md, fontWeight: '500', color: Colors.light.textPrimary },
    groupPill: {
        backgroundColor: Colors.primaryLight,
        borderRadius: Radii.full,
        paddingHorizontal: 6,
        paddingVertical: 1,
    },
    groupPillText: { fontSize: 9, color: Colors.primaryDark, fontWeight: '500' },
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
