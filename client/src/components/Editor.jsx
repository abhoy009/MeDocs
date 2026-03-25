import { useCallback, useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';
import 'quill/dist/quill.snow.css';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toolbarOptions } from '../config/quillConfig';
import { useSocket } from '../hooks/useSocket';
import { useYjsSync } from '../hooks/useYjsSync';
import { useDocTitle } from '../hooks/useDocTitle';
import { useSmartAutocomplete } from '../hooks/useSmartAutocomplete';
import Navbar from './Navbar';
import AIPromptModal from './AIPromptModal';

if (!Quill.imports['modules/cursors']) {
    Quill.register('modules/cursors', QuillCursors);
}

const Editor = () => {
    const { accessToken, user } = useAuth();
    const { id } = useParams();
    const [quill, setQuill] = useState(null);
    const containerRef = useRef(null);
    const quillRef = useRef(null);

    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isQuotaExceeded, setIsQuotaExceeded] = useState(false);
    const [aiRetryAfterSeconds, setAiRetryAfterSeconds] = useState(0);
    const [aiRateLimitMessage, setAiRateLimitMessage] = useState('');

    // Countdown from backend-provided retry window so user knows when to retry.
    useEffect(() => {
        if (aiRetryAfterSeconds > 0) {
            setIsQuotaExceeded(true);
            const timer = setTimeout(() => setAiRetryAfterSeconds((prev) => Math.max(0, prev - 1)), 1000);
            return () => clearTimeout(timer);
        }
        setIsQuotaExceeded(false);
    }, [aiRetryAfterSeconds]);

    const triggerQuotaCooldown = useCallback((retryAfterSeconds = 60, message = 'Rate limit exceeded') => {
        const safeSeconds = Number.isFinite(Number(retryAfterSeconds)) ? Math.max(1, Number(retryAfterSeconds)) : 60;
        setAiRetryAfterSeconds(safeSeconds);
        setAiRateLimitMessage(message);
    }, []);

    const { socket, socketRef } = useSocket(accessToken);

    const { saveStatus, docTitle, docOwner, setDocTitle, yDocRef } = useYjsSync({
        socket, quill, documentId: id, user,
    });

    const { handleSetDocTitle } = useDocTitle({
        socket, socketRef, docTitle, setDocTitle,
    });

    const handleAutocompleteQuotaExceeded = useCallback((retryAfterSeconds, message) => {
        triggerQuotaCooldown(retryAfterSeconds, message || 'Autocomplete rate limit reached');
    }, [triggerQuotaCooldown]);

    useSmartAutocomplete(quill, accessToken, handleAutocompleteQuotaExceeded);

    const handleAIGenerate = async (prompt) => {
        setIsGenerating(true);
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9000';
            const res = await fetch(`${apiUrl}/api/ai/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ prompt }),
            });
            if (res.status === 429) {
                const data = await res.json().catch(() => ({}));
                triggerQuotaCooldown(data.retryAfterSeconds, data.error || 'Generation rate limit reached');
                throw new Error(data.error || 'Rate limit exceeded');
            }
            const data = await res.json();
            if (data.text && quillRef.current) {
                // Determine insertion position, try selection or default to end
                const selection = quillRef.current.getSelection();
                const index = selection ? selection.index : quillRef.current.getLength() - 1;
                
                quillRef.current.insertText(index, data.text + '\n');
                quillRef.current.setSelection(index + data.text.length + 1);
            }
        } catch (error) {
            console.error('Failed to generate AI text:', error);
        } finally {
            setIsGenerating(false);
            setIsAIModalOpen(false);
        }
    };

    useEffect(() => {
        if (quillRef.current) return;
        const container = containerRef.current;
        if (!container) return;

        const editorDiv = document.createElement('div');
        editorDiv.id = 'quill-editor';
        container.appendChild(editorDiv);

        const q = new Quill(editorDiv, {
            theme: 'snow',
            modules: {
                toolbar: toolbarOptions,
                cursors: { transformOnTextChange: true },
                history: { maxStack: 0 },
            },
            placeholder: 'Start typing your document…',
        });
        q.disable();
        quillRef.current = q;
        setQuill(q);

        return () => {
            quillRef.current = null;
            container.innerHTML = '';
        };
    }, []);

    return (
        <div className="editor-root">
            <Navbar
                saveStatus={saveStatus}
                docTitle={docTitle}
                setDocTitle={handleSetDocTitle}
                quill={quill}
                docId={id}
                docOwner={docOwner}
                currentUserId={user?.id}
                accessToken={accessToken}
                yDocRef={yDocRef}
                socket={socket}
            />
            <div className="editor-wrapper">
                <div ref={containerRef} />
            </div>

            <button 
                className="ai-fab-button" 
                onClick={() => {
                    if (isQuotaExceeded) {
                        alert(`${aiRateLimitMessage || 'Google Gemini Free Tier Quota Exhausted.'} Try again in ${aiRetryAfterSeconds}s.`);
                    }
                    else setIsAIModalOpen(true);
                }}
                title={isQuotaExceeded ? `Quota Exceeded (${aiRetryAfterSeconds}s)` : "Help me write"}
                style={{
                    background: isQuotaExceeded ? '#ea4335' : '#1a73e8',
                    cursor: isQuotaExceeded ? 'not-allowed' : 'pointer',
                    boxShadow: isQuotaExceeded ? 'none' : '0 4px 12px rgba(26, 115, 232, 0.4)'
                }}
            >
                {isQuotaExceeded ? `${aiRetryAfterSeconds}s` : '✨'}
            </button>

            <AIPromptModal 
                isOpen={isAIModalOpen} 
                onClose={() => setIsAIModalOpen(false)} 
                onSubmit={handleAIGenerate}
                isGenerating={isGenerating}
            />
        </div>
    );
};

export default Editor;
