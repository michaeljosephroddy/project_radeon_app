import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '../../../api/client';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { TextField } from '../../../components/ui/TextField';
import { useReportGroupTargetMutation } from '../../../hooks/queries/useGroups';
import { useGradualKeyboardInset } from '../../../hooks/useGradualKeyboardInset';
import { Colors, ControlSizes, Radius, Spacing, TextStyles } from '../../../theme';

interface GroupReportScreenProps {
    group: api.Group;
    target?: {
        type: 'group' | 'member' | 'post' | 'comment';
        id?: string | null;
    };
    onBack: () => void;
    onReported: () => void;
}

const REPORT_REASONS = [
    'Safety concern',
    'Harassment',
    'Spam or promotion',
    'Recovery misinformation',
    'Privacy concern',
];

export function GroupReportScreen({
    group,
    target = { type: 'group' },
    onBack,
    onReported,
}: GroupReportScreenProps): React.ReactElement {
    const insets = useSafeAreaInsets();
    const [reason, setReason] = useState(REPORT_REASONS[0]);
    const [details, setDetails] = useState('');
    const reportMutation = useReportGroupTargetMutation(group.id);
    const bottomSafeSpace = Math.max(insets.bottom, Spacing.sm);
    const { height: keyboardInsetHeight } = useGradualKeyboardInset({
        closedHeight: bottomSafeSpace,
        openedOffset: Spacing.sm,
    });
    const keyboardSpacerStyle = useAnimatedStyle((): { height: number } => ({
        height: keyboardInsetHeight.value,
    }));

    const submit = async (): Promise<void> => {
        try {
            await reportMutation.mutateAsync({
                target_type: target.type,
                target_id: target.id ?? null,
                reason,
                details: details.trim() || null,
            });
            Alert.alert('Report sent', 'Thanks. The report is now in the moderation queue.');
            onReported();
        } catch (error: unknown) {
            Alert.alert('Could not report', error instanceof Error ? error.message : 'Please try again.');
        }
    };

    return (
        <View style={styles.container}>
            <ScreenHeader title="Report group" onBack={onBack} />
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                automaticallyAdjustKeyboardInsets={false}
            >
                <View style={styles.summary}>
                    <Ionicons name="shield-checkmark-outline" size={22} color={Colors.primary} />
                    <View style={styles.summaryCopy}>
                        <Text style={styles.title}>{group.name}</Text>
                        <Text style={styles.body}>Reports go to group admins and moderators for review.</Text>
                    </View>
                </View>

                <Text style={styles.label}>Reason</Text>
                <View style={styles.reasonGrid}>
                    {REPORT_REASONS.map((item) => {
                        const selected = reason === item;
                        return (
                            <TouchableOpacity
                                key={item}
                                style={[styles.reasonButton, selected && styles.reasonButtonSelected]}
                                onPress={() => setReason(item)}
                            >
                                <Text style={[styles.reasonText, selected && styles.reasonTextSelected]}>{item}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <Text style={styles.label}>Details</Text>
                <TextField
                    value={details}
                    onChangeText={setDetails}
                    placeholder="Add context for moderators"
                    multiline
                    style={styles.detailsInput}
                />

                <TouchableOpacity
                    style={[styles.submitButton, reportMutation.isPending && styles.disabled]}
                    onPress={submit}
                    disabled={reportMutation.isPending}
                >
                    <Text style={styles.submitButtonText}>Submit report</Text>
                </TouchableOpacity>
            </ScrollView>
            <Animated.View style={[styles.keyboardSpacer, keyboardSpacerStyle]} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    content: {
        padding: Spacing.md,
        gap: Spacing.md,
    },
    summary: {
        flexDirection: 'row',
        gap: Spacing.sm,
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        backgroundColor: Colors.bg.surface,
        padding: Spacing.md,
    },
    summaryCopy: {
        flex: 1,
        gap: Spacing.xs,
    },
    title: {
        ...TextStyles.sectionTitle,
        fontWeight: '800',
    },
    body: {
        ...TextStyles.secondary,
    },
    label: {
        ...TextStyles.label,
        fontWeight: '800',
    },
    reasonGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.sm,
    },
    reasonButton: {
        minHeight: ControlSizes.iconButton,
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.border.default,
        borderRadius: Radius.pill,
        backgroundColor: Colors.bg.surface,
        paddingHorizontal: Spacing.md,
    },
    reasonButtonSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    reasonText: {
        ...TextStyles.chip,
        fontWeight: '700',
    },
    reasonTextSelected: {
        color: Colors.primary,
    },
    detailsInput: {
        minHeight: 112,
        textAlignVertical: 'top',
    },
    submitButton: {
        minHeight: ControlSizes.buttonMinHeight,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Radius.pill,
        backgroundColor: Colors.danger,
        paddingHorizontal: Spacing.md,
    },
    submitButtonText: {
        ...TextStyles.button,
        fontSize: TextStyles.chip.fontSize,
        fontWeight: '800',
        color: Colors.textOn.danger,
    },
    keyboardSpacer: {
        flexShrink: 0,
        backgroundColor: Colors.bg.page,
    },
    disabled: {
        opacity: 0.5,
    },
});
