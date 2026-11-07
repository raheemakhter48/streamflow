import { useState, useEffect, useMemo, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Radio, Calendar, Clock, Tv, ExternalLink, RefreshCw, Search, ShieldCheck, Plus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StreamSourceEditor } from "@/components/admin/StreamSourceEditor";
import { toast } from "sonner";
import { liveStreamsAPI } from "@/lib/api";

export interface MatchStreamSource {
  name: string;
  url: string;
  quality?: string;
  type?: "hls" | "embed";
}

export interface MatchFixture {
  id: string;
  sport: "Cricket" | "Football" | "Basketball" | "Tennis";
  tournament: string;
  status: "live" | "upcoming" | "recent";
  team1: {
    name: string;
    flag: string;
    score?: string;
  };
  team2: {
    name: string;
    flag: string;
    score?: string;
  };
  startIso?: string;
  startTime: string; // e.g. "LIVE NOW" or "Today at 3:30 PM"
  liveDurationSeconds?: number;
  startsInSeconds?: number;
  sources: MatchStreamSource[];
  watchUrl?: string;
  iptvChannelQuery?: string; // e.g. "PTV Sports" or "Sky Sports"
}

// Isolated live ticking badge so parent page doesn't re-render every second
const LiveDurationBadge = memo(({ baseSeconds = 0 }: { baseSeconds?: number }) => {
  const [ticks, setTicks] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTicks((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const total = baseSeconds + ticks;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return <span>Live For : {hours.toString().padStart(2, "0")}h {minutes.toString().padStart(2, "0")}m {seconds.toString().padStart(2, "0")}s</span>;
});

// Isolated upcoming match countdown badge
const UpcomingCountdownBadge = memo(({ startIso, baseStartsInSeconds }: { startIso?: string; baseStartsInSeconds?: number }) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(() => {
    if (startIso) {
      const diff = Math.floor((new Date(startIso).getTime() - Date.now()) / 1000);
      return diff > 0 ? diff : 0;
    }
    return baseStartsInSeconds || 0;
  });

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  if (secondsLeft <= 0) {
    return <span className="text-amber-400 font-bold animate-pulse">Starting Shortly...</span>;
  }

  const days = Math.floor(secondsLeft / 86400);
  const hours = Math.floor((secondsLeft % 86400) / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  if (days > 0) {
    return (
      <span className="text-amber-300 font-mono font-semibold">
        Starts in: {days}d {hours.toString().padStart(2, "0")}h {minutes.toString().padStart(2, "0")}m
      </span>
    );
  }

  return (
    <span className="text-amber-300 font-mono font-semibold">
      Starts in: {hours.toString().padStart(2, "0")}h {minutes.toString().padStart(2, "0")}m {seconds.toString().padStart(2, "0")}s
    </span>
  );
});

// Team Logo Badge component that handles WebP/PNG logos and fallback sport icons
const renderTeamBadge = (name: string, flag: string, sport: string) => {
  if (flag && (flag.startsWith("http://") || flag.startsWith("https://") || flag.startsWith("/"))) {
    return (
      <img
        src={flag}
        alt={name}
        className="w-full h-full object-contain p-1"
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = "none";
        }}
      />
    );
  }
  return <span className="text-xl sm:text-2xl">{flag || (sport === "Cricket" ? "🏏" : "⚽")}</span>;
};

interface LiveStreamsBrowserProps {
  channels?: any[];
}

