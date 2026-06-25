// API Client for Backend
const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  '/api';
const API_URL = API_BASE_URL.replace(/\/$/, '').endsWith('/api')
  ? API_BASE_URL.replace(/\/$/, '')
  : `${API_BASE_URL.replace(/\/$/, '')}/api`;

// Get auth token from localStorage
const getToken = () => {
  return localStorage.getItem('auth_token');
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
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('application/json')) {
    throw new Error('API returned HTML instead of JSON. Check the backend URL/deployment.');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'Request failed');
  }

  return data;
};

// Auth API
export const authAPI = {
  register: async (email: string, password: string) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const token = data.token || data.data?.token;
    if (token) {
      localStorage.setItem('auth_token', token);
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
      localStorage.setItem('auth_token', token);
    }
    return data;
  },

  logout: () => {
    localStorage.removeItem('auth_token');
  },

  getCurrentUser: async () => {
    return apiRequest('/auth/me');
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
  getProxyUrl: (streamUrl: string) => {
    return `${API_URL}/stream/proxy?url=${encodeURIComponent(streamUrl)}`;
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

export const adminAPI = {
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
};
