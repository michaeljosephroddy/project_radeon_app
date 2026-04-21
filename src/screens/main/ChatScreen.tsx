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
    const displayName = chat.is_group
        ? (chat.name ?? 'Group')
        : formatUsername(chat.username);
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
        () => toGiftedChatMessages(messages),
        [messages],
    );
    const keyboardVerticalOffset = insets.top + headerHeight;
    const bodyStyle = useMemo(
        () => [styles.body, { paddingBottom: insets.bottom }],
        [insets.bottom],
    );

    const handleHeaderLayout = useCallback((event: LayoutChangeEvent) => {
        setHeaderHeight(event.nativeEvent.layout.height);
    }, []);

    const handleSendMessage = useCallback((outgoing: ChatGiftedMessage[] = []) => {
        const body = outgoing[0]?.text?.trim();
        if (!body || sending) return;
        void sendMessage(body);
    }, [sendMessage, sending]);

    return (
        <View style={styles.container}>
            <View onLayout={handleHeaderLayout}>
                <ChatHeader
                    chat={chat}
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
        backgroundColor: Colors.light.background,
    },
    body: {
        flex: 1,
    },
    messagesContainer: {
        backgroundColor: Colors.light.background,
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
