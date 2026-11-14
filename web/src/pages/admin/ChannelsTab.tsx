import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { adminAPI, iptvAPI } from "@/lib/api";
import { getCountryDisplayName } from "@/lib/dashboardUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Activity, Filter, Loader2, Play, Plus, RefreshCw, Save, Trash2, Tv, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EMPTY_CHANNEL } from "./adminConstants";
import { StreamSourceEditor } from "@/components/admin/StreamSourceEditor";

function ChannelsTab() {
  const [channels, setChannels]     = useState<any[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(1);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatus]   = useState("all");
  const [countries, setCountries]   = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [regions, setRegions]       = useState<any[]>([]);
  const [formRegion, setFormRegion] = useState<string>("All");
  const [form, setForm]             = useState<any>(EMPTY_CHANNEL);
  const [editingId, setEditingId]   = useState<string | undefined>();
  const [showForm, setShowForm]     = useState(false);
  const [busy, setBusy]             = useState(false);

  const allRegionCountries = useMemo(() => {
    const codeSet = new Set<string>();
    regions.forEach((r) => {
      (r.countries || []).forEach((c: string) => codeSet.add(c.toUpperCase()));
    });
    // Also include any custom country codes from admin filters
    countries.forEach((c: any) => {
      const code = String(c.value || c.label || "").trim().toUpperCase();
      if (code) codeSet.add(code);
    });

    return Array.from(codeSet).map((rawCode) => {
      const fullName = getCountryDisplayName(rawCode);
      return {
        code: rawCode,
        name: fullName || rawCode,
        label: fullName && fullName !== rawCode ? `${fullName} (${rawCode})` : rawCode
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [regions, countries]);

  const availableCountriesForForm = useMemo(() => {
    if (!formRegion || formRegion === "All") {
      return allRegionCountries;
    }
    const reg = regions.find((r) => r.code === formRegion);
    const allowedCodes = new Set((reg?.countries || []).map((c: string) => c.toUpperCase()));
    return allRegionCountries.filter((c) => allowedCodes.has(c.code));
  }, [formRegion, regions, allRegionCountries]);

  const load = async () => {
    setBusy(true);
    try {
      const [ch, fi, regRes] = await Promise.all([
        adminAPI.getChannels({
          page,
          limit: 50,
          search: search || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
        }),
        adminAPI.getFilters(),
        iptvAPI.getRegions().catch(() => ({ data: [] })),
      ]);
      setChannels(ch.data || []);
      setTotal(ch.total || 0);
      const f = fi.data || [];
      setCountries(f.filter((x: any) => x.type === "country"));
      setCategories(f.filter((x: any) => x.type === "category"));
      if (regRes?.data) {
        setRegions(regRes.data);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load channels");
    } finally {
      setBusy(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [page, statusFilter]);

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const handleFormRegionChange = (newRegion: string) => {
    setFormRegion(newRegion);
    if (newRegion !== "All") {
      const reg = regions.find((r) => r.code === newRegion);
      const allowedCodes = new Set((reg?.countries || []).map((c: string) => c.toUpperCase()));
      if (form.country && !allowedCodes.has(form.country.toUpperCase())) {
        set("country", "");
      }
    }
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Channel name is required");
    if (form.isManualOverride && !form.streamUrl && !form.iframeEmbed)
      return toast.error("Manual override requires a stream URL or iframe embed");

    let sUrl = (form.streamUrl || "").trim();
    let iEmbed = (form.iframeEmbed || "").trim();

    // Auto-detect iframe pasted in stream URL
    if (sUrl.includes("<iframe")) {
      if (!iEmbed) iEmbed = sUrl;
      const match = sUrl.match(/src=["']([^"']+)["']/i);
      if (match && match[1]) {
        sUrl = match[1].replace(/&amp;/g, "&");
      }
    }

    try {
      await adminAPI.saveChannel({
        ...form,
        streamUrl: sUrl,
        iframeEmbed: iEmbed,
        country: form.country ? form.country.toUpperCase() : "",
      }, editingId);
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
    const rawCountry = (ch.country || "").trim().toUpperCase();
    const matched = allRegionCountries.find(
      (c) => c.code.toLowerCase() === rawCountry.toLowerCase() || c.name.toLowerCase() === rawCountry.toLowerCase()
    );
    const countryCode = matched ? matched.code : rawCountry;

    // Detect region for this country
    let detectedRegion = "All";
    if (countryCode && regions.length > 0) {
      const foundReg = regions.find((r) => Array.isArray(r.countries) && r.countries.some((c: string) => c.toUpperCase() === countryCode));
      if (foundReg) {
        detectedRegion = foundReg.code;
      }
    }
    setFormRegion(detectedRegion);

    setForm({
      name: ch.name || "", slug: ch.slug || "", logoUrl: ch.logo_url || "",
      country: countryCode, category: ch.category || "",
      streamUrl: ch.stream_url || "", iframeEmbed: ch.iframe_embed || "",
      status: ch.status || "working",
      isManualOverride: ch.source_type === "iptv" ? false : (ch.is_manual_override ?? true),
      scrapeSourceUrl: ch.scrape_source_url || "",
      scraperType: ch.scraper_type || "generic",
    });
    setShowForm(true);
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
        <Button onClick={() => { setForm(EMPTY_CHANNEL); setFormRegion("All"); setEditingId(undefined); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Channel
        </Button>
        <Button variant="secondary" onClick={scrapeBulk} disabled={busy}>
          <Zap className="mr-2 h-4 w-4" />
          Bulk Scrape
        </Button>
      </div>

      <div>
        {/* Table */}
        <Card className="border-[#1F2937] bg-[#0D1117] overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
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

      </div>

      {/* Create / Edit Channel Modal Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0D1117] border-[#1F2937] text-white p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <span className="p-1 rounded-md bg-cyan-500/20 text-cyan-400">
                {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </span>
              {editingId ? "Edit Channel" : "New Channel"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingId ? "Update channel metadata, stream source, and audio tracks" : "Add a new managed channel"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <Input placeholder="Channel name *" value={form.name} onChange={e => set("name", e.target.value)} />
            <Input placeholder="Slug (auto if empty)" value={form.slug} onChange={e => set("slug", e.target.value)} />
            <Input placeholder="Logo / thumbnail URL" value={form.logoUrl} onChange={e => set("logoUrl", e.target.value)} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Region</label>
                <Select value={formRegion} onValueChange={handleFormRegionChange}>
                  <SelectTrigger className="w-full bg-[#161B22] border-white/10 text-xs">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 bg-[#161B22] border-white/10 text-white">
                    <SelectItem value="All">Global 🌐</SelectItem>
                    {regions.map((r) => (
                      <SelectItem key={r.code} value={r.code}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Country</label>
                <Select
                  value={
                    availableCountriesForForm.find(
                      (c) =>
                        c.code.toLowerCase() === (form.country || "").toLowerCase() ||
                        c.name.toLowerCase() === (form.country || "").toLowerCase()
                    )?.code || (form.country ? form.country : "none")
                  }
                  onValueChange={(v) => set("country", v === "none" ? "" : v)}
                >
                  <SelectTrigger className="w-full bg-[#161B22] border-white/10 text-xs">
                    <SelectValue placeholder="Country" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 bg-[#161B22] border-white/10 text-white">
                    <SelectItem value="none">None / Any</SelectItem>
                    {availableCountriesForForm.map((c) => (
                      <SelectItem key={c.id || c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Category</label>
                <Select value={form.category || "none"} onValueChange={(v) => set("category", v === "none" ? "" : v)}>
                  <SelectTrigger className="w-full bg-[#161B22] border-white/10 text-xs">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72 bg-[#161B22] border-white/10 text-white">
                    <SelectItem value="none">None / Any</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id || c.value} value={c.value}>
                        {c.label || c.value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <StreamSourceEditor
              streamUrl={form.streamUrl}
              onChangeStreamUrl={v => set("streamUrl", v)}
            />
            <Textarea
              placeholder="Iframe embed code (overrides stream URL when set)"
              value={form.iframeEmbed}
              onChange={e => set("iframeEmbed", e.target.value)}
              rows={2}
              className="text-xs font-mono"
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

            {/* Sticky Actions Footer */}
            <div className="sticky bottom-0 bg-[#0D1117]/95 backdrop-blur-md pt-3 pb-1 border-t border-[#1F2937] flex items-center gap-2 mt-4 z-20">
              <Button className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold h-10 shadow-lg shadow-cyan-500/20" onClick={save}>
                {editingId ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                {editingId ? "Save Changes" : "Create Channel"}
              </Button>
              {(form.streamUrl || form.iframeEmbed) && (
                <Button
                  type="button"
                  variant="secondary"
                  className="h-10 text-xs gap-1.5"
                  onClick={() => {
                    const rawEmbed = (form.iframeEmbed || "").trim();
                    const extracted = rawEmbed.match(/src=["']([^"']+)["']/i)?.[1] || rawEmbed;
                    const testUrl = extracted || form.streamUrl;
                    const params = new URLSearchParams({
                      name: form.name || "Test Stream",
                      url: testUrl,
                    });
                    if (rawEmbed) {
                      params.set("type", "embed");
                    }
                    window.open(`/player?${params.toString()}`, "_blank");
                  }}
                  title="Test stream in new tab"
                >
                  <Play className="h-3.5 w-3.5 fill-current text-cyan-400" />
                  Test Stream
                </Button>
              )}
              <Button variant="outline" className="h-10 border-white/20" onClick={cancel}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

export default ChannelsTab;
