// Shared constants and helpers for Admin console tabs
export const C = {
  cyan:   "#22d3ee",
  purple: "#a855f7",
  green:  "#4ade80",
  red:    "#f87171",
  amber:  "#fbbf24",
};

export const EMPTY_CHANNEL = {
  name: "", slug: "", logoUrl: "", country: "", category: "",
  streamUrl: "", iframeEmbed: "", status: "working",
  isManualOverride: true,
  scrapeSourceUrl: "", scraperType: "generic",
};

export const fmtDate = (d: string) => {
  const parts = d.split("-");
  return `${parts[1]}/${parts[2]}`;
};

export const shortRoute = (r: string) =>
  r.replace("/api/", "").replace("/:id", "").slice(0, 22);

export const LOG_COLORS: Record<string, string> = {
  info:  "text-cyan-400",
  warn:  "text-amber-400",
  error: "text-red-400",
};
