import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Persister, PersistedClient } from '@tanstack/query-persist-client-core';
import { trimPersistedInfiniteQueries } from './infiniteQueryPolicy';

const CACHE_KEY = 'react_query_cache';

export const asyncStoragePersister: Persister = {
    persistClient: async (client: PersistedClient): Promise<void> => {
        const trimmed = trimPersistedInfiniteQueries(client);
        // Persistence is best-effort. Avoid blocking UI work on an AsyncStorage
        // write for large query snapshots.
        void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
        const cachedState = await AsyncStorage.getItem(CACHE_KEY);
        if (!cachedState) return undefined;
        return trimPersistedInfiniteQueries(JSON.parse(cachedState) as PersistedClient);
    },
    removeClient: async (): Promise<void> => {
        await AsyncStorage.removeItem(CACHE_KEY);
    },
};
