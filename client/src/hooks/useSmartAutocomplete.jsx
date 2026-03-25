import { useEffect, useRef } from 'react';

export const useSmartAutocomplete = (quill, accessToken, onQuotaExceeded) => {
    const ghostTextRef = useRef('');
    const cursorIndexRef = useRef(0);
    const ghostNodeRef = useRef(null);
    const requestIdRef = useRef(0);
    const abortControllerRef = useRef(null);
    const onQuotaExceededRef = useRef(onQuotaExceeded);

    useEffect(() => {
        onQuotaExceededRef.current = onQuotaExceeded;
    }, [onQuotaExceeded]);

    useEffect(() => {
        if (!quill) return;

        let debounceTimer;

        const removeGhostNode = () => {
            if (ghostNodeRef.current && ghostNodeRef.current.parentNode) {
                ghostNodeRef.current.parentNode.removeChild(ghostNodeRef.current);
            }
        };

        const clearGhost = () => {
            ghostTextRef.current = '';
            removeGhostNode();
        };

        const abortInFlightRequest = () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };

        const handleTextChange = (delta, oldDelta, source) => {
            if (source !== 'user') return;

            clearTimeout(debounceTimer);
            clearGhost();
            abortInFlightRequest();

            debounceTimer = setTimeout(async () => {
                const selection = quill.getSelection();
                if (!selection) return;

                // Grab previous ~150 chars
                const start = Math.max(0, selection.index - 150);
                const prefix = quill.getText(start, selection.index - start);

                if (prefix.trim().length < 20) return;

                // Only trigger if the user just finished a word (last char is space or punctuation)
                const lastChar = prefix[prefix.length - 1];
                const wordBoundary = /[\s.,!?;:]/.test(lastChar);
                if (!wordBoundary) return;

                const requestId = ++requestIdRef.current;
                const requestSelectionIndex = selection.index;
                const controller = new AbortController();
                abortControllerRef.current = controller;

                try {
                    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:9000';
                    const res = await fetch(`${apiUrl}/api/ai/autocomplete`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({ prefix }),
                        signal: controller.signal,
                    });

                    if (res.status === 429) {
                        const data = await res.json().catch(() => ({}));
                        if (onQuotaExceededRef.current) {
                            onQuotaExceededRef.current(data.retryAfterSeconds, data.error);
                        }
                        clearGhost();
                        return; // Stop processing
                    }

                    if (!res.ok) {
                        clearGhost();
                        return;
                    }

                    const data = await res.json();

                    if (requestId !== requestIdRef.current) return;

                    // User might have moved the cursor while waiting
                    const currentSelection = quill.getSelection();
                    const rawSuggestion = data?.text?.trim();
                    const rawWords = rawSuggestion ? rawSuggestion.split(/\s+/).filter(Boolean).length : 0;
                    if (!rawSuggestion || rawWords < 1) {
                        clearGhost();
                        return;
                    }

                    const selectionMatches =
                        !currentSelection || currentSelection.index === requestSelectionIndex;

                    if (selectionMatches) {
                        const prevChar = requestSelectionIndex > 0
                            ? quill.getText(requestSelectionIndex - 1, 1)
                            : '';
                        const needsLeadingSpace = prevChar && prevChar.trim() !== '';
                        const suggestion = needsLeadingSpace ? ` ${rawSuggestion}` : rawSuggestion;

                        ghostTextRef.current = suggestion;
                        cursorIndexRef.current = requestSelectionIndex;

                        // Create ghost node once
                        if (!ghostNodeRef.current) {
                            const node = document.createElement('span');
                            node.className = 'ghost-text';
                            node.style.position = 'absolute';
                            node.style.zIndex = '10';
                            node.style.color = '#9ba1a6';
                            node.style.pointerEvents = 'none';
                            node.style.whiteSpace = 'nowrap';
                            node.style.overflow = 'hidden';
                            node.style.textOverflow = 'ellipsis';
                            ghostNodeRef.current = node;
                        }

                        const bounds = quill.getBounds(requestSelectionIndex);
                        const node = ghostNodeRef.current;

                        // Copy exact font styles from the Quill editor so text aligns perfectly
                        const editorStyle = window.getComputedStyle(quill.root);
                        node.style.fontFamily = editorStyle.fontFamily;
                        node.style.fontSize = editorStyle.fontSize;
                        node.style.fontWeight = editorStyle.fontWeight;
                        node.style.letterSpacing = editorStyle.letterSpacing;

                        node.innerText = suggestion;

                        // bounds from quill.getBounds() are already relative to quill.container
                        node.style.top = `${bounds.top}px`;
                        node.style.left = `${bounds.left + (bounds.width || 0)}px`;
                        node.style.height = `${bounds.height}px`;
                        node.style.lineHeight = `${bounds.height}px`;
                        const maxWidth = Math.max(40, quill.root.clientWidth - bounds.left - (bounds.width || 0) - 20);
                        node.style.maxWidth = `${maxWidth}px`;

                        // Attach directly inside the container (not a wrapper div)
                        if (!node.parentNode && quill.container) {
                            quill.container.appendChild(node);
                        }
                    }

                } catch (err) {
                    if (err.name === 'AbortError') return;
                    console.error('Autocomplete error', err);
                } finally {
                    if (abortControllerRef.current === controller) {
                        abortControllerRef.current = null;
                    }
                }
            }, 2000);
        };

        const handleSelectionChange = (range, oldRange) => {
            const moved =
                !range
                || !oldRange
                || range.index !== oldRange.index
                || range.length !== oldRange.length;
            if (moved) {
                clearGhost();
            }
        };

        quill.on('text-change', handleTextChange);
        quill.on('selection-change', handleSelectionChange);

        // Native DOM Keydown event attached during capture phase to intercept BEFORE Quill
        const handleKeyDown = (e) => {
            if (e.key === 'Tab' && ghostTextRef.current) {
                e.preventDefault(); // Stop default tab space/indent
                e.stopPropagation(); // Stop quill execution

                const textToInsert = ghostTextRef.current;
                const index = cursorIndexRef.current;

                clearGhost();

                quill.insertText(index, textToInsert, 'user');
                quill.setSelection(index + textToInsert.length);
            } else if (ghostTextRef.current && (e.key === 'Backspace' || e.key === 'Escape' || e.key.length === 1)) {
                // Immediately clear if user types any normal key
                clearGhost();
            }
        };

        quill.root.addEventListener('keydown', handleKeyDown, true);

        return () => {
            quill.off('text-change', handleTextChange);
            quill.off('selection-change', handleSelectionChange);
            quill.root.removeEventListener('keydown', handleKeyDown, true);
            clearTimeout(debounceTimer);
            clearGhost();
            abortInFlightRequest();
        };
    }, [quill, accessToken]);

    return {};
};
