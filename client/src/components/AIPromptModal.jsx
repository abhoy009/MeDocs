import React, { useState } from 'react';
import './AIPromptModal.css';

const AIPromptModal = ({ isOpen, onClose, onSubmit, isGenerating }) => {
    const [prompt, setPrompt] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (prompt.trim()) {
            onSubmit(prompt);
            setPrompt('');
        }
    };

    return (
        <div className="ai-prompt-overlay" onClick={onClose}>
            <div className="ai-prompt-modal" onClick={e => e.stopPropagation()}>
                <div className="ai-prompt-header">
                    <h3>✨ Help me write</h3>
                    <button type="button" onClick={onClose} className="close-btn">&times;</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        value={prompt} 
                        onChange={e => setPrompt(e.target.value)} 
                        placeholder="Write a professional intro..."
                        autoFocus
                        disabled={isGenerating}
                    />
                    <button type="submit" disabled={isGenerating || !prompt.trim()}>
                        {isGenerating ? '...' : 'Create'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AIPromptModal;
