import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDocuments } from '../hooks/useDocuments';
import './DashboardPage.css';

/* ── Helpers ─────────────────────────────────────────────────── */
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

/* ── Skeleton Card ───────────────────────────────────────────── */
function SkeletonCard() {
    return (
        <div className="doc-card doc-card--skeleton" aria-hidden="true">
            <div className="doc-card__preview skeleton-block" />
            <div className="doc-card__meta">
                <div className="skeleton-line skeleton-line--title" />
                <div className="skeleton-line skeleton-line--date" />
            </div>
        </div>
    );
}

/* ── Inline Rename Input ─────────────────────────────────────── */
function RenameInput({ value, onSave, onCancel }) {
    const [val, setVal] = useState(value);
    const ref = useRef(null);
    useEffect(() => { ref.current?.select(); }, []);
    const commit = () => { if (val.trim()) onSave(val.trim()); else onCancel(); };
    return (
        <input
            ref={ref}
            className="doc-card__rename-input"
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') onCancel(); }}
            onClick={e => e.stopPropagation()}
        />
    );
}

/* ── Three-dot Menu ──────────────────────────────────────────── */
function DocMenu({ onOpen, onRename, onDelete }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);
    useEffect(() => {
        if (!open) return;
        const close = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);
    const act = (fn) => (e) => { e.stopPropagation(); setOpen(false); fn(); };
    return (
        <div className="doc-menu" ref={ref}>
            <button
                className="doc-menu__trigger"
                onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
                aria-label="Document options"
                title="More options"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                </svg>
            </button>
            {open && (
                <ul className="doc-menu__dropdown" role="menu">
                    <li role="menuitem" onClick={act(onOpen)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        Open
                    </li>
                    <li role="menuitem" onClick={act(onRename)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Rename
                    </li>
                    <li role="menuitem" className="doc-menu__item--danger" onClick={act(onDelete)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                        Delete
                    </li>
                </ul>
            )}
        </div>
    );
}

/* ── Document Card ───────────────────────────────────────────── */
function DocCard({ doc, onDelete, onRename }) {
    const navigate = useNavigate();
    const [renaming, setRenaming] = useState(false);
    const open = () => navigate(`/docs/${doc._id}`);
    return (
        <div className="doc-card" onClick={open} tabIndex={0} onKeyDown={e => e.key === 'Enter' && open()}>
            <div className="doc-card__preview">
                <div className="doc-card__lines">
                    {[...Array(6)].map((_, i) => <div key={i} className="doc-card__line" style={{ width: `${55 + (i * 17) % 40}%` }} />)}
                </div>
            </div>
            <div className="doc-card__meta">
                <DocMenu
                    onOpen={open}
                    onRename={() => setRenaming(true)}
                    onDelete={() => onDelete(doc._id)}
                />
                {renaming ? (
                    <RenameInput
                        value={doc.title}
                        onSave={(t) => { onRename(doc._id, t); setRenaming(false); }}
                        onCancel={() => setRenaming(false)}
                    />
                ) : (
                    <p className="doc-card__title" onDoubleClick={e => { e.stopPropagation(); setRenaming(true); }}>
                        {doc.title || 'Untitled document'}
                    </p>
                )}
                <p className="doc-card__date">{timeAgo(doc.updatedAt)}</p>
            </div>
        </div>
    );
}

/* ── Empty State ─────────────────────────────────────────────── */
function EmptyState({ onCreate }) {
    return (
        <div className="empty-state">
            <div className="empty-state__icon" aria-hidden="true">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="2" stroke="var(--color-border)" strokeWidth="1.5" />
                    <path d="M7 8h10M7 12h7M7 16h5" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </div>
            <h2 className="empty-state__title">No documents yet</h2>
            <p className="empty-state__sub">Create your first document to get started</p>
            <button className="btn-create btn-create--outlined" onClick={onCreate}>
                + New document
            </button>
        </div>
    );
}

/* ── Dashboard Page ──────────────────────────────────────────── */
export default function DashboardPage() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { docs, loading, error, createDoc, deleteDoc, renameDoc } = useDocuments();

    const handleLogout = async () => { await logout(); navigate('/login'); };

    const initials = user?.name
        ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '?';

    return (
        <div className="dashboard">
            {/* ── Top bar ── */}
            <header className="dashboard__header">
                <div className="dashboard__brand">
                    <svg className="brand-icon" viewBox="0 0 40 40" width="32" height="32" aria-hidden="true">
                        <rect width="40" height="40" rx="8" fill="var(--color-primary)" />
                        <rect x="10" y="10" width="20" height="3" rx="1.5" fill="white" />
                        <rect x="10" y="16" width="16" height="3" rx="1.5" fill="white" opacity=".8" />
                        <rect x="10" y="22" width="12" height="3" rx="1.5" fill="white" opacity=".6" />
                    </svg>
                    <span className="brand-name">MeDocs</span>
                </div>

                <div className="dashboard__user">
                    {user?.name && <span className="user-greeting">Hi, {user.name.split(' ')[0]}</span>}
                    <button className="avatar" onClick={handleLogout} title={`${user?.name || ''} — click to sign out`}>
                        {initials}
                    </button>
                </div>
            </header>

            {/* ── Main ── */}
            <main className="dashboard__main">
                {/* Create strip */}
                <section className="create-strip">
                    <div className="create-section-label">Start a new document</div>
                    <div className="create-cards">
                        <button className="create-card" onClick={createDoc} id="btn-new-doc">
                            <div className="create-card__preview">
                                <span className="create-card__plus">+</span>
                            </div>
                            <span className="create-card__label">Blank</span>
                        </button>
                    </div>
                </section>

                <div className="section-divider" />

                {/* Docs grid */}
                <section className="docs-section">
                    <div className="docs-section__header">
                        <h1 className="docs-section__title">Recent documents</h1>
                    </div>

                    {error && <p className="dashboard__error">{error}</p>}

                    {loading ? (
                        <div className="docs-grid">
                            {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
                        </div>
                    ) : docs.length === 0 ? (
                        <EmptyState onCreate={createDoc} />
                    ) : (
                        <div className="docs-grid">
                            {docs.map(doc => (
                                <DocCard
                                    key={doc._id}
                                    doc={doc}
                                    onDelete={deleteDoc}
                                    onRename={renameDoc}
                                />
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
