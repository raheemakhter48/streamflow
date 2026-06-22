import { scrapeStreamUrl } from './engine.js';
import { scrapeCrictime }   from './sites/crictime.js';
import { scrapeStreameast } from './sites/streameast.js';
import { scrapeSportsurge } from './sites/sportsurge.js';

/**
 * Route a channel to the right site-specific scraper based on
 * scraper_type field (set in admin panel) or fall back to URL matching.
 */
export const scrapeChannel = (channel) => {
  const url  = channel.scrape_source_url;
  const type = (channel.scraper_type || 'generic').toLowerCase();

  if (!url) return Promise.resolve({ success: false, error: 'No scrape URL configured' });

  if (type === 'crictime'   || url.includes('crictime'))   return scrapeCrictime(url);
  if (type === 'streameast' || url.includes('streameast')) return scrapeStreameast(url);
  if (type === 'sportsurge' || url.includes('sportsurge')) return scrapeSportsurge(url);

  // Generic — works for most sites that embed HLS players
  return scrapeStreamUrl(url, { timeout: 35_000, waitMs: 8_000 });
};
