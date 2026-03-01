// Load .env from the project directory (where server.js lives) so it works regardless of cwd
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const llm = require('./llm');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB
const TWEET_IMAGES_BUCKET = 'tweet-images';

const app = express();
const PORT = 3000;
const dataPath = path.join(__dirname, 'data.json');
const progressPath = path.join(__dirname, 'progress.json');

function envVar(name) {
    const v = process.env[name];
    if (v == null || typeof v !== 'string') return '';
    return v.trim().replace(/^["']|["']$/g, '');
}
const supabaseUrl = envVar('SUPABASE_URL');
const supabaseServiceKey = envVar('SUPABASE_SERVICE_ROLE_KEY') || envVar('SUPABASE_SERVICE_KEY');
const supabase = (supabaseUrl && supabaseServiceKey)
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null;
const isProduction = process.env.NODE_ENV === 'production';

function supabaseStatus() {
    if (supabase) return { ok: true, url: supabaseUrl.replace(/^(https?:\/\/[^/]+).*/, '$1') };
    return {
        ok: false,
        reason: !supabaseUrl ? 'SUPABASE_URL is missing or empty' : 'SUPABASE_SERVICE_ROLE_KEY is missing or empty'
    };
}
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

app.post('/notes/progress/reset', async (req, res) => {
    const { file } = req.body;
    if (!file) {
        return res.status(400).json({ error: 'file is required' });
    }
    const filePath = getNotesFilePath(file);
    if (!filePath || !fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    try {
        await resetProgressForFile(file);
        res.json({ success: true, message: `Pointer reset for ${file}. Next run will start from the top.` });
    } catch (e) {
        console.error('notes/progress/reset:', e);
        res.status(500).json({ error: e.message || 'Failed to reset progress' });
    }
});

function rowToEntry(row) {
    return {
        id: row.id,
        text: row.text,
        timestamp: row.created_at,
        topicRef: row.topic_ref ?? undefined,
        part: row.part ?? undefined,
        imageUrl: row.image_url ?? undefined
    };
}

function requireSupabaseStorage(req, res) {
    if (isProduction && !supabase) {
        res.status(503).json({
            error: 'Storage not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in production.'
        });
        return true;
    }
    return false;
}

async function getEntries() {
    // When Supabase is configured it is the only source; no fallback to data.json
    if (supabase) {
        const { data, error } = await supabase
            .from('entries')
            .select('id, text, created_at, topic_ref, part, image_url')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(rowToEntry);
    }
    if (fs.existsSync(dataPath)) {
        try {
            const fileContent = fs.readFileSync(dataPath, 'utf8');
            if (fileContent.trim()) {
                const data = JSON.parse(fileContent);
                return (data.entries || []).map((e, i) => ({ id: String(i), ...e, imageUrl: e.imageUrl ?? undefined }));
            }
        } catch (e) {
            console.error('Error reading data.json:', e);
        }
    }
    return [];
}

async function insertEntry(entry) {
    if (supabase) {
        const { data, error } = await supabase
            .from('entries')
            .insert({
                text: entry.text,
                topic_ref: entry.topicRef ?? null,
                part: entry.part ?? null,
                image_url: entry.imageUrl ?? null
            })
            .select('id, text, created_at, topic_ref, part, image_url')
            .single();
        if (error) throw error;
        return rowToEntry(data);
    }
    const data = fs.existsSync(dataPath)
        ? JSON.parse(fs.readFileSync(dataPath, 'utf8'))
        : { entries: [] };
    const newEntry = { text: entry.text, timestamp: new Date().toISOString() };
    if (entry.topicRef != null) newEntry.topicRef = entry.topicRef;
    if (entry.part != null) newEntry.part = entry.part;
    data.entries.push(newEntry);
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return { id: String(data.entries.length - 1), ...newEntry };
}

async function updateEntryById(id, text) {
    if (supabase) {
        const { data, error } = await supabase
            .from('entries')
            .update({ text })
            .eq('id', id)
            .select('id, text, created_at, topic_ref, part, image_url')
            .single();
        if (error) throw error;
        return data ? rowToEntry(data) : null;
    }
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const index = parseInt(id, 10);
    if (Number.isNaN(index) || index < 0 || index >= data.entries.length) return null;
    data.entries[index].text = text;
    data.entries[index].timestamp = new Date().toISOString();
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return { id: String(index), ...data.entries[index] };
}

async function deleteEntryById(id) {
    if (supabase) {
        const { error } = await supabase.from('entries').delete().eq('id', id);
        if (error) throw error;
        return true;
    }
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const index = parseInt(id, 10);
    if (Number.isNaN(index) || index < 0 || index >= data.entries.length) return false;
    data.entries.splice(index, 1);
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return true;
}

async function deleteAllEntries() {
    if (supabase) {
        const { error } = await supabase.from('entries').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
        return true;
    }
    fs.writeFileSync(dataPath, JSON.stringify({ entries: [] }, null, 2));
    return true;
}


async function readProgress() {
    if (supabase) {
        const { data, error } = await supabase.from('note_progress').select('file_name, last_chunk_index');
        if (error) throw error;
        const out = {};
        (data || []).forEach(row => { out[row.file_name] = row.last_chunk_index; });
        return out;
    }
    if (fs.existsSync(progressPath)) {
        try {
            const raw = fs.readFileSync(progressPath, 'utf8');
            if (raw.trim()) return JSON.parse(raw);
        } catch (e) {}
    }
    return {};
}

async function writeProgress(progress) {
    if (supabase) {
        for (const [file_name, last_chunk_index] of Object.entries(progress)) {
            await supabase.from('note_progress').upsert({ file_name, last_chunk_index }, { onConflict: 'file_name' });
        }
        return;
    }
    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));
}

/** Reset the progress pointer for a notes file so the next run starts from the top (segment 0). */
async function resetProgressForFile(file) {
    const prog = await readProgress();
    prog[file] = 0;
    await writeProgress(prog);
}

function formatSupabaseError(e) {
    const msg = e.message || String(e);
    const details = e.details || e.hint || (e.code ? `code: ${e.code}` : '');
    return details ? `${msg} — ${details}` : msg;
}

app.get('/entries', async (req, res) => {
    if (requireSupabaseStorage(req, res)) return;
    try {
        const entries = await getEntries();
        res.json({ entries });
    } catch (e) {
        const errMsg = formatSupabaseError(e);
        console.error('GET /entries:', errMsg);
        res.status(500).json({ error: errMsg });
    }
});

app.get('/llm/status', (req, res) => {
    res.json({ 
        initialized: llm.isInitialized(),
        message: llm.isInitialized() 
            ? 'LLM is ready' 
            : 'LLM not configured. Set XAI_API_KEY environment variable.'
    });
});

app.get('/api/storage-status', (req, res) => {
    const s = supabaseStatus();
    res.json({ storage: s.ok ? 'supabase' : 'local', reason: s.reason || null, url: s.url || null });
});

app.post('/save', async (req, res) => {
    if (requireSupabaseStorage(req, res)) return;
    const { text } = req.body;
    if (!text || text.length > 280) {
        return res.status(400).json({ error: 'Text must be between 1 and 280 characters' });
    }
    try {
        const entry = await insertEntry({ text });
        res.json({ success: true, message: 'Text saved successfully', entry });
    } catch (e) {
        const errMsg = formatSupabaseError(e);
        console.error('POST /save:', errMsg);
        res.status(500).json({ error: errMsg });
    }
});

app.put('/entries/:id', async (req, res) => {
    if (requireSupabaseStorage(req, res)) return;
    const id = req.params.id;
    const { text } = req.body;
    if (!id) return res.status(400).json({ error: 'Invalid entry id' });
    if (!text || text.length > 280) {
        return res.status(400).json({ error: 'Text must be between 1 and 280 characters' });
    }
    try {
        const entry = await updateEntryById(id, text.slice(0, 280));
        if (!entry) return res.status(404).json({ error: 'Entry not found' });
        res.json({ success: true, message: 'Entry updated', entry });
    } catch (e) {
        const errMsg = formatSupabaseError(e);
        console.error('PUT /entries/:id:', errMsg);
        res.status(500).json({ error: errMsg });
    }
});

app.delete('/entries/all', async (req, res) => {
    if (requireSupabaseStorage(req, res)) return;
    try {
        await deleteAllEntries();
        res.json({ success: true, message: 'All entries deleted' });
    } catch (e) {
        const errMsg = formatSupabaseError(e);
        console.error('DELETE /entries/all:', errMsg);
        res.status(500).json({ error: errMsg });
    }
});

app.delete('/entries/:id', async (req, res) => {
    if (requireSupabaseStorage(req, res)) return;
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Invalid entry id' });
    try {
        const ok = await deleteEntryById(id);
        if (!ok) return res.status(404).json({ error: 'Entry not found' });
        res.json({ success: true, message: 'Entry deleted' });
    } catch (e) {
        const errMsg = formatSupabaseError(e);
        console.error('DELETE /entries/:id:', errMsg);
        res.status(500).json({ error: errMsg });
    }
});

app.post('/entries/:id/image', (req, res, next) => {
    if (requireSupabaseStorage(req, res)) return;
    next();
}, upload.single('image'), async (req, res) => {
    if (res.headersSent) return;
    if (!supabase) return res.status(503).json({ error: 'Image upload requires Supabase.' });
    const id = req.params.id;
    const file = req.file;
    if (!id) return res.status(400).json({ error: 'Invalid entry id' });
    if (!file || !file.buffer) return res.status(400).json({ error: 'No image file uploaded. Use form field name "image".' });
    const ext = path.extname(file.originalname || '') || (file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg');
    const storagePath = `${id}/image${ext}`;
    try {
        const { error: uploadError } = await supabase.storage
            .from(TWEET_IMAGES_BUCKET)
            .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from(TWEET_IMAGES_BUCKET).getPublicUrl(storagePath);
        const { error: updateError } = await supabase.from('entries').update({ image_url: publicUrl }).eq('id', id);
        if (updateError) throw updateError;
        res.json({ success: true, imageUrl: publicUrl });
    } catch (e) {
        const errMsg = formatSupabaseError(e);
        console.error('POST /entries/:id/image:', errMsg);
        res.status(500).json({ error: errMsg });
    }
});

app.delete('/entries/:id/image', (req, res, next) => {
    if (requireSupabaseStorage(req, res)) return;
    next();
}, async (req, res) => {
    if (res.headersSent) return;
    if (!supabase) return res.status(503).json({ error: 'Image removal requires Supabase.' });
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'Invalid entry id' });
    try {
        const { data: entry } = await supabase.from('entries').select('image_url').eq('id', id).single();
        if (!entry) return res.status(404).json({ error: 'Entry not found' });
        if (entry.image_url) {
            const match = entry.image_url.match(/\/tweet-images\/(.+)$/);
            if (match && match[1]) {
                await supabase.storage.from(TWEET_IMAGES_BUCKET).remove([decodeURIComponent(match[1])]);
            }
        }
        const { error: updateError } = await supabase.from('entries').update({ image_url: null }).eq('id', id);
        if (updateError) throw updateError;
        res.json({ success: true, message: 'Image removed' });
    } catch (e) {
        const errMsg = formatSupabaseError(e);
        console.error('DELETE /entries/:id/image:', errMsg);
        res.status(500).json({ error: errMsg });
    }
});

