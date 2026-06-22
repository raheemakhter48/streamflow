import puppeteer from 'puppeteer';

// URL patterns that indicate a live/VOD stream manifest
const STREAM_PATTERNS = [
  /\.m3u8(\?[^"'\s]*)?/i,
  /\/manifest(\.mpd)?(\?[^"'\s]*)?/i,
  /\/playlist\.m3u8/i,
  /\/index\.m3u8/i,
  /\/master\.m3u8/i,
  /live.*\.m3u8/i,
  /stream.*\.m3u8/i,
  /chunklist.*\.m3u8/i,
];

// Noise URLs to skip (ads, analytics, social, etc.)
const SKIP_PATTERNS = [
  /google-analytics/i,
  /doubleclick\.net/i,
  /facebook\.com/i,
  /twitter\.com/i,
  /recaptcha/i,
  /googleapis\.com/i,
  /adsbygoogle/i,
  /scorecardresearch/i,
  /amazon-adsystem/i,
];

const isStreamUrl = (url) =>
  STREAM_PATTERNS.some((p) => p.test(url)) && !SKIP_PATTERNS.some((p) => p.test(url));

const getBrowserPath = () =>
  process.env.PUPPETEER_EXECUTABLE_PATH || undefined;

/**
 * Launch a headless browser, navigate to targetUrl, and intercept all
 * network requests/responses to find .m3u8 / manifest stream URLs.
 *
 * Returns:
 *   { success, url, allUrls, durationMs, error? }
 */
export const scrapeStreamUrl = async (targetUrl, options = {}) => {
  const {
    timeout   = 35_000,   // page navigation timeout
    waitMs    = 8_000,    // extra wait after load for lazy streams
    headless  = true,
  } = options;

  const startedAt = Date.now();
  let browser = null;

  try {
    browser = await puppeteer.launch({
      headless,
      executablePath: getBrowserPath(),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',           // required for some cloud envs
        '--disable-extensions',
        '--mute-audio',
      ],
    });

    const page = await browser.newPage();

    // Realistic browser fingerprint to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    await page.setViewport({ width: 1280, height: 720 });
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

    const foundUrls = new Set();

    // Intercept outgoing requests
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const url = req.url();
      if (isStreamUrl(url)) foundUrls.add(url);
      try { req.continue(); } catch { /* request may already be handled */ }
    });

    // Also watch responses (some CDNs redirect to the actual .m3u8)
    page.on('response', (res) => {
      const url = res.url();
      if (isStreamUrl(url) && res.status() >= 200 && res.status() < 400) {
        foundUrls.add(url);
      }
    });

    // Navigate — use domcontentloaded so we don't wait for all assets
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout,
    });

    // Give the JS player time to initialise and fire its first segment request
    await new Promise((r) => setTimeout(r, waitMs));

    // Also check iframe src URLs — some sites embed the player in an iframe
    const frames = page.frames();
    for (const frame of frames) {
      try {
        const frameUrl = frame.url();
        if (frameUrl && frameUrl !== 'about:blank' && isStreamUrl(frameUrl)) {
          foundUrls.add(frameUrl);
        }
      } catch { /* cross-origin frames may throw */ }
    }

    const allUrls = [...foundUrls];

    // Prefer a proper .m3u8 master manifest over segment/chunk URLs
    const primaryUrl =
      allUrls.find((u) => /master\.m3u8|index\.m3u8|playlist\.m3u8/i.test(u)) ||
      allUrls.find((u) => u.includes('.m3u8')) ||
      allUrls[0] ||
      null;

    return {
      success: !!primaryUrl,
      url: primaryUrl,
      allUrls,
      durationMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      success: false,
      url: null,
      allUrls: [],
      error: err.message,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    if (browser) {
      try { await browser.close(); } catch { /* ignore */ }
    }
  }
};
