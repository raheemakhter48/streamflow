import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { seriesAPI } from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import MoviePlayer from "@/components/MoviePlayer";
import SEO from "@/components/SEO";
import { ArrowLeft, Star, Tv, Play, ChevronDown, Film } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Season {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  poster: string | null;
}

interface Episode {
  episodeNumber: number;
  name: string;
  overview: string;
  stillPath: string | null;
  airDate: string | null;
  rating: number;
}

interface SeriesDetails {
  id: number;
  imdbId: string | null;
  title: string;
  overview: string;
  poster: string | null;
  backdrop: string | null;
  firstAirDate: string | null;
  numberOfSeasons: number;
  numberOfEpisodes: number;
  seasons: Season[];
  rating: number;
  genres: Array<{ id: number; name: string }>;
}

const SeriesDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const seriesId = Number(id);

  const [series, setSeries] = useState<SeriesDetails | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!seriesId) return;
    setIsLoading(true);
    seriesAPI.getSeriesDetails(seriesId)
      .then((res) => {
        setSeries(res.data);
        if (res.data.seasons && res.data.seasons.length > 0) {
          setSelectedSeason(res.data.seasons[0].seasonNumber);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [seriesId]);

  useEffect(() => {
    if (!seriesId || !selectedSeason) return;
    seriesAPI.getSeasonEpisodes(seriesId, selectedSeason)
      .then((res) => {
        setEpisodes(res.data.episodes || []);
        setSelectedEpisode(1);
      })
      .catch(() => {});
  }, [seriesId, selectedSeason]);

  if (isLoading || !series) {
    return (
      <div className="enterprise-bg min-h-screen text-white">
        <AppHeader />
        <div className="mx-auto max-w-7xl px-4 py-12 flex justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent" />
        </div>
      </div>
    );
  }

  const currentEp = episodes.find(e => e.episodeNumber === selectedEpisode) || episodes[0];

  return (
    <div className="enterprise-bg min-h-screen text-white pb-20">
      <SEO
        title={`${series.title} — Watch S${selectedSeason} E${selectedEpisode} on StreamFlow tv+`}
        description={series.overview}
        path={`/series/${series.id}`}
      />
      <AppHeader />

      <main className="mx-auto max-w-[1520px] px-4 sm:px-6 lg:px-8 pt-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-md hover:bg-white/20 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Series
        </button>

        {/* Video Player Section */}
        <div className="mb-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
              {series.title} <span className="text-white/60 text-lg font-bold">S{selectedSeason} : E{selectedEpisode}</span>
            </h1>
            {currentEp?.name && (
              <span className="text-xs font-semibold text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full">
                {currentEp.name}
              </span>
            )}
          </div>

          <MoviePlayer
            imdbId={series.imdbId || undefined}
            tmdbId={series.id}
            type="tv"
            season={selectedSeason}
            episode={selectedEpisode}
            title={`${series.title} S${selectedSeason}E${selectedEpisode}`}
          />
        </div>

        {/* Season & Episode Selector Controls */}
        <div className="mb-8 rounded-3xl border border-white/10 bg-[#1C1C1E]/80 p-6 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4 mb-6">
            <div className="flex items-center gap-3">
              <Tv className="h-5 w-5 text-white/80" />
              <h2 className="text-lg font-black text-white">Select Season & Episode</h2>
            </div>

            {/* Season Select Dropdown */}
            <div className="w-48">
              <Select value={String(selectedSeason)} onValueChange={(val) => setSelectedSeason(Number(val))}>
                <SelectTrigger className="h-10 rounded-full border border-white/15 bg-white/10 px-4 text-xs font-extrabold text-white">
                  <SelectValue placeholder="Select Season" />
                </SelectTrigger>
                <SelectContent className="bg-[#1C1C1E] border-white/10 text-white rounded-2xl">
                  {series.seasons.map((s) => (
                    <SelectItem key={s.seasonNumber} value={String(s.seasonNumber)}>
                      Season {s.seasonNumber} ({s.episodeCount} Episodes)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Episode Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {episodes.map((ep) => {
              const active = ep.episodeNumber === selectedEpisode;
              return (
                <button
                  key={ep.episodeNumber}
                  type="button"
                  onClick={() => setSelectedEpisode(ep.episodeNumber)}
                  className={`flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                    active
                      ? "bg-white text-black font-extrabold border-white shadow-xl scale-[1.02]"
                      : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-xl bg-black/40">
                    {ep.stillPath ? (
                      <img src={ep.stillPath} alt={ep.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Film className="h-5 w-5 text-white/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play className={`h-4 w-4 ${active ? "fill-black text-black" : "fill-white text-white"}`} />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-black truncate ${active ? "text-black" : "text-white"}`}>
                      E{ep.episodeNumber}: {ep.name}
                    </p>
                    <p className={`text-[10px] truncate mt-0.5 ${active ? "text-black/70" : "text-white/50"}`}>
                      {ep.airDate || `Episode ${ep.episodeNumber}`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Series Info Overview */}
        <div className="rounded-3xl border border-white/10 bg-[#1C1C1E]/60 p-6 backdrop-blur-xl space-y-3">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold text-white">
              {series.numberOfSeasons} Seasons · {series.numberOfEpisodes} Episodes
            </span>
            {Number(series.rating) > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-extrabold text-amber-300">
                <Star className="h-3.5 w-3.5 fill-current" />
                {Number(series.rating).toFixed(1)} / 10
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-white/80 leading-relaxed max-w-4xl">
            {series.overview}
          </p>
        </div>
      </main>

      <BottomNav />
    </div>
  );
};

export default SeriesDetails;
