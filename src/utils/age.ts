export function isAtLeastAge(dateValue: string, age: number, now = new Date()): boolean {
    const birthDate = parseBirthDate(dateValue);
    if (!birthDate) return false;
    const cutoff = new Date(Date.UTC(now.getUTCFullYear() - age, now.getUTCMonth(), now.getUTCDate()));
    return birthDate.getTime() <= cutoff.getTime();
}

export function parseBirthDate(dateValue: string): Date | null {
    const match = dateValue.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (
        parsed.getUTCFullYear() !== year
        || parsed.getUTCMonth() !== month - 1
        || parsed.getUTCDate() !== day
    ) {
        return null;
    }
    return parsed;
}
