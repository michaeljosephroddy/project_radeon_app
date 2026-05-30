import React, { useCallback, useEffect, useState } from 'react';
import {
    LayoutChangeEvent,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import { KeyboardController, KeyboardEvents, KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, ContentInsets, Spacing } from '../../theme';

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
    const [keyboardActive, setKeyboardActive] = useState(() => KeyboardController.isVisible());
    const footerBottomPadding = keyboardActive ? Spacing.sm : Math.max(insets.bottom, Spacing.sm);
    const handleLayout = useCallback((event: LayoutChangeEvent): void => {
        onHeightChange?.(event.nativeEvent.layout.height);
    }, [onHeightChange]);

    useEffect(() => {
        const willShowSubscription = KeyboardEvents.addListener('keyboardWillShow', () => setKeyboardActive(true));
        const didShowSubscription = KeyboardEvents.addListener('keyboardDidShow', () => setKeyboardActive(true));
        const didHideSubscription = KeyboardEvents.addListener('keyboardDidHide', () => setKeyboardActive(false));

        return () => {
            willShowSubscription.remove();
            didShowSubscription.remove();
            didHideSubscription.remove();
        };
    }, []);

    return (
        <KeyboardStickyView offset={{ closed: 0, opened: 0 }} style={style}>
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
