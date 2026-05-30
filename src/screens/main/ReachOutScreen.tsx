import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '../../api/client';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/ui/EmptyState';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { useActiveSupportSignals, useMySupportSignal } from '../../hooks/queries/useSupport';
import { queryKeys } from '../../query/queryKeys';
import { screenStandards } from '../../styles/screenStandards';
import { AvatarSizes, Colors, ContentInsets, IconSizes, Radius, Spacing, TextStyles } from '../../theme';

const REASON_LABELS: Record<api.SupportSignalReason, string> = {
    cravings: 'Cravings',
    relapse_risk: 'Relapse risk',
    overwhelmed: 'Overwhelmed',
    lonely: 'Lonely',
    risky_place: 'Risky place',
    need_to_talk: 'Need to talk',
};

interface ReachOutScreenProps {
    isActive: boolean;
    onOpenChat: (chat: api.Chat) => void;
    focusSignalId?: string | null;
}

export function ReachOutScreen({ isActive, onOpenChat, focusSignalId = null }: ReachOutScreenProps): React.ReactElement {
    const queryClient = useQueryClient();
    const activeSignalsQuery = useActiveSupportSignals(20, isActive);
    const mySignalQuery = useMySupportSignal(isActive);
    const [pendingId, setPendingId] = useState<string | null>(null);

    const signals = useMemo(
        () => {
            const items = activeSignalsQuery.data?.pages.flatMap((page) => page.items ?? []) ?? [];
            if (!focusSignalId) return items;
            return [...items].sort((a, b) => {
                if (a.id === focusSignalId) return -1;
                if (b.id === focusSignalId) return 1;
                return 0;
            });
        },
        [activeSignalsQuery.data, focusSignalId],
    );
    const mySignal = mySignalQuery.data ?? null;
    const isRefreshing = activeSignalsQuery.isRefetching || mySignalQuery.isRefetching;

    const invalidateSignals = async (): Promise<void> => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['support-signals'] }),
            queryClient.invalidateQueries({ queryKey: queryKeys.supportSignals({ scope: 'mine' }) }),
        ]);
    };

    const handleRefresh = (): void => {
        void Promise.all([activeSignalsQuery.refetch(), mySignalQuery.refetch()]);
    };

    const handleRespond = async (signal: api.SupportSignal): Promise<void> => {
        setPendingId(signal.id);
        try {
            const result = await api.respondToSupportSignal(signal.id);
            await invalidateSignals();
            const chat = await api.getChat(result.chat_id);
            onOpenChat(chat);
        } catch (error) {
            Alert.alert('Could not open chat', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setPendingId(null);
        }
    };

    const handleCloseOwnSignal = (action: 'resolve' | 'cancel'): void => {
        if (!mySignal) return;
        const title = action === 'resolve' ? 'Mark as okay?' : 'Cancel Reach Out?';
        const message = action === 'resolve'
            ? 'This will remove your Reach Out signal.'
            : 'People will stop seeing that you are reaching out.';
        Alert.alert(title, message, [
            { text: 'Keep it live', style: 'cancel' },
            {
                text: action === 'resolve' ? 'Mark okay' : 'Cancel',
                style: action === 'cancel' ? 'destructive' : 'default',
                onPress: () => {
                    setPendingId(mySignal.id);
                    const request = action === 'resolve'
                        ? api.resolveSupportSignal(mySignal.id)
                        : api.cancelSupportSignal(mySignal.id);
                    request
                        .then(() => invalidateSignals())
                        .catch((error: unknown) => {
                            Alert.alert('Could not update Reach Out', error instanceof Error ? error.message : 'Please try again.');
                        })
                        .finally(() => setPendingId(null));
                },
            },
        ]);
    };

    const renderSignal = ({ item }: { item: api.SupportSignal }): React.ReactElement => (
        <SupportSignalCard
            signal={item}
            focused={item.id === focusSignalId}
            pending={pendingId === item.id}
            onRespond={() => handleRespond(item)}
        />
    );

    const isInitialLoading = activeSignalsQuery.isLoading && signals.length === 0;

    return (
        <View style={styles.screen}>
            <FlatList
                data={signals}
                keyExtractor={(item) => item.id}
                renderItem={renderSignal}
                contentContainerStyle={[
                    screenStandards.listContent,
                    signals.length === 0 && !mySignal ? styles.emptyContent : null,
                ]}
                ListHeaderComponent={(
                    <View style={styles.headerStack}>
                        {mySignal ? (
                            <OwnSignalBanner
                                signal={mySignal}
                                pending={pendingId === mySignal.id}
                                onResolve={() => handleCloseOwnSignal('resolve')}
                                onCancel={() => handleCloseOwnSignal('cancel')}
                            />
                        ) : (
                            <View style={styles.infoPanel}>
                                <Text style={styles.infoTitle}>Reach Out</Text>
                                <Text style={styles.infoCopy}>When someone needs a quick sober check-in, their signal appears here for a short time.</Text>
                            </View>
                        )}
                    </View>
                )}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={isInitialLoading ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator color={Colors.primary} />
                    </View>
                ) : (
                    <EmptyState
                        title="No one is reaching out right now."
                        description="This space updates when someone asks for immediate support."
                        compact
                    />
                )}
                refreshControl={(
                    <RefreshControl
                        tintColor={Colors.primary}
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                    />
                )}
                onEndReached={() => {
                    if (activeSignalsQuery.hasNextPage && !activeSignalsQuery.isFetchingNextPage) {
                        void activeSignalsQuery.fetchNextPage();
                    }
                }}
                onEndReachedThreshold={0.35}
                ListFooterComponent={activeSignalsQuery.isFetchingNextPage ? (
                    <ActivityIndicator style={styles.footerLoader} color={Colors.primary} />
                ) : null}
            />
        </View>
    );
}

