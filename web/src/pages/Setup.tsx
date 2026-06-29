import { useState, useEffect } from "react";
import { authAPI, iptvAPI } from "@/lib/api";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Shield, Zap, RefreshCw, FileText } from "lucide-react";
import { z } from "zod";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";

const credentialsSchema = z.object({
  m3u_url: z.string().url({ message: "Invalid URL format" }).max(500),
});

const usernamePasswordSchema = z.object({
  server_url: z.string().url({ message: "Invalid server URL" }).max(500),
  username:   z.string().min(1, { message: "Username is required" }),
  password:   z.string().min(1, { message: "Password is required" }),
});

type TabId = 'm3u' | 'xtream' | 'paste';

const tabs: { id: TabId; label: string }[] = [
  { id: 'm3u',    label: 'M3U URL' },
  { id: 'xtream', label: 'Xtream Codes' },
  { id: 'paste',  label: 'Paste M3U' },
];

const Setup = () => {
  const navigate      = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>((searchParams.get("tab") as TabId) || "m3u");
  const [providerName, setProviderName] = useState("");
  const [username, setUsername]   = useState("");
  const [password, setPassword]   = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [m3uUrl, setM3uUrl]       = useState("");
  const [epgUrl, setEpgUrl]       = useState("");
  const [m3uContent, setM3uContent] = useState("");

  useEffect(() => {
    checkAuth();
    loadExistingCredentials();
  }, []);

  const checkAuth = async () => {
    try {
      const data = await authAPI.getCurrentUser();
      if (!data.success || !data.user) navigate("/auth");
    } catch {
      navigate("/auth");
    }
  };

  const loadExistingCredentials = async () => {
    try {
      const data = await iptvAPI.getCredentials();
      if (data.success && data.data) {
        const c = data.data;
        setProviderName(c.providerName || "");
        setUsername(c.username || "");
        setServerUrl(c.serverUrl || "");
        setM3uUrl(c.m3uUrl || "");
        setEpgUrl(c.epgUrl || "");
      }
    } catch { /* ignore */ }
  };

  const generateM3UFromCredentials = (srv: string, user: string, pass: string) => {
    try {
      let clean = srv.trim();
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) clean = `http://${clean}`;
      const url = new URL(clean);
      url.pathname = "/get.php";
      url.search = "";
      url.searchParams.set("username", user);
      url.searchParams.set("password", pass);
      url.searchParams.set("type", "m3u_plus");
      return url.toString();
    } catch {
      const base = srv.trim().replace(/\/$/, "");
      const proto = base.startsWith("http") ? "" : "http://";
      return `${proto}${base}/get.php?username=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}&type=m3u_plus`;
    }
  };

  const handleSaveM3U = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const v = credentialsSchema.safeParse({ m3u_url: m3uUrl });
      if (!v.success) { toast.error(v.error.errors[0].message); return; }
      const data = await iptvAPI.saveCredentials({ providerName: providerName || undefined, m3uUrl, epgUrl: epgUrl || undefined });
      if (!data.success) throw new Error(data.message || "Failed to save");
      toast.success("Credentials saved!");
      setTimeout(() => navigate("/dashboard"), 500);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveXtream = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const v = usernamePasswordSchema.safeParse({ server_url: serverUrl, username, password });
      if (!v.success) { toast.error(v.error.errors[0].message); return; }
      const generated = generateM3UFromCredentials(serverUrl, username, password);
      const data = await iptvAPI.saveCredentials({ providerName: providerName || undefined, username, password, serverUrl, m3uUrl: generated, epgUrl: epgUrl || undefined });
      if (!data.success) throw new Error(data.message || "Failed to save");
      toast.success("Credentials saved!");
      setTimeout(() => navigate("/dashboard?view=live&category=M3U"), 500);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePaste = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (!m3uContent.trim()) { toast.error("Please paste your M3U playlist content"); return; }
      if (!m3uContent.includes("#EXTINF") && !m3uContent.includes("#EXTM3U")) { toast.error("Invalid M3U format"); return; }
      const data = await iptvAPI.saveCredentials({ providerName: providerName || "Manual Upload", m3uContent });
      if (!data.success) throw new Error(data.message || "Failed to save");
      toast.success("Playlist saved!");
      setTimeout(() => navigate("/dashboard?view=live&category=M3U"), 500);
    } catch (err: any) {
      toast.error(err.message || "Failed to save M3U content");
    } finally {
      setIsLoading(false);
    }
  };

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">{label}</label>
      {children}
    </div>
  );

  const inputClass = "w-full h-12 bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-4 text-white text-sm placeholder-gray-700 focus:outline-none focus:border-[#00D7E5]/40 transition-colors";

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white pb-24">
      <AppHeader />

      <div className="px-4 pt-5 max-w-lg mx-auto">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-black text-white">Configure Provider</h1>
          <p className="text-gray-500 text-sm mt-1 leading-relaxed">
            Connect your IPTV service to begin streaming. Choose your preferred connection method below.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex bg-[#111] border border-[#1e1e1e] rounded-xl p-1 mb-5">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                activeTab === t.id
                  ? 'bg-[#00D7E5] text-black shadow-sm'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Forms */}
        <div className="bg-[#111] border border-[#1e1e1e] rounded-2xl p-5 mb-4">
          {activeTab === 'm3u' && (
            <form onSubmit={handleSaveM3U} className="space-y-4">
              <Field label="Provider Name">
                <input type="text" placeholder="e.g. Premium IPTV" value={providerName} onChange={(e) => setProviderName(e.target.value)} className={inputClass} />
              </Field>
              <Field label="EPG URL (Optional)">
                <input type="url" placeholder="http://provider.com/epg.xml" value={epgUrl} onChange={(e) => setEpgUrl(e.target.value)} className={inputClass} />
              </Field>
              <Field label="M3U Playlist URL">
                <input type="url" placeholder="http://provider-link.com/get.php?aut" value={m3uUrl} onChange={(e) => setM3uUrl(e.target.value)} required className={inputClass} />
              </Field>

              <div className="flex items-start gap-3 p-3 bg-[#0d0d0d] rounded-xl border border-[#1e1e1e]">
                <Shield className="w-4 h-4 text-[#00D7E5] shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500">Your credentials are encrypted and stored locally.</p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-[#00D7E5] hover:bg-[#00b8c5] text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Save &amp; Connect
              </button>
            </form>
          )}

          {activeTab === 'xtream' && (
            <form onSubmit={handleSaveXtream} className="space-y-4">
              <Field label="Provider Name">
                <input type="text" placeholder="e.g. Premium IPTV" value={providerName} onChange={(e) => setProviderName(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Server URL">
                <input type="url" placeholder="http://iptv-provider.com:8080" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} required className={inputClass} />
              </Field>
              <Field label="Username">
                <input type="text" placeholder="your_username" value={username} onChange={(e) => setUsername(e.target.value)} required className={inputClass} />
              </Field>
              <Field label="Password">
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} />
              </Field>
              <Field label="EPG URL (Optional)">
                <input type="url" placeholder="https://example.com/epg.xml.gz" value={epgUrl} onChange={(e) => setEpgUrl(e.target.value)} className={inputClass} />
              </Field>

              <div className="flex items-start gap-3 p-3 bg-[#0d0d0d] rounded-xl border border-[#1e1e1e]">
                <Shield className="w-4 h-4 text-[#00D7E5] shrink-0 mt-0.5" />
                <p className="text-xs text-gray-500">Your credentials are encrypted and stored locally.</p>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-[#00D7E5] hover:bg-[#00b8c5] text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Save &amp; Connect
              </button>
            </form>
          )}

          {activeTab === 'paste' && (
            <form onSubmit={handleSavePaste} className="space-y-4">
              <Field label="Provider Name">
                <input type="text" placeholder="e.g. My Playlist" value={providerName} onChange={(e) => setProviderName(e.target.value)} className={inputClass} />
              </Field>
              <Field label="Paste M3U Content">
                <textarea
                  placeholder="#EXTM3U&#10;#EXTINF:-1,Channel Name&#10;http://..."
                  value={m3uContent}
                  onChange={(e) => setM3uContent(e.target.value)}
                  required
                  className="w-full bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white text-xs font-mono placeholder-gray-700 focus:outline-none focus:border-[#00D7E5]/40 transition-colors min-h-[180px] resize-y"
                />
              </Field>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-[#00D7E5] hover:bg-[#00b8c5] text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Save Playlist
              </button>
            </form>
          )}
        </div>

        {/* Feature cards */}
        <div className="space-y-3">
          {[
            { icon: Zap,       title: 'Optimized Loading',  desc: 'We index your M3U metadata for lightning-fast channel switching.' },
            { icon: RefreshCw, title: 'Auto Sync',          desc: 'Playlist changes from your provider are automatically updated daily.' },
            { icon: FileText,  title: 'Multi-Format',       desc: 'Supports HLS, DASH, and RTMP streams with 4K HDR passthrough.' },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-4 bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
              <div className="w-9 h-9 rounded-xl bg-[#0f2020] border border-[#1a3030] flex items-center justify-center shrink-0">
                <f.icon className="w-4 h-4 text-[#00D7E5]" />
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-0.5">{f.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Setup;
