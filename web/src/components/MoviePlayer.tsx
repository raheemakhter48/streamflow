import { useState } from "react";
import { Play, Maximize2, RefreshCw, Mic, Globe } from "lucide-react";
import { lockLandscape } from "@/lib/orientation";

// ---------------------------------------------------------------------------
// Stream source definitions — supports Movie & TV Series (Seasons + Episodes) + Hindi Dubbed Auto-Shift
// ---------------------------------------------------------------------------
const SOURCES = [
  {
    id: "vidsrc",
    label: "VidSrc",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1, isHindi = false) => {
      if (type === "tv") {
        const path = `tv/${tmdbId || imdbId}/${season}/${episode}`;
        return isHindi ? `https://vidsrc.cc/v2/embed/${path}?lang=hi` : `https://vidsrc.cc/v2/embed/${path}`;
      }
      const path = imdbId ? `movie/${imdbId}` : `movie/${tmdbId}`;
      return isHindi ? `https://vidsrc.cc/v2/embed/${path}?lang=hi` : `https://vidsrc.xyz/embed/${path}`;
    },
  },
  {
    id: "autoembed",
    label: "AutoEmbed",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1, isHindi = false) => {
      const lang = isHindi ? "?lang=hi" : "";
      if (type === "tv") {
        return `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}${lang}`;
      }
      return tmdbId ? `https://autoembed.co/movie/tmdb/${tmdbId}${lang}` : `https://autoembed.co/movie/imdb/${imdbId}${lang}`;
    },
  },
  {
    id: "2embed",
    label: "2Embed",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://www.2embed.cc/embed/tv/${tmdbId}/${season}/${episode}`;
      }
      return tmdbId ? `https://www.2embed.cc/embed/tmdb/movie?id=${tmdbId}` : `https://www.2embed.cc/embed/${imdbId}`;
    },
  },
  {
    id: "videasy",
    label: "Videasy",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`;
      }
      return tmdbId ? `https://player.videasy.net/movie/${tmdbId}` : `https://player.videasy.net/movie/${imdbId}`;
    },
  },
] as const;

type SourceId = (typeof SOURCES)[number]["id"];

interface MoviePlayerProps {
  imdbId?: string;
  tmdbId?: number;
  type?: "movie" | "tv";
  season?: number;
  episode?: number;
  title?: string;
}

