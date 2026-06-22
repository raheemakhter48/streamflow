import { scrapeStreamUrl } from '../engine.js';

/**
 * Crictime embeds JWPlayer / custom players that fire .m3u8 requests
 * after a short delay. We wait 10 s to catch late-loading streams.
 */
export const scrapeCrictime = (url) =>
  scrapeStreamUrl(url, { timeout: 40_000, waitMs: 10_000 });
