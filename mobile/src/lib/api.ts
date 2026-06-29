// API Client for React Native Backend
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/api';

const getToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('auth_token');
  } catch (error) {
    return null;
  }
};

const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = await getToken();
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
      throw new Error(error.message || 'Request failed');
    }
    return response.json();
  } catch (error: any) {
    throw error;
  }
};

export const authAPI = {
  login: async (email: string, password: string) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) await AsyncStorage.setItem('auth_token', data.token);
    return data;
  },
  register: async (email: string, password: string) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    const token = data.token || data.data?.token;
    if (token) await AsyncStorage.setItem('auth_token', token);
    return data;
  },
  logout: async () => await AsyncStorage.removeItem('auth_token'),
  getCurrentUser: async () => apiRequest('/auth/me'),
};

export const iptvAPI = {
  getCredentials: async () => apiRequest('/iptv/credentials'),
  getRegions: async () => apiRequest('/iptv/regions'),
  getChannels: async (params: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    region?: string;
    country?: string;
  } = {}) => {
    const query = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    return apiRequest(`/iptv/channels${query ? `?${query}` : ''}`);
  },
  getCategories: async (params: {region?: string; country?: string} = {}) => {
    const query = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== '')
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
      .join('&');
    return apiRequest(`/iptv/categories${query ? `?${query}` : ''}`);
  },
  saveCredentials: async (credentials: any) => apiRequest('/iptv/credentials', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  getPlaylist: async () => {
    const token = await getToken();
    const response = await fetch(`${API_URL}/iptv/playlist`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.text();
  },
  getEPG: async () => {
    const token = await getToken();
    const response = await fetch(`${API_URL}/iptv/epg`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.text();
  },
};

export const streamAPI = {
  /**
   * 12k channels ke liye Smart Proxy:
   * Agar stream URL direct block hai, to backend proxy use karega.
   * Hum headers bhi pass kar rahe hain jo backend proxy use kar sake.
   */
  getProxyUrl: (streamUrl: string) => {
    if (!streamUrl) return '';

    // Encode the URL and add common IPTV headers for the backend to use
    const encodedUrl = encodeURIComponent(streamUrl);
    const userAgent = encodeURIComponent('VLC/3.0.11');

    // Backend should be configured to read these query params
    return `${API_URL}/stream/proxy?url=${encodedUrl}&agent=${userAgent}`;
  },

  resolveUrl: async (streamUrl: string) => {
    try {
      const response = await fetch(
        `${API_URL}/stream/resolve?url=${encodeURIComponent(streamUrl)}`
      );
      return await response.json();
    } catch (error) {
      return { success: false, finalUrl: streamUrl };
    }
  },
};

export const favoritesAPI = {
  getFavorites: async () => {
    const data = await apiRequest('/favorites');
    return data.data || [];
  },
  addFavorite: async (channel: any) => apiRequest('/favorites', {
    method: 'POST',
    body: JSON.stringify(channel),
  }),
  removeFavorite: async (url: string) => apiRequest(`/favorites/${encodeURIComponent(url)}`, {
    method: 'DELETE',
  }),
};

export const recentlyWatchedAPI = {
  getRecentlyWatched: async () => {
    const data = await apiRequest('/favorites/recently-watched');
    return data.data || [];
  },
  addRecentlyWatched: async (channel: any) => apiRequest('/favorites/recently-watched', {
    method: 'POST',
    body: JSON.stringify(channel),
  }),
};
