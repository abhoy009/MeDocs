import { useState } from 'react';
import Modal from '../Modal';

const FindReplaceModal = ({ quill, onClose }) => {
    const [find, setFind] = useState('');
    const [replace, setReplace] = useState('');
    const [msg, setMsg] = useState('');

    const doFind = () => {
        if (!quill || !find) return;
        const text = quill.getText();
        const idx = text.indexOf(find);
        if (idx === -1) { setMsg('Not found.'); return; }
        quill.setSelection(idx, find.length);
        setMsg(`Found at position ${idx}`);
    };

    const doReplace = () => {
        if (!quill || !find) return;
        const text = quill.getText();
        let count = 0;
        let idx = text.indexOf(find);
        while (idx !== -1) {
            quill.deleteText(idx, find.length);
            quill.insertText(idx, replace);
            count++;
            idx = quill.getText().indexOf(find, idx + replace.length);
        }
        setMsg(count > 0 ? `Replaced ${count} occurrence(s).` : 'Not found.');
    };

    return (
        <Modal title="Find & Replace" onClose={onClose} footer={
            <>
                <button className="modal-btn modal-btn-secondary" onClick={doFind}>Find</button>
                <button className="modal-btn modal-btn-primary" onClick={doReplace}>Replace All</button>
            </>
        }>
            <div className="modal-field">
                <label className="modal-label">Find</label>
                <input className="modal-input" value={find} onChange={e => setFind(e.target.value)} placeholder="Search text…" />
            </div>
            <div className="modal-field">
                <label className="modal-label">Replace with</label>
                <input className="modal-input" value={replace} onChange={e => setReplace(e.target.value)} placeholder="Replacement text…" />
            </div>
            <div className="modal-find-results">{msg}</div>
        </Modal>
    );
};

export default FindReplaceModal;
