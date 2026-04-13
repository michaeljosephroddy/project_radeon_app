import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity,
    StyleSheet, RefreshControl, ActivityIndicator,
    Alert, TextInput, ScrollView,
} from 'react-native';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { useRef } from 'react';
import { ConnectionSheet } from '../../components/ConnectionSheet';

function PersonCard({ user, onConnect }: { user: api.User; onConnect: (id: string) => void }) {
    const [requested, setRequested] = useState(false);

    const handle = async () => {
        try {
            await onConnect(user.id);
            setRequested(true);
        } catch { }
    };

    return (
        <View style={styles.card}>
            <Avatar firstName={user.first_name} lastName={user.last_name} size={44} fontSize={15} />
            <Text style={styles.cardName}>{user.first_name} {user.last_name}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>
                {user.city ?? 'Somewhere'}{user.interests?.length ? ` · ${user.interests.slice(0, 2).join(', ')}` : ''}
            </Text>
            <TouchableOpacity
                style={[styles.connectBtn, requested && styles.connectBtnSent]}
                onPress={handle}
                disabled={requested}
            >
                <Text style={[styles.connectBtnText, requested && styles.connectBtnTextSent]}>
                    {requested ? 'Requested' : 'Connect'}
                </Text>
            </TouchableOpacity>
        </View>
    );
}

interface PeopleScreenProps {
    onOpenChat: (conversation: api.Conversation) => void;
}

export function PeopleScreen({ onOpenChat }: PeopleScreenProps) {
    const [users, setUsers] = useState<api.User[]>([]);
    const [connections, setConnections] = useState<api.Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [cityFilter, setCityFilter] = useState('');
    const [pending, setPending] = useState<api.Connection[]>([]);
    const [selectedConnection, setSelectedConnection] = useState<api.Connection | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const load = useCallback(async (city?: string) => {
        try {
            const [discovered, pendingConns, myConnections] = await Promise.all([
                api.discoverUsers(city || undefined),
                api.getPendingConnections(),
                api.getConnections(),
            ]);
            setUsers(discovered ?? []);
            setPending(pendingConns ?? []);
            setConnections(myConnections ?? []);
        } catch { }
    }, []);

    useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => { load(cityFilter); }, 400);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [cityFilter, load]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load(cityFilter);
        setRefreshing(false);
    };

    const handleConnect = async (userId: string) => {
        try {
            await api.sendConnectionRequest(userId);
        } catch (e: any) {
            Alert.alert('', e.message);
        }
    };

    const handleAccept = async (conn: api.Connection) => {
        try {
            await api.updateConnectionStatus(conn.id, 'accepted');
            setPending(prev => prev.filter(p => p.id !== conn.id));
            Alert.alert('Connected!', `You are now connected with ${conn.first_name}.`);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    const handleDecline = async (conn: api.Connection) => {
        try {
            await api.updateConnectionStatus(conn.id, 'declined');
            setPending(prev => prev.filter(p => p.id !== conn.id));
        } catch { }
    };

    const handleMessage = async (conn: api.Connection) => {
        try {
            const result = await api.createConversation([conn.user_id]);
            const conversation: api.Conversation = {
                id: result.id,
                is_group: false,
                created_at: new Date().toISOString(),
            };
            setSelectedConnection(null);
            onOpenChat(conversation);
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    return (
        <>
            <FlatList
                data={users}
                keyExtractor={u => u.id}
                numColumns={2}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
                columnWrapperStyle={styles.row}
                contentContainerStyle={styles.list}
                ListHeaderComponent={
                    <>
                        {/* Search */}
                        <View style={styles.searchBar}>
                            <Text style={styles.searchIcon}>⌕</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Filter by city…"
                                placeholderTextColor={Colors.light.textTertiary}
                                value={cityFilter}
                                onChangeText={setCityFilter}
                                returnKeyType="search"
                            />
                        </View>

                        {/* Connections tray */}
                        {connections.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>YOUR CONNECTIONS</Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.connectionsTray}
                                >
                                    {connections.map(conn => (
                                        <TouchableOpacity
                                            key={conn.id}
                                            style={styles.connectionItem}
                                            onPress={() => setSelectedConnection(conn)}
                                        >
                                            <View style={styles.connectionAvatar}>
                                                <Avatar
                                                    firstName={conn.first_name}
                                                    lastName={conn.last_name}
                                                    size={48}
                                                    fontSize={16}
                                                />
                                            </View>
                                            <Text style={styles.connectionName} numberOfLines={1}>
                                                {conn.first_name}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Pending requests */}
                        {pending.length > 0 && (
                            <View style={styles.section}>
                                <Text style={styles.sectionLabel}>REQUESTS</Text>
                                {pending.map(conn => (
                                    <View key={conn.id} style={styles.pendingItem}>
                                        <Avatar firstName={conn.first_name} lastName={conn.last_name} size={36} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.pendingName}>{conn.first_name} {conn.last_name}</Text>
                                            {conn.city && <Text style={styles.pendingSub}>{conn.city}</Text>}
                                        </View>
                                        <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(conn)}>
                                            <Text style={styles.acceptBtnText}>Accept</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(conn)}>
                                            <Text style={styles.declineBtnText}>✕</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}

                        <Text style={styles.sectionLabel}>DISCOVER</Text>
                    </>
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No one to discover yet.</Text>
                        <Text style={styles.emptySubtext}>Check back as the community grows.</Text>
                    </View>
                }
                renderItem={({ item }) => (
                    <PersonCard user={item} onConnect={handleConnect} />
                )}
            />

            {/* Connection profile sheet */}
            <ConnectionSheet
                visible={!!selectedConnection}
                connection={selectedConnection}
                onClose={() => setSelectedConnection(null)}
                onMessage={handleMessage}
            />
        </>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    list: { padding: Spacing.md, paddingBottom: 32 },
    row: { gap: Spacing.sm, marginBottom: Spacing.sm },

    searchBar: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    searchIcon: { fontSize: 16, color: Colors.light.textTertiary },
    searchInput: { flex: 1, fontSize: Typography.sizes.base, color: Colors.light.textPrimary },

    section: { marginBottom: Spacing.md },
    sectionLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '500',
        color: Colors.light.textTertiary,
        letterSpacing: 0.07 * 10,
        marginBottom: Spacing.sm,
    },

    pendingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
    },
    pendingName: { fontSize: Typography.sizes.md, fontWeight: '500', color: Colors.light.textPrimary },
    pendingSub: { fontSize: Typography.sizes.xs, color: Colors.light.textTertiary, marginTop: 1 },
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

    card: {
        flex: 1,
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        padding: Spacing.md,
        alignItems: 'center',
    },
    cardName: {
        fontSize: Typography.sizes.base,
        fontWeight: '500',
        color: Colors.light.textPrimary,
        marginTop: Spacing.sm,
        textAlign: 'center',
        lineHeight: 17,
    },
    cardSub: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
        marginTop: 2,
        textAlign: 'center',
        lineHeight: 14,
    },
    connectBtn: {
        width: '100%',
        backgroundColor: Colors.primary,
        borderRadius: Radii.sm,
        paddingVertical: 7,
        alignItems: 'center',
        marginTop: Spacing.sm,
    },
    connectBtnSent: { backgroundColor: Colors.light.backgroundSecondary, borderWidth: 0.5, borderColor: Colors.light.border },
    connectBtnText: { fontSize: Typography.sizes.sm, fontWeight: '500', color: '#fff' },

    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: Typography.sizes.lg, fontWeight: '500', color: Colors.light.textPrimary },
    emptySubtext: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm },
});
