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
            required: true
        }
    },
    { timestamps: true }
);

const Document = mongoose.model('document', documentSchema);

export default Document;