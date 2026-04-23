import { QueryClient } from '@tanstack/react-query';

// Shared client for server-state queries and mutations across the app.
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnReconnect: false,
            refetchOnWindowFocus: false,
            gcTime: 1000 * 60 * 30,
        },
    },
});
