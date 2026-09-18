import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Film, Loader2 } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import MoviePlayer from "@/components/MoviePlayer";
import SEO from "@/components/SEO";
import { movieAPI, recentlyWatchedAPI } from "@/lib/api";
import { useSidebar } from "@/context/SidebarContext";

interface WatchProvider {
  id: number;
  name: string;
  logo: string | null;
}

interface WatchProviders {
  region: string;
  attribution: string;
  link: string | null;
  flatrate: WatchProvider[];
  free: WatchProvider[];
  ads: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
}

interface MovieDetailsData {
  id: number;
  imdbId?: string | null;
  title: string;
  overview?: string;
  poster?: string;
  backdrop?: string;
  releaseDate?: string;
  rating?: number;
  watchProviders?: WatchProviders;
}

const saveRecentlyWatchedMovie = (m: MovieDetailsData) => {
  try {
    const key = "streamflow_recently_watched_movies";
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    const filtered = existing.filter((item: any) => item.id !== m.id);
    const updated = [
      {
        id: m.id,
        title: m.title,
        poster: m.poster,
        backdrop: m.backdrop,
        rating: m.rating,
        releaseDate: m.releaseDate,
        watchedAt: new Date().toISOString(),
      },
      ...filtered,
    ].slice(0, 15);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch { /* ignore */ }
};

const ProviderRow = ({ label, providers }: { label: string; providers: WatchProvider[] }) => {
  if (providers.length === 0) return null;

  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-600">{label}</p>
      <div className="flex flex-wrap gap-2">
        {providers.map((provider) => (
          <span
            key={provider.id}
            title={provider.name}
            className="flex items-center gap-2 rounded-xl border border-[#1F2937] bg-[#07090B] px-2.5 py-1.5"
          >
            {provider.logo && (
              <img src={provider.logo} alt="" className="h-6 w-6 rounded-md object-cover" />
            )}
            <span className="text-xs font-semibold text-gray-300">{provider.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
};

const MovieDetails = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { collapsed } = useSidebar();
  const [searchParams] = useSearchParams();
  const region = searchParams.get("region") || localStorage.getItem("streamflow_movie_region") || "US";
  const from = searchParams.get("from") || "/dashboard?view=movie";
  const [movie, setMovie] = useState<MovieDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const streamingProviders = useMemo(() => {
    if (!movie?.watchProviders) return [];
    const seen = new Map<number, WatchProvider>();
    [...movie.watchProviders.flatrate, ...movie.watchProviders.free, ...movie.watchProviders.ads].forEach((provider) => {
      if (!seen.has(provider.id)) seen.set(provider.id, provider);
    });
    return Array.from(seen.values());
  }, [movie]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    movieAPI.getMovie(id, region)
      .then((response) => {
        if (!cancelled && response.data) {
          setMovie(response.data);
          saveRecentlyWatchedMovie(response.data);
          recentlyWatchedAPI.addRecentlyWatched({
            channelName: response.data.title,
            channelUrl: `/movie/${response.data.id}`,
            channelLogo: response.data.poster || undefined,
            category: "Movie",
          }).catch(() => {});
        }
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError.message || "Could not load movie details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, region, reloadKey]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#090909]">
        <Loader2 className="h-10 w-10 animate-spin text-[#00D7E5]" />
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#090909] px-5 text-center text-white">
        <Film className="h-14 w-14 text-gray-700" />
        <p className="max-w-sm text-gray-400">{error || "Movie not found"}</p>
        <div className="flex gap-3">
          <button
            onClick={() => setReloadKey((current) => current + 1)}
            className="rounded-xl bg-[#00CFE8] px-4 py-2 text-sm font-black text-black"
          >
            Retry
          </button>
          <button onClick={() => navigate(from)} className="rounded-xl border border-[#1F2937] px-4 py-2 text-sm font-bold text-[#00CFE8]">
            Back to Movies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="enterprise-bg min-h-screen pb-24 text-white">
      <SEO
        title={`${movie.title}${movie.releaseDate ? ` (${movie.releaseDate.slice(0, 4)})` : ""}`}
        description={movie.overview || `Watch ${movie.title} on StreamFlow.`}
        path={`/movie/${movie.id}`}
        image={movie.backdrop || movie.poster || "/logo.png"}
        type="video.movie"
        structuredData={{
          "@type": "Movie",
          name: movie.title,
          description: movie.overview,
          image: movie.poster || movie.backdrop,
          datePublished: movie.releaseDate,
          aggregateRating: Number(movie.rating) > 0 ? {
            "@type": "AggregateRating",
            ratingValue: Number(movie.rating).toFixed(1),
            bestRating: "10",
          } : undefined,
          sameAs: movie.imdbId ? `https://www.imdb.com/title/${movie.imdbId}/` : undefined,
        }}
      />

      <AppHeader />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate(from)}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/20 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Movies
          </button>

          <div className="min-w-0 text-right">
            <h1 className="truncate text-base font-black text-white sm:text-xl tracking-tight">{movie.title}</h1>
            <p className="text-xs text-white/50">{movie.releaseDate?.slice(0, 4) || "Movie"}</p>
          </div>
        </div>

        <MoviePlayer imdbId={movie.imdbId || undefined} tmdbId={movie.id} title={movie.title} />

        {movie.watchProviders && (
          streamingProviders.length > 0 ||
          movie.watchProviders.rent.length > 0 ||
          movie.watchProviders.buy.length > 0
        ) && (
          <div className="enterprise-card mt-5 rounded-3xl p-5">
            <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-gray-400">
              Where to Watch · {movie.watchProviders.region}
            </h2>

            <ProviderRow label="Stream" providers={streamingProviders} />
            <ProviderRow label="Rent" providers={movie.watchProviders.rent} />
            <ProviderRow label="Buy" providers={movie.watchProviders.buy} />

            <p className="mt-3 text-[10px] text-gray-600">
              {movie.watchProviders.attribution}
              {movie.watchProviders.link && (
                <>
                  {" · "}
                  <a
                    href={movie.watchProviders.link}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#00CFE8] hover:underline"
                  >
                    View on JustWatch <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </>
              )}
            </p>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
};

export default MovieDetails;
