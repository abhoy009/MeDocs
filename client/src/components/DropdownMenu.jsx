import { useState, useRef, useEffect } from 'react';
import './DropdownMenu.css';

const DropdownMenu = ({ label, items }) => {
    const [open, setOpen] = useState(false);
    const [focusIndex, setFocusIndex] = useState(-1);
    const menuRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setOpen(false);
                setFocusIndex(-1);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const actionableItems = items.filter(it => !it.divider && !it.disabled);

    const handleKeyDown = (e) => {
        if (!open) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                setOpen(true);
                setFocusIndex(0);
                e.preventDefault();
            }
            return;
        }
        if (e.key === 'Escape') { setOpen(false); setFocusIndex(-1); return; }
        if (e.key === 'ArrowDown') {
            setFocusIndex(i => Math.min(i + 1, actionableItems.length - 1));
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            setFocusIndex(i => Math.max(i - 1, 0));
            e.preventDefault();
        } else if (e.key === 'Enter' && focusIndex >= 0) {
            actionableItems[focusIndex]?.action?.();
            setOpen(false);
            setFocusIndex(-1);
        }
    };

    let actionableIndex = -1;

    return (
        <div className="dropdown" ref={menuRef}>
            <span
                className={`navbar-menu-item${open ? ' active' : ''}`}
                tabIndex={0}
                onClick={() => { setOpen(o => !o); setFocusIndex(-1); }}
                onKeyDown={handleKeyDown}
                aria-haspopup="true"
                aria-expanded={open}
            >
                {label}
            </span>

            {open && (
                <div className="dropdown-panel" role="menu">
                    {items.map((item, idx) => {
                        if (item.divider) {
                            return <div key={`div-${idx}`} className="dropdown-divider" />;
                        }
                        actionableIndex++;
                        const ai = actionableIndex;
                        return (
                            <button
                                key={item.label}
                                className={`dropdown-item${item.disabled ? ' disabled' : ''}${focusIndex === ai ? ' focused' : ''}${item.danger ? ' danger' : ''}`}
                                disabled={item.disabled}
                                role="menuitem"
                                onClick={() => {
                                    if (!item.disabled) {
                                        item.action?.();
                                        setOpen(false);
                                        setFocusIndex(-1);
                                    }
                                }}
                            >
                                {item.icon && <span className="dropdown-item-icon">{item.icon}</span>}
                                <span className="dropdown-item-label">{item.label}</span>
                                {item.shortcut && <span className="dropdown-item-shortcut">{item.shortcut}</span>}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default DropdownMenu;
