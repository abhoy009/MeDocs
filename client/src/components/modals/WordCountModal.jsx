import Modal from '../Modal';

const WordCountModal = ({ quill, onClose }) => {
    const text = quill ? quill.getText() : '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length > 0 ? text.length - 1 : 0;
    const lines = text.split('\n').filter(l => l.trim()).length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length;

    return (
        <Modal title="Word Count" onClose={onClose}>
            <div className="modal-stat-grid">
                <div className="modal-stat">
                    <span className="modal-stat-value">{words.toLocaleString()}</span>
                    <div className="modal-stat-label">Words</div>
                </div>
                <div className="modal-stat">
                    <span className="modal-stat-value">{chars.toLocaleString()}</span>
                    <div className="modal-stat-label">Characters</div>
                </div>
                <div className="modal-stat">
                    <span className="modal-stat-value">{lines.toLocaleString()}</span>
                    <div className="modal-stat-label">Lines</div>
                </div>
                <div className="modal-stat">
                    <span className="modal-stat-value">{paragraphs.toLocaleString()}</span>
                    <div className="modal-stat-label">Paragraphs</div>
                </div>
            </div>
        </Modal>
    );
};

export default WordCountModal;
