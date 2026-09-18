import express from 'express';
import '../config/env.js';
import axios from 'axios';
import { protect } from '../middleware/auth.js';

const router = express.Router();
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';
const ALLOWED_IMAGE_SIZES = new Set(['w92', 'w154', 'w185', 'w342', 'w500', 'w780', 'w1280', 'original']);
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
    const error = new Error('Movie catalog is not configured on the server');
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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientTmdbError = (error) => {
  const status = error.response?.status;
  if (!status) return true; // network error / timeout — no response at all
  return status >= 500;
};

const tmdbGet = async (path, params = {}, retriesLeft = 2) => {
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
    if (retriesLeft > 0 && isTransientTmdbError(error)) {
      await sleep(300);
      return tmdbGet(path, params, retriesLeft - 1);
    }

    const status = error.response?.status;
    const upstreamError = new Error('Movie catalog request failed');
    upstreamError.statusCode = status && status >= 400 && status < 500 ? status : 502;
    throw upstreamError;
  }
};

const imageUrl = (path, size) => {
  if (!path) return null;
  const cleanPath = String(path).startsWith('/') ? String(path) : `/${path}`;
  return `/api/movies/assets/${encodeURIComponent(size)}${cleanPath}`;
};

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

const emptyWatchProviders = (region) => ({
  region,
  attribution: '',
  link: null,
  flatrate: [],
  free: [],
  ads: [],
  rent: [],
  buy: []
});

