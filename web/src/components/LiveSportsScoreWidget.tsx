import { useEffect, useState } from "react";
import { streamMetricsAPI } from "@/lib/api";
import { Trophy, ChevronDown, ChevronUp, Radio } from "lucide-react";

export default function LiveSportsScoreWidget() {
  const [scores, setScores] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchScores = () => {
      streamMetricsAPI.getLiveScores()
        .then((data) => {
          if (isMounted && Array.isArray(data) && data.length > 0) {
            setScores(data);
            setLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setLoading(false);
        });
    };

    fetchScores();
    // Auto-refresh scores every 30 seconds
    const interval = setInterval(fetchScores, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading || scores.length === 0) return null;

  const currentMatch = scores[0];

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0E131A]/95 shadow-xl backdrop-blur-xl">
      {/* Top compact ticker bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-red-950/40 via-[#161D26] to-[#0E131A]">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/20 border border-red-500/30 text-[10px] font-black text-red-400">
            <Radio className="w-3 h-3 animate-pulse" />
            LIVE SCORE
          </div>

          <div className="flex items-center gap-2 truncate text-xs font-bold text-white">
            <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">{currentMatch.title}</span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 font-extrabold shrink-0 border border-amber-400/20">
              {currentMatch.score}
            </span>
          </div>
        </div>

        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1 text-[11px] font-bold text-[#00CFE8] hover:text-white transition-colors shrink-0 ml-2"
        >
          <span>{scores.length} Matches</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded matches list */}
      {expanded && (
        <div className="p-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto border-t border-white/5 scrollbar-none">
          {scores.map((match, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-white/5 bg-white/5 flex flex-col justify-between gap-1.5"
            >
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <span className="font-semibold uppercase tracking-wider">{match.tournament}</span>
                <span className="text-red-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  {match.status}
                </span>
              </div>
              <p className="text-xs font-bold text-white truncate">{match.title}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs font-black text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                  {match.score}
                </span>
                <span className="text-[10px] text-gray-500 font-medium">{match.sport}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
