import { useEffect, useRef, useState } from "react";
import { Play, Maximize2, Minimize2, RefreshCw, Mic, Zap, Loader2 } from "lucide-react";
import { lockLandscape, unlockOrientation } from "@/lib/orientation";
import { enterPlayerFullscreen, exitPlayerFullscreen, ownsPlayerFullscreen } from "@/lib/playerFullscreen";
import HLSPlayer from "@/components/HLSPlayer";
import { movieAPI } from "@/lib/api";

// ---------------------------------------------------------------------------
// Stream source definitions — supports Movie & TV Series (Seasons + Episodes)
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
  const [isLoaded, setIsLoaded]         = useState(false);
  const [iframeKey, setIframeKey]       = useState(0);
  const playerRef = useRef<HTMLDivElement>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isExpanded = nativeFullscreen || expanded;

  const [directStreamUrl, setDirectStreamUrl] = useState<string | null>(null);
  const [useDirectHls, setUseDirectHls] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractNotice, setExtractNotice] = useState<string | null>(null);

  const handleToggleDirectHls = async () => {
    if (useDirectHls) {
      setUseDirectHls(false);
      return;
    }
    if (directStreamUrl) {
      setUseDirectHls(true);
      return;
    }
    if (!tmdbId && !imdbId) return;

    setIsExtracting(true);
    setExtractNotice(null);
    try {
      const res = await movieAPI.extractStream(tmdbId || imdbId!, {
        imdbId,
        type,
        season,
        episode,
      });
      if (res && res.direct && res.streamUrl) {
        setDirectStreamUrl(res.streamUrl);
        setUseDirectHls(true);
      } else {
        setExtractNotice("Ad-free stream not ready for this title. Using Smart Embed.");
        setTimeout(() => setExtractNotice(null), 4000);
      }
    } catch {
      setExtractNotice("Ad-free stream unavailable. Using Smart Embed.");
      setTimeout(() => setExtractNotice(null), 4000);
    } finally {
      setIsExtracting(false);
    }
  };

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

  useEffect(() => {
    // Focus Trap: when an iframe attempts to spawn an ad popup,
    // immediately regain focus on the main StreamFlow window.
    let blurTimeout: NodeJS.Timeout;
    const onWindowBlur = () => {
      blurTimeout = setTimeout(() => {
        if (document.activeElement?.tagName === 'IFRAME') {
          window.focus();
        }
      }, 50);
    };

    window.addEventListener('blur', onWindowBlur);
    return () => {
      window.removeEventListener('blur', onWindowBlur);
      clearTimeout(blurTimeout);
    };
  }, []);

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
  const isHindi = !!verifiedHindiUrl;

  const embedUrl = (() => {
    return currentSource.buildUrl(imdbId, tmdbId, type, season, episode, isHindi);
  })();

  const handleSourceChange = (id: SourceId) => {
    if (id === activeSource) return;
    setActiveSource(id);
    setIframeKey((k) => k + 1);
  };

  const handleReload = () => setIframeKey((k) => k + 1);

  if (!isLoaded) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2 bg-black/40">
          {verifiedHindiUrl ? <span className="text-sm font-bold">Hindi Dubbed</span> : <>
            <ServerSelect active={activeSource} onChange={handleSourceChange} />
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
      {/* Server selection and playback controls */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2 bg-[#1C1C1E]">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 overflow-x-auto">
          {verifiedHindiUrl ? <span className="text-sm font-bold">Hindi Dubbed</span> : <>
            <ServerSelect active={activeSource} onChange={(s) => { setUseDirectHls(false); handleSourceChange(s); }} />
            <button
              type="button"
              onClick={handleToggleDirectHls}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition flex items-center gap-1.5 ${
                useDirectHls
                  ? "bg-gradient-to-r from-[#00CFE8] to-blue-600 text-black shadow-lg shadow-cyan-500/25 font-black"
                  : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white border border-white/10"
              }`}
              title="Toggle Ad-Free Native HLS Stream"
            >
              {isExtracting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00CFE8]" />
              ) : (
                <Zap className={`h-3.5 w-3.5 ${useDirectHls ? "fill-current" : ""}`} />
              )}
              <span>{useDirectHls ? "Ad-Free Native Active" : "⚡ Ad-Free HLS"}</span>
            </button>
          </>}
          {extractNotice && (
            <span className="text-[11px] font-semibold text-amber-300 animate-pulse">
              {extractNotice}
            </span>
          )}
        </div>

        <div className="ml-2 flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => {
            if (useDirectHls) handleToggleDirectHls();
            else handleReload();
          }}
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
        {useDirectHls && directStreamUrl ? (
          <HLSPlayer
            url={directStreamUrl}
            onPlaybackError={() => {
              setUseDirectHls(false);
              setDirectStreamUrl(null);
              setExtractNotice("Direct stream failed, switched to Smart Sandbox Embed.");
              setTimeout(() => setExtractNotice(null), 4000);
            }}
          />
        ) : (
          <iframe
            key={iframeKey}
            src={embedUrl}
            // Strict Anti-Popup Sandbox:
            // Omits 'allow-popups' so ad redirects (like rm358.com) are physically BLOCKED by Chrome.
            // Omits 'allow-top-navigation' so the parent site can never be redirected.
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
            title={`${title} — ${currentSource.label}`}
            className="absolute inset-0 h-full w-full border-0"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            scrolling="no"
            referrerPolicy="origin"
          />
        )}
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

const ServerSelect = ({
  active,
  onChange,
}: {
  active: SourceId;
  onChange: (id: SourceId) => void;
}) => (
  <label className="flex min-w-0 items-center gap-2 text-xs font-bold text-white/80">
    <span>Server</span>
    <select
      aria-label="Server"
      value={active}
      onChange={(event) => onChange(event.target.value as SourceId)}
      className="min-w-0 max-w-[220px] rounded-full border border-white/15 bg-[#1C1C1E] px-3 py-2 text-xs font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60"
    >
      {SOURCES.map((source) => (
        <option key={source.id} value={source.id}>{source.label}</option>
      ))}
    </select>
  </label>
);

export default MoviePlayer;
