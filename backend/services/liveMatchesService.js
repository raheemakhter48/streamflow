import axios from 'axios';

let matchesCache = {
  timestamp: 0,
  data: [],
};

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes cache for live event accuracy

// Scrape stream links from a specific match watch page
export const scrapeMatchStreams = async (watchUrl) => {
  if (!watchUrl) return [];

  try {
    const res = await axios.get(watchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      timeout: 5000,
    });

    const html = res.data;
    const sources = [];

    // 1. Direct m3u8 streams
    const m3u8Matches = html.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi) || [];
    for (const u of m3u8Matches) {
      let actualUrl = u;
      if (u.includes('?id=')) {
        const parts = u.split('?id=');
        if (parts[1]) actualUrl = decodeURIComponent(parts[1]);
      }
      sources.push({
        name: `Server ${sources.length + 1} (Direct HD)`,
        url: actualUrl,
        quality: '1080p HD',
      });
    }

    // 2. Event Player Iframes (e.g. api.touchcric.vip, api.sportzf.com)
    const iframeMatches = html.match(/<iframe[^>]*src="([^"]+)"/gi) || [];
    for (const ifr of iframeMatches) {
      const srcMatch = ifr.match(/src="([^"]+)"/i);
      if (srcMatch && srcMatch[1]) {
        const embedUrl = srcMatch[1];
        // Ensure it's not a dummy tracking or ad iframe
        if (embedUrl.includes('player') || embedUrl.includes('stream') || embedUrl.includes('touchcric') || embedUrl.includes('sportzf') || embedUrl.includes('drm')) {
          sources.push({
            name: `Server ${sources.length + 1} (Live Match HD)`,
            url: embedUrl,
            quality: '1080p HD',
            type: 'embed',
          });
        }
      }
    }

    return sources;
  } catch (err) {
    console.warn('[LiveMatches] Failed to scrape watch page streams for', watchUrl, err.message);
    return [];
  }
};

export const fetchRealtimeMatches = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && matchesCache.data.length > 0 && now - matchesCache.timestamp < CACHE_TTL_MS) {
    return matchesCache.data;
  }

  try {
    const res = await axios.get('https://live.mhdtv.online/', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 8000,
    });

    const html = res.data;
    const cardRegex = /<a[^>]*href="([^"]*\/watch\/[^"]+)"[^>]*class="[^"]*match-card[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    const matches = [];

    while ((match = cardRegex.exec(html)) !== null) {
      const watchUrl = match[1];
      const cardHtml = match[2];

      // Sport
      const sportMatch = cardHtml.match(/<span[^>]*class="[^"]*border-blue-500[^"]*"[^>]*>\s*([A-Za-z]+)\s*<\/span>/i);
      const rawSport = sportMatch ? sportMatch[1].trim() : 'Cricket';
      const sport = ['Cricket', 'Football', 'Tennis', 'Basketball'].includes(rawSport) ? rawSport : 'Cricket';

      // Tournament
      const tourMatch = cardHtml.match(/<span[^>]*class="[^"]*truncate[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/span>/i);
      const tournament = tourMatch ? tourMatch[1].replace(/<[^>]+>/g, '').trim() : 'Live Tournament';

      // Teams and logos
      const imgRegex = /<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"/gi;
      let imgMatch;
      const teams = [];
      while ((imgMatch = imgRegex.exec(cardHtml)) !== null) {
        teams.push({ logo: imgMatch[1], name: imgMatch[2].trim() });
      }

      const team1 = {
        name: teams[0]?.name || 'Team 1',
        flag: teams[0]?.logo || (sport === 'Cricket' ? '🏏' : '⚽'),
      };
      const team2 = {
        name: teams[1]?.name || 'Team 2',
        flag: teams[1]?.logo || (sport === 'Cricket' ? '🏏' : '⚽'),
      };

      // Datetime & Timing
      const dateMatch = cardHtml.match(/data-start="([^"]+)"/i);
      const startIso = dateMatch ? dateMatch[1] : null;

      // Status calculation based on live indicators or current time
      let status = 'upcoming';
      let startTime = 'Today';
      let liveDurationSeconds = 1800;

      if (startIso) {
        const startDate = new Date(startIso);
        const diffMs = now - startDate.getTime();

        // If match started within the last 8 hours, it's considered live
        if (diffMs > 0 && diffMs < 8 * 60 * 60 * 1000) {
          status = 'live';
          liveDurationSeconds = Math.floor(diffMs / 1000);
          startTime = 'LIVE NOW';
        } else if (diffMs >= 8 * 60 * 60 * 1000) {
          status = 'recent';
          startTime = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
          status = 'upcoming';
          startTime = startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
      }

      // Check explicit live badge in card
      if (/class="[^"]*event-live-badge[^"]*(?!hidden)"/i.test(cardHtml) || /animate-pulse[^>]*>LIVE</i.test(cardHtml)) {
        status = 'live';
        startTime = 'LIVE NOW';
      }

      // Unique ID from URL
      const id = watchUrl.split('/watch/')[1] || `match-${matches.length + 1}`;

      matches.push({
        id,
        sport,
        tournament,
        status,
        team1,
        team2,
        startTime,
        liveDurationSeconds,
        watchUrl,
        sources: [], // Will be populated with unique match stream
      });
    }

    // Pre-resolve stream sources for live matches concurrently in parallel
    const liveMatches = matches.filter((m) => m.status === 'live');
    await Promise.allSettled(
      liveMatches.map(async (m) => {
        try {
          const matchStreams = await scrapeMatchStreams(m.watchUrl);
          if (matchStreams && matchStreams.length > 0) {
            m.sources = matchStreams;
          }
        } catch {}
      })
    );

    if (matches.length > 0) {
      matchesCache = {
        timestamp: now,
        data: matches,
      };
      return matches;
    }
  } catch (err) {
    console.warn('[LiveMatches] Failed to fetch live matches from source:', err.message);
  }

  // Return cached if available
  return matchesCache.data;
};
