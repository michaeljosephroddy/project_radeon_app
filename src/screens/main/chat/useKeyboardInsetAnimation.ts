import { useMemo } from 'react';
import { SharedValue, useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';

interface KeyboardInsetAnimation {
    threadAnimatedStyle: object;
    composerAnimatedStyle: object;
    composerBottomPadding: number;
}

export function useKeyboardInsetAnimation(
    bottomInset: number,
    bottomSlack: SharedValue<number>,
): KeyboardInsetAnimation {
    const keyboard = useAnimatedKeyboard();
    const composerBottomPadding = useMemo(() => bottomInset + 8, [bottomInset]);

    const composerAnimatedStyle = useAnimatedStyle(() => {
        const keyboardOffset = Math.max(keyboard.height.value - bottomInset, 0);
        return {
            transform: [{ translateY: -keyboardOffset }],
        };
    }, [bottomInset]);

    const threadAnimatedStyle = useAnimatedStyle(() => {
        const keyboardOffset = Math.max(keyboard.height.value - bottomInset, 0);
        const offset = Math.max(keyboardOffset - bottomSlack.value, 0);
        return {
            transform: [{ translateY: -offset }],
        };
    }, [bottomInset]);

    return {
        threadAnimatedStyle,
        composerAnimatedStyle,
        composerBottomPadding,
    };
}
