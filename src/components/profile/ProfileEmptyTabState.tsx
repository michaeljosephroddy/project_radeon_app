import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Spacing, Typography } from '../../theme';
import { ProfileContentTabKey } from './ProfileContentTabs';

export interface ProfileEmptyTabStateProps {
    tab: ProfileContentTabKey;
    username: string;
}

interface EmptyCopy {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    body: string;
}

function getEmptyCopy(tab: ProfileContentTabKey, username: string): EmptyCopy {
    if (tab === 'reflections') {
        return {
            icon: 'journal-outline',
            title: 'No reflections yet',
            body: 'Private reflections you save will appear here.',
        };
    }

    if (tab === 'reposts') {
        return {
            icon: 'repeat-outline',
            title: 'No reposts yet',
            body: `${username} has not shared any posts from other members yet.`,
        };
    }

    if (tab === 'tagged') {
        return {
            icon: 'person-outline',
            title: 'No tagged posts yet',
            body: `Posts that tag ${username} will appear here when tagging is available.`,
        };
    }

    return {
        icon: 'grid-outline',
        title: 'No posts yet',
        body: `${username} has not posted anything yet.`,
    };
}

export function ProfileEmptyTabState({ tab, username }: ProfileEmptyTabStateProps): React.ReactElement {
    const copy = getEmptyCopy(tab, username);

    return (
        <View style={styles.container}>
            <View style={styles.iconWrap}>
                <Ionicons name={copy.icon} size={24} color={Colors.text.muted} />
            </View>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.body}>{copy.body}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.xxl,
    },
    iconWrap: {
        width: 52,
        height: 52,
        borderRadius: 26,
        borderWidth: 1,
        borderColor: Colors.border.default,
        backgroundColor: Colors.bg.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    title: {
        fontSize: Typography.sizes.base,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: Spacing.xs,
        textAlign: 'center',
    },
    body: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.muted,
        lineHeight: 19,
        textAlign: 'center',
    },
});
