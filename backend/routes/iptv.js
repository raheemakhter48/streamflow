import express from 'express';
import axios from 'axios';
import { protect } from '../middleware/auth.js';
import supabase from '../config/supabase.js';

const router = express.Router();

const DEFAULT_CHANNEL_LIMIT = 30;
const MAX_CHANNEL_LIMIT = 100;

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeQueryText = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
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
    const CACHE_EXPIRY_HOURS = 12;
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const userOnly = req.query.userOnly === '1' || req.query.userOnly === 'true';

    res.set('Cache-Control', 'no-store');

    // 1. Check Cache
    const { data: cache, error: cacheError } = forceRefresh || userOnly ? { data: null, error: null } : await supabase
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
    const { data: credentials } = await supabase
      .from('iptv_credentials')
      .select('*')
      .eq('user_id', userId)
      .single();
    
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
          categorizedPlaylist += metadata + '\n' + url + '\n';
          i++;
        }
      }
    }

    // 4. Save to Cache
    if (!userOnly) {
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

export default router;
