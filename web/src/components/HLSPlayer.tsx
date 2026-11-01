import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { AlertCircle, Loader2, Maximize, Minimize, Play, RotateCw, Volume2, VolumeX, Settings, PictureInPicture2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { streamAPI } from "@/lib/api";
import { lockLandscape, unlockOrientation } from "@/lib/orientation";

interface HLSPlayerProps {
  url: string;
  urls?: string[];
  onPlaybackError?: () => void;
}

interface PlaybackAttempt {
  sourceUrl: string;
  playbackUrl: string;
  route: "direct" | "smart";
}

const HLSPlayer = ({ url, urls = [], onPlaybackError }: HLSPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const failureHandledRef = useRef("");
  const [attemptIndex, setAttemptIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRotated, setIsRotated] = useState(false);

  // Advanced Controls: PiP, Quality Selector, Volume
  const [isPipAvailable, setIsPipAvailable] = useState(false);
  const [qualities, setQualities] = useState<{ id: number; label: string }[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const preferredPlayer = localStorage.getItem("preferred_player") || "auto";
  const smartRoutingEnabled = localStorage.getItem("use_proxy") !== "false";
  const urlKey = [url, ...urls].join("\n");

  const attempts = useMemo<PlaybackAttempt[]>(() => {
    const sourceUrls = [...new Set([url, ...urls].filter(Boolean))];

    return sourceUrls.flatMap((sourceUrl) => {
      const direct: PlaybackAttempt = {
        sourceUrl,
        playbackUrl: sourceUrl,
        route: "direct",
      };
      const isBackendStream =
        sourceUrl.includes("/api/iptv/live/") ||
        sourceUrl.includes("/api/stream/proxy") ||
        sourceUrl.includes("/api/stream/mux");

      if (!smartRoutingEnabled || isBackendStream) return [direct];
      return [
        direct,
        {
          sourceUrl,
          playbackUrl: streamAPI.getProxyUrl(sourceUrl, "auto"),
          route: "smart",
        },
      ];
    });
  }, [smartRoutingEnabled, urlKey]);

  const attempt = attempts[attemptIndex];
  const streamUrl = attempt?.playbackUrl || "";
  const sourceUrl = attempt?.sourceUrl || "";
  const lowerUrl = sourceUrl.toLowerCase();
  const isHlsStream = lowerUrl.includes(".m3u8") || lowerUrl.includes("m3u_plus");
  const isMpegTsStream =
    (lowerUrl.includes(".ts") ||
      lowerUrl.includes("/live/") ||
      lowerUrl.includes("/play/") ||
      lowerUrl.includes("/stream/")) &&
    !isHlsStream;

  useEffect(() => {
    if (typeof document !== "undefined" && "pictureInPictureEnabled" in document) {
      setIsPipAvailable(document.pictureInPictureEnabled);
    }
  }, []);

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn("PiP error:", err);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
    }
  };

  const handleSelectQuality = (id: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = id;
    setCurrentQuality(id);
    setShowQualityMenu(false);
  };

  useEffect(() => {
    setAttemptIndex(0);
    failureHandledRef.current = "";
    setIsLoading(true);
    setError(null);
    setIsPlaying(false);
  }, [urlKey]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;

    const cleanup = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
      if (mpegtsRef.current) {
        try {
          mpegtsRef.current.destroy();
        } catch {
          // Player may already be destroyed after a fatal error.
        }
        mpegtsRef.current = null;
      }
      video.removeAttribute("src");
      video.load();
    };

    const failCurrentAttempt = () => {
      if (failureHandledRef.current === streamUrl) return;
      failureHandledRef.current = streamUrl;

      if (attemptIndex < attempts.length - 1) {
        setIsLoading(true);
        setError(null);
        setAttemptIndex((current) => current + 1);
        return;
      }

      setIsLoading(false);
      setError("No working direct or regional route was found for this channel.");
      onPlaybackError?.();
    };

    cleanup();
    failureHandledRef.current = "";
    setIsLoading(true);
    setError(null);

    const runMpegTs =
      preferredPlayer === "mpegts" ||
      (preferredPlayer === "auto" && isMpegTsStream);
    const runHls =
      preferredPlayer === "hls" ||
      (preferredPlayer === "auto" && isHlsStream);

    if (runHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        manifestLoadingTimeOut: 4500,
        levelLoadingTimeOut: 4500,
        fragLoadingTimeOut: 6000,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        maxBufferSize: 30 * 1000 * 1000,
        backBufferLength: 10,
        startLevel: -1,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setIsLoading(false);
        setError(null);
        if (data && data.levels && data.levels.length > 0) {
          const parsed = [
            { id: -1, label: "Auto" },
            ...data.levels.map((lvl: any, idx: number) => ({
              id: idx,
              label: lvl.height ? `${lvl.height}p` : `Level ${idx + 1}`,
            })),
          ];
          setQualities(parsed);
        }
        video.play().catch(() => { });
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        if (hls.autoLevelEnabled) {
          setCurrentQuality(-1);
        } else {
          setCurrentQuality(data.level);
        }
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          hls.destroy();
          hlsRef.current = null;
          failCurrentAttempt();
        }
      });
      return cleanup;
    }

    if (runMpegTs && mpegts.getFeatureList().mseLivePlayback) {
      try {
        const player = mpegts.createPlayer(
          {
            type: "mse",
            isLive: true,
            url: streamUrl,
            cors: true,
            withCredentials: false,
          },
          {
            enableWorker: true,
            enableStashBuffer: false,
            stashInitialSize: 128,
            lazyLoad: false,
            autoCleanupSourceBuffer: true,
          },
        );

        mpegtsRef.current = player;
        player.attachMediaElement(video);
        player.load();
        (player.play() as Promise<void> | undefined)?.catch(() => { });
        player.on(mpegts.Events.ERROR, () => {
          try {
            player.destroy();
          } catch {
            // Ignore duplicate teardown.
          }
          mpegtsRef.current = null;
          failCurrentAttempt();
        });
        player.on(mpegts.Events.METADATA_ARRIVED, () => {
          setIsLoading(false);
          setError(null);
        });
      } catch {
        failCurrentAttempt();
      }
      return cleanup;
    }

    const handleLoaded = () => {
      setIsLoading(false);
      setError(null);
      video.play().catch(() => { });
    };
    const handleError = () => failCurrentAttempt();

    video.src = streamUrl;
    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("error", handleError);
    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("error", handleError);
      cleanup();
    };
  }, [
    attemptIndex,
    attempts,
    isHlsStream,
    isMpegTsStream,
    onPlaybackError,
    preferredPlayer,
    streamUrl,
  ]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreen = !!document.fullscreenElement;
      setIsFullscreen(fullscreen);
      if (fullscreen) lockLandscape();
      else unlockOrientation();
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
      await lockLandscape();
    }
  };

  const toggleRotate = async () => {
    setIsRotated((current) => !current);
    if (!isRotated) await lockLandscape();
    else unlockOrientation();
  };

  if (!streamUrl) {
    return (
      <div className="aspect-video bg-black flex items-center justify-center text-white">
        <p>No stream URL provided</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-black group overflow-hidden rounded-lg shadow-2xl ${isRotated
          ? "fixed left-1/2 top-1/2 z-[9999] h-[100vw] w-[100vh] max-h-[100vw] max-w-[100vh] -translate-x-1/2 -translate-y-1/2 rotate-90 rounded-none"
          : "aspect-video"
        }`}
    >
      <video
        ref={videoRef}
        className="h-full w-full"
        onPlay={() => {
          setIsPlaying(true);
          setError(null);
        }}
        onPause={() => setIsPlaying(false)}
        playsInline
      />

      <div className="absolute left-3 top-3 z-30 rounded-full bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
        {attempt?.route === "smart" ? "Global route" : "Direct"}
      </div>

      {isLoading && !error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-white">
              {attempt?.route === "smart" ? "Finding best region..." : "Loading stream..."}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 px-6">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-red-500/20 p-3">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-white">Playback Error</h3>
              <p className="text-sm text-gray-400">{error}</p>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry Connection
            </Button>
          </div>
        </div>
      )}

      {!isPlaying && !isLoading && !error && (
        <button
          type="button"
          aria-label="Play"
          className="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/40"
          onClick={() => videoRef.current?.play()}
        >
          <span className="rounded-full bg-primary/90 p-5 shadow-lg transition-transform hover:scale-110">
            <Play className="h-10 w-10 fill-current text-white" />
          </span>
        </button>
      )}

      {isRotated && (
        <button
          type="button"
          aria-label="Exit rotated view"
          onClick={toggleRotate}
          className="absolute right-3 top-3 z-40 rounded-full bg-black/70 px-3 py-2 text-xs font-bold text-white"
        >
          Exit rotate
        </button>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-30 flex translate-y-full items-center justify-between bg-gradient-to-t from-black/95 via-black/70 to-transparent px-4 py-3 transition-transform duration-200 group-hover:translate-y-0">
        {/* Left Controls: Play/Pause, Live Badge, Volume */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-9 w-9"
            onClick={() =>
              isPlaying ? videoRef.current?.pause() : videoRef.current?.play()
            }
          >
            {isPlaying ? (
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <Play className="h-5 w-5 fill-current ml-0.5" />
            )}
          </Button>

          <div className="flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-0.5 text-[11px] font-black text-white shadow-md">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </div>

          {/* Volume Control */}
          <div className="group/vol flex items-center gap-1.5 pl-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white hover:bg-white/20 h-8 w-8"
              onClick={toggleMute}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4 text-red-400" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 h-1 accent-[#00D7E5] bg-white/20 rounded-lg cursor-pointer transition-all opacity-70 group-hover/vol:opacity-100"
            />
          </div>
        </div>

        {/* Right Controls: Quality Selector, PiP, Rotate, Fullscreen */}
        <div className="flex items-center gap-1.5 relative">
          {/* Quality Selector Dropdown */}
          {qualities.length > 0 && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className={`text-xs font-bold gap-1 px-2.5 h-8 rounded-full border border-white/10 ${
                  showQualityMenu ? "bg-white text-black" : "text-white/90 hover:bg-white/20"
                }`}
                onClick={() => setShowQualityMenu(!showQualityMenu)}
                title="Stream Quality"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>
                  {currentQuality === -1
                    ? "Auto"
                    : qualities.find((q) => q.id === currentQuality)?.label || "Auto"}
                </span>
              </Button>

              {showQualityMenu && (
                <div className="absolute right-0 bottom-10 z-50 w-36 rounded-2xl bg-[#14161F] border border-white/15 p-1.5 shadow-2xl backdrop-blur-xl">
                  <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white/50 border-b border-white/10 mb-1">
                    Quality
                  </div>
                  {qualities.map((q) => {
                    const isSelected = currentQuality === q.id;
                    return (
                      <button
                        key={q.id}
                        onClick={() => handleSelectQuality(q.id)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-left ${
                          isSelected
                            ? "bg-[#00D7E5] text-black shadow-sm"
                            : "text-white/80 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        <span>{q.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Picture-in-Picture Button */}
          {isPipAvailable && (
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 h-8 w-8"
              onClick={togglePiP}
              title="Picture in Picture"
            >
              <PictureInPicture2 className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8"
            onClick={toggleRotate}
            title="Rotate player"
          >
            <RotateCw className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-8 w-8"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HLSPlayer;
