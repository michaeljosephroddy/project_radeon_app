import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { ReflectionFormValues } from '../../../hooks/useReflectionForm';
import { Spacing } from '../../../theme';
import { REFLECTION_QUESTIONS } from '../../../utils/reflections';
import { ReflectionField } from './ReflectionField';

interface ReflectionPromptFieldsProps {
    values: ReflectionFormValues;
    onChange: (field: keyof ReflectionFormValues, value: string) => void;
}

export function ReflectionPromptFields({
    values,
    onChange,
}: ReflectionPromptFieldsProps): React.ReactElement {
    return (
        <View style={styles.container}>
            <ReflectionField
                label={REFLECTION_QUESTIONS.gratefulFor}
                value={values.gratefulFor}
                onChangeText={text => onChange('gratefulFor', text)}
                placeholder="One person, moment, or small thing..."
            />
            <ReflectionField
                label={REFLECTION_QUESTIONS.onMind}
                value={values.onMind}
                onChangeText={text => onChange('onMind', text)}
                placeholder="A thought you keep coming back to..."
            />
            <ReflectionField
                label={REFLECTION_QUESTIONS.blockingToday}
                value={values.blockingToday}
                onChangeText={text => onChange('blockingToday', text)}
                placeholder="A pressure, fear, craving, or obstacle..."
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        gap: Spacing.md,
    },
});
