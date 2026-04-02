import { useEffect, useState, useMemo, useCallback } from "react";
import { authAPI, iptvAPI, favoritesAPI, recentlyWatchedAPI } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Search, Settings, Tv, Heart, Clock, Moon, Sun, RefreshCw, ChevronLeft, ChevronRight, PlayCircle, Film, Library, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import ChannelCard from "@/components/ChannelCard";
import CategoryFilter from "@/components/CategoryFilter";

export type ContentType = 'live' | 'movie' | 'series';

interface Channel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
  quality?: "HD" | "SD";
  type?: ContentType;
}

interface RecentlyWatched {
  channelName: string;
  channelUrl: string;
  channelLogo?: string;
  category?: string;
  watchedAt: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ContentType | 'home' | 'epg'>('home');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [recentlyWatched, setRecentlyWatched] = useState<RecentlyWatched[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [hasCredentials, setHasCredentials] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isFiltering, setIsFiltering] = useState(false);
  const channelsPerPage = 60;

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      loadCredentialsAndChannels();
      loadFavorites();
      loadRecentlyWatched();
    }
  }, [user]);

  const filteredChannels = useMemo(() => {
    if (isFiltering) return [];
    
    let filtered = [...channels];

    if (viewMode !== 'home' && viewMode !== 'epg') {
      filtered = filtered.filter((ch) => ch.type === viewMode);
    }

    if (showFavoritesOnly) {
      filtered = filtered.filter((ch) => favorites.includes(ch.url));
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
  }, [channels, searchQuery, selectedCategory, showFavoritesOnly, favorites, isFiltering, viewMode]);

  const paginatedChannels = useMemo(() => {
    const startIndex = (currentPage - 1) * channelsPerPage;
    const endIndex = startIndex + channelsPerPage;
    return filteredChannels.slice(startIndex, endIndex);
  }, [filteredChannels, currentPage]);

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
      const text = await iptvAPI.getPlaylist();
      if (!text) return;
      
      const parsedChannels = parseM3U(text);
      setChannels(parsedChannels);
    } catch (error: any) {
      toast.error("Failed to load channels");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshChannels = async () => {
    try {
      await parseM3UPlaylist();
      toast.success("Playlist refreshed!");
    } catch (error) {
      toast.error("Refresh failed");
    }
  };

  const parseM3U = (content: string): Channel[] => {
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
        };
      } else if (line && !line.startsWith("#") && currentChannel.name) {
        channels.push({...currentChannel, url: line} as Channel);
        currentChannel = {};
      }
    }
    return channels;
  };

  const loadFavorites = async () => {
    try {
      const list = await favoritesAPI.getFavorites();
      setFavorites(list.map((f: any) => f.channelUrl));
    } catch (error) { console.error(error); }
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
    const filteredForMode = viewMode === 'home' || viewMode === 'epg' 
      ? channels 
      : channels.filter(ch => ch.type === viewMode);
    const groups = new Set(filteredForMode.map(ch => ch.group || 'Other'));
    return ['All', ...Array.from(groups).sort()];
  }, [channels, viewMode]);

  const renderHomeMode = () => (
    <div className="flex flex-col gap-8 p-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
            STREAMFLOW HUB
          </h1>
          <p className="text-muted-foreground">Welcome back, {user?.email?.split('@')[0]}</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" size="icon" onClick={() => navigate("/setup")}>
             <Settings className="w-5 h-5" />
           </Button>
           <Button variant="outline" size="icon" onClick={handleLogout}>
             <LogOut className="w-5 h-5" />
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { id: 'live', label: 'LIVE TV', icon: Tv, color: 'from-cyan-900 to-cyan-950' },
          { id: 'movie', label: 'MOVIES', icon: Film, color: 'from-blue-900 to-blue-950' },
          { id: 'series', label: 'SERIES', icon: Library, color: 'from-indigo-900 to-indigo-950' },
          { id: 'epg', label: 'EPG GUIDE', icon: Calendar, color: 'from-teal-900 to-teal-950' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setViewMode(item.id as any)}
            className={`h-48 rounded-2xl bg-gradient-to-br ${item.color} border border-white/5 hover:border-cyan-500/50 transition-all group overflow-hidden relative`}
          >
            <div className="absolute inset-0 bg-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <item.icon className="w-16 h-16 mb-4 mx-auto text-cyan-500 group-hover:scale-110 transition-transform" />
            <span className="text-xl font-black tracking-widest text-white">{item.label}</span>
          </button>
        ))}
      </div>

      {recentlyWatched.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-cyan-500" /> Continue Watching
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {recentlyWatched.slice(0, 10).map((item, idx) => (
              <ChannelCard
                key={idx}
                channel={{
                  name: item.channelName,
                  url: item.channelUrl,
                  logo: item.channelLogo,
                  group: item.category
                }}
                isFavorite={favorites.includes(item.channelUrl)}
                onToggleFavorite={loadFavorites}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderListView = () => (
    <div className="flex flex-col h-full animate-in slide-in-from-bottom-4 duration-500">
      <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setViewMode('home')}>
              <ChevronLeft className="w-5 h-5 mr-2" /> Back
            </Button>
            <h1 className="text-2xl font-black text-cyan-500">{viewMode.toUpperCase()}</h1>
          </div>
          
          <div className="flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search channels..."
              className="pl-10 bg-secondary/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant={showFavoritesOnly ? "default" : "outline"}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={showFavoritesOnly ? "bg-red-500 hover:bg-red-600" : ""}
            >
              <Heart className={`w-4 h-4 mr-2 ${showFavoritesOnly ? "fill-white" : ""}`} />
              Favorites
            </Button>
            <Button variant="outline" size="icon" onClick={handleRefreshChannels}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <CategoryFilter
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </div>
      </header>

      <main className="flex-1 p-6 overflow-auto">
        {isLoading && channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <RefreshCw className="w-12 h-12 text-cyan-500 animate-spin" />
            <p className="text-lg animate-pulse">Loading your entertainment...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
            {paginatedChannels.map((channel, index) => (
              <ChannelCard
                key={`${channel.url}-${index}`}
                channel={channel}
                isFavorite={favorites.includes(channel.url)}
                onToggleFavorite={loadFavorites}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-cyan-500/30">
      {!hasCredentials && !isLoading ? (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <Tv className="w-20 h-20 text-cyan-500 mb-6 animate-bounce" />
          <h1 className="text-3xl font-black mb-4">READY TO START STREAMING?</h1>
          <p className="text-muted-foreground max-w-md mb-8">
            Setup your IPTV credentials to unlock thousands of live channels, movies, and series.
          </p>
          <Button size="lg" onClick={() => navigate("/setup")} className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-105 transition-transform">
            GET STARTED NOW
          </Button>
        </div>
      ) : (
        viewMode === 'home' ? renderHomeMode() : renderListView()
      )}
    </div>
  );
};

export default Dashboard;
