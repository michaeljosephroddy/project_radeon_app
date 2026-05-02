import { useCallback, useMemo, useState } from 'react';
import { REFLECTION_QUESTIONS } from '../utils/reflections';

export interface ReflectionFormValues {
    gratefulFor: string;
    onMind: string;
    blockingToday: string;
}

const EMPTY_VALUES: ReflectionFormValues = {
    gratefulFor: '',
    onMind: '',
    blockingToday: '',
};

export interface UseReflectionFormResult {
    values: ReflectionFormValues;
    setField: (field: keyof ReflectionFormValues, value: string) => void;
    reset: (next?: ReflectionFormValues) => void;
    composedBody: string;
    isDirty: boolean;
    isEmpty: boolean;
}

// Three-prompt reflection editor state. Holds current values plus the seed they
// were last reset from, so callers can ask `isDirty` without diffing manually.
// The composed body joins non-empty fields with the canonical question labels,
// matching the format the backend expects in DailyReflection.body.
export function useReflectionForm(
    initial: ReflectionFormValues = EMPTY_VALUES,
): UseReflectionFormResult {
    const [values, setValues] = useState<ReflectionFormValues>(initial);
    const [seed, setSeed] = useState<ReflectionFormValues>(initial);

    const setField = useCallback(
        (field: keyof ReflectionFormValues, value: string): void => {
            setValues(current => ({ ...current, [field]: value }));
        },
        [],
    );

    const reset = useCallback(
        (next: ReflectionFormValues = EMPTY_VALUES): void => {
            setValues(next);
            setSeed(next);
        },
        [],
    );

    const composedBody = useMemo(() => composeBody(values), [values]);

    const isDirty = useMemo(
        () =>
            values.gratefulFor.trim() !== seed.gratefulFor.trim()
            || values.onMind.trim() !== seed.onMind.trim()
            || values.blockingToday.trim() !== seed.blockingToday.trim(),
        [values, seed],
    );

    const isEmpty = useMemo(
        () =>
            values.gratefulFor.trim() === ''
            && values.onMind.trim() === ''
            && values.blockingToday.trim() === '',
        [values],
    );

    return { values, setField, reset, composedBody, isDirty, isEmpty };
}

function composeBody(values: ReflectionFormValues): string {
    const parts: string[] = [];
    const grateful = values.gratefulFor.trim();
    const mind = values.onMind.trim();
    const blocking = values.blockingToday.trim();
    if (grateful) parts.push(`${REFLECTION_QUESTIONS.gratefulFor}\n${grateful}`);
    if (mind) parts.push(`${REFLECTION_QUESTIONS.onMind}\n${mind}`);
    if (blocking) parts.push(`${REFLECTION_QUESTIONS.blockingToday}\n${blocking}`);
    return parts.join('\n\n');
}
