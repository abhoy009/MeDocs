import { Server } from 'socket.io';
import * as Y from 'yjs';
import { socketAuthMiddleware } from '../middleware/auth.js';
import { getDocument, updateTitle } from '../controller/document-controller.js';
import { restoreVersion } from '../controller/document-controller.js';
import {
    getOrCreateYDoc,
    migrateFromLegacyDelta,
    persistDoc,
    getActiveDoc,
    scheduleCleanup,
    replaceYDocState,
} from '../services/yjsManager.js';

export function setupSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: 'http://localhost:5173',
            methods: ['GET', 'POST', 'DELETE'],
            credentials: true,
        },
        maxHttpBufferSize: 5e6,
    });

    io.use(socketAuthMiddleware);

    io.on('connection', (socket) => {
        const userId = socket.user?.id;
        let currentDocId = null;
        let awarenessClientId = null;

        socket.on('get-document', async (documentId) => {
            currentDocId = documentId;
            const mongoDoc = await getDocument(documentId, userId);
            const entry = getOrCreateYDoc(documentId);
            entry.clients.add(socket.id);
            socket.join(documentId);

            const yText = entry.yDoc.getText('quill');
            if (yText.length === 0) {
                if (mongoDoc.yState && mongoDoc.yState.length > 0) {
                    Y.applyUpdate(entry.yDoc, new Uint8Array(mongoDoc.yState));
                } else if (mongoDoc.data?.ops?.length > 0) {
                    migrateFromLegacyDelta(entry.yDoc, mongoDoc.data);
                }
                entry.dirty = false;
            }

            const state = Y.encodeStateAsUpdate(entry.yDoc);
            socket.emit('load-document', {
                yState: Buffer.from(state),
                title: mongoDoc.title,
                owner: mongoDoc.owner?.toString() ?? null,
            });

            socket.on('yjs-update', (update) => {
                try {
                    Y.applyUpdate(entry.yDoc, new Uint8Array(update));
                    socket.broadcast.to(documentId).emit('yjs-update', update);
                } catch (err) {
                    console.error('Failed to apply yjs update:', err.message);
                }
            });

            socket.on('awareness-init', (clientId) => {
                awarenessClientId = clientId;
            });

            socket.on('awareness-update', (update) => {
                socket.broadcast.to(documentId).emit('awareness-update', update);
            });

            socket.on('save-title', async (title) => {
                await updateTitle(documentId, title);
                socket.broadcast.to(documentId).emit('title-updated', title);
            });

            // Restore a saved version — replaces the in-memory Y.Doc and reloads all clients
            socket.on('restore-version', async ({ versionId }) => {
                try {
                    // 1. Update MongoDB with the snapshot's yState + data
                    const result = await restoreVersion(documentId, versionId);
                    if (!result) return;

                    // 2. Replace the in-memory Y.Doc (Yjs is additive — we MUST swap it out)
                    replaceYDocState(documentId, new Uint8Array(result.yState));

                    // 3. Tell ALL clients in the room to reload — they will reconnect
                    //    and receive the restored state via 'load-document'
                    io.to(documentId).emit('restore-document');
                } catch (err) {
                    console.error('restore-version failed:', err.message);
                }
            });
        });

        socket.on('disconnect', async () => {
            if (!currentDocId) return;

            if (awarenessClientId != null) {
                socket.broadcast.to(currentDocId).emit('awareness-remove', awarenessClientId);
            }

            const entry = getActiveDoc(currentDocId);
            if (!entry) return;

            entry.clients.delete(socket.id);

            if (entry.clients.size === 0) {
                await persistDoc(currentDocId);
                io.in(currentDocId).allSockets().then((sockets) => {
                    if (sockets.size === 0) {
                        scheduleCleanup(currentDocId);
                    }
                });
            }
        });
    });

    return io;
}
