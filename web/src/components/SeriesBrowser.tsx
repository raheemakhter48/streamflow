import { useState, useEffect } from "react";
import { seriesAPI } from "@/lib/api";
import { Search, Star, Tv, Film, Sparkles, Play, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";

interface SeriesCard {
  id: number;
  title: string;
  poster: string | null;
  backdrop: string | null;
  firstAirDate: string | null;
  rating: number;
  overview: string;
}

const SeriesBrowser = () => {
  const navigate = useNavigate();
  const [seriesList, setSeriesList] = useState<SeriesCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    seriesAPI.getSeries({ query: searchQuery })
      .then((res) => {
        setSeriesList(res.data || []);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [searchQuery]);

  useEffect(() => {
    if (seriesList.length <= 1) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % Math.min(seriesList.length, 6));
    }, 5000);
    return () => clearInterval(timer);
  }, [seriesList]);

  const featuredHero = seriesList[heroIndex] || seriesList[0];

  const openSeries = (seriesId: number) => {
    navigate(`/series/${seriesId}`);
  };

  return (
    <section className="pb-12">
      {/* Header Search */}
      <div className="mb-6 flex flex-col gap-3 rounded-full border border-white/10 bg-[#1C1C1E]/80 p-2 backdrop-blur-xl sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <Input
            placeholder="Search TV Series, Anime & Shows (e.g. Loki, Breaking Bad, Wednesday)..."
            className="h-11 rounded-full border-none bg-transparent pl-11 text-sm text-white placeholder-white/40 focus-visible:ring-0 focus-visible:ring-offset-0"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Hero Showcase for TV Series */}
      {!searchQuery && featuredHero && (
        <div className="relative mb-10 overflow-hidden rounded-[2rem] border border-white/10 bg-[#0C0D12] shadow-2xl transition-all duration-700">
          <div className="relative aspect-[16/9] min-h-[360px] max-h-[520px] w-full overflow-hidden">
            <img
              key={featuredHero.id}
              src={featuredHero.backdrop || featuredHero.poster || "/placeholder.svg"}
              alt={featuredHero.title}
              className="h-full w-full object-cover object-top transition-transform duration-1000 ease-out scale-105 animate-fade-in"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#000000]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#000000]/90 via-[#000000]/40 to-transparent" />

            <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 lg:p-12">
              <div className="max-w-2xl space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-3.5 py-1 border border-white/20 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white">
                    <Sparkles className="h-3 w-3 text-amber-300" />
                     StreamFlow Series
                  </div>
                  {Number(featuredHero.rating) > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 backdrop-blur-md px-3 py-1 border border-amber-400/30 text-[11px] font-extrabold text-amber-300">
                      <Star className="h-3 w-3 fill-current" />
                      {Number(featuredHero.rating).toFixed(1)} / 10
                    </div>
                  )}
                  {featuredHero.firstAirDate && (
                    <div className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md px-3 py-1 border border-white/10 text-[11px] font-bold text-white/80">
                      {featuredHero.firstAirDate.slice(0, 4)}
                    </div>
                  )}
                </div>

                <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl drop-shadow-md">
                  {featuredHero.title}
                </h1>

                {featuredHero.overview && (
                  <p className="line-clamp-2 text-xs sm:text-sm font-medium text-white/80 max-w-xl leading-relaxed">
                    {featuredHero.overview}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => openSeries(featuredHero.id)}
                    className="apple-pill-btn px-7 py-3 text-xs sm:text-sm font-extrabold flex items-center gap-2.5 shadow-2xl hover:scale-105 transition-transform"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Watch Series
                  </button>

                  <button
                    type="button"
                    onClick={() => openSeries(featuredHero.id)}
                    className="apple-pill-btn-secondary px-6 py-3 text-xs sm:text-sm font-bold flex items-center gap-2"
                  >
                    <Info className="h-4 w-4" />
                    Seasons & Episodes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Series Grid Section */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <Tv className="h-5 w-5 text-white/80" />
          {searchQuery ? `Search Results for "${searchQuery}"` : "🔥 Trending TV Series"}
        </h2>
        <span className="text-xs text-white/50 font-semibold">{seriesList.length} Shows</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-2xl bg-white/5 border border-white/10" />
          ))}
        </div>
      ) : seriesList.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-[#1C1C1E] p-12 text-center text-white/50">
          No series found. Try another search query!
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {seriesList.map((show) => (
            <button
              key={show.id}
              type="button"
              onClick={() => openSeries(show.id)}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] text-left transition-all duration-300 hover:scale-105 hover:border-white/20 hover:shadow-2xl"
            >
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#121318]">
                {show.poster ? (
                  <img
                    src={show.poster}
                    alt={show.title}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Film className="h-10 w-10 text-white/20" />
                  </div>
                )}
                <span className="absolute left-2.5 top-2.5 rounded-md bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-black text-white border border-white/10">
                   tv+
                </span>
                {Number(show.rating) > 0 && (
                  <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-extrabold text-amber-300 border border-amber-300/30">
                    <Star className="h-2.5 w-2.5 fill-current" />
                    {Number(show.rating).toFixed(1)}
                  </span>
                )}
              </div>

              <div className="p-3">
                <h3 className="truncate text-xs sm:text-sm font-extrabold text-white group-hover:text-white">
                  {show.title}
                </h3>
                <p className="text-[10px] font-semibold text-white/50 mt-0.5">
                  {show.firstAirDate?.slice(0, 4) || "TV Series"}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default SeriesBrowser;
