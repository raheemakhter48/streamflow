import { useEffect, useState } from "react";
import { toast } from "sonner";
import { adminAPI } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Clock, Loader2, LogOut, RefreshCw, Star, User, UserCheck, Users } from "lucide-react";

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = async () => {
    setBusy(true);
    try {
      const res = await adminAPI.getUsers();
      if (res.success) {
        setUsers(res.data || []);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load users");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filteredUsers = users.filter((u) =>
    (u.displayName || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const registeredCount = users.filter((u) => !u.isGuest).length;
  const guestCount = users.filter((u) => u.isGuest).length;

  return (
    <div className="space-y-4">
      {/* Overview Cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="enterprise-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Total Users</p>
          <p className="text-2xl font-black text-white">{users.length}</p>
        </div>
        <div className="enterprise-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Registered Accounts</p>
          <p className="text-2xl font-black text-[#00CFE8]">{registeredCount}</p>
        </div>
        <div className="enterprise-card rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Guest Logins</p>
          <p className="text-2xl font-black text-amber-400">{guestCount}</p>
        </div>
      </div>

      {/* Header + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 border-[#1F2937] bg-[#07090B] text-xs text-white placeholder-gray-600 focus:border-[#00CFE8]"
          />
        </div>
        <Button
          onClick={load}
          variant="outline"
          size="sm"
          className="h-10 gap-2 border-[#1F2937] bg-[#07090B] text-xs font-bold text-gray-300 hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
          Refresh Users
        </Button>
      </div>

      {/* Table */}
      <Card className="border-[#1F2937] bg-[#0D1117]">
        <CardHeader className="p-4 border-b border-[#1F2937]">
          <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-[#00CFE8]" />
            Registered &amp; Guest Users ({filteredUsers.length})
          </CardTitle>
          <CardDescription className="text-xs text-gray-500">
            View user profiles, configured IPTV credentials, saved favorites, and streaming history.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#07090B] border-b border-[#1F2937]">
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500">User / Email</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Account Type</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Favorites</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Watch History</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500">IPTV Provider</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Joined</TableHead>
                <TableHead className="text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {busy && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-xs text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-[#00CFE8]" />
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-xs text-gray-500">
                    No users found in database.
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((u) => {
                  const isExpanded = expandedUserId === u.id;
                  return (
                    <tbody key={u.id} className="border-b border-[#1F2937]/50">
                      <TableRow className="hover:bg-[#111827]/60">
                        <TableCell className="font-bold text-xs text-white">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${
                              u.isGuest ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-[#00CFE8]/10 text-[#00CFE8] border border-[#00CFE8]/20'
                            }`}>
                              {u.isGuest ? <UserCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                            </div>
                            <div>
                              <p className="text-white text-xs font-bold">{u.displayName}</p>
                              <p className="text-[10px] text-gray-500 font-mono">{u.email}</p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge variant="outline" className={u.isGuest ? 'border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px]' : 'border-[#00CFE8]/30 bg-[#00CFE8]/10 text-[#00CFE8] text-[10px]'}>
                            {u.isGuest ? 'Guest' : 'Registered'}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-xs text-gray-300">
                          <span className="font-bold text-white">{u.favoritesCount}</span> channels
                        </TableCell>

                        <TableCell className="text-xs text-gray-300">
                          <span className="font-bold text-white">{u.recentlyWatchedCount}</span> watched
                        </TableCell>

                        <TableCell className="text-xs text-gray-400">
                          {u.credentialsProvider ? (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
                              {u.credentialsProvider}
                            </Badge>
                          ) : (
                            <span className="text-gray-600 text-[10px]">None</span>
                          )}
                        </TableCell>

                        <TableCell className="text-[10px] text-gray-500 font-mono">
                          {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setExpandedUserId(isExpanded ? null : u.id)}
                            className="h-8 px-2 text-xs text-[#00CFE8] hover:bg-[#00CFE8]/10"
                          >
                            {isExpanded ? 'Hide' : 'View Activity'}
                          </Button>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Activity Row */}
                      {isExpanded && (
                        <TableRow className="bg-[#07090B] border-b border-[#1F2937]">
                          <TableCell colSpan={7} className="p-4">
                            <div className="grid sm:grid-cols-2 gap-4">
                              {/* Favorites List */}
                              <div className="rounded-xl border border-[#1F2937] p-3 bg-[#0D1117]">
                                <p className="text-xs font-bold text-[#00CFE8] mb-2 flex items-center gap-1.5">
                                  <Star className="w-3.5 h-3.5" />
                                  Saved Favorites ({u.favorites?.length || 0})
                                </p>
                                {u.favorites && u.favorites.length > 0 ? (
                                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {u.favorites.map((fav: any, i: number) => (
                                      <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-[#111827]">
                                        <span className="text-white font-medium truncate">{fav.channel_name}</span>
                                        <span className="text-[10px] text-gray-500">{fav.category || 'Live'}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-600">No favorites added yet.</p>
                                )}
                              </div>

                              {/* Watch History */}
                              <div className="rounded-xl border border-[#1F2937] p-3 bg-[#0D1117]">
                                <p className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5" />
                                  Recent Stream History ({u.recentlyWatched?.length || 0})
                                </p>
                                {u.recentlyWatched && u.recentlyWatched.length > 0 ? (
                                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                    {u.recentlyWatched.map((w: any, i: number) => (
                                      <div key={i} className="flex items-center justify-between text-xs p-1.5 rounded bg-[#111827]">
                                        <span className="text-white font-medium truncate">{w.channel_name}</span>
                                        <span className="text-[10px] text-gray-500">{w.watched_at || w.created_at ? new Date(w.watched_at || w.created_at).toLocaleTimeString() : 'Recent'}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-xs text-gray-600">No stream history logged yet.</p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </tbody>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default UsersTab;
