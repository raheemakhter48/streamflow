import { useState } from "react";
import { Play, Maximize2, RefreshCw } from "lucide-react";
import { lockLandscape } from "@/lib/orientation";

// ---------------------------------------------------------------------------
// Stream source definitions — supports both IMDb ID and TMDB ID for 100% movie coverage
// ---------------------------------------------------------------------------
const SOURCES = [
  {
    id: "vidsrc",
    label: "VidSrc",
    buildUrl: (imdbId?: string, tmdbId?: number) =>
      tmdbId ? `https://vidsrc.me/embed/movie?tmdb=${tmdbId}` : `https://vidsrc.xyz/embed/movie/${imdbId}`,
  },
  {
    id: "autoembed",
    label: "AutoEmbed",
    buildUrl: (imdbId?: string, tmdbId?: number) =>
      tmdbId ? `https://autoembed.co/movie/tmdb/${tmdbId}` : `https://autoembed.co/movie/imdb/${imdbId}`,
  },
  {
    id: "2embed",
    label: "2Embed",
    buildUrl: (imdbId?: string, tmdbId?: number) =>
      tmdbId ? `https://www.2embed.cc/embed/tmdb/movie?id=${tmdbId}` : `https://www.2embed.cc/embed/${imdbId}`,
  },
  {
    id: "videasy",
    label: "Videasy",
    buildUrl: (imdbId?: string, tmdbId?: number) =>
      tmdbId ? `https://player.videasy.net/movie/${tmdbId}` : `https://player.videasy.net/movie/${imdbId}`,
  },
] as const;

type SourceId = (typeof SOURCES)[number]["id"];

const QUALITY_OPTIONS = [
  { id: "auto", label: "Auto", value: "" },
  { id: "720p", label: "720p", value: "720" },
  { id: "1080p", label: "1080p", value: "1080" },
  { id: "2k", label: "2K", value: "1440" },
] as const;

type QualityId = (typeof QUALITY_OPTIONS)[number]["id"];

const LANGUAGE_OPTIONS = [
  { id: "auto", label: "Auto", value: "" },
  { id: "hi", label: "Hindi", value: "hi" },
  { id: "en", label: "English", value: "en" },
  { id: "ur", label: "Urdu", value: "ur" },
] as const;

type LanguageId = (typeof LANGUAGE_OPTIONS)[number]["id"];

interface MoviePlayerProps {
  imdbId?: string;
  tmdbId?: number;
  title?: string;
}

