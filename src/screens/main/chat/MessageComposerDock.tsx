import React, { useRef, useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, NativeSyntheticEvent, TextInputContentSizeChangeEventData } from 'react-native';
import Animated from 'react-native-reanimated';
import { Colors, Typography, Spacing, Radii } from '../../../utils/theme';

interface MessageComposerDockProps {
    draft: string;
    sending: boolean;
    recipientLabel: string;
    onChangeDraft: (value: string) => void;
    onSend: () => void;
    bottomPadding: number;
}

function MessageComposerDockComponent({
    draft,
    sending,
    recipientLabel,
    onChangeDraft,
    onSend,
    bottomPadding,
}: MessageComposerDockProps) {
    const inputRef = useRef<TextInput>(null);
    const [inputHeight, setInputHeight] = useState(MIN_INPUT_HEIGHT);

    const measuredInputStyle = useMemo(() => ({
        height: inputHeight,
    }), [inputHeight]);

    const handleContentSizeChange = useCallback((event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => {
        const nextHeight = clampInputHeight(event.nativeEvent.contentSize.height + 22);
        setInputHeight(current => current === nextHeight ? current : nextHeight);
    }, []);

    return (
        <Animated.View style={styles.shell}>
            <View style={[styles.inner, { paddingBottom: bottomPadding }]}>
                <View style={styles.header}>
                    <Text style={styles.title}>Replying to {recipientLabel}</Text>
                </View>

                <View style={styles.row}>
                    <TextInput
                        ref={inputRef}
                        placeholder="Write a message"
                        placeholderTextColor={Colors.light.textTertiary}
                        value={draft}
                        onChangeText={onChangeDraft}
                        editable={!sending}
                        multiline
                        autoCapitalize="sentences"
                        autoCorrect
                        textAlignVertical="top"
                        maxLength={1000}
                        onContentSizeChange={handleContentSizeChange}
                        blurOnSubmit={false}
                        onSubmitEditing={() => {
                            if (!draft.trim() || sending) return;
                            inputRef.current?.blur();
                            onSend();
                        }}
                        style={[styles.input, measuredInputStyle]}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (sending || !draft.trim()) && styles.sendButtonDisabled]}
                        onPress={onSend}
                        disabled={sending || !draft.trim()}
                    >
                        <Text style={styles.sendButtonText}>{sending ? '...' : 'Send'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );
}

MessageComposerDockComponent.displayName = 'MessageComposerDock';

export const MessageComposerDock = React.memo(MessageComposerDockComponent);

const MIN_INPUT_HEIGHT = 48;
const MAX_INPUT_HEIGHT = 112;

function clampInputHeight(height: number) {
    return Math.max(MIN_INPUT_HEIGHT, Math.min(MAX_INPUT_HEIGHT, Math.round(height)));
}

const styles = StyleSheet.create({
    shell: {
        borderTopWidth: 0.5,
        borderTopColor: Colors.light.border,
        backgroundColor: Colors.light.backgroundSecondary,
    },
    inner: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.sm,
        gap: Spacing.xs,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        flex: 1,
        fontSize: Typography.sizes.sm,
        color: Colors.light.textSecondary,
        fontWeight: '500',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    input: {
        flex: 1,
        backgroundColor: Colors.light.background,
        borderRadius: 24,
        borderWidth: 0.5,
        borderColor: Colors.light.border,
        paddingHorizontal: 16,
        paddingVertical: 11,
        fontSize: Typography.sizes.sm,
        color: Colors.light.textPrimary,
    },
    sendButton: {
        backgroundColor: Colors.success,
        borderRadius: Radii.full,
        minWidth: 58,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing.md,
        paddingVertical: 10,
    },
    sendButtonDisabled: { opacity: 0.6 },
    sendButtonText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.textOn.primary,
    },
});
