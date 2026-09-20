export const SOURCES = [
  {
    id: "screenscape",
    label: "ScreenScape",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1, hindi = false) => {
      const params = new URLSearchParams();
      if (tmdbId) params.set("tmdb", String(tmdbId));
      else if (imdbId) params.set("imdb", imdbId);
      params.set("type", type);
      if (type === "tv") {
        params.set("s", String(season));
        params.set("e", String(episode));
      }
      // This is a language preference, not proof of an available audio track.
      params.set("lan", hindi ? "hindi" : "eng");
      return `https://screenscape.me/embed?${params.toString()}`;
    },
  },
  {
    id: "vidlink",
    label: "VidLink",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://vidlink.pro/tv/${tmdbId || imdbId}/${season}/${episode}`;
      }
      return `https://vidlink.pro/movie/${tmdbId || imdbId}`;
    },
  },
  {
    id: "smashy",
    label: "SmashyStream (Hindi)",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://embed.smashystream.com/playere.php?tmdb=${tmdbId}&season=${season}&episode=${episode}`;
      }
      return `https://embed.smashystream.com/playere.php?tmdb=${tmdbId || imdbId}`;
    },
  },
  {
    id: "moviesapi",
    label: "MoviesAPI",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://moviesapi.club/tv/${tmdbId}-${season}-${episode}`;
      }
      return `https://moviesapi.club/movie/${tmdbId || imdbId}`;
    },
  },
  {
    id: "autoembed",
    label: "AutoEmbed",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://autoembed.co/tv/tmdb/${tmdbId}-${season}-${episode}`;
      }
      return tmdbId ? `https://autoembed.co/movie/tmdb/${tmdbId}` : `https://autoembed.co/movie/imdb/${imdbId}`;
    },
  },
  {
    id: "2embed",
    label: "2Embed",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://www.2embed.cc/embedtv/${tmdbId || imdbId}&s=${season}&e=${episode}`;
      }
      return tmdbId ? `https://www.2embed.cc/embed/${tmdbId}` : `https://www.2embed.cc/embed/${imdbId}`;
    },
  },
  {
    id: "videasy",
    label: "Videasy",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://player.videasy.net/tv/${tmdbId}/${season}/${episode}`;
      }
      return tmdbId ? `https://player.videasy.net/movie/${tmdbId}` : `https://player.videasy.net/movie/${imdbId}`;
    },
  },
] as const;

export type SourceId = (typeof SOURCES)[number]["id"];

export const DEFAULT_MOVIE_SOURCE: SourceId = "vidlink";
