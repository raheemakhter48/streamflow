import { memo, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Play, Tv } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { favoritesAPI, toPasswordlessStreamUrl } from "@/lib/api";
import { toast } from "sonner";

interface Channel {
  id?: string;
  name: string;
  url: string;
  logo?: string;
  group?: string;
  quality?: "HD" | "SD";
  isWorking?: boolean;
  playbackSupport?: "browser" | "external";
  source?: "iptv-org" | "m3u";
  alternateUrls?: string[];
}

interface ChannelCardProps {
  channel: Channel;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  returnTo?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

const ChannelCard = ({
  channel,
  isFavorite,
  onToggleFavorite,
  returnTo,
  selectable = false,
  selected = false,
  onSelect,
}: ChannelCardProps) => {
  const navigate = useNavigate();
  const [localIsFavorite, setLocalIsFavorite] = useState(isFavorite);
  const [imageError, setImageError] = useState(false);
  const badgeLabel = channel.source === "m3u"
    ? (channel.playbackSupport === "external" ? "M3U VLC" : "M3U")
    : (channel.playbackSupport === "external" ? "VLC OK" : "WORKING");

  useEffect(() => {
    setLocalIsFavorite(isFavorite);
  }, [isFavorite]);

  const handlePlay = () => {
    if (selectable) {
      onSelect?.();
      return;
    }

    const safeUrl = toPasswordlessStreamUrl(channel.url);
    const safeAlternateUrls = (channel.alternateUrls || []).map(toPasswordlessStreamUrl);
    const params = new URLSearchParams({
      name: channel.name,
      url: safeUrl,
      category: channel.group || "",
    });
    if (channel.id) {
      params.append("channelId", channel.id);
    }
    if (channel.logo && !imageError) {
      params.append("logo", channel.logo);
    }
    if (returnTo) {
      params.append("returnTo", returnTo);
    }
    if (channel.playbackSupport) {
      params.append("playback", channel.playbackSupport);
    }
    if (safeAlternateUrls.length > 1) {
      params.append("urls", JSON.stringify(safeAlternateUrls.slice(0, 8)));
    }
    navigate(`/player?${params.toString()}`);
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();

    try {
      if (localIsFavorite) {
        await favoritesAPI.removeFavorite(channel.url);
        toast.success("Removed from favorites");
      } else {
        await favoritesAPI.addFavorite({
          channelName: channel.name,
          channelUrl: channel.url,
          channelLogo: channel.logo,
          category: channel.group,
        });
        toast.success("Added to favorites");
      }
      setLocalIsFavorite(!localIsFavorite);
      onToggleFavorite();
    } catch (error: any) {
      toast.error(error.message || "Failed to update favorites");
    }
  };

  return (
    <Card
      className={`enterprise-card enterprise-card-hover group relative cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] ${
        selected ? "ring-2 ring-white bg-white/10" : ""
      }`}
      onClick={handlePlay}
    >
      {/* Channel Image/Icon */}
      <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#141416] sm:aspect-square">
        {channel.logo && !imageError ? (
          <img
            src={channel.logo}
            alt={channel.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            onError={() => setImageError(true)}
          />
        ) : (
          <Tv className="w-9 h-9 sm:w-12 sm:h-12 text-white/30" />
        )}

        {selectable && (
          <button
            type="button"
            aria-label={selected ? `Deselect ${channel.name}` : `Select ${channel.name}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelect?.();
            }}
            className={`absolute top-2.5 right-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
              selected
                ? "border-white bg-white text-black font-extrabold"
                : "border-white/40 bg-black/70 text-transparent hover:border-white"
            }`}
          >
            <Check className="h-4 w-4" strokeWidth={3} />
          </button>
        )}

        {/* Working Badge */}
        {channel.isWorking && (
          <Badge
            className={`absolute top-2.5 left-2.5 z-10 border shadow-lg backdrop-blur-md ${
              channel.playbackSupport === "external"
                ? "border-amber-300/40 bg-amber-400 text-black shadow-amber-400/20"
                : "border-emerald-400/40 bg-emerald-500 text-black shadow-emerald-500/20"
            }`}
          >
            {badgeLabel}
          </Badge>
        )}

        {/* Overlay on Hover */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl scale-95 group-hover:scale-100 transition-transform">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>

        {/* Favorite Button - Top Right */}
        <Button
          variant="ghost"
          size="icon"
          className={`absolute top-2 right-2 z-10 hover:bg-black/40 ${selectable ? "hidden" : ""} ${
            localIsFavorite ? "text-amber-400" : "text-white opacity-0 group-hover:opacity-100"
          }`}
          onClick={handleToggleFavorite}
        >
          <Star className={`w-5 h-5 ${localIsFavorite ? "fill-current" : ""}`} />
        </Button>
      </div>

      {/* Channel Info */}
      <div className="p-3">
        <h3 className="mb-1 line-clamp-2 min-h-[2.25rem] text-sm font-bold leading-5 text-white">
          {channel.name}
        </h3>
        {channel.group && (
          <p className="truncate text-xs font-medium text-white/40">{channel.group}</p>
        )}
      </div>
    </Card>
  );
};

export default memo(ChannelCard);
