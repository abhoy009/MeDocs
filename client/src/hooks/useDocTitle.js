import { useEffect, useCallback, useRef } from 'react';

const TITLE_DEBOUNCE_MS = 500;

export function useDocTitle({ socket, socketRef, docTitle, setDocTitle }) {
    const titleDebounce = useRef(null);

    useEffect(() => {
        if (!socket) return;
        const handler = (title) => setDocTitle(title);
        socket.on('title-updated', handler);
        return () => socket.off('title-updated', handler);
    }, [socket, setDocTitle]);

    const handleSetDocTitle = useCallback((newTitle) => {
        setDocTitle(newTitle);
        if (titleDebounce.current) clearTimeout(titleDebounce.current);
        titleDebounce.current = setTimeout(() => {
            socketRef.current?.emit('save-title', newTitle);
        }, TITLE_DEBOUNCE_MS);
    }, [setDocTitle, socketRef]);

    return { docTitle, handleSetDocTitle };
}
