// API Client for Backend
// Web builds use same-origin /api so the backend host is not exposed in DevTools.
// Desktop builds cannot rely on host rewrites, so they may still use an explicit API URL.
const API_BASE_URL =
  import.meta.env.VITE_DESKTOP === 'true'
    ? import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api'
    : '/api';
const API_URL = API_BASE_URL.replace(/\/$/, '').endsWith('/api')
  ? API_BASE_URL.replace(/\/$/, '')
  : `${API_BASE_URL.replace(/\/$/, '')}/api`;

// Get auth token from localStorage
const getToken = () => {
  return localStorage.getItem('auth_token');
};

// A second tab can change accounts while this tab still renders private data.
window.addEventListener('storage', (event) => {
  if (event.key === 'auth_token' || event.key === null) window.location.reload();
});

const setAuthToken = (token: string) => {
  localStorage.removeItem('streamflow_recently_watched_movies');
  localStorage.removeItem('guest_name');
  localStorage.setItem('auth_token', token);
};

export const ADMIN_SESSION_STORAGE_KEY = 'streamflow_admin_session';

const getAdminSessionToken = () => {
  return localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
};

export const toPasswordlessStreamUrl = (streamUrl: string) => {
  if (!streamUrl) return streamUrl;

  try {
    const parsed = new URL(streamUrl, window.location.origin);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const liveIndex = parts.findIndex((part) => part.toLowerCase() === 'live');

    if (liveIndex === -1 || parts.length < liveIndex + 4) return streamUrl;

    const streamFile = parts[liveIndex + 3] || '';
    const match = streamFile.match(/^([^./]+)(?:\.(ts|m3u8|mp4))?$/i);
    const token = getToken();

    if (!match || !token) return streamUrl;

    const streamId = match[1];
    const extension = match[2] || 'ts';
    return `${API_URL}/iptv/live/${encodeURIComponent(streamId)}.${extension}?token=${encodeURIComponent(token)}`;
  } catch {
    return streamUrl;
  }
};

// API request helper
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getToken();
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...(endpoint.startsWith('/admin') && endpoint !== '/admin/login' && getAdminSessionToken()
        ? { 'X-Admin-Session': getAdminSessionToken() as string }
        : {}),
      ...options.headers,
    },
  });

  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    if (!response.ok) {
      throw new Error(`Backend unavailable (${response.status}). Please retry.`);
    }
    throw new Error('API returned HTML instead of JSON. Check the backend URL/deployment.');
  }

  const data = await response.json();

  if (token !== getToken() && !['/auth/login', '/auth/register', '/auth/guest'].includes(endpoint)) {
    throw new Error('Account changed. Please retry.');
  }

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
};

// Auth API
let currentUserRequest: { token: string; promise: ReturnType<typeof apiRequest> } | null = null;

export const authAPI = {
  register: async (email: string, password: string) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const token = data.token || data.data?.token;
    if (token) {
      setAuthToken(token);
    }
    return data;
  },

  login: async (email: string, password: string) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const token = data.token || data.data?.token;
    if (token) {
      setAuthToken(token);
    }
    return data;
  },

  guestLogin: async (name: string) => {
    const data = await apiRequest('/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    const token = data.token || data.data?.token;
    if (token) {
      setAuthToken(token);
    }
    if (data.user?.name) {
      localStorage.setItem('guest_name', data.user.name);
    }
    return data;
  },

  logout: () => {
    localStorage.removeItem('streamflow_recently_watched_movies');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('guest_name');
  },

  getCurrentUser: async () => {
    const token = getToken();
    if (!token) return { success: false, user: null };
    if (currentUserRequest?.token === token) return currentUserRequest.promise;
    const promise = apiRequest('/auth/me').finally(() => {
      if (currentUserRequest?.promise === promise) currentUserRequest = null;
    });
    currentUserRequest = { token, promise };
    return promise;
  },
};

