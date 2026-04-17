export function formatUsername(username?: string): string {
    if (!username) return '@unknown';
    return username.startsWith('@') ? username : `@${username}`;
}

export function getUsernameInitials(username?: string): string {
    const cleaned = (username ?? '').replace(/^@+/, '').trim();
    if (!cleaned) return '?';
    return cleaned.slice(0, 2).toUpperCase();
}
