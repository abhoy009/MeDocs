import { useEffect, useRef, useState, useCallback } from 'react';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';
import 'quill/dist/quill.snow.css';
import { io } from 'socket.io-client';
import { useParams } from 'react-router-dom';
import * as Y from 'yjs';
import { QuillBinding } from 'y-quill';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';

Quill.register('modules/cursors', QuillCursors);

const CURSOR_COLORS = [
    '#E53935', '#1E88E5', '#43A047', '#FB8C00',
    '#8E24AA', '#00ACC1', '#D81B60', '#3949AB',
    '#00897B', '#6D4C41', '#F4511E', '#039BE5',
];

function getUserColor(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

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
    const yDocRef = useRef(null);
    const bindingRef = useRef(null);
    const awarenessRef = useRef(null);
    const undoManagerRef = useRef(null);
    const titleDebounce = useRef(null);

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
            modules: {
                toolbar: toolbarOptions,
                cursors: {
                    transformOnTextChange: true,
                },
                history: {
                    maxStack: 0,
                },
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

    // Connect socket with access token
    useEffect(() => {
        if (!accessToken) return;
        const s = io('http://localhost:9000', {
            auth: { token: accessToken }
        });
        setSocket(s);
        socketRef.current = s;
        return () => s.disconnect();
    }, [accessToken]);

    // Yjs sync + awareness cursors
    useEffect(() => {
        if (!socket || !quill) return;

        const yDoc = new Y.Doc();
        yDocRef.current = yDoc;
        const yText = yDoc.getText('quill');

        const awareness = new Awareness(yDoc);
        awarenessRef.current = awareness;

        const color = getUserColor(user?.id || 'anonymous');
        awareness.setLocalStateField('user', {
            name: user?.name || 'Anonymous',
            color: color,
            colorLight: color + '40',
        });

        socket.emit('awareness-init', yDoc.clientID);

        socket.once('load-document', ({ yState, title, owner }) => {
            if (yState) {
                Y.applyUpdate(yDoc, new Uint8Array(yState));
            }

            const binding = new QuillBinding(yText, quill, awareness);
            bindingRef.current = binding;

            const undoManager = new Y.UndoManager(yText, {
                captureTimeout: 300,
                trackedOrigins: new Set([binding, null]),
            });
            undoManagerRef.current = undoManager;

            quill.enable();
            quill.focus();
            if (title) setDocTitle(title);
            if (owner) setDocOwner(owner);
            setSaveStatus('saved');
        });

        socket.emit('get-document', id);

        // Send local Yjs updates to server
        const onYjsUpdate = (update, origin) => {
            if (origin === 'remote') return;
            setSaveStatus('saving');
            socket.emit('yjs-update', update);
        };
        yDoc.on('update', onYjsUpdate);

        // Apply remote Yjs updates
        const onRemoteYjsUpdate = (update) => {
            Y.applyUpdate(yDoc, new Uint8Array(update), 'remote');
        };
        socket.on('yjs-update', onRemoteYjsUpdate);

        // Send awareness updates to server
        const onAwarenessUpdate = ({ added, updated, removed }) => {
            const changedClients = [...added, ...updated, ...removed];
            const update = encodeAwarenessUpdate(awareness, changedClients);
            socket.emit('awareness-update', update);
        };
        awareness.on('update', onAwarenessUpdate);

        // Apply remote awareness updates
        const onRemoteAwareness = (update) => {
            applyAwarenessUpdate(awareness, new Uint8Array(update), 'remote');
        };
        socket.on('awareness-update', onRemoteAwareness);

        // Remove awareness for disconnected users
        const onAwarenessRemove = (clientId) => {
            removeAwarenessStates(awareness, [clientId], 'remote');
        };
        socket.on('awareness-remove', onAwarenessRemove);

        // Capture-phase handler so it fires before Quill's own keyboard module
        const onKeyDown = (e) => {
            const um = undoManagerRef.current;
            if (!um) return;
            const mod = e.ctrlKey || e.metaKey;
            if (mod && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                e.stopImmediatePropagation();
                um.undo();
            } else if (mod && e.key === 'z' && e.shiftKey) {
                e.preventDefault();
                e.stopImmediatePropagation();
                um.redo();
            } else if (mod && e.key === 'y') {
                e.preventDefault();
                e.stopImmediatePropagation();
                um.redo();
            }
        };
        quill.root.addEventListener('keydown', onKeyDown, true);

        // Mark as saved periodically (server persists every 5s)
        const saveTimer = setInterval(() => {
            setSaveStatus('saved');
        }, 6000);

        return () => {
            clearInterval(saveTimer);
            quill.root.removeEventListener('keydown', onKeyDown, true);
            yDoc.off('update', onYjsUpdate);
            socket.off('yjs-update', onRemoteYjsUpdate);
            socket.off('awareness-update', onRemoteAwareness);
            socket.off('awareness-remove', onAwarenessRemove);
            awareness.off('update', onAwarenessUpdate);
            if (undoManagerRef.current) {
                undoManagerRef.current.destroy();
                undoManagerRef.current = null;
            }
            if (bindingRef.current) {
                bindingRef.current.destroy();
                bindingRef.current = null;
            }
            awareness.destroy();
            awarenessRef.current = null;
            yDoc.destroy();
            yDocRef.current = null;
        };
    }, [quill, socket, id, user]);

    // Sync title from other users
    useEffect(() => {
        if (!socket) return;
        const handler = (title) => setDocTitle(title);
        socket.on('title-updated', handler);
        return () => socket.off('title-updated', handler);
    }, [socket]);

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
