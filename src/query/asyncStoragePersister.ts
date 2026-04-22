import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Persister, PersistedClient } from '@tanstack/query-persist-client-core';

const CACHE_KEY = 'react_query_cache';

export const asyncStoragePersister: Persister = {
    persistClient: async (client: PersistedClient): Promise<void> => {
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(client));
    },
    restoreClient: async (): Promise<PersistedClient | undefined> => {
        const cachedState = await AsyncStorage.getItem(CACHE_KEY);
        if (!cachedState) return undefined;
        return JSON.parse(cachedState) as PersistedClient;
    },
    removeClient: async (): Promise<void> => {
        await AsyncStorage.removeItem(CACHE_KEY);
    },
};
