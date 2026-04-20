import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    StyleSheet, KeyboardAvoidingView, ActivityIndicator, Platform, NativeSyntheticEvent,
    NativeScrollEvent, Keyboard, LayoutAnimation, UIManager, BackHandler, Alert,
} from 'react-native';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatUsername } from '../../utils/identity';
import { formatReadableTimestamp } from '../../utils/date';

interface Props {
    chat: api.Chat;
    onBack: () => void;
}

interface MessageRowProps {
    message: api.Message;
    currentUser?: { id: string; username: string; avatar_url?: string };
    chat: api.Chat;
}

interface MessageComposerLauncherProps {
    active: boolean;
    onPress: () => void;
}

interface ActiveMessageComposerProps {
    draft: string;
    sending: boolean;
    bottomInset: number;
    recipientLabel: string;
    onChangeDraft: (value: string) => void;
    onSend: () => void;
    inputRef: React.RefObject<TextInput | null>;
}

const INITIAL_MESSAGE_BATCH = 50;
const NEAR_BOTTOM_THRESHOLD = 120;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const MessageRow = React.memo(function MessageRow({
    message,
    currentUser,
    chat,
}: MessageRowProps) {
    const isMe = message.sender_id === currentUser?.id;
    const senderLabel = formatUsername(isMe ? (currentUser?.username ?? message.username) : message.username);
    const avatarUrl = getMessageAvatarUrl(message, currentUser, chat);

    return (
        <View style={styles.bubbleRow}>
            <Avatar
                username={isMe ? (currentUser?.username ?? message.username) : message.username}
                avatarUrl={avatarUrl}
                size={26}
                fontSize={10}
            />
            <View style={[styles.bubbleInner, isMe ? styles.bubbleInnerMe : styles.bubbleInnerThem]}>
                <View style={styles.messageHeader}>
                    <Text style={[styles.senderName, isMe && styles.senderNameMe]}>{senderLabel}</Text>
                    <Text style={[styles.messageMeta, isMe && styles.messageMetaMe]}>
                        {formatReadableTimestamp(message.sent_at)}
                    </Text>
                </View>
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{message.body}</Text>
            </View>
        </View>
    );
});

const MessageComposerLauncher = React.memo(function MessageComposerLauncher({
    active,
    onPress,
}: MessageComposerLauncherProps) {
    return (
        <View style={styles.messageComposer}>
            <TouchableOpacity
                style={[styles.messageComposerLauncher, active && styles.messageComposerLauncherActive]}
                onPress={onPress}
            >
                <Text style={styles.messageComposerLauncherText}>
                    {active ? 'Writing a message…' : 'Write a message'}
                </Text>
            </TouchableOpacity>
        </View>
    );
});

