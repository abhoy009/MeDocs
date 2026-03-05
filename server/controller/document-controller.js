import Document from '../schema/documentSchema.js';

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
    return await Document.find(query, { _id: 1, title: 1, updatedAt: 1, owner: 1 }).sort({ updatedAt: -1 });
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
