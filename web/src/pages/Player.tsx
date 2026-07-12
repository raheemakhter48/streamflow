import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star, Tv, ExternalLink, Copy, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import HLSPlayer from "@/components/HLSPlayer";
import { favoritesAPI, iptvAPI, recentlyWatchedAPI, streamAPI, toPasswordlessStreamUrl } from "@/lib/api";
import { toast } from "sonner";

const Player = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isFavorite, setIsFavorite] = useState(false);

  const channelName = searchParams.get("name") || "Unknown Channel";
  const channelId = searchParams.get("channelId") || "";
  const rawChannelUrl = searchParams.get("url") || "";
  const channelUrl = toPasswordlessStreamUrl(rawChannelUrl);
  const queryAlternateUrls = useMemo(() => {
    try {
      const parsed = JSON.parse(searchParams.get("urls") || "[]");
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(toPasswordlessStreamUrl) : [];
    } catch {
      return [];
    }
  }, [searchParams]);
  const [latestUrls, setLatestUrls] = useState<string[] | null>(null);
  const fallbackUrls = useMemo(() => {
    const candidates = latestUrls || [channelUrl, ...queryAlternateUrls];
    return [...new Set(candidates.filter(Boolean))];
  }, [channelUrl, latestUrls, queryAlternateUrls]);
  const activeUrl = fallbackUrls[0] || channelUrl;
  const alternateUrls = fallbackUrls.slice(1);
  const channelLogo = searchParams.get("logo") || "";
  const channelCategory = searchParams.get("category") || "";
  const returnTo = searchParams.get("returnTo") || "/dashboard";
  const playbackSupport = searchParams.get("playback") || "browser";
  const needsExternalPlayer = playbackSupport === "external";

  useEffect(() => {
    setLatestUrls(null);
    if (!channelId) return;

    let cancelled = false;
    iptvAPI.getChannel(channelId)
      .then((result) => {
        const streams = Array.isArray(result?.data?.iptv_streams)
          ? result.data.iptv_streams
          : [];
        const currentUrls = [...new Set(
          streams
            .map((stream: any) => stream?.url)
            .filter(Boolean)
            .map(toPasswordlessStreamUrl)
        )] as string[];

        if (!cancelled && currentUrls.length > 0) {
          setLatestUrls(currentUrls);
        }
      })
      .catch((error) => console.warn("Could not refresh channel URL:", error.message));

    return () => {
      cancelled = true;
    };
  }, [channelId, rawChannelUrl]);

  useEffect(() => {
    checkFavorite();
    addToRecentlyWatched();
  }, [activeUrl]);

  const handlePlaybackError = useCallback(() => {
    toast.error("No working route was found for this channel.");
  }, []);

  const checkFavorite = async () => {
    try {
      const favorites = await favoritesAPI.getFavorites();
      const isFav = favorites.some((fav: any) => fav.channelUrl === activeUrl);
      setIsFavorite(isFav);
    } catch (error) {
      console.error("Error checking favorite:", error);
    }
  };

  const addToRecentlyWatched = async () => {
    try {
      await recentlyWatchedAPI.addRecentlyWatched({
        channelName,
        channelUrl: activeUrl,
        channelLogo,
        category: channelCategory,
      });
    } catch (error) {
      console.error("Error adding to recently watched:", error);
    }
  };

  const toggleFavorite = async () => {
    try {
      if (isFavorite) {
        await favoritesAPI.removeFavorite(activeUrl);
        toast.success("Removed from favorites");
      } else {
        await favoritesAPI.addFavorite({
          channelName,
          channelUrl: activeUrl,
          channelLogo,
          category: channelCategory,
        });
        toast.success("Added to favorites");
      }
      setIsFavorite(!isFavorite);
    } catch (error: any) {
      toast.error(error.message || "Failed to update favorites");
    }
  };

  const copyStreamUrl = () => {
    navigator.clipboard.writeText(activeUrl);
    toast.success("Stream URL copied to clipboard!");
  };

  const openExternalUrl = async (url: string) => {
    if (window.streamVaultDesktop?.openExternal) {
      await window.streamVaultDesktop.openExternal(url);
      return;
    }
    window.location.href = url;
  };

  const openBrowserUrl = async (url: string) => {
    if (window.streamVaultDesktop?.openExternal) {
      await window.streamVaultDesktop.openExternal(url);
      return;
    }
    window.open(url, '_blank');
  };

  const openInVLC = async () => {
    try {
      toast.info("Resolving redirects...");
      
      // First, resolve redirects to get final URL
      const resolveResult = await streamAPI.resolveUrl(activeUrl);
      
      let urlToUse = activeUrl;
      let redirectInfo = "";
      
      if (resolveResult.success && resolveResult.finalUrl) {
        urlToUse = resolveResult.finalUrl;
        
        if (resolveResult.redirected) {
          redirectInfo = ` (Redirected from original URL)`;
          toast.success(`Redirect resolved! Opening in VLC...`);
        } else {
          toast.success("Opening in VLC...");
        }
      } else {
        // If resolve fails, use original URL - VLC will handle redirects automatically
        toast.warning("Could not resolve redirects. VLC will handle redirects automatically.");
      }
      
      // VLC protocol handler - works on Windows, Mac, Linux if VLC is installed
      const vlcUrl = `vlc://${urlToUse}`;
      await openExternalUrl(vlcUrl);
      
      // Fallback: Show instructions
      setTimeout(() => {
        toast.info(
          `If VLC didn't open automatically:\n1. Open VLC\n2. Go to Media > Open Network Stream\n3. Paste this URL: ${urlToUse}${redirectInfo}`,
          { duration: 8000 }
        );
      }, 1500);
      
    } catch (error) {
      console.error('Error opening in VLC:', error);
      // Fallback to original URL
      const vlcUrl = `vlc://${activeUrl}`;
      await openExternalUrl(vlcUrl);
      toast.info("Opening in VLC. VLC will automatically handle any redirects.");
    }
  };

  const openInMXPlayer = async () => {
    // MX Player intent for Android
    const mxUrl = `intent:${activeUrl}#Intent;type=video/*;scheme=http;end`;
    await openExternalUrl(mxUrl);
    toast.info("Opening in MX Player (Android only). For other devices, copy the URL and paste in your player.");
  };

  const openInExternalPlayer = async (player: string) => {
    switch (player) {
      case 'vlc':
        await openInVLC();
        break;
      case 'mx':
        await openInMXPlayer();
        break;
      case 'default':
        await openBrowserUrl(activeUrl);
        toast.info("Opening stream in default player. If it doesn't work, copy the URL and paste in VLC or MX Player.");
        break;
      default:
        await openBrowserUrl(activeUrl);
    }
  };

  const downloadM3U = () => {
    // Create a simple M3U file with this channel
    const m3uContent = `#EXTM3U
#EXTINF:-1,${channelName}
${activeUrl}`;
    
    const blob = new Blob([m3uContent], { type: 'application/vnd.apple.mpegurl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${channelName.replace(/[^a-z0-9]/gi, '_')}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("M3U file downloaded! Open it in VLC or any IPTV player.");
  };

  return (
    <div className="enterprise-bg min-h-screen bg-background lg:pl-64">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#1F2937]/80 bg-[#07090B]/90 backdrop-blur-xl">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <Button variant="ghost" onClick={() => navigate(returnTo)} className="w-fit">
              <ArrowLeft className="w-5 h-5 mr-2" />
              Back
            </Button>
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 min-w-0">
              <div className="text-left sm:text-right min-w-0">
                <h1 className="font-bold truncate max-w-[220px] sm:max-w-[360px]">{channelName}</h1>
                {channelCategory && (
                  <p className="text-sm text-muted-foreground truncate max-w-[220px] sm:max-w-[360px]">{channelCategory}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Open In
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openInExternalPlayer('vlc')}>
                      <Tv className="w-4 h-4 mr-2" />
                      VLC Player
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openInExternalPlayer('mx')}>
                      <Tv className="w-4 h-4 mr-2" />
                      MX Player (Android)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openInExternalPlayer('default')}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Default Player
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={copyStreamUrl}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy URL
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadM3U}>
                      <Download className="w-4 h-4 mr-2" />
                      Download M3U
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleFavorite}
                  className="hover-glow"
                >
                  <Star
                    className={`w-5 h-5 ${isFavorite ? "fill-primary text-primary" : ""}`}
                  />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Video Player */}
      <div className="container mx-auto px-4 sm:px-6 py-5 sm:py-8">
        <div className="enterprise-panel relative aspect-video min-h-[220px] overflow-visible rounded-3xl bg-black sm:min-h-0">
          {activeUrl ? (
            <>
              <HLSPlayer url={activeUrl} urls={alternateUrls} onPlaybackError={handlePlaybackError} />
              {/* Quick Action Button - Overlay on player */}
              <div className="absolute top-4 right-4 z-30">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="gap-2 bg-black/70 hover:bg-black/90 backdrop-blur-sm"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open In
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openInExternalPlayer('vlc')}>
                      <Tv className="w-4 h-4 mr-2" />
                      <span className="font-semibold">Open in VLC (Recommended)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openInExternalPlayer('mx')}>
                      <Tv className="w-4 h-4 mr-2" />
                      Open in MX Player
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openInExternalPlayer('default')}>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open in Browser
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={copyStreamUrl}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Stream URL
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={downloadM3U}>
                      <Download className="w-4 h-4 mr-2" />
                      Download M3U File
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <Tv className="w-16 h-16 text-destructive mx-auto mb-4" />
                <p className="text-white">No stream URL provided</p>
                <Button onClick={() => navigate(returnTo)} className="mt-4">
                  Back to Channels
                </Button>
              </div>
            </div>
          )}
        </div>
        
        {/* Channel Info */}
        <div className="enterprise-card mt-6 rounded-3xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {channelLogo && (
              <img
                src={channelLogo}
                alt={channelName}
                loading="lazy"
                decoding="async"
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-bold mb-2 break-words">{channelName}</h2>
              {channelCategory && (
                <p className="text-muted-foreground mb-4">{channelCategory}</p>
              )}
              
              {activeUrl.includes("otv.to") && (
                <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-400">
                    <strong>Note:</strong> If the stream doesn't load, the channel may be temporarily unavailable. Try opening in VLC or MX Player for better compatibility.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Player;
