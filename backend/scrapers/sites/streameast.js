import puppeteer from 'puppeteer';
import { scrapeStreamUrl } from '../engine.js';

const getBrowserPath = () => process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

/**
 * Streameast loads an iframe player that itself loads the .m3u8.
 * We follow the iframe chain by monitoring all page frames.
 */
export const scrapeStreameast = async (url) => {
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

    // Watch every frame that the browser creates (including iframes)
    browser.on('targetcreated', async (target) => {
      try {
        const newPage = await target.page();
        if (!newPage) return;

        await newPage.setRequestInterception(true).catch(() => {});
        newPage.on('request', (req) => {
          const u = req.url();
          if (u.includes('.m3u8')) foundUrls.add(u);
          try { req.continue(); } catch {}
        });
        newPage.on('response', (res) => {
          const u = res.url();
          if (u.includes('.m3u8') && res.status() < 400) foundUrls.add(u);
        });
      } catch { /* ignore */ }
    });

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('.m3u8')) foundUrls.add(u);
      try { req.continue(); } catch {}
    });
    page.on('response', (res) => {
      const u = res.url();
      if (u.includes('.m3u8') && res.status() < 400) foundUrls.add(u);
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40_000 });
    await new Promise((r) => setTimeout(r, 12_000));

    const allUrls = [...foundUrls];
    const primaryUrl =
      allUrls.find((u) => /master|index|playlist/i.test(u)) ||
      allUrls[0] || null;

    return { success: !!primaryUrl, url: primaryUrl, allUrls, durationMs: Date.now() - startedAt };
  } catch (err) {
    return { success: false, url: null, allUrls: [], error: err.message, durationMs: Date.now() - startedAt };
  } finally {
    if (browser) { try { await browser.close(); } catch {} }
  }
};
