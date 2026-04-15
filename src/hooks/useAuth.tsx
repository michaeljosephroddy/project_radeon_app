import React, { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../api/client';
import { syncLocationIfNeeded } from './useLocation';

interface AuthContextType {
    user: api.User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: Parameters<typeof api.register>[0]) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<api.User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Try to restore session on mount
        (async () => {
            try {
                const token = await api.getToken();
                if (token) {
                    const me = await api.getMe();
                    setUser(me);
                }
            } catch {
                await api.clearToken();
            } finally {
                setIsLoading(false);
            }
        })();
    }, []);

    const login = async (email: string, password: string) => {
        const { token } = await api.login(email, password);
        await api.setToken(token);
        const me = await api.getMe();
        setUser(me);
        // Fire location sync in background — does not block login completion
        syncLocationIfNeeded().catch(() => { });
    };

    const register = async (data: Parameters<typeof api.register>[0]) => {
        const { token } = await api.register(data);
        await api.setToken(token);
        const me = await api.getMe();
        setUser(me);
        // Fire location sync in background — does not block registration completion
        syncLocationIfNeeded().catch(() => { });
    };

    const logout = async () => {
        console.log('logout called');
        try {
            await api.logout();
            console.log('token cleared, setting user to null');
            setUser(null);
            console.log('user set to null');
        } catch (e) {
            console.log('logout error:', e);
        }
    };

    const refreshUser = async () => {
        const me = await api.getMe();
        setUser(me);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            isAuthenticated: !!user,
            login,
            register,
            logout,
            refreshUser,
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
