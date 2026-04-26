import type { UserGender } from '../api/client';

export const GENDER_SEGMENTS = [
    { key: 'woman', label: 'Woman' },
    { key: 'man', label: 'Man' },
    { key: 'non_binary', label: 'Non-binary' },
] as const satisfies ReadonlyArray<{ key: UserGender; label: string }>;

export function getGenderLabel(gender?: UserGender | null): string {
    return GENDER_SEGMENTS.find((item) => item.key === gender)?.label ?? 'Not set';
}

export function formatBirthDateValue(raw?: string | null): string {
    if (!raw) return 'Not set';
    return raw;
}
