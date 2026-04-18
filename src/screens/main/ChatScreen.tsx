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

interface Props {
    chat: api.Chat;
    onBack: () => void;
}

export function ChatScreen({ chat, onBack }: Props) {
    const { user } = useAuth();
    const [messages, setMessages] = useState<api.Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const listRef = useRef<FlatList>(null);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        api.getMessages(chat.id)
            .then(data => setMessages(data ?? []))
            .finally(() => setLoading(false));
    }, [chat.id]);

    const handleSend = async () => {
        if (!draft.trim()) return;
        setSending(true);
        const body = draft.trim();
        setDraft('');
        try {
            const { id } = await api.sendMessage(chat.id, body);
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
                    renderItem={({ item }) => {
                        const isMe = item.sender_id === user?.id;
                        return (
                            <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                                {!isMe && (
                                    <Avatar username={item.username} avatarUrl={item.avatar_url} size={26} fontSize={10} />
                                )}
                                <View style={[styles.bubbleInner, isMe ? styles.bubbleInnerMe : styles.bubbleInnerThem]}>
                                    {!isMe && (
                                        <Text style={styles.senderName}>{formatUsername(item.username)}</Text>
                                    )}
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

    bubble: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
    bubbleMe: { flexDirection: 'row-reverse' },
    bubbleThem: {},
    bubbleInner: { maxWidth: '75%', borderRadius: Radii.md, padding: Spacing.sm },
    bubbleInnerMe: { backgroundColor: Colors.primary, borderBottomRightRadius: 4 },
    bubbleInnerThem: {
        backgroundColor: Colors.light.backgroundSecondary,
        borderBottomLeftRadius: 4,
    },
    senderName: {
        fontSize: Typography.sizes.xs,
        fontWeight: '500',
        color: Colors.light.textTertiary,
        marginBottom: 2,
    },
    bubbleText: { fontSize: Typography.sizes.base, color: Colors.light.textPrimary, lineHeight: 18 },
    bubbleTextMe: { color: Colors.textOn.primary },

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
});
