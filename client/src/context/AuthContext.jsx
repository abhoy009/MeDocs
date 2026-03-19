import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API = import.meta.env.VITE_API_URL || 'http://localhost:9000';

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [accessToken, setAccessToken] = useState(null);
    const [loading, setLoading] = useState(true); // checking session on mount

    // Silently restore session from refresh token cookie on app load
    useEffect(() => {
        const restoreSession = async () => {
            try {
                const res = await fetch(`${API}/api/auth/refresh`, {
                    method: 'POST',
                    credentials: 'include' // send httpOnly cookie
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                    setAccessToken(data.accessToken);
                }
            } catch (_) {
                // No session — stay logged out
            } finally {
                setLoading(false);
            }
        };
        restoreSession();
    }, []);

    // Auto-refresh access token every 25 minutes (before 30min expiry)
    useEffect(() => {
        if (!accessToken) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API}/api/auth/refresh`, {
                    method: 'POST',
                    credentials: 'include'
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                    setAccessToken(data.accessToken);
                } else {
                    // Refresh failed — log out
                    setUser(null);
                    setAccessToken(null);
                }
            } catch (_) { }
        }, 25 * 60 * 1000); // 25 minutes

        return () => clearInterval(interval);
    }, [accessToken]);

    const login = useCallback(async (email, password) => {
        const res = await fetch(`${API}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        setUser(data.user);
        setAccessToken(data.accessToken);
        return data;
    }, []);

    const register = useCallback(async (name, email, password) => {
        const res = await fetch(`${API}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        setUser(data.user);
        setAccessToken(data.accessToken);
        return data;
    }, []);

    const logout = useCallback(async () => {
        await fetch(`${API}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include'
        });
        setUser(null);
        setAccessToken(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, accessToken, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
    return ctx;
};
