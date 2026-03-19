import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL || 'http://localhost:9000';

export function useSocket(accessToken) {
    const [socket, setSocket] = useState(null);
    const socketRef = useRef(null);

    useEffect(() => {
        if (!accessToken) return;
        const s = io(API, {
            auth: { token: accessToken },
            transports: ['websocket'],
        });
        setSocket(s);
        socketRef.current = s;
        return () => s.disconnect();
    }, [accessToken]);

    return { socket, socketRef };
}
