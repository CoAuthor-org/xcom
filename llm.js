// xAI Grok API is OpenAI-compatible: same SDK, baseURL + apiKey
const OpenAI = require('openai');

const XAI_BASE_URL = 'https://api.x.ai/v1';

let client = null;

function initializeLLM(apiKey) {
    if (!apiKey) {
        console.warn('xAI API key not provided. LLM features will be disabled.');
        return false;
    }
    
    try {
        client = new OpenAI({
            apiKey: apiKey,
            baseURL: XAI_BASE_URL
        });
        console.log('Grok (xAI) client initialized successfully');
        return true;
    } catch (error) {
        console.error('Failed to initialize xAI client:', error.message);
        return false;
    }
}

function isInitialized() {
    return client !== null;
}

// Default model: grok-3-mini (economical); use grok-3 for heavier tasks if needed
const DEFAULT_MODEL = 'grok-3-mini';

async function generateText(prompt, options = {}) {
    if (!client) {
        throw new Error('Grok client not initialized. Please set XAI_API_KEY environment variable.');
    }
    
    const {
        model = DEFAULT_MODEL,
        maxTokens = 280,
        temperature = 0.7,
        systemPrompt = 'You are a helpful assistant that generates concise, engaging text. Keep responses under 280 characters.'
    } = options;
    
    try {
        const completion = await client.chat.completions.create({
            model: model,
            max_tokens: maxTokens,
            temperature: temperature,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ]
        });
        
        const generatedText = completion.choices[0]?.message?.content || '';
        
        return {
            success: true,
            text: generatedText.trim(),
            usage: {
                promptTokens: completion.usage?.prompt_tokens,
                completionTokens: completion.usage?.completion_tokens,
                totalTokens: completion.usage?.total_tokens
            }
        };
    } catch (error) {
        console.error('xAI API error:', error.message);
        
        if (error.status === 401) {
            throw new Error('Invalid API key. Please check your XAI_API_KEY.');
        } else if (error.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
        } else if (error.status === 500) {
            throw new Error('xAI service error. Please try again later.');
        }
        
        throw new Error(`Failed to generate text: ${error.message}`);
    }
}

async function enhanceText(text, instruction = 'Improve this text while keeping the same meaning') {
    return generateText(`${instruction}:\n\n"${text}"`, {
        systemPrompt: 'You are a text editor. Improve the given text based on the instruction. Output only the improved text, nothing else. Keep it under 280 characters.'
    });
}

async function summarizeText(text) {
    return generateText(`Summarize this text in under 280 characters:\n\n"${text}"`, {
        systemPrompt: 'You are a summarizer. Create a concise summary under 280 characters. Output only the summary.'
    });
}

async function expandText(text) {
    return generateText(`Expand on this idea while keeping under 280 characters:\n\n"${text}"`, {
        systemPrompt: 'You are a creative writer. Expand on the given idea but keep the result under 280 characters. Output only the expanded text.'
    });
}

// RAG: notes → tweets (grok-3-mini for cost efficiency)
const RAG_MODEL = 'grok-3-mini';
const RAG_MAX_OUTPUT_TOKENS = 3000;  // when multiple tweets allowed
const RAG_SINGLE_POST_MAX_TOKENS = 400;  // one post per run
const RAG_TEMPERATURE = 0.4;

const DEFAULT_NOTES_TO_TWEETS_PROMPT = 'Convert the notes below into x.com-style posts. Each post ≤280 chars. Output only the posts, one per line. No numbering or labels.';
const ONE_POST_INSTRUCTION = '\n\nOutput exactly ONE post only. No second post, no "Post 2", no numbering. Your post MUST be 280 characters or fewer. Complete the full sentence within that limit—never output a cut-off or incomplete sentence. Nothing else.';

/** Remove [Attach: ...] placeholders from tweet text; these are handled by per-tweet image upload in the app. */
function stripAttachPlaceholders(s) {
    if (!s || typeof s !== 'string') return s;
    return s.replace(/\s*\[\s*Attach\s*:\s*[^\]]*\]\s*/gi, ' ').replace(/\s+/g, ' ').trim();
}

