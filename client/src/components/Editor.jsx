import { useEffect, useRef, useState, useCallback } from 'react';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
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

const Editor = () => {
    const [socket, setSocket] = useState(null);
    const [quill, setQuill] = useState(null);
    const [saveStatus, setSaveStatus] = useState('saved');
    const [docTitle, setDocTitle] = useState('Untitled document');
    const { id } = useParams();
    const containerRef = useRef(null);
    const quillRef = useRef(null);

    // Initialize Quill once
    useEffect(() => {
        if (quillRef.current) return; // already initialized

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

    // Connect socket
    useEffect(() => {
        const s = io('http://localhost:9000');
        setSocket(s);
        return () => s.disconnect();
    }, []);

    // Send changes to other clients
    useEffect(() => {
        if (!socket || !quill) return;

        const handler = (delta, _oldData, source) => {
            if (source !== 'user') return;
            socket.emit('send-changes', delta);
        };

        quill.on('text-change', handler);
        return () => quill.off('text-change', handler);
    }, [quill, socket]);

    // Receive changes from other clients
    useEffect(() => {
        if (!socket || !quill) return;

        const handler = (delta) => quill.updateContents(delta);
        socket.on('receive-changes', handler);
        return () => socket.off('receive-changes', handler);
    }, [quill, socket]);

    // Load document from server
    useEffect(() => {
        if (!quill || !socket) return;

        socket.once('load-document', (document) => {
            quill.setContents(document);
            quill.enable();
            quill.focus();
        });

        socket.emit('get-document', id);
    }, [quill, socket, id]);

    // Auto-save every 2 seconds
    useEffect(() => {
        if (!socket || !quill) return;

        const interval = setInterval(() => {
            setSaveStatus('saving');
            socket.emit('save-document', quill.getContents());
            // Simulate save confirmation after short delay
            setTimeout(() => setSaveStatus('saved'), 600);
        }, SAVE_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [socket, quill]);

    return (
        <div className="editor-root">
            <Navbar
                saveStatus={saveStatus}
                docTitle={docTitle}
                setDocTitle={setDocTitle}
            />
            <div className="editor-wrapper">
                <div ref={containerRef} />
            </div>
        </div>
    );
};

export default Editor;
