import Document from '../schema/documentSchema.js';
import { v4 as uuid } from 'uuid';

export const getDocument = async (id, userId = null) => {
    if (!id) return;
    const document = await Document.findById(id);
    if (document) return document;
    return await Document.create({ _id: id, data: { ops: [] }, title: 'Untitled document', owner: userId });
};

export const updateDocument = async (id, { yState, data }) => {
    const update = { yState };
    if (data) update.data = data;
    return await Document.findByIdAndUpdate(id, update, { new: true });
};

export const updateTitle = async (id, title) => {
    return await Document.findByIdAndUpdate(id, { title }, { new: true });
};

export const getAllDocuments = async (userId) => {
    const query = userId ? { owner: userId } : {};
    const docs = await Document.find(query, { _id: 1, title: 1, updatedAt: 1, owner: 1, data: 1 }).sort({ updatedAt: -1 });
    return docs.map(doc => {
        const ops = doc.data?.ops || [];
        const snippet = ops
            .map(op => (typeof op.insert === 'string' ? op.insert : ''))
            .join('')
            .replace(/\n+/g, ' ')
            .trim()
            .slice(0, 120);
        return { _id: doc._id, title: doc.title, updatedAt: doc.updatedAt, owner: doc.owner, snippet };
    });
};

export const deleteDocument = async (id, userId = null) => {
    const doc = await Document.findById(id);
    if (!doc) return null;
    // Only owner can delete; if no owner set, allow deletion
    if (doc.owner && userId && doc.owner.toString() !== userId.toString()) {
        throw new Error('Unauthorized: only the document owner can delete.');
    }
    return await Document.findByIdAndDelete(id);
};

export const exportDocument = async (id, format) => {
    const doc = await Document.findById(id);
    if (!doc) return null;

    if (format === 'json') {
        return { content: JSON.stringify(doc.data, null, 2), mimeType: 'application/json', ext: 'json' };
    }

    // Plain text — extract text from Quill delta ops
    const ops = doc.data?.ops || [];
    const text = ops.map(op => (typeof op.insert === 'string' ? op.insert : '')).join('');
    return { content: text, mimeType: 'text/plain', ext: 'txt' };
};

/* ── Version / Snapshot functions ─────────────────────────────── */

const MAX_VERSIONS = 50;

export const saveVersion = async (id, { label, authorId, yState, data }) => {
    const version = {
        versionId: uuid(),
        label: label || 'Snapshot',
        authorId: authorId || null,
        createdAt: new Date(),
        yState: Buffer.from(yState),
        data: data || { ops: [] },
    };
    // Push new version, keep only the last MAX_VERSIONS
    const doc = await Document.findByIdAndUpdate(
        id,
        {
            $push: {
                versions: {
                    $each: [version],
                    $slice: -MAX_VERSIONS,
                },
            },
        },
        { new: true }
    );
    if (!doc) throw new Error('Document not found');
    // Return lightweight version info (no yState binary)
    return { versionId: version.versionId, label: version.label, createdAt: version.createdAt };
};

export const getVersions = async (id) => {
    const doc = await Document.findById(id, { versions: 1 });
    if (!doc) return null;
    // Return list without the heavy yState buffers
    return doc.versions.map(v => ({
        versionId: v.versionId,
        label: v.label,
        authorId: v.authorId,
        createdAt: v.createdAt,
        snippet: (v.data?.ops || [])
            .map(op => (typeof op.insert === 'string' ? op.insert : ''))
            .join('')
            .replace(/\n+/g, ' ')
            .trim()
            .slice(0, 100),
    })).reverse(); // newest first
};

export const getVersionContent = async (id, versionId) => {
    const doc = await Document.findById(id, { versions: 1 });
    if (!doc) return null;
    const version = doc.versions.find(v => v.versionId === versionId);
    if (!version) return null;
    return { yState: version.yState, data: version.data };
};

export const restoreVersion = async (id, versionId) => {
    const doc = await Document.findById(id, { versions: 1 });
    if (!doc) return null;
    const version = doc.versions.find(v => v.versionId === versionId);
    if (!version) return null;
    await Document.findByIdAndUpdate(id, {
        yState: version.yState,
        data: version.data,
    });
    return { yState: version.yState, data: version.data };
};

