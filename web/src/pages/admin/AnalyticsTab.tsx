import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminAPI } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, BarChart3, Download, Loader2, RefreshCw, Zap } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { C, fmtDate, shortRoute } from "./adminConstants";

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

export default AnalyticsTab;
