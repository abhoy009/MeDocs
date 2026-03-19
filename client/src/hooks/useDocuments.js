import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { useAuth } from '../context/AuthContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:9000';

export function useDocuments() {
    const { accessToken } = useAuth();
    const navigate = useNavigate();
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    const fetchDocs = useCallback(async () => {
        if (!accessToken) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API}/api/documents`, { headers: authHeaders });
            if (!res.ok) throw new Error('Failed to load documents');
            const data = await res.json();
            setDocs(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [accessToken]);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    const createDoc = useCallback(() => {
        const id = uuid();
        navigate(`/docs/${id}`);
    }, [navigate]);

    const deleteDoc = useCallback(async (id) => {
        try {
            const res = await fetch(`${API}/api/documents/${id}`, {
                method: 'DELETE',
                headers: authHeaders,
            });
            if (!res.ok) throw new Error('Delete failed');
            setDocs(prev => prev.filter(d => d._id !== id));
        } catch (err) {
            setError(err.message);
        }
    }, [accessToken]);

    const renameDoc = useCallback(async (id, title) => {
        if (!title.trim()) return;
        try {
            const res = await fetch(`${API}/api/documents/${id}/title`, {
                method: 'PATCH',
                headers: { ...authHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title.trim() }),
            });
            if (!res.ok) throw new Error('Rename failed');
            const data = await res.json();
            setDocs(prev => prev.map(d => d._id === id ? { ...d, title: data.title } : d));
        } catch (err) {
            setError(err.message);
        }
    }, [accessToken]);

    return { docs, loading, error, createDoc, deleteDoc, renameDoc, refresh: fetchDocs };
}
