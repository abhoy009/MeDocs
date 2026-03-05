import { useEffect, useRef, useState, useCallback } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';

const toolbarOptions = [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    [{ 'font': [] }],
    [{ 'size': ['small', false, 'large', 'huge'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'script': 'sub' }, { 'script': 'super' }],
    ['blockquote', 'code-block'],
    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
    [{ 'indent': '-1' }, { 'indent': '+1' }],
    [{ 'align': [] }],
    [{ 'direction': 'rtl' }],
    ['link', 'image'],
    ['clean'],
];

const SAVE_INTERVAL_MS = 2000;
const TITLE_DEBOUNCE_MS = 500;

const Editor = () => {
    const { accessToken, user } = useAuth();
    const [socket, setSocket] = useState(null);
    const [quill, setQuill] = useState(null);
    const [saveStatus, setSaveStatus] = useState('saved');
    const [docTitle, setDocTitle] = useState('Untitled document');
    const [docOwner, setDocOwner] = useState(null);
    const { id } = useParams();
    const containerRef = useRef(null);
    const quillRef = useRef(null);
    const socketRef = useRef(null);
    const titleDebounce = useRef(null);
    const isDirty = useRef(false);

    // Initialize Quill once
    useEffect(() => {
        if (quillRef.current) return;
        const container = containerRef.current;
        if (!container) return;

        const editorDiv = document.createElement('div');
        editorDiv.id = 'quill-editor';
        container.appendChild(editorDiv);

        const q = new Quill(editorDiv, {
            theme: 'snow',
            modules: { toolbar: toolbarOptions },
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

    // Connect socket with access token
    useEffect(() => {
        if (!accessToken) return;
        const s = io('http://localhost:9000', {
            auth: { token: accessToken }    // passed to socketAuthMiddleware
        });
        setSocket(s);
        socketRef.current = s;
        return () => s.disconnect();
    }, [accessToken]);

    // Send changes and mark dirty
    useEffect(() => {
        if (!socket || !quill) return;
        const handler = (delta, _old, source) => {
            if (source !== 'user') return;
            socket.emit('send-changes', delta);
            isDirty.current = true;
            setSaveStatus('unsaved');
        };
        quill.on('text-change', handler);
        return () => quill.off('text-change', handler);
    }, [quill, socket]);

    // Receive changes
    useEffect(() => {
        if (!socket || !quill) return;
        const handler = (delta) => quill.updateContents(delta);
        socket.on('receive-changes', handler);
        return () => socket.off('receive-changes', handler);
    }, [quill, socket]);

    // Load document
    useEffect(() => {
        if (!quill || !socket) return;
        socket.once('load-document', ({ data, title, owner }) => {
            quill.setContents(data);
            quill.enable();
            quill.focus();
            if (title) setDocTitle(title);
            if (owner) setDocOwner(owner);
        });
        socket.emit('get-document', id);
    }, [quill, socket, id]);

    // Sync title from other users
    useEffect(() => {
        if (!socket) return;
        const handler = (title) => setDocTitle(title);
        socket.on('title-updated', handler);
        return () => socket.off('title-updated', handler);
    }, [socket]);

    // Auto-save only when content has changed
    useEffect(() => {
        if (!socket || !quill) return;
        const interval = setInterval(() => {
            if (!isDirty.current) return;
            isDirty.current = false;
            setSaveStatus('saving');
            socket.emit('save-document', quill.getContents());
            setTimeout(() => setSaveStatus('saved'), 600);
        }, SAVE_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [socket, quill]);

    // Save title with debounce
    const handleSetDocTitle = useCallback((newTitle) => {
        setDocTitle(newTitle);
        if (titleDebounce.current) clearTimeout(titleDebounce.current);
        titleDebounce.current = setTimeout(() => {
            socketRef.current?.emit('save-title', newTitle);
        }, TITLE_DEBOUNCE_MS);
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
            />
            <div className="editor-wrapper">
                <div ref={containerRef} />
            </div>
        </div>
    );
};

export default Editor;
