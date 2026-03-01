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
const RAG_MAX_OUTPUT_TOKENS = 3000;  // allow more tweets per segment (prompt can ask for 1–2 or many)
const RAG_TEMPERATURE = 0.4;

const DEFAULT_NOTES_TO_TWEETS_PROMPT = 'Convert the notes below into x.com-style posts. Each post ≤280 chars. Output only the posts, one per line. No numbering or labels.';

function trimToLimit(s, limit = 280) {
    if (s.length <= limit) return s;
    const lastSpace = s.lastIndexOf(' ', limit);
    if (lastSpace > limit * 0.7) return s.slice(0, lastSpace).trim();
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
            text = trimToLimit(post1Match[2].trim());
            topicRef = topicFrom(post1Match);
            part = 1;
        } else if (post2Match) {
            text = trimToLimit(post2Match[2].trim());
            topicRef = topicFrom(post2Match);
            part = 2;
        } else {
            text = trimToLimit(line);
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
    const systemPrompt = (options.systemPrompt && options.systemPrompt.trim()) || DEFAULT_NOTES_TO_TWEETS_PROMPT;
    const userContent = chunkText;
    try {
        const completion = await client.chat.completions.create({
            model: RAG_MODEL,
            max_tokens: RAG_MAX_OUTPUT_TOKENS,
            temperature: RAG_TEMPERATURE,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent }
            ]
        });
        const raw = completion.choices[0]?.message?.content || '';
        const tweets = parseNotesToTweetsOutput(raw);
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
    notesToTweets
};
