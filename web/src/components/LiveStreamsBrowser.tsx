import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Radio, Calendar, Clock, Tv, ExternalLink, RefreshCw, Search, ShieldCheck, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StreamSourceEditor } from "@/components/admin/StreamSourceEditor";
import { toast } from "sonner";

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
  startTime: string; // e.g. ISO string or readable
  liveDurationSeconds?: number;
  sources: MatchStreamSource[];
  iptvChannelQuery?: string; // e.g. "PTV Sports" or "Sky Sports"
}

import { memo } from "react";

// Isolated live ticking badge so the parent page doesn't re-render every second
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

// Curated live matches data replicating TFlix & MHDTV
const INITIAL_MATCHES: MatchFixture[] = [
  {
    id: "match-1",
    sport: "Cricket",
    tournament: "ICC International Test",
    status: "live",
    team1: {
      name: "South Africa",
      flag: "🇿🇦",
      score: "328/6 (94.2 ov)",
    },
    team2: {
      name: "Australia",
      flag: "🇦🇺",
      score: "284 & 142/3",
    },
    startTime: "Today • 2:30 PM",
    liveDurationSeconds: 14280,
    iptvChannelQuery: "Sky Sports Cricket",
    sources: [
      { name: "Server 1 (Cricket Gold HD)", url: "https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/manifest.m3u8", quality: "1080p HD" },
      { name: "Server 2 (Willow Fast)", url: "https://amg01269-amg01269c1-firetv-us-5377.playouts.now.amagi.tv/playlist.m3u8" },
      { name: "Server 3 (Willow HD)", url: "https://tvsen5.aynaott.com/willowhd/index.m3u8", quality: "1080p" },
    ],
  },
  {
    id: "match-2",
    sport: "Cricket",
    tournament: "WCL Cricket League T20 2026",
    status: "live",
    team1: {
      name: "India Champions",
      flag: "🇮🇳",
      score: "192/4 (20.0)",
    },
    team2: {
      name: "Pakistan Champions",
      flag: "🇵🇰",
      score: "148/3 (15.4)",
    },
    startTime: "Today • 4:00 PM",
    liveDurationSeconds: 7850,
    iptvChannelQuery: "PTV Sports",
    sources: [
      { name: "Server 1 (Cricket Gold HD)", url: "https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/manifest.m3u8", quality: "1080p HD" },
      { name: "Server 2 (Willow Fast)", url: "https://d36r8jifhgsk5j.cloudfront.net/Willow_TV.m3u8", quality: "720p 60fps" },
      { name: "Server 3 (Willow HD)", url: "https://tvsen5.aynaott.com/willowhd/index.m3u8", quality: "1080p" },
    ],
  },
  {
    id: "match-3",
    sport: "Cricket",
    tournament: "Women's Big Bash 2026",
    status: "live",
    team1: {
      name: "Sydney Sixers",
      flag: "🏏",
      score: "156/5 (20.0)",
    },
    team2: {
      name: "Melbourne Stars",
      flag: "⭐",
      score: "98/2 (11.1)",
    },
    startTime: "Today • 1:30 PM",
    liveDurationSeconds: 11200,
    iptvChannelQuery: "Sky Sports",
    sources: [
      { name: "Server 1 (Cricket Gold HD)", url: "https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/manifest.m3u8", quality: "1080p HD" },
      { name: "Server 2 (Willow Fast)", url: "https://amg01269-amg01269c1-firetv-us-5377.playouts.now.amagi.tv/playlist.m3u8" },
      { name: "Server 3 (Willow HD)", url: "https://tvsen5.aynaott.com/willowhd/index.m3u8", quality: "1080p" },
    ],
  },
  {
    id: "match-4",
    sport: "Cricket",
    tournament: "ODI Tri-series in Pakistan",
    status: "live",
    team1: {
      name: "England",
      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
      score: "275/8 (50.0)",
    },
    team2: {
      name: "Sri Lanka",
      flag: "🇱🇰",
      score: "189/5 (37.2)",
    },
    startTime: "Today • 2:00 PM",
    liveDurationSeconds: 9800,
    iptvChannelQuery: "A Sports HD",
    sources: [
      { name: "Server 1 (Cricket Gold HD)", url: "https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/manifest.m3u8", quality: "1080p HD" },
      { name: "Server 2 (Willow Fast)", url: "https://amg01269-amg01269c1-firetv-us-5377.playouts.now.amagi.tv/playlist.m3u8" },
      { name: "Server 3 (Willow HD)", url: "https://tvsen5.aynaott.com/willowhd/index.m3u8", quality: "1080p" },
    ],
  },
  {
    id: "match-5",
    sport: "Cricket",
    tournament: "ICC Women's T20",
    status: "live",
    team1: {
      name: "Afghanistan",
      flag: "🇦🇫",
      score: "142/7 (20.0)",
    },
    team2: {
      name: "Zimbabwe",
      flag: "🇿🇼",
      score: "85/4 (12.3)",
    },
    startTime: "Today • 5:30 PM",
    liveDurationSeconds: 4500,
    iptvChannelQuery: "Willow",
    sources: [
      { name: "Server 1 (Cricket Gold HD)", url: "https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/manifest.m3u8", quality: "1080p HD" },
      { name: "Server 2 (Willow Fast)", url: "https://amg01269-amg01269c1-firetv-us-5377.playouts.now.amagi.tv/playlist.m3u8" },
    ],
  },
  {
    id: "match-6",
    sport: "Football",
    tournament: "English Premier League",
    status: "live",
    team1: {
      name: "Manchester City",
      flag: "🔵",
      score: "2",
    },
    team2: {
      name: "Arsenal",
      flag: "🔴",
      score: "1",
    },
    startTime: "Today • 8:30 PM",
    liveDurationSeconds: 3820,
    iptvChannelQuery: "TNT Sports 1",
    sources: [
      { name: "Server 1 (TyC Sports HD)", url: "https://amg26268-amg26268c14-freelivesports-emea-10267.playouts.now.amagi.tv/ts-us-e2-n2/playlist/amg26268-sportsstudio-tycsports-freelivesportsemea/playlist.m3u8", quality: "1080p HD" },
      { name: "Server 2 (talkSPORT Live)", url: "https://af7a8b4e.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfdGFsa1NQT1JUX0hMUw/playlist.m3u8", quality: "720p" },
    ],
  },
  {
    id: "match-7",
    sport: "Football",
    tournament: "UEFA Champions League",
    status: "live",
    team1: {
      name: "Real Madrid",
      flag: "⚪",
      score: "3",
    },
    team2: {
      name: "Bayern Munich",
      flag: "🔴",
      score: "2",
    },
    startTime: "Today • 9:00 PM",
    liveDurationSeconds: 4100,
    iptvChannelQuery: "beIN Sports",
    sources: [
      { name: "Server 1 (TyC Sports HD)", url: "https://amg26268-amg26268c14-freelivesports-emea-10267.playouts.now.amagi.tv/ts-us-e2-n2/playlist/amg26268-sportsstudio-tycsports-freelivesportsemea/playlist.m3u8", quality: "1080p HD" },
      { name: "Server 2 (talkSPORT Live)", url: "https://af7a8b4e.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfdGFsa1NQT1JUX0hMUw/playlist.m3u8", quality: "720p" },
    ],
  },
  {
    id: "match-8",
    sport: "Cricket",
    tournament: "Hong Kong Sixes 2026",
    status: "upcoming",
    team1: {
      name: "Pakistan Sixes",
      flag: "🇵🇰",
    },
    team2: {
      name: "South Africa Sixes",
      flag: "🇿🇦",
    },
    startTime: "Tomorrow • 11:30 AM",
    iptvChannelQuery: "Ten Sports",
    sources: [
      { name: "Server 1 (Willow HD)", url: "https://tvsen5.aynaott.com/willowhd/index.m3u8", quality: "1080p HD" },
      { name: "Server 2 (Cricket Gold)", url: "https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/manifest.m3u8", quality: "1080p HD" },
    ],
  },
  {
    id: "match-9",
    sport: "Cricket",
    tournament: "ICC International ODI",
    status: "upcoming",
    team1: {
      name: "India",
      flag: "🇮🇳",
    },
    team2: {
      name: "New Zealand",
      flag: "🇳🇿",
    },
    startTime: "Tomorrow • 1:30 PM",
    iptvChannelQuery: "Star Sports",
    sources: [
      { name: "Server 1 (Willow HD)", url: "https://tvsen5.aynaott.com/willowhd/index.m3u8", quality: "1080p HD" },
      { name: "Server 2 (Cricket Gold)", url: "https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/manifest.m3u8", quality: "1080p HD" },
    ],
  },
  {
    id: "match-10",
    sport: "Football",
    tournament: "La Liga Santander",
    status: "upcoming",
    team1: {
      name: "Barcelona",
      flag: "🔵🔴",
    },
    team2: {
      name: "Atletico Madrid",
      flag: "⚪🔴",
    },
    startTime: "Tomorrow • 8:00 PM",
    iptvChannelQuery: "beIN Sports",
    sources: [
      { name: "Server 1 (TyC Sports HD)", url: "https://amg26268-amg26268c14-freelivesports-emea-10267.playouts.now.amagi.tv/ts-us-e2-n2/playlist/amg26268-sportsstudio-tycsports-freelivesportsemea/playlist.m3u8", quality: "1080p HD" },
      { name: "Server 2 (talkSPORT Live)", url: "https://af7a8b4e.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfdGFsa1NQT1JUX0hMUw/playlist.m3u8", quality: "720p" },
    ],
  },
  {
    id: "match-11",
    sport: "Cricket",
    tournament: "ICC International Test",
    status: "recent",
    team1: {
      name: "Bangladesh",
      flag: "🇧🇩",
      score: "245 & 180",
    },
    team2: {
      name: "West Indies",
      flag: "🌴",
      score: "350 & 76/2",
    },
    startTime: "Finished • Yesterday",
    sources: [
      { name: "Replay (Cricket Gold)", url: "https://streams2.sofast.tv/ptnr-yupptv/title-cricketgold/v1/master/611d79b11b77e2f571934fd80ca1413453772ac7/b2048bb8-1686-4432-aa50-647245383e0c/manifest.m3u8", quality: "1080p HD" },
    ],
  },
  {
    id: "match-12",
    sport: "Tennis",
    tournament: "ATP World Tour Masters",
    status: "recent",
    team1: {
      name: "Carlos Alcaraz",
      flag: "🇪🇸",
      score: "6 7 6",
    },
    team2: {
      name: "Novak Djokovic",
      flag: "🇷🇸",
      score: "4 5 4",
    },
    startTime: "Finished • Oct 30",
    sources: [
      { name: "Replay Server (talkSPORT)", url: "https://af7a8b4e.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfdGFsa1NQT1JUX0hMUw/playlist.m3u8", quality: "1080p" },
    ],
  },
];

