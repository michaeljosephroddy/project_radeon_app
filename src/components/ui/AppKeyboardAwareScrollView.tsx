import React, { forwardRef } from 'react';
import {
    KeyboardAwareScrollView,
    type KeyboardAwareScrollViewProps,
    type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';
import { Spacing } from '../../theme';

export interface AppKeyboardAwareScrollViewProps extends KeyboardAwareScrollViewProps {
    bottomOffset?: number;
}

export const AppKeyboardAwareScrollView = forwardRef<KeyboardAwareScrollViewRef, AppKeyboardAwareScrollViewProps>(
    function AppKeyboardAwareScrollView(
        {
            bottomOffset = Spacing.lg,
            keyboardDismissMode = 'interactive',
            keyboardShouldPersistTaps = 'handled',
            showsVerticalScrollIndicator = false,
            automaticallyAdjustKeyboardInsets = false,
            ...props
        },
        ref,
    ): React.ReactElement {
        return (
            <KeyboardAwareScrollView
                ref={ref}
                bottomOffset={bottomOffset}
                keyboardDismissMode={keyboardDismissMode}
                keyboardShouldPersistTaps={keyboardShouldPersistTaps}
                showsVerticalScrollIndicator={showsVerticalScrollIndicator}
                automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
                {...props}
            />
        );
    },
);
