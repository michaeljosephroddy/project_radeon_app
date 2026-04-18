import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, FlatList, TouchableOpacity, TextInput,
    StyleSheet, KeyboardAvoidingView, ActivityIndicator,
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

// Renders a single chat thread and handles optimistic message sending.
export function ChatScreen({ chat, onBack }: Props) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<api.Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [nextBefore, setNextBefore] = useState<string | null>(null);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const listRef = useRef<FlatList>(null);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        // Messages are fetched when the overlay opens; the chat list remains mounted
        // underneath, so we scope this request to the selected chat id only.
        api.getMessages(chat.id, { limit: 50 })
            .then(data => {
                setMessages(data.items ?? []);
                setHasMore(data.has_more);
                setNextBefore(data.next_before ?? null);
            })
            .finally(() => setLoading(false));
    }, [chat.id]);

    // Sends the current draft and appends it locally so the thread feels instant.
    const handleSend = async () => {
        if (!draft.trim()) return;
        setSending(true);
        const body = draft.trim();
        setDraft('');
        try {
            const { id } = await api.sendMessage(chat.id, body);
            // Append locally so the composer feels realtime even though there is no
            // websocket/subscription layer in this project yet.
            setMessages(current => [
                ...current,
                {
                    id,
                    sender_id: user?.id ?? '',
                    username: user?.username ?? 'unknown',
                    avatar_url: user?.avatar_url,
                    body,
                    sent_at: new Date().toISOString(),
                },
            ]);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        } catch {
            setDraft(body); // restore if failed
        } finally {
            setSending(false);
        }
    };

    const displayName = chat.is_group
        ? (chat.name ?? 'Group')
        : formatUsername(chat.username);

    // Message history pages backwards from the oldest loaded item so long
    // threads stay incremental instead of loading the full transcript at once.
    const handleLoadOlder = async () => {
        if (!nextBefore || loadingOlder) return;
        setLoadingOlder(true);
        try {
            const page = await api.getMessages(chat.id, { before: nextBefore, limit: 50 });
            setMessages(current => [...(page.items ?? []), ...current]);
            setHasMore(page.has_more);
            setNextBefore(page.next_before ?? null);
        } finally {
            setLoadingOlder(false);
        }
    };

    // Resolves the best avatar to show for each message bubble.
    const getMessageAvatarUrl = (message: api.Message): string | undefined => {
        // DMs can omit sender avatars in the message payload, so fall back to the
        // chat/user context we already have before leaving the bubble blank.
        if (message.avatar_url) return message.avatar_url;
        if (message.sender_id === user?.id) return user?.avatar_url;
        if (!chat.is_group) return chat.avatar_url;
        return undefined;
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior="padding"
            keyboardVerticalOffset={0}
        >
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
            </View>

            {loading ? (
                <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>
            ) : (
                <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={m => m.id}
                    contentContainerStyle={styles.list}
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                    ListHeaderComponent={
                        hasMore ? (
                            <TouchableOpacity
                                style={[styles.loadOlderButton, loadingOlder && styles.loadOlderButtonDisabled]}
                                onPress={handleLoadOlder}
                                disabled={loadingOlder}
                            >
                                <Text style={styles.loadOlderButtonText}>{loadingOlder ? 'Loading...' : 'Load older messages'}</Text>
                            </TouchableOpacity>
                        ) : null
                    }
                    renderItem={({ item }) => {
                        const isMe = item.sender_id === user?.id;
                        const senderLabel = formatUsername(isMe ? (user?.username ?? item.username) : item.username);
                        return (
                            <View style={styles.bubble}>
                                <Avatar
                                    username={isMe ? (user?.username ?? item.username) : item.username}
                                    avatarUrl={getMessageAvatarUrl(item)}
                                    size={26}
                                    fontSize={10}
                                />
                                <View style={[styles.bubbleInner, isMe ? styles.bubbleInnerMe : styles.bubbleInnerThem]}>
                                    <View style={styles.messageHeader}>
                                        <Text style={[styles.senderName, isMe && styles.senderNameMe]}>{senderLabel}</Text>
                                        <Text style={[styles.messageMeta, isMe && styles.messageMetaMe]}>
                                            {formatReadableTimestamp(item.sent_at)}
                                        </Text>
                                    </View>
                                    <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.body}</Text>
                                </View>
                            </View>
                        );
                    }}
                />
            )}

            {/* Composer */}
            <View style={[styles.composer, { paddingBottom: insets.bottom + Spacing.md }]}>
                <TextInput
                    style={styles.composerInput}
                    placeholder="Message…"
                    placeholderTextColor={Colors.light.textTertiary}
                    value={draft}
                    onChangeText={setDraft}
                    multiline
                    maxLength={1000}
                />
                <TouchableOpacity
                    style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
                    onPress={handleSend}
                    disabled={!draft.trim() || sending}
                >
                    <Text style={styles.sendBtnText}>↑</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
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

    list: { padding: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.sm },

    bubble: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
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

    composer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.sm,
        padding: Spacing.md,
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
    },
    composerInput: {
        flex: 1,
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.xl,
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
        fontSize: Typography.sizes.base,
        color: Colors.light.textPrimary,
        maxHeight: 100,
    },
    sendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.success,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnDisabled: { backgroundColor: Colors.light.backgroundSecondary },
    sendBtnText: { fontSize: 16, color: Colors.textOn.primary, fontWeight: '600' },
    loadOlderButton: {
        alignSelf: 'center',
        backgroundColor: Colors.light.backgroundSecondary,
        borderRadius: Radii.full,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        paddingHorizontal: Spacing.md,
        paddingVertical: 8,
        marginBottom: Spacing.sm,
    },
    loadOlderButtonDisabled: { opacity: 0.6 },
    loadOlderButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.light.textSecondary,
    },
});
