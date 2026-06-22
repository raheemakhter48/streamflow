import puppeteer from 'puppeteer';
import { scrapeStreamUrl } from '../engine.js';

const getBrowserPath = () => process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

/**
 * Sportsurge shows a list of stream links. We click the first available
 * link, land on the actual stream page, then intercept the .m3u8.
 */
export const scrapeSportsurge = async (url) => {
  const startedAt = Date.now();
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless: true,
      executablePath: getBrowserPath(),
      args: [
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
        '--disable-gpu', '--no-first-run', '--no-zygote', '--single-process',
        '--mute-audio',
      ],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 720 });

    const foundUrls = new Set();
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('.m3u8')) foundUrls.add(req.url());
      try { req.continue(); } catch {}
    });
    page.on('response', (res) => {
      if (res.url().includes('.m3u8') && res.status() < 400) foundUrls.add(res.url());
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40_000 });
    await new Promise((r) => setTimeout(r, 4_000));

    // Try to click the first stream link on the page
    try {
      const streamLink = await page.$(
        'a[href*="stream"], a[href*="watch"], a[href*="live"], .stream-link, .watch-link'
      );
      if (streamLink) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {}),
          streamLink.click(),
        ]);
        await new Promise((r) => setTimeout(r, 8_000));
      }
    } catch { /* link click is best-effort */ }

    // Final wait for any lazy stream loads
    await new Promise((r) => setTimeout(r, 5_000));

    const allUrls = [...foundUrls];
    const primaryUrl =
      allUrls.find((u) => /master|index|playlist/i.test(u)) || allUrls[0] || null;

    return { success: !!primaryUrl, url: primaryUrl, allUrls, durationMs: Date.now() - startedAt };
  } catch (err) {
    return { success: false, url: null, allUrls: [], error: err.message, durationMs: Date.now() - startedAt };
  } finally {
    if (browser) { try { await browser.close(); } catch {} }
  }
};
