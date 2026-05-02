import React from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ReflectionFormValues } from '../../../hooks/useReflectionForm';
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import { REFLECTION_QUESTIONS } from '../../../utils/reflections';
import { ReflectionAnswerPreview } from './ReflectionAnswerPreview';
import { reflectionViewStyles } from './styles';

interface ReflectionReviewViewProps {
    dateLabel: string;
    values: ReflectionFormValues;
    isSaving: boolean;
    canSave: boolean;
    onEdit: () => void;
    onSave: () => void;
}

export function ReflectionReviewView({
    dateLabel,
    values,
    isSaving,
    canSave,
    onEdit,
    onSave,
}: ReflectionReviewViewProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const bottomSafeSpace = Math.max(insets.bottom, Spacing.sm);
    return (
        <View style={reflectionViewStyles.keyboardView}>
            <ScrollView
                style={reflectionViewStyles.scroll}
                contentContainerStyle={styles.content}
            >
                <View style={reflectionViewStyles.hero}>
                    <Text style={reflectionViewStyles.dateLabel}>{dateLabel}</Text>
                    <Text style={reflectionViewStyles.prompt}>Review your reflection</Text>
                    <View style={styles.privatePill}>
                        <Ionicons name="lock-closed-outline" size={13} color={Colors.text.secondary} />
                        <Text style={styles.privatePillText}>Private</Text>
                    </View>
                </View>
                <ReflectionAnswerPreview
                    question={REFLECTION_QUESTIONS.gratefulFor}
                    answer={values.gratefulFor}
                />
                <ReflectionAnswerPreview
                    question={REFLECTION_QUESTIONS.onMind}
                    answer={values.onMind}
                />
                <ReflectionAnswerPreview
                    question={REFLECTION_QUESTIONS.blockingToday}
                    answer={values.blockingToday}
                />
            </ScrollView>
            <View style={reflectionViewStyles.actionDock}>
                <View style={reflectionViewStyles.actionRow}>
                    <TouchableOpacity style={reflectionViewStyles.secondaryButton} onPress={onEdit}>
                        <Ionicons name="create-outline" size={16} color={Colors.primary} />
                        <Text style={reflectionViewStyles.secondaryButtonText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            reflectionViewStyles.primaryButton,
                            !canSave && reflectionViewStyles.buttonDisabled,
                        ]}
                        onPress={onSave}
                        disabled={!canSave}
                    >
                        {isSaving ? (
                            <ActivityIndicator size="small" color={Colors.textOn.primary} />
                        ) : (
                            <Text style={reflectionViewStyles.primaryButtonText}>Save reflection</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
            <View style={{ height: bottomSafeSpace }} />
        </View>
    );
}

const styles = StyleSheet.create({
    content: {
        paddingHorizontal: Spacing.md,
        paddingTop: Spacing.xl,
        paddingBottom: Spacing.md,
        gap: Spacing.md,
    },
    privatePill: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.surface,
    },
    privatePillText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
});
