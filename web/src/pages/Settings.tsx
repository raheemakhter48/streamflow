import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Play, Info, CheckCircle, LogOut } from "lucide-react";
import { toast } from "sonner";
import { authAPI } from "@/lib/api";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";

const playerOptions = [
  { value: 'auto',    label: 'Auto',    desc: 'Recommended for most users' },
  { value: 'hls',     label: 'HLS.js',  desc: 'Optimal for adaptive bitrates' },
  { value: 'mpegts',  label: 'MPEG-TS', desc: 'Standard broadcast protocol' },
  { value: 'native',  label: 'Native',  desc: 'Use system default player' },
];

const Settings = () => {
  const navigate = useNavigate();
  const [playerType, setPlayerType] = useState(localStorage.getItem("preferred_player") || "auto");
  const [useProxy, setUseProxy]     = useState(localStorage.getItem("use_proxy") !== "false");

  const handlePlayerChange = (value: string) => {
    setPlayerType(value);
    localStorage.setItem("preferred_player", value);
    toast.success("Player preference saved");
  };

  const handleProxyChange = (checked: boolean) => {
    setUseProxy(checked);
    localStorage.setItem("use_proxy", checked.toString());
    toast.success(checked ? "Global Smart Routing enabled" : "Direct playback enabled");
  };

  const handleLogout = async () => {
    await authAPI.logout();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24 lg:pb-6">
      <AppHeader />

      <div className="px-4 pt-5 max-w-lg lg:max-w-2xl mx-auto space-y-4">
        {/* Page title */}
        <div className="mb-5">
          <h1 className="text-2xl font-black text-white">Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Configure your streaming preferences and app performance.</p>
        </div>

        {/* Playback section */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[#1e1e1e]">
            <Play className="w-5 h-5 text-[#00D7E5]" />
            <span className="font-bold text-[#00D7E5] text-base">Playback</span>
          </div>

          <div className="px-4 pt-4 pb-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-3">Stream Player Type</p>
            <div className="space-y-2">
              {playerOptions.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center justify-between p-3 rounded-xl border border-[#1e1e1e] bg-[#0d0d0d] cursor-pointer hover:border-[#333] transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold text-white">{opt.label}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{opt.desc}</p>
                  </div>
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      playerType === opt.value
                        ? 'border-[#00D7E5] bg-[#00D7E5]'
                        : 'border-[#333] bg-transparent'
                    }`}
                    onClick={() => handlePlayerChange(opt.value)}
                  >
                    {playerType === opt.value && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <input
                    type="radio"
                    name="player"
                    value={opt.value}
                    checked={playerType === opt.value}
                    onChange={() => handlePlayerChange(opt.value)}
                    className="sr-only"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Proxy toggle */}
          <div className="flex items-center justify-between px-4 py-4 border-t border-[#1e1e1e]">
            <div>
              <p className="text-sm font-bold text-white">Global Smart Routing</p>
              <p className="text-xs text-gray-600 mt-0.5">Try direct playback, then automatically find a working region</p>
            </div>
            <Switch checked={useProxy} onCheckedChange={handleProxyChange} />
          </div>
        </div>

        {/* App Info section */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 py-4 border-b border-[#1e1e1e]">
            <Info className="w-5 h-5 text-[#00D7E5]" />
            <span className="font-bold text-[#00D7E5] text-base">App Info</span>
          </div>

          {[
            { label: 'Version',        value: '2.4.12-pro' },
            { label: 'Build Date',     value: 'October 24, 2023' },
            { label: 'User ID',        value: 'SF-882-9901-X' },
            { label: 'Network Status', value: '● Connected', valueClass: 'text-green-400' },
          ].map((row, i, arr) => (
            <div
              key={row.label}
              className={`flex items-center justify-between px-4 py-3.5 ${i < arr.length - 1 ? 'border-b border-[#1a1a1a]' : ''}`}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{row.label}</span>
              <span className={`text-sm font-semibold ${row.valueClass || 'text-white'}`}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full h-13 bg-red-600/90 hover:bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 py-3.5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
        <p className="text-center text-xs text-gray-700">Log out will clear your session on this device.</p>

        {/* IPTV Setup shortcut */}
        <button
          onClick={() => navigate('/setup')}
          className="w-full h-12 bg-transparent border border-[#1e1e1e] text-gray-400 hover:text-white hover:border-[#333] font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <CheckCircle className="w-4 h-4" />
          IPTV Setup
        </button>
      </div>

      <BottomNav />
    </div>
  );
};

export default Settings;
