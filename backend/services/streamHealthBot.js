// Automated Stream Health Bot
// Periodically checks admin_channels and iptv_channels for broken links.
// Updates status to 'broken' and logs notifications for the admin bell icon.

import axios from 'axios';
import supabase from '../config/supabase.js';

let isBotRunning = false;

export async function runStreamHealthBot() {
  if (isBotRunning) return;
  isBotRunning = true;

  try {
    console.log('🤖 [Stream Health Bot] Checking stream links...');
    
    // Check channels that haven't been checked recently or are priority
    const { data: channels, error } = await supabase
      .from('admin_channels')
      .select('id, name, stream_url, status')
      .not('stream_url', 'is', null)
      .limit(30);

    if (error || !channels || channels.length === 0) {
      isBotRunning = false;
      return;
    }

    let brokenFound = 0;

    for (const ch of channels) {
      let isWorking = false;
      let statusCode = null;
      let lastError = null;

      try {
        const res = await axios.get(ch.stream_url, {
          timeout: 6000,
          headers: {
            Range: 'bytes=0-1024',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) VLC/3.0.18'
          },
          validateStatus: () => true
        });

        statusCode = res.status;
        isWorking = res.status >= 200 && res.status < 400;
        res.data?.destroy?.();
      } catch (err) {
        lastError = err.message;
      }

      const newStatus = isWorking ? 'working' : 'broken';

      if (!isWorking) brokenFound++;

      await supabase
        .from('admin_channels')
        .update({
          status: newStatus,
          last_checked_at: new Date().toISOString(),
          last_status_code: statusCode,
          last_error: lastError,
          updated_at: new Date().toISOString()
        })
        .eq('id', ch.id);
    }

    if (brokenFound > 0) {
      console.log(`🤖 [Stream Health Bot] Completed scan: ${brokenFound} broken streams flagged.`);
      await supabase.from('admin_system_logs').insert({
        level: 'warn',
        scope: 'health-bot',
        message: `Stream Health Bot flagged ${brokenFound} broken stream(s)`,
        details: { brokenFound, timestamp: new Date().toISOString() }
      }).catch(() => {});
    } else {
      console.log('🤖 [Stream Health Bot] All checked streams are healthy.');
    }
  } catch (e) {
    console.error('🤖 [Stream Health Bot] Error during stream check:', e.message);
  } finally {
    isBotRunning = false;
  }
}

// Start recurring interval (runs every 15 minutes in background)
export function startStreamHealthBot(intervalMs = 15 * 60 * 1000) {
  console.log(`🤖 Stream Health Bot initialized (interval: ${intervalMs / 60000} mins)`);
  // Run once shortly after startup (after 30s)
  setTimeout(() => runStreamHealthBot(), 30000);
  setInterval(runStreamHealthBot, intervalMs);
}
