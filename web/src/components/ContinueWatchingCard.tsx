import { memo, useState } from "react";
import { Play, Star, Tv, Film } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { favoritesAPI, toPasswordlessStreamUrl } from "@/lib/api";
import { toast } from "sonner";

interface ContinueWatchingCardProps {
  item: {
    channelId?: string;
    channelName: string;
    channelUrl: string;
    channelLogo?: string;
    category?: string;
    watchedAt?: string;
  };
  isFavorite: boolean;
  onToggleFavorite: () => void;
  returnTo?: string;
}

const ContinueWatchingCard = ({
  item,
  isFavorite,
  onToggleFavorite,
  returnTo,
}: ContinueWatchingCardProps) => {
  const navigate = useNavigate();
  const [localIsFavorite, setLocalIsFavorite] = useState(isFavorite);
  const [imageError, setImageError] = useState(false);

  const isMovie = item.category?.toLowerCase().includes("movie") || 
                  item.channelName.toLowerCase().includes("movie") ||
                  (item.channelLogo && item.channelLogo.includes("image.tmdb.org"));

  const handlePlay = () => {
    const safeUrl = toPasswordlessStreamUrl(item.channelUrl);
    const params = new URLSearchParams({
      name: item.channelName,
      url: safeUrl,
      category: item.category || "",
    });
    if (item.channelId) params.append("channelId", item.channelId);
    if (item.channelLogo && !imageError) params.append("logo", item.channelLogo);
    if (returnTo) params.append("returnTo", returnTo);

    navigate(`/player?${params.toString()}`);
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (localIsFavorite) {
        await favoritesAPI.removeFavorite(item.channelUrl);
        toast.success("Removed from favorites");
      } else {
        await favoritesAPI.addFavorite({
          channelName: item.channelName,
          channelUrl: item.channelUrl,
          channelLogo: item.channelLogo,
          category: item.category,
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
    <div
      onClick={handlePlay}
      className="group relative w-44 sm:w-48 shrink-0 cursor-pointer overflow-hidden rounded-2xl border border-white/10 bg-[#16171B] transition-all duration-300 hover:border-white/25 hover:bg-[#1C1D22] hover:shadow-xl hover:-translate-y-0.5"
    >
      {/* Thumbnail / Poster Area with fixed 16:9 ratio */}
      <div className="relative aspect-video w-full overflow-hidden bg-[#0D0E12] flex items-center justify-center">
        {item.channelLogo && !imageError ? (
          <img
            src={item.channelLogo}
            alt={item.channelName}
            loading="lazy"
            decoding="async"
            className={`h-full w-full transition-transform duration-500 group-hover:scale-105 ${
              isMovie ? "object-cover" : "object-contain p-2.5"
            }`}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-white/30 gap-1">
            {isMovie ? <Film className="w-8 h-8" /> : <Tv className="w-8 h-8" />}
          </div>
        )}

        {/* Hover Dark Overlay with Play Circle */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform duration-200 group-hover:scale-105">
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </div>
        </div>

        {/* Category Pill Tag */}
        {item.category && (
          <span className="absolute top-2 left-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white/90 backdrop-blur-md">
            {item.category}
          </span>
        )}

        {/* Favorite Button */}
        <button
          onClick={handleToggleFavorite}
          className={`absolute top-2 right-2 rounded-full p-1.5 transition-all ${
            localIsFavorite
              ? "bg-black/70 text-amber-400"
              : "bg-black/60 text-white/70 opacity-0 group-hover:opacity-100 hover:text-white"
          }`}
          title={localIsFavorite ? "Remove favorite" : "Add to favorites"}
        >
          <Star className={`w-3.5 h-3.5 ${localIsFavorite ? "fill-current" : ""}`} />
        </button>

        {/* Sleek bottom progress bar (streaming resume look) */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
          <div className="h-full bg-red-500/90 rounded-r-full" style={{ width: "65%" }} />
        </div>
      </div>

      {/* Item Meta info */}
      <div className="p-3">
        <h4 className="truncate text-xs font-bold text-white tracking-tight group-hover:text-cyan-400 transition-colors">
          {item.channelName}
        </h4>
        <div className="mt-1 flex items-center justify-between text-[10px] text-white/50">
          <span className="truncate">{item.category || "Live Stream"}</span>
          <span className="font-semibold text-emerald-400">Resume</span>
        </div>
      </div>
    </div>
  );
};

export default memo(ContinueWatchingCard);