// IPTV API
export const iptvAPI = {
  getCredentials: async () => {
    return apiRequest('/iptv/credentials');
  },

  getRegions: async () => {
    return apiRequest('/iptv/regions');
  },

  getChannels: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    region?: string;
    country?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        searchParams.set(key, String(value));
      }
    });

    const query = searchParams.toString();
    return apiRequest(`/iptv/channels${query ? `?${query}` : ''}`);
  },

  getChannel: async (channelId: string) => {
    return apiRequest(`/iptv/channel/${encodeURIComponent(channelId)}`);
  },

  checkChannels: async (channels: Array<{
    name: string;
    url: string;
    alternateUrls?: string[];
  }>) => {
    return apiRequest('/iptv/channels/check', {
      method: 'POST',
      body: JSON.stringify({ channels }),
    });
  },

  getCategories: async (params: {
    region?: string;
    country?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        searchParams.set(key, String(value));
      }
    });

    const query = searchParams.toString();
    return apiRequest(`/iptv/categories${query ? `?${query}` : ''}`);
  },

  saveCredentials: async (credentials: {
    providerName?: string;
    username?: string;
    password?: string;
    serverUrl?: string;
    m3uUrl?: string;
    epgUrl?: string;
    m3uContent?: string;
  }) => {
    return apiRequest('/iptv/credentials', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  getPlaylist: async (options: { refresh?: boolean; userOnly?: boolean } = {}) => {
    const searchParams = new URLSearchParams();
    if (options.refresh) searchParams.set('refresh', '1');
    if (options.userOnly) searchParams.set('userOnly', '1');

    const query = searchParams.toString();
    const response = await fetch(`${API_URL}/iptv/playlist${query ? `?${query}` : ''}`, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Cache-Control': 'no-cache',
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch playlist' }));
      throw new Error(error.message || 'Failed to fetch playlist');
    }
    
    return response.text();
  },

  getEPG: async () => {
    const response = await fetch(`${API_URL}/iptv/epg`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Failed to fetch EPG' }));
      throw new Error(error.message || 'Failed to fetch EPG');
    }
    
    return response.text();
  },
};

// Favorites API
export const favoritesAPI = {
  getFavorites: async () => {
    const data = await apiRequest('/favorites');
    return data.data || [];
  },

  addFavorite: async (channel: {
    channelName: string;
    channelUrl: string;
    channelLogo?: string;
    category?: string;
  }) => {
    return apiRequest('/favorites', {
      method: 'POST',
      body: JSON.stringify(channel),
    });
  },

  removeFavorite: async (channelUrl: string) => {
    return apiRequest(`/favorites/${encodeURIComponent(channelUrl)}`, {
      method: 'DELETE',
    });
  },
};

// Recently Watched API
export const recentlyWatchedAPI = {
  getRecentlyWatched: async () => {
    const data = await apiRequest('/favorites/recently-watched');
    return data.data || [];
  },

  addRecentlyWatched: async (channel: {
    channelName: string;
    channelUrl: string;
    channelLogo?: string;
    category?: string;
  }) => {
    return apiRequest('/favorites/recently-watched', {
      method: 'POST',
      body: JSON.stringify(channel),
    });
  },
};

// Stream API
export const streamAPI = {
  getProxyUrl: (streamUrl: string, region = 'auto') => {
    const params = new URLSearchParams({ url: streamUrl, region });
    return `${API_URL}/stream/proxy?${params.toString()}`;
  },

  resolveUrl: async (streamUrl: string) => {
    try {
      const response = await fetch(
        `${API_URL}/stream/resolve?url=${encodeURIComponent(streamUrl)}`
      );
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error resolving URL:', error);
      return { success: false, finalUrl: streamUrl };
    }
  },
};

const catalogCache = new Map<string, { data: Awaited<ReturnType<typeof apiRequest>>; expiresAt: number }>();
const catalogPending = new Map<string, ReturnType<typeof apiRequest>>();
let catalogToken: string | null = null;

const catalogRequest = (endpoint: string, refresh = false) => {
  const token = getToken();
  if (catalogToken !== token) {
    catalogCache.clear();
    catalogPending.clear();
    catalogToken = token;
  }
  const cached = catalogCache.get(endpoint);
  if (!refresh && cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.data);
  const pending = catalogPending.get(endpoint);
  if (pending) return pending;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25000);
  const request = apiRequest(endpoint, { signal: controller.signal }).then((data) => {
    if (getToken() === token) {
      catalogCache.delete(endpoint);
      catalogCache.set(endpoint, { data, expiresAt: Date.now() + 60000 });
      if (catalogCache.size > 60) catalogCache.delete(catalogCache.keys().next().value);
    }
    return data;
  }).catch((error) => {
    if (controller.signal.aborted) throw new Error('Movie catalog took too long to respond. Please retry.');
    throw error;
  }).finally(() => {
    window.clearTimeout(timeout);
    if (catalogPending.get(endpoint) === request) catalogPending.delete(endpoint);
  });
  catalogPending.set(endpoint, request);
  return request;
};

