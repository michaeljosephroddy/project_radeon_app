import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView,
    StyleSheet, RefreshControl, ActivityIndicator,
    Alert, Dimensions,
} from 'react-native';
import Animated, {
    useSharedValue, useAnimatedStyle,
    withSpring, withTiming, runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Avatar } from '../../components/Avatar';
import { MatchBadge } from '../../components/MatchBadge';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;

interface SwipeCardProps {
    user: api.ScoredUser;
    onPass: () => void;
    onConnect: () => void;
}

function SwipeCard({ user, onPass, onConnect }: SwipeCardProps) {
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);

    const pan = Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-20, 20])
        .onUpdate(e => {
            translateX.value = e.translationX;
            translateY.value = e.translationY * 0.15;
        })
        .onEnd(e => {
            if (e.translationX > SWIPE_THRESHOLD) {
                translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: 250 }, () => {
                    runOnJS(onConnect)();
                });
            } else if (e.translationX < -SWIPE_THRESHOLD) {
                translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: 250 }, () => {
                    runOnJS(onPass)();
                });
            } else {
                translateX.value = withSpring(0);
                translateY.value = withSpring(0);
            }
        });

    const cardStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: translateX.value },
            { translateY: translateY.value },
            { rotate: `${(translateX.value / SCREEN_WIDTH) * 12}deg` },
        ],
    }));

    const connectLabelStyle = useAnimatedStyle(() => ({
        opacity: translateX.value > 20 ? Math.min((translateX.value - 20) / 60, 1) : 0,
    }));

    const passLabelStyle = useAnimatedStyle(() => ({
        opacity: translateX.value < -20 ? Math.min((-translateX.value - 20) / 60, 1) : 0,
    }));

    return (
        <GestureDetector gesture={pan}>
            <Animated.View style={[styles.swipeCard, cardStyle]}>
                <Animated.View style={[styles.swipeLabel, styles.connectLabel, connectLabelStyle]}>
                    <Text style={styles.connectLabelText}>CONNECT</Text>
                </Animated.View>
                <Animated.View style={[styles.swipeLabel, styles.passLabel, passLabelStyle]}>
                    <Text style={styles.passLabelText}>PASS</Text>
                </Animated.View>

                <Avatar firstName={user.first_name} lastName={user.last_name} size={80} fontSize={28} />
                <Text style={styles.swipeName}>{user.first_name} {user.last_name}</Text>
                {user.city && <Text style={styles.swipeCity}>{user.city}</Text>}
            </Animated.View>
        </GestureDetector>
    );
}

