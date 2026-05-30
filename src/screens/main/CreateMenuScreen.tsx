import React from 'react';
import {
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '../../api/client';
import { queryKeys } from '../../query/queryKeys';
import { Colors, Radius, Spacing, TextStyles, Typography } from '../../theme';

type CreateActionKey = 'post' | 'support_request' | 'meetup' | 'group';

interface CreateAction {
    key: CreateActionKey;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
}

interface CreateMenuScreenProps {
    onClose: () => void;
    onCreatePost: () => void;
    onCreateSupportRequest: () => void;
    onCreateMeetup: () => void;
    onCreateGroup: () => void;
}

export function CreateMenuScreen({
    onClose,
    onCreatePost,
    onCreateSupportRequest,
    onCreateMeetup,
    onCreateGroup,
}: CreateMenuScreenProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();
    const actions: CreateAction[] = [
        {
            key: 'post',
            title: 'Post',
            description: 'Share an update with the community.',
            icon: 'create-outline',
            onPress: onCreatePost,
        },
        {
            key: 'support_request',
            title: 'Support request',
            description: 'Ask the community for help right now.',
            icon: 'heart-outline',
            onPress: onCreateSupportRequest,
        },
        {
            key: 'meetup',
            title: 'Meetup',
            description: 'Host a sober event or gathering.',
            icon: 'calendar-outline',
            onPress: onCreateMeetup,
        },
        {
            key: 'group',
            title: 'Group',
            description: 'Start a focused recovery space.',
            icon: 'people-outline',
            onPress: onCreateGroup,
        },
    ];

    React.useEffect(() => {
        void queryClient.prefetchQuery({
            queryKey: queryKeys.meetupCategories(),
            queryFn: () => api.getMeetupCategories(),
            staleTime: 1000 * 60 * 30,
        });
        void queryClient.prefetchQuery({
            queryKey: ['friends', { limit: 100 }],
            queryFn: async () => {
                const page = await api.getFriends(undefined, 100);
                return page.items ?? [];
            },
            staleTime: 1000 * 60 * 5,
        });
    }, [queryClient]);

    const handleClose = (): void => {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
        onClose();
    };

    const handleActionPress = (action: CreateAction): void => {
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
        action.onPress();
    };

    return (
        <View style={styles.screen}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close create menu"
                style={styles.scrim}
                onPress={handleClose}
            />
            <View style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.xl }]}>
                <View style={styles.dragHeader}>
                    <View style={styles.handle} />
                    <Text style={styles.title}>Create</Text>
                </View>
                <View style={styles.actionList}>
                    {actions.map((action) => (
                        <Pressable
                            key={action.key}
                            accessibilityRole="button"
                            accessibilityLabel={action.title}
                            style={({ pressed }) => [styles.actionRow, pressed && styles.actionRowPressed]}
                            onPress={() => handleActionPress(action)}
                        >
                            <View style={styles.iconWrap}>
                                <Ionicons name={action.icon} size={22} color={Colors.primary} />
                            </View>
                            <View style={styles.actionCopy}>
                                <Text style={styles.actionTitle}>{action.title}</Text>
                                <Text style={styles.actionDescription}>{action.description}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={18} color={Colors.text.muted} />
                        </Pressable>
                    ))}
                </View>
            </View>
        </View>
    );
}

function triggerHaptic(style: Haptics.ImpactFeedbackStyle): void {
    try {
        Haptics.impactAsync(style).catch(() => {});
    } catch {
        // Haptics are optional in development builds.
    }
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    scrim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Colors.overlay,
    },
    sheet: {
        backgroundColor: Colors.bg.raised,
        borderTopLeftRadius: Radius.xl,
        borderTopRightRadius: Radius.xl,
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.xl,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
    },
    dragHeader: {
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
    },
    handle: {
        alignSelf: 'center',
        width: 42,
        height: 4,
        borderRadius: Radius.pill,
        backgroundColor: Colors.border.emphasis,
        marginBottom: Spacing.lg,
    },
    title: {
        ...Typography.screenTitle,
        color: Colors.text.primary,
    },
    actionList: {
        gap: Spacing.sm,
    },
    actionRow: {
        minHeight: 64,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.subtle,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
    },
    actionRowPressed: {
        backgroundColor: Colors.bg.hover,
    },
    iconWrap: {
        width: 42,
        height: 42,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primarySubtle,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionCopy: {
        flex: 1,
        gap: 2,
    },
    actionTitle: {
        ...TextStyles.body,
        color: Colors.text.primary,
        fontWeight: '700',
    },
    actionDescription: {
        fontSize: Typography.sizes.sm,
        color: Colors.text.secondary,
    },
});
