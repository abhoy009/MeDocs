import Modal from '../Modal';

const SHORTCUTS = [
    ['Bold', '⌘ B'],
    ['Italic', '⌘ I'],
    ['Underline', '⌘ U'],
    ['Undo', '⌘ Z'],
    ['Redo', '⌘ ⇧ Z'],
    ['Select All', '⌘ A'],
    ['Find & Replace', '⌘ H'],
    ['Print', '⌘ P'],
    ['Save (auto)', 'Every 5s'],
];

const ShortcutsModal = ({ onClose }) => (
    <Modal title="Keyboard Shortcuts" onClose={onClose}>
        <table className="modal-table">
            <thead><tr><th>Action</th><th>Shortcut</th></tr></thead>
            <tbody>
                {SHORTCUTS.map(([action, sc]) => (
                    <tr key={action}>
                        <td>{action}</td>
                        <td><span className="modal-shortcut-key">{sc}</span></td>
                    </tr>
                ))}
            </tbody>
        </table>
    </Modal>
);

export default ShortcutsModal;
