/**
 * Cron job: post the next queued entry or thread for the current slot (8am, 12pm, 4pm, or 8pm queue) to X.
 * Run at 02:30, 06:30, 10:30, 14:30 UTC (= 8am, 12pm, 4pm, 8pm IST).
 * Threads are posted as a single X thread (tweetThread). Standalone posts as single tweets.
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, X API OAuth 1.0a credentials.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const { TwitterApi } = require('twitter-api-v2');

function env(name) {
  const v = process.env[name];
  if (v == null || typeof v !== 'string') return '';
  return v.trim().replace(/^["']|["']$/g, '');
}

const SLOTS = ['8am', '12pm', '4pm', '8pm'];

/** Determine which queue to run: 8am, 12pm, 4pm, or 8pm (IST). Uses SCHEDULE_QUEUE if set, else infers from UTC (02:30, 06:30, 10:30, 14:30 UTC). */
function getScheduleSlot() {
  const forced = env('SCHEDULE_QUEUE').toLowerCase();
  if (SLOTS.includes(forced)) return forced;
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  // Allow a small window around :30 so a minute or two drift still picks the right slot
  if (utcHour === 2 && utcMin >= 25 && utcMin <= 40) return '8am';
  if (utcHour === 6 && utcMin >= 25 && utcMin <= 40) return '12pm';
  if (utcHour === 10 && utcMin >= 25 && utcMin <= 40) return '4pm';
  if (utcHour === 14 && utcMin >= 25 && utcMin <= 40) return '8pm';
  // Default for manual runs or drift: infer from nearest run
  if (utcHour < 4) return '8am';
  if (utcHour < 8) return '12pm';
  if (utcHour < 12) return '4pm';
  if (utcHour < 16) return '8pm';
  return '8am';
}

const supabaseUrl = env('SUPABASE_URL');
const supabaseServiceKey = env('SUPABASE_SERVICE_ROLE_KEY') || env('SUPABASE_SERVICE_KEY');
const xApiKey = env('X_API_KEY');
const xApiSecret = env('X_API_SECRET');
const xAccessToken = env('X_ACCESS_TOKEN');
const xAccessSecret = env('X_ACCESS_TOKEN_SECRET');

