export type ContentType = 'live' | 'movie' | 'series' | 'streams';
export type DashboardView = ContentType | 'home' | 'epg' | 'favorites';

export const CHANNELS_PER_PAGE = 36;
export const DEFAULT_DASHBOARD_VIEW: DashboardView = 'home';
export const DASHBOARD_FILTERS_STORAGE_KEY = 'streamvault_dashboard_filters';
export const M3U_CATEGORY_FILTER = 'M3U';
export const DASHBOARD_VIEWS = new Set<DashboardView>(['home', 'live', 'movie', 'series', 'epg', 'streams', 'favorites']);
export const CHANNEL_VIEWS = new Set<DashboardView>(['home', 'live', 'favorites']);

export interface Channel {
  id?: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  quality?: "HD" | "SD";
  type?: ContentType;
  isWorking?: boolean;
  playbackSupport?: "browser" | "external";
  country?: string;
  source?: "iptv-org" | "m3u";
  alternateUrls?: string[];
}

export interface IptvRegion {
  code: string;
  name: string;
  countries: string[];
}

export interface RecentlyWatched {
  channelId?: string;
  channelName: string;
  channelUrl: string;
  channelLogo?: string;
  category?: string;
  watchedAt: string;
}

export interface ChannelCheckResult {
  inputUrl: string;
  workingUrl: string;
}

export const getInitialPage = (value: string | null) => {
  return Math.max(1, Number.parseInt(value || "1", 10) || 1);
};

export const getDashboardView = (value: string | null, fallback: DashboardView = DEFAULT_DASHBOARD_VIEW) => {
  return DASHBOARD_VIEWS.has(value as DashboardView) ? (value as DashboardView) : fallback;
};

export const isChannelView = (viewMode: DashboardView) => CHANNEL_VIEWS.has(viewMode);

export const getStoredDashboardFilters = () => {
  try {
    return JSON.parse(localStorage.getItem(DASHBOARD_FILTERS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

export const RECENTLY_WATCHED_STORAGE_KEY = 'streamflow_cached_recently_watched';

export const getStoredRecentlyWatched = (): RecentlyWatched[] => {
  try {
    const raw = localStorage.getItem(RECENTLY_WATCHED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const regionNameFormatter = new Intl.DisplayNames(["en"], { type: "region" });

export const getCountryDisplayName = (countryCode: string) => {
  try {
    return regionNameFormatter.of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
};

export const getPlaybackSupport = (url: string): "browser" | "external" => {
  const streamUrl = String(url).toLowerCase();
  const isBrowserPlayable =
    streamUrl.includes(".m3u8") ||
    streamUrl.includes(".mp4") ||
    streamUrl.includes(".webm") ||
    streamUrl.includes(".ts") ||
    streamUrl.includes("/live/") ||
    streamUrl.includes("/play/") ||
    streamUrl.includes("/stream/");

  return isBrowserPlayable ? "browser" : "external";
};

export const normalizeFilterText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export const inferChannelCountry = (name: string, group: string | undefined, countries: string[]) => {
  const haystack = ` ${normalizeFilterText(`${name} ${group || ""}`)} `;

  for (const country of countries) {
    const countryName = normalizeFilterText(getCountryDisplayName(country));
    const code = country.toLowerCase();

    if (
      haystack.includes(` ${code} `) ||
      haystack.includes(` ${countryName} `) ||
      (country === "PK" && /\b(pak|pakistan|urdu)\b/.test(haystack)) ||
      (country === "IN" && /\b(india|indian|hindi|tamil|telugu|malayalam|kannada|punjabi|bengali)\b/.test(haystack))
    ) {
      return country;
    }
  }

  return undefined;
};

export const mergeUniqueChannels = (primary: Channel[], secondary: Channel[]) => {
  const seen = new Set(primary.map((channel) => channel.url));
  const merged = [...primary];

  secondary.forEach((channel) => {
    if (!seen.has(channel.url)) {
      seen.add(channel.url);
      merged.push(channel);
    }
  });

  return merged;
};

export const withM3uCategory = (categories: string[]) => {
  const uniqueCategories = new Set(categories);
  uniqueCategories.add(M3U_CATEGORY_FILTER);
  return ['All', M3U_CATEGORY_FILTER, ...Array.from(uniqueCategories)
    .filter((category) => category !== 'All' && category !== M3U_CATEGORY_FILTER)
    .sort((a, b) => a.localeCompare(b))];
};

export const buildDashboardPath = ({
  viewMode,
  selectedRegion,
  selectedCountry,
  selectedCategory,
  searchQuery,
  currentPage,
}: {
  viewMode: DashboardView;
  selectedRegion: string;
  selectedCountry: string;
  selectedCategory: string;
  searchQuery: string;
  currentPage: number;
}) => {
  const params = new URLSearchParams();
  const includeChannelFilters = isChannelView(viewMode);

  if (viewMode !== DEFAULT_DASHBOARD_VIEW) params.set("view", viewMode);
  if (includeChannelFilters && selectedRegion !== "All") params.set("region", selectedRegion);
  if (includeChannelFilters && selectedCountry !== "All") params.set("country", selectedCountry);
  if (includeChannelFilters && selectedCategory !== "All") params.set("category", selectedCategory);
  if (searchQuery.trim()) params.set("search", searchQuery.trim());
  if (includeChannelFilters && currentPage > 1) params.set("page", String(currentPage));

  const query = params.toString();
  return `/dashboard${query ? `?${query}` : ''}`;
};

export const mapIptvOrgChannel = (channel: any): Channel | null => {
  const streams = Array.isArray(channel.iptv_streams) ? channel.iptv_streams : [];
  const stream = streams.find((item: any) => item?.url && item?.is_working === true)
    || streams.find((item: any) => item?.url);
  const alternateUrls = [...new Set(streams
    .map((item: any) => item?.url)
    .filter(Boolean))] as string[];

  if (!stream?.url) {
    return null;
  }

  return {
    id: channel.id,
    name: channel.name,
    url: stream.url,
    logo: channel.logo_url,
    group: channel.category || channel.country || "General",
    quality: stream.resolution?.toUpperCase?.().includes("HD") ? "HD" : undefined,
    type: 'live',
    isWorking: stream.is_working === true || channel.has_working_stream === true,
    playbackSupport: getPlaybackSupport(stream.url),
    country: channel.country,
    source: "iptv-org",
    alternateUrls,
  };
};
