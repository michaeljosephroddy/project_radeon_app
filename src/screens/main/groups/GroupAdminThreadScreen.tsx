import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../../api/client';
import { Avatar } from '../../../components/Avatar';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { useReplyGroupAdminThreadMutation, useResolveGroupAdminThreadMutation } from '../../../hooks/queries/useGroups';
import { useAuth } from '../../../hooks/useAuth';
import { useGradualKeyboardInset } from '../../../hooks/useGradualKeyboardInset';
import { composerStandards } from '../../../styles/composerStandards';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../../../theme';
import { formatReadableTimestamp } from '../../../utils/date';
import {
    Composer,
    Day,
    GiftedChat,
    InputToolbar,
    Send,
    type GiftedChatMessage,
} from '../../../vendor/giftedChat';

interface GroupAdminThreadScreenProps {
    group: api.Group;
    threadId: string;
    onBack: () => void;
}

interface ThreadGiftedMessage extends GiftedChatMessage {
    senderId: string;
}

export function GroupAdminThreadScreen({
    group,
    threadId,
    onBack,
}: GroupAdminThreadScreenProps): React.ReactElement {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const replyMutation = useReplyGroupAdminThreadMutation(group.id);
    const resolveMutation = useResolveGroupAdminThreadMutation(group.id);
    const [thread, setThread] = useState<api.GroupAdminThread | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [headerHeight, setHeaderHeight] = useState(0);
    const bottomSafeSpace = Math.max(insets.bottom, Spacing.sm);
    const { height: keyboardInsetHeight } = useGradualKeyboardInset({
        closedHeight: bottomSafeSpace,
        openedOffset: Spacing.sm,
    });
    const keyboardSpacerStyle = useAnimatedStyle((): { height: number } => ({
        height: keyboardInsetHeight.value,
    }));
    const bodyStyle = useMemo(
        () => [styles.body, { paddingBottom: insets.bottom }],
        [insets.bottom],
    );

    const loadThread = useCallback(async (): Promise<void> => {
        setLoading(true);
        setLoadError(null);
        try {
            const detail = await api.getGroupAdminThread(group.id, threadId);
            setThread(detail);
        } catch (error: unknown) {
            setLoadError(error instanceof Error ? error.message : 'Could not load this thread.');
        } finally {
            setLoading(false);
        }
    }, [group.id, threadId]);

    useEffect(() => {
        void loadThread();
    }, [loadThread]);

    const giftedMessages = useMemo<ThreadGiftedMessage[]>(() => (
        (thread?.messages ?? [])
            .slice()
            .reverse()
            .map((message) => ({
                _id: message.id,
                text: message.body,
                createdAt: new Date(message.created_at),
                user: {
                    _id: message.sender_id,
                    name: message.username,
                    avatar: message.avatar_url ?? undefined,
                },
                senderId: message.sender_id,
            }))
    ), [thread?.messages]);

    const canReply = thread?.status === 'open';
    const displayName = thread?.subject || thread?.username || 'Admin inbox';
    const keyboardVerticalOffset = insets.top + headerHeight;

    const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
        setHeaderHeight(event.nativeEvent.layout.height);
    }, []);

    const handleResolve = useCallback(async (): Promise<void> => {
        if (!thread || resolveMutation.isPending) return;
        try {
            await resolveMutation.mutateAsync(thread.id);
            await loadThread();
        } catch (error: unknown) {
            Alert.alert('Could not resolve thread', error instanceof Error ? error.message : 'Please try again.');
        }
    }, [loadThread, resolveMutation, thread]);

    const handleSend = useCallback((outgoing: ThreadGiftedMessage[] = []): void => {
        const body = outgoing[0]?.text?.trim();
        if (!thread || !body || replyMutation.isPending) return;
        void replyMutation.mutateAsync({ threadId: thread.id, body })
            .then(loadThread)
            .catch((error: unknown) => {
                Alert.alert('Could not reply', error instanceof Error ? error.message : 'Please try again.');
            });
    }, [loadThread, replyMutation, thread]);

    return (
        <View style={styles.container}>
            <View onLayout={handleHeaderLayout}>
                <ScreenHeader
                    onBack={onBack}
                    centerContent={(
                        <View style={styles.centerContent}>
                            <Avatar
                                username={thread?.username ?? 'member'}
                                avatarUrl={thread?.avatar_url ?? undefined}
                                size={32}
                                fontSize={12}
                            />
                            <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
                        </View>
                    )}
                />
                <View style={styles.contextCard}>
                    <Text style={styles.contextEyebrow}>ADMIN THREAD</Text>
                    <Text style={styles.contextTitle}>{formatAdminThreadStatus(thread?.status)}</Text>
                    {thread?.updated_at ? (
                        <Text style={styles.contextMeta}>{formatReadableTimestamp(thread.updated_at)}</Text>
                    ) : null}
                    {thread && thread.status !== 'resolved' ? (
                        <TouchableOpacity
                            style={styles.contextResolveAction}
                            onPress={() => { void handleResolve(); }}
                            disabled={resolveMutation.isPending}
                        >
                            <Ionicons name="checkmark-done" size={16} color={Colors.primary} />
                            <Text style={styles.contextResolveText}>Resolve</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>

            <View style={bodyStyle}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={Colors.primary} />
                    </View>
                ) : loadError ? (
                    <View style={styles.center}>
                        <Text style={styles.errorTitle}>Could not load this thread</Text>
                        <Text style={styles.errorBody}>{loadError}</Text>
                        <TouchableOpacity style={styles.retryButton} onPress={() => { void loadThread(); }}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <GiftedChat<ThreadGiftedMessage>
                        messages={giftedMessages}
                        user={{ _id: user?.id ?? 'admin' }}
                        onSend={handleSend}
                        isSendButtonAlwaysVisible
                        isScrollToBottomEnabled
                        scrollToBottomOffset={120}
                        isDayAnimationEnabled={false}
                        isUserAvatarVisible
                        isAvatarVisibleForEveryMessage
                        containerStyle={{
                            left: styles.giftedMessageContainer,
                            right: styles.giftedMessageContainer,
                        }}
                        messagesContainerStyle={styles.messagesContainer}
                        keyboardAvoidingViewProps={{ keyboardVerticalOffset }}
                        renderAvatar={null}
                        renderBubble={(props) => {
                            const messageUser = props.currentMessage.user;
                            const avatarUrl = typeof messageUser.avatar === 'string' ? messageUser.avatar : undefined;
                            return (
                                <View style={styles.flatMessageRow}>
                                    <Avatar
                                        username={String(messageUser.name ?? '')}
                                        avatarUrl={avatarUrl}
                                        size={36}
                                        fontSize={13}
                                    />
                                    <View style={styles.flatBubble}>
                                        <Text style={styles.flatBubbleText}>{props.currentMessage.text}</Text>
                                        <Text style={styles.timeLabel}>
                                            {formatMessageTime(props.currentMessage.createdAt)}
                                        </Text>
                                    </View>
                                </View>
                            );
                        }}
                        renderDay={(props) => (
                            <Day
                                {...props}
                                containerStyle={styles.dayContainer}
                                wrapperStyle={styles.dayWrapper}
                                textProps={{ style: styles.dayText }}
                            />
                        )}
                        renderInputToolbar={(props) => (
                            canReply ? (
                                <InputToolbar
                                    {...props}
                                    containerStyle={[composerStandards.row, styles.toolbarContainer]}
                                    primaryStyle={styles.toolbarPrimary}
                                    renderComposer={(composerProps) => (
                                        <Composer
                                            {...composerProps}
                                            textInputProps={{
                                                ...composerProps.textInputProps,
                                                placeholder: 'Reply',
                                                placeholderTextColor: Colors.text.muted,
                                                style: [
                                                    composerStandards.input,
                                                    styles.composerInput,
                                                    composerProps.textInputProps?.style,
                                                ],
                                            }}
                                        />
                                    )}
                                    renderSend={(sendProps) => (
                                        <Send
                                            {...sendProps}
                                            containerStyle={styles.sendContainer}
                                            sendButtonProps={{
                                                ...sendProps.sendButtonProps,
                                                enabled: replyMutation.isPending ? false : sendProps.sendButtonProps?.enabled,
                                                style: [
                                                    composerStandards.sendButton,
                                                    !sendProps.text?.trim() && composerStandards.sendButtonDisabled,
                                                    sendProps.sendButtonProps?.style,
                                                ],
                                            }}
                                        >
                                            <Ionicons
                                                name="send"
                                                size={18}
                                                color={Colors.textOn.primary}
                                            />
                                        </Send>
                                    )}
                                />
                            ) : (
                                <View style={styles.lockedToolbar}>
                                    <Text style={styles.lockedToolbarText}>
                                        This thread is closed to new messages.
                                    </Text>
                                </View>
                            )
                        )}
                    />
                )}
            </View>
            <Animated.View style={[styles.keyboardSpacer, keyboardSpacerStyle]} />
        </View>
    );
}

