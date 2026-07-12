import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { authAPI, iptvAPI, favoritesAPI, recentlyWatchedAPI } from "@/lib/api";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Heart, RefreshCw, Zap, ChevronLeft, ChevronRight, ScanSearch, X } from "lucide-react";
import { toast } from "sonner";
import ChannelCard from "@/components/ChannelCard";
import CategoryFilter from "@/components/CategoryFilter";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import MovieBrowser from "@/components/MovieBrowser";
import AdSlot from "@/components/AdSlot";
import SEO from "@/components/SEO";

export type ContentType = 'live' | 'movie' | 'series';
type DashboardView = ContentType | 'home' | 'epg';

const CHANNELS_PER_PAGE = 36;
const DEFAULT_DASHBOARD_VIEW: DashboardView = 'home';
const DASHBOARD_FILTERS_STORAGE_KEY = 'streamvault_dashboard_filters';
const M3U_CATEGORY_FILTER = 'M3U';
const DASHBOARD_VIEWS = new Set<DashboardView>(['home', 'live', 'movie', 'series', 'epg']);
const CHANNEL_VIEWS = new Set<DashboardView>(['home', 'live']);

interface Channel {
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

interface IptvRegion {
  code: string;
  name: string;
  countries: string[];
}

interface RecentlyWatched {
  channelId?: string;
  channelName: string;
  channelUrl: string;
  channelLogo?: string;
  category?: string;
  watchedAt: string;
}

interface ChannelCheckResult {
  inputUrl: string;
  workingUrl: string;
}

const getInitialPage = (value: string | null) => {
  return Math.max(1, Number.parseInt(value || "1", 10) || 1);
};

const getDashboardView = (value: string | null, fallback: DashboardView = DEFAULT_DASHBOARD_VIEW) => {
  return DASHBOARD_VIEWS.has(value as DashboardView) ? (value as DashboardView) : fallback;
};

const isChannelView = (viewMode: DashboardView) => CHANNEL_VIEWS.has(viewMode);

const getStoredDashboardFilters = () => {
  try {
    return JSON.parse(localStorage.getItem(DASHBOARD_FILTERS_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
};

const regionNameFormatter = new Intl.DisplayNames(["en"], { type: "region" });

const getCountryDisplayName = (countryCode: string) => {
  try {
    return regionNameFormatter.of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
};

const getPlaybackSupport = (url: string): "browser" | "external" => {
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

const normalizeFilterText = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

const inferChannelCountry = (name: string, group: string | undefined, countries: string[]) => {
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

const mergeUniqueChannels = (primary: Channel[], secondary: Channel[]) => {
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

const withM3uCategory = (categories: string[]) => {
  const uniqueCategories = new Set(categories);
  uniqueCategories.add(M3U_CATEGORY_FILTER);
  return ['All', M3U_CATEGORY_FILTER, ...Array.from(uniqueCategories)
    .filter((category) => category !== 'All' && category !== M3U_CATEGORY_FILTER)
    .sort((a, b) => a.localeCompare(b))];
};

const buildDashboardPath = ({
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
  const includeChannelFilters = isChannelView(viewMode) || viewMode === 'series';

  if (viewMode !== DEFAULT_DASHBOARD_VIEW) params.set("view", viewMode);
  if (includeChannelFilters && selectedRegion !== "All") params.set("region", selectedRegion);
  if (includeChannelFilters && selectedCountry !== "All") params.set("country", selectedCountry);
  if (includeChannelFilters && selectedCategory !== "All") params.set("category", selectedCategory);
  if (searchQuery.trim()) params.set("search", searchQuery.trim());
  if (includeChannelFilters && currentPage > 1) params.set("page", String(currentPage));

  const query = params.toString();
  return `/dashboard${query ? `?${query}` : ''}`;
};

const mapIptvOrgChannel = (channel: any): Channel | null => {
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

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const storedFilters = useMemo(() => getStoredDashboardFilters(), []);
  const [user, setUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<DashboardView>(
    getDashboardView(searchParams.get("view"))
  );
  const [channels, setChannels] = useState<Channel[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<RecentlyWatched[]>([]);
  const [regions, setRegions] = useState<IptvRegion[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>(["All"]);
  const [selectedRegion, setSelectedRegion] = useState(searchParams.get("region") || storedFilters.selectedRegion || "All");
  const [selectedCountry, setSelectedCountry] = useState(searchParams.get("country") || storedFilters.selectedCountry || "All");
  const [totalChannels, setTotalChannels] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchParams.get("search") || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || storedFilters.selectedCategory || "All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isCheckingChannels, setIsCheckingChannels] = useState(false);
  const [selectedChannelUrls, setSelectedChannelUrls] = useState<Set<string>>(new Set());
  const [validatedChannels, setValidatedChannels] = useState<Channel[] | null>(null);
  const [currentPage, setCurrentPage] = useState(getInitialPage(searchParams.get("page")));
  const iptvOrgRequestId = useRef(0);
  const didHydrateSearchRef = useRef(false);

  const loadFavorites = useCallback(async () => {
    try {
      const list = await favoritesAPI.getFavorites();
      setFavorites(list.map((f: any) => f.channelUrl));
    } catch (error) { console.error(error); }
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadRegions();
      loadFavorites();
      loadRecentlyWatched();
      setHasCredentials(true);
    }
  }, [user, loadFavorites]);

  const favoriteUrls = useMemo(() => new Set(favorites), [favorites]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextViewMode = getDashboardView(params.get("view"));
    const nextSelectedRegion = params.get("region") || "All";
    const nextSelectedCountry = params.get("country") || "All";
    const nextSelectedCategory = params.get("category") || "All";
    const nextSearchQuery = params.get("search") || "";
    const nextCurrentPage = getInitialPage(params.get("page"));

    setViewMode((current) => current === nextViewMode ? current : nextViewMode);
    setSelectedRegion((current) => current === nextSelectedRegion ? current : nextSelectedRegion);
    setSelectedCountry((current) => current === nextSelectedCountry ? current : nextSelectedCountry);
    setSelectedCategory((current) => current === nextSelectedCategory ? current : nextSelectedCategory);
    setSearchQuery((current) => current === nextSearchQuery ? current : nextSearchQuery);
    setDebouncedSearchQuery((current) => current === nextSearchQuery ? current : nextSearchQuery);
    setCurrentPage((current) => current === nextCurrentPage ? current : nextCurrentPage);
  }, [location.search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextSearch = searchQuery.trim();
      setDebouncedSearchQuery(nextSearch);

      if (!didHydrateSearchRef.current) {
        didHydrateSearchRef.current = true;
        return;
      }

      setCurrentPage(1);
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    if (user && isChannelView(viewMode)) {
      loadIptvOrgChannels();
    }
  }, [user, viewMode, selectedRegion, selectedCountry, selectedCategory, debouncedSearchQuery, currentPage]);

  useEffect(() => {
    setValidatedChannels(null);
    setSelectedChannelUrls(new Set());
    setIsSelectionMode(false);
  }, [viewMode, selectedRegion, selectedCountry, selectedCategory, debouncedSearchQuery, currentPage]);

  useEffect(() => {
    if (user && isChannelView(viewMode)) {
      loadCategories();
    }
  }, [user, viewMode, selectedRegion, selectedCountry]);

  useEffect(() => {
    if (isChannelView(viewMode) && selectedCategory !== "All" && !availableCategories.includes(selectedCategory)) {
      setSelectedCategory("All");
      setCurrentPage(1);
    }
  }, [availableCategories, selectedCategory, viewMode]);

  useEffect(() => {
    if (user && viewMode === 'series' && channels.length === 0) {
      loadCredentialsAndChannels();
    }
  }, [user, viewMode]);

  useEffect(() => {
    if (!user) return;

    const nextPath = buildDashboardPath({
      viewMode,
      selectedRegion,
      selectedCountry,
      selectedCategory,
      searchQuery: debouncedSearchQuery,
      currentPage,
    });

    if (`${location.pathname}${location.search}` !== nextPath) {
      navigate(nextPath, { replace: true });
    }

    localStorage.setItem(DASHBOARD_FILTERS_STORAGE_KEY, JSON.stringify({
      selectedRegion,
      selectedCountry,
      selectedCategory,
    }));
  }, [user, viewMode, selectedRegion, selectedCountry, selectedCategory, debouncedSearchQuery, currentPage, navigate, location.pathname, location.search]);

  const filteredChannels = useMemo(() => {
    let filtered = validatedChannels ? [...validatedChannels] : [...channels];

    if (viewMode === 'live') {
      return showFavoritesOnly
        ? filtered.filter((ch) => favoriteUrls.has(ch.url))
        : filtered;
    }

    if (viewMode !== 'home' && viewMode !== 'epg') {
      filtered = filtered.filter((ch) => ch.type === viewMode);
    }

    if (showFavoritesOnly) {
      filtered = filtered.filter((ch) => favoriteUrls.has(ch.url));
    }

    if (selectedCategory !== "All") {
      filtered = filtered.filter((ch) => ch.group === selectedCategory);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((ch) =>
        ch.name.toLowerCase().includes(query) ||
        (ch.group && ch.group.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [channels, validatedChannels, searchQuery, selectedCategory, showFavoritesOnly, favoriteUrls, viewMode]);

  const paginatedChannels = useMemo(() => {
    if (isChannelView(viewMode)) {
      return filteredChannels;
    }

    const startIndex = (currentPage - 1) * CHANNELS_PER_PAGE;
    const endIndex = startIndex + CHANNELS_PER_PAGE;
    return filteredChannels.slice(startIndex, endIndex);
  }, [filteredChannels, currentPage, viewMode]);

  const checkAuth = async () => {
    try {
      const data = await authAPI.getCurrentUser();
      if (!data.success || !data.user) {
        navigate("/auth");
        return;
      }
      setUser(data.user);
    } catch (error) {
      navigate("/auth");
    }
  };

  const loadCredentialsAndChannels = async () => {
    try {
      const credentialsData = await iptvAPI.getCredentials();
      if (credentialsData.success && credentialsData.data) {
        setHasCredentials(true);
        await parseM3UPlaylist();
      } else {
        setHasCredentials(false);
      }
    } catch (error: any) {
      console.error("Error loading credentials:", error);
      setHasCredentials(false);
    } finally {
      setIsLoading(false);
    }
  };

  const parseM3UPlaylist = async () => {
    try {
      setIsLoading(true);
      const isM3uFilter = selectedCategory === M3U_CATEGORY_FILTER;
      const text = await iptvAPI.getPlaylist({ refresh: isM3uFilter, userOnly: isM3uFilter });
      if (!text) return;
      
      const parsedChannels = parseM3U(text);
      setChannels(parsedChannels);
    } catch (error: any) {
      toast.error("Failed to load channels");
    } finally {
      setIsLoading(false);
    }
  };

  const loadRegions = async () => {
    try {
      const response = await iptvAPI.getRegions();
      setRegions(response.data || []);
    } catch (error) {
      console.error("Error loading IPTV regions:", error);
      toast.error("Failed to load regions");
    }
  };

  const loadCategories = async () => {
    try {
      const response = await iptvAPI.getCategories({
        region: selectedRegion === "All" ? undefined : selectedRegion,
        country: selectedCountry === "All" ? undefined : selectedCountry,
      });
      setAvailableCategories(withM3uCategory(response.data || ["All"]));
    } catch (error) {
      console.error("Error loading IPTV categories:", error);
      setAvailableCategories(["All", M3U_CATEGORY_FILTER]);
    }
  };

  const loadIptvOrgChannels = async () => {
    const requestId = iptvOrgRequestId.current + 1;
    iptvOrgRequestId.current = requestId;

    try {
      setIsLoading(true);
      const isM3uFilter = selectedCategory === M3U_CATEGORY_FILTER;
      const response = isM3uFilter
        ? { data: [], totalChannels: 0, totalPages: 1 }
        : await iptvAPI.getChannels({
          page: currentPage,
          limit: CHANNELS_PER_PAGE,
          search: debouncedSearchQuery,
          category: selectedCategory === "All" ? undefined : selectedCategory,
          region: selectedRegion === "All" ? undefined : selectedRegion,
          country: selectedCountry === "All" ? undefined : selectedCountry,
        });

      let mappedChannels = isM3uFilter
        ? []
        : (response.data || [])
          .map(mapIptvOrgChannel)
          .filter(Boolean) as Channel[];

      if (currentPage === 1) {
        const playlistMatches = await loadPersonalPlaylistMatches();
        mappedChannels = mergeUniqueChannels(mappedChannels, playlistMatches);
      }

      if (requestId !== iptvOrgRequestId.current) {
        return;
      }

      setChannels(mappedChannels);
      setTotalChannels(isM3uFilter
        ? mappedChannels.length
        : (response.totalChannels || 0) + Math.max(0, mappedChannels.length - ((response.data || []).length)));
      setTotalPages(isM3uFilter ? 1 : response.totalPages || 0);
      setHasCredentials(true);
    } catch (error: any) {
      console.error("Error loading IPTV-org channels:", error);
      toast.error(error.message || "Failed to load region channels");
    } finally {
      if (requestId === iptvOrgRequestId.current) {
        setIsLoading(false);
      }
    }
  };

  const loadPersonalPlaylistMatches = async () => {
    try {
      const text = await iptvAPI.getPlaylist({ refresh: selectedCategory === M3U_CATEGORY_FILTER });
      if (!text) return [];

      const countriesForFilter = selectedCountry !== "All"
        ? [selectedCountry]
        : selectedRegionCountries;

      return parseM3U(text, countriesForFilter)
        .filter((channel) => channel.type === "live")
        .filter((channel) => {
          if (countriesForFilter.length > 0 && channel.country && !countriesForFilter.includes(channel.country)) {
            return false;
          }

          if (countriesForFilter.length > 0 && !channel.country) {
            return false;
          }

          if (
            selectedCategory !== "All" &&
            selectedCategory !== M3U_CATEGORY_FILTER &&
            normalizeFilterText(channel.group || "") !== normalizeFilterText(selectedCategory)
          ) {
            return false;
          }

          if (debouncedSearchQuery) {
            const query = normalizeFilterText(debouncedSearchQuery);
            const textToSearch = normalizeFilterText(`${channel.name} ${channel.group || ""}`);
            if (!textToSearch.includes(query)) return false;
          }

          return true;
        })
        .slice(0, CHANNELS_PER_PAGE);
    } catch (error) {
      console.warn("Personal playlist merge skipped:", error);
      return [];
    }
  };

  const handleRefreshChannels = async () => {
    try {
      if (isChannelView(viewMode)) {
        await loadIptvOrgChannels();
      } else {
        await parseM3UPlaylist();
      }
      toast.success("Playlist refreshed!");
    } catch (error) {
      toast.error("Refresh failed");
    }
  };

  const toggleChannelSelection = (url: string) => {
    setSelectedChannelUrls((current) => {
      const next = new Set(current);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const handleSelectVisible = () => {
    const visibleUrls = paginatedChannels.map((channel) => channel.url);
    const allVisibleSelected = visibleUrls.length > 0
      && visibleUrls.every((url) => selectedChannelUrls.has(url));

    setSelectedChannelUrls((current) => {
      const next = new Set(current);
      visibleUrls.forEach((url) => {
        if (allVisibleSelected) next.delete(url);
        else next.add(url);
      });
      return next;
    });
  };

  const handleCheckSelectedChannels = async () => {
    const selectedChannels = channels.filter((channel) => selectedChannelUrls.has(channel.url));
    if (selectedChannels.length === 0) {
      toast.error("Select at least one channel");
      return;
    }

    try {
      setIsCheckingChannels(true);
      const response = await iptvAPI.checkChannels(selectedChannels.map((channel) => ({
        name: channel.name,
        url: channel.url,
        alternateUrls: channel.alternateUrls,
      })));
      const resultByUrl = new Map<string, ChannelCheckResult>(
        ((response.data || []) as ChannelCheckResult[]).map((result) => [result.inputUrl, result])
      );
      const workingChannels = selectedChannels
        .filter((channel) => resultByUrl.has(channel.url))
        .map((channel) => {
          const result = resultByUrl.get(channel.url);
          const workingUrl = result?.workingUrl || channel.url;
          return {
            ...channel,
            url: workingUrl,
            isWorking: true,
            alternateUrls: [
              workingUrl,
              ...(channel.alternateUrls || []).filter((url) => url !== workingUrl),
            ],
          };
        });

      setValidatedChannels(workingChannels);
      setSelectedChannelUrls(new Set());
      setIsSelectionMode(false);
      toast.success(`${response.working} of ${response.checked} selected channels are working`);
    } catch (error: any) {
      toast.error(error.message || "Channel check failed");
    } finally {
      setIsCheckingChannels(false);
    }
  };

  const parseM3U = (content: string, countriesForInference: string[] = []): Channel[] => {
    const lines = content.split("\n");
    const channels: Channel[] = [];
    let currentChannel: Partial<Channel> = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith("#EXTINF:")) {
        const nameMatch = line.match(/,(.+)$/);
        const logoMatch = line.match(/tvg-logo="([^"]+)"/);
        const groupMatch = line.match(/group-title="([^"]+)"/);
        const channelName = nameMatch ? nameMatch[1].trim() : "Unknown";
        const group = groupMatch ? groupMatch[1] : "Other";
        
        let type: ContentType = 'live';
        if (group) {
          const lowerGroup = group.toLowerCase();
          if (lowerGroup.includes('movie')) type = 'movie';
          else if (lowerGroup.includes('series')) type = 'series';
        }

        currentChannel = {
          name: channelName,
          logo: logoMatch ? logoMatch[1] : undefined,
          group,
          type,
          country: inferChannelCountry(channelName, group, countriesForInference),
        };
      } else if (line && !line.startsWith("#") && currentChannel.name) {
        channels.push({
          ...currentChannel,
          url: line,
          isWorking: true,
          playbackSupport: getPlaybackSupport(line),
          source: "m3u",
          alternateUrls: [line],
        } as Channel);
        currentChannel = {};
      }
    }
    return channels;
  };

  const loadRecentlyWatched = async () => {
    try {
      const list = await recentlyWatchedAPI.getRecentlyWatched();
      setRecentlyWatched(list);
    } catch (error) { console.error(error); }
  };

  const handleLogout = async () => {
    await authAPI.logout();
    navigate("/auth");
  };

  const categories = useMemo(() => {
    if (isChannelView(viewMode)) {
      return availableCategories;
    }

    const filteredForMode = viewMode === 'home' || viewMode === 'epg' 
      ? channels 
      : channels.filter(ch => ch.type === viewMode);
    const groups = new Set(filteredForMode.map(ch => ch.group || 'Other'));
    return ['All', ...Array.from(groups).sort()];
  }, [availableCategories, channels, viewMode]);

  const selectedRegionCountries = useMemo(() => {
    if (selectedRegion === "All") return [];
    const region = regions.find((item) => item.code === selectedRegion);
    return region?.countries || [];
  }, [regions, selectedRegion]);

  const selectedRegionName = useMemo(() => {
    if (selectedRegion === "All") return "";
    return regions.find((item) => item.code === selectedRegion)?.name || selectedRegion;
  }, [regions, selectedRegion]);

  const handleRegionChange = (value: string) => {
    setSelectedRegion(value);
    setSelectedCountry("All");
    setSelectedCategory("All");
    setCurrentPage(1);
  };

  const handleCountryChange = (value: string) => {
    setSelectedCountry(value);
    setSelectedCategory("All");
    setCurrentPage(1);
  };

  const openViewMode = (mode: ContentType | 'epg') => {
    setViewMode(mode);
    setCurrentPage(1);
  };

  const dashboardReturnUrl = useMemo(() => {
    return buildDashboardPath({
      viewMode,
      selectedRegion,
      selectedCountry,
      selectedCategory,
      searchQuery,
      currentPage,
    });
  }, [viewMode, selectedRegion, selectedCountry, selectedCategory, searchQuery, currentPage]);

  const viewTabs = [
    { id: 'home'   as DashboardView, label: 'All' },
    { id: 'live'   as DashboardView, label: 'Live TV' },
    { id: 'movie'  as DashboardView, label: 'Movies' },
    { id: 'series' as DashboardView, label: 'Series' },
  ];

  const renderChannelGrid = () => {
    if (isLoading && channels.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Zap className="w-10 h-10 text-[#00D7E5] animate-pulse" />
          <p className="text-gray-500 text-sm">Loading channels...</p>
        </div>
      );
    }

    if (paginatedChannels.length === 0 && !isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-gray-600 text-sm">No channels found</p>
          <button onClick={handleRefreshChannels} className="text-[#00D7E5] text-xs font-bold underline">Refresh</button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4">
        {paginatedChannels.map((channel, index) => (
          <ChannelCard
            key={`${channel.url}-${index}`}
            channel={channel}
            isFavorite={favoriteUrls.has(channel.url)}
            onToggleFavorite={loadFavorites}
            returnTo={dashboardReturnUrl}
            selectable={isSelectionMode}
            selected={selectedChannelUrls.has(channel.url)}
            onSelect={() => toggleChannelSelection(channel.url)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-20 lg:pb-0">
      <SEO
        title={`${viewMode === "movie" ? "Movies" : viewMode === "live" ? "Live TV" : "Streaming Dashboard"} - StreamFlow`}
        description="Browse live TV channels, movies, series, favorites, and recently watched content in your StreamFlow dashboard."
        path={buildDashboardPath({
          viewMode,
          selectedRegion,
          selectedCountry,
          selectedCategory,
          searchQuery: debouncedSearchQuery,
          currentPage,
        })}
      />
      <AppHeader />

      {!hasCredentials && !isLoading ? (
        /* No credentials setup screen */
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-5 text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#0f2020] border border-[#1a3030] flex items-center justify-center mb-6">
            <Zap className="w-10 h-10 text-[#00D7E5]" />
          </div>
          <h2 className="text-2xl font-black mb-2">Setup Required</h2>
          <p className="text-gray-500 text-sm mb-8 max-w-xs leading-relaxed">
            Add your IPTV credentials to access thousands of live channels.
          </p>
          <button
            onClick={() => navigate("/setup")}
            className="h-12 px-8 bg-[#00D7E5] hover:bg-[#00b8c5] text-black font-bold rounded-xl transition-colors"
          >
            Configure Provider
          </button>
        </div>
      ) : (
        <div className="px-4 max-w-lg lg:max-w-7xl mx-auto">
          {/* Category tabs — mobile only (desktop uses top nav) */}
          <div className="lg:hidden flex gap-2 pt-4 pb-3 overflow-x-auto scrollbar-hide">
            {viewTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => { setViewMode(t.id); setCurrentPage(1); }}
                className={`shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  viewMode === t.id
                    ? 'bg-[#00D7E5] text-black shadow-[0_0_12px_rgba(0,215,229,0.3)]'
                    : 'bg-[#111] border border-[#1e1e1e] text-gray-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search + filters row */}
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 pt-4 lg:pt-5 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
              <Input
                placeholder="Search channels, movies, series..."
                className="pl-10 h-11 bg-[#111] border-[#1e1e1e] rounded-xl text-sm text-white placeholder-gray-700 focus:border-[#00D7E5]/40"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
            </div>

          {/* Region + Country (live view only) */}
          {(viewMode === 'live' || viewMode === 'home') && (
            <div className="flex gap-2 lg:shrink-0">
              <Select value={selectedRegion} onValueChange={handleRegionChange}>
                <SelectTrigger className="flex-1 h-10 bg-[#111] border-[#1e1e1e] rounded-xl text-white text-xs font-bold">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#1e1e1e] text-white">
                  <SelectItem value="All">Region: Global</SelectItem>
                  {regions.map((r) => (
                    <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedCountry} onValueChange={handleCountryChange} disabled={selectedRegion === "All"}>
                <SelectTrigger className="flex-1 h-10 bg-[#111] border-[#1e1e1e] rounded-xl text-white text-xs font-bold disabled:opacity-40">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-[#1e1e1e] text-white">
                  <SelectItem value="All">Country: All</SelectItem>
                  {selectedRegionCountries.map((c) => (
                    <SelectItem key={c} value={c}>{getCountryDisplayName(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          </div>

          <AdSlot
            slot={import.meta.env.VITE_ADSENSE_DASHBOARD_SLOT || ""}
            className="mb-5 min-h-[90px]"
            format="horizontal"
          />

          {/* Continue Watching */}
          {viewMode !== 'movie' && recentlyWatched.length > 0 && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-black text-white">Continue Watching</h2>
                <button className="text-xs text-[#00D7E5] font-bold">View All</button>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1">
                {recentlyWatched.slice(0, 8).map((item, idx) => (
                  <div key={idx} className="min-w-[160px]">
                    <ChannelCard
                      channel={{ id: item.channelId, name: item.channelName, url: item.channelUrl, logo: item.channelLogo, group: item.category }}
                      isFavorite={favoriteUrls.has(item.channelUrl)}
                      onToggleFavorite={loadFavorites}
                      returnTo={dashboardReturnUrl}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {viewMode === 'movie' ? (
            <MovieBrowser searchQuery={debouncedSearchQuery} />
          ) : (
          <>
          {/* Channels header */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-black text-white">
              {viewMode === 'home' ? 'All Channels' : viewMode === 'live' ? 'Live TV' : viewMode === 'movie' ? 'Movies' : 'Series'}
            </h2>
            <div className="flex items-center gap-2">
              {validatedChannels && (
                <button
                  onClick={() => setValidatedChannels(null)}
                  className="flex items-center gap-1 rounded-lg border border-[#1e1e1e] px-2.5 py-1.5 text-xs font-bold text-gray-400 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                  Show all
                </button>
              )}
              {!validatedChannels && (
                <button
                  onClick={() => {
                    setIsSelectionMode((current) => !current);
                    setSelectedChannelUrls(new Set());
                  }}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition-colors ${
                    isSelectionMode
                      ? "border-[#00D7E5] bg-[#00D7E5]/10 text-[#00D7E5]"
                      : "border-[#1e1e1e] text-gray-400 hover:text-white"
                  }`}
                >
                  <ScanSearch className="h-3.5 w-3.5" />
                  {isSelectionMode ? "Cancel" : "Find working"}
                </button>
              )}
              {isChannelView(viewMode) && (
                <span className="text-xs text-gray-600">{totalChannels.toLocaleString()} ch</span>
              )}
              <button
                onClick={handleRefreshChannels}
                className="text-gray-600 hover:text-white transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00D7E5]' : ''}`} />
              </button>
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`transition-colors ${showFavoritesOnly ? 'text-red-500' : 'text-gray-600 hover:text-white'}`}
              >
                <Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          {isSelectionMode && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#00D7E5]/20 bg-[#00D7E5]/5 p-3">
              <div>
                <p className="text-sm font-bold text-white">Select channels to test</p>
                <p className="text-xs text-gray-500">{selectedChannelUrls.size} selected · maximum 50</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectVisible}
                  className="rounded-lg border border-[#263333] px-3 py-2 text-xs font-bold text-gray-300 hover:text-white"
                >
                  {paginatedChannels.length > 0 && paginatedChannels.every((channel) => selectedChannelUrls.has(channel.url))
                    ? "Clear visible"
                    : "Select visible"}
                </button>
                <button
                  disabled={selectedChannelUrls.size === 0 || selectedChannelUrls.size > 50 || isCheckingChannels}
                  onClick={handleCheckSelectedChannels}
                  className="flex items-center gap-1.5 rounded-lg bg-[#00D7E5] px-3 py-2 text-xs font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ScanSearch className={`h-3.5 w-3.5 ${isCheckingChannels ? "animate-pulse" : ""}`} />
                  {isCheckingChannels ? "Checking..." : "Show working"}
                </button>
              </div>
            </div>
          )}

          {/* Category filter chips */}
          <div className="mb-3">
            <CategoryFilter
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={(c) => { setSelectedCategory(c); setCurrentPage(1); }}
            />
          </div>

          {/* Channel grid */}
          {renderChannelGrid()}

          {/* Pagination (live) */}
          {isChannelView(viewMode) && !validatedChannels && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-5">
              <button
                disabled={currentPage <= 1 || isLoading}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="w-9 h-9 rounded-xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500 font-bold">{currentPage} / {Math.max(totalPages, 1)}</span>
              <button
                disabled={currentPage >= totalPages || isLoading}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="w-9 h-9 rounded-xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          </>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default Dashboard;
