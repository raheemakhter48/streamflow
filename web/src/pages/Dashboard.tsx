import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { authAPI, iptvAPI, favoritesAPI, recentlyWatchedAPI } from "@/lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Search, Settings, Tv, Heart, Clock, RefreshCw, ChevronLeft, Film, Library, Calendar, User, Zap, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import ChannelCard from "@/components/ChannelCard";
import CategoryFilter from "@/components/CategoryFilter";

export type ContentType = 'live' | 'movie' | 'series';
type DashboardView = ContentType | 'home' | 'epg';

const CHANNELS_PER_PAGE = 36;
const DEFAULT_DASHBOARD_VIEW: DashboardView = 'home';
const DASHBOARD_FILTERS_STORAGE_KEY = 'streamvault_dashboard_filters';
const M3U_CATEGORY_FILTER = 'M3U';

interface Channel {
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
  channelName: string;
  channelUrl: string;
  channelLogo?: string;
  category?: string;
  watchedAt: string;
}

const getInitialPage = (value: string | null) => {
  return Math.max(1, Number.parseInt(value || "1", 10) || 1);
};

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

  if (viewMode !== DEFAULT_DASHBOARD_VIEW) params.set("view", viewMode);
  if (selectedRegion !== "All") params.set("region", selectedRegion);
  if (selectedCountry !== "All") params.set("country", selectedCountry);
  if (selectedCategory !== "All") params.set("category", selectedCategory);
  if (searchQuery.trim()) params.set("search", searchQuery.trim());
  if (currentPage > 1) params.set("page", String(currentPage));

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
  const [searchParams] = useSearchParams();
  const storedFilters = useMemo(() => getStoredDashboardFilters(), []);
  const [user, setUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<DashboardView>(
    (searchParams.get("view") as DashboardView) || storedFilters.viewMode || DEFAULT_DASHBOARD_VIEW
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
      setIsLoading(false);
    }
  }, [user, loadFavorites]);

  const favoriteUrls = useMemo(() => new Set(favorites), [favorites]);

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
    if (user && viewMode === 'live') {
      loadIptvOrgChannels();
    }
  }, [user, viewMode, selectedRegion, selectedCountry, selectedCategory, debouncedSearchQuery, currentPage]);

  useEffect(() => {
    if (user && viewMode === 'live') {
      loadCategories();
    }
  }, [user, viewMode, selectedRegion, selectedCountry]);

  useEffect(() => {
    if (viewMode === 'live' && selectedCategory !== "All" && !availableCategories.includes(selectedCategory)) {
      setSelectedCategory("All");
      setCurrentPage(1);
    }
  }, [availableCategories, selectedCategory, viewMode]);

  useEffect(() => {
    if (user && viewMode !== 'home' && viewMode !== 'live' && channels.length === 0) {
      loadCredentialsAndChannels();
    }
  }, [user, viewMode]);

  useEffect(() => {
    if (!user) return;

    navigate(buildDashboardPath({
      viewMode,
      selectedRegion,
      selectedCountry,
      selectedCategory,
      searchQuery,
      currentPage,
    }), { replace: true });

    localStorage.setItem(DASHBOARD_FILTERS_STORAGE_KEY, JSON.stringify({
      viewMode,
      selectedRegion,
      selectedCountry,
      selectedCategory,
    }));
  }, [user, viewMode, selectedRegion, selectedCountry, selectedCategory, searchQuery, currentPage, navigate]);

  const filteredChannels = useMemo(() => {
    let filtered = [...channels];

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
  }, [channels, searchQuery, selectedCategory, showFavoritesOnly, favoriteUrls, viewMode]);

  const paginatedChannels = useMemo(() => {
    if (viewMode === 'live') {
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
      if (viewMode === 'live') {
        await loadIptvOrgChannels();
      } else {
        await parseM3UPlaylist();
      }
      toast.success("Playlist refreshed!");
    } catch (error) {
      toast.error("Refresh failed");
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
    if (viewMode === 'live') {
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

  const renderHomeMode = () => (
    <div className="flex flex-col gap-8 sm:gap-10 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Welcome */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Streamflow" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-5xl font-black tracking-tighter italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-600 mb-2">
              STREAM VAULT
            </h1>
            <div className="flex items-center gap-2 text-gray-400 font-medium text-sm sm:text-base">
              <User className="w-4 h-4 text-cyan-500" />
              <span>Welcome back, <span className="text-white font-bold">{user?.email?.split('@')[0]}</span></span>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3 w-full lg:w-auto">
           <Button 
             variant="outline" 
             className="bg-white/5 border-white/10 hover:bg-cyan-500 hover:text-black rounded-xl px-3 sm:px-6 h-11 sm:h-12 font-bold transition-all text-xs sm:text-sm"
             onClick={() => navigate("/setup")}
           >
             <Settings className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" /> SETUP
           </Button>
           <Button
             variant="outline"
             className="bg-white/5 border-white/10 hover:bg-cyan-500 hover:text-black rounded-xl px-3 sm:px-6 h-11 sm:h-12 font-bold transition-all text-xs sm:text-sm"
             onClick={() => navigate("/settings")}
           >
             <SlidersHorizontal className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" /> SETTINGS
           </Button>
           <Button 
             variant="outline" 
             className="bg-white/5 border-white/10 hover:bg-red-500 hover:text-white rounded-xl px-3 sm:px-6 h-11 sm:h-12 font-bold transition-all text-xs sm:text-sm"
             onClick={handleLogout}
           >
             <LogOut className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" /> EXIT
           </Button>
        </div>
      </div>

      {/* Main Feature Grid (Figma Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
        {[
          { id: 'live', label: 'LIVE TV', icon: Tv, desc: 'Watch Real-time', color: 'from-cyan-500/20' },
          { id: 'movie', label: 'MOVIES', icon: Film, desc: 'Latest Cinema', color: 'from-blue-500/20' },
          { id: 'series', label: 'SERIES', icon: Library, desc: 'Binge Worthy', color: 'from-indigo-500/20' },
          { id: 'epg', label: 'EPG GUIDE', icon: Calendar, desc: 'TV Schedule', color: 'from-teal-500/20' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => openViewMode(item.id as any)}
            className="group relative h-40 sm:h-56 rounded-3xl sm:rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden transition-all hover:scale-[1.02] hover:border-cyan-500/50 active:scale-95 shadow-2xl"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${item.color} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="relative z-10 flex flex-col items-center justify-center h-full p-6">
              <div className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-black/40 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform shadow-neon border border-white/5">
                <item.icon className="w-7 h-7 sm:w-10 sm:h-10 text-cyan-400" />
              </div>
              <span className="text-lg sm:text-2xl font-black tracking-widest text-white mb-1 uppercase italic">{item.label}</span>
              <span className="text-gray-500 text-xs font-bold tracking-tighter uppercase">{item.desc}</span>
            </div>
          </button>
        ))}
      </div>

      {/* History Section */}
      {recentlyWatched.length > 0 && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
              <Clock className="w-5 h-5 text-cyan-400" />
            </div>
            <h2 className="text-2xl font-black tracking-tighter uppercase italic">Recently Viewed</h2>
          </div>
          <div className="flex gap-6 overflow-x-auto pb-6 scrollbar-hide">
            {recentlyWatched.slice(0, 10).map((item, idx) => (
              <div key={idx} className="min-w-[200px]">
                <ChannelCard
                  channel={{
                    name: item.channelName,
                    url: item.channelUrl,
                    logo: item.channelLogo,
                    group: item.category
                  }}
                  isFavorite={favoriteUrls.has(item.channelUrl)}
                  onToggleFavorite={loadFavorites}
                  returnTo={dashboardReturnUrl}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderListView = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-bottom-4 duration-700">
      <header className="w-full border-b border-white/5 bg-black/95 px-4 py-4 sm:sticky sm:top-0 sm:z-30 sm:bg-black/90 sm:backdrop-blur-2xl sm:p-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-4 sm:gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-6 min-w-0">
              <button 
                onClick={() => setViewMode('home')} 
                className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors font-black uppercase italic tracking-tighter text-sm sm:text-base"
              >
                <ChevronLeft className="w-6 h-6" /> BACK
              </button>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-600 truncate">
                {viewMode}
              </h1>
            </div>
            
            <div className="flex gap-2 sm:gap-3">
              <Button
                variant={showFavoritesOnly ? "default" : "outline"}
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`rounded-xl h-11 sm:h-12 font-bold px-3 sm:px-6 transition-all text-xs sm:text-sm ${showFavoritesOnly ? "bg-red-500 text-white" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
              >
                <Heart className={`w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2 ${showFavoritesOnly ? "fill-current" : ""}`} /> FAVORITES
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleRefreshChannels}
                className="bg-white/5 border-white/10 hover:bg-white/10 rounded-xl w-11 h-11 sm:w-12 sm:h-12"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1fr)_220px_180px] xl:grid-cols-[minmax(260px,1fr)_220px_180px_minmax(260px,auto)] gap-3 sm:gap-4 items-start sm:items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Input
                placeholder="Search for channels, movies, or series..."
                className="pl-12 h-12 sm:h-14 bg-white/5 border-white/10 rounded-2xl focus:border-cyan-500/50 transition-all text-sm sm:text-lg font-medium"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {viewMode === 'live' && (
              <>
                <Select value={selectedRegion} onValueChange={handleRegionChange}>
                  <SelectTrigger className="h-12 sm:h-14 w-full bg-white/5 border-white/10 rounded-2xl text-white font-bold">
                    <SelectValue placeholder="Select region" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10 text-white">
                    <SelectItem value="All">All Regions</SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region.code} value={region.code}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedCountry}
                  onValueChange={handleCountryChange}
                  disabled={selectedRegion === "All" || selectedRegionCountries.length === 0}
                >
                  <SelectTrigger className="h-12 sm:h-14 w-full bg-white/5 border-white/10 rounded-2xl text-white font-bold disabled:opacity-40">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="bg-black border-white/10 text-white">
                    <SelectItem value="All">All Countries</SelectItem>
                    {selectedRegionCountries.map((country) => (
                      <SelectItem key={country} value={country}>
                        {getCountryDisplayName(country)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            <div className="w-full min-w-0 sm:col-span-2 lg:col-span-3 xl:col-span-1 xl:min-w-[260px] overflow-hidden">
              <CategoryFilter
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={(category) => {
                  setSelectedCategory(category);
                  setCurrentPage(1);
                }}
              />
            </div>
          </div>
          {viewMode === 'live' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold uppercase tracking-widest text-gray-500">
              <span>
                {totalChannels.toLocaleString()} channels
                {selectedRegion !== "All" ? ` in ${selectedRegionName}` : ""}
                {selectedCountry !== "All" ? ` / ${getCountryDisplayName(selectedCountry)}` : ""}
              </span>
              <div className="flex items-center gap-2 sm:gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1 || isLoading}
                  onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                  className="bg-white/5 border-white/10 hover:bg-white/10 rounded-xl"
                >
                  PREV
                </Button>
                <span>Page {currentPage} of {Math.max(totalPages, 1)}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages || isLoading}
                  onClick={() => setCurrentPage((page) => page + 1)}
                  className="bg-white/5 border-white/10 hover:bg-white/10 rounded-xl"
                >
                  NEXT
                </Button>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-5 sm:p-8 max-w-7xl mx-auto w-full">
        {isLoading && channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] gap-6">
            <div className="w-24 h-24 rounded-[2rem] bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20 shadow-neon">
              <Zap className="w-12 h-12 text-cyan-400 animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-black tracking-tighter uppercase italic text-white mb-2">Powering Up Vault</p>
              <p className="text-gray-500 font-medium">Fetching your premium entertainment...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
            {paginatedChannels.map((channel, index) => (
              <ChannelCard
                key={`${channel.url}-${index}`}
                channel={channel}
                isFavorite={favoriteUrls.has(channel.url)}
                onToggleFavorite={loadFavorites}
                returnTo={dashboardReturnUrl}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white selection:bg-cyan-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10">
        {!hasCredentials && !isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 text-center animate-in zoom-in-95 duration-700">
            <div className="w-24 h-24 rounded-[2.5rem] bg-cyan-500/10 flex items-center justify-center mb-8 border border-cyan-500/20 shadow-neon">
              <Tv className="w-12 h-12 text-cyan-400 animate-bounce" />
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tighter uppercase italic mb-4">Ready to <span className="text-cyan-400">Unlock?</span></h1>
            <p className="text-gray-400 text-lg max-w-md mb-10 font-medium">
              Setup your IPTV credentials to access thousands of live channels, 4K movies, and premium series.
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate("/setup")} 
              className="h-16 px-12 bg-cyan-500 hover:bg-cyan-400 text-black font-black text-xl tracking-tighter rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-neon"
            >
              INITIALIZE SETUP
            </Button>
          </div>
        ) : (
          viewMode === 'home' ? renderHomeMode() : renderListView()
        )}
      </div>
    </div>
  );
};

export default Dashboard;
