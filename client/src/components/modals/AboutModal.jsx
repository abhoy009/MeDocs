import Modal from '../Modal';

const AboutModal = ({ onClose }) => (
    <Modal title="About MeDocs" onClose={onClose}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>MeDocs</h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
                A real-time collaborative document editor.<br />
                Built with React, Quill, Socket.IO, and MongoDB.
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Version 1.0.0</p>
        </div>
    </Modal>
);

export default AboutModal;
