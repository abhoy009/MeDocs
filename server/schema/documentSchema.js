import mongoose from 'mongoose';

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
        }
    },
    { timestamps: true }
);

const Document = mongoose.model('document', documentSchema);
export default Document;