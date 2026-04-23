import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    LayoutChangeEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Radii, Spacing, Typography } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    Bubble,
    Composer,
    Day,
    GiftedChat,
    InputToolbar,
    Send,
} from '../../vendor/giftedChat';
import { Ionicons } from '@expo/vector-icons';
import { ChatHeader } from './chat/ChatHeader';
import {
    ChatGiftedMessage,
    toGiftedChatMessages,
    toGiftedChatUser,
} from './chat/chatGiftedModels';
import { useChatThreadController } from './chat/useChatThreadController';

interface ChatScreenProps {
    chat: api.Chat;
    onBack: () => void;
}

export function ChatScreen({ chat, onBack }: ChatScreenProps) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [headerHeight, setHeaderHeight] = useState(0);
    const [supportChat, setSupportChat] = useState(chat);
    const [supportActionPending, setSupportActionPending] = useState(false);
    const displayName = supportChat.is_group
        ? (supportChat.name ?? 'Group')
        : formatUsername(supportChat.username);
    const currentUser = useMemo(
        () => (user ? {
            id: user.id,
            username: user.username,
            avatar_url: user.avatar_url,
        } : undefined),
        [user],
    );
    const giftedUser = useMemo(
        () => toGiftedChatUser(currentUser),
        [currentUser],
    );

    const {
        messages,
        otherUserLastReadMessageId,
        loading,
        loadError,
        loadingOlder,
        hasMore,
        sending,
        sendMessage,
        loadOlderMessages,
        reloadMessages,
    } = useChatThreadController({
        chatId: chat.id,
        currentUser,
    });

    const giftedMessages = useMemo(
        () => toGiftedChatMessages(messages, currentUser?.id, otherUserLastReadMessageId),
        [currentUser?.id, messages, otherUserLastReadMessageId],
    );
    const supportContext = supportChat.support_context;
    const supportStatus = supportContext?.status;
    const isSupportPending = supportStatus === 'pending_requester_acceptance';
    const isSupportAccepted = !supportContext || supportStatus === 'accepted';
    const isRequesterAwaiting = supportContext?.awaiting_user_id === user?.id;
    const keyboardVerticalOffset = insets.top + headerHeight;
    const bodyStyle = useMemo(
        () => [styles.body, { paddingBottom: insets.bottom }],
        [insets.bottom],
    );

    useEffect(() => {
        setSupportChat(chat);
    }, [chat]);

    const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
        setHeaderHeight(event.nativeEvent.layout.height);
    }, []);

    const handleSendMessage = useCallback((outgoing: ChatGiftedMessage[] = []) => {
        if (!isSupportAccepted) return;
        const body = outgoing[0]?.text?.trim();
        if (!body || sending) return;
        void sendMessage(body);
    }, [isSupportAccepted, sendMessage, sending]);

    const handleAcceptSupportChat = useCallback(async () => {
        if (!supportChat.support_context || supportActionPending) return;

        setSupportActionPending(true);
        try {
            const updatedChat = await api.acceptSupportChat(supportChat.id);
            setSupportChat(updatedChat);
        } catch (e: unknown) {
            Alert.alert('Could not accept support chat', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSupportActionPending(false);
        }
    }, [supportActionPending, supportChat]);

    const handleDeclineSupportChat = useCallback(async () => {
        if (!supportChat.support_context || supportActionPending) return;

        setSupportActionPending(true);
        try {
            const updatedChat = await api.declineSupportChat(supportChat.id);
            setSupportChat(updatedChat);
        } catch (e: unknown) {
            Alert.alert('Could not decline support chat', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSupportActionPending(false);
        }
    }, [supportActionPending, supportChat]);

    return (
        <View style={styles.container}>
            <View onLayout={handleHeaderLayout}>
                <ChatHeader
                    chat={supportChat}
                    displayName={displayName}
                    onBack={onBack}
                />
                {supportContext ? (
                    <View style={styles.supportContextCard}>
                        <Text style={styles.supportContextEyebrow}>SUPPORT CONTEXT</Text>
                        <Text style={styles.supportContextTitle}>
                            {formatSupportType(supportContext.request_type)}
                        </Text>
                        {supportContext.request_message ? (
                            <Text style={styles.supportContextBody}>
                                {supportContext.request_message}
                            </Text>
                        ) : null}
                        <Text style={styles.supportContextMeta}>
                            {formatUsername(supportContext.requester_username)}
                            {(supportContext.latest_response_type ?? supportContext.responder_mode)
                                ? ` · ${formatSupportResponseType(supportContext.latest_response_type ?? supportContext.responder_mode!)}`
                                : ''}
                        </Text>
                        {isSupportPending ? (
                            <View style={styles.supportPendingPanel}>
                                {isRequesterAwaiting ? (
                                    <>
                                        <Text style={styles.supportPendingTitle}>Someone offered support</Text>
                                        <Text style={styles.supportPendingBody}>
                                            Accept to unlock the conversation and reply when you are ready.
                                        </Text>
                                        <View style={styles.supportPendingActions}>
                                            <TouchableOpacity
                                                style={[styles.supportSecondaryButton, supportActionPending && styles.supportActionDisabled]}
                                                onPress={handleDeclineSupportChat}
                                                disabled={supportActionPending}
                                            >
                                                <Text style={styles.supportSecondaryButtonText}>
                                                    {supportActionPending ? 'Saving...' : 'Not now'}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.supportPrimaryButton, supportActionPending && styles.supportActionDisabled]}
                                                onPress={handleAcceptSupportChat}
                                                disabled={supportActionPending}
                                            >
                                                <Text style={styles.supportPrimaryButtonText}>
                                                    {supportActionPending ? 'Saving...' : 'Accept and reply'}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.supportPendingTitle}>Support sent</Text>
                                        <Text style={styles.supportPendingBody}>
                                            Waiting for them to accept before chatting.
                                        </Text>
                                    </>
                                )}
                            </View>
                        ) : null}
                        {supportStatus === 'declined' ? (
                            <View style={styles.supportPendingPanel}>
                                <Text style={styles.supportPendingTitle}>Support request declined</Text>
                                <Text style={styles.supportPendingBody}>
                                    This thread stays visible, but messaging is unavailable.
                                </Text>
                            </View>
                        ) : null}
                    </View>
                ) : null}
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
                        <TouchableOpacity style={styles.retryButton} onPress={reloadMessages}>
                            <Text style={styles.retryButtonText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <GiftedChat<ChatGiftedMessage>
                        messages={giftedMessages}
                        user={giftedUser}
                        onSend={handleSendMessage}
                        loadEarlierMessagesProps={{
                            isAvailable: hasMore,
                            isLoading: loadingOlder,
                            onPress: loadOlderMessages,
                            label: 'Load earlier messages',
                        }}
                        isAlignedTop
                        isSendButtonAlwaysVisible
                        isScrollToBottomEnabled
                        scrollToBottomOffset={120}
                        isDayAnimationEnabled={false}
                        messagesContainerStyle={styles.messagesContainer}
                        keyboardAvoidingViewProps={{
                            keyboardVerticalOffset,
                        }}
                        renderBubble={(props) => (
                            <Bubble
                                {...props}
                                wrapperStyle={{
                                    left: styles.bubbleLeft,
                                    right: styles.bubbleRight,
                                }}
                                textStyle={{
                                    left: styles.bubbleTextLeft,
                                    right: styles.bubbleTextRight,
                                }}
                                renderTime={(timeProps) => (
                                    <Text
                                        style={[
                                            styles.timeLabel,
                                            timeProps.position === 'right'
                                                ? styles.timeLabelRight
                                                : styles.timeLabelLeft,
                                        ]}
                                    >
                                        {formatMessageTime(timeProps.currentMessage.createdAt)}
                                    </Text>
                                )}
                            />
                        )}
                        renderDay={(props) => (
                            <Day
                                {...props}
                                containerStyle={styles.dayContainer}
                                wrapperStyle={styles.dayWrapper}
                                textProps={{ style: styles.dayText }}
                            />
                        )}
                        renderInputToolbar={(props) => (
                            isSupportAccepted ? (
                                <InputToolbar
                                    {...props}
                                    containerStyle={styles.toolbarContainer}
                                    primaryStyle={styles.toolbarPrimary}
                                    renderComposer={(composerProps) => (
                                        <Composer
                                            {...composerProps}
                                            textInputProps={{
                                                ...composerProps.textInputProps,
                                                placeholder: 'Message',
                                                placeholderTextColor: Colors.light.textTertiary,
                                                style: [
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
                                                enabled: sending ? false : sendProps.sendButtonProps?.enabled,
                                                style: [
                                                    styles.sendButton,
                                                    !sendProps.text?.trim() && styles.sendButtonDisabled,
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
                                        {supportStatus === 'declined'
                                            ? 'This support thread is closed to new messages.'
                                            : isRequesterAwaiting
                                                ? 'Accept this support chat to reply.'
                                                : 'Waiting for them to accept before chatting.'}
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

function formatSupportType(value: api.SupportRequest['type']): string {
    switch (value) {
    case 'need_to_talk':
        return 'Need to talk';
    case 'need_distraction':
        return 'Need distraction';
    case 'need_encouragement':
        return 'Need encouragement';
    case 'need_company':
        return 'Need company';
    default:
        return 'Support request';
    }
}

function formatSupportResponseType(value: api.SupportResponse['response_type']): string {
    switch (value) {
    case 'can_chat':
        return 'Can chat now';
    case 'check_in_later':
        return 'Check in later';
    case 'nearby':
        return 'Nearby';
    default:
        return 'Support response';
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    body: {
        flex: 1,
    },
    supportContextCard: {
        backgroundColor: Colors.successSubtle,
        borderBottomWidth: 1,
        borderBottomColor: Colors.light.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    supportContextEyebrow: {
        fontSize: Typography.sizes.xs,
        fontWeight: '700',
        color: Colors.success,
        letterSpacing: 0.8,
    },
    supportContextTitle: {
        fontSize: Typography.sizes.md,
        fontWeight: '600',
        color: Colors.light.textPrimary,
        marginTop: 4,
    },
    supportContextBody: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textSecondary,
        lineHeight: 19,
        marginTop: 6,
    },
    supportContextMeta: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
        marginTop: 8,
    },
    supportPendingPanel: {
        marginTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.light.border,
        paddingTop: Spacing.md,
    },
    supportPendingTitle: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    supportPendingBody: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textSecondary,
        lineHeight: 19,
        marginTop: 4,
    },
    supportPendingActions: {
        flexDirection: 'row',
        gap: Spacing.sm,
        marginTop: Spacing.md,
    },
    supportPrimaryButton: {
        backgroundColor: Colors.primary,
        borderRadius: Radii.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    supportPrimaryButtonText: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    supportSecondaryButton: {
        backgroundColor: Colors.light.background,
        borderRadius: Radii.full,
        borderWidth: 1,
        borderColor: Colors.light.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    supportSecondaryButtonText: {
        color: Colors.light.textSecondary,
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
    },
    supportActionDisabled: { opacity: 0.6 },
    messagesContainer: {
        backgroundColor: Colors.light.background,
    },
    lockedToolbar: {
        borderTopWidth: 1,
        borderTopColor: Colors.light.border,
        backgroundColor: Colors.light.backgroundSecondary,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    lockedToolbarText: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textSecondary,
        textAlign: 'center',
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.lg,
    },
    errorTitle: {
        fontSize: Typography.sizes.lg,
        fontWeight: '600',
        color: Colors.light.textPrimary,
    },
    errorBody: {
        marginTop: Spacing.xs,
        fontSize: Typography.sizes.base,
        color: Colors.light.textSecondary,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: Spacing.md,
        borderRadius: Radii.full,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
    },
    retryButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.textOn.primary,
    },
    bubbleLeft: {
        backgroundColor: Colors.bg.raised,
    },
    bubbleRight: {
        backgroundColor: Colors.success,
    },
    bubbleTextLeft: {
        color: Colors.text.primary,
        fontSize: Typography.sizes.lg,
        lineHeight: 20,
    },
    bubbleTextRight: {
        color: Colors.textOn.primary,
        fontSize: Typography.sizes.lg,
        lineHeight: 20,
    },
    timeLabel: {
        fontSize: Typography.sizes.xs,
        marginTop: -2,
        marginHorizontal: Spacing.xs,
        marginBottom: 2,
    },
    timeLabelLeft: {
        color: Colors.text.secondary,
    },
    timeLabelRight: {
        color: Colors.textOn.primary,
    },
    dayContainer: {
        marginVertical: Spacing.sm,
    },
    dayWrapper: {
        backgroundColor: Colors.bg.surface,
        borderRadius: Radii.full,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border.default,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.xs,
    },
    dayText: {
        color: Colors.text.secondary,
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.medium,
    },
    toolbarContainer: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
        paddingHorizontal: Spacing.sm,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.sm,
    },
    toolbarPrimary: {
        alignItems: 'flex-end',
    },
    composerInput: {
        minHeight: 44,
        borderRadius: Radii.full,
        backgroundColor: Colors.bg.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border.default,
        color: Colors.text.primary,
        fontSize: Typography.sizes.lg,
        lineHeight: 20,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.sm,
        marginLeft: 0,
        marginTop: 0,
    },
    sendContainer: {
        justifyContent: 'flex-end',
        marginLeft: Spacing.sm,
        marginBottom: 2,
    },
    sendButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
    },
    sendButtonDisabled: {
        backgroundColor: Colors.secondary,
    },
});
