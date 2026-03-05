import './App.css';
import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

const Editor = lazy(() => import('./components/Editor'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));

function RouteSpinner() {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            minHeight: '100vh', color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font)',
        }}>
            Loading…
        </div>
    );
}

function App() {
    return (
        <AuthProvider>
            <Router>
                <Suspense fallback={<RouteSpinner />}>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/register" element={<RegisterPage />} />

                        <Route
                            path="/docs/:id"
                            element={
                                <ProtectedRoute>
                                    <Editor />
                                </ProtectedRoute>
                            }
                        />

                        <Route path="/" element={<Navigate replace to={`/docs/${uuid()}`} />} />
                        <Route path="*" element={<Navigate replace to="/" />} />
                    </Routes>
                </Suspense>
            </Router>
        </AuthProvider>
    );
}

export default App;
