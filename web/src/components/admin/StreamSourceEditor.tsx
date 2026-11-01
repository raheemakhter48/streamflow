import { useState, useEffect } from "react";
import { Video, Volume2, Sparkles, Plus, Trash2, Check, Copy, Split, Server, Sliders, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface StreamSourceEditorProps {
  streamUrl: string;
  onChangeStreamUrl: (url: string) => void;
  iframeEmbed?: string;
  onChangeIframeEmbed?: (embed: string) => void;
}

export function StreamSourceEditor({
  streamUrl,
  onChangeStreamUrl,
  iframeEmbed = "",
  onChangeIframeEmbed,
}: StreamSourceEditorProps) {
  // Tabs: 'single' | 'split' | 'smart' | 'servers'
  const [activeTab, setActiveTab] = useState<"single" | "split" | "smart" | "servers">("single");

  // Split Track State (Separate Video + Audio)
  const [videoUrl, setVideoUrl] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [quality, setQuality] = useState("1080p");
  const [audioName, setAudioName] = useState("Main Audio");

  // Multi-Server State
  const [servers, setServers] = useState<{ name: string; url: string; quality: string }[]>([]);

  // Smart Paste State
  const [pasteText, setPasteText] = useState("");
  const [detectedSummary, setDetectedSummary] = useState<string | null>(null);

  // Parse existing streamUrl if it's already an HLS mux or multi-param URL
  useEffect(() => {
    if (!streamUrl) return;

    // Check if it's a mux URL: /api/stream/mux.m3u8?video=...&audio=...
    if (streamUrl.includes("/mux.m3u8") || (streamUrl.includes("video=") && streamUrl.includes("audio="))) {
      try {
        const urlObj = new URL(streamUrl, window.location.origin);
        const v = urlObj.searchParams.get("video");
        const a = urlObj.searchParams.get("audio");
        const q = urlObj.searchParams.get("quality");
        const an = urlObj.searchParams.get("audioName");

        if (v) setVideoUrl(v);
        if (a) setAudioUrl(a);
        if (q) setQuality(q);
        if (an) setAudioName(an);
        setActiveTab("split");
      } catch {
        setVideoUrl(streamUrl);
      }
    } else {
      setVideoUrl(streamUrl);
    }
  }, [streamUrl]);

  // Combine Video + Audio into a standardized HLS Mux URL
  const generateMuxUrl = (v: string, a: string, q: string, an: string) => {
    if (!v.trim()) return "";
    if (!a.trim()) return v.trim(); // No separate audio, keep direct video URL

    const params = new URLSearchParams({
      video: v.trim(),
      audio: a.trim(),
      quality: q,
      audioName: an || "Main Audio",
    });

    return `/api/stream/mux.m3u8?${params.toString()}`;
  };

  const applySplitTracks = () => {
    if (!videoUrl.trim()) {
      toast.error("Video stream URL is required");
      return;
    }
    const combined = generateMuxUrl(videoUrl, audioUrl, quality, audioName);
    onChangeStreamUrl(combined);
    toast.success("Synchronized Video + Audio HLS Mux stream generated!");
  };

  // Smart Auto-Detector for pasted text (supports URLs, video/audio tracks, qualities)
  const handleSmartDetect = () => {
    if (!pasteText.trim()) {
      toast.error("Pehle links paste karein");
      return;
    }

    const lines = pasteText
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    let foundVideo = "";
    let foundAudio = "";
    let foundQuality = quality;
    const extractedServers: { name: string; url: string; quality: string }[] = [];

    // Extract all URLs
    const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
    const allUrls: string[] = [];

    for (const line of lines) {
      const match = line.match(urlRegex);
      if (match) {
        match.forEach((u) => allUrls.push(u));
      }
    }

    // Detect quality from text
    if (pasteText.match(/4k|2160p/i)) foundQuality = "4K";
    else if (pasteText.match(/1080p|fhd|full hd/i)) foundQuality = "1080p";
    else if (pasteText.match(/720p|hd/i)) foundQuality = "720p";
    else if (pasteText.match(/480p|sd/i)) foundQuality = "480p";
    else if (pasteText.match(/360p/i)) foundQuality = "360p";

    // Detect audio vs video from URLs or line prefixes
    for (const line of lines) {
      const lineLower = line.toLowerCase();
      const urlsInLine = line.match(urlRegex);
      if (!urlsInLine || urlsInLine.length === 0) continue;
      const u = urlsInLine[0];

      const isAudioExplicit =
        lineLower.includes("audio") ||
        lineLower.includes("sound") ||
        lineLower.includes("voice") ||
        lineLower.includes(".aac") ||
        lineLower.includes(".mp3") ||
        lineLower.includes("track_audio") ||
        lineLower.includes("audio.m3u8") ||
        lineLower.includes("audio_");

      const isVideoExplicit =
        lineLower.includes("video") ||
        lineLower.includes("video.m3u8") ||
        lineLower.includes("stream_video") ||
        lineLower.includes("chunklist_b") ||
        lineLower.includes("index_");

      if (isAudioExplicit && !foundAudio) {
        foundAudio = u;
      } else if (isVideoExplicit && !foundVideo) {
        foundVideo = u;
      } else if (!foundVideo) {
        foundVideo = u;
      } else if (!foundAudio) {
        foundAudio = u;
      }

      // Also create server item
      const sName = line.split(/[:=|-]/)[0]?.trim();
      extractedServers.push({
        name: sName && sName.length < 25 && !sName.startsWith("http") ? sName : `Server ${extractedServers.length + 1}`,
        url: u,
        quality: lineLower.includes("720") ? "720p" : lineLower.includes("480") ? "480p" : foundQuality,
      });
    }

    // Apply detected
    if (foundVideo) setVideoUrl(foundVideo);
    if (foundAudio) setAudioUrl(foundAudio);
    setQuality(foundQuality);
    if (extractedServers.length > 0) setServers(extractedServers);

    const summaryParts: string[] = [];
    if (foundVideo) summaryParts.push("✓ Video URL detected");
    if (foundAudio) summaryParts.push("✓ Separate Audio track detected");
    summaryParts.push(`✓ Quality: ${foundQuality}`);
    if (extractedServers.length > 1) summaryParts.push(`✓ ${extractedServers.length} Alternate Servers found`);

    setDetectedSummary(summaryParts.join(" • "));

    // If both video and audio found, auto switch to split tab and build mux
    if (foundVideo && foundAudio) {
      setActiveTab("split");
      const combined = generateMuxUrl(foundVideo, foundAudio, foundQuality, audioName);
      onChangeStreamUrl(combined);
      toast.success("Separate Video & Audio links detected & synchronized!");
    } else if (foundVideo) {
      onChangeStreamUrl(foundVideo);
      toast.success("Stream URL detected & applied!");
    }
  };

  const addServer = () => {
    setServers((prev) => [
      ...prev,
      {
        name: `Server ${prev.length + 1} (${quality})`,
        url: "",
        quality,
      },
    ]);
  };

  const removeServer = (idx: number) => {
    setServers((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateServer = (idx: number, field: string, val: string) => {
    setServers((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: val } : s))
    );
  };

  return (
    <div className="space-y-3 rounded-lg border border-cyan-500/20 bg-cyan-950/10 p-3">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-border/50 pb-2">
        <span className="text-xs font-semibold tracking-wide text-cyan-400 uppercase flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5 text-cyan-400" />
          Stream Source & Audio Manager
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={activeTab === "single" ? "default" : "ghost"}
            className="h-6 px-2 text-[11px]"
            onClick={() => setActiveTab("single")}
          >
            Direct
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === "split" ? "default" : "ghost"}
            className="h-6 px-2 text-[11px] gap-1"
            onClick={() => setActiveTab("split")}
          >
            <Split className="h-3 w-3" />
            Split Video/Audio
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === "servers" ? "default" : "ghost"}
            className="h-6 px-2 text-[11px] gap-1"
            onClick={() => setActiveTab("servers")}
          >
            <Server className="h-3 w-3" />
            Multi-Quality
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activeTab === "smart" ? "default" : "ghost"}
            className="h-6 px-2 text-[11px] gap-1 text-amber-400"
            onClick={() => setActiveTab("smart")}
          >
            <Sparkles className="h-3 w-3" />
            Smart Paste
          </Button>
        </div>
      </div>

      {/* TAB 1: Direct Single Stream */}
      {activeTab === "single" && (
        <div className="space-y-2">
          <div className="relative">
            <Input
              placeholder="Stream URL (.m3u8 / .ts / direct HTTP link) *"
              value={streamUrl}
              onChange={(e) => onChangeStreamUrl(e.target.value)}
              className="text-xs font-mono pr-8"
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Direct single HLS playlist ya TS link. Agar video aur audio alag hain toh upar{" "}
            <span className="text-cyan-400 font-medium cursor-pointer" onClick={() => setActiveTab("split")}>
              Split Video/Audio
            </span>{" "}
            select karein.
          </p>
        </div>
      )}

      {/* TAB 2: Separate Video & Audio Tracks (HLS Muxer) */}
      {activeTab === "split" && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-cyan-300 font-medium">Dual-Track Separated Streams</span>
            <Badge variant="outline" className="text-[10px] bg-cyan-500/10 text-cyan-400 border-cyan-500/30">
              Synchronized HLS Muxer
            </Badge>
          </div>

          {/* Video Stream URL */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium flex items-center gap-1.5 text-zinc-300">
              <Video className="h-3.5 w-3.5 text-blue-400" />
              Video Stream URL (.m3u8 / .mp4 / .ts) *
            </label>
            <Input
              placeholder="https://.../video.m3u8"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          {/* Audio Stream URL */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium flex items-center gap-1.5 text-zinc-300">
              <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
              Separate Audio Stream URL (.m3u8 / .aac / .mp3 / .ts) *
            </label>
            <Input
              placeholder="https://.../audio.m3u8"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              className="text-xs font-mono"
            />
          </div>

          {/* Quality & Audio Track Name */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">Stream Quality</label>
              <Select value={quality} onValueChange={setQuality}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Quality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4K">4K UHD (2160p)</SelectItem>
                  <SelectItem value="1080p">1080p Full HD</SelectItem>
                  <SelectItem value="720p">720p HD</SelectItem>
                  <SelectItem value="480p">480p SD</SelectItem>
                  <SelectItem value="360p">360p Mobile</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] text-zinc-400">Audio Track Label</label>
              <Input
                placeholder="e.g. Hindi, English, Commentary"
                value={audioName}
                onChange={(e) => setAudioName(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Action to build and sync */}
          <Button
            type="button"
            size="sm"
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-8 gap-1.5"
            onClick={applySplitTracks}
          >
            <Split className="h-3.5 w-3.5" />
            Apply & Generate Synchronized Stream
          </Button>

          {streamUrl.includes("/mux.m3u8") && (
            <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 text-[11px] space-y-1.5">
              <div className="flex items-center justify-between text-cyan-400 font-medium">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Check className="h-3.5 w-3.5 text-cyan-400" />
                  Active Unified Mux Stream (Synced)
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-6 text-[10px] px-2 gap-1 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
                  onClick={() => {
                    const params = new URLSearchParams({
                      name: "PTV Sports Test",
                      url: streamUrl,
                    });
                    window.open(`/player?${params.toString()}`, "_blank");
                  }}
                >
                  <ExternalLink className="h-3 w-3" />
                  Test Play Stream
                </Button>
              </div>
              <p className="text-[10px] font-mono text-zinc-300 break-all bg-black/40 p-1.5 rounded">{streamUrl}</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Multi-Quality & Multi-Server */}
      {activeTab === "servers" && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-cyan-300 font-medium">Multi-Server Qualities & Mirrors</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 text-[10px] gap-1 text-cyan-400"
              onClick={addServer}
            >
              <Plus className="h-3 w-3" />
              Add Server
            </Button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {servers.length === 0 ? (
              <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border rounded">
                Koi extra server add nahi hai. "Add Server" click karein ya Smart Paste use karein.
              </div>
            ) : (
              servers.map((s, idx) => (
                <div key={idx} className="p-2 rounded bg-card/60 border border-border/60 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Server Name (e.g. Server 2 HD)"
                      value={s.name}
                      onChange={(e) => updateServer(idx, "name", e.target.value)}
                      className="h-7 text-xs flex-1"
                    />
                    <Select value={s.quality} onValueChange={(val) => updateServer(idx, "quality", val)}>
                      <SelectTrigger className="h-7 w-24 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1080p">1080p</SelectItem>
                        <SelectItem value="720p">720p</SelectItem>
                        <SelectItem value="480p">480p</SelectItem>
                        <SelectItem value="Auto">Auto</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-400 hover:text-red-300"
                      onClick={() => removeServer(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Input
                    placeholder="https://.../stream.m3u8"
                    value={s.url}
                    onChange={(e) => updateServer(idx, "url", e.target.value)}
                    className="h-7 text-xs font-mono"
                  />
                </div>
              ))
            )}
          </div>

          {servers.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full text-xs h-7"
              onClick={() => {
                const first = servers.find((s) => s.url.trim());
                if (first) {
                  onChangeStreamUrl(first.url);
                  toast.success(`Primary stream set to ${first.name}`);
                }
              }}
            >
              Set Server 1 as Primary Stream
            </Button>
          )}
        </div>
      )}

      {/* TAB 4: Smart Paste & Auto-Detector */}
      {activeTab === "smart" && (
        <div className="space-y-2.5">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-amber-400 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Smart Raw Link Paste Box
            </label>
            <textarea
              rows={4}
              placeholder={`Yahan apne multiple links paste karein:\n\nExample 1:\nVideo: https://server.com/live/video.m3u8\nAudio: https://server.com/live/audio.m3u8\nQuality: 1080p\n\nExample 2 (2 lines):\nhttps://server.com/1080p.m3u8\nhttps://server.com/720p.m3u8`}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="w-full rounded-md border border-amber-500/30 bg-background p-2 text-xs font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>

          <Button
            type="button"
            size="sm"
            className="w-full bg-amber-600 hover:bg-amber-500 text-black font-semibold text-xs h-8 gap-1.5"
            onClick={handleSmartDetect}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Auto-Detect Video, Audio & Qualities
          </Button>

          {detectedSummary && (
            <div className="p-2 rounded bg-emerald-950/30 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              {detectedSummary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default StreamSourceEditor;
