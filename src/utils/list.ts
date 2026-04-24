/**
 * Deduplicates an array of objects by a specific key.
 * Useful for flattening paginated API responses where overlaps might occur.
 */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
}
