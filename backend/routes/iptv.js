import express from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import dns from 'node:dns/promises';
import net from 'node:net';
import { protect } from '../middleware/auth.js';
import supabase from '../config/supabase.js';

const router = express.Router();

const DEFAULT_CHANNEL_LIMIT = 30;
const MAX_CHANNEL_LIMIT = 100;
const MAX_SELECTED_CHANNELS = 50;
const STREAM_CHECK_TIMEOUT_MS = 8000;
const STREAM_CHECK_CONCURRENCY = 8;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeQueryText = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const isPrivateIp = (address) => {
  if (net.isIPv4(address)) {
    const octets = address.split('.').map(Number);
    return octets[0] === 10
      || octets[0] === 127
      || (octets[0] === 169 && octets[1] === 254)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
      || (octets[0] === 192 && octets[1] === 168)
      || octets[0] === 0;
  }

  if (net.isIPv6(address)) {
    const normalized = address.toLowerCase();
    return normalized === '::1'
      || normalized === '::'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe8')
      || normalized.startsWith('fe9')
      || normalized.startsWith('fea')
      || normalized.startsWith('feb');
  }

  return true;
};

const assertSafeStreamUrl = async (rawUrl, req) => {
  const parsed = new URL(rawUrl);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS stream URLs are supported');
  }

  const requestHost = String(req.get('host') || '').split(':')[0].toLowerCase();
  const isOwnStreamProxy = parsed.hostname.toLowerCase() === requestHost
    && /^\/api\/iptv\/live\/[^/]+$/i.test(parsed.pathname);

  if (isOwnStreamProxy) return parsed.toString();

  if (parsed.hostname.toLowerCase() === 'localhost') {
    throw new Error('Local network URLs are not allowed');
  }

  const addresses = await dns.lookup(parsed.hostname, { all: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error('Local network URLs are not allowed');
  }

  return parsed.toString();
};

const checkStreamUrl = async (rawUrl, req) => {
  const checkedAt = new Date().toISOString();

  try {
    let url = rawUrl;

    for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
      url = await assertSafeStreamUrl(url, req);
      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: STREAM_CHECK_TIMEOUT_MS,
        maxRedirects: 0,
        headers: {
          Accept: '*/*',
          Range: 'bytes=0-2048',
          'User-Agent': 'VLC/3.0.11'
        },
        validateStatus: () => true
      });

      response.data?.destroy?.();

      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        url = new URL(response.headers.location, url).toString();
        continue;
      }

      const isWorking = response.status >= 200 && response.status < 300;
      return {
        isWorking,
        url,
        statusCode: response.status,
        error: isWorking ? null : `HTTP ${response.status}`,
        checkedAt
      };
    }

    throw new Error('Too many stream redirects');
  } catch (error) {
    return {
      isWorking: false,
      url: rawUrl,
      statusCode: error?.response?.status || null,
      error: String(error?.message || 'Stream check failed').slice(0, 250),
      checkedAt
    };
  }
};

const runConcurrent = async (items, worker, concurrency) => {
  const results = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
};

const getBearerToken = (req) => {
  const authorization = req.headers.authorization || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
};

const getUserFromStreamToken = async (token) => {
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', decoded.id)
      .maybeSingle();

    return user || null;
  } catch {
    return null;
  }
};

const getProviderBaseUrl = (credentials) => {
  const source = credentials?.server_url || credentials?.m3u_url || '';
  if (!source) return '';

  try {
    const parsed = new URL(source.startsWith('http') ? source : `http://${source}`);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return source.replace(/\/$/, '');
  }
};

const buildXtreamLiveUrl = (credentials, streamId, extension = 'ts') => {
  const baseUrl = getProviderBaseUrl(credentials);
  if (!baseUrl || !credentials?.username || !credentials?.password || !streamId) return '';

  return `${baseUrl}/live/${encodeURIComponent(credentials.username)}/${encodeURIComponent(credentials.password)}/${encodeURIComponent(streamId)}.${extension}`;
};