function formatAdminThreadStatus(status?: api.GroupAdminThread['status']): string {
    if (status === 'open') return 'Open';
    if (status === 'replied') return 'Replied';
    if (status === 'resolved') return 'Resolved';
    return 'Inbox';
}

function formatMessageTime(value: Date | number): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    body: {
        flex: 1,
    },
    keyboardSpacer: {
        flexShrink: 0,
        backgroundColor: Colors.bg.page,
    },
    centerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        justifyContent: 'center',
    },
    headerName: {
        flexShrink: 1,
        ...TextStyles.sectionTitle,
        color: Colors.text.primary,
    },
    contextCard: {
        backgroundColor: Colors.successSubtle,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    contextEyebrow: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.success,
        letterSpacing: 0.8,
    },
    contextTitle: {
        ...TextStyles.cardTitle,
        marginTop: 4,
    },
    contextMeta: {
        ...TextStyles.meta,
        marginTop: 6,
    },
    contextResolveAction: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        marginTop: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.primary,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.page,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    contextResolveText: {
        ...TextStyles.chip,
        color: Colors.primary,
        fontWeight: '800',
    },
    messagesContainer: {
        backgroundColor: Colors.bg.page,
    },
    giftedMessageContainer: {
        alignSelf: 'flex-start',
        justifyContent: 'flex-start',
        marginLeft: Spacing.md,
        marginRight: Spacing.md,
        maxWidth: '100%',
    },
    flatMessageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'flex-start',
        gap: Spacing.sm,
        maxWidth: '100%',
    },
    flatBubble: {
        alignItems: 'flex-start',
        flexShrink: 1,
        paddingVertical: 2,
    },
    flatBubbleText: {
        ...TextStyles.sectionTitle,
        color: Colors.text.primary,
        lineHeight: 22,
        textAlign: 'left',
    },
    timeLabel: {
        ...TextStyles.meta,
        marginTop: 3,
    },
    dayContainer: {
        marginVertical: Spacing.sm,
    },
    dayWrapper: {
        backgroundColor: Colors.bg.surface,
        borderRadius: Radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    dayText: {
        ...TextStyles.chip,
        color: Colors.text.secondary,
        fontWeight: Typography.weights.medium,
    },
    toolbarContainer: {
        paddingBottom: Spacing.sm,
    },
    toolbarPrimary: {
        alignItems: 'flex-end',
    },
    composerInput: {
        marginLeft: 0,
        marginTop: 0,
    },
    sendContainer: {
        justifyContent: 'flex-end',
        marginLeft: Spacing.sm,
        marginBottom: 2,
    },
    lockedToolbar: {
        borderTopWidth: 1,
        borderTopColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    lockedToolbarText: {
        ...TextStyles.secondary,
        textAlign: 'center',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
    },
    errorTitle: {
        ...TextStyles.sectionTitle,
    },
    errorBody: {
        marginTop: Spacing.xs,
        ...TextStyles.secondary,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: Spacing.md,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    retryButtonText: {
        ...TextStyles.button,
        fontSize: TextStyles.chip.fontSize,
    },
});