async function main() {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  if (!xApiKey || !xApiSecret || !xAccessToken || !xAccessSecret) {
    console.error('Missing X API credentials');
    process.exit(1);
  }

  const slot = getScheduleSlot();
  console.log('Schedule slot:', slot);

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 1. Try to find next thread (thread_id not null)
  const { data: threadEntries, error: threadError } = await supabase
    .from('entries')
    .select('id, text, image_url, thread_id, thread_index, created_at')
    .eq('queue', slot)
    .is('posted_at', null)
    .not('thread_id', 'is', null)
    .order('created_at', { ascending: true });

  if (threadError) {
    console.error('Supabase fetch error:', threadError.message);
    process.exit(1);
  }

  let isThread = false;
  let entriesToPost = [];

  if (threadEntries && threadEntries.length > 0) {
    // Group by thread_id, pick earliest thread
    const byThread = {};
    for (const e of threadEntries) {
      const tid = e.thread_id;
      if (!byThread[tid]) byThread[tid] = [];
      byThread[tid].push(e);
    }
    const threadIds = Object.keys(byThread);
    let earliestThreadId = threadIds[0];
    let earliestCreated = byThread[earliestThreadId][0]?.created_at;
    for (const tid of threadIds) {
      const first = byThread[tid][0];
      if (first && first.created_at < earliestCreated) {
        earliestCreated = first.created_at;
        earliestThreadId = tid;
      }
    }
    const threadPosts = byThread[earliestThreadId]
      .sort((a, b) => (a.thread_index ?? 0) - (b.thread_index ?? 0));
    if (threadPosts.length >= 1) {
      isThread = threadPosts.length > 1;
      entriesToPost = threadPosts;
    }
  }

  // 2. If no thread, get single standalone post (include poll fields for poll tweets)
  if (entriesToPost.length === 0) {
    const { data: singleEntries, error: singleError } = await supabase
      .from('entries')
      .select('id, text, image_url, poll_options, poll_duration_minutes')
      .eq('queue', slot)
      .is('posted_at', null)
      .is('thread_id', null)
      .order('created_at', { ascending: true })
      .limit(1);

    if (singleError) {
      console.error('Supabase fetch error:', singleError.message);
      process.exit(1);
    }
    if (!singleEntries || singleEntries.length === 0) {
      console.log(`No queued entries for ${slot}.`);
      process.exit(0);
    }
    entriesToPost = singleEntries;
  }

  const client = new TwitterApi({
    appKey: xApiKey,
    appSecret: xApiSecret,
    accessToken: xAccessToken,
    accessSecret: xAccessSecret,
  });
  const rw = client.readWrite;

  if (isThread && entriesToPost.length > 1) {
    // Post as thread using tweetThread
    const threadItems = [];
    for (const entry of entriesToPost) {
      const text = (entry.text || '').trim();
      if (text.length > 280) {
        console.warn('Entry over 280 chars (loose check, will attempt post). Id:', entry.id, 'length:', text.length);
      }
      let mediaIds = [];
      if (entry.image_url) {
        try {
          const response = await fetch(entry.image_url);
          if (!response.ok) throw new Error(`Image fetch ${response.status}`);
          const buffer = Buffer.from(await response.arrayBuffer());
          const mediaId = await rw.v1.uploadMedia(buffer, { mimeType: 'image/jpeg' });
          mediaIds = [mediaId];
        } catch (e) {
          console.warn('Media upload failed for entry', entry.id, ':', e.message);
        }
      }
      threadItems.push(
        mediaIds.length > 0
          ? { text, media: { media_ids: mediaIds } }
          : text
      );
    }
    try {
      console.log('Calling X API v2 tweetThread...', entriesToPost.length, 'posts');
      await rw.v2.tweetThread(threadItems);
      const threadId = entriesToPost[0].thread_id;
      const { error: updateError } = await supabase
        .from('entries')
        .update({ posted_at: new Date().toISOString() })
        .eq('thread_id', threadId);
      if (updateError) {
        console.error('Failed to set posted_at:', updateError.message);
        process.exit(1);
      }
      console.log('Posted thread:', threadId, entriesToPost.length, 'posts');
    } catch (e) {
      const errDetail = {
        message: e.message,
        name: e.name,
        code: e.code,
        rateLimit: e.rateLimit,
        ...(e.data != null && { data: e.data }),
        ...(e.response != null && { responseStatus: e.response?.status, responseData: e.response?.data }),
      };
      console.error('X API post error:', e.message || e);
      console.error('X API error detail:', JSON.stringify(errDetail, null, 2));
      process.exit(1);
    }
  } else {
    // Single post (may be poll or regular tweet)
    const entry = entriesToPost[0];
    const text = (entry.text || '').trim();
    const textPreview = text.length > 60 ? text.slice(0, 60) + '…' : text;
    const isPoll = Array.isArray(entry.poll_options) && entry.poll_options.length >= 2 && entry.poll_options.length <= 4 && entry.poll_duration_minutes > 0;
    console.log('Entry to post:', { id: entry.id, textLength: text.length, preview: textPreview, hasImage: !!entry.image_url, isPoll });

    if (!text) {
      const { error: updateErr } = await supabase
        .from('entries')
        .update({ posted_at: new Date().toISOString() })
        .eq('id', entry.id);
      if (updateErr) console.error('Update error:', updateErr.message);
      process.exit(0);
    }

    if (text.length > 280) {
      console.warn('Entry over 280 chars (loose check, will attempt post). Id:', entry.id, 'length:', text.length);
    }

    try {
      if (isPoll) {
        const durationMinutes = Math.min(10080, Math.max(5, parseInt(String(entry.poll_duration_minutes), 10) || 1440));
        const options = entry.poll_options.slice(0, 4).map((o) => (typeof o === 'string' ? o : String(o)).slice(0, 25));
        console.log('Calling X API v2 tweet (poll)...', options.length, 'options', durationMinutes, 'min');
        const { data: tweet } = await rw.v2.tweet({
          text,
          poll: { duration_minutes: durationMinutes, options },
        });
        console.log('Posted poll tweet id:', tweet?.id, 'entry:', entry.id);
      } else {
        let mediaId = null;
        if (entry.image_url) {
          try {
            const response = await fetch(entry.image_url);
            if (!response.ok) throw new Error(`Image fetch ${response.status}`);
            const buffer = Buffer.from(await response.arrayBuffer());
            mediaId = await rw.v1.uploadMedia(buffer, { mimeType: 'image/jpeg' });
          } catch (e) {
            console.warn('Media upload failed, posting text only:', e.message);
          }
        }
        const opts = mediaId ? { media: { media_ids: [mediaId] } } : undefined;
        console.log('Calling X API v2 tweet...', mediaId ? '(with media)' : '(text only)');
        const { data: tweet } = await rw.v2.tweet(text, opts);
        console.log('Posted tweet id:', tweet?.id, 'entry:', entry.id);
      }
    } catch (e) {
      const errDetail = {
        message: e.message,
        name: e.name,
        code: e.code,
        rateLimit: e.rateLimit,
        ...(e.data != null && { data: e.data }),
        ...(e.response != null && { responseStatus: e.response?.status, responseData: e.response?.data }),
      };
      console.error('X API post error:', e.message || e);
      console.error('X API error detail:', JSON.stringify(errDetail, null, 2));
      process.exit(1);
    }

    const { error: updateError } = await supabase
      .from('entries')
      .update({ posted_at: new Date().toISOString() })
      .eq('id', entry.id);

    if (updateError) {
      console.error('Failed to set posted_at:', updateError.message);
      process.exit(1);
    }
    console.log('Marked entry as posted:', entry.id);
  }
}

main();
