import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, ControlSizes, Radius, Spacing, TextStyles } from '../../theme';

export interface CreatePostFabProps {
    visible: boolean;
    bottom: number;
    onPress: () => void;
    label?: string;
    disabled?: boolean;
}

export function CreatePostFab({
    visible,
    bottom,
    onPress,
    label = 'Create',
    disabled = false,
}: CreatePostFabProps): React.ReactElement | null {
    if (!visible) return null;

    return (
        <TouchableOpacity
            style={[styles.createFab, { bottom }, disabled && styles.createFabDisabled]}
            onPress={onPress}
            activeOpacity={0.9}
            disabled={disabled}
        >
            <Ionicons name="add" size={20} color={Colors.textOn.primary} />
            <Text style={styles.createFabText}>{label}</Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    createFab: {
        position: 'absolute',
        alignSelf: 'center',
        minHeight: ControlSizes.fabMinHeight,
        borderRadius: Radius.pill,
        backgroundColor: Colors.primary,
        paddingHorizontal: Spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.xs,
        shadowColor: Colors.shadow,
        shadowOpacity: 0.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
        elevation: 5,
        zIndex: 10,
    },
    createFabDisabled: {
        opacity: 0.5,
    },
    createFabText: {
        ...TextStyles.button,
    },
});
