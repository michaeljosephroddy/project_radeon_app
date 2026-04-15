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
    const lastName  = item.is_group ? '' : (item.last_name  ?? '');
    const displayName = item.is_group
        ? (item.name ?? 'Group')
        : [firstName, lastName].filter(Boolean).join(' ') || 'Unknown';

    return (
        <TouchableOpacity
            style={styles.item}
            onPress={() => onOpenConversation(item)}
        >
            <View style={styles.avatarWrap}>
                <Avatar firstName={firstName} lastName={lastName} size={40} fontSize={13} />
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
    const [requests, setRequests] = useState<api.Conversation[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const load = useCallback(async () => {
        try {
            const [data, reqs] = await Promise.all([
                api.getConversations(),
                api.getMessageRequests(),
            ]);
            setConvs(data ?? []);
            setRequests(reqs ?? []);
        } catch { }
    }, []);

    useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const handleAccept = async (conv: api.Conversation) => {
        try {
            await api.updateConversationStatus(conv.id, 'active');
            setRequests(prev => prev.filter(r => r.id !== conv.id));
            setConvs(prev => [conv, ...prev]);
            onOpenConversation(conv);
        } catch { }
    };

    const handleDecline = async (conv: api.Conversation) => {
        try {
            await api.updateConversationStatus(conv.id, 'declined');
            setRequests(prev => prev.filter(r => r.id !== conv.id));
        } catch { }
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
                    {requests.length > 0 && (
                        <View style={styles.requestsSection}>
                            <View style={styles.requestsHeader}>
                                <Text style={styles.sectionLabel}>MESSAGE REQUESTS</Text>
                                <View style={styles.requestsBadge}>
                                    <Text style={styles.requestsBadgeText}>{requests.length}</Text>
                                </View>
                            </View>
                            {requests.map(req => {
                                const reqFirst = req.first_name ?? '';
                                const reqLast  = req.last_name  ?? '';
                                const displayName = [reqFirst, reqLast].filter(Boolean).join(' ') || 'Unknown';
                                return (
                                    <View key={req.id} style={styles.requestItem}>
                                        <Avatar
                                            firstName={reqFirst || 'U'}
                                            lastName={reqLast}
                                            size={40}
                                            fontSize={13}
                                        />
                                        <View style={styles.requestMeta}>
                                            <View style={styles.requestNameRow}>
                                                <Text style={styles.name}>{displayName}</Text>
                                                {req.connection_type === 'MATCH' && <MatchBadge />}
                                            </View>
                                            {req.last_message && (
                                                <Text style={styles.preview} numberOfLines={1}>
                                                    {req.last_message}
                                                </Text>
                                            )}
                                        </View>
                                        <TouchableOpacity
                                            style={styles.acceptBtn}
                                            onPress={() => handleAccept(req)}
                                        >
                                            <Text style={styles.acceptBtnText}>Accept</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.declineBtn}
                                            onPress={() => handleDecline(req)}
                                        >
                                            <Text style={styles.declineBtnText}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                            <View style={styles.divider} />
                        </View>
                    )}

                    {convs.length > 0 && (
                        <Text style={styles.sectionLabel}>MESSAGES</Text>
                    )}
                </>
            }
            ListEmptyComponent={
                requests.length === 0 ? (
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
    requestsBadge: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.full,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    requestsBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#fff',
    },
    requestItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
    },
    requestMeta: { flex: 1, minWidth: 0 },
    requestNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    acceptBtn: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
    },
    acceptBtnText: { fontSize: Typography.sizes.sm, color: '#fff', fontWeight: '500' },
    declineBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: Colors.light.backgroundSecondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    declineBtnText: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary },
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
