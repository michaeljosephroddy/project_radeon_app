import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import * as api from '../../../api/client';
import { Colors, Typography, Spacing } from '../../../utils/theme';

interface ChatHeaderProps {
    chat: api.Chat;
    displayName: string;
    onBack: () => void;
}

export function ChatHeader({ chat, displayName, onBack }: ChatHeaderProps) {
    return (
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
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 12,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.light.border,
        gap: Spacing.sm,
        backgroundColor: Colors.light.background,
    },
    backBtn: { padding: 4 },
    backIcon: { fontSize: 20, color: Colors.primary },
    headerName: {
        flex: 1,
        fontSize: Typography.sizes.lg,
        fontWeight: '500',
        color: Colors.light.textPrimary,
    },
});
