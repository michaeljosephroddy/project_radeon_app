import type { ConnectionIntent } from '../api/client';

export const CONNECTION_INTENT_OPTIONS: Array<{ value: ConnectionIntent; label: string }> = [
    { value: 'support', label: 'Support & accountability' },
    { value: 'friends', label: 'Friends' },
    { value: 'dating', label: 'Open to dating' },
];

export const DEFAULT_CONNECTION_INTENTS: ConnectionIntent[] = ['support', 'friends'];

export function getConnectionIntentLabel(intent: ConnectionIntent): string {
    return CONNECTION_INTENT_OPTIONS.find((option) => option.value === intent)?.label ?? intent;
}

export function normalizeConnectionIntents(intents?: ConnectionIntent[] | null): ConnectionIntent[] {
    return intents && intents.length > 0 ? intents : DEFAULT_CONNECTION_INTENTS;
}
