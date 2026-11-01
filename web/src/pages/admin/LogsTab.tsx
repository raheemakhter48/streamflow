import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { adminAPI } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, Terminal } from "lucide-react";
import { LOG_COLORS } from "./adminConstants";

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

export default LogsTab;
