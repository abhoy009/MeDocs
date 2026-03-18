import { useState, useEffect, useRef } from 'react';
import * as Y from 'yjs';
import './VersionHistoryModal.css';

const API = 'http://localhost:9000';

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function VersionHistoryModal({ docId, accessToken, socket, onClose }) {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [preview, setPreview] = useState(null);   // { versionId, text }
    const [previewLoading, setPreviewLoading] = useState(false);
    const [restoring, setRestoring] = useState(null); // versionId being restored
    const panelRef = useRef(null);

    const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

    // Fetch version list on mount
    useEffect(() => {
        const fetchVersions = async () => {
            try {
                const res = await fetch(`${API}/api/documents/${docId}/versions`, { headers });
                if (!res.ok) throw new Error('Failed to load versions');
                const data = await res.json();
                setVersions(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchVersions();
    }, [docId]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

    const handlePreview = async (versionId) => {
        if (preview?.versionId === versionId) { setPreview(null); return; }
        setPreviewLoading(true);
        try {
            const res = await fetch(`${API}/api/documents/${docId}/versions/${versionId}`, { headers });
            if (!res.ok) throw new Error('Failed to load version');
            const { data } = await res.json();
            const text = (data?.ops || [])
                .map(op => (typeof op.insert === 'string' ? op.insert : ''))
                .join('');
            setPreview({ versionId, text: text || '(empty document)' });
        } catch (err) {
            setError(err.message);
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleRestore = async (versionId) => {
        if (!confirm('Restore this version? All unsaved changes will be replaced for everyone in the document.')) return;
        setRestoring(versionId);
        try {
            const res = await fetch(`${API}/api/documents/${docId}/versions/${versionId}/restore`, {
                method: 'POST', headers,
            });
            if (!res.ok) throw new Error('Restore failed');
            // Tell the socket to push the new state to all connected clients
            socket?.emit('restore-version', { versionId });
            onClose();
        } catch (err) {
            setError(err.message);
            setRestoring(null);
        }
    };

    return (
        <div className="vh-overlay">
            <div className="vh-panel" ref={panelRef}>
                {/* Header */}
                <div className="vh-header">
                    <h2 className="vh-title">Version history</h2>
                    <button className="vh-close" onClick={onClose} aria-label="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>

                {error && <p className="vh-error">{error}</p>}

                {/* Version list */}
                <div className="vh-body">
                    {loading ? (
                        <div className="vh-loading">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="vh-skeleton">
                                    <div className="vh-skeleton-line vh-skeleton-title" />
                                    <div className="vh-skeleton-line vh-skeleton-date" />
                                </div>
                            ))}
                        </div>
                    ) : versions.length === 0 ? (
                        <div className="vh-empty">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="1.5"/>
                                <path d="M12 6v6l4 2" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round"/>
                            </svg>
                            <p>No snapshots saved yet.</p>
                            <p className="vh-empty-sub">Use <strong>File → Save snapshot</strong> to create one.</p>
                        </div>
                    ) : (
                        <ul className="vh-list">
                            {versions.map((v) => (
                                <li key={v.versionId} className="vh-item">
                                    <div className="vh-item-info">
                                        <span className="vh-item-label">{v.label}</span>
                                        <span className="vh-item-date">{timeAgo(v.createdAt)}</span>
                                        {v.snippet && (
                                            <span className="vh-item-snippet">{v.snippet}</span>
                                        )}
                                    </div>
                                    <div className="vh-item-actions">
                                        <button
                                            className={`vh-btn vh-btn--ghost ${preview?.versionId === v.versionId ? 'vh-btn--active' : ''}`}
                                            onClick={() => handlePreview(v.versionId)}
                                            disabled={previewLoading}
                                        >
                                            {preview?.versionId === v.versionId ? 'Hide' : 'Preview'}
                                        </button>
                                        <button
                                            className="vh-btn vh-btn--primary"
                                            onClick={() => handleRestore(v.versionId)}
                                            disabled={restoring === v.versionId}
                                        >
                                            {restoring === v.versionId ? 'Restoring…' : 'Restore'}
                                        </button>
                                    </div>

                                    {/* Inline preview */}
                                    {preview?.versionId === v.versionId && (
                                        <div className="vh-preview">
                                            <pre className="vh-preview-text">{preview.text}</pre>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}
