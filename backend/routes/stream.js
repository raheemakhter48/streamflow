import express from 'express';
import axios from 'axios';
import https from 'https';
import { ProxyAgent } from 'proxy-agent';

const router = express.Router();

const directHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true
});

const STREAM_HEADERS = {
  'User-Agent': 'VLC/3.0.21 LibVLC/3.0.21',
  Accept: '*/*'
};

const normalizeRegion = (value) => String(value || 'auto').trim().toLowerCase();

const getConfiguredExits = () => {
  const regionOrder = String(process.env.STREAM_PROXY_REGIONS || 'us,uk,in,eu')
    .split(',')
    .map(normalizeRegion)
    .filter(Boolean);

  const exits = new Map();
  for (const region of regionOrder) {
    const envName = `STREAM_PROXY_${region.toUpperCase().replace(/[^A-Z0-9]/g, '_')}_URL`;
    const proxyUrl = String(process.env[envName] || '').trim();
    if (proxyUrl) exits.set(region, proxyUrl);
  }
  return exits;
};

const getRouteCandidates = (requestedRegion) => {
  const exits = getConfiguredExits();
  const region = normalizeRegion(requestedRegion);

  if (region === 'local') return [{ name: 'local', proxyUrl: '' }];
  if (region !== 'auto') {
    const proxyUrl = exits.get(region);
    return proxyUrl ? [{ name: region, proxyUrl }] : [];
  }

  return [
    { name: 'local', proxyUrl: '' },
    ...Array.from(exits, ([name, proxyUrl]) => ({ name, proxyUrl }))
  ];
};

