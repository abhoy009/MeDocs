import * as Y from 'yjs';
import { updateDocument } from '../controller/document-controller.js';

const SAVE_INTERVAL_MS = 5000;
const CLEANUP_GRACE_MS = 30000;

const activeDocs = new Map();

export function getOrCreateYDoc(documentId) {
    if (activeDocs.has(documentId)) {
        const entry = activeDocs.get(documentId);
        if (entry.cleanupTimer) {
            clearTimeout(entry.cleanupTimer);
            entry.cleanupTimer = null;
        }
        return entry;
    }

    const yDoc = new Y.Doc();
    const entry = { yDoc, clients: new Set(), dirty: false, cleanupTimer: null };

    yDoc.on('update', () => {
        entry.dirty = true;
    });

    activeDocs.set(documentId, entry);
    return entry;
}

export function deriveQuillDelta(yDoc) {
    const yText = yDoc.getText('quill');
    const delta = yText.toDelta();
    return { ops: delta.length > 0 ? delta : [] };
}

export async function persistDoc(documentId) {
    const entry = activeDocs.get(documentId);
    if (!entry || !entry.dirty) return;

    const yState = Buffer.from(Y.encodeStateAsUpdate(entry.yDoc));
    const data = deriveQuillDelta(entry.yDoc);
    await updateDocument(documentId, { yState, data });
    entry.dirty = false;
}

export function migrateFromLegacyDelta(yDoc, deltaData) {
    const ops = deltaData?.ops || [];
    if (ops.length === 0) return;

    const yText = yDoc.getText('quill');
    yDoc.transact(() => {
        for (const op of ops) {
            if (typeof op.insert === 'string') {
                const attrs = op.attributes || undefined;
                yText.insert(yText.length, op.insert, attrs);
            }
        }
    });
}

export function scheduleCleanup(documentId) {
    const entry = activeDocs.get(documentId);
    if (!entry) return;

    entry.cleanupTimer = setTimeout(async () => {
        await persistDoc(documentId);
        entry.yDoc.destroy();
        activeDocs.delete(documentId);
    }, CLEANUP_GRACE_MS);
}

export function getActiveDoc(documentId) {
    return activeDocs.get(documentId);
}

/**
 * Replaces the in-memory Y.Doc for a document with a fresh one derived from
 * a snapshot yState. This is the only correct way to "revert" in Yjs because
 * the CRDT is append-only — you cannot un-apply updates.
 *
 * Returns the encoded state of the new Y.Doc so the caller can broadcast it.
 */
export function replaceYDocState(documentId, snapshotYState) {
    const entry = activeDocs.get(documentId);

    // Build the new doc from the snapshot
    const freshDoc = new Y.Doc();
    Y.applyUpdate(freshDoc, snapshotYState);

    if (entry) {
        // Destroy the old doc
        entry.yDoc.destroy();

        // Swap in the fresh one and re-attach the dirty listener
        entry.yDoc = freshDoc;
        freshDoc.on('update', () => { entry.dirty = true; });
        entry.dirty = false;   // already persisted by restoreVersion()
    } else {
        // No active entry — create one so reconnecting clients get the right state
        freshDoc.on('update', () => {
            const e = activeDocs.get(documentId);
            if (e) e.dirty = true;
        });
        activeDocs.set(documentId, { yDoc: freshDoc, clients: new Set(), dirty: false, cleanupTimer: null });
    }

    return Y.encodeStateAsUpdate(freshDoc);
}


export function startPeriodicSave() {
    return setInterval(async () => {
        for (const [docId] of activeDocs) {
            try {
                await persistDoc(docId);
            } catch (err) {
                console.error(`Failed to persist doc ${docId}:`, err.message);
            }
        }
    }, SAVE_INTERVAL_MS);
}
