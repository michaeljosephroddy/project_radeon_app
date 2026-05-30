import React from 'react';
import {
    ScrollView,
    StyleProp,
    StyleSheet,
    View,
    ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, ContentInsets, Spacing } from '../../theme';
import { CREATE_SURFACE_HEADER_HEIGHT, CreateSurfaceHeader } from './CreateSurfaceHeader';

interface CreateFlowFrameProps {
    title: string;
    onBack: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    keyboardSpacer?: React.ReactNode;
    contentStyle?: StyleProp<ViewStyle>;
    scrollStyle?: StyleProp<ViewStyle>;
}

export function CreateFlowFrame({
    title,
    onBack,
    children,
    footer,
    keyboardSpacer,
    contentStyle,
    scrollStyle,
}: CreateFlowFrameProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const footerBottomPadding = Math.max(insets.bottom, Spacing.sm);

    return (
        <View style={styles.container}>
            <CreateSurfaceHeader onBack={onBack} title={title} />
            <ScrollView
                style={[styles.scroll, scrollStyle]}
                contentContainerStyle={[styles.content, contentStyle]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets={false}
            >
                {children}
            </ScrollView>
            {footer ? (
                <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
                    {footer}
                </View>
            ) : null}
            {keyboardSpacer}
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
    footer: {
        borderTopWidth: 1,
        borderTopColor: Colors.border.emphasis,
        backgroundColor: Colors.bg.page,
        paddingHorizontal: ContentInsets.screenHorizontal,
        paddingTop: Spacing.sm,
    },
});