const MoviePlayer = ({ imdbId, tmdbId, title = "Movie" }: MoviePlayerProps) => {
  const [activeSource, setActiveSource] = useState<SourceId>("vidsrc");
  const [activeQuality, setActiveQuality] = useState<QualityId>("auto");
  const [activeLanguage, setActiveLanguage] = useState<LanguageId>("auto");
  const [isLoaded, setIsLoaded] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);

  const currentSource = SOURCES.find((s) => s.id === activeSource)!;
  const currentQuality = QUALITY_OPTIONS.find((q) => q.id === activeQuality)!;
  const currentLanguage = LANGUAGE_OPTIONS.find((l) => l.id === activeLanguage)!;

  const embedUrl = (() => {
    const url = currentSource.buildUrl(imdbId, tmdbId);
    const params = new URLSearchParams();

    if (currentQuality.value) params.set("quality", currentQuality.value);
    if (currentLanguage.value) {
      params.set("language", currentLanguage.value);
      params.set("lang", currentLanguage.value);
      params.set("audio", currentLanguage.value);
      params.set("subtitle", currentLanguage.value);
    }

    const query = params.toString();
    if (!query) return url;

    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}${query}`;
  })();

  const handleSourceChange = (id: SourceId) => {
    if (id === activeSource) return;
    setActiveSource(id);
    setIframeKey((k) => k + 1);
  };

  const handleQualityChange = (id: QualityId) => {
    if (id === activeQuality) return;
    setActiveQuality(id);
    setIframeKey((k) => k + 1);
  };

  const handleLanguageChange = (id: LanguageId) => {
    if (id === activeLanguage) return;
    setActiveLanguage(id);
    setIframeKey((k) => k + 1);
  };

  const handleReload = () => setIframeKey((k) => k + 1);

  if (!isLoaded) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2 bg-black/40">
          <SourceTabs active={activeSource} onChange={handleSourceChange} />
          <div className="flex flex-wrap gap-2">
            <QualityTabs active={activeQuality} onChange={handleQualityChange} />
            <LanguageTabs active={activeLanguage} onChange={handleLanguageChange} />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsLoaded(true)}
          className="group relative flex aspect-video w-full items-center justify-center bg-[#0C0D12] transition hover:bg-[#14151B]"
          aria-label={`Play ${title}`}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white text-black font-extrabold shadow-2xl transition group-hover:scale-110">
            <Play className="h-8 w-8 translate-x-0.5 fill-current" />
          </div>
          <p className="absolute bottom-5 text-xs font-semibold tracking-widest text-white/60">
            Click to Stream · {currentSource.label} HD
          </p>
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 bg-[#1C1C1E]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SourceTabs active={activeSource} onChange={handleSourceChange} />
          <QualityTabs active={activeQuality} onChange={handleQualityChange} />
          <LanguageTabs active={activeLanguage} onChange={handleLanguageChange} />
        </div>
        <button
          type="button"
          onClick={handleReload}
          title="Reload player"
          className="ml-2 shrink-0 rounded-full p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="relative aspect-video w-full">
        <iframe
          key={iframeKey}
          src={embedUrl}
          title={`${title} — ${currentSource.label}`}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          scrolling="no"
          referrerPolicy="origin"
        />

        <button
          type="button"
          onClick={async () => {
            const el = document.querySelector(`iframe[title="${title} — ${currentSource.label}"]`) as HTMLIFrameElement | null;
            await el?.requestFullscreen?.();
            await lockLandscape();
          }}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/60 p-2 text-white opacity-0 transition hover:opacity-100 focus:opacity-100 backdrop-blur-md"
          title="Fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <p className="px-4 py-2 text-[10px] text-white/40">
        Stream provided by <span className="text-white/70 font-bold">{currentSource.label}</span>. If playback
        fails, switch to another source above.
      </p>
    </div>
  );
};

const SourceTabs = ({
  active,
  onChange,
}: {
  active: SourceId;
  onChange: (id: SourceId) => void;
}) => (
  <div className="flex gap-1.5 p-1">
    {SOURCES.map((source) => (
      <button
        key={source.id}
        type="button"
        onClick={() => onChange(source.id)}
        className={`rounded-full px-3.5 py-1 text-xs font-extrabold transition ${
          active === source.id
            ? "bg-white text-black shadow-md"
            : "text-white/60 hover:bg-white/10 hover:text-white"
        }`}
      >
        {source.label}
      </button>
    ))}
  </div>
);

const QualityTabs = ({
  active,
  onChange,
}: {
  active: QualityId;
  onChange: (id: QualityId) => void;
}) => (
  <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
    {QUALITY_OPTIONS.map((quality) => (
      <button
        key={quality.id}
        type="button"
        onClick={() => onChange(quality.id)}
        className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
          active === quality.id
            ? "bg-white text-black"
            : "text-white/50 hover:text-white"
        }`}
      >
        {quality.label}
      </button>
    ))}
  </div>
);

const LanguageTabs = ({
  active,
  onChange,
}: {
  active: LanguageId;
  onChange: (id: LanguageId) => void;
}) => (
  <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
    {LANGUAGE_OPTIONS.map((language) => (
      <button
        key={language.id}
        type="button"
        onClick={() => onChange(language.id)}
        className={`rounded-full px-2.5 py-0.5 text-xs font-bold transition ${
          active === language.id
            ? "bg-white text-black"
            : "text-white/50 hover:text-white"
        }`}
      >
        {language.label}
      </button>
    ))}
  </div>
);

export default MoviePlayer;
