import { GoogleGenAI } from '@google/genai';

const RATE_LIMIT_COOLDOWN_MS = Number(process.env.AI_RATE_LIMIT_COOLDOWN_MS || 60000);
let aiBlockedUntil = 0;

const getAiClient = () => {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is not defined in environment variables');
    }
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
};

// The @google/genai SDK can return text in multiple shapes depending on version.
// This helper robustly extracts the text string regardless.
const extractText = (response) => {
    if (!response) return '';
    // Shape 1: response.text is a function (older SDK)
    if (typeof response.text === 'function') return response.text();
    // Shape 2: response.text is a string
    if (typeof response.text === 'string') return response.text;
    // Shape 3: response.candidates[0].content.parts[0].text (new SDK)
    try {
        return response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    } catch {
        return '';
    }
};

const sanitizeAutocompleteText = (text) => {
    if (!text) return '';
    const cleaned = text
        .replace(/\s+/g, ' ')
        .replace(/^["'`]+|["'`]+$/g, '')
        .trim();

    const words = cleaned.split(' ').filter(Boolean).slice(0, 6);
    return words.join(' ');
};

const countWords = (text) => {
    if (!text) return 0;
    return text.split(/\s+/).filter(Boolean).length;
};

const buildAutocompletePrompt = (prefix) => {
    return `You are a smart autocomplete for a document editor. Complete the following text naturally.
Do not repeat the prefix. ONLY output the continuation text.
CRITICAL RULES:
- Output exactly one short continuation.
- Use 5 to 6 words maximum.
- Never output paragraphs, bullet points, labels, or quotes.
- No explanations, only raw continuation text.
- Never return an empty response.

Prefix: """${prefix}"""
Continuation:`;
};


const generateAutocompleteSuggestion = async (ai, prefix) => {
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: buildAutocompletePrompt(prefix),
        config: {
            temperature: 0.2,
            maxOutputTokens: 30,
        },
    });

    const text = extractText(response);
    console.log('[Autocomplete] Raw AI response:', JSON.stringify(text));
    const suggestion = sanitizeAutocompleteText(text);
    console.log('[Autocomplete] Sanitized:', JSON.stringify(suggestion));
    return countWords(suggestion) >= 1 ? suggestion : '';
};

const sanitizeGeneratedText = (text) => {
    if (!text) return '';

    const cleaned = text
        .replace(/\r\n/g, '\n')
        // Remove markdown heading markers like ## Title
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')
        // Remove markdown bullets like * item / - item / + item
        .replace(/^\s{0,3}[-*+]\s+/gm, '')
        // Remove numbered list markers like 1. item, 1) item, (1) item
        .replace(/^\s{0,3}\d+\.\s+/gm, '')
        .replace(/^\s{0,3}\d+\)\s+/gm, '')
        .replace(/^\s{0,3}\(\d+\)\s+/gm, '')
        .replace(/^\s{0,3}[a-zA-Z]\)\s+/gm, '')
        // Remove emphasis markers while preserving words
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/_(.*?)_/g, '$1')
        .replace(/[ \t]+\n/g, '\n')
        .trim();

    // Convert line-broken list-style output into clean prose-style paragraphs.
    const lines = cleaned.split('\n').map((line) => line.trim()).filter(Boolean);
    const normalized = lines.join('\n');

    return normalized.replace(/\n{3,}/g, '\n\n').trim();
};

const getRetryAfterSeconds = () => {
    const remainingMs = Math.max(0, aiBlockedUntil - Date.now());
    return Math.max(1, Math.ceil(remainingMs / 1000));
};

const isRateLimitError = (error) => {
    if (!error) return false;
    const message = String(error?.message || '').toLowerCase();
    const status = Number(error?.status || error?.statusCode || 0);
    return status === 429 || message.includes('rate limit') || message.includes('resource_exhausted') || message.includes('quota');
};

const respondRateLimited = (res, scope) => {
    const retryAfterSeconds = getRetryAfterSeconds();
    res.set('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
        error: `${scope} is temporarily rate limited. Please retry shortly.`,
        retryAfterSeconds,
    });
};

export const generateText = async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
        if (Date.now() < aiBlockedUntil) return respondRateLimited(res, 'AI generation');

        const generationPrompt = `You are "Help Me Write" inside a collaborative document editor.
Write a high-quality response to the user's request.
- You can generate as much content as needed unless the user asks for brevity.
- Keep the writing coherent, useful, and ready to paste into a document.
- Return only plain text (no labels or explanations).
- Do not use Markdown formatting.
- Never use headings like # or ##.
- Never use bullet markers like *, -, + or numbered list prefixes.
- Prefer natural paragraph prose instead of list formatting.

User request: """${prompt}"""`;

        const ai = getAiClient();
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: generationPrompt,
            config: {
                temperature: 0.8,
            },
        });

        // The @google/genai SDK often returns the text directly as a property or a method, this handles both.
        const text = extractText(response);
        res.status(200).json({ text: sanitizeGeneratedText(text) });
    } catch (error) {
        if (isRateLimitError(error)) {
            aiBlockedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
            console.log('AI Generate: Rate limit reached. Cooling down.');
            return respondRateLimited(res, 'AI generation');
        }
        console.error('AI Generate Error:', error);
        res.status(500).json({ error: 'Failed to generate text' });
    }
};

export const autocompleteText = async (req, res) => {
    try {
        const { prefix } = req.body;
        if (!prefix) return res.status(400).json({ error: 'Prefix is required' });
        if (Date.now() < aiBlockedUntil) return respondRateLimited(res, 'AI autocomplete');

        const ai = getAiClient();
        const text = await generateAutocompleteSuggestion(ai, prefix);
        res.status(200).json({ text });
    } catch (error) {
        if (isRateLimitError(error)) {
            aiBlockedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
            console.log('AI Autocomplete: Rate limit reached. Cooling down.');
            return respondRateLimited(res, 'AI autocomplete');
        }
        console.error('AI Autocomplete Error:', error);
        res.status(500).json({ error: 'Failed to autocomplete text' });
    }
};
