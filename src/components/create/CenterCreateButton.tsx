import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, ControlSizes, IconSizes, Radius, Spacing } from '../../theme';

interface CenterCreateButtonProps {
    visible: boolean;
    onPress: () => void;
}

export function CenterCreateButton({
    visible,
    onPress,
}: CenterCreateButtonProps): React.ReactElement | null {
    if (!visible) return null;

    return (
        <View pointerEvents="box-none" style={styles.container}>
            <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Create"
                activeOpacity={0.9}
                onPress={onPress}
                style={styles.button}
            >
                <Ionicons name="add" size={IconSizes.primaryAction} color={Colors.textOn.primary} />
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'flex-start',
        zIndex: 20,
        transform: [{ translateY: -24 }],
    },
    button: {
        width: ControlSizes.iconButtonLarge + Spacing.lg,
        height: ControlSizes.iconButtonLarge + Spacing.lg,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.primary,
        borderWidth: 4,
        borderColor: Colors.bg.page,
        shadowColor: Colors.shadow,
        shadowOpacity: 0.28,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
    },
});
