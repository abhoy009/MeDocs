import jwt from 'jsonwebtoken';

// Express middleware — protects REST routes
export const authMiddleware = (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided.' });
    }

    const token = header.split(' ')[1];
    try {
        req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

// Socket.IO middleware — protects socket connections
export const socketAuthMiddleware = (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
        return next(new Error('Authentication required.'));
    }

    try {
        socket.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        next();
    } catch (err) {
        return next(new Error('Invalid or expired token.'));
    }
};
