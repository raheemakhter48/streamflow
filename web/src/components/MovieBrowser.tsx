import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Film, Loader2, Star } from "lucide-react";
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
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "popular" | "top_rated">("newest");
  const [movies, setMovies] = useState<MovieCard[]>([]);
  const [recentlyWatchedMovies, setRecentlyWatchedMovies] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

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

  return (
    <section className="pb-8">
      <div className="mb-5 rounded-3xl border border-[#1F2937]/80 bg-[#0D1117]/70 p-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setSelectedCategory(category.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              selectedCategory === category.id && !searchQuery
                ? "bg-[#00CFE8] text-black shadow-[0_0_28px_rgba(0,207,232,0.14)]"
                : "border border-[#1F2937] bg-[#07090B] text-gray-400 hover:text-white"
            }`}
          >
            {category.name}
          </button>
        ))}
        </div>
      </div>

      {/* Recently Watched Movies Row */}
      {recentlyWatchedMovies.length > 0 && !searchQuery && (
        <div className="mb-6 rounded-3xl border border-[#1F2937]/80 bg-[#0D1117]/80 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#00CFE8]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-white">Recently Watched Movies</h3>
            </div>
            <button
              type="button"
              onClick={clearRecentlyWatchedMovies}
              className="text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-red-400 transition-colors"
            >
              Clear History
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {recentlyWatchedMovies.map((movie) => (
              <button
                key={movie.id}
                type="button"
                onClick={() => openMovie(movie.id)}
                className="group shrink-0 w-28 sm:w-36 text-left enterprise-card enterprise-card-hover overflow-hidden rounded-xl"
              >
                <div className="relative aspect-[2/3] overflow-hidden bg-[#181818]">
                  {movie.poster ? (
                    <img
                      src={movie.poster}
                      alt={movie.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Film className="h-8 w-8 text-gray-700" />
                    </div>
                  )}
                  {Number(movie.rating) > 0 && (
                    <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded-full bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                      <Star className="h-2.5 w-2.5 fill-current" />
                      {Number(movie.rating).toFixed(1)}
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <h4 className="truncate text-xs font-bold text-white">{movie.title}</h4>
                  <p className="text-[10px] text-gray-500 mt-0.5">{movie.releaseDate?.slice(0, 4) || "Movie"}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#00CFE8]">Movie Catalog</p>
          <h2 className="text-2xl font-black text-white sm:text-3xl">
            {searchQuery ? `Results for “${searchQuery}”` : "Movies"}
          </h2>
          <p className="mt-0.5 text-xs text-gray-600">
            {MOVIE_REGIONS.find((region) => region.code === selectedRegion)?.name || selectedRegion}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Newest / Oldest Sort Dropdown */}
          <div className="relative">
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as any)}
              className="h-10 rounded-xl border border-[#00CFE8]/40 bg-[#07090B] px-3.5 text-xs font-bold text-[#00CFE8] outline-none transition-all focus:border-[#00CFE8] focus:ring-1 focus:ring-[#00CFE8]/30 cursor-pointer shadow-[0_0_15px_rgba(0,207,232,0.08)]"
              aria-label="Sort movies by release date"
            >
              <option value="newest" className="bg-[#0B1115] text-white py-1">🆕 Newest First (Latest)</option>
              <option value="oldest" className="bg-[#0B1115] text-white py-1">📜 Oldest First (Classic)</option>
              <option value="popular" className="bg-[#0B1115] text-white py-1">🔥 Most Popular</option>
              <option value="top_rated" className="bg-[#0B1115] text-white py-1">⭐ Top Rated</option>
            </select>
          </div>

          {/* Region / Country Dropdown */}
          <div className="relative">
            <select
              value={selectedRegion}
              onChange={(event) => setSelectedRegion(event.target.value)}
              className="h-10 rounded-xl border border-[#1F2937] bg-[#07090B] px-3.5 text-xs font-bold text-gray-300 outline-none transition-all focus:border-[#00CFE8] hover:text-white cursor-pointer"
              aria-label="Movie country"
            >
              {MOVIE_REGIONS.map((region) => (
                <option key={region.code} value={region.code} className="bg-[#0B1115] text-white py-1">
                  {region.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-gray-500 font-semibold hidden sm:inline">Page {page} of {totalPages}</span>
        </div>
      </div>

      {loading && !hasLoadedOnce ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="enterprise-card animate-pulse overflow-hidden rounded-2xl">
              <div className="aspect-[2/3] bg-[#111827]" />
              <div className="space-y-2 p-3.5">
                <div className="h-4 w-4/5 rounded bg-[#1F2937]" />
                <div className="h-3 w-1/3 rounded bg-[#1F2937]" />
              </div>
            </div>
          ))}
        </div>
      ) : loading ? (
        <div className="flex min-h-[220px] items-center justify-center">
          <Loader2 className="h-9 w-9 animate-spin text-[#00CFE8]" />
        </div>
      ) : loadError ? (
        <div className="enterprise-card flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-3xl p-6 text-center">
          <Film className="h-12 w-12 text-gray-700" />
          <p className="text-sm font-bold text-white">Movies could not load</p>
          <p className="max-w-sm text-xs text-gray-500">{loadError}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCategory("popular");
                setPage(1);
              }}
              className="rounded-xl border border-[#1F2937] px-4 py-2 text-xs font-bold text-gray-300"
            >
              Back to Popular
            </button>
            <button
              type="button"
              onClick={() => {
                setLoadError("");
                setReloadKey((current) => current + 1);
              }}
              className="rounded-xl bg-[#00CFE8] px-4 py-2 text-xs font-black text-black"
            >
              Retry
            </button>
          </div>
        </div>
      ) : movies.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
          <Film className="h-12 w-12 text-gray-700" />
          <p className="text-sm text-gray-500">No movies found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6">
          {movies.map((movie) => (
            <button
              key={movie.id}
              type="button"
              onClick={() => openMovie(movie.id)}
              className="enterprise-card enterprise-card-hover group overflow-hidden rounded-2xl text-left"
            >
              <div className="relative aspect-[2/3] overflow-hidden bg-[#181818]">
                {movie.poster ? (
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Film className="h-10 w-10 text-gray-700" />
                  </div>
                )}
                {Number(movie.rating) > 0 && (
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/80 px-2 py-1 text-[10px] font-bold text-amber-300">
                    <Star className="h-3 w-3 fill-current" />
                    {Number(movie.rating).toFixed(1)}
                  </span>
                )}
              </div>
              <div className="p-3.5">
                <h3 className="line-clamp-2 min-h-10 text-sm font-bold text-white">{movie.title}</h3>
                <p className="mt-1 text-xs text-gray-600">{movie.releaseDate?.slice(0, 4) || "TBA"}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {!loading && movies.length > 0 && (
        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="flex items-center gap-1 rounded-lg border border-[#252525] px-4 py-2 text-sm font-bold text-gray-300 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => current + 1)}
            className="flex items-center gap-1 rounded-lg bg-[#00D7E5] px-4 py-2 text-sm font-black text-black disabled:opacity-30"
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
