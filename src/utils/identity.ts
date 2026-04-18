// Ensures usernames are displayed with a leading @ for UI consistency.
export function formatUsername(username?: string): string {
    if (!username) return '@unknown';
    return username.startsWith('@') ? username : `@${username}`;
}