const MoviePlayer = ({
  imdbId,
  tmdbId,
  type = "movie",
  season = 1,
  episode = 1,
  title = "Media Player"
}: MoviePlayerProps) => {
  const [activeSource, setActiveSource] = useState<SourceId>("vidsrc");
  const [audioMode, setAudioMode]       = useState<"original" | "hindi">("original");
  const [isLoaded, setIsLoaded]         = useState(false);
  const [iframeKey, setIframeKey]       = useState(0);

  const currentSource = SOURCES.find((s) => s.id === activeSource)!;
  const isHindi = audioMode === "hindi";

  const embedUrl = (() => {
    return currentSource.buildUrl(imdbId, tmdbId, type, season, episode, isHindi);
  })();

  const handleSourceChange = (id: SourceId) => {
    if (id === activeSource) return;
    setActiveSource(id);
    setIframeKey((k) => k + 1);
  };

  const handleAudioModeChange = (mode: "original" | "hindi") => {
    if (mode === audioMode) return;
    setAudioMode(mode);
    // If Hindi Dubbed is clicked, auto-shift to SuperEmbed or AutoEmbed if current source doesn't support hindi parameter
    if (mode === "hindi" && activeSource === "videasy") {
      setActiveSource("multiembed");
    }
    setIframeKey((k) => k + 1);
  };

  const handleReload = () => setIframeKey((k) => k + 1);

  if (!isLoaded) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2 bg-black/40">
          <SourceTabs active={activeSource} onChange={handleSourceChange} />
          <AudioModeTabs active={audioMode} onChange={handleAudioModeChange} />
        </div>

        <button
          type="button"
          onClick={() => setIsLoaded(true)}
          className="group relative flex aspect-video w-full items-center justify-center bg-[#0C0D12] transition hover:bg-[#14151B]"
          aria-label={`Play ${title}`}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-black font-extrabold shadow-2xl transition group-hover:scale-110">
            <Play className="h-8 w-8 translate-x-0.5 fill-current" />
          </div>
          <p className="absolute bottom-5 text-xs font-semibold tracking-widest text-white/60">
            Click to Stream · {currentSource.label} {isHindi ? "🎙️ Hindi Dubbed" : "HD"}
          </p>
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
      {/* Header bar with Source Tabs & 1-Click Hindi Dubbed Switcher */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 bg-[#1C1C1E]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SourceTabs active={activeSource} onChange={handleSourceChange} />
          <AudioModeTabs active={audioMode} onChange={handleAudioModeChange} />
        </div>

        <button
          type="button"
          onClick={handleReload}
          title="Reload player"
          className="ml-2 shrink-0 rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="relative aspect-video w-full">
        <iframe
          key={iframeKey}
          src={embedUrl}
          title={`${title} — ${currentSource.label}`}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          scrolling="no"
          referrerPolicy="origin"
        />

        <button
          type="button"
          onClick={async () => {
            const el = document.querySelector(`iframe[title="${title} — ${currentSource.label}"]`) as HTMLIFrameElement | null;
            await el?.requestFullscreen?.();
            await lockLandscape();
          }}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white opacity-0 transition hover:opacity-100 focus:opacity-100 backdrop-blur-md"
          title="Fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <p className="px-4 py-2 text-[10px] text-white/40 flex items-center justify-between">
        <span>
          Stream provided by <span className="text-white/70 font-bold">{currentSource.label}</span>. If playback fails, switch sources above.
        </span>
        {isHindi && (
          <span className="text-amber-300 font-extrabold flex items-center gap-1">
            <Mic className="h-3 w-3" /> Hindi Dubbed Active
          </span>
        )}
      </p>
    </div>
  );
};

const SourceTabs = ({
  active,
  onChange,
}: {
  active: SourceId;
  onChange: (id: SourceId) => void;
}) => (
  <div className="flex gap-1.5 p-1">
    {SOURCES.map((source) => (
      <button
        key={source.id}
        type="button"
        onClick={() => onChange(source.id)}
        className={`rounded-full px-3.5 py-1 text-xs font-extrabold transition ${
          active === source.id
            ? "bg-white text-black shadow-md"
            : "text-white/60 hover:bg-white/10 hover:text-white"
        }`}
      >
        {source.label}
      </button>
    ))}
  </div>
);

const AudioModeTabs = ({
  active,
  onChange,
}: {
  active: "original" | "hindi";
  onChange: (mode: "original" | "hindi") => void;
}) => (
  <div className="flex gap-1 rounded-full border border-white/15 bg-white/10 p-1">
    <button
      type="button"
      onClick={() => onChange("original")}
      className={`rounded-full px-3 py-1 text-xs font-extrabold flex items-center gap-1.5 transition ${
        active === "original"
          ? "bg-white text-black shadow-md"
          : "text-white/70 hover:text-white"
      }`}
    >
      <Globe className="h-3.5 w-3.5" />
      Original
    </button>

    <button
      type="button"
      onClick={() => onChange("hindi")}
      className={`rounded-full px-3 py-1 text-xs font-extrabold flex items-center gap-1.5 transition ${
        active === "hindi"
          ? "bg-amber-400 text-black font-black shadow-lg shadow-amber-400/20 scale-105"
          : "text-amber-300 hover:text-amber-200 hover:bg-white/10"
      }`}
    >
      <Mic className="h-3.5 w-3.5" />
      Hindi Dubbed
    </button>
  </div>
);

export default MoviePlayer;
