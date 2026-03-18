import mongoose from 'mongoose';

const versionSchema = new mongoose.Schema({
    versionId: { type: String, required: true },
    label:     { type: String, default: 'Snapshot' },
    authorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'user', default: null },
    createdAt: { type: Date, default: Date.now },
    yState:    { type: Buffer, default: null },
    data:      { type: Object, default: { ops: [] } },   // Quill delta for preview
}, { _id: false });

const documentSchema = mongoose.Schema(
    {
        _id: {
            type: String,
            required: true
        },
        title: {
            type: String,
            default: 'Untitled document'
        },
        data: {
            type: Object,
            default: { ops: [] }
        },
        yState: {
            type: Buffer,
            default: null
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'user',
            default: null
        },
        versions: {
            type: [versionSchema],
            default: [],
        },
    },
    { timestamps: true }
);

const Document = mongoose.model('document', documentSchema);
export default Document;