import React from 'react';
import {
    StyleProp,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle,
} from 'react-native';
import { Colors, Header, Spacing, Typography } from '../../theme';

export interface ScreenHeaderProps {
    onBack?: () => void;
    title?: string;
    centerContent?: React.ReactNode;
    trailing?: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    titleStyle?: StyleProp<TextStyle>;
}

export function ScreenHeader({
    onBack,
    title,
    centerContent,
    trailing,
    style,
    titleStyle,
}: ScreenHeaderProps) {
    return (
        <View style={[styles.container, style]}>
            <View style={styles.side}>
                {onBack ? (
                    <TouchableOpacity
                        onPress={onBack}
                        style={styles.backButton}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Text style={styles.backIcon}>←</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            <View style={styles.centerSlot}>
                {centerContent ?? (
                    title ? (
                        <Text style={[styles.title, titleStyle]} numberOfLines={1}>
                            {title}
                        </Text>
                    ) : null
                )}
            </View>

            <View style={[styles.side, styles.sideTrailing]}>
                {trailing}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: Header.paddingVertical,
        borderBottomWidth: 0.5,
        borderBottomColor: Colors.border.default,
        backgroundColor: Colors.bg.page,
        gap: Spacing.sm,
    },
    side: {
        width: Header.sideWidth,
        justifyContent: 'center',
    },
    sideTrailing: {
        alignItems: 'flex-end',
    },
    centerSlot: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
    },
    backButton: {
        padding: 4,
    },
    backIcon: {
        fontSize: Header.iconSize,
        color: Colors.primary,
    },
    title: {
        ...Typography.screenTitle,
        textAlign: 'center',
    },
});
