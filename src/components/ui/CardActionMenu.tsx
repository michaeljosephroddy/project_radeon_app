import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, ControlSizes, Radius, Spacing, Typography } from '../../theme';

export interface CardActionMenuAction {
    label: string;
    destructive?: boolean;
    disabled?: boolean;
    onPress: () => void;
}

interface CardActionMenuProps {
    actions: CardActionMenuAction[];
    disabled?: boolean;
}

export function CardActionMenu({ actions, disabled = false }: CardActionMenuProps): React.ReactElement | null {
    const [open, setOpen] = useState(false);
    const availableActions = actions.filter(action => !action.disabled);

    const toggleOpen = useCallback((): void => {
        setOpen(current => !current);
    }, []);

    if (availableActions.length === 0) return null;

    return (
        <>
            <TouchableOpacity
                style={styles.button}
                onPress={toggleOpen}
                disabled={disabled}
            >
                <Ionicons name="ellipsis-horizontal" size={18} color={Colors.text.muted} />
            </TouchableOpacity>
            {open ? (
                <View style={styles.menu}>
                    {availableActions.map(action => (
                        <TouchableOpacity
                            key={action.label}
                            style={styles.menuItem}
                            onPress={() => {
                                setOpen(false);
                                action.onPress();
                            }}
                        >
                            <Text style={action.destructive ? styles.menuDangerText : styles.menuItemText}>
                                {action.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                    <TouchableOpacity style={styles.menuItem} onPress={() => setOpen(false)}>
                        <Text style={styles.menuMutedText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            ) : null}
        </>
    );
}

const styles = StyleSheet.create({
    button: {
        width: ControlSizes.iconButtonLarge,
        height: ControlSizes.iconButtonLarge,
        alignItems: 'center',
        justifyContent: 'center',
    },
    menu: {
        position: 'absolute',
        top: ControlSizes.iconButtonLarge - 4,
        right: 0,
        zIndex: 10,
        minWidth: 154,
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.raised,
        shadowColor: Colors.shadow,
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
        overflow: 'hidden',
    },
    menuItem: {
        minHeight: ControlSizes.iconButton,
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
    },
    menuItemText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.text.primary,
    },
    menuDangerText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.danger,
    },
    menuMutedText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '700',
        color: Colors.text.muted,
    },
});