/** Trim to tweet length at a sentence or word boundary; never cut mid-word or mid-sentence. */
function trimToLimit(s, limit = 280) {
    if (!s || s.length <= limit) return s;
    const inRange = s.slice(0, limit + 1);
    const minSentenceLen = 80;
    const lastSentenceEnd = Math.max(
        inRange.lastIndexOf('.'),
        inRange.lastIndexOf('?'),
        inRange.lastIndexOf('!')
    );
    if (lastSentenceEnd >= minSentenceLen) return s.slice(0, lastSentenceEnd + 1).trim();
    const lastSpace = inRange.lastIndexOf(' ');
    if (lastSpace >= 0) return s.slice(0, lastSpace).trim();
    return s.slice(0, limit).trim();
}

function parseNotesToTweetsOutput(raw) {
    const tweets = [];
    const lines = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    for (const line of lines) {
        const post1Match = line.match(/^Post\s*1\s*(\[[^\]]+\])?\s*:\s*(.*)/i);
        const post2Match = line.match(/^Post\s*2\s*(\[[^\]]+\])?\s*:\s*(.*)/i);
        const topicFrom = (m) => (m && m[1] ? m[1].replace(/^\[|\]$/g, '').trim() : null);
        let text;
        let topicRef = null;
        let part = null;
        if (post1Match) {
            text = trimToLimit(stripAttachPlaceholders(post1Match[2].trim()));
            topicRef = topicFrom(post1Match);
            part = 1;
        } else if (post2Match) {
            text = trimToLimit(stripAttachPlaceholders(post2Match[2].trim()));
            topicRef = topicFrom(post2Match);
            part = 2;
        } else {
            text = trimToLimit(stripAttachPlaceholders(line));
        }
        if (text.length > 0) {
            const looksLikeHeading = text.length < 80 && !text.includes('?') && !text.includes('#') && !text.includes('.');
            if (looksLikeHeading) continue;
            tweets.push(topicRef != null || part != null ? { text, topicRef, part } : { text });
        }
    }
    return tweets;
}

async function notesToTweets(chunkText, options = {}) {
    if (!client) {
        throw new Error('Grok client not initialized. Set XAI_API_KEY.');
    }
    let systemPrompt = (options.systemPrompt && options.systemPrompt.trim()) || DEFAULT_NOTES_TO_TWEETS_PROMPT;
    const onePostOnly = options.onePostOnly === true;
    if (onePostOnly) {
        systemPrompt = systemPrompt + ONE_POST_INSTRUCTION;
    }
    const userContent = chunkText;
    try {
        const completion = await client.chat.completions.create({
            model: RAG_MODEL,
            max_tokens: onePostOnly ? RAG_SINGLE_POST_MAX_TOKENS : RAG_MAX_OUTPUT_TOKENS,
            temperature: RAG_TEMPERATURE,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ]
        });
        const raw = completion.choices[0]?.message?.content || '';
        let tweets = parseNotesToTweetsOutput(raw);
        if (onePostOnly && tweets.length > 1) {
            tweets = [tweets[0]];
        }
        return {
            success: true,
            tweets,
            usage: completion.usage ? {
                promptTokens: completion.usage.prompt_tokens,
                completionTokens: completion.usage.completion_tokens,
                totalTokens: completion.usage.total_tokens
            } : null
        };
    } catch (error) {
        if (error.status === 401) throw new Error('Invalid API key.');
        if (error.status === 429) throw new Error('Rate limit exceeded.');
        throw new Error(`RAG failed: ${error.message}`);
    }
}

module.exports = {
    initializeLLM,
    isInitialized,
    generateText,
    enhanceText,
    summarizeText,
    expandText,
    notesToTweets,
    trimToTweetLength: trimToLimit,
    stripAttachPlaceholders
};
