import { useEffect, useState } from "react";
import { streamMetricsAPI } from "@/lib/api";
import { Sparkles, X, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function SmartSeoAssistant() {
  const [suggestion, setSuggestion] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    // Check trending matches after 4 seconds of page load
    const timer = setTimeout(() => {
      streamMetricsAPI.getLiveScores()
        .then((scores) => {
          if (!isMounted || !Array.isArray(scores) || scores.length === 0) return;
          const liveMatch = scores.find((s: any) => s.status?.toLowerCase().includes('live')) || scores[0];
          if (liveMatch) {
            setSuggestion(liveMatch);
            setVisible(true);
          }
        })
        .catch(() => {});
    }, 4000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  if (!visible || !suggestion) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 max-w-sm rounded-2xl border border-[#00CFE8]/30 bg-[#0A0E14]/95 p-3.5 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#00CFE8] to-blue-600 text-black shadow-md">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#00CFE8]">StreamFlow AI Bot</span>
              <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400">
                <Flame className="h-3 w-3 fill-current" /> Live Match Alert
              </span>
            </div>
            <p className="text-xs font-bold text-white line-clamp-1">{suggestion.title}</p>
          </div>
        </div>

        <button
          onClick={() => setVisible(false)}
          className="text-gray-500 hover:text-white transition-colors p-0.5"
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-white/5">
        <span className="text-[11px] font-semibold text-gray-300">
          Score: <strong className="text-amber-300">{suggestion.score}</strong>
        </span>
        <button
          onClick={() => {
            setVisible(false);
            navigate('/dashboard?view=streams');
          }}
          className="rounded-lg bg-[#00CFE8] px-2.5 py-1 text-[10px] font-black text-black hover:bg-[#00CFE8]/90 transition-all active:scale-95"
        >
          Watch Stream →
        </button>
      </div>
    </div>
  );
}
