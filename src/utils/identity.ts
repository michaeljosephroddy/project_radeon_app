export function formatUsername(username?: string): string {
    if (!username) return '@unknown';
    return username.startsWith('@') ? username : `@${username}`;
}
