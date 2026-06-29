export type ContentType = 'live' | 'movie' | 'series';

export interface Channel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
  tvgName?: string;
  tvgLogo?: string;
  isHD?: boolean;
  type?: ContentType;
  isWorking?: boolean;
  playbackSupport?: 'browser' | 'external';
  country?: string;
  source?: 'iptv-org' | 'm3u';
  alternateUrls?: string[];
}

export interface IptvRegion {
  code: string;
  name: string;
  countries: string[];
}

export interface User {
  id: string;
  email: string;
}

export interface IPTVCredentials {
  providerName?: string;
  username?: string;
  password?: string;
  serverUrl?: string;
  m3uUrl?: string;
  m3uContent?: string;
}

export interface Favorite {
  _id: string;
  channelName: string;
  channelUrl: string;
  channelLogo?: string;
  category?: string;
}

export interface RecentlyWatched {
  _id: string;
  channelName: string;
  channelUrl: string;
  channelLogo?: string;
  category?: string;
  watchedAt: string;
}

