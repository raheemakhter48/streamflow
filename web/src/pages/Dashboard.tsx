import { useCallback, useEffect, useRef, useState, useMemo, lazy, Suspense } from "react";
import { authAPI, iptvAPI, favoritesAPI, recentlyWatchedAPI } from "@/lib/api";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Heart, RefreshCw, Zap, ChevronLeft, ChevronRight, ScanSearch, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ChannelCard from "@/components/ChannelCard";
import ContinueWatchingCard from "@/components/ContinueWatchingCard";
import CategoryFilter from "@/components/CategoryFilter";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import { useSidebar } from "@/context/SidebarContext";
import AdSlot from "@/components/AdSlot";
import SEO from "@/components/SEO";
import LiveSportsScoreWidget from "@/components/LiveSportsScoreWidget";
import SmartSeoAssistant from "@/components/SmartSeoAssistant";

const LiveStreamsBrowser = lazy(() => import("@/components/LiveStreamsBrowser"));
const MovieBrowser = lazy(() => import("@/components/MovieBrowser"));
const SeriesBrowser = lazy(() => import("@/components/SeriesBrowser"));

export type { ContentType } from "@/lib/dashboardUtils";
import {
  type ContentType,
  type DashboardView,
  type Channel,
  type IptvRegion,
  type RecentlyWatched,
  type ChannelCheckResult,
  CHANNELS_PER_PAGE,
  DEFAULT_DASHBOARD_VIEW,
  DASHBOARD_FILTERS_STORAGE_KEY,
  M3U_CATEGORY_FILTER,
  DASHBOARD_VIEWS,
  CHANNEL_VIEWS,
  getInitialPage,
  getDashboardView,
  isChannelView,
  getStoredDashboardFilters,
  RECENTLY_WATCHED_STORAGE_KEY,
  getStoredRecentlyWatched,
  getCountryDisplayName,
  getPlaybackSupport,
  normalizeFilterText,
  inferChannelCountry,
  mergeUniqueChannels,
  withM3uCategory,
  buildDashboardPath,
  mapIptvOrgChannel,
} from "@/lib/dashboardUtils";

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { collapsed } = useSidebar();
  const [searchParams] = useSearchParams();
  const storedFilters = useMemo(() => getStoredDashboardFilters(), []);
  const [user, setUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<DashboardView>(
    getDashboardView(searchParams.get("view"))
  );
  const [channels, setChannels] = useState<Channel[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<RecentlyWatched[]>(getStoredRecentlyWatched);
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
  const [favoriteChannelsList, setFavoriteChannelsList] = useState<Channel[]>([]);
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
      setFavoriteChannelsList(
        list.map((f: any) => ({
          id: f.id,
          name: f.channelName,
          url: f.channelUrl,
          logo: f.channelLogo,
          group: f.category || "Favorites",
          type: "live" as const,
          isWorking: true,
          playbackSupport: getPlaybackSupport(f.channelUrl),
          source: "iptv-org" as const,
        }))
      );
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
    // location.pathname/location.search are intentionally excluded: this effect pushes
    // state -> URL. Depending on location here would re-run it right after a direct
    // navigate() (e.g. clicking a nav tab) but before the location -> state effect above
    // has applied the new view, so it would read a stale `viewMode` and immediately
    // overwrite the just-navigated URL, causing the view to bounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, viewMode, selectedRegion, selectedCountry, selectedCategory, debouncedSearchQuery, currentPage, navigate]);

  const filteredChannels = useMemo(() => {
    if (viewMode === 'favorites') {
      let favList = favoriteChannelsList.length > 0
        ? [...favoriteChannelsList]
        : channels.filter((ch) => favoriteUrls.has(ch.url));

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        favList = favList.filter((ch) =>
          ch.name.toLowerCase().includes(query) ||
          (ch.group && ch.group.toLowerCase().includes(query))
        );
      }
      return favList;
    }

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
  }, [channels, validatedChannels, searchQuery, selectedCategory, showFavoritesOnly, favoriteUrls, viewMode, favoriteChannelsList]);

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

      if (requestId !== iptvOrgRequestId.current) {
        return;
      }

      // Render database channels immediately so LCP is instant (<1s)
      setChannels(mappedChannels);
      setTotalChannels(isM3uFilter
        ? mappedChannels.length
        : (response.totalChannels || 0) + Math.max(0, mappedChannels.length - ((response.data || []).length)));
      setTotalPages(isM3uFilter ? 1 : response.totalPages || 0);
      setHasCredentials(true);
      setIsLoading(false);

      // Merge personal custom playlist in background only when on page 1 for M3U / All
      if (currentPage === 1 && (isM3uFilter || selectedCategory === "All" || selectedCategory === M3U_CATEGORY_FILTER)) {
        loadPersonalPlaylistMatches().then((playlistMatches) => {
          if (playlistMatches.length > 0 && requestId === iptvOrgRequestId.current) {
            setChannels((prev) => mergeUniqueChannels(prev, playlistMatches));
          }
        }).catch(() => {});
      }
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
          country: countriesForInference.length > 0
            ? inferChannelCountry(channelName, group, countriesForInference)
            : undefined,
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
      localStorage.setItem(RECENTLY_WATCHED_STORAGE_KEY, JSON.stringify(list));
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
    { id: 'home'    as DashboardView, label: 'All' },
    { id: 'live'    as DashboardView, label: 'Live TV' },
    { id: 'streams' as DashboardView, label: 'Live Streams' },
    { id: 'movie'   as DashboardView, label: 'Movies' },
    { id: 'series'  as DashboardView, label: 'Series' },
  ];

  const renderChannelGrid = () => {
    if (isLoading && channels.length === 0) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 lg:gap-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/5 bg-[#1C1C1E]/60 overflow-hidden animate-pulse"
            >
              <div className="aspect-[4/3] sm:aspect-square bg-white/5 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/10" />
              </div>
              <div className="p-3 space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/5 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (paginatedChannels.length === 0 && !isLoading) {
      if (viewMode === 'favorites') {
        return (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Heart className="w-10 h-10 text-gray-600 mb-1" />
            <p className="text-gray-400 text-sm font-semibold">No favorites added yet</p>
            <p className="text-gray-600 text-xs max-w-xs">Click the star or heart icon on any channel card to add it to your favorites.</p>
            <button onClick={() => openViewMode('home')} className="mt-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-all">
              Browse Channels
            </button>
          </div>
        );
      }

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
            priority={index < 6}
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
    <div className="enterprise-bg min-h-screen pb-28 text-white">
      <SEO
        title={`${viewMode === "movie" ? "Movies" : viewMode === "live" ? "Live TV" : viewMode === "streams" ? "Live Streams" : "Streaming Dashboard"} - StreamFlow`}
        description="Browse live TV channels, sports streams, movies, series, favorites, and recently watched content in your StreamFlow dashboard."
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

      {viewMode !== 'movie' && viewMode !== 'series' && viewMode !== 'streams' && !hasCredentials && !isLoading ? (
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
        <div className="mx-auto max-w-[1520px] px-4 sm:px-5 lg:px-8">
          {/* Search + filters row (Hide in streams view as LiveStreamsBrowser has its own search and filters) */}
          {viewMode !== 'streams' && (
            <div className="mb-6 flex flex-col gap-3 rounded-full border border-white/10 bg-[#1C1C1E]/80 p-2 backdrop-blur-xl lg:mt-5 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
                <Input
                  placeholder="Search channels, movies, series..."
                  className="h-11 rounded-full border-none bg-transparent pl-11 text-sm text-white placeholder-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
              </div>

            {/* Region + Country (live view only) */}
            {(viewMode === 'live' || viewMode === 'home') && (
              <div className="flex gap-2 lg:shrink-0 pr-2">
                <Select value={selectedRegion} onValueChange={handleRegionChange}>
                  <SelectTrigger className="h-9 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-xs font-bold text-white hover:bg-white/15">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10 text-white rounded-2xl">
                    <SelectItem value="All">Region: Global 🌐</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r.code} value={r.code}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={selectedCountry} onValueChange={handleCountryChange} disabled={selectedRegion === "All"}>
                  <SelectTrigger className="h-9 flex-1 rounded-full border border-white/15 bg-white/10 px-4 text-xs font-bold text-white disabled:opacity-40 hover:bg-white/15">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1C1C1E] border-white/10 text-white rounded-2xl">
                    <SelectItem value="All">Country: All</SelectItem>
                    {selectedRegionCountries.map((c) => (
                      <SelectItem key={c} value={c}>{getCountryDisplayName(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            </div>
          )}

          <AdSlot
            slot={import.meta.env.VITE_ADSENSE_DASHBOARD_SLOT || ""}
            className="mb-5 min-h-[90px]"
            format="horizontal"
          />

          {/* Real-time Live Sports Scores Widget (Cricket & Football) */}
          <LiveSportsScoreWidget />

          {/* Continue Watching - Fixed uniform sleek row */}
          {isChannelView(viewMode) && recentlyWatched.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-white">Continue Watching</h2>
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-white/70">
                    {recentlyWatched.length}
                  </span>
                </div>
                <button
                  onClick={() => openViewMode('home')}
                  className="text-xs text-[#00D7E5] hover:underline font-bold"
                >
                  View All
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto scrollbar-none pb-2 pt-0.5">
                {recentlyWatched.slice(0, 10).map((item, idx) => (
                  <ContinueWatchingCard
                    key={`${item.channelUrl}-${idx}`}
                    item={item}
                    isFavorite={favoriteUrls.has(item.channelUrl)}
                    onToggleFavorite={loadFavorites}
                    returnTo={dashboardReturnUrl}
                  />
                ))}
              </div>
            </div>
          )}

          <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-[#00D7E5]" /></div>}>
            {viewMode === 'streams' ? (
              <div className="mt-4">
                <LiveStreamsBrowser channels={channels} />
              </div>
            ) : viewMode === 'movie' ? (
              <MovieBrowser searchQuery={debouncedSearchQuery} />
            ) : viewMode === 'series' ? (
              <SeriesBrowser searchQuery={debouncedSearchQuery} />
            ) : (
          <>
          {/* Channels header */}
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-black text-white">
              {viewMode === 'favorites' ? 'Favorite Channels' : viewMode === 'home' ? 'All Channels' : viewMode === 'live' ? 'Live TV' : 'Program Guide'}
            </h2>
            <div className="flex items-center gap-2">
              {validatedChannels && (
                <button
                  onClick={() => setValidatedChannels(null)}
                  className="rounded-lg border border-[#1F2937] px-2.5 py-1.5 text-xs font-bold text-gray-400 hover:text-white"
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
                      ? "border-[#00CFE8] bg-[#00CFE8]/10 text-[#00CFE8]"
                      : "border-[#1e1e1e] text-gray-400 hover:text-white"
                  }`}
                >
                  <ScanSearch className="h-3.5 w-3.5" />
                  {isSelectionMode ? "Cancel" : "Find working"}
                </button>
              )}
              {viewMode === 'favorites' ? (
                <span className="text-xs text-red-400 font-bold flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5 fill-current" />
                  {filteredChannels.length} saved
                </span>
              ) : isChannelView(viewMode) ? (
                <span className="text-xs text-gray-600">{totalChannels.toLocaleString()} ch</span>
              ) : null}
              <button
                onClick={handleRefreshChannels}
                className="text-gray-600 hover:text-white transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#00D7E5]' : ''}`} />
              </button>
              {viewMode !== 'favorites' && (
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`transition-colors ${showFavoritesOnly ? 'text-red-500' : 'text-gray-600 hover:text-white'}`}
                  title="Filter favorites"
                >
                  <Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                </button>
              )}
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
          </Suspense>
        </div>
      )}

      <BottomNav />
      {/* Smart On-Site SEO Bot Assistant */}
      <SmartSeoAssistant />
    </div>
  );
};

export default Dashboard;
