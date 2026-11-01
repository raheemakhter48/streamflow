import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminAPI } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Download, Filter, Loader2, Plus, Trash2 } from "lucide-react";

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

export default FiltersTab;
