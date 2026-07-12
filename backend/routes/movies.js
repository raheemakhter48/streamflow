import express from 'express';
import '../config/env.js';
import axios from 'axios';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const CACHE_TTL_MS = Number(process.env.TMDB_CACHE_TTL_MS || 300000);
const CACHE_MAX_ENTRIES = Number(process.env.TMDB_CACHE_MAX_ENTRIES || 500);
const responseCache = new Map();

const cacheResponse = (key, data) => {
  if (responseCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
};

const getTmdbAuth = () => {
  const token = String(process.env.TMDB_API_TOKEN || '').trim();
  const apiKey = String(process.env.TMDB_API_KEY || '').trim();

  if (!token && !apiKey) {
    const error = new Error('TMDB is not configured on the server');
    error.statusCode = 503;
    throw error;
  }

  return {
    headers: token
      ? { Authorization: `Bearer ${token}`, Accept: 'application/json' }
      : { Accept: 'application/json' },
    apiKey
  };
};

const tmdbGet = async (path, params = {}) => {
  const { headers, apiKey } = getTmdbAuth();
  const cacheKey = `${path}:${JSON.stringify(params)}`;
  const cached = responseCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  try {
    const response = await axios.get(`${TMDB_BASE_URL}${path}`, {
      timeout: 10000,
      headers,
      params: {
        ...params,
        ...(apiKey ? { api_key: apiKey } : {})
      }
    });

    cacheResponse(cacheKey, response.data);
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const tmdbMessage = error.response?.data?.status_message;
    const upstreamError = new Error(tmdbMessage || 'TMDB request failed');
    upstreamError.statusCode = status === 404 ? 404 : status === 429 ? 429 : 502;
    throw upstreamError;
  }
};

const imageUrl = (path, size) => path ? `${TMDB_IMAGE_BASE_URL}/${size}${path}` : null;

const normalizeMovieCard = (movie) => ({
  id: movie.id,
  title: movie.title,
  originalTitle: movie.original_title,
  overview: movie.overview,
  poster: imageUrl(movie.poster_path, 'w500'),
  backdrop: imageUrl(movie.backdrop_path, 'w1280'),
  releaseDate: movie.release_date || null,
  rating: movie.vote_average,
  voteCount: movie.vote_count,
  genreIds: movie.genre_ids || []
});

const normalizeProvider = (provider) => ({
  id: provider.provider_id,
  name: provider.provider_name,
  logo: imageUrl(provider.logo_path, 'w92')
});

const getCategoryRequest = (category, query, originCountry) => {
  if (query) {
    return {
      path: '/search/movie',
      params: { query, include_adult: false }
    };
  }

  const discoverParams = originCountry
    ? { with_origin_country: originCountry }
    : {};

  if (category.startsWith('genre:')) {
    return {
      path: '/discover/movie',
      params: {
        ...discoverParams,
        with_genres: category.slice('genre:'.length),
        include_adult: false,
        include_video: false,
        sort_by: 'popularity.desc'
      }
    };
  }

  if (originCountry) {
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);
    const nextMonth = new Date(today);
    nextMonth.setDate(today.getDate() + 45);
    const nextMonthIso = nextMonth.toISOString().slice(0, 10);
    const lastMonth = new Date(today);
    lastMonth.setDate(today.getDate() - 45);
    const lastMonthIso = lastMonth.toISOString().slice(0, 10);

    const categoryParams = {
      popular: { sort_by: 'popularity.desc' },
      top_rated: { sort_by: 'vote_average.desc', 'vote_count.gte': 50 },
      now_playing: {
        sort_by: 'popularity.desc',
        'primary_release_date.gte': lastMonthIso,
        'primary_release_date.lte': todayIso
      },
      upcoming: {
        sort_by: 'popularity.desc',
        'primary_release_date.gte': todayIso,
        'primary_release_date.lte': nextMonthIso
      }
    };

    return {
      path: '/discover/movie',
      params: {
        ...discoverParams,
        ...(categoryParams[category] || categoryParams.popular),
        include_adult: false,
        include_video: false
      }
    };
  }

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const nextMonth = new Date(today);
  nextMonth.setDate(today.getDate() + 45);
  const nextMonthIso = nextMonth.toISOString().slice(0, 10);
  const lastMonth = new Date(today);
  lastMonth.setDate(today.getDate() - 45);
  const lastMonthIso = lastMonth.toISOString().slice(0, 10);

  const categoryParams = {
    popular: { sort_by: 'popularity.desc' },
    top_rated: { sort_by: 'vote_average.desc', 'vote_count.gte': 200 },
    now_playing: {
      sort_by: 'popularity.desc',
      'primary_release_date.gte': lastMonthIso,
      'primary_release_date.lte': todayIso
    },
    upcoming: {
      sort_by: 'popularity.desc',
      'primary_release_date.gte': todayIso,
      'primary_release_date.lte': nextMonthIso
    }
  };

  return {
    path: '/discover/movie',
    params: {
      ...(categoryParams[category] || categoryParams.popular),
      include_adult: false,
      include_video: false
    }
  };
};

