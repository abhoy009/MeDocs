import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Editor from './components/Editor';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    {/* Auth pages — public */}
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />

                    {/* Editor — protected */}
                    <Route
                        path="/docs/:id"
                        element={
                            <ProtectedRoute>
                                <Editor />
                            </ProtectedRoute>
                        }
                    />

                    {/* Root — redirect to a new doc (ProtectedRoute inside Editor will guard) */}
                    <Route path="/" element={<Navigate replace to={`/docs/${uuid()}`} />} />

                    {/* Fallback */}
                    <Route path="*" element={<Navigate replace to="/" />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;