function OwnSignalBanner({
    signal,
    pending,
    onResolve,
    onCancel,
}: {
    signal: api.SupportSignal;
    pending: boolean;
    onResolve: () => void;
    onCancel: () => void;
}): React.ReactElement {
    return (
        <View style={styles.ownBanner}>
            <View style={styles.ownIcon}>
                <Ionicons name="heart" size={IconSizes.row} color={Colors.textOn.primary} />
            </View>
            <View style={styles.ownCopy}>
                <Text style={styles.ownTitle}>Your Reach Out is live</Text>
                <Text style={styles.ownDescription}>{REASON_LABELS[signal.reason]} · people can message you now.</Text>
            </View>
            <View style={styles.ownActions}>
                <Pressable style={styles.textButton} onPress={onCancel} disabled={pending}>
                    <Text style={styles.textButtonLabel}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.resolveButton} onPress={onResolve} disabled={pending}>
                    <Text style={styles.resolveButtonLabel}>Okay</Text>
                </Pressable>
            </View>
        </View>
    );
}

function SupportSignalCard({
    signal,
    focused,
    pending,
    onRespond,
}: {
    signal: api.SupportSignal;
    focused: boolean;
    pending: boolean;
    onRespond: () => void;
}): React.ReactElement {
    return (
        <View style={[styles.card, focused && styles.cardFocused]}>
            <View style={styles.cardHeader}>
                <Avatar username={signal.username} avatarUrl={signal.avatar_url ?? undefined} size={AvatarSizes.list} />
                <View style={styles.identity}>
                    <Text style={styles.username}>{signal.username}</Text>
                    <Text style={styles.meta}>{signal.city ?? 'SoberSpace'} · {REASON_LABELS[signal.reason]}</Text>
                </View>
                {signal.is_friend ? (
                    <View style={styles.friendBadge}>
                        <Text style={styles.friendBadgeText}>Friend</Text>
                    </View>
                ) : null}
            </View>
            <View style={styles.cardFooter}>
                <Text style={styles.responseCount}>{signal.response_count} replied</Text>
                <PrimaryButton
                    label="Message"
                    onPress={onRespond}
                    loading={pending}
                    style={styles.messageButton}
                    leftAdornment={<Ionicons name="chatbubble-outline" size={IconSizes.inline} color={Colors.textOn.primary} />}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    emptyContent: {
        flexGrow: 1,
    },
    headerStack: {
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
    },
    infoPanel: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        padding: Spacing.lg,
        backgroundColor: Colors.bg.surface,
    },
    infoTitle: {
        ...TextStyles.sectionTitle,
    },
    infoCopy: {
        ...TextStyles.secondary,
        marginTop: Spacing.xs,
    },
    ownBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.primary,
        borderRadius: Radius.md,
        padding: Spacing.md,
        backgroundColor: Colors.primarySubtle,
    },
    ownIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
    },
    ownCopy: {
        flex: 1,
    },
    ownTitle: {
        ...TextStyles.cardTitle,
    },
    ownDescription: {
        ...TextStyles.meta,
        marginTop: 2,
    },
    ownActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    textButton: {
        minHeight: 36,
        justifyContent: 'center',
    },
    textButtonLabel: {
        ...TextStyles.rowDescription,
        color: Colors.text.secondary,
    },
    resolveButton: {
        minHeight: 36,
        justifyContent: 'center',
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        backgroundColor: Colors.primary,
    },
    resolveButtonLabel: {
        ...TextStyles.button,
    },
    separator: {
        height: Spacing.md,
    },
    card: {
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        padding: Spacing.md,
        backgroundColor: Colors.bg.surface,
    },
    cardFocused: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    identity: {
        flex: 1,
    },
    username: {
        ...TextStyles.cardTitle,
    },
    meta: {
        ...TextStyles.meta,
        marginTop: 2,
    },
    friendBadge: {
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        backgroundColor: Colors.successSubtle,
    },
    friendBadgeText: {
        ...TextStyles.caption,
        color: Colors.success,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.md,
        marginTop: Spacing.md,
    },
    responseCount: {
        ...TextStyles.meta,
    },
    messageButton: {
        minHeight: 38,
        paddingVertical: Spacing.sm,
    },
    loadingWrap: {
        paddingTop: ContentInsets.screenHorizontal,
    },
    footerLoader: {
        paddingVertical: Spacing.lg,
    },
});
