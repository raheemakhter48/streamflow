import { useEffect, useState } from "react";
import { streamMetricsAPI } from "@/lib/api";
import { Sparkles, X, Flame } from "lucide-react";
import { useNavigate } from "react-router-dom";

const DISMISS_KEY = "streamflow_ai_bot_dismissed";
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours cooldown once dismissed

export default function SmartSeoAssistant() {
  const [suggestion, setSuggestion] = useState<any>(null);
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user previously dismissed the bot
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === "true") return;
      const dismissedAt = localStorage.getItem(DISMISS_KEY);
      if (dismissedAt) {
        const timePassed = Date.now() - parseInt(dismissedAt, 10);
        if (timePassed < DISMISS_COOLDOWN_MS) return;
      }
    } catch {}

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

  const handleDismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "true");
      localStorage.setItem(DISMISS_KEY, Date.now().toString());
    } catch {}
  };

  if (!visible || !suggestion) return null;

  return (
    <div className="fixed bottom-20 right-3 sm:right-5 z-40 w-[calc(100%-24px)] sm:w-auto sm:max-w-sm rounded-2xl border border-[#00CFE8]/30 bg-[#0A0E14]/95 p-3.5 shadow-2xl backdrop-blur-2xl animate-in slide-in-from-bottom-5 duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-[#00CFE8] to-blue-600 text-black shadow-md shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#00CFE8]">StreamFlow AI Bot</span>
              <span className="flex items-center gap-0.5 text-[9px] font-bold text-amber-400">
                <Flame className="h-3 w-3 fill-current" /> Live Match Alert
              </span>
            </div>
            <p className="text-xs font-bold text-white truncate">{suggestion.title}</p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 shrink-0"
          aria-label="Close"
          title="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-white/5">
        <span className="text-[11px] font-semibold text-gray-300">
          Score: <strong className="text-amber-300">{suggestion.score}</strong>
        </span>
        <button
          onClick={() => {
            handleDismiss();
            navigate('/dashboard?view=streams');
          }}
          className="rounded-lg bg-[#00CFE8] px-3 py-1 text-[10px] font-black text-black hover:bg-[#00CFE8]/90 transition-all active:scale-95 shadow-md shadow-cyan-500/20"
        >
          Watch Stream →
        </button>
      </div>
    </div>
  );
}
