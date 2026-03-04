import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './AuthPages.css';

const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    if (loading) {
        return (
            <div className="auth-loading">
                <div className="auth-spinner" />
                <p>Loading…</p>
            </div>
        );
    }

    if (!user) {
        navigate('/login', { replace: true });
        return null;
    }

    return children;
};

export default ProtectedRoute;