const parsePublicStreamUrl = (value) => {
  let parsed;
  try {
    parsed = new URL(String(value || ''));
  } catch {
    const error = new Error('Invalid stream URL');
    error.statusCode = 400;
    throw error;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    const error = new Error('Only HTTP and HTTPS stream URLs are supported');
    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const createAgent = (proxyUrl) => {
  if (!proxyUrl) return null;
  return new ProxyAgent({
    getProxyForUrl: () => proxyUrl
  });
};

const axiosRouteOptions = (route) => {
  if (!route.proxyUrl) {
    return {
      httpsAgent: directHttpsAgent,
      proxy: false
    };
  }

  const agent = createAgent(route.proxyUrl);
  return {
    httpAgent: agent,
    httpsAgent: agent,
    proxy: false
  };
};

const isSuccessful = (status) => status >= 200 && status < 300;

const fetchManifest = async (targetUrl, candidates) => {
  let lastError;

  for (const route of candidates) {
    try {
      const response = await axios.get(targetUrl, {
        ...axiosRouteOptions(route),
        timeout: Number(process.env.STREAM_PROXY_MANIFEST_TIMEOUT_MS || 12000),
        maxRedirects: 5,
        responseType: 'text',
        transformResponse: [(data) => data],
        headers: STREAM_HEADERS,
        validateStatus: () => true
      });

      const body = typeof response.data === 'string' ? response.data : String(response.data || '');
      if (isSuccessful(response.status) && body.trimStart().startsWith('#EXTM3U')) {
        return { body, route };
      }
      lastError = new Error(`${route.name} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('No configured stream route could load the manifest');
};

const buildProxyUrl = (req, targetUrl, region) => {
  const proxyUrl = new URL(`${req.protocol}://${req.get('host')}/api/stream/proxy`);
  proxyUrl.searchParams.set('url', targetUrl);
  proxyUrl.searchParams.set('region', region);
  return proxyUrl.toString();
};

const rewriteManifest = (manifest, sourceUrl, req, region) => {
  const rewriteUrl = (value) => {
    try {
      return buildProxyUrl(req, new URL(value, sourceUrl).toString(), region);
    } catch {
      return value;
    }
  };

  return manifest
    .split(/\r?\n/)
    .map((rawLine) => {
      const line = rawLine.trim();
      if (!line) return line;

      if (!line.startsWith('#')) {
        return rewriteUrl(line);
      }

      // Encryption keys, init maps and alternate renditions keep URLs in URI="...".
      return line.replace(/URI=(["'])(.*?)\1/gi, (_match, quote, uri) => {
        return `URI=${quote}${rewriteUrl(uri)}${quote}`;
      });
    })
    .join('\n');
};

router.options('/proxy', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

// Smart stream route: local Oracle first, then configured regional proxy exits.
router.get('/proxy', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  try {
    const targetUrl = parsePublicStreamUrl(req.query.url).toString();
    const requestedRegion = normalizeRegion(req.query.region);
    const candidates = getRouteCandidates(requestedRegion);

    if (candidates.length === 0) {
      return res.status(503).send(`Stream proxy region "${requestedRegion}" is not configured`);
    }

    const looksLikeManifest = /\.m3u8(?:$|[?#])/i.test(targetUrl);
    if (looksLikeManifest) {
      const { body, route } = await fetchManifest(targetUrl, candidates);
      const manifest = rewriteManifest(body, targetUrl, req, route.name);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('X-Stream-Route', route.name);
      return res.send(manifest);
    }

    // Segment requests already contain the route selected while loading the manifest.
    const route = candidates[0];
    const streamResponse = await axios.get(targetUrl, {
      ...axiosRouteOptions(route),
      responseType: 'stream',
      timeout: Number(process.env.STREAM_PROXY_SEGMENT_TIMEOUT_MS || 20000),
      maxRedirects: 5,
      headers: {
        ...STREAM_HEADERS,
        ...(req.headers.range ? { Range: req.headers.range } : {})
      },
      validateStatus: () => true
    });

    res.status(streamResponse.status);
    res.setHeader('X-Stream-Route', route.name);
    for (const header of ['content-type', 'content-length', 'accept-ranges', 'content-range']) {
      if (streamResponse.headers[header]) res.setHeader(header, streamResponse.headers[header]);
    }

    streamResponse.data.pipe(res);
    req.on('close', () => streamResponse.data.destroy?.());
  } catch (error) {
    console.error('Smart stream proxy error:', error.message);
    if (!res.headersSent) {
      res.status(error.statusCode || 502).send('No stream route is currently available');
    }
  }
});

// @route GET /api/stream/mux.m3u8
// @desc  Generates an HLS Master Playlist combining a video stream with a separate audio stream
router.get('/mux.m3u8', (req, res) => {
  const { video, audio, quality = '1080p', audioName = 'Main Audio' } = req.query;
  if (!video) {
    return res.status(400).send('video parameter is required');
  }

  const cleanVideo = String(video).trim();
  const cleanAudio = audio ? String(audio).trim() : null;
  const cleanAudioName = String(audioName).replace(/["\n\r]/g, '') || 'Main Audio';

  const bandwidthMap = {
    '4k': 12000000,
    '1080p': 5000000,
    '720p': 2500000,
    '480p': 1200000,
    '360p': 700000,
  };
  const qKey = String(quality).toLowerCase().replace(/[^a-z0-9]/g, '');
  const bw = bandwidthMap[qKey] || 4500000;

  const resolutionMap = {
    '4k': '3840x2160',
    '1080p': '1920x1080',
    '720p': '1280x720',
    '480p': '854x480',
    '360p': '640x360',
  };
  const resAttr = resolutionMap[qKey] ? `,RESOLUTION=${resolutionMap[qKey]}` : '';

  let manifest = '#EXTM3U\n#EXT-X-VERSION:3\n';
  if (cleanAudio) {
    manifest += `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio-main",NAME="${cleanAudioName}",DEFAULT=YES,AUTOSELECT=YES,URI="${cleanAudio}"\n`;
    manifest += `#EXT-X-STREAM-INF:BANDWIDTH=${bw}${resAttr},AUDIO="audio-main"\n`;
  } else {
    manifest += `#EXT-X-STREAM-INF:BANDWIDTH=${bw}${resAttr}\n`;
  }
  manifest += `${cleanVideo}\n`;

  res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.send(manifest);
});

router.get('/routes', (_req, res) => {
  const regions = Array.from(getConfiguredExits().keys());
  res.json({
    success: true,
    smartRouting: regions.length > 0,
    routes: ['local', ...regions]
  });
});

// @route POST /api/stream/resolve-multiple
// @desc  Sort stream URLs with reachable URLs first
router.post('/resolve-multiple', async (req, res) => {
  const { urls } = req.body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ success: false, message: 'urls array required' });
  }

  const results = await Promise.all(
    urls.slice(0, 20).map(async (value) => {
      try {
        const url = parsePublicStreamUrl(value).toString();
        const response = await axios.head(url, {
          timeout: 4000,
          httpsAgent: directHttpsAgent,
          proxy: false,
          headers: STREAM_HEADERS,
          validateStatus: () => true
        });
        return { url, alive: response.status >= 200 && response.status < 400 };
      } catch {
        return { url: value, alive: false };
      }
    })
  );

  return res.json({
    success: true,
    urls: [
      ...results.filter((item) => item.alive).map((item) => item.url),
      ...results.filter((item) => !item.alive).map((item) => item.url)
    ]
  });
});

export default router;
