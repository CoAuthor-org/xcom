/**
 * Cron job: post the next queued entry for the current slot (10am or 6pm queue) to X.
 * Run at 10am IST → picks from queue '10am'; at 6pm IST → picks from queue '6pm'.
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

/** Determine which queue to run: 10am or 6pm (IST). Uses SCHEDULE_QUEUE if set, else UTC hour. */
function getScheduleSlot() {
  const forced = env('SCHEDULE_QUEUE').toLowerCase();
  if (forced === '10am' || forced === '6pm') return forced;
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  // 10am IST = 04:30 UTC → treat hour 4 as 10am
  if (utcHour === 4 && utcMin >= 25) return '10am';
  if (utcHour === 5 && utcMin < 35) return '10am';
  // 6pm IST = 12:30 UTC
  if (utcHour === 12 && utcMin >= 25) return '6pm';
  if (utcHour === 13 && utcMin < 35) return '6pm';
  // Default by hour: morning slot 0–8 UTC → 10am, else 6pm (for manual runs)
  return utcHour < 12 ? '10am' : '6pm';
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

  const { data: entries, error: fetchError } = await supabase
    .from('entries')
    .select('id, text, image_url')
    .eq('queue', slot)
    .is('posted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);

  if (fetchError) {
    console.error('Supabase fetch error:', fetchError.message);
    process.exit(1);
  }
  if (!entries || entries.length === 0) {
    console.log(`No queued entries for ${slot}.`);
    process.exit(0);
  }

  const entry = entries[0];
  const text = (entry.text || '').trim();
  if (!text) {
    const { error: updateErr } = await supabase
      .from('entries')
      .update({ posted_at: new Date().toISOString() })
      .eq('id', entry.id);
    if (updateErr) console.error('Update error:', updateErr.message);
    process.exit(0);
  }

  if (text.length > 280) {
    console.error('Entry exceeds 280 characters. Id:', entry.id);
    process.exit(1);
  }

  const client = new TwitterApi({
    appKey: xApiKey,
    appSecret: xApiSecret,
    accessToken: xAccessToken,
    accessSecret: xAccessSecret,
  });
  const rw = client.readWrite;

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

  try {
    const opts = mediaId ? { media: { media_ids: [mediaId] } } : undefined;
    const { data: tweet } = await rw.v2.tweet(text, opts);
    console.log('Posted tweet id:', tweet?.id, 'entry:', entry.id);
  } catch (e) {
    console.error('X API post error:', e.message || e);
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

main();
