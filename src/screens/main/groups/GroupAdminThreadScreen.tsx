import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as api from '../../../api/client';
import { Avatar } from '../../../components/Avatar';
import { useReplyGroupAdminThreadMutation } from '../../../hooks/queries/useGroups';
import { useAuth } from '../../../hooks/useAuth';
import { composerStandards } from '../../../styles/composerStandards';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../../../theme';
import { formatUsername } from '../../../utils/identity';
import { ChatHeader } from '../chat/ChatHeader';
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
    const [thread, setThread] = useState<api.GroupAdminThread | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [headerHeight, setHeaderHeight] = useState(0);
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
            setLoadError(error instanceof Error ? error.message : 'Could not load this chat.');
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

    const canReply = thread ? thread.status !== 'resolved' : false;
    const displayName = thread?.username ? formatUsername(thread.username) : 'Admin inbox';
    const keyboardVerticalOffset = insets.top + headerHeight;
    const headerChat = useMemo<api.Chat>(() => ({
        id: thread?.id ?? threadId,
        is_group: false,
        username: thread?.username ?? 'member',
        avatar_url: thread?.avatar_url ?? undefined,
        created_at: thread?.created_at ?? new Date().toISOString(),
    }), [thread?.avatar_url, thread?.created_at, thread?.id, thread?.username, threadId]);

    const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
        setHeaderHeight(event.nativeEvent.layout.height);
    }, []);

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
                <ChatHeader
                    chat={headerChat}
                    displayName={displayName}
                    onBack={onBack}
                />
            </View>

            <View style={bodyStyle}>
                {loading ? (
                    <View style={styles.center}>
                        <ActivityIndicator color={Colors.primary} />
                    </View>
                ) : loadError ? (
                    <View style={styles.center}>
                        <Text style={styles.errorTitle}>Could not load this chat</Text>
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
                                                placeholder: 'Message',
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
                                        This chat is closed to new messages.
                                    </Text>
                                </View>
                            )
                        )}
                    />
                )}
            </View>
        </View>
    );
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
