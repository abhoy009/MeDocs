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

const LoginPage = () => {
    const { login } = useAuth();
    const navigate = useNavigate();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(email, password);
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
                <h1 className="auth-card-title">Sign in</h1>
                <p className="auth-card-subtitle">to continue to MeDocs</p>

                {error && (
                    <div className="auth-error">
                        <span>⚠️</span> {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="auth-field">
                        <label className="auth-label" htmlFor="email">Email address</label>
                        <input
                            id="email"
                            type="email"
                            className={`auth-input${error ? ' error' : ''}`}
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            required
                            autoFocus
                        />
                    </div>
                    <div className="auth-field">
                        <label className="auth-label" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className={`auth-input${error ? ' error' : ''}`}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>

                <div className="auth-footer">
                    Don't have an account?{' '}
                    <Link to="/register" className="auth-link">Create account</Link>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