const ActiveMessageComposer = React.memo(function ActiveMessageComposer({
    draft,
    sending,
    bottomInset,
    recipientLabel,
    onChangeDraft,
    onSend,
    inputRef,
}: ActiveMessageComposerProps) {
    return (
        <View style={[styles.activeMessageComposerShell, { paddingBottom: bottomInset }]}>
            <View style={styles.activeMessageComposerHeader}>
                <Text style={styles.activeMessageComposerTitle}>Replying to {recipientLabel}</Text>
            </View>

            <View style={styles.messageComposerRow}>
                <TextInput
                    ref={inputRef}
                    style={styles.messageInput}
                    placeholder="Write a message"
                    placeholderTextColor={Colors.light.textTertiary}
                    value={draft}
                    onChangeText={onChangeDraft}
                    editable={!sending}
                    multiline
                    autoCapitalize="sentences"
                    autoCorrect
                    textAlignVertical="top"
                    maxLength={1000}
                />
                <TouchableOpacity
                    style={[styles.messageSendButton, (sending || !draft.trim()) && styles.messageSendButtonDisabled]}
                    onPress={onSend}
                    disabled={sending || !draft.trim()}
                >
                    <Text style={styles.messageSendButtonText}>{sending ? '...' : 'Send'}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
});

export function ChatScreen({ chat, onBack }: Props) {
    const ScreenContainer = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
    const { user } = useAuth();
    const [messages, setMessages] = useState<api.Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextBefore, setNextBefore] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [isComposerActive, setIsComposerActive] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const listRef = useRef<FlatList<api.Message>>(null);
    const inputRef = useRef<TextInput>(null);
    const requestIdRef = useRef(0);
    const contentHeightRef = useRef(0);
    const scrollOffsetRef = useRef(0);
    const pendingScrollRef = useRef<'bottom' | 'preserve' | null>('bottom');
    const preserveScrollOffsetRef = useRef<number | null>(null);
    const shouldAutoScrollRef = useRef(true);
    const canCloseComposerOnKeyboardHideRef = useRef(false);
    const insets = useSafeAreaInsets();

    const composerBottomOffset = Platform.OS === 'android' ? keyboardHeight : 0;
    const composerClosedPadding = insets.bottom + 8;
    const closedComposerHeight = 60 + composerClosedPadding;
    const activeComposerHeight = 92 + composerClosedPadding + composerBottomOffset;
    const activeComposerPadding = isComposerActive ? activeComposerHeight : closedComposerHeight;

    const scrollToBottom = useCallback((animated: boolean) => {
        requestAnimationFrame(() => {
            listRef.current?.scrollToEnd({ animated });
        });
    }, []);

    const closeComposer = useCallback(() => {
        canCloseComposerOnKeyboardHideRef.current = false;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsComposerActive(false);
    }, []);

    const openComposer = useCallback(() => {
        canCloseComposerOnKeyboardHideRef.current = false;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsComposerActive(true);
    }, []);

    const loadInitialMessages = useCallback(async () => {
        const requestId = ++requestIdRef.current;
        setLoading(true);

        try {
            const data = await api.getMessages(chat.id, { limit: INITIAL_MESSAGE_BATCH });
            if (requestId !== requestIdRef.current) return;
            setMessages(data.items ?? []);
            setHasMore(data.has_more);
            setNextBefore(data.next_before ?? null);
            pendingScrollRef.current = 'bottom';
            shouldAutoScrollRef.current = true;
        } catch {
            if (requestId !== requestIdRef.current) return;
            setMessages([]);
            setHasMore(false);
            setNextBefore(null);
        } finally {
            if (requestId === requestIdRef.current) setLoading(false);
        }
    }, [chat.id]);

    useEffect(() => {
        setDraft('');
        setMessages([]);
        setHasMore(false);
        setNextBefore(null);
        setIsComposerActive(false);
        contentHeightRef.current = 0;
        scrollOffsetRef.current = 0;
        preserveScrollOffsetRef.current = null;
        pendingScrollRef.current = 'bottom';
        shouldAutoScrollRef.current = true;
        loadInitialMessages();
    }, [chat.id, loadInitialMessages]);

    useEffect(() => {
        const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSub = Keyboard.addListener(showEvent, event => {
            setKeyboardHeight(event.endCoordinates?.height ?? 0);
            if (Platform.OS === 'android' && isComposerActive) {
                canCloseComposerOnKeyboardHideRef.current = true;
            }
        });
        const hideSub = Keyboard.addListener(hideEvent, () => {
            setKeyboardHeight(0);
            if (Platform.OS === 'android' && isComposerActive && canCloseComposerOnKeyboardHideRef.current && !draft.trim()) {
                closeComposer();
            }
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [closeComposer, draft, isComposerActive]);

    useEffect(() => {
        if (!isComposerActive) return;

        const timer = setTimeout(() => {
            inputRef.current?.focus();
        }, 50);

        return () => clearTimeout(timer);
    }, [isComposerActive]);

    useEffect(() => {
        if (Platform.OS !== 'android') return;

        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (!isComposerActive) return false;
            if (keyboardHeight > 0) {
                Keyboard.dismiss();
            } else {
                closeComposer();
            }
            return true;
        });

        return () => subscription.remove();
    }, [closeComposer, isComposerActive, keyboardHeight]);

    const handleSend = useCallback(async () => {
        const body = draft.trim();
        if (!body || !user) return;

        const optimisticMessage: api.Message = {
            id: `optimistic-${chat.id}-${Date.now()}`,
            sender_id: user.id,
            username: user.username,
            avatar_url: user.avatar_url,
            body,
            sent_at: new Date().toISOString(),
        };

        setSending(true);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setDraft('');
        closeComposer();
        Keyboard.dismiss();
        shouldAutoScrollRef.current = true;
        pendingScrollRef.current = 'bottom';
        setMessages(current => [...current, optimisticMessage]);

        try {
            const { id } = await api.sendMessage(chat.id, body);
            setMessages(current => current.map(message => (
                message.id === optimisticMessage.id
                    ? { ...optimisticMessage, id }
                    : message
            )));
        } catch {
            setMessages(current => current.filter(message => message.id !== optimisticMessage.id));
            Alert.alert('Message failed', 'Your message could not be sent.');
        } finally {
            setSending(false);
        }
    }, [chat.id, closeComposer, draft, user]);

    const handleLoadOlder = useCallback(async () => {
        if (!nextBefore || loadingOlder) return;
        const requestId = requestIdRef.current;

        setLoadingOlder(true);
        preserveScrollOffsetRef.current = scrollOffsetRef.current;
        pendingScrollRef.current = 'preserve';

        try {
            const page = await api.getMessages(chat.id, { before: nextBefore, limit: INITIAL_MESSAGE_BATCH });
            if (requestId !== requestIdRef.current) return;
            setMessages(current => [...(page.items ?? []), ...current]);
            setHasMore(page.has_more);
            setNextBefore(page.next_before ?? null);
        } catch {
            if (requestId !== requestIdRef.current) return;
            preserveScrollOffsetRef.current = null;
            pendingScrollRef.current = null;
        } finally {
            if (requestId === requestIdRef.current) setLoadingOlder(false);
        }
    }, [chat.id, loadingOlder, nextBefore]);

    const handleContentSizeChange = useCallback((_width: number, height: number) => {
        const previousHeight = contentHeightRef.current;
        contentHeightRef.current = height;

        if (pendingScrollRef.current === 'bottom') {
            pendingScrollRef.current = null;
            scrollToBottom(previousHeight > 0);
            return;
        }

        if (pendingScrollRef.current === 'preserve' && preserveScrollOffsetRef.current !== null) {
            const delta = height - previousHeight;
            const nextOffset = Math.max(preserveScrollOffsetRef.current + delta, 0);
            preserveScrollOffsetRef.current = null;
            pendingScrollRef.current = null;
            requestAnimationFrame(() => {
                listRef.current?.scrollToOffset({ offset: nextOffset, animated: false });
            });
            return;
        }

        if (shouldAutoScrollRef.current) {
            scrollToBottom(false);
        }
    }, [scrollToBottom]);

    const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        scrollOffsetRef.current = contentOffset.y;
        const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
        shouldAutoScrollRef.current = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD;
    }, []);

    const displayName = chat.is_group
        ? (chat.name ?? 'Group')
        : formatUsername(chat.username);
    const recipientLabel = chat.is_group
        ? (chat.name ?? 'Group')
        : formatUsername(chat.username);
    const currentUser = user ? {
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
    } : undefined;

    return (
        <ScreenContainer
            style={styles.container}
            {...(Platform.OS === 'ios' ? { behavior: 'padding' as const, keyboardVerticalOffset: 0 } : {})}
        >
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Avatar
                    username={chat.is_group ? (chat.name ?? 'Group') : (chat.username ?? 'unknown')}
                    avatarUrl={chat.is_group ? undefined : chat.avatar_url}
                    size={32}
                    fontSize={12}
                />
                <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
            ) : (
                <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={message => message.id}
                    initialNumToRender={12}
                    maxToRenderPerBatch={8}
                    updateCellsBatchingPeriod={60}
                    windowSize={8}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                    contentContainerStyle={[
                        styles.list,
                        { paddingBottom: activeComposerPadding },
                    ]}
                    onScroll={handleScroll}
                    scrollEventThrottle={32}
                    onContentSizeChange={handleContentSizeChange}
                    ListHeaderComponent={
                        hasMore ? (
                            <View style={styles.listHeader}>
                                <TouchableOpacity
                                    style={[styles.loadOlderButton, loadingOlder && styles.loadOlderButtonDisabled]}
                                    onPress={handleLoadOlder}
                                    disabled={loadingOlder}
                                >
                                    <Text style={styles.loadOlderButtonText}>
                                        {loadingOlder ? 'Loading...' : 'Load older messages'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : null
                    }
                    renderItem={({ item }) => (
                        <MessageRow
                            message={item}
                            currentUser={currentUser}
                            chat={chat}
                        />
                    )}
                />
            )}

            {!isComposerActive && (
                <View style={styles.inactiveMessageComposerPositioner}>
                    <View style={[styles.inactiveMessageComposerShell, { paddingBottom: composerClosedPadding }]}>
                        <MessageComposerLauncher
                            active={false}
                            onPress={openComposer}
                        />
                    </View>
                </View>
            )}

            {isComposerActive && (
                <View
                    style={[
                        styles.activeMessageComposerPositioner,
                        {
                            bottom: composerBottomOffset,
                        },
                    ]}
                >
                    <ActiveMessageComposer
                        draft={draft}
                        sending={sending}
                        bottomInset={composerClosedPadding}
                        recipientLabel={recipientLabel}
                        onChangeDraft={setDraft}
                        onSend={handleSend}
                        inputRef={inputRef}
                    />
                </View>
            )}
        </ScreenContainer>
    );
}