const getCategoryRequest = (category, query, originCountry, sort) => {
  if (query) {
    return {
      path: '/search/movie',
      params: { query, include_adult: false }
    };
  }

  const discoverParams = originCountry
    ? { with_origin_country: originCountry }
    : {};

  const todayIso = new Date().toISOString().slice(0, 10);

  let sortParams = {};
  if (sort === 'newest') {
    sortParams = {
      sort_by: 'primary_release_date.desc',
      'primary_release_date.lte': todayIso
    };
  } else if (sort === 'oldest') {
    sortParams = {
      sort_by: 'primary_release_date.asc',
      'primary_release_date.gte': '1900-01-01'
    };
  } else if (sort === 'top_rated') {
    sortParams = {
      sort_by: 'vote_average.desc',
      'vote_count.gte': 10
    };
  } else if (sort === 'popular') {
    sortParams = {
      sort_by: 'popularity.desc'
    };
  }

  if (category.startsWith('genre:')) {
    return {
      path: '/discover/movie',
      params: {
        ...discoverParams,
        with_genres: category.slice('genre:'.length),
        include_adult: false,
        include_video: false,
        sort_by: sortParams.sort_by || 'popularity.desc',
        ...sortParams
      }
    };
  }

  const today = new Date();
  const nextMonth = new Date(today);
  nextMonth.setDate(today.getDate() + 45);
  const nextMonthIso = nextMonth.toISOString().slice(0, 10);
  const lastMonth = new Date(today);
  lastMonth.setDate(today.getDate() - 45);
  const lastMonthIso = lastMonth.toISOString().slice(0, 10);

  const categoryParams = {
    popular: { sort_by: 'popularity.desc' },
    top_rated: { sort_by: 'vote_average.desc', 'vote_count.gte': 10 },
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

  const selectedCategoryParams = sortParams.sort_by
    ? sortParams
    : (categoryParams[category] || categoryParams.popular);

  return {
    path: '/discover/movie',
    params: {
      ...discoverParams,
      ...selectedCategoryParams,
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

// GET /api/movies/assets/:size/*
router.get('/movies/assets/:size/*', async (req, res, next) => {
  try {
    const size = String(req.params.size || '').trim();
    const assetPath = `/${String(req.params[0] || '').replace(/^\/+/, '')}`;

    if (!ALLOWED_IMAGE_SIZES.has(size) || !/^\/[A-Za-z0-9_./-]+$/.test(assetPath)) {
      return res.status(400).json({ success: false, message: 'Invalid movie asset request' });
    }

    const response = await axios.get(`${TMDB_IMAGE_BASE_URL}/${size}${assetPath}`, {
      responseType: 'stream',
      timeout: 10000
    });

    res.set({
      'Content-Type': response.headers['content-type'] || 'image/jpeg',
      'Cache-Control': 'public, max-age=86400, s-maxage=604800',
      'X-Content-Type-Options': 'nosniff'
    });

    response.data.pipe(res);
  } catch (error) {
    next(error);
  }
});

// GET /api/movies?category=popular&page=1&query=&region=PK&country=&sort=newest
router.get('/movies', protect, async (req, res, next) => {
  try {
    const page = Math.min(500, Math.max(1, Number.parseInt(req.query.page, 10) || 1));
    const category = String(req.query.category || 'popular').trim().toLowerCase();
    const query = String(req.query.query || '').trim().slice(0, 120);
    const region = String(req.query.region || 'US').trim().toUpperCase().slice(0, 2);
    const countryParam = String(req.query.country || '').trim().toUpperCase().slice(0, 2);
    const sort = String(req.query.sort || '').trim().toLowerCase();
    const originCountry = /^[A-Z]{2}$/.test(countryParam)
      ? countryParam
      : (/^[A-Z]{2}$/.test(region) && region !== 'US' ? region : '');
    const request = getCategoryRequest(category, query, originCountry, sort);
    let data;

    try {
      data = await tmdbGet(request.path, {
        ...request.params,
        page,
        language: 'en-US',
        region
      });
    } catch (categoryError) {
      if (query || (category === 'popular' && page === 1)) {
        throw categoryError;
      }

      const fallbackRequest = getCategoryRequest('popular', '', '', sort);
      data = await tmdbGet(fallbackRequest.path, {
        ...fallbackRequest.params,
        page: 1,
        language: 'en-US',
        region
      });
    }

    let moviesList = (data.results || []).filter((movie) => movie?.id && movie?.title).map(normalizeMovieCard);

    if (sort === 'newest') {
      moviesList.sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || ''));
    } else if (sort === 'oldest') {
      moviesList.sort((a, b) => {
        if (!a.releaseDate) return 1;
        if (!b.releaseDate) return -1;
        return a.releaseDate.localeCompare(b.releaseDate);
      });
    }

    res.set('Cache-Control', 'private, max-age=120');
    res.json({
      success: true,
      data: moviesList,
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
      return res.status(400).json({ success: false, message: 'A valid movie id is required' });
    }

    const region = String(req.query.region || 'US').trim().toUpperCase().slice(0, 2);
    let details;
    let externalIds = {};
    let videos = [];
    let watchProviderResults = {};

    try {
      details = await tmdbGet(`/movie/${movieId}`, {
        language: 'en-US',
        append_to_response: 'external_ids,videos,watch/providers'
      });
      externalIds = details.external_ids || {};
      videos = details.videos?.results || [];
      watchProviderResults = details['watch/providers']?.results || {};
    } catch (combinedError) {
      details = await tmdbGet(`/movie/${movieId}`, { language: 'en-US' });

      const [externalIdsResult, videosResult, providersResult] = await Promise.allSettled([
        tmdbGet(`/movie/${movieId}/external_ids`),
        tmdbGet(`/movie/${movieId}/videos`, { language: 'en-US' }),
        tmdbGet(`/movie/${movieId}/watch/providers`)
      ]);

      if (externalIdsResult.status === 'fulfilled') externalIds = externalIdsResult.value || {};
      if (videosResult.status === 'fulfilled') videos = videosResult.value?.results || [];
      if (providersResult.status === 'fulfilled') watchProviderResults = providersResult.value?.results || {};
    }

    const imdbId = details.imdb_id || details.external_ids?.imdb_id;

    const trailer = videos.find((video) =>
      video.site === 'YouTube' && video.type === 'Trailer' && video.official
    ) || videos.find((video) => video.site === 'YouTube' && video.type === 'Trailer');
    const regionProviders = watchProviderResults?.[region] || {};

    res.set('Cache-Control', 'private, max-age=300');
    return res.json({
      success: true,
      data: {
        id: details.id,
        imdbId: imdbId || externalIds?.imdb_id || null,
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
        watchProviders: regionProviders ? {
          ...emptyWatchProviders(region),
          link: regionProviders.link || null,
          flatrate: (regionProviders.flatrate || []).map(normalizeProvider),
          free: (regionProviders.free || []).map(normalizeProvider),
          ads: (regionProviders.ads || []).map(normalizeProvider),
          rent: (regionProviders.rent || []).map(normalizeProvider),
          buy: (regionProviders.buy || []).map(normalizeProvider)
        } : emptyWatchProviders(region)
      }
    });
  } catch (error) {
    next(error);
  }
});

const normalizeSeriesCard = (show) => ({
  id: show.id,
  title: show.name || show.title,
  originalTitle: show.original_name || show.original_title,
  overview: show.overview,
  poster: imageUrl(show.poster_path, 'w500'),
  backdrop: imageUrl(show.backdrop_path, 'w1280'),
  firstAirDate: show.first_air_date || null,
  rating: show.vote_average,
  voteCount: show.vote_count,
  genreIds: show.genre_ids || []
});

// GET /api/series?category=popular&page=1&query=
router.get('/series', protect, async (req, res, next) => {
  try {
    const page = Math.min(500, Math.max(1, Number.parseInt(req.query.page, 10) || 1));
    const query = String(req.query.query || '').trim().slice(0, 120);

    let path = query ? '/search/tv' : '/discover/tv';
    let params = query
      ? { query, include_adult: false, page }
      : { sort_by: 'popularity.desc', include_adult: false, page };

    const data = await tmdbGet(path, params);
    const seriesList = (data.results || []).filter((show) => show?.id && (show?.name || show?.title)).map(normalizeSeriesCard);

    res.set('Cache-Control', 'private, max-age=120');
    res.json({
      success: true,
      data: seriesList,
      page: data.page || page,
      totalPages: Math.min(data.total_pages || 1, 500),
      totalResults: data.total_results || 0
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/series/:id
router.get('/series/:id', protect, async (req, res, next) => {
  try {
    const seriesId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(seriesId) || seriesId <= 0) {
      return res.status(400).json({ success: false, message: 'A valid series id is required' });
    }

    const details = await tmdbGet(`/tv/${seriesId}`, {
      language: 'en-US',
      append_to_response: 'external_ids'
    });

    res.set('Cache-Control', 'private, max-age=300');
    res.json({
      success: true,
      data: {
        id: details.id,
        imdbId: details.external_ids?.imdb_id || details.imdb_id || null,
        title: details.name || details.title,
        overview: details.overview,
        poster: imageUrl(details.poster_path, 'w780'),
        backdrop: imageUrl(details.backdrop_path, 'original'),
        firstAirDate: details.first_air_date || null,
        numberOfSeasons: details.number_of_seasons || 1,
        numberOfEpisodes: details.number_of_episodes || 1,
        seasons: (details.seasons || []).map(s => ({
          seasonNumber: s.season_number,
          name: s.name,
          episodeCount: s.episode_count,
          poster: imageUrl(s.poster_path, 'w342')
        })).filter(s => s.seasonNumber > 0),
        rating: details.vote_average,
        genres: details.genres || []
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/series/:id/season/:seasonNumber
router.get('/series/:id/season/:seasonNumber', protect, async (req, res, next) => {
  try {
    const seriesId = Number.parseInt(req.params.id, 10);
    const seasonNumber = Number.parseInt(req.params.seasonNumber, 10) || 1;

    const data = await tmdbGet(`/tv/${seriesId}/season/${seasonNumber}`, { language: 'en-US' });

    res.set('Cache-Control', 'private, max-age=300');
    res.json({
      success: true,
      data: {
        seasonNumber: data.season_number,
        name: data.name,
        episodes: (data.episodes || []).map(ep => ({
          episodeNumber: ep.episode_number,
          name: ep.name,
          overview: ep.overview,
          stillPath: imageUrl(ep.still_path, 'w500'),
          airDate: ep.air_date,
          rating: ep.vote_average
        }))
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
