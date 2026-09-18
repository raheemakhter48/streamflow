import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Film, Loader2, Play, Info, Sparkles, Star } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { movieAPI } from "@/lib/api";
import { toast } from "sonner";

interface MovieCategory {
  id: string;
  name: string;
}

interface MovieCard {
  id: number;
  title: string;
  overview?: string;
  poster?: string;
  backdrop?: string;
  releaseDate?: string;
  rating?: number;
}

interface MovieBrowserProps {
  searchQuery?: string;
}

const MOVIE_REGIONS = [
  { code: "US", name: "Global / Worldwide 🌐" },
  { code: "AE", name: "United Arab Emirates 🇦🇪" },
  { code: "PK", name: "Pakistan 🇵🇰" },
  { code: "IN", name: "India 🇮🇳" },
  { code: "SA", name: "Saudi Arabia 🇸🇦" },
  { code: "GB", name: "United Kingdom 🇬🇧" },
  { code: "CA", name: "Canada 🇨🇦" },
  { code: "AU", name: "Australia 🇦🇺" },
  { code: "TR", name: "Turkey 🇹🇷" },
  { code: "KR", name: "South Korea 🇰🇷" },
  { code: "JP", name: "Japan 🇯🇵" },
];

const MOVIE_REGION_STORAGE_KEY = "streamflow_movie_region";

