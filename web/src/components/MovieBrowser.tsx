import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Film, Loader2, Star } from "lucide-react";
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
  { code: "US", name: "Global" },
  { code: "PK", name: "Pakistan" },
  { code: "IN", name: "India" },
  { code: "GB", name: "United Kingdom" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "TR", name: "Turkey" },
  { code: "KR", name: "South Korea" },
  { code: "JP", name: "Japan" },
];

const MOVIE_REGION_STORAGE_KEY = "streamflow_movie_region";

const MovieBrowser = ({ searchQuery = "" }: MovieBrowserProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [categories, setCategories] = useState<MovieCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("popular");
  const [selectedRegion, setSelectedRegion] = useState(() => {
    const storedRegion = localStorage.getItem(MOVIE_REGION_STORAGE_KEY);
    return storedRegion === "PK" || storedRegion === "IN" ? "US" : storedRegion || "US";
  });
  const [movies, setMovies] = useState<MovieCard[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

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
  }, [searchQuery, selectedCategory, selectedRegion]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    movieAPI.getMovies({
      category: selectedCategory,
      page,
      query: searchQuery.trim() || undefined,
      region: selectedRegion,
    })
      .then((response) => {
        if (cancelled) return;
        setMovies(response.data || []);
        setTotalPages(response.totalPages || 1);
      })
      .catch((error) => {
        if (!cancelled) {
          setMovies([]);
          toast.error(error.message || "Could not load movies");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, searchQuery, selectedCategory, selectedRegion]);

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
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setSelectedCategory(category.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors ${
              selectedCategory === category.id && !searchQuery
                ? "bg-[#00D7E5] text-black"
                : "border border-[#1e1e1e] bg-[#111] text-gray-400 hover:text-white"
            }`}
          >
            {category.name}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-black text-white">
            {searchQuery ? `Results for “${searchQuery}”` : "Movies"}
          </h2>
          <p className="mt-0.5 text-xs text-gray-600">
            {MOVIE_REGIONS.find((region) => region.code === selectedRegion)?.name || selectedRegion}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedRegion}
            onChange={(event) => setSelectedRegion(event.target.value)}
            className="h-9 rounded-lg border border-[#252525] bg-[#101010] px-3 text-xs font-bold text-gray-200 outline-none focus:border-[#00D7E5]"
            aria-label="Movie country"
          >
            {MOVIE_REGIONS.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-600">Page {page} of {totalPages}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[360px] items-center justify-center">
          <Loader2 className="h-9 w-9 animate-spin text-[#00D7E5]" />
        </div>
      ) : movies.length === 0 ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center">
          <Film className="h-12 w-12 text-gray-700" />
          <p className="text-sm text-gray-500">No movies found</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {movies.map((movie) => (
            <button
              key={movie.id}
              type="button"
              onClick={() => openMovie(movie.id)}
              className="group overflow-hidden rounded-xl border border-[#1e1e1e] bg-[#101010] text-left transition-all hover:-translate-y-1 hover:border-[#00D7E5]/40"
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
              <div className="p-3">
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
