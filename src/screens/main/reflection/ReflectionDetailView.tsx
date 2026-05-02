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
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '../../../api/client';
import { useGradualKeyboardInset } from '../../../hooks/useGradualKeyboardInset';
import type { ReflectionFormValues } from '../../../hooks/useReflectionForm';
import { Colors, Radius, Spacing, Typography } from '../../../theme';
import { formatSobrietyDate } from '../../../utils/date';
import { ReflectionPromptFields } from './ReflectionPromptFields';
import { reflectionViewStyles } from './styles';

interface ReflectionDetailViewProps {
    reflection: api.DailyReflection;
    values: ReflectionFormValues;
    onChange: (field: keyof ReflectionFormValues, value: string) => void;
    canSave: boolean;
    isSaving: boolean;
    isSharing: boolean;
    isDeleting: boolean;
    onSave: () => void;
    onShare: () => void;
    onDelete: () => void;
}

export function ReflectionDetailView({
    reflection,
    values,
    onChange,
    canSave,
    isSaving,
    isSharing,
    isDeleting,
    onSave,
    onShare,
    onDelete,
}: ReflectionDetailViewProps): React.ReactElement {
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
                <View style={styles.hero}>
                    <Text style={reflectionViewStyles.dateLabel}>
                        {formatSobrietyDate(reflection.reflection_date)}
                    </Text>
                    {reflection.shared_post_id ? (
                        <View style={styles.sharedPill}>
                            <Ionicons name="checkmark-circle" size={15} color={Colors.success} />
                            <Text style={styles.sharedPillText}>Shared to feed</Text>
                        </View>
                    ) : null}
                </View>
                <ReflectionPromptFields values={values} onChange={onChange} />
            </ScrollView>
            <View style={reflectionViewStyles.actionDock}>
                <View style={reflectionViewStyles.actionRow}>
                    <TouchableOpacity
                        style={[
                            reflectionViewStyles.iconTextButton,
                            isDeleting && reflectionViewStyles.buttonDisabled,
                        ]}
                        onPress={onDelete}
                        disabled={isDeleting}
                    >
                        <Ionicons name="trash-outline" size={16} color={Colors.danger} />
                        <Text
                            style={[
                                reflectionViewStyles.secondaryButtonText,
                                reflectionViewStyles.deleteText,
                            ]}
                        >
                            Delete
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            reflectionViewStyles.secondaryButton,
                            isSharing && reflectionViewStyles.buttonDisabled,
                        ]}
                        onPress={onShare}
                        disabled={isSharing}
                    >
                        {isSharing ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                            <>
                                <Ionicons name="share-outline" size={16} color={Colors.primary} />
                                <Text style={reflectionViewStyles.secondaryButtonText}>Share</Text>
                            </>
                        )}
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
                            <Text style={reflectionViewStyles.primaryButtonText}>Save</Text>
                        )}
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
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.md,
        gap: Spacing.lg,
    },
    hero: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    sharedPill: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 6,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.surface,
    },
    sharedPillText: {
        fontSize: Typography.sizes.sm,
        fontWeight: '600',
        color: Colors.text.secondary,
    },
});
