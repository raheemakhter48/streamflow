import express from 'express';
import axios from 'axios';
import https from 'https';

const router = express.Router();

// Custom agent to ignore expired certificates (common in IPTV providers)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// @route   GET /api/stream/proxy
// @desc    Proxy video stream to avoid CORS issues and bypass SSL/Headers blocks
// @access  Public
router.get('/proxy', async (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { url } = req.query;
    if (!url) return res.status(400).send('URL required');

    const decodedUrl = decodeURIComponent(url);
    const proxyBase = `${req.protocol}://${req.get('host')}/api/stream/proxy?url=`;

    // Handle HLS Manifests (.m3u8)
    if (decodedUrl.includes('.m3u8')) {
      const response = await axios.get(decodedUrl, {
        timeout: 15000,
        headers: { 
          'User-Agent': 'VLC/3.0.11',
          'Accept': '*/*'
        },
        httpsAgent,
        validateStatus: false
      });

      let manifest = response.data;
      const baseUrl = decodedUrl.substring(0, decodedUrl.lastIndexOf('/') + 1);

      // Rewrite relative paths and absolute URLs to use proxy
      manifest = manifest.split('\n').map(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
          let fullUrl = line;
          if (!line.startsWith('http')) {
            fullUrl = new URL(line, baseUrl).toString();
          }
          return `${proxyBase}${encodeURIComponent(fullUrl)}`;
        }
        return line;
      }).join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(manifest);
    }

    // Handle Direct Streams / TS Segments
    const streamResponse = await axios({
      method: 'GET',
      url: decodedUrl,
      responseType: 'stream',
      timeout: 20000,
      httpsAgent,
      headers: {
        'User-Agent': 'VLC/3.0.11',
        'Accept': '*/*',
        'Range': req.headers.range || 'bytes=0-'
      },
      validateStatus: false
    });

    // Forward relevant headers
    if (streamResponse.headers['content-type']) res.setHeader('Content-Type', streamResponse.headers['content-type']);
    if (streamResponse.headers['content-length']) res.setHeader('Content-Length', streamResponse.headers['content-length']);
    if (streamResponse.headers['accept-ranges']) res.setHeader('Accept-Ranges', streamResponse.headers['accept-ranges']);
    if (streamResponse.headers['content-range']) res.setHeader('Content-Range', streamResponse.headers['content-range']);

    streamResponse.data.pipe(res);

    req.on('close', () => {
      if (streamResponse.data.destroy) streamResponse.data.destroy();
    });

  } catch (error) {
    console.error('Proxy Error:', error.message);
    if (!res.headersSent) res.status(500).send('Stream error');
  }
});

// @route   POST /api/stream/resolve-multiple
// @desc    Takes array of stream URLs, returns them sorted: working first
// @access  Public
router.post('/resolve-multiple', async (req, res) => {
  const { urls } = req.body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ success: false, message: 'urls array required' });
  }

  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await axios.head(url, {
          timeout: 4000,
          httpsAgent,
          headers: { 'User-Agent': 'VLC/3.0.11' },
          validateStatus: (status) => status < 500,
        });
        return { url, alive: response.status < 400 };
      } catch {
        return { url, alive: false };
      }
    })
  );

  // Working streams first, dead ones at end as fallback
  const sorted = [
    ...results.filter((r) => r.alive).map((r) => r.url),
    ...results.filter((r) => !r.alive).map((r) => r.url),
  ];

  return res.json({ success: true, urls: sorted });
});

export default router;
