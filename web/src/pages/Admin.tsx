import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ADMIN_SESSION_KEY } from "@/pages/AdminLogin";
import { adminAPI } from "@/lib/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3, Filter, LockKeyhole, LogOut, Menu, Terminal, Tv, Users, X } from "lucide-react";

import ChannelsTab from "./admin/ChannelsTab";
import UsersTab from "./admin/UsersTab";
import AnalyticsTab from "./admin/AnalyticsTab";
import FiltersTab from "./admin/FiltersTab";
import LogsTab from "./admin/LogsTab";

const NAV_ITEMS = [
  { id: "channels",  icon: Tv,        label: "Channels"  },
  { id: "users",     icon: Users,     label: "Users"     },
  { id: "analytics", icon: BarChart3, label: "Analytics" },
  { id: "filters",   icon: Filter,    label: "Filters"   },
  { id: "logs",      icon: Terminal,  label: "Logs"      },
];

export default function Admin() {
  const navigate = useNavigate();
  const [headerStats, setHeaderStats] = useState<{ channels: number; broken: number } | null>(null);
  const [activeTab, setActiveTab] = useState("channels");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(ADMIN_SESSION_KEY)) {
      navigate("/admin-login", { replace: true });
      return;
    }

    adminAPI.getSummary()
      .then(r => setHeaderStats({ channels: r.data?.channelCount ?? 0, broken: r.data?.brokenCount ?? 0 }))
      .catch((error) => {
        if (error.message?.includes("Admin access") || error.message?.includes("authorized")) {
          localStorage.removeItem(ADMIN_SESSION_KEY);
          navigate("/admin-login", { replace: true });
        }
      });
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    navigate("/admin-login", { replace: true });
  };

  return (
    <div className="enterprise-bg min-h-screen text-white flex flex-col">
      {/* Mobile Top Navigation Bar (< lg screens) */}
      <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center justify-between border-b border-[#1F2937]/80 bg-[#0B1115]/95 px-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 active:scale-95 transition-all"
            aria-label="Open Admin Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00CFE8] text-black font-black text-xs">
              <LockKeyhole className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-extrabold text-white leading-none">StreamFlow Admin</p>
              <p className="text-[9px] font-bold text-[#00CFE8] uppercase tracking-wider mt-0.5">Control Panel</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/25 bg-red-500/10 text-xs font-bold text-red-300 hover:bg-red-500/20 active:scale-95 transition-all"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Exit</span>
        </button>
      </header>

      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Responsive Sidebar (Slide-over on mobile, Fixed left column on lg+) */}
      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-64 flex-col border-r border-[#1F2937]/85 bg-[#0B1115] shadow-2xl backdrop-blur-2xl transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0 flex" : "-translate-x-full lg:flex"
        }`}
      >
        {/* Sidebar Header */}
        <div className="flex h-16 items-center justify-between border-b border-[#1F2937]/70 px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00CFE8] text-black shadow-md">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-extrabold leading-none text-white">StreamFlow Admin</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00CFE8]/80">Isolated Console</p>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
            aria-label="Close Sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="flex-1 space-y-1.5 px-3 py-5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all text-left ${
                  isActive
                    ? "bg-[#00CFE8]/15 text-[#00CFE8] border border-[#00CFE8]/30 shadow-md shadow-[#00CFE8]/10"
                    : "text-gray-400 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <item.icon className={`h-4 w-4 ${isActive ? "text-[#00CFE8]" : "text-gray-400"}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="border-t border-[#1F2937]/70 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs font-bold text-red-300 transition-colors hover:bg-red-500/20 active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            <span>Lock Console</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area (Offset by lg:pl-64 so it NEVER overlaps with the sidebar!) */}
      <main className="flex-1 lg:pl-64 transition-all duration-300 w-full min-w-0">
        <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
          {/* Header Banner */}
          <div className="flex flex-col gap-3 rounded-3xl border border-[#1F2937] bg-[#0D1117]/80 p-5 sm:flex-row sm:items-center sm:justify-between shadow-lg backdrop-blur-xl">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00CFE8]">Operator Console</p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl text-white">Admin Management</h1>
              <p className="mt-1 text-xs sm:text-sm text-gray-400">Separate admin workspace for streams, users, analytics, and logs.</p>
            </div>
            <button
              onClick={handleLogout}
              className="self-start sm:self-auto rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-xs sm:text-sm font-bold text-red-300 transition-colors hover:bg-red-500/20 active:scale-95"
            >
              Lock Admin
            </button>
          </div>

          {/* Stats summary chips */}
          {headerStats && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="enterprise-card rounded-2xl p-4 bg-[#12161F]/80 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Channels</p>
                <p className="text-xl sm:text-2xl font-black text-white">{headerStats.channels.toLocaleString()}</p>
              </div>
              <div className="enterprise-card rounded-2xl p-4 bg-[#12161F]/80 border border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Broken</p>
                <p className="text-xl sm:text-2xl font-black text-red-400">{headerStats.broken.toLocaleString()}</p>
              </div>
              <div className="enterprise-card rounded-2xl p-4 bg-[#12161F]/80 border border-white/5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Mode</p>
                <p className="text-xl sm:text-2xl font-black text-[#00CFE8]">Admin</p>
              </div>
              <div className="enterprise-card rounded-2xl p-4 bg-[#12161F]/80 border border-white/5">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Access</p>
                <p className="text-xl sm:text-2xl font-black text-emerald-400">Locked</p>
              </div>
            </div>
          )}

          {/* Tab Navigation & Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            {/* Scrollable Horizontal Tabs List */}
            <div className="overflow-x-auto scrollbar-none pb-1">
              <TabsList className="flex h-auto w-max min-w-full justify-start rounded-2xl border border-[#1F2937] bg-[#0D1117] p-1.5 sm:grid sm:grid-cols-5">
                <TabsTrigger value="channels" className="rounded-xl px-4 py-2 gap-1.5 text-xs data-[state=active]:bg-[#00D7E5] data-[state=active]:text-black font-bold transition-all">
                  <Tv className="h-3.5 w-3.5" />
                  <span>Channels</span>
                </TabsTrigger>
                <TabsTrigger value="users" className="rounded-xl px-4 py-2 gap-1.5 text-xs data-[state=active]:bg-[#00D7E5] data-[state=active]:text-black font-bold transition-all">
                  <Users className="h-3.5 w-3.5" />
                  <span>Users</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="rounded-xl px-4 py-2 gap-1.5 text-xs data-[state=active]:bg-[#00D7E5] data-[state=active]:text-black font-bold transition-all">
                  <BarChart3 className="h-3.5 w-3.5" />
                  <span>Analytics</span>
                </TabsTrigger>
                <TabsTrigger value="filters" className="rounded-xl px-4 py-2 gap-1.5 text-xs data-[state=active]:bg-[#00D7E5] data-[state=active]:text-black font-bold transition-all">
                  <Filter className="h-3.5 w-3.5" />
                  <span>Filters</span>
                </TabsTrigger>
                <TabsTrigger value="logs" className="rounded-xl px-4 py-2 gap-1.5 text-xs data-[state=active]:bg-[#00D7E5] data-[state=active]:text-black font-bold transition-all">
                  <Terminal className="h-3.5 w-3.5" />
                  <span>Logs</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="channels" className="focus-visible:outline-none min-w-0"><ChannelsTab /></TabsContent>
            <TabsContent value="users" className="focus-visible:outline-none min-w-0"><UsersTab /></TabsContent>
            <TabsContent value="analytics" className="focus-visible:outline-none min-w-0"><AnalyticsTab /></TabsContent>
            <TabsContent value="filters" className="focus-visible:outline-none min-w-0"><FiltersTab /></TabsContent>
            <TabsContent value="logs" className="focus-visible:outline-none min-w-0"><LogsTab /></TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
