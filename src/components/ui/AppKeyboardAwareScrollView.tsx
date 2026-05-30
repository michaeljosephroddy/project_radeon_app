import React, { forwardRef } from 'react';
import { Platform } from 'react-native';
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
            keyboardDismissMode = Platform.OS === 'ios' ? 'interactive' : 'on-drag',
            keyboardShouldPersistTaps = 'handled',
            showsVerticalScrollIndicator = false,
            automaticallyAdjustKeyboardInsets = false,
            disableScrollOnKeyboardHide = true,
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
                disableScrollOnKeyboardHide={disableScrollOnKeyboardHide}
                {...props}
            />
        );
    },
);
