import React, { useState, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '../../components/Avatar';
import { ScreenHeader } from '../../components/ui/ScreenHeader';
import * as api from '../../api/client';
import { useChatRealtime } from '../../hooks/chat/ChatRealtimeProvider';
import { Colors, Typography, Spacing } from '../../utils/theme';
import { formatUsername } from '../../utils/identity';
import { composerStandards } from '../../styles/composerStandards';

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
    const realtime = useChatRealtime();

    const handleSend = async () => {
        const text = body.trim();
        if (!text || sending) return;
        setSending(true);
        try {
            const { id } = await api.createChat([recipientId]);
            if (realtime.isConnected) {
                await realtime.sendMessage({
                    chatId: id,
                    body: text,
                    clientMessageId: `client-${id}-${Date.now()}`,
                    optimisticId: `compose-${id}-${Date.now()}`,
                });
            } else {
                await api.sendMessage(id, text);
            }
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
            <ScreenHeader
                onBack={onBack}
                centerContent={(
                    <View style={styles.headerIdentity}>
                        <Avatar username={username} avatarUrl={avatarUrl} size={32} fontSize={12} />
                        <Text style={styles.headerName} numberOfLines={1}>{formatUsername(username)}</Text>
                    </View>
                )}
            />

            <View style={styles.body}>
                <Text style={styles.placeholder}>
                    Start a conversation with {formatUsername(username)}
                </Text>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={composerStandards.row}>
                    <TextInput
                        ref={inputRef}
                        style={composerStandards.input}
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
                        style={[composerStandards.sendButton, !canSend && composerStandards.sendButtonDisabled]}
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
    headerIdentity: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        justifyContent: 'center',
    },
    headerName: {
        flexShrink: 1,
        ...Typography.screenTitle,
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
});
