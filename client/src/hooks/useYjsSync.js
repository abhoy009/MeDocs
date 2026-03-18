import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { QuillBinding } from 'y-quill';
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness';
import { getUserColor } from '../config/quillConfig';

export function useYjsSync({ socket, quill, documentId, user }) {
    const [saveStatus, setSaveStatus] = useState('saved');
    const [docTitle, setDocTitle] = useState('Untitled document');
    const [docOwner, setDocOwner] = useState(null);
    const bindingRef = useRef(null);
    const undoManagerRef = useRef(null);
    const yDocRef = useRef(null); // exposed so Navbar can snapshot

    useEffect(() => {
        if (!socket || !quill) return;

        const yDoc = new Y.Doc();
        yDocRef.current = yDoc;
        const yText = yDoc.getText('quill');

        const awareness = new Awareness(yDoc);
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

        socket.emit('get-document', documentId);

        const onYjsUpdate = (update, origin) => {
            if (origin === 'remote') return;
            setSaveStatus('saving');
            socket.emit('yjs-update', update);
        };
        yDoc.on('update', onYjsUpdate);

        const onRemoteYjsUpdate = (update) => {
            Y.applyUpdate(yDoc, new Uint8Array(update), 'remote');
        };
        socket.on('yjs-update', onRemoteYjsUpdate);

        // Restore: server has replaced its Y.Doc — reload to get the fresh state
        const onRestoreDocument = () => {
            window.location.reload();
        };
        socket.on('restore-document', onRestoreDocument);

        const onAwarenessUpdate = ({ added, updated, removed }) => {
            const changedClients = [...added, ...updated, ...removed];
            const update = encodeAwarenessUpdate(awareness, changedClients);
            socket.emit('awareness-update', update);
        };
        awareness.on('update', onAwarenessUpdate);

        const onRemoteAwareness = (update) => {
            applyAwarenessUpdate(awareness, new Uint8Array(update), 'remote');
        };
        socket.on('awareness-update', onRemoteAwareness);

        const onAwarenessRemove = (clientId) => {
            removeAwarenessStates(awareness, [clientId], 'remote');
        };
        socket.on('awareness-remove', onAwarenessRemove);

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

        const saveTimer = setInterval(() => {
            setSaveStatus('saved');
        }, 6000);

        return () => {
            clearInterval(saveTimer);
            quill.root.removeEventListener('keydown', onKeyDown, true);
            yDoc.off('update', onYjsUpdate);
            socket.off('yjs-update', onRemoteYjsUpdate);
            socket.off('restore-document', onRestoreDocument);
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
            yDoc.destroy();
            yDocRef.current = null;
        };
    }, [quill, socket, documentId, user]);

    return { saveStatus, docTitle, docOwner, setDocTitle, setDocOwner, yDocRef };
}
