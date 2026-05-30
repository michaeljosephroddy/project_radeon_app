import React, { useMemo, useState } from 'react';
import {
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import { Colors, ContentInsets, Spacing } from '../../theme';
import { CREATE_SURFACE_HEADER_HEIGHT, CreateSurfaceHeader } from './CreateSurfaceHeader';
import { AppKeyboardAwareScrollView } from './AppKeyboardAwareScrollView';
import { KeyboardStickyFooter } from './KeyboardStickyFooter';

interface CreateFlowFrameProps {
    title: string;
    onBack: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    contentStyle?: StyleProp<ViewStyle>;
    scrollStyle?: StyleProp<ViewStyle>;
}

export function CreateFlowFrame({
    title,
    onBack,
    children,
    footer,
    contentStyle,
    scrollStyle,
}: CreateFlowFrameProps): React.ReactElement {
    const [footerHeight, setFooterHeight] = useState(0);
    const keyboardBottomOffset = footer ? footerHeight + Spacing.sm : Spacing.xl;
    const resolvedContentStyle = useMemo(
        () => [
            styles.content,
            footer ? { paddingBottom: Spacing.xl + footerHeight } : null,
            contentStyle,
        ],
        [contentStyle, footer, footerHeight],
    );

    return (
        <View style={styles.container}>
            <CreateSurfaceHeader onBack={onBack} title={title} />
            <AppKeyboardAwareScrollView
                style={[styles.scroll, scrollStyle]}
                contentContainerStyle={resolvedContentStyle}
                bottomOffset={keyboardBottomOffset}
            >
                {children}
            </AppKeyboardAwareScrollView>
            {footer ? (
                <KeyboardStickyFooter onHeightChange={setFooterHeight}>
                    {footer}
                </KeyboardStickyFooter>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    scroll: {
        flex: 1,
    },
    content: {
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingTop: CREATE_SURFACE_HEADER_HEIGHT + Spacing.md,
        paddingBottom: Spacing.xl,
        gap: Spacing.lg,
    },
});
