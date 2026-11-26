export const SOURCES = [
  {
    id: "screenscape",
    label: "ScreenScape (HD / Hindi)",
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
  {
    id: "autoembed",
    label: "AutoEmbed (Fast)",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      if (type === "tv") {
        return `https://autoembed.to/tv/tmdb/${tmdbId}-${season}-${episode}`;
      }
      return `https://autoembed.to/movie/tmdb/${tmdbId}`;
    },
  },
  {
    id: "2embed",
    label: "2Embed",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      const id = tmdbId || imdbId;
      if (type === "tv") {
        return `https://2embed.skin/embed/tv?tmdb=${id}&s=${season}&e=${episode}`;
      }
      return `https://2embed.skin/embed/movie?tmdb=${id}`;
    },
  },
  {
    id: "multiembed",
    label: "MultiEmbed",
    buildUrl: (imdbId?: string, tmdbId?: number, type: "movie" | "tv" = "movie", season = 1, episode = 1) => {
      const id = tmdbId || imdbId;
      if (type === "tv") {
        return `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`;
      }
      return `https://multiembed.mov/?video_id=${id}&tmdb=1`;
    },
  },
] as const;

export type SourceId = (typeof SOURCES)[number]["id"];

export const DEFAULT_MOVIE_SOURCE: SourceId = "screenscape";
