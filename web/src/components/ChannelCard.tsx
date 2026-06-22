import { memo, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Star, Play, Tv } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { favoritesAPI } from "@/lib/api";
import { toast } from "sonner";

interface Channel {
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
}

const ChannelCard = ({ channel, isFavorite, onToggleFavorite, returnTo }: ChannelCardProps) => {
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
    const params = new URLSearchParams({
      name: channel.name,
      url: channel.url,
      category: channel.group || "",
    });
    if (channel.logo && !imageError) {
      params.append("logo", channel.logo);
    }
    if (returnTo) {
      params.append("returnTo", returnTo);
    }
    if (channel.playbackSupport) {
      params.append("playback", channel.playbackSupport);
    }
    if (channel.alternateUrls && channel.alternateUrls.length > 1) {
      params.append("urls", JSON.stringify(channel.alternateUrls.slice(0, 8)));
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
      className="glass-card hover-scale group cursor-pointer overflow-hidden relative rounded-xl"
      onClick={handlePlay}
    >
      {/* Channel Image/Icon */}
      <div className="aspect-square bg-secondary/50 flex items-center justify-center relative overflow-hidden">
        {channel.logo && !imageError ? (
          <img
            src={channel.logo}
            alt={channel.name}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <Tv className="w-9 h-9 sm:w-12 sm:h-12 text-muted-foreground" />
        )}

        {/* Working Badge */}
        {channel.isWorking && (
          <Badge
            className={`absolute top-2 left-2 z-10 border shadow-lg ${
              channel.playbackSupport === "external"
                ? "border-amber-300/40 bg-amber-400 text-black shadow-amber-400/20"
                : "border-emerald-400/40 bg-emerald-500 text-black shadow-emerald-500/20"
            }`}
          >
            {badgeLabel}
          </Badge>
        )}

        {/* Quality Badge */}
        {channel.quality && (
          <Badge
            className={`absolute ${channel.isWorking ? "top-9" : "top-2"} left-2 z-10 ${
              channel.quality === "HD"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {channel.quality}
          </Badge>
        )}

        {/* Overlay on Hover */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Button
            size="icon"
            className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-primary hover:bg-primary/90"
          >
            <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current" />
          </Button>
        </div>

        {/* Favorite Button - Top Right */}
        <Button
          variant="ghost"
          size="icon"
          className={`absolute top-2 right-2 z-10 hover:bg-black/20 ${
            localIsFavorite ? "text-primary" : "text-white opacity-0 group-hover:opacity-100"
          }`}
          onClick={handleToggleFavorite}
        >
          <Star className={`w-5 h-5 ${localIsFavorite ? "fill-current" : ""}`} />
        </Button>
      </div>

      {/* Channel Info */}
      <div className="p-2.5 sm:p-3">
        <h3 className="font-semibold text-sm line-clamp-2 mb-1">
          {channel.name}
        </h3>
        {channel.group && (
          <p className="text-xs text-muted-foreground truncate">{channel.group}</p>
        )}
      </div>
    </Card>
  );
};

export default memo(ChannelCard);
