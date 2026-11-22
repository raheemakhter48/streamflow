import axios from 'axios';
import { createCatalogCache } from './catalogCache.js';

// Cache extracted direct streams for 1 hour
const streamCache = createCatalogCache({
  ttlMs: 60 * 60 * 1000,
  maxEntries: 1000,
});

/**
 * Validates if an extracted stream URL is live and returns 200/206 with audio/video
 */
async function verifyStreamUrl(url, headers = {}) {
  try {
    const res = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers,
      },
      timeout: 5000,
      maxRedirects: 5,
    });
    const contentType = res.headers['content-type'] || '';
    const bodySample = typeof res.data === 'string' ? res.data.slice(0, 100) : '';
    const isM3u8 = contentType.includes('mpegurl') || bodySample.includes('#EXTM3U') || url.includes('.m3u8');
    const isMp4 = contentType.includes('video/mp4') || url.includes('.mp4');
    return isM3u8 || isMp4;
  } catch {
    return false;
  }
}

/**
 * Extracts a direct HLS (.m3u8) or MP4 stream for a movie or TV show.
 */
export async function extractMovieStream(tmdbId, imdbId = null, type = 'movie', season = 1, episode = 1) {
  const cacheKey = `${type}:${tmdbId || imdbId}:${season}:${episode}`;

  return streamCache.get(cacheKey, async () => {
    const id = tmdbId || imdbId;
    if (!id) return { success: false, direct: false, message: 'Missing TMDB or IMDb ID' };

    // Strategy 1: Open stream resolver endpoints
    const candidateApis = [
      type === 'tv'
        ? `https://vidsrc.stream/embed/tv/${id}/${season}/${episode}`
        : `https://vidsrc.stream/embed/movie/${id}`,
      type === 'tv'
        ? `https://autoembed.to/tv/tmdb/${id}-${season}-${episode}`
        : `https://autoembed.to/movie/tmdb/${id}`,
    ];

    for (const endpoint of candidateApis) {
      try {
        const response = await axios.get(endpoint, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': 'https://streamhubflow.qzz.io/',
          },
          timeout: 4000,
        });

        const html = typeof response.data === 'string' ? response.data : '';
        // Check for direct m3u8 in file: "..." or source: "..."
        const m3u8Match = html.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)["']/);
        if (m3u8Match && m3u8Match[1]) {
          const streamUrl = m3u8Match[1];
          const isValid = await verifyStreamUrl(streamUrl);
          if (isValid) {
            return {
              success: true,
              direct: true,
              streamUrl,
              quality: 'auto',
              subtitles: [],
              provider: 'HLS Native Extractor',
            };
          }
        }
      } catch {
        // Continue to next strategy if an endpoint times out
      }
    }

    return {
      success: false,
      direct: false,
      message: 'Direct HLS stream unavailable for this title. Please use smart embed backup.',
    };
  });
}