app.post('/generate-from-notes', async (req, res) => {
    if (requireSupabaseStorage(req, res)) return;
    const { file, postsCount: requestedCount } = req.body;
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

    const postsCount = Math.min(50, Math.max(1, parseInt(requestedCount, 10) || 10));
    const progress = await readProgress();
    let startIndex = progress[file] != null ? Math.min(progress[file], chunks.length - 1) : 0;
    if (startIndex >= chunks.length) startIndex = 0;

    const jobId = nextJobId();
    const job = {
        file,
        status: 'running',
        logs: [],
        tweets: [],
        runsDone: 0,
        savedCount: 0,
        usage: { promptTokens: 0, completionTokens: 0 },
        startIndex,
        totalChunks: chunks.length,
        postsCount,
        error: null
    };
    jobs.set(jobId, job);

    const systemPrompt = loadNotesToTweetsPrompt();
    const addLog = (msg, kind) => {
        job.logs.push({ msg, kind: kind || 'msg' });
    };

    (async () => {
        try {
            addLog(`Starting: ${file}. Generating ${postsCount} post(s), 1 per LLM run. ${chunks.length} segment(s) for context.`);
            for (let run = 0; run < postsCount; run++) {
                const chunkIndex = (startIndex + run) % chunks.length;
                const chunk = chunks[chunkIndex];
                addLog(`Run ${run + 1}/${postsCount} (segment ${chunkIndex + 1}/${chunks.length}, ${chunk.length} chars) → LLM (1 post)...`);
                const result = await llm.notesToTweets(chunk, { systemPrompt, onePostOnly: true });
                if (result.usage) {
                    job.usage.promptTokens += result.usage.promptTokens || 0;
                    job.usage.completionTokens += result.usage.completionTokens || 0;
                    addLog(`  tokens: prompt=${result.usage.promptTokens} completion=${result.usage.completionTokens}`);
                }
                const tweets = result.tweets || [];
                const tw = tweets[0];
                if (!tw) {
                    addLog(`  no post from this run`, 'err');
                } else {
                    let text = typeof tw === 'string' ? tw : tw.text;
                    if (llm.stripAttachPlaceholders) text = llm.stripAttachPlaceholders(text);
                    const safe = llm.trimToTweetLength ? llm.trimToTweetLength(text) : (text.length <= 280 ? text : text.slice(0, 280));
                    const entryPayload = { text: safe };
                    if (tw.topicRef != null) entryPayload.topicRef = tw.topicRef;
                    if (tw.part != null) entryPayload.part = tw.part;
                    const saved = await insertEntry(entryPayload);
                    job.tweets.push(saved);
                    job.savedCount = job.tweets.length;
                    const preview = text.length > 60 ? text.slice(0, 57) + '...' : text;
                    addLog(`  saved post ${job.tweets.length}: "${preview}"`, 'ok');
                }
                job.runsDone = run + 1;
            }
            const prog = await readProgress();
            prog[file] = (startIndex + postsCount) % chunks.length;
            await writeProgress(prog);
            addLog(`Done. Generated ${job.savedCount} post(s) in ${postsCount} run(s).`);
            job.status = 'done';
        } catch (error) {
            console.error('generate-from-notes:', error.message);
            job.status = 'error';
            job.error = error.message;
            addLog(`Error: ${error.message}`, 'err');
            const prog = await readProgress();
            prog[file] = startIndex;
            await writeProgress(prog);
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
        runsDone: job.runsDone,
        postsCount: job.postsCount,
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
    const storage = supabaseStatus();
    if (storage.ok) {
        console.log('Storage: Supabase at', storage.url);
    } else {
        console.warn('Storage: local files (data.json, progress.json) —', storage.reason);
        if (isProduction) {
            console.error('ERROR: Supabase is required in production. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
        }
    }
    if (llmInitialized) {
        console.log('Grok (xAI) LLM features enabled');
    } else {
        console.log('Grok (xAI) LLM features disabled (no API key)');
    }
});