const getEnvXtreamCredentials = () => {
  const serverUrl = process.env.XTREAM_SERVER_URL || process.env.IPTV_SERVER_URL || '';
  const username = process.env.XTREAM_USERNAME || process.env.IPTV_USERNAME || '';
  const password = process.env.XTREAM_PASSWORD || process.env.IPTV_PASSWORD || '';

  if (!serverUrl || !username || !password) return null;

  return {
    provider_name: process.env.XTREAM_PROVIDER_NAME || 'Environment Xtream',
    server_url: serverUrl,
    username,
    password,
    m3u_url: generateM3UFromCredentials(serverUrl, username, password),
    epg_url: generateEPGFromCredentials(serverUrl, username, password),
    m3u_content: null
  };
};

const getUserIptvCredentials = async (userId) => {
  const { data, error } = await supabase
    .from('iptv_credentials')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data || getEnvXtreamCredentials();
};

const rewriteXtreamLiveUrl = (url, req, credentials, token) => {
  if (!credentials?.username || !credentials?.password || !token) return url;

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const liveIndex = parts.findIndex((part) => part.toLowerCase() === 'live');

    if (liveIndex === -1 || parts.length < liveIndex + 4) return url;

    const username = decodeURIComponent(parts[liveIndex + 1] || '');
    const password = decodeURIComponent(parts[liveIndex + 2] || '');
    const streamFile = parts[liveIndex + 3] || '';
    const streamMatch = streamFile.match(/^([^./]+)(?:\.(ts|m3u8|mp4))?$/i);

    if (!streamMatch) return url;
    if (username !== credentials.username || password !== credentials.password) return url;

    const streamId = streamMatch[1];
    const extension = streamMatch[2] || 'ts';
    const origin = `${req.protocol}://${req.get('host')}`;

    return `${origin}/api/iptv/live/${encodeURIComponent(streamId)}.${extension}?token=${encodeURIComponent(token)}`;
  } catch {
    return url;
  }
};

const buildChannelDetailSelect = () => {
  return `
    id,
    name,
    country,
    category,
    logo_url,
    iptv_streams (
      id,
      title,
      url,
      resolution,
      is_working
    )
  `;
};

const buildChannelListSelect = () => {
  return `
    id,
    name,
    country,
    category,
    logo_url,
    iptv_streams!inner (
      id,
      title,
      url,
      resolution,
      is_working
    )
  `;
};

const sortStreamsWorkingFirst = (streams) => {
  return Array.isArray(streams)
    ? streams
      .filter((stream) => stream?.url)
      .sort((a, b) => Number(b?.is_working === true) - Number(a?.is_working === true))
    : [];
};

const normalizeRankedChannel = (channel) => {
  const streams = sortStreamsWorkingFirst(channel.iptv_streams);

  return {
    ...channel,
    has_working_stream: streams.some((stream) => stream?.is_working === true),
    iptv_streams: streams
  };
};

const applyChannelFilters = (query, { search, category, country, countries }) => {
  let nextQuery = query;

  if (search) {
    nextQuery = nextQuery.ilike('name', `%${search.replace(/[%_\\]/g, (match) => `\\${match}`)}%`);
  }

  if (category) {
    nextQuery = nextQuery.eq('category', category);
  }

  if (country) {
    nextQuery = nextQuery.eq('country', country);
  } else if (countries.length > 0) {
    nextQuery = nextQuery.in('country', countries);
  }

  return nextQuery;
};

const fetchChannelsFallback = async ({ page, limit, search, category, country, countries }) => {
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('iptv_channels')
    .select(buildChannelListSelect(), { count: 'exact' })
    .not('iptv_streams.url', 'is', null)
    .order('name', { ascending: true })
    .range(from, to);

  query = applyChannelFilters(query, { search, category, country, countries });

  const { data, error, count } = await query;

  if (error) {
    throw error;
  }

  const channels = (data || [])
    .map(normalizeRankedChannel)
    .sort((a, b) => {
      const workingDiff = Number(b.has_working_stream) - Number(a.has_working_stream);
      return workingDiff || a.name.localeCompare(b.name);
    });

  return {
    channels,
    totalChannels: count || 0
  };
};

