import React, { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import * as api from '../../api/client';
import { Colors, Typography, Spacing, Radii } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';

interface ComposeDMScreenProps {
    recipientId: string;
    username: string;
    avatarUrl?: string;
    onBack: () => void;
    onComplete: (chat: api.Chat) => void;
}

export function ComposeDMScreen({
    recipientId, username, avatarUrl, onBack, onComplete,
}: ComposeDMScreenProps) {
    const [body, setBody] = useState('');
    const [sending, setSending] = useState(false);
    const inputRef = useRef<TextInput>(null);

    const handleSend = async () => {
        const text = body.trim();
        if (!text || sending) return;
        setSending(true);
        try {
            const { id } = await api.createChat([recipientId]);
            await api.sendMessage(id, text);
            onComplete({
                id,
                is_group: false,
                username,
                avatar_url: avatarUrl,
                created_at: new Date().toISOString(),
                last_message: text,
                last_message_at: new Date().toISOString(),
            });
        } catch (e: unknown) {
            Alert.alert('Failed to send', e instanceof Error ? e.message : 'Something went wrong.');
        } finally {
            setSending(false);
        }
    };

    const canSend = body.trim().length > 0 && !sending;

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn} disabled={sending}>
                    <Text style={styles.backIcon}>←</Text>
                </TouchableOpacity>
                <Avatar username={username} avatarUrl={avatarUrl} size={32} fontSize={12} />
                <Text style={styles.headerName} numberOfLines={1}>{formatUsername(username)}</Text>
            </View>

            <View style={styles.body}>
                <Text style={styles.placeholder}>
                    Start a conversation with {formatUsername(username)}
                </Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={styles.toolbar}>
                    <TextInput
                        ref={inputRef}
                        style={styles.input}
                        placeholder="Message"
                        placeholderTextColor={Colors.light.textTertiary}
                        value={body}
                        onChangeText={setBody}
                        multiline
                        autoFocus
                        returnKeyType="default"
                        editable={!sending}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                        onPress={handleSend}
                        disabled={!canSend}
                    >
                        {sending
                            ? <ActivityIndicator size="small" color={Colors.textOn.primary} />
                            : <Ionicons name="send" size={18} color={Colors.textOn.primary} />
                        }
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.light.background },
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
    body: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.xl,
    },
    placeholder: {
        fontSize: Typography.sizes.lg,
        color: Colors.light.textTertiary,
        textAlign: 'center',
    },
    toolbar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.sm,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.sm,
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
        backgroundColor: Colors.light.background,
    },
    input: {
        flex: 1,
        minHeight: 44,
        maxHeight: 120,
        borderRadius: Radii.pill,
        backgroundColor: Colors.light.backgroundSecondary,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        color: Colors.light.textPrimary,
        fontSize: Typography.sizes.lg,
        lineHeight: 20,
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.sm,
    },
    sendBtn: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: Colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendBtnDisabled: {
        backgroundColor: Colors.secondary,
    },
});
