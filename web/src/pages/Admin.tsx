import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import BottomNav from "@/components/BottomNav";
import {
  Activity, ArrowLeft, BarChart3, Download, Filter, Loader2, Plus,
  RefreshCw, Save, Terminal, Trash2, Tv, Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { adminAPI } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

// ─── Palette used across all charts ───────────────────────────────────────────
const C = {
  cyan:   "#22d3ee",
  purple: "#a855f7",
  green:  "#4ade80",
  red:    "#f87171",
  amber:  "#fbbf24",
};

const EMPTY_CHANNEL = {
  name: "", slug: "", logoUrl: "", country: "", category: "",
  streamUrl: "", iframeEmbed: "", status: "working",
  isManualOverride: true,
  scrapeSourceUrl: "", scraperType: "generic",
};

const fmtDate = (d: string) => {
  const parts = d.split("-");
  return `${parts[1]}/${parts[2]}`;
};

const shortRoute = (r: string) =>
  r.replace("/api/", "").replace("/:id", "").slice(0, 22);

const LOG_COLORS: Record<string, string> = {
  info:  "text-cyan-400",
  warn:  "text-amber-400",
  error: "text-red-400",
};

// ─── Channels Tab ─────────────────────────────────────────────────────────────

function ChannelsTab() {
  const [channels, setChannels]     = useState<any[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("all");
  const [countries, setCountries]   = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [form, setForm]             = useState<any>(EMPTY_CHANNEL);
  const [editingId, setEditingId]   = useState<string | undefined>();
  const [showForm, setShowForm]     = useState(false);
  const [busy, setBusy]             = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const [ch, fi] = await Promise.all([
        adminAPI.getChannels({
          page,
          limit: 50,
          search: search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
        }),
        adminAPI.getFilters(),
      ]);
      setChannels(ch.data || []);
      setTotal(ch.total || 0);
      const f = fi.data || [];
      setCountries(f.filter((x: any) => x.type === "country"));
      setCategories(f.filter((x: any) => x.type === "category"));
    } catch (e: any) {
      toast.error(e.message || "Failed to load channels");
    } finally {
      setBusy(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, statusFilter]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) return toast.error("Channel name is required");
    if (form.isManualOverride && !form.streamUrl && !form.iframeEmbed)
      return toast.error("Manual override requires a stream URL or iframe embed");
    try {
      await adminAPI.saveChannel(form, editingId);
      toast.success(editingId ? "Channel updated" : "Channel created");
      setForm(EMPTY_CHANNEL);
      setEditingId(undefined);
      setShowForm(false);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
  };

  const edit = (ch: any) => {
    setEditingId(ch.id);
    setForm({
      name: ch.name || "", slug: ch.slug || "", logoUrl: ch.logo_url || "",
      country: ch.country || "", category: ch.category || "",
      streamUrl: ch.stream_url || "", iframeEmbed: ch.iframe_embed || "",
      status: ch.status || "working",
      isManualOverride: ch.source_type === "iptv" ? false : (ch.is_manual_override ?? true),
      scrapeSourceUrl: ch.scrape_source_url || "",
      scraperType: ch.scraper_type || "generic",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const scrapeNow = async (id: string, name: string) => {
    setBusy(true);
    try {
      const r = await adminAPI.scrapeChannel(id);
      if (r.data?.url) {
        toast.success(`${name}: stream found → ${r.data.url.slice(0, 60)}…`);
      } else {
        toast.warning(`${name}: no stream found (${r.data?.status})`);
      }
      load();
    } catch (e: any) {
      toast.error(e.message || "Scrape failed");
    } finally {
      setBusy(false);
    }
  };

  const scrapeBulk = async () => {
    try {
      const r = await adminAPI.scrapeBulk();
      toast.success(r.message || "Bulk scrape started in background");
    } catch (e: any) {
      toast.error(e.message || "Bulk scrape failed");
    }
  };

  const del = async (id: string) => {
    try {
      await adminAPI.deleteChannel(id);
      toast.success("Channel deleted");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  };

  const healthCheck = async () => {
    setBusy(true);
    try {
      const r = await adminAPI.runHealthCheck();
      toast.success(`Health-checked ${r.data?.length || 0} channels`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Health check failed");
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => { setShowForm(false); setEditingId(undefined); setForm(EMPTY_CHANNEL); };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search channels…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && load()}
          className="max-w-56"
        />
        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="working">Working</SelectItem>
            <SelectItem value="broken">Broken</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={load} disabled={busy}>
          <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button variant="outline" onClick={healthCheck} disabled={busy}>
          <Activity className="mr-2 h-4 w-4" />
          Health Check
        </Button>
        <Button onClick={() => { setForm(EMPTY_CHANNEL); setEditingId(undefined); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Channel
        </Button>
        <Button variant="secondary" onClick={scrapeBulk} disabled={busy}>
          <Zap className="mr-2 h-4 w-4" />
          Bulk Scrape
        </Button>
      </div>

      <div className={`grid gap-4 ${showForm ? "xl:grid-cols-[1fr_400px]" : ""}`}>
        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Checked</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      {busy ? "Loading…" : "No channels found"}
                    </TableCell>
                  </TableRow>
                ) : channels.map(ch => (
                  <TableRow key={ch.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {ch.logo_url && (
                          <img
                            src={ch.logo_url}
                            alt=""
                            className="h-6 w-6 rounded object-cover"
                            onError={e => (e.currentTarget.style.display = "none")}
                          />
                        )}
                        <span className="font-medium">{ch.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{ch.country || "—"}</TableCell>
                    <TableCell>{ch.category || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={ch.source_type === "iptv" ? "outline" : "secondary"}>
                        {ch.source_label || (ch.source_type === "iptv" ? "IPTV-org" : "Manual")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={ch.status === "working" ? "default" : "destructive"}>
                        {ch.status === "working" ? "Working" : "Non Working"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {ch.last_checked_at ? new Date(ch.last_checked_at).toLocaleString() : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      {!ch.is_manual_override && ch.source_type !== "iptv" && ch.scrape_source_url && (
                        <Button variant="ghost" size="sm" onClick={() => scrapeNow(ch.id, ch.name)} disabled={busy} title="Scrape now">
                          <Zap className="h-4 w-4 text-amber-400" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => edit(ch)}>Edit</Button>
                      {ch.source_type !== "iptv" && (
                        <Button variant="ghost" size="icon" onClick={() => del(ch.id)}>
                          <Trash2 className="h-4 w-4 text-red-400" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create / Edit form */}
        {showForm && (
          <Card className="self-start">
            <CardHeader>
              <CardTitle className="text-base">{editingId ? "Edit Channel" : "New Channel"}</CardTitle>
              <CardDescription>
                {editingId ? "Update channel metadata and stream source" : "Add a new managed channel"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Channel name *" value={form.name} onChange={e => set("name", e.target.value)} />
              <Input placeholder="Slug (auto if empty)" value={form.slug} onChange={e => set("slug", e.target.value)} />
              <Input placeholder="Logo / thumbnail URL" value={form.logoUrl} onChange={e => set("logoUrl", e.target.value)} />

              <div className="grid grid-cols-2 gap-2">
                <Select value={form.country || "none"} onValueChange={v => set("country", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Country" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {countries.map(c => <SelectItem key={c.id} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={form.category || "none"} onValueChange={v => set("category", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Input
                placeholder="Stream URL (.m3u8 / direct link)"
                value={form.streamUrl}
                onChange={e => set("streamUrl", e.target.value)}
              />
              <Textarea
                placeholder="Iframe embed code (overrides stream URL when set)"
                value={form.iframeEmbed}
                onChange={e => set("iframeEmbed", e.target.value)}
                rows={3}
              />

              {/* Source toggle */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={form.isManualOverride ? "default" : "outline"}
                  onClick={() => set("isManualOverride", true)}
                >
                  Manual Override
                </Button>
                <Button
                  size="sm"
                  variant={!form.isManualOverride ? "default" : "outline"}
                  onClick={() => set("isManualOverride", false)}
                >
                  Auto Scrape
                </Button>
              </div>

              {/* Auto-scrape fields — only shown when scraping is enabled */}
              {!form.isManualOverride && (
                <div className="space-y-2 rounded-md border border-amber-400/20 bg-amber-400/5 p-3">
                  <p className="text-xs font-medium text-amber-400">Auto-Scrape Settings</p>
                  <Input
                    placeholder="Scrape Source URL (e.g. https://crictime.com/match/123) *"
                    value={form.scrapeSourceUrl}
                    onChange={e => set("scrapeSourceUrl", e.target.value)}
                  />
                  <Select value={form.scraperType} onValueChange={v => set("scraperType", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Scraper type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="generic">Generic (most sites)</SelectItem>
                      <SelectItem value="crictime">Crictime</SelectItem>
                      <SelectItem value="streameast">Streameast</SelectItem>
                      <SelectItem value="sportsurge">Sportsurge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status toggle */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={form.status === "working" ? "default" : "outline"}
                  onClick={() => set("status", "working")}
                >
                  Working
                </Button>
                <Button
                  size="sm"
                  variant={form.status === "broken" ? "destructive" : "outline"}
                  onClick={() => set("status", "broken")}
                >
                  Non Working
                </Button>
              </div>

              <div className="flex gap-2 pt-1">
                <Button className="flex-1" onClick={save}>
                  {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                  {editingId ? "Save Changes" : "Create Channel"}
                </Button>
                <Button variant="outline" onClick={cancel}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Prev
          </Button>
          <span className="text-sm text-muted-foreground">Page {page}</span>
          <Button variant="outline" size="sm" disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab() {
  const [summary,    setSummary]    = useState<any>(null);
  const [system,     setSystem]     = useState<any>(null);
  const [dau,        setDau]        = useState<any[]>([]);
  const [apiMetrics, setApiMetrics] = useState<{ routeStats: any[]; trend: any[] }>({ routeStats: [], trend: [] });
  const [dauDays,    setDauDays]    = useState("7");
  const [busy,       setBusy]       = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const [s, sys, d, m] = await Promise.all([
        adminAPI.getSummary(),
        adminAPI.getSystemMetrics(),
        adminAPI.getDauMetrics(Number(dauDays)),
        adminAPI.getApiMetrics(),
      ]);
      setSummary(s.data);
      setSystem(sys.data);
      setDau(d.data || []);
      setApiMetrics(m.data || { routeStats: [], trend: [] });
    } catch (e: any) {
      toast.error(e.message || "Failed to load analytics");
    } finally {
      setBusy(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [dauDays]);

  const scrapeSlices = summary ? [
    { name: "Success", value: summary.scrapeStats?.success || 0, color: C.green },
    { name: "Failed",  value: summary.scrapeStats?.failed  || 0, color: C.red  },
    { name: "Timeout", value: summary.scrapeStats?.timeout || 0, color: C.amber },
  ] : [];
  const totalScrape = scrapeSlices.reduce((a, b) => a + b.value, 0);

  const uptime = system
    ? `${Math.floor(system.uptimeSeconds / 3600)}h ${Math.floor((system.uptimeSeconds % 3600) / 60)}m`
    : "—";

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total Channels",   value: summary?.channelCount        ?? "—", color: "text-cyan-400"   },
          { label: "Broken Streams",   value: summary?.brokenCount         ?? "—", color: "text-red-400"    },
          { label: "System Memory",    value: system  ? `${system.systemMemoryUsedPercent}%` : "—", color: "text-foreground", progress: system?.systemMemoryUsedPercent },
          { label: "Server Uptime",    value: uptime,                               color: "text-green-400"  },
        ].map(card => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-black ${card.color}`}>{card.value}</div>
              {card.progress !== undefined && (
                <Progress value={card.progress} className="mt-2 h-1.5" />
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* DAU line chart + Scrape doughnut */}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Daily Views &amp; Active Users</CardTitle>
              <CardDescription>Watch events aggregated per day</CardDescription>
            </div>
            <Select value={dauDays} onValueChange={setDauDays}>
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {dau.every(d => d.views === 0) ? (
              <div className="flex h-64 items-center justify-center text-center text-sm text-muted-foreground">
                No watch events recorded yet.
                <br />Views will appear here as users stream channels.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={dau}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }}
                    labelFormatter={l => `Date: ${l}`}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="views"       name="Views"        stroke={C.cyan}   strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="uniqueUsers" name="Unique Users"  stroke={C.purple} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Scrape Success Rate</CardTitle>
            <CardDescription>{totalScrape} total scrape runs</CardDescription>
          </CardHeader>
          <CardContent>
            {totalScrape === 0 ? (
              <div className="flex h-48 items-center justify-center text-center text-sm text-muted-foreground">
                No scrape runs recorded yet
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={scrapeSlices}
                      cx="50%" cy="50%"
                      innerRadius={50} outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {scrapeSlices.map((s, i) => <Cell key={i} fill={s.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1.5">
                  {scrapeSlices.map(s => (
                    <div key={s.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                        {s.name}
                      </span>
                      <span className="font-medium">
                        {s.value} ({totalScrape > 0 ? Math.round(s.value / totalScrape * 100) : 0}%)
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* API latency + Top channels */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>API Endpoint Latency</CardTitle>
            <CardDescription>Average response time — top 10 slowest routes</CardDescription>
          </CardHeader>
          <CardContent>
            {apiMetrics.routeStats.length === 0 ? (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                {busy ? "Loading…" : "No API metrics yet — they populate automatically with requests"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={apiMetrics.routeStats} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} unit="ms" />
                  <YAxis type="category" dataKey="route" tickFormatter={shortRoute} tick={{ fontSize: 10 }} width={110} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }}
                    formatter={(v: any) => [`${v} ms`, "Avg latency"]}
                    labelFormatter={l => l}
                  />
                  <Bar dataKey="avgMs" fill={C.cyan} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Top Watched Channels</CardTitle>
            <CardDescription>By total view count (last 500 events)</CardDescription>
          </CardHeader>
          <CardContent>
            {(!summary?.topChannels || summary.topChannels.length === 0) ? (
              <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
                No watch data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={summary.topChannels.slice(0, 7)} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 6 }} />
                  <Bar dataKey="count" fill={C.purple} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* System info strip */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Server Resources</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">CPU Load Average (1 min)</p>
            <p className="text-2xl font-bold">{system?.cpuLoad?.toFixed(2) ?? "—"}</p>
            <Progress value={Math.min((system?.cpuLoad || 0) * 25, 100)} className="mt-2 h-1.5" />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Process Memory (RSS)</p>
            <p className="text-2xl font-bold">{system?.memoryUsedMb ?? "—"} MB</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Last Sampled</p>
            <p className="text-2xl font-bold">
              {system?.timestamp ? new Date(system.timestamp).toLocaleTimeString() : "—"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Filters Tab ──────────────────────────────────────────────────────────────

type FilterItem = { id: string; type: "country" | "category"; label: string; value: string };
type NewFilter  = { label: string; value: string };

function FilterSection({
  type, items, onAdd, onDelete,
}: {
  type: "country" | "category";
  items: FilterItem[];
  onAdd: (f: NewFilter) => void;
  onDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<NewFilter>({ label: "", value: "" });

  const submit = () => {
    if (!draft.label.trim()) return toast.error("Label is required");
    onAdd(draft);
    setDraft({ label: "", value: "" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {type === "country" ? "Countries" : "Categories"}
        </CardTitle>
        <CardDescription>
          {items.length} {type === "country" ? "countries" : "categories"} · these populate channel dropdowns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add row */}
        <div className="flex gap-2">
          <Input
            placeholder="Display label"
            value={draft.label}
            onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && submit()}
            className="flex-1"
          />
          <Input
            placeholder="Value (optional)"
            value={draft.value}
            onChange={e => setDraft(d => ({ ...d, value: e.target.value }))}
            className="w-32"
          />
          <Button onClick={submit} size="icon">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-64 rounded-md border border-white/5 px-1">
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No {type === "country" ? "countries" : "categories"} defined yet
            </p>
          ) : items.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between border-b border-white/5 py-2 last:border-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-xs text-muted-foreground">{item.value}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
                <Trash2 className="h-4 w-4 text-red-400" />
              </Button>
            </div>
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function FiltersTab() {
  const [filters, setFilters] = useState<FilterItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    try {
      const data = await adminAPI.getFilters();
      setFilters(data.data || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load filters");
    }
  };

  useEffect(() => { load(); }, []);

  const seedFromIptv = async () => {
    setSeeding(true);
    try {
      const res = await adminAPI.seedFiltersFromIptv();
      toast.success(`Imported ${res.data?.countries ?? 0} countries + ${res.data?.categories ?? 0} categories from IPTV-org!`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const add = async (type: "country" | "category", form: NewFilter) => {
    setBusy(true);
    try {
      await adminAPI.saveFilter({ type, label: form.label, value: form.value || form.label.toUpperCase().replace(/\s+/g, "_") });
      toast.success(`${type === "country" ? "Country" : "Category"} added`);
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to add");
    } finally {
      setBusy(false);
    }
  };

  const del = async (id: string) => {
    try {
      await adminAPI.deleteFilter(id);
      toast.success("Removed");
      load();
    } catch (e: any) {
      toast.error(e.message || "Failed to remove");
    }
  };

  const countries  = filters.filter(f => f.type === "country");
  const categories = filters.filter(f => f.type === "category");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Manage the country and category options available when creating or editing channels.
          Changes here instantly update the dropdowns throughout the app.
        </p>
        <Button
          onClick={seedFromIptv}
          disabled={seeding}
          variant="outline"
          className="shrink-0 border-cyan-500 text-cyan-400 hover:bg-cyan-500/10"
        >
          {seeding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          {seeding ? "Importing…" : "Import from IPTV-org"}
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <FilterSection type="country"  items={countries}  onAdd={f => add("country",  f)} onDelete={del} />
        <FilterSection type="category" items={categories} onAdd={f => add("category", f)} onDelete={del} />
      </div>
    </div>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

function LogsTab() {
  const [logs,        setLogs]       = useState<any[]>([]);
  const [level,       setLevel]      = useState("all");
  const [scope,       setScope]      = useState("all");
  const [autoRefresh, setAuto]       = useState(false);
  const [busy,        setBusy]       = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    try {
      const data = await adminAPI.getLogs(200);
      setLogs(data.data || []);
    } catch (e: any) {
      toast.error(e.message || "Failed to load logs");
    }
  };

  useEffect(() => {
    setBusy(true);
    load().finally(() => setBusy(false));
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(load, 10_000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh]);

  const scopes   = [...new Set(logs.map(l => l.scope))].sort();
  const filtered = logs.filter(l =>
    (level === "all" || l.level === level) &&
    (scope === "all" || l.scope === scope)
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            System Logs
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="error">Error</SelectItem>
              </SelectContent>
            </Select>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All scopes</SelectItem>
                {scopes.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => setAuto(v => !v)}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${autoRefresh ? "animate-spin" : ""}`} />
              {autoRefresh ? "Live" : "Auto-refresh"}
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={load} disabled={busy}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[520px] rounded-md bg-black/30 p-3 font-mono text-xs">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {busy ? "Loading logs…" : "No entries match the current filter"}
            </p>
          ) : filtered.map(log => (
            <div key={log.id} className="border-b border-white/5 py-1.5 last:border-0">
              <span className="text-muted-foreground">
                {new Date(log.created_at).toLocaleString()}
              </span>
              {" "}
              <span className={`font-bold uppercase ${LOG_COLORS[log.level] ?? "text-foreground"}`}>
                [{log.level}]
              </span>
              {" "}
              <span className="text-purple-300">{log.scope}:</span>
              {" "}
              <span>{log.message}</span>
              {log.details && (
                <pre className="ml-4 mt-0.5 overflow-x-auto text-[10px] text-muted-foreground">
                  {JSON.stringify(log.details, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </ScrollArea>
        <p className="mt-2 text-xs text-muted-foreground">
          Showing {filtered.length} of {logs.length} entries
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function Admin() {
  const navigate = useNavigate();
  const [headerStats, setHeaderStats] = useState<{ channels: number; broken: number } | null>(null);

  useEffect(() => {
    adminAPI.getSummary()
      .then(r => setHeaderStats({ channels: r.data?.channelCount ?? 0, broken: r.data?.brokenCount ?? 0 }))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-20 lg:pb-0">
      <AppHeader title="StreamFlow Admin" />

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        {/* Stats summary chips */}
        {headerStats && (
          <div className="flex gap-3">
            <div className="flex-1 bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1">Channels</p>
              <p className="text-2xl font-black text-white">{headerStats.channels.toLocaleString()}</p>
            </div>
            <div className="flex-1 bg-[#111] border border-[#1e1e1e] rounded-xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-1">Broken</p>
              <p className="text-2xl font-black text-red-400">{headerStats.broken.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="channels" className="space-y-4">
          <TabsList className="grid grid-cols-4 bg-[#111] border border-[#1e1e1e] rounded-xl p-1 h-auto">
            <TabsTrigger value="channels" className="rounded-lg py-2 gap-1.5 text-xs data-[state=active]:bg-[#00D7E5] data-[state=active]:text-black font-bold">
              <Tv className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Channels</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-lg py-2 gap-1.5 text-xs data-[state=active]:bg-[#00D7E5] data-[state=active]:text-black font-bold">
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="filters" className="rounded-lg py-2 gap-1.5 text-xs data-[state=active]:bg-[#00D7E5] data-[state=active]:text-black font-bold">
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filters</span>
            </TabsTrigger>
            <TabsTrigger value="logs" className="rounded-lg py-2 gap-1.5 text-xs data-[state=active]:bg-[#00D7E5] data-[state=active]:text-black font-bold">
              <Terminal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Logs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="channels"><ChannelsTab /></TabsContent>
          <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
          <TabsContent value="filters"><FiltersTab /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
