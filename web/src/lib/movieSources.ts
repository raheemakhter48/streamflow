export const SOURCES = [
  {
    id: "vidlink",
    label: "VidLink (Fast HD)",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://vidlink.pro/tv/${tmdbId || imdbId}/${season}/${episode}`;
      }
      return `https://vidlink.pro/movie/${tmdbId || imdbId}`;
    },
  },
  {
    id: "autoembed",
    label: "AutoEmbed",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://autoembed.me/tv/tmdb/${tmdbId}-${season}-${episode}`;
      }
      return tmdbId ? `https://autoembed.me/movie/tmdb/${tmdbId}` : `https://autoembed.me/movie/imdb/${imdbId}`;
    },
  },
  {
    id: "vidsrc",
    label: "VidSrc",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://vidsrc.to/embed/tv/${tmdbId || imdbId}/${season}/${episode}`;
      }
      return `https://vidsrc.to/embed/movie/${tmdbId || imdbId}`;
    },
  },
  {
    id: "smashy",
    label: "Smashy / AnyEmbed (Multi-Audio)",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://anyembed.xyz/embed/tmdb-tv-${tmdbId}/${season}/${episode}`;
      }
      return `https://anyembed.xyz/embed/tmdb-movie-${tmdbId || imdbId}`;
    },
  },
  {
    id: "multiembed",
    label: "MultiEmbed",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://multiembed.mov/?video_id=${tmdbId || imdbId}&tmdb=1&s=${season}&e=${episode}`;
      }
      return `https://multiembed.mov/?video_id=${tmdbId || imdbId}&tmdb=1`;
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
      params.set("lan", hindi ? "hindi" : "eng");
      return `https://screenscape.me/embed?${params.toString()}`;
    },
  },
] as const;

export type SourceId = (typeof SOURCES)[number]["id"];

export const DEFAULT_MOVIE_SOURCE: SourceId = "vidlink";
