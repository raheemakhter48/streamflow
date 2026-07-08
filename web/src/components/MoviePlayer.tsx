import { useState } from "react";
import { Play, Maximize2, RefreshCw } from "lucide-react";

// ---------------------------------------------------------------------------
// Stream source definitions — add / remove sources here only
// ---------------------------------------------------------------------------
const SOURCES = [
  {
    id: "vidsrc",
    label: "VidSrc",
    buildUrl: (imdbId: string) => `https://vidsrc.xyz/embed/movie/${imdbId}`,
  },
  {
    id: "autoembed",
    label: "AutoEmbed",
    buildUrl: (imdbId: string) => `https://autoembed.co/movie/imdb/${imdbId}`,
  },
  {
    id: "2embed",
    label: "2Embed",
    buildUrl: (imdbId: string) => `https://www.2embed.cc/embed/${imdbId}`,
  },
  {
    id: "videasy",
    label: "Videasy",
    buildUrl: (imdbId: string) => `https://player.videasy.net/movie/${imdbId}`,
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
  imdbId: string;
  title?: string;
}

// ---------------------------------------------------------------------------
// MoviePlayer
// ---------------------------------------------------------------------------
const MoviePlayer = ({ imdbId, title = "Movie" }: MoviePlayerProps) => {
  const [activeSource, setActiveSource] = useState<SourceId>("vidsrc");
  const [activeQuality, setActiveQuality] = useState<QualityId>("auto");
  const [activeLanguage, setActiveLanguage] = useState<LanguageId>("auto");
  const [isLoaded, setIsLoaded] = useState(false);
  // iframeKey forces a full remount when source changes (prevents stale embeds)
  const [iframeKey, setIframeKey] = useState(0);

  const currentSource = SOURCES.find((s) => s.id === activeSource)!;
  const currentQuality = QUALITY_OPTIONS.find((q) => q.id === activeQuality)!;
  const currentLanguage = LANGUAGE_OPTIONS.find((l) => l.id === activeLanguage)!;
  const embedUrl = (() => {
    const url = currentSource.buildUrl(imdbId);
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

  // ── Not yet activated ──────────────────────────────────────────────────
  if (!isLoaded) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#202020] bg-[#0a0a0a]">
        {/* Source tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1a1a1a] px-3 py-1.5">
          <SourceTabs active={activeSource} onChange={handleSourceChange} />
          <div className="flex flex-wrap gap-2">
            <QualityTabs active={activeQuality} onChange={handleQualityChange} />
            <LanguageTabs active={activeLanguage} onChange={handleLanguageChange} />
          </div>
        </div>

        {/* Play gate — user must click to load embed (saves bandwidth + privacy) */}
        <button
          type="button"
          onClick={() => setIsLoaded(true)}
          className="group relative flex aspect-video w-full items-center justify-center bg-[#0d0d0d] transition hover:bg-[#141414]"
          aria-label={`Play ${title}`}
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#00D7E5]/20 ring-2 ring-[#00D7E5]/40 transition group-hover:bg-[#00D7E5]/30 group-hover:ring-[#00D7E5]/70">
            <Play className="h-9 w-9 translate-x-0.5 fill-[#00D7E5] text-[#00D7E5]" />
          </div>
          <p className="absolute bottom-4 text-xs font-semibold tracking-wider text-gray-500">
            Click to stream · {currentSource.label}
          </p>
        </button>
      </div>
    );
  }

  // ── Active player ──────────────────────────────────────────────────────
  return (
    <div className="overflow-hidden rounded-xl border border-[#202020] bg-black">
      {/* Source tabs + reload */}
      <div className="flex items-center justify-between border-b border-[#1a1a1a] px-3 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SourceTabs active={activeSource} onChange={handleSourceChange} />
          <QualityTabs active={activeQuality} onChange={handleQualityChange} />
          <LanguageTabs active={activeLanguage} onChange={handleLanguageChange} />
        </div>
        <button
          type="button"
          onClick={handleReload}
          title="Reload player"
          className="ml-2 shrink-0 rounded p-1 text-gray-500 transition hover:text-[#00D7E5]"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Iframe embed */}
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

        {/* Native fullscreen button (top-right overlay) */}
        <button
          type="button"
          onClick={() => {
            const el = document.querySelector(`iframe[title="${title} — ${currentSource.label}"]`) as HTMLIFrameElement | null;
            el?.requestFullscreen?.();
          }}
          className="absolute right-3 top-3 z-10 rounded bg-black/60 p-1.5 text-white opacity-0 transition hover:opacity-100 focus:opacity-100"
          title="Fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>

      <p className="px-3 py-2 text-[10px] text-gray-700">
        Stream provided by <span className="text-gray-500">{currentSource.label}</span>. If playback
        fails, switch to another source above. Quality: <span className="text-gray-500">{currentQuality.label}</span>.
        Language: <span className="text-gray-500">{currentLanguage.label}</span>.
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Source tab strip (extracted for reuse in both states)
// ---------------------------------------------------------------------------
const SourceTabs = ({
  active,
  onChange,
}: {
  active: SourceId;
  onChange: (id: SourceId) => void;
}) => (
  <div className="flex gap-1 p-1.5">
    {SOURCES.map((source) => (
      <button
        key={source.id}
        type="button"
        onClick={() => onChange(source.id)}
        className={`rounded-md px-3 py-1 text-xs font-bold transition ${
          active === source.id
            ? "bg-[#00D7E5] text-black"
            : "text-gray-400 hover:bg-[#1a1a1a] hover:text-white"
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
  <div className="flex gap-1 rounded-lg border border-[#1f1f1f] bg-[#080808] p-1">
    {QUALITY_OPTIONS.map((quality) => (
      <button
        key={quality.id}
        type="button"
        onClick={() => onChange(quality.id)}
        className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
          active === quality.id
            ? "bg-[#00D7E5] text-black"
            : "text-gray-500 hover:bg-[#1a1a1a] hover:text-white"
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
  <div className="flex gap-1 rounded-lg border border-[#1f1f1f] bg-[#080808] p-1">
    {LANGUAGE_OPTIONS.map((language) => (
      <button
        key={language.id}
        type="button"
        onClick={() => onChange(language.id)}
        className={`rounded-md px-2.5 py-1 text-xs font-bold transition ${
          active === language.id
            ? "bg-[#00D7E5] text-black"
            : "text-gray-500 hover:bg-[#1a1a1a] hover:text-white"
        }`}
      >
        {language.label}
      </button>
    ))}
  </div>
);

export default MoviePlayer;
