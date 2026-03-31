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
    const yDocRef = useRef(null);       // exposed so Navbar can snapshot
    // Mutable refs so event handlers always access the live instances
    const activeDocRef = useRef(null);
    const activeAwarenessRef = useRef(null);

    useEffect(() => {
        if (!socket || !quill) return;

        // ── Helper: builds a Y.Doc + Awareness from an optional encoded state ──
        const makeDoc = (encodedState) => {
            const doc = new Y.Doc();
            if (encodedState) Y.applyUpdate(doc, new Uint8Array(encodedState));

            const awr = new Awareness(doc);
            const color = getUserColor(user?.id || 'anonymous');
            awr.setLocalStateField('user', {
                name: user?.name || 'Anonymous',
                color,
                colorLight: color + '40',
            });
            return { doc, awr };
        };

        // ── Helper: tear down current binding / undoManager / doc / awareness ──
        const tearDown = () => {
            if (bindingRef.current) {
                bindingRef.current.destroy();
                bindingRef.current = null;
            }
            if (undoManagerRef.current) {
                undoManagerRef.current.destroy();
                undoManagerRef.current = null;
            }
            if (activeDocRef.current) {
                activeDocRef.current.off('update', onYjsUpdate);
                activeDocRef.current.destroy();
                activeDocRef.current = null;
            }
            if (activeAwarenessRef.current) {
                activeAwarenessRef.current.off('update', onAwarenessUpdate);
                activeAwarenessRef.current.destroy();
                activeAwarenessRef.current = null;
            }
        };

        // ── Helper: attach listeners + binding to a (doc, awr) pair ──
        const attach = (doc, awr) => {
            activeDocRef.current = doc;
            activeAwarenessRef.current = awr;
            yDocRef.current = doc;

            doc.on('update', onYjsUpdate);
            awr.on('update', onAwarenessUpdate);

            const yText = doc.getText('quill');
            const binding = new QuillBinding(yText, quill, awr);
            bindingRef.current = binding;

            const undoManager = new Y.UndoManager(yText, {
                captureTimeout: 300,
                trackedOrigins: new Set([binding, null]),
            });
            undoManagerRef.current = undoManager;

            return { yText, binding, undoManager };
        };

        // ── Socket-level update handlers (always use active refs) ──
        const onYjsUpdate = (update, origin) => {
            if (origin === 'remote') return;
            setSaveStatus('saving');
            socket.emit('yjs-update', update);
        };

        const onAwarenessUpdate = ({ added, updated, removed }) => {
            const awr = activeAwarenessRef.current;
            if (!awr) return;
            const changedClients = [...added, ...updated, ...removed];
            const update = encodeAwarenessUpdate(awr, changedClients);
            socket.emit('awareness-update', update);
        };

        // ── Initial doc setup ──
        const { doc: initDoc, awr: initAwr } = makeDoc(null);
        socket.emit('awareness-init', initDoc.clientID);

        socket.once('load-document', ({ yState, title, owner }) => {
            if (yState) Y.applyUpdate(initDoc, new Uint8Array(yState));
            attach(initDoc, initAwr);
            quill.enable();
            quill.focus();
            if (title) setDocTitle(title);
            if (owner) setDocOwner(owner);
            setSaveStatus('saved');
        });

        socket.emit('get-document', documentId);

        // ── Remote yjs updates ──
        const onRemoteYjsUpdate = (update) => {
            const doc = activeDocRef.current;
            if (doc) Y.applyUpdate(doc, new Uint8Array(update), 'remote');
        };
        socket.on('yjs-update', onRemoteYjsUpdate);

        // ── Snapshot restore: full fresh-doc swap, no page reload ──
        // Yjs is append-only — applyUpdate cannot revert content.
        // We must destroy the old doc and rebuild from the snapshot state.
        const onRestoreDocument = ({ yState } = {}) => {
            if (!yState) return;

            tearDown(); // destroys old doc, awareness, binding, undoManager

            const { doc: freshDoc, awr: freshAwr } = makeDoc(yState);
            attach(freshDoc, freshAwr);

            quill.enable();
            setSaveStatus('saved');
        };
        socket.on('restore-document', onRestoreDocument);

        // ── Remote awareness ──
        const onRemoteAwareness = (update) => {
            const awr = activeAwarenessRef.current;
            if (awr) applyAwarenessUpdate(awr, new Uint8Array(update), 'remote');
        };
        socket.on('awareness-update', onRemoteAwareness);

        const onAwarenessRemove = (clientId) => {
            const awr = activeAwarenessRef.current;
            if (awr) removeAwarenessStates(awr, [clientId], 'remote');
        };
        socket.on('awareness-remove', onAwarenessRemove);

        // ── Keyboard undo/redo ──
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

        // ── Cleanup on unmount / dep change ──
        return () => {
            clearInterval(saveTimer);
            quill.root.removeEventListener('keydown', onKeyDown, true);
            socket.off('yjs-update', onRemoteYjsUpdate);
            socket.off('restore-document', onRestoreDocument);
            socket.off('awareness-update', onRemoteAwareness);
            socket.off('awareness-remove', onAwarenessRemove);
            tearDown();
            yDocRef.current = null;
        };
    }, [quill, socket, documentId, user]);

    return { saveStatus, docTitle, docOwner, setDocTitle, setDocOwner, yDocRef };
}