export const movieAPI = {
  getCategories: async () => {
    return catalogRequest('/movies/categories');
  },

  getMovies: async (params: {
    category?: string;
    page?: number;
    query?: string;
    region?: string;
    country?: string;
    sort?: string;
    audio?: 'hindi_dubbed';
  } = {}, refresh = false) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        searchParams.set(key, String(value));
      }
    });
    return catalogRequest(`/movies?${searchParams.toString()}`, refresh);
  },

  getMovie: async (movieId: string, region = 'PK', refresh = false, audio?: 'hindi_dubbed') => {
    const searchParams = new URLSearchParams({ region });
    if (audio) searchParams.set('audio', audio);
    return catalogRequest(`/movie/${encodeURIComponent(movieId)}?${searchParams.toString()}`, refresh || !!audio);
  },
};

export const adminAPI = {
  login: async (email: string, password: string) => {
    const data = await apiRequest('/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) {
      localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, data.token);
    }
    return data;
  },

  getChannels: async (params: { page?: number; search?: string; status?: string; limit?: number } = {}) => {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        searchParams.set(key, String(value));
      }
    });

    const query = searchParams.toString();
    return apiRequest(`/admin/channels${query ? `?${query}` : ''}`);
  },

  saveChannel: async (channel: any, id?: string) => {
    return apiRequest(`/admin/channels${id ? `/${id}` : ''}`, {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(channel),
    });
  },

  deleteChannel: async (id: string) => {
    return apiRequest(`/admin/channels/${id}`, { method: 'DELETE' });
  },

  getFilters: async () => {
    return apiRequest('/admin/filters');
  },

  saveFilter: async (filter: { type: 'country' | 'category'; label: string; value?: string }) => {
    return apiRequest('/admin/filters', {
      method: 'POST',
      body: JSON.stringify(filter),
    });
  },

  getSummary: async () => {
    return apiRequest('/admin/analytics/summary');
  },

  getSystemMetrics: async () => {
    return apiRequest('/admin/analytics/system');
  },

  runHealthCheck: async () => {
    return apiRequest('/admin/streams/health-check', {
      method: 'POST',
      body: JSON.stringify({ limit: 25 }),
    });
  },

  getLogs: async (limit = 100) => {
    return apiRequest(`/admin/logs?limit=${limit}`);
  },
  getDauMetrics: async (days = 7) => {
    return apiRequest(`/admin/analytics/dau?days=${days}`);
  },

  getApiMetrics: async () => {
    return apiRequest('/admin/analytics/api-metrics');
  },

  deleteFilter: async (id: string) => {
    return apiRequest(`/admin/filters/${id}`, { method: 'DELETE' });
  },

  seedFiltersFromIptv: async () => {
    return apiRequest('/admin/filters/seed-from-iptv', { method: 'POST' });
  },

  scrapeChannel: async (id: string) => {
    return apiRequest(`/admin/scrape/channel/${id}`, { method: 'POST' });
  },

  scrapeBulk: async () => {
    return apiRequest('/admin/scrape/bulk', { method: 'POST' });
  },

  getScrapeHistory: async (limit = 50) => {
    return apiRequest(`/admin/scrape/history?limit=${limit}`);
  },

  getUsers: async () => {
    return apiRequest('/admin/users');
  },
};

// Series API
export const seriesAPI = {
  getSeries: async (params: {
    category?: string;
    page?: number;
    query?: string;
  } = {}) => {
    const searchParams = new URLSearchParams();
    if (params.category) searchParams.set("category", params.category);
    if (params.page) searchParams.set("page", String(params.page));
    if (params.query) searchParams.set("query", params.query);

    const query = searchParams.toString();
    return apiRequest(`/series${query ? `?${query}` : ''}`);
  },

  getSeriesDetails: async (id: number) => {
    return apiRequest(`/series/${id}`);
  },

  getSeasonEpisodes: async (id: number, seasonNumber: number) => {
    return apiRequest(`/series/${id}/season/${seasonNumber}`);
  },
};