const MovieBrowser = ({ searchQuery = "" }: MovieBrowserProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState<MovieCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("popular");
  const [selectedRegion, setSelectedRegion] = useState(() => {
    return localStorage.getItem(MOVIE_REGION_STORAGE_KEY) || "US";
  });
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "popular" | "top_rated">("popular");
  const [movies, setMovies] = useState<MovieCard[]>([]);
  const [heroMovies, setHeroMovies] = useState<MovieCard[]>([]);
  const [recentlyWatchedMovies, setRecentlyWatchedMovies] = useState<any[]>([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  // Fetch top-rated blockbuster movies for Hero Showcase
  useEffect(() => {
    movieAPI.getMovies({ category: "popular", sort: "top_rated", region: selectedRegion })
      .then((res) => {
        const topBlockbusters = (res.data || [])
          .filter((m: MovieCard) => m.backdrop && m.poster && (m.rating || 0) >= 6.0)
          .sort((a: MovieCard, b: MovieCard) => (b.rating || 0) - (a.rating || 0));
        setHeroMovies(topBlockbusters.slice(0, 8));
      })
      .catch(() => {});
  }, [selectedRegion]);

  // Auto rotate hero carousel every 5s
  useEffect(() => {
    if (heroMovies.length === 0) return;
    const timer = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroMovies.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroMovies.length]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("streamflow_recently_watched_movies") || "[]");
      setRecentlyWatchedMovies(stored);
    } catch { /* ignore */ }
  }, [location.search, reloadKey]);

  const clearRecentlyWatchedMovies = () => {
    localStorage.removeItem("streamflow_recently_watched_movies");
    setRecentlyWatchedMovies([]);
    toast.success("Watch history cleared");
  };

  useEffect(() => {
    movieAPI.getCategories()
      .then((response) => {
        const featured = response.data?.featured || [];
        const genres = response.data?.genres || [];
        setCategories([...featured, ...genres]);
      })
      .catch((error) => toast.error(error.message || "Could not load movie categories"));
  }, []);

  useEffect(() => {
    setPage((current) => current === 1 ? current : 1);
  }, [searchQuery, selectedCategory, selectedRegion, sortOrder]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError("");

    movieAPI.getMovies({
      category: selectedCategory,
      page,
      query: searchQuery.trim() || undefined,
      region: selectedRegion,
      country: selectedRegion !== "US" ? selectedRegion : undefined,
      sort: sortOrder,
    })
      .then((response) => {
        if (cancelled) return;
        setMovies(response.data || []);
        setTotalPages(response.totalPages || 1);
        hasLoadedOnceRef.current = true;
        setHasLoadedOnce(true);
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error.message || "Could not load movies");
          if (!hasLoadedOnceRef.current) setMovies([]);
          toast.error(error.message || "Could not load movies");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, searchQuery, selectedCategory, selectedRegion, sortOrder, reloadKey]);

  useEffect(() => {
    localStorage.setItem(MOVIE_REGION_STORAGE_KEY, selectedRegion);
  }, [selectedRegion]);

  const openMovie = (movieId: number) => {
    const params = new URLSearchParams();
    params.set("region", selectedRegion);
    params.set("from", `${location.pathname}${location.search}`);
    navigate(`/movie/${movieId}?${params.toString()}`);
  };

  const currentHeroList = heroMovies.length > 0 ? heroMovies : movies;
  const featuredHero = currentHeroList[heroIndex] || movies[0];

  return (
    <section className="pb-12">
      {/* Category Pills (Apple TV style) */}
      <div className="mb-6 overflow-x-auto pb-1 scrollbar-hide">
        <div className="flex gap-2.5">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelectedCategory(category.id)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-xs font-semibold transition-all duration-300 ${
                selectedCategory === category.id && !searchQuery
                  ? "bg-white text-black font-extrabold shadow-lg shadow-white/10 scale-105"
                  : "bg-white/10 border border-white/10 text-white/70 hover:text-white hover:bg-white/15"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {/* Apple TV+ Widescreen Hero Showcase Banner */}
      {!searchQuery && featuredHero && (
        <div className="relative mb-10 overflow-hidden rounded-[2rem] border border-white/10 bg-[#0C0D12] shadow-2xl transition-all duration-700">
          <div className="relative aspect-[16/9] min-h-[360px] max-h-[520px] w-full overflow-hidden">
            {/* Backdrop Image */}
            <img
              key={featuredHero.id}
              src={featuredHero.backdrop || featuredHero.poster || "/placeholder.svg"}
              alt={featuredHero.title}
              className="h-full w-full object-cover object-top transition-transform duration-1000 ease-out scale-105 animate-fade-in"
            />

            {/* Apple Cinematic Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#000000] via-[#000000]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#000000]/90 via-[#000000]/40 to-transparent" />

            {/* Content Details */}
            <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10 lg:p-12">
              <div className="max-w-2xl space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md px-3.5 py-1 border border-white/20 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white">
                    <Sparkles className="h-3 w-3 text-amber-300" />
                     StreamFlow Feature
                  </div>
                  {Number(featuredHero.rating) > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 backdrop-blur-md px-3 py-1 border border-amber-400/30 text-[11px] font-extrabold text-amber-300">
                      <Star className="h-3 w-3 fill-current" />
                      {Number(featuredHero.rating).toFixed(1)} / 10
                    </div>
                  )}
                  {featuredHero.releaseDate && (
                    <div className="inline-flex items-center rounded-full bg-white/10 backdrop-blur-md px-3 py-1 border border-white/10 text-[11px] font-bold text-white/80">
                      {featuredHero.releaseDate.slice(0, 4)}
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
                    onClick={() => openMovie(featuredHero.id)}
                    className="apple-pill-btn px-7 py-3 text-xs sm:text-sm font-extrabold flex items-center gap-2.5 shadow-2xl hover:scale-105 transition-transform"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Stream Now
                  </button>

                  <button
                    type="button"
                    onClick={() => openMovie(featuredHero.id)}
                    className="apple-pill-btn-secondary px-6 py-3 text-xs sm:text-sm font-bold flex items-center gap-2"
                  >
                    <Info className="h-4 w-4" />
                    More Info
                  </button>
                </div>
              </div>

            {/* Left & Right Navigation Arrows */}
            {currentHeroList.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setHeroIndex((prev) => (prev === 0 ? currentHeroList.slice(0, 8).length - 1 : prev - 1))}
                  className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white/70 hover:text-white hover:bg-black/70 hover:scale-110 transition-all"
                  aria-label="Previous Slide"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>

                <button
                  type="button"
                  onClick={() => setHeroIndex((prev) => (prev + 1) % currentHeroList.slice(0, 8).length)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white/70 hover:text-white hover:bg-black/70 hover:scale-110 transition-all"
                  aria-label="Next Slide"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            {/* Hero Indicator Dots */}
            {currentHeroList.length > 1 && (
              <div className="absolute bottom-6 right-6 sm:bottom-10 sm:right-10 flex items-center gap-2">
                {currentHeroList.slice(0, 8).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setHeroIndex(i)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      i === heroIndex ? "w-7 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
                    }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Recently Watched Movies Row */}
      {recentlyWatchedMovies.length > 0 && !searchQuery && (
        <div className="mb-8 rounded-3xl border border-white/10 bg-[#1C1C1E]/60 backdrop-blur-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-white" />
              <h3 className="text-xs font-black uppercase tracking-widest text-white">Recently Watched Movies</h3>
            </div>
            <button
              type="button"
              onClick={clearRecentlyWatchedMovies}
              className="text-[10px] font-bold uppercase tracking-wider text-white/50 hover:text-red-400 transition-colors"
            >
              Clear History
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {recentlyWatchedMovies.map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => openMovie(movie.id)}
                className="group shrink-0 w-32 sm:w-40 text-left enterprise-card enterprise-card-hover overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E]"
              >
                <div className="relative aspect-[2/3] overflow-hidden bg-[#141416]">
                  {movie.poster ? (
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Film className="h-8 w-8 text-white/30" />
                    </div>
                  )}
                  {/* Apple watermark badge */}
                  <span className="absolute left-2 top-2 rounded-md bg-black/60 backdrop-blur-md px-1.5 py-0.5 text-[9px] font-extrabold text-white/90">
                     tv
                  </span>
                  {Number(movie.rating) > 0 && (
                    <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-black/70 backdrop-blur-md px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      {Number(movie.rating).toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <h4 className="truncate text-xs font-bold text-white group-hover:text-white">{movie.title}</h4>
                  <p className="text-[10px] text-white/50 mt-0.5">{movie.releaseDate?.slice(0, 4) || "Movie"}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Movie Catalog</p>
          <h2 className="text-2xl font-black text-white sm:text-3xl tracking-tight">
            {searchQuery ? `Results for “${searchQuery}”` : "Movies & Specials"}
          </h2>
          <p className="mt-0.5 text-xs text-white/40">
            {MOVIE_REGIONS.find((region) => region.code === selectedRegion)?.name || selectedRegion}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Newest / Oldest Sort Dropdown */}
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as any)}
              className="h-10 rounded-full border border-white/15 bg-[#1C1C1E] px-4 text-xs font-bold text-white outline-none transition-all hover:bg-[#2C2C2E] cursor-pointer"
              aria-label="Sort movies by release date"
            >
              <option value="newest" className="bg-[#1C1C1E] text-white py-1">🆕 Newest First (Latest)</option>
              <option value="oldest" className="bg-[#1C1C1E] text-white py-1">📜 Oldest First (Classic)</option>
              <option value="popular" className="bg-[#1C1C1E] text-white py-1">🔥 Most Popular</option>
              <option value="top_rated" className="bg-[#1C1C1E] text-white py-1">⭐ Top Rated</option>
            </select>
          </div>

          {/* Region / Country Dropdown */}
          <div className="relative">
            <select
              value={selectedRegion}
              onChange={(event) => setSelectedRegion(event.target.value)}
              className="h-10 rounded-full border border-white/15 bg-[#1C1C1E] px-4 text-xs font-bold text-white outline-none transition-all hover:bg-[#2C2C2E] cursor-pointer"
              aria-label="Movie country"
            >
              {MOVIE_REGIONS.map((region) => (
                <option key={region.code} value={region.code} className="bg-[#1C1C1E] text-white py-1">
                  {region.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-white/40 font-semibold hidden sm:inline">Page {page} of {totalPages}</span>
        </div>
      </div>

      {loading && !hasLoadedOnce ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="enterprise-card animate-pulse overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E]">
              <div className="aspect-[2/3] bg-[#2C2C2E]" />
              <div className="space-y-2 p-3.5">
                <div className="h-4 w-4/5 rounded bg-[#2C2C2E]" />
                <div className="h-3 w-1/3 rounded bg-[#2C2C2E]" />
              </div>
            </div>
          ))}
        </div>
      ) : loading ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <Loader2 className="h-9 w-9 animate-spin text-white" />
        </div>
      ) : loadError ? (
        <div className="glass-card flex min-h-[320px] flex-col items-center justify-center gap-3 p-6 text-center">
          <Film className="h-12 w-12 text-white/30" />
          <p className="text-sm font-bold text-white">Movies could not load</p>
          <p className="max-w-sm text-xs text-white/50">{loadError}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("popular");
                setPage(1);
              }}
              className="apple-pill-btn-secondary px-4 py-2 text-xs font-bold"
            >
              Back to Popular
            </button>
            <button
              type="button"
              onClick={() => {
                setLoadError("");
                setReloadKey((current) => current + 1);
              }}
              className="apple-pill-btn px-4 py-2 text-xs font-black"
            >
              Retry
            </button>
          </div>
        </div>
      ) : movies.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
          <Film className="h-12 w-12 text-white/30" />
          <p className="text-sm text-white/50">No movies found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
          {movies.map((movie) => (
            <button
              key={movie.id}
              type="button"
              onClick={() => openMovie(movie.id)}
              className="enterprise-card enterprise-card-hover group overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] text-left"
            >
              <div className="relative aspect-[2/3] overflow-hidden bg-[#141416]">
                {movie.poster ? (
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Film className="h-10 w-10 text-white/30" />
                  </div>
                )}
                {/* Apple watermark badge */}
                <span className="absolute left-2.5 top-2.5 rounded-md bg-black/60 backdrop-blur-md px-2 py-0.5 text-[9px] font-extrabold text-white/90">
                   tv
                </span>
                {Number(movie.rating) > 0 && (
                  <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-full bg-black/70 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-amber-300">
                    <Star className="h-3 w-3 fill-current" />
                    {Number(movie.rating).toFixed(1)}
                  </span>
                )}
              </div>
              <div className="p-3.5">
                <h3 className="line-clamp-2 min-h-10 text-sm font-bold text-white group-hover:text-white">{movie.title}</h3>
                <p className="mt-1 text-xs text-white/40 font-medium">{movie.releaseDate?.slice(0, 4) || "TBA"}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && movies.length > 0 && (
        <div className="mt-10 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="apple-pill-btn-secondary flex items-center gap-1 px-5 py-2.5 text-sm font-bold disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
            className="apple-pill-btn flex items-center gap-1 px-6 py-2.5 text-sm font-extrabold disabled:opacity-30"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </section>
  );
};

export default MovieBrowser;
