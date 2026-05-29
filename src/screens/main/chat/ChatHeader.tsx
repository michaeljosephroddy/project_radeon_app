import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { CardActionMenu, type CardActionMenuAction } from '../../../components/ui/CardActionMenu';
import * as api from '../../../api/client';
import { Colors, Typography, Spacing } from '../../../theme';

interface ChatHeaderProps {
    chat: api.Chat;
    displayName: string;
    onBack: () => void;
    actions?: CardActionMenuAction[];
}

export function ChatHeader({ chat, displayName, onBack, actions }: ChatHeaderProps) {
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
            trailing={actions?.length ? <CardActionMenu actions={actions} /> : null}
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
        color: Colors.text.primary,
    },
});
