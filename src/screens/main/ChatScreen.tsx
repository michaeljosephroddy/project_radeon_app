import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
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
    SystemMessageProps,
} from '../../vendor/giftedChat';
import { Ionicons } from '@expo/vector-icons';
import { ChatHeader } from './chat/ChatHeader';
import { composerStandards } from '../../styles/composerStandards';
import {
    ChatGiftedMessage,
    toGiftedChatMessages,
    toGiftedChatUser,
} from './chat/chatGiftedModels';
import { useChatThreadController } from './chat/useChatThreadController';
import { useChat } from '../../hooks/queries/useChat';

interface ChatScreenProps {
    chat: api.Chat;
    onBack: () => void;
}

export function ChatScreen({ chat, onBack }: ChatScreenProps) {
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [headerHeight, setHeaderHeight] = useState(0);
    const liveChatQuery = useChat(chat.id, chat);
    const supportChat = liveChatQuery.data ?? chat;
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
    const isSupportClosed = supportStatus === 'closed' || supportChat.status === 'closed';
    const isSupportAccepted = !supportContext || (supportStatus === 'accepted' && !isSupportClosed);
    const keyboardVerticalOffset = insets.top + headerHeight;
    const bodyStyle = useMemo(
        () => [styles.body, { paddingBottom: insets.bottom }],
        [insets.bottom],
    );

    const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
        setHeaderHeight(event.nativeEvent.layout.height);
    }, []);

    const handleSendMessage = useCallback((outgoing: ChatGiftedMessage[] = []) => {
        if (!isSupportAccepted) return;
        const body = outgoing[0]?.text?.trim();
        if (!body || sending) return;
        void sendMessage(body);
    }, [isSupportAccepted, sendMessage, sending]);

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
                            {supportContext.latest_response_type
                                ? ` · ${formatSupportResponseType(supportContext.latest_response_type)}`
                                : ''}
                        </Text>
                        {supportStatus === 'declined' || isSupportClosed ? (
                            <View style={styles.supportPendingPanel}>
                                <Text style={styles.supportPendingTitle}>
                                    {isSupportClosed ? 'Support thread closed' : 'Support request declined'}
                                </Text>
                                <Text style={styles.supportPendingBody}>
                                    {isSupportClosed
                                        ? 'This thread stays visible for reference, but new messages are locked.'
                                        : 'This thread stays visible, but messaging is unavailable.'}
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
                        renderSystemMessage={(props: SystemMessageProps<ChatGiftedMessage>) => (
                            <View style={styles.systemMessageWrap}>
                                <View style={styles.systemMessageCard}>
                                    <Text style={styles.systemMessageText}>
                                        {props.currentMessage.text}
                                    </Text>
                                </View>
                            </View>
                        )}
                        renderInputToolbar={(props) => (
                            isSupportAccepted ? (
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
                                                placeholderTextColor: Colors.light.textTertiary,
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
                                                enabled: sending ? false : sendProps.sendButtonProps?.enabled,
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
                                        {isSupportClosed
                                            ? 'This support thread is closed to new messages.'
                                            : supportStatus === 'declined'
                                            ? 'This support thread is closed to new messages.'
                                            : 'This support thread is not open for messaging.'}
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
    case 'need_in_person_help':
        return 'Need in-person help';
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
    case 'can_meet':
        return 'I can meet up';
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
    systemMessageWrap: {
        alignItems: 'center',
        marginVertical: Spacing.sm,
        marginHorizontal: Spacing.md,
    },
    systemMessageCard: {
        maxWidth: '88%',
        backgroundColor: Colors.warning,
        borderRadius: Radii.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border.emphasis,
    },
    systemMessageText: {
        color: Colors.textOn.warning,
        fontSize: Typography.sizes.sm,
        fontWeight: Typography.weights.semibold,
        lineHeight: 18,
        textAlign: 'center',
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
});
