export const sanitizeGeneratedText = (text, { keepBullets = false } = {}) => {
    if (!text) return '';

    let result = text
        // Remove heading markers (##, ###, etc.)
        .replace(/^#{1,6}\s+/gm, '')
        // Remove bold/italic markdown (**text**, *text*, __text__, _text_)
        .replace(/(\*\*|__)(.*?)\1/g, '$2')
        .replace(/(\*|_)(.*?)\1/g, '$2')
        // Remove inline code backticks
        .replace(/`([^`]+)`/g, '$1')
        // Remove blockquotes
        .replace(/^>\s+/gm, '')
        // Remove horizontal rules
        .replace(/^(-{3,}|\*{3,}|_{3,})$/gm, '')
        // Collapse 3+ newlines into 2
        .replace(/\n{3,}/g, '\n\n');

    // Only strip bullet markers if bullets were NOT requested
    if (!keepBullets) {
        result = result.replace(/^[\*\-]\s+/gm, '');
    }

    return result.trim();
};