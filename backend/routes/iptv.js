import express from 'express';
import axios from 'axios';
import { protect } from '../middleware/auth.js';
import supabase from '../config/supabase.js';

const router = express.Router();

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

    const { data: credentials, error } = await supabase
      .from('iptv_credentials')
      .upsert({
        user_id: req.user.id,
        provider_name: providerName || null,
        username: username || null,
        password: password || null,
        server_url: serverUrl || null,
        m3u_url: finalM3uUrl || null,
        epg_url: finalEpgUrl || null,
        m3u_content: m3uContent || null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
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

// @route   GET /api/iptv/playlist
// @desc    Fetch and return M3U playlist with auto-categorization
// @access  Private
router.get('/playlist', protect, async (req, res, next) => {
  try {
    const userId = req.user.id;
    const CACHE_EXPIRY_HOURS = 12;

    // 1. Check Cache
    const { data: cache, error: cacheError } = await supabase
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
    
    let targetUrls = [...MASTER_PLAYLIST_URLS];
    let manualContent = '';

    if (credentials) {
      if (credentials.m3u_content) manualContent = credentials.m3u_content + '\n';
      if (credentials.m3u_url) targetUrls = [credentials.m3u_url, ...MASTER_PLAYLIST_URLS];
    }

    let rawPlaylist = manualContent;

    for (const url of targetUrls) {
      try {
        const response = await axios.get(url, {
          timeout: 20000,
          headers: { 'User-Agent': 'VLC/3.0.11' }
        });
        rawPlaylist += response.data + '\n';
      } catch (err) {
        console.error(`Error fetching ${url}:`, err.message);
      }
    }

    if (!rawPlaylist.trim()) {
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
    await supabase.from('playlist_cache').upsert({
      user_id: userId,
      content: categorizedPlaylist,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    res.send(categorizedPlaylist);
  } catch (error) {
    next(error);
  }
});

export default router;