// @route   POST /api/iptv/channels/check
// @desc    Check user-selected channels and return only channels with a live stream
// @access  Private
router.post('/channels/check', protect, async (req, res) => {
  try {
    const channels = Array.isArray(req.body?.channels) ? req.body.channels : [];

    if (channels.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Select at least one channel'
      });
    }

    if (channels.length > MAX_SELECTED_CHANNELS) {
      return res.status(400).json({
        success: false,
        message: `You can check up to ${MAX_SELECTED_CHANNELS} channels at a time`
      });
    }

    const normalizedChannels = channels.map((channel, index) => {
      const primaryUrl = normalizeQueryText(channel?.url);
      const alternateUrls = Array.isArray(channel?.alternateUrls) ? channel.alternateUrls : [];
      const urls = [...new Set([primaryUrl, ...alternateUrls]
        .map(normalizeQueryText)
        .filter(Boolean))]
        .slice(0, 5);

      return {
        name: normalizeQueryText(channel?.name) || `Channel ${index + 1}`,
        inputUrl: primaryUrl,
        urls
      };
    });

    if (normalizedChannels.some((channel) => !channel.inputUrl)) {
      return res.status(400).json({
        success: false,
        message: 'Every selected channel must have a stream URL'
      });
    }

    const results = await runConcurrent(
      normalizedChannels,
      async (channel) => {
        let lastCheck = null;

        for (const url of channel.urls) {
          lastCheck = await checkStreamUrl(url, req);
          if (lastCheck.isWorking) {
            return {
              name: channel.name,
              inputUrl: channel.inputUrl,
              workingUrl: lastCheck.url,
              isWorking: true,
              statusCode: lastCheck.statusCode,
              checkedAt: lastCheck.checkedAt
            };
          }
        }

        return {
          name: channel.name,
          inputUrl: channel.inputUrl,
          workingUrl: null,
          isWorking: false,
          statusCode: lastCheck?.statusCode || null,
          error: lastCheck?.error || 'No stream URL responded',
          checkedAt: lastCheck?.checkedAt || new Date().toISOString()
        };
      },
      STREAM_CHECK_CONCURRENCY
    );

    const workingChannels = results.filter((result) => result.isWorking);

    res.set('Cache-Control', 'no-store');
    return res.json({
      success: true,
      checked: results.length,
      working: workingChannels.length,
      failed: results.length - workingChannels.length,
      data: workingChannels,
      results
    });
  } catch (error) {
    console.error('Unexpected error checking selected IPTV channels:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check selected channels'
    });
  }
});

// @route   GET /api/iptv/regions
// @desc    Fetch all available IPTV-org regions
// @access  Public
router.get('/regions', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('iptv_regions')
      .select('code, name, countries')
      .order('name', { ascending: true });

    if (error) {
      console.error('Supabase error fetching IPTV regions:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch IPTV regions'
      });
    }

    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Unexpected error fetching IPTV regions:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   GET /api/iptv/channels
