import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSocket(accessToken) {
    const [socket, setSocket] = useState(null);
    const socketRef = useRef(null);

    useEffect(() => {
        if (!accessToken) return;
        const s = io('http://localhost:9000', {
            auth: { token: accessToken },
            transports: ['websocket'],
        });
        setSocket(s);
        socketRef.current = s;
        return () => s.disconnect();
    }, [accessToken]);

    return { socket, socketRef };
}
