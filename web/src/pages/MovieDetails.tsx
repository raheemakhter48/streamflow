import { useEffect, useState } from "react";
import { ArrowLeft, Film, Loader2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import MoviePlayer from "@/components/MoviePlayer";
import SEO from "@/components/SEO";
import { movieAPI } from "@/lib/api";

interface MovieDetailsData {
  id: number;
  imdbId: string;
  title: string;
  overview?: string;
  poster?: string;
  backdrop?: string;
  releaseDate?: string;
  rating?: number;
}

const MovieDetails = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [movie, setMovie] = useState<MovieDetailsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    movieAPI.getMovie(id, "PK")
      .then((response) => {
        if (!cancelled) setMovie(response.data);
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
  }, [id]);

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
        <p className="text-gray-400">{error || "Movie not found"}</p>
        <button onClick={() => navigate("/dashboard?view=movie")} className="text-[#00D7E5]">
          Back to Movies
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090909] pb-24 text-white lg:pb-8">
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
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard?view=movie")}
            className="flex items-center gap-2 rounded-lg border border-[#202020] bg-[#101010] px-3 py-2 text-sm font-bold text-gray-300 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Movies
          </button>

          <div className="min-w-0 text-right">
            <h1 className="truncate text-sm font-black text-white sm:text-lg">{movie.title}</h1>
            <p className="text-xs text-gray-600">{movie.releaseDate?.slice(0, 4) || "Movie"}</p>
          </div>
        </div>

        <MoviePlayer imdbId={movie.imdbId} title={movie.title} />
      </main>

      <BottomNav />
    </div>
  );
};

export default MovieDetails;
