import { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import DropdownMenu from './DropdownMenu';
import Modal from './Modal';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const API = 'http://localhost:9000';

const DocsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 24 32" fill="none">
        <path d="M14 0H2C0.9 0 0 0.9 0 2V30C0 31.1 0.9 32 2 32H22C23.1 32 24 31.1 24 30V10L14 0Z" fill="#4285F4" />
        <path d="M14 0L24 10H14V0Z" fill="#A8C7FA" />
        <rect x="5" y="14" width="14" height="2" rx="1" fill="white" />
        <rect x="5" y="18" width="14" height="2" rx="1" fill="white" />
        <rect x="5" y="22" width="9" height="2" rx="1" fill="white" />
    </svg>
);

// ── Modal Contents ────────────────────────────────────────

const FindReplaceModal = ({ quill, onClose }) => {
    const [find, setFind] = useState('');
    const [replace, setReplace] = useState('');
    const [msg, setMsg] = useState('');

    const doFind = () => {
        if (!quill || !find) return;
        const text = quill.getText();
        const idx = text.indexOf(find);
        if (idx === -1) { setMsg('Not found.'); return; }
        quill.setSelection(idx, find.length);
        setMsg(`Found at position ${idx}`);
    };

    const doReplace = () => {
        if (!quill || !find) return;
        const text = quill.getText();
        let count = 0;
        let idx = text.indexOf(find);
        while (idx !== -1) {
            quill.deleteText(idx, find.length);
            quill.insertText(idx, replace);
            count++;
            idx = quill.getText().indexOf(find, idx + replace.length);
        }
        setMsg(count > 0 ? `Replaced ${count} occurrence(s).` : 'Not found.');
    };

    return (
        <Modal title="Find & Replace" onClose={onClose} footer={
            <>
                <button className="modal-btn modal-btn-secondary" onClick={doFind}>Find</button>
                <button className="modal-btn modal-btn-primary" onClick={doReplace}>Replace All</button>
            </>
        }>
            <div className="modal-field">
                <label className="modal-label">Find</label>
                <input className="modal-input" value={find} onChange={e => setFind(e.target.value)} placeholder="Search text…" />
            </div>
            <div className="modal-field">
                <label className="modal-label">Replace with</label>
                <input className="modal-input" value={replace} onChange={e => setReplace(e.target.value)} placeholder="Replacement text…" />
            </div>
            <div className="modal-find-results">{msg}</div>
        </Modal>
    );
};

const WordCountModal = ({ quill, onClose }) => {
    const text = quill ? quill.getText() : '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length > 0 ? text.length - 1 : 0; // subtract trailing newline
    const lines = text.split('\n').filter(l => l.trim()).length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length;

    return (
        <Modal title="Word Count" onClose={onClose}>
            <div className="modal-stat-grid">
                <div className="modal-stat">
                    <span className="modal-stat-value">{words.toLocaleString()}</span>
                    <div className="modal-stat-label">Words</div>
                </div>
                <div className="modal-stat">
                    <span className="modal-stat-value">{chars.toLocaleString()}</span>
                    <div className="modal-stat-label">Characters</div>
                </div>
                <div className="modal-stat">
                    <span className="modal-stat-value">{lines.toLocaleString()}</span>
                    <div className="modal-stat-label">Lines</div>
                </div>
                <div className="modal-stat">
                    <span className="modal-stat-value">{paragraphs.toLocaleString()}</span>
                    <div className="modal-stat-label">Paragraphs</div>
                </div>
            </div>
        </Modal>
    );
};

