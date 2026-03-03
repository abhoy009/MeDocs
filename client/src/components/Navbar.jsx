import { useState } from 'react';
import './Navbar.css';

const DocsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 24 32" fill="none">
        <path d="M14 0H2C0.9 0 0 0.9 0 2V30C0 31.1 0.9 32 2 32H22C23.1 32 24 31.1 24 30V10L14 0Z" fill="#4285F4" />
        <path d="M14 0L24 10H14V0Z" fill="#A8C7FA" />
        <rect x="5" y="14" width="14" height="2" rx="1" fill="white" />
        <rect x="5" y="18" width="14" height="2" rx="1" fill="white" />
        <rect x="5" y="22" width="9" height="2" rx="1" fill="white" />
    </svg>
);

const menus = ['File', 'Edit', 'View', 'Insert', 'Format', 'Tools', 'Help'];

const Navbar = ({ saveStatus, docTitle, setDocTitle }) => {
    const [titleEditing, setTitleEditing] = useState(false);
    const [localTitle, setLocalTitle] = useState(docTitle);
    const [copied, setCopied] = useState(false);

    const handleTitleBlur = () => {
        setTitleEditing(false);
        setDocTitle(localTitle.trim() || 'Untitled document');
        setLocalTitle(localTitle.trim() || 'Untitled document');
    };

    const handleTitleKeyDown = (e) => {
        if (e.key === 'Enter') e.target.blur();
    };

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
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
                        {menus.map((menu) => (
                            <span key={menu} className="navbar-menu-item">{menu}</span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="navbar-right">
                <div className={`save-status ${saveStatus}`} aria-live="polite">
                    {saveStatus === 'saving' ? (
                        <>
                            <span className="save-icon spinning">⟳</span>
                            <span>Saving…</span>
                        </>
                    ) : (
                        <>
                            <span className="save-icon">✓</span>
                            <span>Saved</span>
                        </>
                    )}
                </div>

                <button className="share-btn" onClick={handleShare}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z" />
                    </svg>
                    {copied ? 'Link copied!' : 'Share'}
                </button>

                <div className="navbar-avatar" title="You">
                    A
                </div>
            </div>
        </header>
    );
};

export default Navbar;
