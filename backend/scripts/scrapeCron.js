import 'dotenv/config';
import supabase from '../config/supabase.js';
import { scrapeChannel } from '../scrapers/index.js';

const INTERVAL_MS = Number(process.env.SCRAPER_INTERVAL_MS) || 15 * 60 * 1000;

const log = async (level, message, details = null) => {
  console.log(`[scraper][${level}] ${message}`);
  try {
    await supabase.from('admin_system_logs').insert({ level, scope: 'scraper', message, details });
  } catch { /* non-critical */ }
};

export const runScraper = async () => {
  await log('info', 'Scrape run started');

  const { data: channels, error } = await supabase
    .from('admin_channels')
    .select('id, name, scrape_source_url, scraper_type')
    .not('scrape_source_url', 'is', null)
    .eq('is_manual_override', false);

  if (error) {
    await log('error', `Failed to load channels: ${error.message}`);
    return;
  }

  if (!channels || channels.length === 0) {
    await log('info', 'No auto-scrape channels configured — done');
    return;
  }

  await log('info', `Scraping ${channels.length} channel(s)…`);

  for (const channel of channels) {
    let result;
    try {
      result = await scrapeChannel(channel);
    } catch (err) {
      result = { success: false, url: null, allUrls: [], error: err.message, durationMs: 0 };
    }

    const status = result.success
      ? 'success'
      : result.error?.toLowerCase().includes('timeout')
        ? 'timeout'
        : 'failed';

    try {
      await supabase
        .from('admin_channels')
        .update({
          stream_url: result.url || null,
          status: result.success ? 'working' : 'broken',
          last_error: result.error || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', channel.id);
    } catch { /* continue */ }

    try {
      await supabase.from('admin_scrape_runs').insert({
        channel_id: channel.id,
        channel_name: channel.name,
        status,
        duration_ms: result.durationMs || null,
        discovered_url: result.url || null,
        error: result.error || null,
      });
    } catch { /* continue */ }

    const label = result.url ? `→ ${result.url.slice(0, 70)}` : `(${result.error || 'no stream found'})`;
    await log(result.success ? 'info' : 'warn', `${channel.name}: ${status} ${label}`);
  }

  await log('info', 'Scrape run complete');
};

export const startScrapeCron = () => {
  console.log(`[scraper] Cron enabled — interval ${INTERVAL_MS / 1000}s`);
  runScraper();
  setInterval(runScraper, INTERVAL_MS);
};

// Standalone: node scripts/scrapeCron.js
if (process.argv[1]?.endsWith('scrapeCron.js')) {
  runScraper().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
