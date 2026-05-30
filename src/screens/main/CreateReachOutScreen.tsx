import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as api from '../../api/client';
import { PrimaryButton } from '../../components/ui/PrimaryButton';
import { queryKeys } from '../../query/queryKeys';
import { screenStandards } from '../../styles/screenStandards';
import { Colors, IconSizes, Radius, Spacing, TextStyles } from '../../theme';

const REASONS: Array<{ key: api.SupportSignalReason; title: string; description: string }> = [
    { key: 'cravings', title: 'Cravings', description: 'You want someone to help you ride it out.' },
    { key: 'relapse_risk', title: 'Relapse risk', description: 'You feel close to drinking or using.' },
    { key: 'overwhelmed', title: 'Overwhelmed', description: 'Everything feels like too much right now.' },
    { key: 'lonely', title: 'Lonely', description: 'You could use a sober voice.' },
    { key: 'risky_place', title: 'Risky place', description: 'Your surroundings are making it harder.' },
    { key: 'need_to_talk', title: 'Need to talk', description: 'No big label, just a quick check-in.' },
];

interface CreateReachOutScreenProps {
    onBack: () => void;
    onCreated: () => void;
}

export function CreateReachOutScreen({ onBack, onCreated }: CreateReachOutScreenProps): React.ReactElement {
    const queryClient = useQueryClient();
    const insets = useSafeAreaInsets();
    const [reason, setReason] = useState<api.SupportSignalReason>('need_to_talk');
    const [submitting, setSubmitting] = useState(false);

    const submit = async (): Promise<void> => {
        setSubmitting(true);
        try {
            await api.createSupportSignal({ reason });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['support-signals'] }),
                queryClient.invalidateQueries({ queryKey: queryKeys.supportSignals({ scope: 'mine' }) }),
            ]);
            Alert.alert('Reach Out is live', 'People who can help will be able to message you.');
            onCreated();
        } catch (error) {
            Alert.alert('Could not start Reach Out', error instanceof Error ? error.message : 'Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.screen}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={styles.header}>
                <TouchableOpacity style={styles.headerButton} onPress={onBack} accessibilityLabel="Back">
                    <Ionicons name="arrow-back" size={IconSizes.header} color={Colors.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Reach Out</Text>
                <View style={styles.headerButton} />
            </View>
            <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={[
                    screenStandards.detailContent,
                    { paddingBottom: Math.max(insets.bottom + Spacing.xl, Spacing.xxl) },
                ]}
            >
                <Text style={styles.title}>What is going on?</Text>
                <Text style={styles.copy}>Choose the closest fit. People can message you from the Reach Out tab.</Text>

                <View style={styles.reasonList}>
                    {REASONS.map((item) => {
                        const selected = item.key === reason;
                        return (
                            <Pressable
                                key={item.key}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                style={[styles.reasonRow, selected && styles.reasonRowSelected]}
                                onPress={() => setReason(item.key)}
                            >
                                <View style={[styles.radio, selected && styles.radioSelected]}>
                                    {selected ? <View style={styles.radioDot} /> : null}
                                </View>
                                <View style={styles.reasonCopy}>
                                    <Text style={styles.reasonTitle}>{item.title}</Text>
                                    <Text style={styles.reasonDescription}>{item.description}</Text>
                                </View>
                            </Pressable>
                        );
                    })}
                </View>

                <PrimaryButton
                    label="Start Reach Out"
                    onPress={submit}
                    loading={submitting}
                    style={styles.submit}
                    leftAdornment={<Ionicons name="heart-outline" size={IconSizes.inline} color={Colors.textOn.primary} />}
                />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: Colors.bg.page,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    headerButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        ...TextStyles.screenTitle,
    },
    title: {
        ...TextStyles.sectionTitle,
        marginTop: Spacing.sm,
    },
    copy: {
        ...TextStyles.secondary,
        marginTop: Spacing.xs,
    },
    reasonList: {
        gap: Spacing.sm,
        marginTop: Spacing.lg,
    },
    reasonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: Colors.border.default,
        borderRadius: Radius.md,
        padding: Spacing.md,
        backgroundColor: Colors.bg.surface,
    },
    reasonRowSelected: {
        borderColor: Colors.primary,
        backgroundColor: Colors.primarySubtle,
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: Colors.border.emphasis,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioSelected: {
        borderColor: Colors.primary,
    },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: Colors.primary,
    },
    reasonCopy: {
        flex: 1,
    },
    reasonTitle: {
        ...TextStyles.rowTitle,
    },
    reasonDescription: {
        ...TextStyles.rowDescription,
        marginTop: 2,
    },
    submit: {
        marginTop: Spacing.xl,
    },
});