// GET /api/movies/categories
router.get('/movies/categories', protect, async (_req, res, next) => {
  try {
    const genres = await tmdbGet('/genre/movie/list', { language: 'en-US' });
    res.json({
      success: true,
      data: {
        featured: [
          { id: 'popular', name: 'Popular' },
          { id: 'now_playing', name: 'Now Playing' },
          { id: 'top_rated', name: 'Top Rated' },
          { id: 'upcoming', name: 'Upcoming' }
        ],
        genres: (genres.genres || []).map((genre) => ({
          id: `genre:${genre.id}`,
          name: genre.name
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/movies?category=popular&page=1&query=&region=PK&country=
router.get('/movies', protect, async (req, res, next) => {
  try {
    const page = Math.min(500, Math.max(1, Number.parseInt(req.query.page, 10) || 1));
    const category = String(req.query.category || 'popular').trim().toLowerCase();
    const query = String(req.query.query || '').trim().slice(0, 120);
    const region = String(req.query.region || 'US').trim().toUpperCase().slice(0, 2);
    const countryParam = String(req.query.country || '').trim().toUpperCase().slice(0, 2);
    const originCountry = /^[A-Z]{2}$/.test(countryParam) ? countryParam : '';
    const request = getCategoryRequest(category, query, originCountry);
    const data = await tmdbGet(request.path, {
      ...request.params,
      page,
      language: 'en-US',
      region
    });

    res.set('Cache-Control', 'private, max-age=120');
    res.json({
      success: true,
      data: (data.results || []).filter((movie) => movie?.id && movie?.title).map(normalizeMovieCard),
      page: data.page || page,
      totalPages: Math.min(data.total_pages || 1, 500),
      totalResults: data.total_results || 0
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/movie/:id
router.get('/movie/:id', protect, async (req, res, next) => {
  try {
    const movieId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(movieId) || movieId <= 0) {
      return res.status(400).json({ success: false, message: 'A valid TMDB movie id is required' });
    }

    const region = String(req.query.region || 'US').trim().toUpperCase().slice(0, 2);
    const details = await tmdbGet(`/movie/${movieId}`, {
      language: 'en-US',
      append_to_response: 'external_ids,videos,watch/providers'
    });
    const imdbId = details.imdb_id || details.external_ids?.imdb_id;

    const videos = details.videos?.results || [];
    const trailer = videos.find((video) =>
      video.site === 'YouTube' && video.type === 'Trailer' && video.official
    ) || videos.find((video) => video.site === 'YouTube' && video.type === 'Trailer');
    const regionProviders = details['watch/providers']?.results?.[region] || {};

    res.set('Cache-Control', 'private, max-age=300');
    return res.json({
      success: true,
      data: {
        id: details.id,
        imdbId: imdbId || null,
        title: details.title,
        originalTitle: details.original_title,
        tagline: details.tagline,
        overview: details.overview,
        poster: imageUrl(details.poster_path, 'w780'),
        backdrop: imageUrl(details.backdrop_path, 'original'),
        releaseDate: details.release_date || null,
        runtime: details.runtime,
        rating: details.vote_average,
        voteCount: details.vote_count,
        genres: details.genres || [],
        status: details.status,
        homepage: details.homepage || null,
        trailer: trailer
          ? {
              name: trailer.name,
              youtubeId: trailer.key,
              embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}`
            }
          : null,
        watchProviders: {
          region,
          attribution: 'Streaming availability data provided by JustWatch via TMDB',
          link: regionProviders.link || null,
          flatrate: (regionProviders.flatrate || []).map(normalizeProvider),
          free: (regionProviders.free || []).map(normalizeProvider),
          ads: (regionProviders.ads || []).map(normalizeProvider),
          rent: (regionProviders.rent || []).map(normalizeProvider),
          buy: (regionProviders.buy || []).map(normalizeProvider)
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
