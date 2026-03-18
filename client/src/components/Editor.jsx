import { useEffect, useRef, useState } from 'react';
import Quill from 'quill';
import QuillCursors from 'quill-cursors';
import 'quill/dist/quill.snow.css';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toolbarOptions } from '../config/quillConfig';
import { useSocket } from '../hooks/useSocket';
import { useYjsSync } from '../hooks/useYjsSync';
import { useDocTitle } from '../hooks/useDocTitle';
import Navbar from './Navbar';

Quill.register('modules/cursors', QuillCursors);

const Editor = () => {
    const { accessToken, user } = useAuth();
    const { id } = useParams();
    const [quill, setQuill] = useState(null);
    const containerRef = useRef(null);
    const quillRef = useRef(null);

    const { socket, socketRef } = useSocket(accessToken);

    const { saveStatus, docTitle, docOwner, setDocTitle, yDocRef } = useYjsSync({
        socket, quill, documentId: id, user,
    });

    const { handleSetDocTitle } = useDocTitle({
        socket, socketRef, docTitle, setDocTitle,
    });

    useEffect(() => {
        if (quillRef.current) return;
        const container = containerRef.current;
        if (!container) return;

        const editorDiv = document.createElement('div');
        editorDiv.id = 'quill-editor';
        container.appendChild(editorDiv);

        const q = new Quill(editorDiv, {
            theme: 'snow',
            modules: {
                toolbar: toolbarOptions,
                cursors: { transformOnTextChange: true },
                history: { maxStack: 0 },
            },
            placeholder: 'Start typing your document…',
        });
        q.disable();
        quillRef.current = q;
        setQuill(q);

        return () => {
            quillRef.current = null;
            container.innerHTML = '';
        };
    }, []);

    return (
        <div className="editor-root">
            <Navbar
                saveStatus={saveStatus}
                docTitle={docTitle}
                setDocTitle={handleSetDocTitle}
                quill={quill}
                docId={id}
                docOwner={docOwner}
                currentUserId={user?.id}
                accessToken={accessToken}
                yDocRef={yDocRef}
                socket={socket}
            />
            <div className="editor-wrapper">
                <div ref={containerRef} />
            </div>
        </div>
    );
};

export default Editor;
