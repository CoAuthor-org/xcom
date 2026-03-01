require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const llm = require('./llm');

const app = express();
const PORT = 3000;
const dataPath = path.join(__dirname, 'data.json');
const progressPath = path.join(__dirname, 'progress.json');
const notesDir = path.join(__dirname, 'notes');
const notesToTweetsPromptPath = path.join(__dirname, 'prompts', 'notes-to-tweets.prompt.txt');

// Segment by ## headers; process more chunks so whole file yields more tweets
const CHUNK_CHAR_LIMIT = 8000;
const MAX_CHUNKS_PER_REQUEST = 20;

const jobs = new Map();
function nextJobId() {
    return 'job_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

app.use(express.json());
app.use(express.static(__dirname));

const XAI_API_KEY = process.env.XAI_API_KEY || '';
const llmInitialized = llm.initializeLLM(XAI_API_KEY);

function loadNotesToTweetsPrompt() {
    try {
        if (fs.existsSync(notesToTweetsPromptPath)) {
            return fs.readFileSync(notesToTweetsPromptPath, 'utf8').trim();
        }
    } catch (e) {
        console.warn('Could not load notes-to-tweets prompt file:', e.message);
    }
    return null;
}

function getNotesFilePath(filename) {
    const base = path.basename(filename, path.extname(filename)) + '.md';
    const resolved = path.resolve(notesDir, base);
    const notesDirResolved = path.resolve(notesDir);
    if (!resolved.startsWith(notesDirResolved) || path.extname(resolved) !== '.md') {
        return null;
    }
    return resolved;
}

function chunkMarkdown(content) {
    const chunks = [];
    const sections = content.split(/(?=^##\s)/m);
    for (const section of sections) {
        const trimmed = section.trim();
        if (!trimmed) continue;
        if (trimmed.length <= CHUNK_CHAR_LIMIT) {
            chunks.push(trimmed);
        } else {
            for (let i = 0; i < trimmed.length; i += CHUNK_CHAR_LIMIT) {
                chunks.push(trimmed.slice(i, i + CHUNK_CHAR_LIMIT));
            }
        }
    }
    if (chunks.length === 0 && content.trim()) {
        for (let i = 0; i < content.length; i += CHUNK_CHAR_LIMIT) {
            chunks.push(content.slice(i, i + CHUNK_CHAR_LIMIT));
        }
    }
    return chunks.slice(0, MAX_CHUNKS_PER_REQUEST);
}

app.get('/notes/files', (req, res) => {
    if (!fs.existsSync(notesDir)) {
        return res.json({ files: [] });
    }
    const names = fs.readdirSync(notesDir)
        .filter(f => path.extname(f).toLowerCase() === '.md')
        .sort();
    res.json({ files: names });
});

app.get('/notes/content', (req, res) => {
    const file = req.query.file;
    if (!file) {
        return res.status(400).json({ error: 'file query required' });
    }
    const filePath = getNotesFilePath(file);
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    const content = fs.readFileSync(filePath, 'utf8');
    res.json({ content, filename: path.basename(filePath) });
});

function readData() {
    if (fs.existsSync(dataPath)) {
        try {
            const fileContent = fs.readFileSync(dataPath, 'utf8');
            if (fileContent.trim()) {
                return JSON.parse(fileContent);
            }
        } catch (e) {
            console.error('Error reading data.json:', e);
        }
    }
    return { entries: [] };
}

function writeData(data) {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
}

function readProgress() {
    if (fs.existsSync(progressPath)) {
        try {
            const raw = fs.readFileSync(progressPath, 'utf8');
            if (raw.trim()) return JSON.parse(raw);
        } catch (e) {}
    }
    return {};
}

function writeProgress(progress) {
    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

app.get('/entries', (req, res) => {
    const data = readData();
    res.json(data);
});

app.get('/llm/status', (req, res) => {
    res.json({ 
        initialized: llm.isInitialized(),
        message: llm.isInitialized() 
            ? 'LLM is ready' 
            : 'LLM not configured. Set XAI_API_KEY environment variable.'
    });
});

app.post('/save', (req, res) => {
    const { text } = req.body;
    
    if (!text || text.length > 280) {
        return res.status(400).json({ error: 'Text must be between 1 and 280 characters' });
    }
    
    const data = readData();
    
    data.entries.push({
        text: text,
        timestamp: new Date().toISOString()
    });
    
    writeData(data);
    
    res.json({ success: true, message: 'Text saved successfully' });
});

app.put('/entries/:index', (req, res) => {
    const index = parseInt(req.params.index, 10);
    const { text } = req.body;
    
    if (Number.isNaN(index) || index < 0) {
        return res.status(400).json({ error: 'Invalid entry index' });
    }
    if (!text || text.length > 280) {
        return res.status(400).json({ error: 'Text must be between 1 and 280 characters' });
    }
    
    const data = readData();
    if (index >= data.entries.length) {
        return res.status(404).json({ error: 'Entry not found' });
    }
    
    data.entries[index].text = text.slice(0, 280);
    data.entries[index].timestamp = new Date().toISOString();
    writeData(data);
    
    res.json({ success: true, message: 'Entry updated' });
});

app.delete('/entries/:index', (req, res) => {
    const index = parseInt(req.params.index, 10);
    
    if (Number.isNaN(index) || index < 0) {
        return res.status(400).json({ error: 'Invalid entry index' });
    }
    
    const data = readData();
    if (index >= data.entries.length) {
        return res.status(404).json({ error: 'Entry not found' });
    }
    
    data.entries.splice(index, 1);
    writeData(data);
    
    res.json({ success: true, message: 'Entry deleted' });
});

app.post('/generate-from-notes', (req, res) => {
    const { file } = req.body;
    if (!llm.isInitialized()) {
        return res.status(503).json({ error: 'LLM not configured. Set XAI_API_KEY.' });
    }
    if (!file) {
        return res.status(400).json({ error: 'file is required' });
    }
    const filePath = getNotesFilePath(file);
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    const content = fs.readFileSync(filePath, 'utf8');
    const chunks = chunkMarkdown(content);
    if (chunks.length === 0) {
        return res.json({ success: true, jobId: null, tweets: [], chunksProcessed: 0 });
    }

    const progress = readProgress();
    let startIndex = progress[file] != null ? Math.min(progress[file], chunks.length - 1) : 0;
    if (startIndex >= chunks.length) startIndex = 0;

    const jobId = nextJobId();
    const job = {
        file,
        status: 'running',
        logs: [],
        tweets: [],
        chunksProcessed: 0,
        savedCount: 0,
        usage: { promptTokens: 0, completionTokens: 0 },
        startIndex,
        totalChunks: chunks.length,
        error: null
    };
    jobs.set(jobId, job);

    const systemPrompt = loadNotesToTweetsPrompt();
    const addLog = (msg, kind) => {
        job.logs.push({ msg, kind: kind || 'msg' });
    };

    (async () => {
        try {
            addLog(`Starting: ${file}, ${chunks.length} segment(s). Resuming from segment ${startIndex + 1}.`);
            for (let i = startIndex; i < chunks.length; i++) {
                const chunk = chunks[i];
                addLog(`Segment ${i + 1}/${chunks.length} (${chunk.length} chars) → calling LLM...`);
                const result = await llm.notesToTweets(chunk, { systemPrompt });
                if (result.usage) {
                    job.usage.promptTokens += result.usage.promptTokens || 0;
                    job.usage.completionTokens += result.usage.completionTokens || 0;
                    addLog(`  tokens: prompt=${result.usage.promptTokens} completion=${result.usage.completionTokens}`);
                }
                const tweets = result.tweets || [];
                if (tweets.length === 0) {
                    addLog(`  no tweets from this segment`);
                } else {
                    addLog(`  got ${tweets.length} tweet(s)`);
                    for (const tw of tweets) {
                        const text = typeof tw === 'string' ? tw : tw.text;
                        const data = readData();
                        const safe = text.length > 280 ? (text.lastIndexOf(' ', 280) > 200 ? text.slice(0, text.lastIndexOf(' ', 280)).trim() : text.slice(0, 280)) : text;
                        const entry = { text: safe, timestamp: new Date().toISOString() };
                        if (tw.topicRef != null) entry.topicRef = tw.topicRef;
                        if (tw.part != null) entry.part = tw.part;
                        data.entries.push(entry);
                        writeData(data);
                        job.tweets.push(tw);
                        job.savedCount = job.tweets.length;
                        const preview = text.length > 60 ? text.slice(0, 57) + '...' : text;
                        addLog(`  saved tweet ${job.tweets.length}: "${preview}"`, 'ok');
                    }
                }
                job.chunksProcessed = i - startIndex + 1;
                const prog = readProgress();
                if (i < chunks.length - 1) {
                    prog[file] = i + 1;
                    writeProgress(prog);
                } else {
                    prog[file] = 0;
                    writeProgress(prog);
                    addLog(`Done. File fully processed. Total: ${job.tweets.length} tweets saved. Next run will start from top.`);
                }
            }
            job.status = 'done';
        } catch (error) {
            console.error('generate-from-notes:', error.message);
            job.status = 'error';
            job.error = error.message;
            addLog(`Error: ${error.message}`, 'err');
            const prog = readProgress();
            prog[file] = startIndex;
            writeProgress(prog);
        }
    })();

    res.json({ success: true, jobId });
});

app.get('/generate-from-notes/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    res.json({
        status: job.status,
        logs: job.logs,
        tweets: job.tweets,
        chunksProcessed: job.chunksProcessed,
        savedCount: job.savedCount,
        usage: job.usage,
        error: job.error,
        startIndex: job.startIndex,
        totalChunks: job.totalChunks
    });
});

app.post('/generate', async (req, res) => {
    const { prompt, action = 'generate' } = req.body;
    
    if (!llm.isInitialized()) {
        return res.status(503).json({ 
            error: 'LLM not configured. Set XAI_API_KEY environment variable to enable AI features.' 
        });
    }
    
    if (!prompt || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'Prompt is required' });
    }
    
    try {
        let result;
        
        switch (action) {
            case 'enhance':
                result = await llm.enhanceText(prompt);
                break;
            case 'summarize':
                result = await llm.summarizeText(prompt);
                break;
            case 'expand':
                result = await llm.expandText(prompt);
                break;
            case 'generate':
            default:
                result = await llm.generateText(prompt);
                break;
        }
        
        res.json(result);
    } catch (error) {
        console.error('Generate error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    if (llmInitialized) {
        console.log('Grok (xAI) LLM features enabled');
    } else {
        console.log('Grok (xAI) LLM features disabled (no API key)');
    }
});