// @desc    Fetch paginated IPTV-org channels with search/category/region filters
// @access  Public
router.get('/channels', async (req, res) => {
  try {
    const page = parsePositiveInteger(req.query.page, 1);
    const rawLimit = parsePositiveInteger(req.query.limit, DEFAULT_CHANNEL_LIMIT);
    const limit = Math.min(rawLimit, MAX_CHANNEL_LIMIT);

    const search = normalizeQueryText(req.query.search);
    const category = normalizeQueryText(req.query.category);
    const region = normalizeQueryText(req.query.region).toUpperCase();
    const country = normalizeQueryText(req.query.country).toUpperCase();

    let countries = [];

    if (region) {
      const { data: regionData, error: regionError } = await supabase
        .from('iptv_regions')
        .select('countries')
        .eq('code', region)
        .maybeSingle();

      if (regionError) {
        console.error('Supabase error resolving IPTV region:', regionError.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to resolve IPTV region'
        });
      }

      if (!regionData) {
        return res.status(404).json({
          success: false,
          message: `Region ${region} was not found`
        });
      }

      countries = Array.isArray(regionData.countries)
        ? regionData.countries.filter(Boolean)
        : [];

      if (countries.length === 0) {
        res.set('Cache-Control', 'public, max-age=60');
        return res.json({
          success: true,
          totalChannels: 0,
          totalPages: 0,
          currentPage: page,
          data: []
        });
      }
    }

    const rpcResponse = await supabase.rpc('get_iptv_channels_ranked', {
      p_page: page,
      p_limit: limit,
      p_search: search || null,
      p_category: category || null,
      p_region_countries: country ? null : countries,
      p_country: country || null
    });

    let channels = [];
    let totalChannels = 0;

    if (rpcResponse.error) {
      console.warn('Ranked IPTV RPC failed, using direct query fallback:', rpcResponse.error.message);
      const fallbackResponse = await fetchChannelsFallback({
        page,
        limit,
        search,
        category,
        country,
        countries
      });

      channels = fallbackResponse.channels;
      totalChannels = fallbackResponse.totalChannels;
    } else {
      totalChannels = rpcResponse.data?.[0]?.total_count ? Number(rpcResponse.data[0].total_count) : 0;
      channels = (rpcResponse.data || [])
        .map(({ total_count, ...channel }) => normalizeRankedChannel(channel));
    }

    const totalPages = totalChannels === 0 ? 0 : Math.ceil(totalChannels / limit);

    res.set('Cache-Control', 'public, max-age=30');
    return res.json({
      success: true,
      totalChannels,
      totalPages,
      currentPage: page,
      data: channels
    });
  } catch (error) {
    console.error('Unexpected error fetching IPTV channels:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   GET /api/iptv/categories
// @desc    Fetch available categories for current region/country filter
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const region = normalizeQueryText(req.query.region).toUpperCase();
    const country = normalizeQueryText(req.query.country).toUpperCase();
    let countries = [];

    if (region && !country) {
      const { data: regionData, error: regionError } = await supabase
        .from('iptv_regions')
        .select('countries')
        .eq('code', region)
        .maybeSingle();

      if (regionError) {
        console.error('Supabase error resolving IPTV categories region:', regionError.message);
        return res.status(500).json({
          success: false,
          message: 'Failed to resolve IPTV region'
        });
      }

      countries = Array.isArray(regionData?.countries)
        ? regionData.countries.filter(Boolean)
        : [];
    }

    let query = supabase
      .from('iptv_channels')
      .select('category, iptv_streams!inner(url)')
      .not('category', 'is', null)
      .not('iptv_streams.url', 'is', null)
      .limit(5000);

    if (country) {
      query = query.eq('country', country);
    } else if (countries.length > 0) {
      query = query.in('country', countries);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Supabase error fetching IPTV categories:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch IPTV categories'
      });
    }

    const categories = [...new Set((data || [])
      .map((row) => row.category)
      .filter(Boolean))]
      .sort((a, b) => a.localeCompare(b));

    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      success: true,
      data: ['All', ...categories]
    });
  } catch (error) {
    console.error('Unexpected error fetching IPTV categories:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// @route   GET /api/iptv/channel/:id
// @desc    Fetch a single IPTV-org channel with streaming links
// @access  Public
router.get('/channel/:id', async (req, res) => {
  try {
    const channelId = normalizeQueryText(req.params.id);

    if (!channelId) {
      return res.status(400).json({
        success: false,
        message: 'Channel id is required'
      });
    }

    const { data, error } = await supabase
      .from('iptv_channels')
      .select(buildChannelDetailSelect())
      .eq('id', channelId)
      .maybeSingle();

    if (error) {
      console.error('Supabase error fetching IPTV channel:', error.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch IPTV channel'
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: 'Channel not found'
      });
    }

    const streams = Array.isArray(data.iptv_streams)
      ? data.iptv_streams
        .filter((stream) => stream?.url)
        .sort((a, b) => Number(b?.is_working === true) - Number(a?.is_working === true))
      : [];

    if (streams.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No streams found for this channel'
      });
    }

    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      success: true,
      data: {
        ...data,
        iptv_streams: streams
      }
    });
  } catch (error) {
    console.error('Unexpected error fetching IPTV channel:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Generate M3U URL from credentials
const generateM3UFromCredentials = (serverUrl, username, password) => {
  try {
    let cleanUrl = serverUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    
    const url = new URL(cleanUrl);
    
    if (url.pathname === '/' || url.pathname === '' || url.pathname.includes('get.php')) {
      url.pathname = '/get.php';
      url.search = '';
      url.searchParams.set('username', username);
      url.searchParams.set('password', password);
      url.searchParams.set('type', 'm3u_plus');
      return url.toString();
    }
    
    url.pathname = `/${username}/${password}/m3u_plus.m3u`;
    url.search = '';
    return url.toString();
  } catch (error) {
    const baseUrl = serverUrl.trim().replace(/\/$/, '');
    const protocol = baseUrl.startsWith('http') ? '' : 'http://';
    return `${protocol}${baseUrl}/get.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&type=m3u_plus`;
  }
};

const generateEPGFromCredentials = (serverUrl, username, password) => {
  try {
    let cleanUrl = serverUrl.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`;
    }
    
    const url = new URL(cleanUrl);
    url.pathname = '/xmltv.php';
    url.search = '';
    url.searchParams.set('username', username);
    url.searchParams.set('password', password);
    return url.toString();
  } catch (error) {
    const baseUrl = serverUrl.trim().replace(/\/$/, '');
    const protocol = baseUrl.startsWith('http') ? '' : 'http://';
    return `${protocol}${baseUrl}/xmltv.php?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  }
};

// @route   GET /api/iptv/credentials
// @desc    Get user's IPTV credentials
// @access  Private
router.get('/credentials', protect, async (req, res, next) => {
  try {
    const { data: credentials, error } = await supabase
      .from('iptv_credentials')
      .select('*')
      .eq('user_id', req.user.id)
      .maybeSingle();
    
    if (error) {
      console.error('❌ Supabase Error in credentials GET:', error.message);
      throw error;
    }

    res.json({
      success: true,
      data: credentials || null
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/iptv/credentials
// @desc    Save or update IPTV credentials
// @access  Private
router.post('/credentials', protect, async (req, res, next) => {
  try {
    const { providerName, username, password, serverUrl, m3uUrl, epgUrl, m3uContent } = req.body;

    let finalM3uUrl = m3uUrl;
    let finalEpgUrl = epgUrl;

    if (serverUrl && username && password) {
      if (!m3uUrl) finalM3uUrl = generateM3UFromCredentials(serverUrl, username, password);
      if (!epgUrl) finalEpgUrl = generateEPGFromCredentials(serverUrl, username, password);
    }

    // Secure payload construction
    const upsertData = {
      user_id: req.user.id,
      provider_name: providerName || null,
      username: username || null,
      password: password || null,
      server_url: serverUrl || null,
      m3u_url: finalM3uUrl || null,
      m3u_content: m3uContent || null,
      updated_at: new Date().toISOString()
    };

    // Only add epg_url if it's explicitly allowed/exists
    if (finalEpgUrl) {
      upsertData.epg_url = finalEpgUrl;
    }

    const { data: credentials, error } = await supabase
      .from('iptv_credentials')
      .upsert(upsertData, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.error('❌ Supabase Error in credentials POST:', error.message);
      throw error;
    }

    // Clear cache when credentials change
    await supabase.from('playlist_cache').delete().eq('user_id', req.user.id);

    res.json({
      success: true,
      data: credentials
    });
  } catch (error) {
    next(error);
  }
});

const MASTER_PLAYLIST_URLS = [
  'https://iptv-org.github.io/iptv/languages/urd.m3u',
  'https://iptv-org.github.io/iptv/countries/in.m3u'
];

const getPlaylistUrlCandidates = (url) => {
  const candidates = [url];

  if (/\/categories\/sport\.m3u$/i.test(url)) {
    candidates.push(url.replace(/\/categories\/sport\.m3u$/i, '/categories/sports.m3u'));
  }

  return candidates;
};

const fetchPlaylistUrl = async (url) => {
  let lastError;

  for (const candidateUrl of getPlaylistUrlCandidates(url)) {
    try {
      const response = await axios.get(candidateUrl, {
        timeout: 20000,
        headers: { 'User-Agent': 'VLC/3.0.11' }
      });

      if (candidateUrl !== url) {
        console.log(`Resolved playlist URL alias: ${url} -> ${candidateUrl}`);
      }

      return response.data;
    } catch (error) {
      lastError = error;
      if (error?.response?.status !== 404) {
        break;
      }
    }
  }

  throw lastError;
};

// @route   GET /api/iptv/playlist
// @desc    Fetch and return M3U playlist with auto-categorization
// @access  Private
router.get('/playlist', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const streamToken = getBearerToken(req);
    const CACHE_EXPIRY_HOURS = 12;
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const userOnly = req.query.userOnly === '1' || req.query.userOnly === 'true';

    res.set('Cache-Control', 'no-store');

    // 1. Check Cache
    const { data: cache, error: cacheError } = forceRefresh || userOnly || streamToken ? { data: null, error: null } : await supabase
      .from('playlist_cache')
      .select('content, updated_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (cacheError) {
      console.error('❌ Supabase Cache Error:', cacheError.message);
    }

    if (cache) {
      const lastUpdate = new Date(cache.updated_at);
      const hoursSinceUpdate = (new Date().getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceUpdate < CACHE_EXPIRY_HOURS) {
        return res.send(cache.content);
      }
    }

    // 2. Fetch Fresh Data
    const credentials = await getUserIptvCredentials(userId);
    
    let targetUrls = userOnly ? [] : [...MASTER_PLAYLIST_URLS];
    let manualContent = '';

    if (credentials) {
      if (credentials.m3u_content) manualContent = credentials.m3u_content + '\n';
      if (credentials.m3u_url) {
        targetUrls = userOnly ? [credentials.m3u_url] : [credentials.m3u_url, ...MASTER_PLAYLIST_URLS];
      }
    }

    let rawPlaylist = manualContent;

    for (const url of targetUrls) {
      try {
        rawPlaylist += await fetchPlaylistUrl(url) + '\n';
      } catch (err) {
        console.error(`Error fetching ${url}:`, err.message);
      }
    }

    if (!rawPlaylist.trim() && !userOnly) {
        const fallback = await axios.get(MASTER_PLAYLIST_URLS[0]);
        rawPlaylist = fallback.data;
    }

    // 3. Auto-Categorization Logic
    const lines = rawPlaylist.split('\n');
    let categorizedPlaylist = '#EXTM3U\n';
    
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (line.startsWith('#EXTINF:')) {
        let metadata = line;
        let url = lines[i+1]?.trim();
        
        if (url && !url.startsWith('#')) {
          // Detect Group Title or Add based on Keywords
          if (!metadata.includes('group-title="')) {
            const lowerMeta = metadata.toLowerCase();
            const lowerUrl = url.toLowerCase();
            
            let group = 'Live TV';
            if (lowerMeta.includes('movie') || lowerUrl.includes('movie')) group = 'Movies';
            else if (lowerMeta.includes('series') || lowerUrl.includes('series') || lowerMeta.includes('s01e01')) group = 'Series';
            
            metadata = metadata.replace('#EXTINF:', `#EXTINF:-1 group-title="${group}",`);
          }
          const safeUrl = rewriteXtreamLiveUrl(url, req, credentials, streamToken);
          categorizedPlaylist += metadata + '\n' + safeUrl + '\n';
          i++;
        }
      }
    }

    // 4. Save to Cache
    if (!userOnly && !streamToken) {
      await supabase.from('playlist_cache').upsert({
        user_id: userId,
        content: categorizedPlaylist,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
    }

    res.send(categorizedPlaylist);
  } catch (error) {
    next(error);
  }
});

// @route   GET /api/iptv/live/:streamFile
// @desc    Proxy a user's Xtream live stream without exposing provider password in frontend URLs
// @access  Token query param required because video tags cannot send Authorization headers
router.get('/live/:streamFile', async (req, res, next) => {
  try {
    const user = await getUserFromStreamToken(req.query.token);
    if (!user) {
      return res.status(401).send('Unauthorized stream token');
    }

    const match = String(req.params.streamFile || '').match(/^([^./]+)(?:\.(ts|m3u8|mp4))?$/i);
    if (!match) {
      return res.status(400).send('Invalid stream id');
    }

    const streamId = match[1];
    const extension = match[2] || 'ts';

    const credentials = await getUserIptvCredentials(user.id);
    if (!credentials?.username || !credentials?.password) {
      return res.status(404).send('IPTV credentials not configured');
    }

    const targetUrl = buildXtreamLiveUrl(credentials, streamId, extension);
    if (!targetUrl) {
      return res.status(400).send('Could not build stream URL');
    }

    const response = await axios({
      method: 'GET',
      url: targetUrl,
      responseType: 'stream',
      timeout: 25000,
      headers: {
        'User-Agent': 'VLC/3.0.11',
        'Accept': '*/*',
        ...(req.headers.range ? { Range: req.headers.range } : {})
      },
      validateStatus: () => true
    });

    if (response.status >= 400) {
      response.data?.destroy?.();
      return res.status(response.status).send(`Provider stream error ${response.status}`);
    }

    res.setHeader('Cache-Control', 'no-store');
    if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
    if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);
    if (response.headers['accept-ranges']) res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
    if (response.headers['content-range']) res.setHeader('Content-Range', response.headers['content-range']);

    response.data.pipe(res);
    req.on('close', () => response.data?.destroy?.());
  } catch (error) {
    next(error);
  }
});

export default router;
