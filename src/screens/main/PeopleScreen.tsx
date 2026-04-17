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
import { ConnectionSheet } from '../../components/ConnectionSheet';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;

interface SwipeCardProps {
    user: api.ScoredUser;
    onPass: () => void;
    onLike: () => void;
}

function SwipeCard({ user, onPass, onLike }: SwipeCardProps) {
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
                    runOnJS(onLike)();
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
                    <Text style={styles.connectLabelText}>LIKE</Text>
                </Animated.View>
                <Animated.View style={[styles.swipeLabel, styles.passLabel, passLabelStyle]}>
                    <Text style={styles.passLabelText}>PASS</Text>
                </Animated.View>

                <Avatar firstName={user.first_name} lastName={user.last_name} avatarUrl={user.avatar_url} size={80} fontSize={28} />
                <Text style={styles.swipeName}>{user.first_name} {user.last_name}</Text>
                {user.city && <Text style={styles.swipeCity}>{user.city}</Text>}
            </Animated.View>
        </GestureDetector>
    );
}


interface PeopleScreenProps {
    onOpenChat: (conversation: api.Conversation) => void;
}

export function PeopleScreen({ onOpenChat }: PeopleScreenProps) {
    const [suggestions, setSuggestions] = useState<api.ScoredUser[]>([]);
    const [matches, setMatches] = useState<api.Connection[]>([]);
    const [likers, setLikers] = useState<api.Liker[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedMatch, setSelectedMatch] = useState<api.Connection | null>(null);
    const load = useCallback(async () => {
        const results = await Promise.allSettled([
            api.getSuggestions(),
            api.getConnections(),
            api.getMyLikes(),
        ]);
        if (results[0].status === 'fulfilled') setSuggestions(results[0].value ?? []);
        if (results[1].status === 'fulfilled') setMatches((results[1].value ?? []).filter(c => c.type === 'MATCH'));
        if (results[2].status === 'fulfilled') setLikers(results[2].value ?? []);
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

    const handleLike = useCallback(async (userId: string) => {
        const user = suggestions.find(u => u.id === userId);
        setSuggestions(prev => prev.filter(u => u.id !== userId));
        try {
            const result = await api.likeUser(userId);
            if (result.matched) {
                const conns = await api.getConnections();
                setMatches((conns ?? []).filter(c => c.type === 'MATCH'));
                setLikers(prev => prev.filter(l => l.id !== userId));
            }
        } catch (e: unknown) {
            if (user) setSuggestions(prev => [user, ...prev]);
            Alert.alert('', e instanceof Error ? e.message : 'Something went wrong.');
        }
    }, [suggestions]);

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
            setSelectedMatch(null);
            onOpenChat(conversation);
        } catch (e: unknown) {
            Alert.alert('Error', e instanceof Error ? e.message : 'Something went wrong.');
        }
    };

    if (loading) {
        return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;
    }

    const current = suggestions[0] ?? null;

    return (
        <>
        <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >

            <View style={styles.section}>
                <Text style={[styles.sectionLabel, styles.sectionLabelStandalone]}>YOUR MATCHES</Text>
                {matches.length > 0 ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.reel}
                    >
                        {matches.map(match => (
                            <TouchableOpacity key={match.id} style={styles.reelItem} onPress={() => setSelectedMatch(match)}>
                                <Avatar firstName={match.first_name} lastName={match.last_name} avatarUrl={match.avatar_url} size={64} fontSize={22} />
                                <MatchBadge />
                                <Text style={styles.reelName} numberOfLines={1}>{match.first_name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                ) : (
                    <Text style={styles.reelEmpty}>No matches yet — keep swiping!</Text>
                )}
            </View>

            <View style={styles.section}>
                <View style={styles.sectionLabelRow}>
                    <Text style={styles.sectionLabel}>PEOPLE WHO LIKED YOU</Text>
                    {likers.length > 0 && (
                        <Text style={styles.sectionCount}>{likers.length}</Text>
                    )}
                </View>
                {likers.length > 0 ? (
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.reel}
                    >
                        {likers.map(liker => (
                            <View key={liker.id} style={styles.reelItem}>
                                <Avatar firstName={liker.first_name} lastName={liker.last_name} avatarUrl={liker.avatar_url_blurred} size={64} fontSize={22} />
                            </View>
                        ))}
                    </ScrollView>
                ) : (
                    <Text style={styles.reelEmpty}>No one yet — put yourself out there!</Text>
                )}
            </View>

            <Text style={[styles.sectionLabel, styles.sectionLabelStandalone]}>SUGGESTED FOR YOU</Text>
            {current ? (
                <View style={styles.cardArea}>
                    <SwipeCard
                        key={current.id}
                        user={current}
                        onPass={() => handlePass(current.id)}
                        onLike={() => handleLike(current.id)}
                    />
                    <View style={styles.actions}>
                        <TouchableOpacity
                            style={styles.passBtn}
                            onPress={() => handlePass(current.id)}
                        >
                            <Text style={styles.passBtnText}>✕</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.likeBtn}
                            onPress={() => handleLike(current.id)}
                        >
                            <Text style={styles.likeBtnText}>✓</Text>
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
        <ConnectionSheet
            visible={selectedMatch !== null}
            connection={selectedMatch}
            onClose={() => setSelectedMatch(null)}
            onMessage={handleMessage}
        />
        </>
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
    sectionCount: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.textOn.primary,
        backgroundColor: Colors.danger,
        minWidth: 18,
        height: 18,
        borderRadius: 9,
        paddingHorizontal: 5,
        textAlign: 'center',
        lineHeight: 18,
        overflow: 'hidden',
    },
    sectionLabel: {
        fontSize: Typography.sizes.xs,
        fontWeight: '500',
        color: Colors.light.textTertiary,
        letterSpacing: 0.07 * 10,
    },
    sectionLabelStandalone: {
        marginBottom: Spacing.sm,
    },

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
    connectLabel: { left: Spacing.lg, borderColor: Colors.success },
    connectLabelText: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.success,
        letterSpacing: 1,
    },
    passLabel: { right: Spacing.lg, borderColor: Colors.danger },
    passLabelText: {
        fontSize: Typography.sizes.md,
        fontWeight: '700',
        color: Colors.danger,
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
        backgroundColor: Colors.dangerSubtle,
        borderWidth: 1,
        borderColor: Colors.danger,
    },
    passBtnText: { fontSize: Typography.sizes.lg, color: Colors.danger },
    likeBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.successSubtle,
        borderWidth: 1,
        borderColor: Colors.success,
    },
    likeBtnText: { fontSize: Typography.sizes.xl, color: Colors.success },


    reelEmpty: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
        paddingVertical: Spacing.md,
    },
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
