import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";
import mpegts from "mpegts.js";
import { AlertCircle, Loader2, Maximize, Minimize, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { streamAPI } from "@/lib/api";

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
        sourceUrl.includes("/api/stream/proxy");

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
        manifestLoadingTimeOut: 12000,
        levelLoadingTimeOut: 12000,
        fragLoadingTimeOut: 20000,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });

      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        setError(null);
        video.play().catch(() => {});
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
        (player.play() as Promise<void> | undefined)?.catch(() => {});
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
      video.play().catch(() => {});
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
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await containerRef.current.requestFullscreen();
    }
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
      className="relative aspect-video bg-black group overflow-hidden rounded-lg shadow-2xl"
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

      <div className="absolute bottom-0 left-0 right-0 z-30 flex translate-y-full items-center justify-between bg-gradient-to-t from-black/90 to-transparent p-4 transition-transform group-hover:translate-y-0">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() =>
              isPlaying ? videoRef.current?.pause() : videoRef.current?.play()
            }
          >
            {isPlaying ? (
              <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <Play className="h-6 w-6 fill-current" />
            )}
          </Button>
          <div className="rounded-sm bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
            LIVE
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={toggleFullscreen}
        >
          {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </Button>
      </div>
    </div>
  );
};

export default HLSPlayer;