const LiveStreamsBrowser = ({ channels = [] }: LiveStreamsBrowserProps) => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchFixture[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMatchForStream, setSelectedMatchForStream] = useState<MatchFixture | null>(null);
  const [isResolvingSources, setIsResolvingSources] = useState(false);

  // Custom Stream Add Modal State
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customTournament, setCustomTournament] = useState("Live Sports Feed");
  const [customSport, setCustomSport] = useState<"Cricket" | "Football" | "Basketball" | "Tennis">("Cricket");
  const [customStreamUrl, setCustomStreamUrl] = useState("");

  const fetchLiveMatches = async (forceRefresh = false) => {
    if (forceRefresh) setIsRefreshing(true);
    try {
      const res = await liveStreamsAPI.getLiveMatches(forceRefresh);
      const fetched: MatchFixture[] = res.data || [];

      // Load user custom streams
      let customMatches: MatchFixture[] = [];
      try {
        const saved = localStorage.getItem("custom_live_matches");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) customMatches = parsed;
        }
      } catch {}

      setMatches([...customMatches, ...fetched]);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (forceRefresh) toast.success("Real-time live matches refreshed!");
    } catch (err: any) {
      console.error("Live match fetch failed:", err);
      if (forceRefresh) toast.error("Could not refresh live streams");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveMatches(false);

    // Auto-refresh every 2 minutes so fixtures stay updated continuously throughout the day
    const interval = setInterval(() => {
      fetchLiveMatches(false);
    }, 120000);

    return () => clearInterval(interval);
  }, []);

  const handleOpenSourceModal = async (match: MatchFixture) => {
    setSelectedMatchForStream(match);
    if (match.watchUrl && (!match.sources || match.sources.length <= 1)) {
      setIsResolvingSources(true);
      try {
        const res = await liveStreamsAPI.getMatchSources(match.watchUrl);
        if (res.data && res.data.length > 0) {
          setSelectedMatchForStream((prev) => {
            if (!prev || prev.id !== match.id) return prev;
            return {
              ...prev,
              sources: [...res.data, ...prev.sources],
            };
          });
        }
      } catch (err) {
        console.warn("Failed to scrape additional stream sources:", err);
      } finally {
        setIsResolvingSources(false);
      }
    }
  };

  const handleSaveCustomMatch = (playImmediately = false) => {
    if (!customTitle.trim()) {
      toast.error("Stream/Match Title is required");
      return;
    }
    if (!customStreamUrl.trim()) {
      toast.error("Stream URL is required (Direct, Split Video/Audio, ya Multi-Server)");
      return;
    }

    const parts = customTitle.split(/vs|v\.|-/i);
    const t1 = parts[0]?.trim() || customTitle;
    const t2 = parts[1]?.trim() || "Live Feed";

    const newMatch: MatchFixture = {
      id: `custom-${Date.now()}`,
      sport: customSport,
      tournament: customTournament || "Live Event",
      status: "live",
      team1: { name: t1, flag: customSport === "Cricket" ? "🏏" : "⚽" },
      team2: { name: t2, flag: "🔥" },
      startTime: "LIVE NOW",
      liveDurationSeconds: 120,
      sources: [
        { name: "Server 1 (Primary HD)", url: customStreamUrl, quality: "1080p HD" },
      ],
    };

    const updated = [newMatch, ...matches];
    setMatches(updated);
    try {
      const customOnly = updated.filter((m) => m.id.startsWith("custom-"));
      localStorage.setItem("custom_live_matches", JSON.stringify(customOnly));
    } catch {}

    toast.success("Custom Stream added successfully!");
    setIsAddCustomOpen(false);

    if (playImmediately) {
      handleWatchStream(newMatch, 0);
    }
  };

  // Status counts
  const statusCounts = useMemo(() => {
    return {
      all: matches.length,
      live: matches.filter((m) => m.status === "live").length,
      upcoming: matches.filter((m) => m.status === "upcoming").length,
      recent: matches.filter((m) => m.status === "recent").length,
    };
  }, [matches]);

  // Sport counts
  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = { all: matches.length };
    matches.forEach((m) => {
      counts[m.sport.toLowerCase()] = (counts[m.sport.toLowerCase()] || 0) + 1;
    });
    return counts;
  }, [matches]);

  // Filtered and intelligently sorted matches
  const filteredMatches = useMemo(() => {
    const list = matches.filter((match) => {
      if (selectedStatus !== "all" && match.status !== selectedStatus) return false;
      if (selectedSport !== "all" && match.sport.toLowerCase() !== selectedSport.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText = `${match.tournament} ${match.team1.name} ${match.team2.name} ${match.sport}`.toLowerCase();
        if (!matchText.includes(q)) return false;
      }
      return true;
    });

    // Smart Sorting: Live first, then Upcoming (earliest first), then Recent
    return list.sort((a, b) => {
      const priority: Record<string, number> = { live: 0, upcoming: 1, recent: 2 };
      const diff = (priority[a.status] ?? 3) - (priority[b.status] ?? 3);
      if (diff !== 0) return diff;

      if (a.status === "upcoming" && b.status === "upcoming") {
        return (a.startsInSeconds || 0) - (b.startsInSeconds || 0);
      }
      return 0;
    });
  }, [matches, selectedStatus, selectedSport, searchQuery]);

  const handleWatchStream = async (match: MatchFixture, sourceIndex = 0) => {
    let matchSources = match.sources || [];

    // If sources not pre-resolved and match has watchUrl, resolve them dynamically on click
    if (matchSources.length === 0 && match.watchUrl) {
      try {
        const res = await liveStreamsAPI.getMatchSources(match.watchUrl);
        if (res.data && res.data.length > 0) {
          matchSources = res.data;
          match.sources = matchSources;
        }
      } catch (err) {
        console.warn("Could not fetch match streams:", err);
      }
    }

    if (matchSources.length === 0) {
      if (match.status === "upcoming") {
        toast.info(`Match starts ${match.startTime}. Stream feed will become active shortly before kickoff.`);
      } else {
        toast.info("No active broadcast server found for this event right now.");
      }
      return;
    }

    let selectedSource = matchSources[sourceIndex] || matchSources[0];
    let allUrls = matchSources.map((s) => s.url);

    // Check if there is a matching user IPTV channel (e.g. PTV Sports, Willow, etc.)
    if (match.iptvChannelQuery && channels.length > 0) {
      const q = match.iptvChannelQuery.toLowerCase();
      const matchedChannel = channels.find((c) =>
        c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase())
      );
      if (matchedChannel && matchedChannel.url) {
        allUrls = [matchedChannel.url, ...allUrls];
      }
    }

    const title = `${match.team1.name} vs ${match.team2.name} - ${match.tournament}`;
    const params = new URLSearchParams({
      name: title,
      url: selectedSource.url,
      category: "Live Sports",
      urls: JSON.stringify(allUrls),
      ...(selectedSource.type ? { type: selectedSource.type } : {}),
    });

    navigate(`/player?${params.toString()}`);
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-white tracking-tight">Live Sports Streams</h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-black animate-pulse">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              LIVE
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <p className="text-xs text-white/50">
              Real-time daily sports fixtures with multi-server playback
            </p>
            {lastUpdated && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Sync {lastUpdated}
              </span>
            )}
          </div>
        </div>

        {/* Search & Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Search teams, tournament..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-500 transition-colors"
            />
          </div>

          <Button
            onClick={() => fetchLiveMatches(true)}
            disabled={isRefreshing}
            variant="outline"
            size="sm"
            className="rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs h-9 px-3 gap-1.5 shrink-0"
            title="Force refresh live fixtures from sports web feeds"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          <Button
            onClick={() => setIsAddCustomOpen(true)}
            size="sm"
            className="rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs h-9 px-4 gap-1.5 shrink-0 shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            Add Custom Stream
          </Button>
        </div>
      </div>

      {/* Row 1 Filter Pills: Status Filters (TFlix Style) */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setSelectedStatus("all")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedStatus === "all"
            ? "bg-white text-black shadow-lg scale-105"
            : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
            }`}
        >
          All ({statusCounts.all})
        </button>

        <button
          onClick={() => setSelectedStatus("live")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedStatus === "live"
            ? "bg-red-600 text-white shadow-lg shadow-red-600/30 scale-105 ring-2 ring-red-400/50"
            : "bg-white/5 text-red-400 hover:bg-red-500/10 border border-white/10"
            }`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Live ({statusCounts.live})
        </button>

        <button
          onClick={() => setSelectedStatus("upcoming")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedStatus === "upcoming"
            ? "bg-amber-400 text-black shadow-lg shadow-amber-400/20 scale-105"
            : "bg-white/5 text-amber-300 hover:bg-amber-500/10 border border-white/10"
            }`}
        >
          <Clock className="w-3 h-3 text-amber-400" />
          Upcoming ({statusCounts.upcoming})
        </button>

        <button
          onClick={() => setSelectedStatus("recent")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedStatus === "recent"
            ? "bg-[#00D7E5] text-black shadow-lg shadow-cyan-500/20 scale-105"
            : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
            }`}
        >
          Recent ({statusCounts.recent})
        </button>
      </div>

      {/* Row 2 Filter Pills: Sport Categories (Cricket, Football, etc.) */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
        <button
          onClick={() => setSelectedSport("all")}
          className={`px-3.5 py-1 rounded-full text-xs font-extrabold transition-all ${selectedSport === "all"
            ? "bg-red-500 text-white shadow-md shadow-red-500/25"
            : "bg-[#141824] text-white/60 hover:text-white border border-white/5"
            }`}
        >
          All ({sportCounts.all || 0})
        </button>

        <button
          onClick={() => setSelectedSport("cricket")}
          className={`px-3.5 py-1 rounded-full text-xs font-extrabold transition-all ${selectedSport === "cricket"
            ? "bg-[#00D7E5] text-black shadow-md shadow-cyan-500/25"
            : "bg-[#141824] text-white/60 hover:text-white border border-white/5"
            }`}
        >
          Cricket ({sportCounts.cricket || 0})
        </button>

        <button
          onClick={() => setSelectedSport("football")}
          className={`px-3.5 py-1 rounded-full text-xs font-extrabold transition-all ${selectedSport === "football"
            ? "bg-[#00D7E5] text-black shadow-md shadow-cyan-500/25"
            : "bg-[#141824] text-white/60 hover:text-white border border-white/5"
            }`}
        >
          Football ({sportCounts.football || 0})
        </button>

        {sportCounts.tennis && (
          <button
            onClick={() => setSelectedSport("tennis")}
            className={`px-3.5 py-1 rounded-full text-xs font-extrabold transition-all ${selectedSport === "tennis"
              ? "bg-[#00D7E5] text-black shadow-md shadow-cyan-500/25"
              : "bg-[#141824] text-white/60 hover:text-white border border-white/5"
              }`}
          >
            Tennis ({sportCounts.tennis})
          </button>
        )}
      </div>

      {/* Matches Grid (Loading Skeleton or Dynamic Matches) */}
      {isLoading && matches.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-white/5 bg-[#0B0F19]/60 p-4 animate-pulse space-y-4"
            >
              <div className="flex justify-between items-center">
                <div className="h-4 w-20 bg-white/10 rounded-md" />
                <div className="h-4 w-12 bg-white/10 rounded-full" />
              </div>
              <div className="grid grid-cols-7 items-center gap-2 py-4">
                <div className="col-span-3 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-white/10" />
                  <div className="h-3 w-16 bg-white/10 rounded" />
                </div>
                <div className="col-span-1 flex justify-center">
                  <div className="h-4 w-4 bg-white/5 rounded" />
                </div>
                <div className="col-span-3 flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-white/10" />
                  <div className="h-3 w-16 bg-white/10 rounded" />
                </div>
              </div>
              <div className="h-9 w-full bg-white/10 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-[#0E121E]/60 rounded-3xl border border-white/5 text-center">
          <Radio className="w-12 h-12 text-white/20 mb-3" />
          <h3 className="text-base font-bold text-white">No matches found</h3>
          <p className="text-xs text-white/50 max-w-sm mt-1">
            Try choosing a different sport category or status filter above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMatches.map((match) => {
            const isLive = match.status === "live";
            const isUpcoming = match.status === "upcoming";

            return (
              <div
                key={match.id}
                className={`group relative flex flex-col justify-between rounded-2xl border transition-all duration-300 p-4 bg-[#0B0F19]/90 hover:bg-[#101524] ${isLive
                  ? "border-blue-900/40 hover:border-blue-500/60 shadow-[0_4px_24px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_32px_rgba(37,99,235,0.2)]"
                  : "border-white/5 hover:border-white/20"
                  }`}
              >
                {/* Top Badge Row */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0 px-2 py-0.5 rounded-md bg-blue-600/20 border border-blue-500/30 text-[10px] font-black uppercase tracking-wider text-cyan-300">
                      {match.sport}
                    </span>
                    <span className="truncate text-xs font-semibold text-white/70">
                      {match.tournament}
                    </span>
                  </div>

                  {/* Status Badge */}
                  {isLive ? (
                    <span className="shrink-0 px-2.5 py-0.5 rounded-full border border-red-500/50 bg-red-600/20 text-red-400 text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      LIVE
                    </span>
                  ) : isUpcoming ? (
                    <span className="shrink-0 px-2.5 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] font-extrabold uppercase tracking-wide">
                      UPCOMING
                    </span>
                  ) : (
                    <span className="shrink-0 px-2.5 py-0.5 rounded-full border border-white/10 bg-white/5 text-white/40 text-[10px] font-extrabold uppercase tracking-wide">
                      RECENT
                    </span>
                  )}
                </div>

                {/* Versus Matchup Section */}
                <div className="grid grid-cols-7 items-center gap-2 py-2 mb-3">
                  {/* Team 1 */}
                  <div className="col-span-3 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-[#182033] border border-white/10 flex items-center justify-center shadow-inner mb-2 group-hover:scale-105 transition-transform overflow-hidden">
                      {renderTeamBadge(match.team1.name, match.team1.flag, match.sport)}
                    </div>
                    <span className="text-xs font-black text-white line-clamp-1 leading-tight">
                      {match.team1.name}
                    </span>
                    {match.team1.score && (
                      <span className="text-[11px] font-mono font-bold text-cyan-400 mt-1">
                        {match.team1.score}
                      </span>
                    )}
                  </div>

                  {/* VS Middle Accent */}
                  <div className="col-span-1 flex flex-col items-center justify-center">
                    <span className="text-xs font-black text-rose-500 tracking-wider">
                      VS
                    </span>
                  </div>

                  {/* Team 2 */}
                  <div className="col-span-3 flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-[#182033] border border-white/10 flex items-center justify-center shadow-inner mb-2 group-hover:scale-105 transition-transform overflow-hidden">
                      {renderTeamBadge(match.team2.name, match.team2.flag, match.sport)}
                    </div>
                    <span className="text-xs font-black text-white line-clamp-1 leading-tight">
                      {match.team2.name}
                    </span>
                    {match.team2.score && (
                      <span className="text-[11px] font-mono font-bold text-cyan-400 mt-1">
                        {match.team2.score}
                      </span>
                    )}
                  </div>
                </div>

                {/* Timing / Countdown details */}
                <div className="text-center py-2.5 px-3 rounded-xl bg-black/30 border border-white/5 my-3 space-y-1">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-white/90">
                    {isLive ? (
                      <span className="flex items-center gap-1 text-red-400 font-bold">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        Match In Progress
                      </span>
                    ) : isUpcoming ? (
                      <span className="flex items-center gap-1.5 text-amber-300 font-bold">
                        <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        {match.startTime}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-white/60">
                        <Clock className="w-3.5 h-3.5 text-white/40 shrink-0" />
                        {match.startTime}
                      </span>
                    )}
                  </div>

                  {isLive && (
                    <div className="text-[11px] font-mono font-bold text-rose-400">
                      <LiveDurationBadge baseSeconds={match.liveDurationSeconds} />
                    </div>
                  )}

                  {isUpcoming && (
                    <div className="text-[11px] font-mono font-medium text-amber-300/90">
                      <UpcomingCountdownBadge startIso={match.startIso} baseStartsInSeconds={match.startsInSeconds} />
                    </div>
                  )}

                  {!isLive && !isUpcoming && (
                    <div className="text-[10px] font-medium text-white/40 uppercase tracking-wider">
                      Event Concluded
                    </div>
                  )}
                </div>

                {/* Bottom Action Button */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleWatchStream(match, 0)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-black text-xs transition-all active:scale-95 ${isLive
                      ? "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-lg shadow-red-600/30"
                      : isUpcoming
                        ? "bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30"
                        : "bg-white/5 hover:bg-white/10 text-white/70 border border-white/10"
                      }`}
                  >
                    {isLive ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span>● WATCH LIVE</span>
                      </>
                    ) : isUpcoming ? (
                      <>
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>{match.startTime.includes('at ') ? `Starts ${match.startTime.split('at ')[1]}` : 'Upcoming'}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Watch Replay</span>
                      </>
                    )}
                  </button>

                  {/* Multi-source Switcher Modal trigger */}
                  {(match.sources.length > 1 || match.watchUrl) && (
                    <button
                      onClick={() => handleOpenSourceModal(match)}
                      className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/10 font-bold text-xs"
                      title="Select stream server"
                    >
                      {match.sources.length > 1 ? `${match.sources.length} Servers` : "Servers"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stream Source Selector Modal (MHDTV Multi-Source Switcher) */}
      <Dialog
        open={!!selectedMatchForStream}
        onOpenChange={(open) => !open && setSelectedMatchForStream(null)}
      >
        <DialogContent className="bg-[#0E131F] border border-white/15 text-white max-w-md p-6 rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-500" />
                <span>Select Stream Source</span>
              </div>
              {isResolvingSources && (
                <span className="text-[10px] text-cyan-400 font-semibold flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Scanning web...
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/60">
              {selectedMatchForStream?.team1.name} vs {selectedMatchForStream?.team2.name} (
              {selectedMatchForStream?.tournament})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/50">
              Available Stream Servers:
            </p>
            {selectedMatchForStream?.sources.map((source, index) => (
              <button
                key={index}
                onClick={() => {
                  const m = selectedMatchForStream;
                  setSelectedMatchForStream(null);
                  handleWatchStream(m, index);
                }}
                className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 hover:border-cyan-500/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500 group-hover:text-black transition-colors">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                      {source.name}
                    </div>
                    <div className="text-[10px] text-white/50">Direct HLS Stream with fallback</div>
                  </div>
                </div>

                {source.quality && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-white/10 text-white/80">
                    {source.quality}
                  </span>
                )}
              </button>
            ))}

            {selectedMatchForStream?.iptvChannelQuery && (
              <div className="pt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">
                  Matching TV Channel:
                </p>
                <div className="flex items-center justify-between p-3 rounded-2xl bg-blue-900/20 border border-blue-500/30 text-xs">
                  <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-white">
                      {selectedMatchForStream.iptvChannelQuery}
                    </span>
                  </div>
                  <span className="text-[10px] text-cyan-300 font-bold">In Your IPTV List</span>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Custom Live Stream Dialog */}
      <Dialog open={isAddCustomOpen} onOpenChange={setIsAddCustomOpen}>
        <DialogContent className="max-w-xl bg-[#0b101b] border-white/10 text-white p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                <Plus className="w-4 h-4" />
              </span>
              Add Custom Live Stream
            </DialogTitle>
            <DialogDescription className="text-xs text-white/50">
              Paste direct HLS streams, dual-track separate Video + Audio links, or multiple servers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Title & Sport */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Match / Stream Title *</label>
                <input
                  type="text"
                  placeholder="e.g. India vs Australia or Willow HD"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Sport Category</label>
                <select
                  value={customSport}
                  onChange={(e) => setCustomSport(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="Cricket" className="bg-[#0b101b]">Cricket</option>
                  <option value="Football" className="bg-[#0b101b]">Football</option>
                  <option value="Tennis" className="bg-[#0b101b]">Tennis</option>
                  <option value="Basketball" className="bg-[#0b101b]">Basketball</option>
                </select>
              </div>
            </div>

            {/* Tournament */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Tournament / Channel Label</label>
              <input
                type="text"
                placeholder="e.g. T20 World Cup, Premier League"
                value={customTournament}
                onChange={(e) => setCustomTournament(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Stream Source & Audio Manager with Split & Smart Paste */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-300">Stream Source & Audio Configuration</label>
              <StreamSourceEditor
                streamUrl={customStreamUrl}
                onChangeStreamUrl={setCustomStreamUrl}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-bold text-xs h-9"
                onClick={() => handleSaveCustomMatch(true)}
              >
                <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
                Play Immediately
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10 text-xs h-9"
                onClick={() => handleSaveCustomMatch(false)}
              >
                Save to Streams List
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-white/50 hover:text-white text-xs h-9"
                onClick={() => setIsAddCustomOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LiveStreamsBrowser;
