import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../schema/userSchema.js';

const ACCESS_EXPIRY = '30m';
const REFRESH_EXPIRY = '7d';

const signAccess = (payload) => jwt.sign(payload, process.env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_EXPIRY });
const signRefresh = (payload) => jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });

const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions = {
    httpOnly: true, // not accessible from JS (XSS safe)
    sameSite: isProduction ? 'none' : 'strict',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
};

// POST /api/auth/register
export const register = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password)
            return res.status(400).json({ error: 'All fields are required.' });

        if (password.length < 6)
            return res.status(400).json({ error: 'Password must be at least 6 characters.' });

        const existing = await User.findOne({ email });
        if (existing)
            return res.status(409).json({ error: 'An account with this email already exists.' });

        const hashed = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashed });

        const payload = { id: user._id, name: user.name, email: user.email };
        const accessToken = signAccess(payload);
        const refreshToken = signRefresh(payload);

        res.cookie('refreshToken', refreshToken, cookieOptions);
        res.status(201).json({ accessToken, user: payload });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/auth/login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ error: 'Email and password are required.' });

        const user = await User.findOne({ email });
        if (!user)
            return res.status(401).json({ error: 'Invalid email or password.' });

        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res.status(401).json({ error: 'Invalid email or password.' });

        const payload = { id: user._id, name: user.name, email: user.email };
        const accessToken = signAccess(payload);
        const refreshToken = signRefresh(payload);

        res.cookie('refreshToken', refreshToken, cookieOptions);
        res.json({ accessToken, user: payload });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/auth/refresh
export const refresh = async (req, res) => {
    try {
        const token = req.cookies?.refreshToken;
        if (!token)
            return res.status(401).json({ error: 'No refresh token.' });

        const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
        const payload = { id: decoded.id, name: decoded.name, email: decoded.email };
        const accessToken = signAccess(payload);

        res.json({ accessToken, user: payload });

    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired refresh token.' });
    }
};

// POST /api/auth/logout
export const logout = (_req, res) => {
    res.clearCookie('refreshToken', {
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'strict',
        secure: isProduction,
    });
    res.json({ message: 'Logged out.' });
};
