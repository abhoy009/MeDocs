import { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import DropdownMenu from './DropdownMenu';
import { useAuth } from '../context/AuthContext';
import FindReplaceModal from './modals/FindReplaceModal';
import WordCountModal from './modals/WordCountModal';
import ShortcutsModal from './modals/ShortcutsModal';
import AboutModal from './modals/AboutModal';
import VersionHistoryModal from './modals/VersionHistoryModal';
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

const Navbar = ({ saveStatus, docTitle, setDocTitle, quill, docId, docOwner, currentUserId, accessToken, yDocRef, socket }) => {
    const { user, logout } = useAuth();
    const [copied, setCopied] = useState(false);
    const [titleEditing, setTitleEditing] = useState(false);
    const [localTitle, setLocalTitle] = useState(docTitle);
    const [modal, setModal] = useState(null); // 'findReplace' | 'wordCount' | 'shortcuts' | 'about'
    const [zoom, setZoom] = useState(100);
    const [toolbarVisible, setToolbarVisible] = useState(true);
    const fileInputRef = useRef(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isDark, setIsDark] = useState(() => {
        const saved = localStorage.getItem('medocs-theme');
        if (saved) return saved === 'dark';
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    // Apply theme to <html> on mount + whenever isDark changes
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        localStorage.setItem('medocs-theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    const toggleTheme = () => setIsDark(d => !d);

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
            label: 'Save snapshot…', icon: '📸',
            action: async () => {
                const label = prompt('Name this snapshot (press Enter to use default):');
                if (label === null) return; // cancelled
                const yDoc = yDocRef?.current;
                if (!yDoc) return;
                const Y = await import('yjs');
                const yStateArr = Array.from(Y.encodeStateAsUpdate(yDoc));
                const delta = yDoc.getText('quill').toDelta();
                const data = { ops: delta || [] };
                try {
                    await fetch(`http://localhost:9000/api/documents/${docId}/versions`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
                        body: JSON.stringify({ label: label || 'Snapshot', yState: yStateArr, data }),
                    });
                } catch (e) {
                    console.error('Save snapshot failed:', e);
                }
            }
        },
        {
            label: 'Version history', icon: '🕐',
            action: () => openModal('versionHistory'),
        },
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

                    {/* Theme toggle */}
                    <button
                        className="theme-toggle-btn"
                        onClick={toggleTheme}
                        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                        aria-label="Toggle theme"
                    >
                        {isDark ? '☀️' : '🌙'}
                    </button>

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
            {modal === 'versionHistory' && (
                <VersionHistoryModal
                    docId={docId}
                    accessToken={accessToken}
                    socket={socket}
                    onClose={closeModal}
                />
            )}
        </>
    );
};

export default Navbar;
