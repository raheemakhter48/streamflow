import { useEffect, useRef, useState } from "react";
import { Play, Maximize2, Minimize2, RefreshCw, Mic, Globe } from "lucide-react";
import { lockLandscape, unlockOrientation } from "@/lib/orientation";
import { enterPlayerFullscreen, exitPlayerFullscreen, ownsPlayerFullscreen } from "@/lib/playerFullscreen";

// ---------------------------------------------------------------------------
// Stream source definitions — supports Movie & TV Series (Seasons + Episodes) + Hindi Dubbed Auto-Shift
// ---------------------------------------------------------------------------
import { SOURCES, DEFAULT_MOVIE_SOURCE, type SourceId } from "@/lib/movieSources";

interface MoviePlayerProps {
  verifiedHindiUrl?: string;
  imdbId?: string;
  tmdbId?: number;
  type?: "movie" | "tv";
  season?: number;
  episode?: number;
  title?: string;
}

const MoviePlayer = ({
  verifiedHindiUrl,
  imdbId,
  tmdbId,
  type = "movie",
  season = 1,
  episode = 1,
  title = "Media Player"
}: MoviePlayerProps) => {
  const [activeSource, setActiveSource] = useState<SourceId>(DEFAULT_MOVIE_SOURCE);
  const [audioMode, setAudioMode]       = useState<"original" | "hindi">("original");
  const [isLoaded, setIsLoaded]         = useState(false);
  const [iframeKey, setIframeKey]       = useState(0);
  const playerRef = useRef<HTMLDivElement>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isExpanded = nativeFullscreen || expanded;

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = !!playerRef.current && ownsPlayerFullscreen(playerRef.current);
      setNativeFullscreen(active);
      if (!active) unlockOrientation();
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
      unlockOrientation();
    };
  }, [expanded]);

  const toggleFullscreen = async () => {
    const player = playerRef.current;
    if (!player) return;
    if (isExpanded) {
      try { await exitPlayerFullscreen(player); } catch { /* Browser may already be exiting. */ }
      setExpanded(false);
      return;
    }
    const entered = await enterPlayerFullscreen(player);
    if (playerRef.current !== player) return;
    if (!entered) setExpanded(true);
    else await lockLandscape();
  };

  const currentSource = verifiedHindiUrl
    ? { label: 'Hindi Dubbed', buildUrl: () => verifiedHindiUrl }
    : SOURCES.find((s) => s.id === activeSource)!;
  const isHindi = !!verifiedHindiUrl || audioMode === "hindi";

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
    if (mode === "hindi") {
      setActiveSource("screenscape");
    }
    setIframeKey((k) => k + 1);
  };

  const handleReload = () => setIframeKey((k) => k + 1);

  if (!isLoaded) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2 bg-black/40">
          {verifiedHindiUrl ? <span className="text-sm font-bold">Hindi Dubbed</span> : <>
            <SourceTabs active={activeSource} onChange={handleSourceChange} />
            <AudioModeTabs active={audioMode} onChange={handleAudioModeChange} />
          </>}
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
    <div
      ref={playerRef}
      className={`overflow-hidden border border-white/10 bg-black shadow-2xl ${isExpanded ? 'fixed inset-0 z-[2147483647] flex h-[100dvh] w-screen flex-col' : 'rounded-2xl'}`}
    >
      {/* Header bar with Source Tabs & 1-Click Hindi Dubbed Switcher */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2 bg-[#1C1C1E]">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 overflow-x-auto">
          {verifiedHindiUrl ? <span className="text-sm font-bold">Hindi Dubbed</span> : <>
            <SourceTabs active={activeSource} onChange={handleSourceChange} />
            <AudioModeTabs active={audioMode} onChange={handleAudioModeChange} />
          </>}
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={handleReload}
          title="Reload player"
          className="ml-2 shrink-0 rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={toggleFullscreen}
          title={isExpanded ? 'Exit fullscreen' : 'Fullscreen'}
          aria-label={isExpanded ? 'Exit fullscreen' : 'Fullscreen'}
          aria-pressed={isExpanded}
          className="rounded-full p-2 text-white transition hover:bg-white/10"
        >
          {isExpanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>
        </div>
      </div>

      <div className={`relative w-full ${isExpanded ? 'min-h-0 flex-1' : 'aspect-video'}`}>
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

      </div>

      <p className="shrink-0 px-4 py-2 text-[10px] text-white/40 flex items-center justify-between">
        <span>
          {verifiedHindiUrl ? 'Hindi audio source. If playback fails, retry using Reload.' : <>Stream provided by <span className="text-white/70 font-bold">{currentSource.label}</span>. If playback fails, switch sources above.</>}
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