const ShortcutsModal = ({ onClose }) => {
    const shortcuts = [
        ['Bold', '⌘ B'],
        ['Italic', '⌘ I'],
        ['Underline', '⌘ U'],
        ['Undo', '⌘ Z'],
        ['Redo', '⌘ ⇧ Z'],
        ['Select All', '⌘ A'],
        ['Find & Replace', '⌘ H'],
        ['Print', '⌘ P'],
        ['Save (auto)', 'Every 2s'],
    ];
    return (
        <Modal title="Keyboard Shortcuts" onClose={onClose}>
            <table className="modal-table">
                <thead><tr><th>Action</th><th>Shortcut</th></tr></thead>
                <tbody>
                    {shortcuts.map(([action, sc]) => (
                        <tr key={action}>
                            <td>{action}</td>
                            <td><span className="modal-shortcut-key">{sc}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Modal>
    );
};

const AboutModal = ({ onClose }) => (
    <Modal title="About MeDocs" onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>MeDocs</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                A real-time collaborative document editor.<br />
                Built with React, Quill, Socket.IO, and MongoDB.
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Version 1.0.0</p>
        </div>
    </Modal>
);

// ── Helpers ────────────────────────────────────────────────

const downloadFromUrl = async (url, filename, token) => {
    const res = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
};

// ── Navbar ─────────────────────────────────────────────────

const Navbar = ({ saveStatus, docTitle, setDocTitle, quill, docId, docOwner, currentUserId, accessToken }) => {
    const { user, logout } = useAuth();
    const [copied, setCopied] = useState(false);
    const [titleEditing, setTitleEditing] = useState(false);
    const [localTitle, setLocalTitle] = useState(docTitle);
    const [modal, setModal] = useState(null); // 'findReplace' | 'wordCount' | 'shortcuts' | 'about'
    const [zoom, setZoom] = useState(100);
    const [toolbarVisible, setToolbarVisible] = useState(true);
    const fileInputRef = useRef(null);
    const [showUserMenu, setShowUserMenu] = useState(false);

    // Sync localTitle when docTitle prop changes (e.g. from another user via socket)
    // but only when the user isn't currently editing the title field
    useEffect(() => {
        if (!titleEditing) {
            setLocalTitle(docTitle);
        }
    }, [docTitle, titleEditing]);

    const openModal = (name) => setModal(name);
    const closeModal = () => setModal(null);

    const handleTitleBlur = () => {
        setTitleEditing(false);
        const trimmed = localTitle.trim() || 'Untitled document';
        setDocTitle(trimmed);
        setLocalTitle(trimmed);
    };

    const handleTitleKeyDown = (e) => {
        if (e.key === 'Enter') e.target.blur();
        if (e.key === 'Escape') { setTitleEditing(false); setLocalTitle(docTitle); }
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const applyZoom = useCallback((z) => {
        setZoom(z);
        const editor = document.querySelector('.ql-editor');
        if (editor) editor.style.fontSize = `${(11 * z) / 100}pt`;
    }, []);

    const toggleToolbar = () => {
        const tb = document.querySelector('.ql-toolbar');
        if (tb) {
            const hidden = tb.style.display === 'none';
            tb.style.display = hidden ? '' : 'none';
            setToolbarVisible(hidden);
        }
    };

    // Open local file
    const handleOpenFile = (e) => {
        const file = e.target.files[0];
        if (!file || !quill) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const content = ev.target.result;
            if (file.name.endsWith('.json')) {
                try {
                    const delta = JSON.parse(content);
                    quill.setContents(delta);
                } catch {
                    quill.setText(content);
                }
            } else {
                quill.setText(content);
            }
            const name = file.name.replace(/\.[^.]+$/, '');
            setDocTitle(name);
            setLocalTitle(name);
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    // ── Menu Definitions ──────────────────────────────────

    const fileMenu = [
        { label: 'New document', icon: '📄', action: () => window.open(`/docs/${uuid()}`, '_blank') },
        {
            label: 'Open local file…', icon: '📂',
            action: () => fileInputRef.current?.click()
        },
        { divider: true },
        { label: 'Rename', icon: '✏️', action: () => setTitleEditing(true) },
        { divider: true },
        {
            label: 'Download as .txt', icon: '⬇️',
            action: () => downloadFromUrl(
                `${API}/api/documents/${docId}/export?format=txt`,
                `${docTitle}.txt`,
                accessToken
            )
        },
        {
            label: 'Download as .json', icon: '⬇️',
            action: () => downloadFromUrl(
                `${API}/api/documents/${docId}/export?format=json`,
                `${docTitle}.json`,
                accessToken
            )
        },
        { divider: true },
        { label: 'Print', icon: '🖨️', shortcut: '⌘P', action: () => window.print() },
        { divider: true },
        {
            label: 'Delete document', icon: '🗑️', danger: true,
            // Only show as active if current user is the owner
            disabled: docOwner && currentUserId && docOwner !== currentUserId,
            action: async () => {
                if (!confirm('Delete this document permanently?')) return;
                await fetch(`${API}/api/documents/${docId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                window.location.href = '/';
            }
        },
    ];

    const editMenu = [
        {
            label: 'Undo', icon: '↩️', shortcut: '⌘Z',
            action: () => quill?.history.undo(),
            disabled: !quill
        },
        {
            label: 'Redo', icon: '↪️', shortcut: '⌘⇧Z',
            action: () => quill?.history.redo(),
            disabled: !quill
        },
        { divider: true },
        {
            label: 'Select all', icon: '⬜', shortcut: '⌘A',
            action: () => quill?.setSelection(0, quill.getLength()),
            disabled: !quill
        },
        { divider: true },
        { label: 'Find & Replace', icon: '🔍', shortcut: '⌘H', action: () => openModal('findReplace') },
    ];

    const viewMenu = [
        {
            label: toolbarVisible ? 'Hide toolbar' : 'Show toolbar',
            icon: '🔧', action: toggleToolbar
        },
        { divider: true },
        { label: 'Full screen', icon: '⛶', action: () => document.documentElement.requestFullscreen?.() },
        { divider: true },
        { label: `Zoom in (${Math.min(zoom + 25, 200)}%)`, icon: '🔍', action: () => applyZoom(Math.min(zoom + 25, 200)) },
        { label: `Zoom out (${Math.max(zoom - 25, 50)}%)`, icon: '🔎', action: () => applyZoom(Math.max(zoom - 25, 50)) },
        { label: 'Reset zoom (100%)', icon: '↺', action: () => applyZoom(100) },
    ];

    const insertMenu = [
        {
            label: 'Horizontal line', icon: '―',
            action: () => {
                if (!quill) return;
                const range = quill.getSelection(true);
                quill.insertText(range.index, '\n', 'user');
                quill.insertEmbed(range.index + 1, 'hr', true, 'user');
                quill.setSelection(range.index + 2, 'silent');
            }
        },
        {
            label: 'Link', icon: '🔗',
            action: () => {
                const tb = document.querySelector('.ql-link');
                tb?.click();
            }
        },
        {
            label: 'Image', icon: '🖼️',
            action: () => {
                const tb = document.querySelector('.ql-image');
                tb?.click();
            }
        },
    ];

    const formatMenu = [
        { label: 'Bold', icon: 'B', shortcut: '⌘B', action: () => quill?.format('bold', !quill.getFormat().bold), disabled: !quill },
        { label: 'Italic', icon: 'I', shortcut: '⌘I', action: () => quill?.format('italic', !quill.getFormat().italic), disabled: !quill },
        { label: 'Underline', icon: 'U', shortcut: '⌘U', action: () => quill?.format('underline', !quill.getFormat().underline), disabled: !quill },
        { label: 'Strikethrough', icon: 'S̶', action: () => quill?.format('strike', !quill.getFormat().strike), disabled: !quill },
        { divider: true },
        { label: 'Clear formatting', icon: '✕', action: () => { const s = quill?.getSelection(); if (s) quill.removeFormat(s.index, s.length); }, disabled: !quill },
        { divider: true },
        { label: 'Heading 1', icon: 'H1', action: () => quill?.format('header', 1), disabled: !quill },
        { label: 'Heading 2', icon: 'H2', action: () => quill?.format('header', 2), disabled: !quill },
        { label: 'Heading 3', icon: 'H3', action: () => quill?.format('header', 3), disabled: !quill },
        { label: 'Normal text', icon: 'T', action: () => quill?.format('header', false), disabled: !quill },
    ];

    const toolsMenu = [
        { label: 'Word count', icon: '📊', action: () => openModal('wordCount') },
    ];

    const helpMenu = [
        { label: 'Keyboard shortcuts', icon: '⌨️', action: () => openModal('shortcuts') },
        { divider: true },
        { label: 'About MeDocs', icon: 'ℹ️', action: () => openModal('about') },
    ];

    const allMenus = [
        { label: 'File', items: fileMenu },
        { label: 'Edit', items: editMenu },
        { label: 'View', items: viewMenu },
        { label: 'Insert', items: insertMenu },
        { label: 'Format', items: formatMenu },
        { label: 'Tools', items: toolsMenu },
        { label: 'Help', items: helpMenu },
    ];

    return (
        <>
            {/* Hidden file input for Open Local File */}
            <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.json"
                style={{ display: 'none' }}
                onChange={handleOpenFile}
            />

            <header className="navbar">
                <div className="navbar-left">
                    <div className="navbar-logo">
                        <DocsIcon />
                    </div>
                    <div className="navbar-title-group">
                        {titleEditing ? (
                            <input
                                autoFocus
                                className="navbar-title-input"
                                value={localTitle}
                                onChange={(e) => setLocalTitle(e.target.value)}
                                onBlur={handleTitleBlur}
                                onKeyDown={handleTitleKeyDown}
                            />
                        ) : (
                            <span
                                className="navbar-title"
                                onClick={() => setTitleEditing(true)}
                                title="Click to rename"
                            >
                                {docTitle}
                            </span>
                        )}
                        <div className="navbar-menu">
                            {allMenus.map(m => (
                                <DropdownMenu key={m.label} label={m.label} items={m.items} />
                            ))}
                        </div>
                    </div>
                </div>

                <div className="navbar-right">
                    <div className={`save-status ${saveStatus}`} aria-live="polite">
                        {saveStatus === 'saving' ? (
                            <><span className="save-icon spinning">⟳</span><span>Saving…</span></>
                        ) : (
                            <><span className="save-icon">✓</span><span>Saved</span></>
                        )}
                    </div>

                    <button className="share-btn" onClick={handleShare}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z" />
                        </svg>
                        {copied ? 'Link copied!' : 'Share'}
                    </button>

                    {/* User avatar with sign-out dropdown */}
                    <div className="navbar-avatar-wrap">
                        <div
                            className="navbar-avatar"
                            title={user?.name || 'You'}
                            onClick={() => setShowUserMenu(m => !m)}
                            style={{ cursor: 'pointer' }}
                        >
                            {user?.name ? user.name[0].toUpperCase() : 'A'}
                        </div>
                        {showUserMenu && (
                            <div className="navbar-user-menu">
                                <div className="navbar-user-info">
                                    <strong>{user?.name}</strong>
                                    <span>{user?.email}</span>
                                </div>
                                <div className="navbar-user-divider" />
                                <button
                                    className="navbar-user-signout"
                                    onClick={() => { logout(); setShowUserMenu(false); }}
                                >
                                    Sign out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Modals */}
            {modal === 'findReplace' && <FindReplaceModal quill={quill} onClose={closeModal} />}
            {modal === 'wordCount' && <WordCountModal quill={quill} onClose={closeModal} />}
            {modal === 'shortcuts' && <ShortcutsModal onClose={closeModal} />}
            {modal === 'about' && <AboutModal onClose={closeModal} />}
        </>
    );
};

export default Navbar;
