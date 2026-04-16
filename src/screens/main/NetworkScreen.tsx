import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, TextInput,
    StyleSheet, RefreshControl, ActivityIndicator,
    Alert, ScrollView,
} from 'react-native';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { ConnectionSheet } from '../../components/ConnectionSheet';

interface NetworkScreenProps {
    onOpenChat: (conversation: api.Conversation) => void;
}

export function NetworkScreen({ onOpenChat }: NetworkScreenProps) {
    const [connections, setConnections] = useState<api.Connection[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedConnection, setSelectedConnection] = useState<api.Connection | null>(null);

    const load = useCallback(async () => {
        try {
            const data = await api.getConnections();
            setConnections(data ?? []);
        } catch { }
    }, []);

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, [load]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const handleMessage = async (conn: api.Connection) => {
        try {
            const result = await api.createConversation([conn.user_id]);
            const conversation: api.Conversation = {
                id: result.id,
                is_group: false,
                first_name: conn.first_name,
                last_name: conn.last_name,
                created_at: new Date().toISOString(),
            };
            setSelectedConnection(null);
            onOpenChat(conversation);
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        }
    };

    const filtered = search.trim()
        ? connections.filter(c =>
            `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
            (c.city?.toLowerCase().includes(search.toLowerCase()) ?? false)
          )
        : connections;

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    return (
        <>
            <ScrollView
                contentContainerStyle={styles.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            >
                {/* Search */}
                <View style={styles.searchBar}>
                    <Text style={styles.searchIcon}>⌕</Text>
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name or city…"
                        placeholderTextColor={Colors.light.textTertiary}
                        value={search}
                        onChangeText={setSearch}
                        returnKeyType="search"
                        autoCorrect={false}
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Text style={styles.searchClear}>✕</Text>
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={styles.sectionLabel}>YOUR CONNECTIONS</Text>

                {filtered.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>
                            {search.trim() ? 'No connections matched.' : 'No connections yet.'}
                        </Text>
                        <Text style={styles.emptySubtext}>
                            {search.trim() ? 'Try a different name or city.' : 'Connect with people on the People tab.'}
                        </Text>
                    </View>
                ) : (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.reel}
                    >
                        {filtered.map(conn => (
                            <TouchableOpacity
                                key={conn.id}
                                style={styles.reelItem}
                                onPress={() => setSelectedConnection(conn)}
                            >
                                <Avatar
                                    firstName={conn.first_name}
                                    lastName={conn.last_name}
                                    avatarUrl={conn.avatar_url}
                                    size={64}
                                    fontSize={22}
                                />
                                <Text style={styles.reelName} numberOfLines={1}>
                                    {conn.first_name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}
            </ScrollView>

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
    scroll: { paddingTop: Spacing.md, paddingBottom: 32 },

    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.md,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        gap: Spacing.sm,
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.md,
    },
    searchIcon: { fontSize: 16, color: Colors.light.textTertiary },
    searchInput: { flex: 1, fontSize: Typography.sizes.base, color: Colors.light.textPrimary },
    searchClear: { fontSize: Typography.sizes.sm, color: Colors.light.textTertiary, padding: 2 },

    sectionLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '500',
        color: Colors.light.textTertiary,
        letterSpacing: 0.07 * 10,
        marginHorizontal: Spacing.md,
        marginBottom: Spacing.sm,
    },

    reel: {
        paddingHorizontal: Spacing.md,
        gap: Spacing.lg,
    },
    reelItem: {
        alignItems: 'center',
        width: 72,
    },
    reelName: {
        marginTop: Spacing.xs,
        fontSize: Typography.sizes.sm,
        color: Colors.light.textPrimary,
        textAlign: 'center',
        width: '100%',
    },

    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: Typography.sizes.lg, fontWeight: '500', color: Colors.light.textPrimary },
    emptySubtext: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm },
});
