import type { ConnectionIntent } from '../api/client';

export interface ConnectionIntentOption {
    value: ConnectionIntent;
    label: string;
    description: string;
}

export const CONNECTION_INTENT_OPTIONS: ConnectionIntentOption[] = [
    {
        value: 'friends',
        label: 'Friends',
        description: 'Meet sober peers, build community, and stay connected.',
    },
    {
        value: 'dating',
        label: 'Dating',
        description: 'Only people who also choose Dating can see you there.',
    },
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
