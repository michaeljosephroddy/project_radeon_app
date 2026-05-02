import React from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGradualKeyboardInset } from '../../../hooks/useGradualKeyboardInset';
import type { ReflectionFormValues } from '../../../hooks/useReflectionForm';
import { Colors, Radius, Spacing } from '../../../theme';
import { ReflectionPromptFields } from './ReflectionPromptFields';
import { reflectionViewStyles } from './styles';

interface ReflectionEditorProps {
    dateLabel: string;
    values: ReflectionFormValues;
    onChange: (field: keyof ReflectionFormValues, value: string) => void;
    isLoading: boolean;
    canSave: boolean;
    onSave: () => void;
}

export function ReflectionEditor({
    dateLabel,
    values,
    onChange,
    isLoading,
    canSave,
    onSave,
}: ReflectionEditorProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const bottomSafeSpace = Math.max(insets.bottom, Spacing.sm);
    const { height: keyboardInset } = useGradualKeyboardInset({
        closedHeight: bottomSafeSpace,
        openedOffset: Spacing.sm,
    });
    const spacerStyle = useAnimatedStyle((): { height: number } => ({
        height: keyboardInset.value,
    }));

    return (
        <View style={reflectionViewStyles.keyboardView}>
            <ScrollView
                style={reflectionViewStyles.scroll}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustContentInsets={false}
                automaticallyAdjustKeyboardInsets={false}
                contentInsetAdjustmentBehavior="never"
            >
                <View style={reflectionViewStyles.hero}>
                    <Text style={reflectionViewStyles.dateLabel}>{dateLabel}</Text>
                    <Text style={reflectionViewStyles.prompt}>What do you want to reflect on?</Text>
                </View>

                {isLoading ? (
                    <View style={styles.loadingShell}>
                        <ActivityIndicator color={Colors.primary} />
                    </View>
                ) : (
                    <ReflectionPromptFields values={values} onChange={onChange} />
                )}
            </ScrollView>

            <View style={reflectionViewStyles.actionDock}>
                <View style={reflectionViewStyles.actionRow}>
                    <TouchableOpacity
                        style={[
                            reflectionViewStyles.primaryButton,
                            !canSave && reflectionViewStyles.buttonDisabled,
                        ]}
                        onPress={onSave}
                        disabled={!canSave}
                    >
                        <Text style={reflectionViewStyles.primaryButtonText}>Review</Text>
                    </TouchableOpacity>
                </View>
            </View>
            <Animated.View style={spacerStyle} />
        </View>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.md,
        gap: Spacing.lg,
    },
    loadingShell: {
        minHeight: 300,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.lg,
        backgroundColor: Colors.bg.surface,
        borderWidth: 1,
        borderColor: Colors.border.default,
    },
});
