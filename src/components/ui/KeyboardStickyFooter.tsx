import React, { useCallback } from 'react';
import {
    LayoutChangeEvent,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, ContentInsets, Spacing } from '../../theme';

export const KEYBOARD_STICKY_FOOTER_SINGLE_ACTION_RESERVE = 96;
export const KEYBOARD_STICKY_FOOTER_KEYBOARD_GAP = Spacing.sm;

interface KeyboardStickyFooterProps {
    children: React.ReactNode;
    style?: StyleProp<ViewStyle>;
    contentStyle?: StyleProp<ViewStyle>;
    onHeightChange?: (height: number) => void;
}

export function KeyboardStickyFooter({
    children,
    style,
    contentStyle,
    onHeightChange,
}: KeyboardStickyFooterProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const footerBottomPadding = Math.max(insets.bottom, Spacing.sm);
    const handleLayout = useCallback((event: LayoutChangeEvent): void => {
        onHeightChange?.(event.nativeEvent.layout.height);
    }, [onHeightChange]);

    return (
        <KeyboardStickyView offset={{ closed: 0, opened: insets.bottom - KEYBOARD_STICKY_FOOTER_KEYBOARD_GAP }} style={style}>
            <View style={[styles.footer, { paddingBottom: footerBottomPadding }, contentStyle]} onLayout={handleLayout}>
                {children}
            </View>
        </KeyboardStickyView>
    );
}

const styles = StyleSheet.create({
    footer: {
        borderTopWidth: 1,
        borderTopColor: Colors.border.emphasis,
        backgroundColor: Colors.bg.page,
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingTop: Spacing.sm,
    },
});
