import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import * as api from '../../../api/client';
import { Colors, Typography, Spacing } from '../../../utils/theme';

interface ChatHeaderProps {
    chat: api.Chat;
    displayName: string;
    onBack: () => void;
}

export function ChatHeader({ chat, displayName, onBack }: ChatHeaderProps) {
    return (
        <ScreenHeader
            onBack={onBack}
            centerContent={(
                <View style={styles.centerContent}>
                    <Avatar
                        username={chat.is_group ? (chat.name ?? 'Group') : (chat.username ?? 'unknown')}
                        avatarUrl={chat.is_group ? undefined : chat.avatar_url}
                        size={32}
                        fontSize={12}
                    />
                    <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
                </View>
            )}
        />
    );
}

const styles = StyleSheet.create({
    centerContent: {
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
});