interface LiveStreamsBrowserProps {
  channels?: any[];
}

const LiveStreamsBrowser = ({ channels = [] }: LiveStreamsBrowserProps) => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchFixture[]>(INITIAL_MATCHES);
  const [selectedStatus, setSelectedStatus] = useState<string>("live");
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMatchForStream, setSelectedMatchForStream] = useState<MatchFixture | null>(null);

  // Custom Stream Add Modal State
  const [isAddCustomOpen, setIsAddCustomOpen] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const [customTournament, setCustomTournament] = useState("Live Sports Feed");
  const [customSport, setCustomSport] = useState<"Cricket" | "Football" | "Basketball" | "Tennis">("Cricket");
  const [customStreamUrl, setCustomStreamUrl] = useState("");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("custom_live_matches");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMatches([...parsed, ...INITIAL_MATCHES]);
        }
      }
    } catch {}
  }, []);

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

  // Filtered matches
  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      if (selectedStatus !== "all" && match.status !== selectedStatus) return false;
      if (selectedSport !== "all" && match.sport.toLowerCase() !== selectedSport.toLowerCase()) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchText = `${match.tournament} ${match.team1.name} ${match.team2.name} ${match.sport}`.toLowerCase();
        if (!matchText.includes(q)) return false;
      }
      return true;
    });
  }, [matches, selectedStatus, selectedSport, searchQuery]);

  const handleWatchStream = (match: MatchFixture, sourceIndex = 0) => {
    let selectedSource = match.sources[sourceIndex] || match.sources[0];
    let allUrls = match.sources.map((s) => s.url);

    // Check if there is a matching user IPTV channel (e.g. PTV Sports, Willow, etc.)
    if (match.iptvChannelQuery && channels.length > 0) {
      const q = match.iptvChannelQuery.toLowerCase();
      const matchedChannel = channels.find((c) =>
        c.name.toLowerCase().includes(q) || q.includes(c.name.toLowerCase())
      );
      if (matchedChannel && matchedChannel.url) {
        allUrls = [matchedChannel.url, ...allUrls];
        if (sourceIndex === 0) {
          selectedSource = {
            name: matchedChannel.name,
            url: matchedChannel.url,
            quality: "IPTV Live Channel",
          };
        }
      }
    }

    const title = `${match.team1.name} vs ${match.team2.name} - ${match.tournament}`;
    const params = new URLSearchParams({
      name: title,
      url: selectedSource.url,
      category: "Live Sports",
      urls: JSON.stringify(allUrls),
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
          <p className="text-xs text-white/50 mt-1">
            Real-time cricket, football and sports matches with multi-server playback
          </p>
        </div>

        {/* Search & Add Stream Actions */}
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
          onClick={() => setSelectedStatus("recent")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedStatus === "recent"
            ? "bg-[#00D7E5] text-black shadow-lg shadow-cyan-500/20 scale-105"
            : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
            }`}
        >
          Recent ({statusCounts.recent})
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
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedStatus === "upcoming"
            ? "bg-amber-400 text-black shadow-lg shadow-amber-400/20 scale-105"
            : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
            }`}
        >
          Upcoming ({statusCounts.upcoming})
        </button>

        <button
          onClick={() => setSelectedStatus("all")}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedStatus === "all"
            ? "bg-white text-black shadow-lg scale-105"
            : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white border border-white/10"
            }`}
        >
          All ({statusCounts.all})
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

      {/* Matches Grid (TFlix 3-column / responsive design) */}
      {filteredMatches.length === 0 ? (
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
                    <div className="w-12 h-12 rounded-full bg-[#182033] border border-white/10 flex items-center justify-center text-2xl shadow-inner mb-2 group-hover:scale-105 transition-transform">
                      {match.team1.flag}
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
                    <div className="w-12 h-12 rounded-full bg-[#182033] border border-white/10 flex items-center justify-center text-2xl shadow-inner mb-2 group-hover:scale-105 transition-transform">
                      {match.team2.flag}
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
                <div className="text-center py-2 border-t border-white/5 mb-3">
                  <div className="text-[11px] font-medium text-white/60">
                    {match.startTime}
                  </div>
                  {isLive && (
                    <div className="text-[11px] font-mono font-bold text-rose-400 mt-0.5">
                      <LiveDurationBadge baseSeconds={match.liveDurationSeconds} />
                    </div>
                  )}
                </div>

                {/* Bottom Action Button */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleWatchStream(match, 0)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-black text-xs transition-all active:scale-95 ${isLive
                      ? "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30"
                      : isUpcoming
                        ? "bg-white/10 hover:bg-white/20 text-white border border-white/15"
                        : "bg-white/5 hover:bg-white/10 text-white/80 border border-white/10"
                      }`}
                  >
                    {isLive ? (
                      <>
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        <span>● LIVE NOW</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Watch Match</span>
                      </>
                    )}
                  </button>

                  {/* Multi-source Switcher Modal trigger */}
                  {match.sources.length > 1 && (
                    <button
                      onClick={() => setSelectedMatchForStream(match)}
                      className="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/10 font-bold text-xs"
                      title="Select stream server"
                    >
                      {match.sources.length} Servers
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
            <DialogTitle className="text-lg font-black text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-red-500" />
              <span>Select Stream Source</span>
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
