import React, { useCallback, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    LayoutChangeEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../../theme';
import { formatUsername } from '../../utils/identity';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
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
        () => toGiftedChatMessages(messages, currentUser, otherUserLastReadMessageId),
        [currentUser, messages, otherUserLastReadMessageId],
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
                            {supportContext.latest_offer_type
                                ? ` · ${formatSupportOfferType(supportContext.latest_offer_type)}`
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
                        keyboardAvoidingViewProps={{
                            keyboardVerticalOffset,
                        }}
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
                                        <Text style={styles.flatBubbleText}>
                                            {props.currentMessage.text}
                                        </Text>
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

function formatSupportType(value: api.SupportRequest['support_type']): string {
    switch (value) {
    case 'chat':
        return 'Chat support';
    case 'call':
        return 'Call support';
    case 'meetup':
        return 'Meetup support';
    case 'general':
        return 'General support';
    default:
        return 'Support request';
    }
}

function formatSupportOfferType(value: api.SupportOffer['offer_type']): string {
    switch (value) {
    case 'chat':
        return 'Chat offer';
    case 'call':
        return 'Call offer';
    case 'meetup':
        return 'Meetup offer';
    default:
        return 'Support offer';
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    body: {
        flex: 1,
    },
    supportContextCard: {
        backgroundColor: Colors.successSubtle,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.default,
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
        ...TextStyles.cardTitle,
        marginTop: 4,
    },
    supportContextBody: {
        ...TextStyles.secondary,
        marginTop: 6,
    },
    supportContextMeta: {
        ...TextStyles.meta,
        marginTop: 8,
    },
    supportPendingPanel: {
        marginTop: Spacing.md,
        borderTopWidth: 1,
        borderTopColor: Colors.border.default,
        paddingTop: Spacing.md,
    },
    supportPendingTitle: {
        ...TextStyles.label,
    },
    supportPendingBody: {
        ...TextStyles.secondary,
        marginTop: 4,
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
    systemMessageWrap: {
        alignItems: 'center',
        marginVertical: Spacing.sm,
        marginHorizontal: Spacing.md,
    },
    systemMessageCard: {
        maxWidth: '88%',
        backgroundColor: Colors.warning,
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border.emphasis,
    },
    systemMessageText: {
        color: Colors.textOn.warning,
        fontSize: TextStyles.chip.fontSize,
        fontWeight: TextStyles.chip.fontWeight,
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