function getMessageAvatarUrl(
    message: api.Message,
    currentUser: { id: string; avatar_url?: string } | undefined,
    chat: api.Chat,
): string | undefined {
    if (message.avatar_url) return message.avatar_url;
    if (message.sender_id === currentUser?.id) return currentUser.avatar_url;
    if (!chat.is_group) return chat.avatar_url;
    return undefined;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
        gap: Spacing.sm,
    },
    backBtn: { padding: 4 },
    backIcon: { fontSize: 20, color: Colors.primary },
    headerName: {
        flex: 1,
        fontSize: Typography.sizes.lg,
        fontWeight: '500',
        color: Colors.light.textPrimary,
    },

    list: { padding: Spacing.md, gap: Spacing.sm },
    listHeader: { gap: Spacing.sm, marginBottom: Spacing.sm },

    bubbleRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
    bubbleInner: { maxWidth: '75%', borderRadius: Radii.md, padding: Spacing.sm },
    bubbleInnerMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
    bubbleInnerThem: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderBottomLeftRadius: 4,
    },
    messageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 2,
    },
    senderName: {
        fontSize: Typography.sizes.xs,
        fontWeight: '500',
        color: Colors.light.textTertiary,
    },
    senderNameMe: { color: 'rgba(255,255,255,0.9)' },
    bubbleText: { fontSize: Typography.sizes.base, color: Colors.light.textPrimary, lineHeight: 18 },
    bubbleTextMe: { color: Colors.textOn.primary },
    messageMeta: {
        fontSize: Typography.sizes.xs,
        color: Colors.light.textTertiary,
    },
    messageMetaMe: { color: 'rgba(255,255,255,0.85)' },

    loadOlderButton: {
        alignSelf: 'center',
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.full,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
    },
    loadOlderButtonDisabled: { opacity: 0.6 },
    loadOlderButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },

    messageComposer: { gap: Spacing.xs },
    messageComposerLauncher: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        backgroundColor: Colors.light.background,
        borderRadius: Radii.full,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        minHeight: 44,
        paddingHorizontal: 16,
        paddingVertical: 11,
    },
    messageComposerLauncherActive: {
        borderColor: Colors.primary,
    },
    messageComposerLauncherText: {
        fontSize: Typography.sizes.sm,
        color: Colors.light.textTertiary,
    },

    inactiveMessageComposerPositioner: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
    },
    inactiveMessageComposerShell: {
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
        backgroundColor: Colors.light.background,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
    },
    activeMessageComposerPositioner: {
        position: 'absolute',
        left: 0,
        right: 0,
    },
    activeMessageComposerShell: {
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
        backgroundColor: Colors.light.backgroundSecondary,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        gap: Spacing.xs,
    },
    activeMessageComposerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    activeMessageComposerTitle: {
        flex: 1,
        fontSize: Typography.sizes.sm,
        color: Colors.light.textSecondary,
        fontWeight: '500',
    },
    messageComposerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
    messageInput: {
        flex: 1,
        backgroundColor: Colors.light.background,
        minHeight: 48,
        maxHeight: 112,
        borderRadius: 24,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        paddingHorizontal: 16,
        paddingVertical: 11,
        fontSize: Typography.sizes.sm,
        color: Colors.light.textPrimary,
    },
    messageSendButton: {
        backgroundColor: Colors.success,
        borderRadius: Radii.full,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    messageSendButtonDisabled: { opacity: 0.6 },
    messageSendButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.textOn.primary,
    },
});
