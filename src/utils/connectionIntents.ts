import type { ConnectionIntent } from '../api/client';

export const CONNECTION_INTENT_OPTIONS: Array<{ value: ConnectionIntent; label: string }> = [
    { value: 'friends', label: 'Friends' },
    { value: 'dating', label: 'Open to dating' },
];

export const DEFAULT_CONNECTION_INTENTS: ConnectionIntent[] = ['friends'];

export function getConnectionIntentLabel(intent: ConnectionIntent): string {
    return CONNECTION_INTENT_OPTIONS.find((option) => option.value === intent)?.label ?? intent;
}

export function normalizeConnectionIntents(intents?: string[] | null): ConnectionIntent[] {
    if (!intents?.length) return DEFAULT_CONNECTION_INTENTS;

    const normalized: ConnectionIntent[] = ['friends'];
    if (intents.includes('dating')) {
        normalized.push('dating');
    }
    return normalized;
}
