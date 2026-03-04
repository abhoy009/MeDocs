import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../components/AuthPages.css';

const DocsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 24 32" fill="none">
        <path d="M14 0H2C0.9 0 0 0.9 0 2V30C0 31.1 0.9 32 2 32H22C23.1 32 24 31.1 24 30V10L14 0Z" fill="#4285F4" />
        <path d="M14 0L24 10H14V0Z" fill="#A8C7FA" />
        <rect x="5" y="14" width="14" height="2" rx="1" fill="white" />
        <rect x="5" y="18" width="14" height="2" rx="1" fill="white" />
        <rect x="5" y="22" width="9" height="2" rx="1" fill="white" />
    </svg>
);

const RegisterPage = () => {
    const { register } = useAuth();
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirm) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        try {
            await register(name, email, password);
            navigate('/');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-brand">
                <DocsIcon />
                <span className="auth-brand-name">MeDocs</span>
            </div>

            <div className="auth-card">
                <h1 className="auth-card-title">Create account</h1>
                <p className="auth-card-subtitle">Start editing documents for free</p>

                {error && (
                    <div className="auth-error">
                        <span>⚠️</span> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="auth-field">
                        <label className="auth-label" htmlFor="name">Full name</label>
                        <input
                            id="name"
                            type="text"
                            className="auth-input"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Your name"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="auth-field">
                        <label className="auth-label" htmlFor="email">Email address</label>
                        <input
                            id="email"
                            type="email"
                            className="auth-input"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                        />
                    </div>
                    <div className="auth-field">
                        <label className="auth-label" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="auth-input"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            required
                        />
                    </div>
                    <div className="auth-field">
                        <label className="auth-label" htmlFor="confirm">Confirm password</label>
                        <input
                            id="confirm"
                            type="password"
                            className={`auth-input${error.includes('match') ? ' error' : ''}`}
                            value={confirm}
                            onChange={e => setConfirm(e.target.value)}
                            placeholder="Repeat password"
                            required
                        />
                    </div>
                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? 'Creating account…' : 'Create account'}
                    </button>
                </form>

                <div className="auth-footer">
                    Already have an account?{' '}
                    <Link to="/login" className="auth-link">Sign in</Link>
                </div>
            </div>
        </div>
    );
};

export default RegisterPage;