export function PeopleScreen() {
    const [suggestions, setSuggestions] = useState<api.ScoredUser[]>([]);
    const [matches, setMatches] = useState<api.Connection[]>([]);
    const [pending, setPending] = useState<api.Connection[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [likedId, setLikedId] = useState<string | null>(null);

    const load = useCallback(async () => {
        const results = await Promise.allSettled([
            api.getSuggestions(),
            api.getPendingConnections(),
            api.getConnections(),
        ]);
        if (results[0].status === 'fulfilled') setSuggestions(results[0].value ?? []);
        if (results[1].status === 'fulfilled') {
            const sorted = (results[1].value ?? []).slice().sort(
                (a, b) => new Date(a.connected_at).getTime() - new Date(b.connected_at).getTime()
            );
            setPending(sorted);
        }
        if (results[2].status === 'fulfilled') {
            setMatches((results[2].value ?? []).filter(c => c.type === 'MATCH'));
        }
    }, []);

    useEffect(() => {
        load().finally(() => setLoading(false));
    }, [load]);

    const onRefresh = async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    };

    const handlePass = useCallback((userId: string) => {
        const user = suggestions.find(u => u.id === userId);
        setSuggestions(prev => prev.filter(u => u.id !== userId));
        api.dismissSuggestion(userId).catch((e: unknown) => {
            if (user) setSuggestions(prev => [user, ...prev]);
            Alert.alert('', e instanceof Error ? e.message : 'Something went wrong.');
        });
    }, [suggestions]);

    const handleConnect = useCallback((userId: string) => {
        const user = suggestions.find(u => u.id === userId);
        setSuggestions(prev => prev.filter(u => u.id !== userId));
        api.sendConnectionRequest(userId).catch((e: unknown) => {
            if (user) setSuggestions(prev => [user, ...prev]);
            Alert.alert('', e instanceof Error ? e.message : 'Something went wrong.');
        });
    }, [suggestions]);

    const handleLike = async (userId: string) => {
        setLikedId(userId);
        try {
            const result = await api.likeUser(userId);
            if (result.matched) {
                const conns = await api.getConnections();
                setMatches((conns ?? []).filter(c => c.type === 'MATCH'));
            }
        } catch (e: unknown) {
            setLikedId(null);
            Alert.alert('', e instanceof Error ? e.message : 'Something went wrong.');
        }
    };

    const handleAccept = async (conn: api.Connection) => {
        try {
            await api.updateConnectionStatus(conn.id, 'accepted');
            setPending(prev => prev.filter(p => p.id !== conn.id));
            Alert.alert('Connected!', `You are now connected with ${conn.first_name}.`);
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        }
    };

    const handleDecline = async (conn: api.Connection) => {
        try {
            await api.updateConnectionStatus(conn.id, 'declined');
            setPending(prev => prev.filter(p => p.id !== conn.id));
        } catch { }
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    const current = suggestions[0] ?? null;

    return (
        <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
            {/* Pending requests */}
            {pending.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionLabelRow}>
                        <Text style={styles.sectionLabel}>REQUESTS</Text>
                        <View style={styles.requestsBadge}>
                            <Text style={styles.requestsBadgeText}>{pending.length}</Text>
                        </View>
                    </View>
                    <View style={styles.pendingItem}>
                        <Avatar firstName={pending[0].first_name} lastName={pending[0].last_name} size={36} />
                        <View style={styles.pendingMeta}>
                            <Text style={styles.pendingName}>{pending[0].first_name} {pending[0].last_name}</Text>
                            {pending[0].city && <Text style={styles.pendingSub}>{pending[0].city}</Text>}
                        </View>
                        <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(pending[0])}>
                            <Text style={styles.acceptBtnText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(pending[0])}>
                            <Text style={styles.declineBtnText}>✕</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Matches reel */}
            {matches.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>YOUR MATCHES</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.reel}
                    >
                        {matches.map(match => (
                            <View key={match.id} style={styles.reelItem}>
                                <Avatar firstName={match.first_name} lastName={match.last_name} size={64} fontSize={22} />
                                <Text style={styles.reelName} numberOfLines={1}>{match.first_name}</Text>
                                <MatchBadge />
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Suggestion card */}
            <Text style={styles.sectionLabel}>SUGGESTED FOR YOU</Text>
            {current ? (
                <View style={styles.cardArea}>
                    <SwipeCard
                        key={current.id}
                        user={current}
                        onPass={() => handlePass(current.id)}
                        onConnect={() => handleConnect(current.id)}
                    />
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.passBtn}
                            onPress={() => handlePass(current.id)}
                        >
                            <Text style={styles.passBtnText}>✕</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.likeBtn, likedId === current.id && styles.likeBtnActive]}
                            onPress={() => handleLike(current.id)}
                            disabled={likedId === current.id}
                        >
                            <Text style={[styles.likeBtnText, likedId === current.id && styles.likeBtnTextActive]}>♥</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.connectBtn}
                            onPress={() => handleConnect(current.id)}
                        >
                            <Text style={styles.connectBtnText}>Connect</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={styles.empty}>
                    <Text style={styles.emptyText}>No suggestions right now</Text>
                    <Text style={styles.emptySubtext}>Check back later.</Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scroll: { padding: Spacing.md, paddingBottom: 32 },

    section: { marginBottom: Spacing.md },
    sectionLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginBottom: Spacing.sm,
    },
    requestsBadge: {
        backgroundColor: '#E53935',
        borderRadius: Radii.full,
        minWidth: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
    },
    requestsBadgeText: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: '#fff',
    },
    sectionLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '500',
        color: Colors.light.textTertiary,
        letterSpacing: 0.07 * 10,
        marginBottom: Spacing.sm,
    },

    pendingMeta: { flex: 1 },
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

    cardArea: { alignItems: 'center' },

    swipeCard: {
        width: SCREEN_WIDTH - Spacing.md * 2,
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.lg,
        padding: Spacing.xl,
        alignItems: 'center',
        minHeight: 320,
        justifyContent: 'center',
    },
    swipeLabel: {
        position: 'absolute',
        top: Spacing.lg,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
        borderRadius: Radii.sm,
        borderWidth: 2,
    },
    connectLabel: { left: Spacing.lg, borderColor: Colors.primary },
    connectLabelText: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.primary,
        letterSpacing: 1,
    },
    passLabel: { right: Spacing.lg, borderColor: Colors.light.textTertiary },
    passLabelText: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.light.textTertiary,
        letterSpacing: 1,
    },
    swipeName: {
        fontSize: Typography.sizes.xxl,
        fontWeight: '600',
        color: Colors.light.textPrimary,
        marginTop: Spacing.md,
        textAlign: 'center',
    },
    swipeCity: {
        fontSize: Typography.sizes.md,
        color: Colors.light.textSecondary,
        marginTop: Spacing.xs,
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xl,
        marginTop: Spacing.lg,
        marginBottom: Spacing.md,
    },
    passBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.backgroundSecondary,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    passBtnText: { fontSize: Typography.sizes.lg, color: Colors.light.textTertiary },
    likeBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.backgroundSecondary,
        borderWidth: 1,
        borderColor: Colors.light.border,
    },
    likeBtnActive: { backgroundColor: '#FCE4EC', borderColor: '#F48FB1' },
    likeBtnText: { fontSize: Typography.sizes.xl, color: Colors.light.textTertiary },
    likeBtnTextActive: { color: '#C2185B' },
    connectBtn: {
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        borderRadius: Radii.full,
    },
    connectBtnText: { fontSize: Typography.sizes.md, fontWeight: '600', color: '#fff' },

    reel: { paddingBottom: Spacing.xs, gap: Spacing.lg },
    reelItem: { alignItems: 'center', width: 72, gap: Spacing.xs },
    reelName: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textPrimary,
        textAlign: 'center',
        width: '100%',
    },

    empty: { alignItems: 'center', paddingTop: 60 },
    emptyText: { fontSize: Typography.sizes.lg, fontWeight: '500', color: Colors.light.textPrimary },
    emptySubtext: { fontSize: Typography.sizes.base, color: Colors.light.textTertiary, marginTop: Spacing.sm },
});
