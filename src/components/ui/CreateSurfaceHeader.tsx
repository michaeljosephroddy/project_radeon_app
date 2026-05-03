import React from 'react';
import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, ContentInsets, ControlSizes, Spacing, TextStyles } from '../../theme';

export const CREATE_SURFACE_HEADER_HEIGHT = 56;

interface CreateSurfaceHeaderProps {
    onBack: () => void;
    backDisabled?: boolean;
    title?: string;
    centerContent?: React.ReactNode;
    trailing?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    titleStyle?: StyleProp<TextStyle>;
}

export function CreateSurfaceHeader({
    onBack,
    backDisabled = false,
    title,
    centerContent,
    trailing,
    style,
    titleStyle,
}: CreateSurfaceHeaderProps): React.ReactElement {
    return (
        <View style={[styles.header, style]}>
            <TouchableOpacity
                style={[styles.headerButton, backDisabled && styles.headerButtonDisabled]}
                onPress={onBack}
                disabled={backDisabled}
                accessibilityRole="button"
                accessibilityLabel="Back"
                hitSlop={8}
            >
                <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
            </TouchableOpacity>

            <View style={styles.center}>
                {centerContent ?? (
                    title ? (
                        <Text style={[styles.title, titleStyle]} numberOfLines={1}>
                            {title}
                        </Text>
                    ) : null
                )}
            </View>

            <View style={styles.trailing}>
                {trailing}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 20,
        height: CREATE_SURFACE_HEADER_HEIGHT,
        paddingHorizontal: ContentInsets.screenHorizontal,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    headerButton: {
        width: ControlSizes.iconButton,
        height: ControlSizes.iconButton,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerButtonDisabled: {
        opacity: 0.5,
    },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 0,
    },
    trailing: {
        minWidth: ControlSizes.iconButton,
        minHeight: ControlSizes.iconButton,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    title: {
        ...TextStyles.caption,
        letterSpacing: 0.2,
        textTransform: 'uppercase',
    },
});
