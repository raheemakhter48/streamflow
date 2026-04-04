import { useEffect, useState, useMemo, useCallback } from "react";
import { authAPI, iptvAPI, favoritesAPI, recentlyWatchedAPI } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogOut, Search, Settings, Tv, Heart, Clock, RefreshCw, ChevronLeft, Film, Library, Calendar, User, Zap } from "lucide-react";
import { toast } from "sonner";
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
  }, [channels, searchQuery, selectedCategory, showFavoritesOnly, favorites, viewMode]);

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
    <div className="flex flex-col gap-12 p-8 max-w-7xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Hero Welcome */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Streamflow" className="w-12 h-12 object-contain" />
          <div>
            <h1 className="text-5xl font-black tracking-tighter italic uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-600 mb-2">
              STREAM VAULT
            </h1>
            <div className="flex items-center gap-2 text-gray-400 font-medium">
              <User className="w-4 h-4 text-cyan-500" />
              <span>Welcome back, <span className="text-white font-bold">{user?.email?.split('@')[0]}</span></span>
            </div>
          </div>
        </div>
        
        <div className="flex gap-3">
           <Button 
             variant="outline" 
             className="bg-white/5 border-white/10 hover:bg-cyan-500 hover:text-black rounded-xl px-6 h-12 font-bold transition-all"
             onClick={() => navigate("/setup")}
           >
             <Settings className="w-5 h-5 mr-2" /> SETUP
           </Button>
           <Button 
             variant="outline" 
             className="bg-white/5 border-white/10 hover:bg-red-500 hover:text-white rounded-xl px-6 h-12 font-bold transition-all"
             onClick={handleLogout}
           >
             <LogOut className="w-5 h-5 mr-2" /> EXIT
           </Button>
        </div>
      </div>

      {/* Main Feature Grid (Figma Style) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { id: 'live', label: 'LIVE TV', icon: Tv, desc: 'Watch Real-time', color: 'from-cyan-500/20' },
          { id: 'movie', label: 'MOVIES', icon: Film, desc: 'Latest Cinema', color: 'from-blue-500/20' },
          { id: 'series', label: 'SERIES', icon: Library, desc: 'Binge Worthy', color: 'from-indigo-500/20' },
          { id: 'epg', label: 'EPG GUIDE', icon: Calendar, desc: 'TV Schedule', color: 'from-teal-500/20' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setViewMode(item.id as any)}
            className="group relative h-56 rounded-[2.5rem] bg-white/5 border border-white/10 backdrop-blur-xl overflow-hidden transition-all hover:scale-[1.02] hover:border-cyan-500/50 active:scale-95 shadow-2xl"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${item.color} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
            <div className="relative z-10 flex flex-col items-center justify-center h-full p-6">
              <div className="w-20 h-20 rounded-3xl bg-black/40 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-neon border border-white/5">
                <item.icon className="w-10 h-10 text-cyan-400" />
              </div>
              <span className="text-2xl font-black tracking-widest text-white mb-1 uppercase italic">{item.label}</span>
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
                  isFavorite={favorites.includes(item.channelUrl)}
                  onToggleFavorite={loadFavorites}
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
      <header className="sticky top-0 z-30 w-full border-b border-white/5 bg-black/80 backdrop-blur-2xl p-6">
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <button 
                onClick={() => setViewMode('home')} 
                className="flex items-center gap-2 text-gray-400 hover:text-cyan-400 transition-colors font-black uppercase italic tracking-tighter"
              >
                <ChevronLeft className="w-6 h-6" /> BACK
              </button>
              <h1 className="text-3xl font-black tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-600">
                {viewMode}
              </h1>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant={showFavoritesOnly ? "default" : "outline"}
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`rounded-xl h-12 font-bold px-6 transition-all ${showFavoritesOnly ? "bg-red-500 text-white" : "bg-white/5 border-white/10 hover:bg-white/10"}`}
              >
                <Heart className={`w-5 h-5 mr-2 ${showFavoritesOnly ? "fill-current" : ""}`} /> FAVORITES
              </Button>
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleRefreshChannels}
                className="bg-white/5 border-white/10 hover:bg-white/10 rounded-xl w-12 h-12"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <Input
                placeholder="Search for channels, movies, or series..."
                className="pl-12 h-14 bg-white/5 border-white/10 rounded-2xl focus:border-cyan-500/50 transition-all text-lg font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full md:w-auto overflow-x-auto scrollbar-hide">
              <CategoryFilter
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
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
    <div className="min-h-screen bg-black text-white selection:bg-cyan-500/30">
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/5 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 rounded-full blur-[120px]"></div>
      </div>

      <div className="relative z-10">
        {!hasCredentials && !isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center animate-in zoom-in-95 duration-700">
            <div className="w-24 h-24 rounded-[2.5rem] bg-cyan-500/10 flex items-center justify-center mb-8 border border-cyan-500/20 shadow-neon">
              <Tv className="w-12 h-12 text-cyan-400 animate-bounce" />
            </div>
            <h1 className="text-5xl font-black tracking-tighter uppercase italic mb-4">Ready to <span className="text-cyan-400">Unlock?</span></h1>
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
