import React, { useCallback, useEffect } from 'react';
import { BackHandler, Dimensions, Keyboard, StyleSheet, TouchableOpacity } from 'react-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import Reanimated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '../ui/ScreenHeader';
import { Colors, Header, Spacing } from '../../theme';
import { CommentThread, CommentThreadProps } from './CommentThread';

const SCREEN_HEIGHT = Dimensions.get('screen').height;

export interface CommentThreadModalProps extends CommentThreadProps {
    title: string;
    onClose: () => void;
}

export function CommentThreadModal({
    title,
    onClose,
    ...threadProps
}: CommentThreadModalProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const slideY = useSharedValue(SCREEN_HEIGHT);
    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: slideY.value }],
    }));

    useEffect(() => {
        slideY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleClose = useCallback((): void => {
        Keyboard.dismiss();
        slideY.value = withTiming(SCREEN_HEIGHT, { duration: 220 }, () => {
            runOnJS(onClose)();
        });
    }, [onClose, slideY]);

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            handleClose();
            return true;
        });
        return () => sub.remove();
    }, [handleClose]);

    const topPad = insets.top + Header.paddingVertical;

    return (
        <Reanimated.View style={[styles.container, animatedStyle]}>
            <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
                <ScreenHeader
                    title={title}
                    style={[styles.header, { paddingTop: topPad }]}
                    trailing={(
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Ionicons name="close" size={22} color={Colors.text.primary} />
                        </TouchableOpacity>
                    )}
                />
                <CommentThread {...threadProps} />
            </KeyboardProvider>
        </Reanimated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    header: {
        paddingBottom: Spacing.sm,
    },
    closeButton: {
        padding: 4,
    },
});
