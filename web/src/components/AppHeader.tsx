import { useState, useEffect } from 'react';
import { Menu, X, Home, Tv, Film, Monitor, Settings, Zap, LogOut, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '@/lib/api';

interface AppHeaderProps {
  title?: string;
}

const navItems = [
  { icon: Home,     label: 'Home',     path: '/dashboard'              },
  { icon: Tv,       label: 'Live TV',  path: '/dashboard?view=live'   },
  { icon: Film,     label: 'Movies',   path: '/dashboard?view=movie'  },
  { icon: Monitor,  label: 'Series',   path: '/dashboard?view=series' },
  { icon: Settings, label: 'Settings', path: '/settings'              },
];

const quickItems = [
  { icon: Zap,    label: 'IPTV Setup', path: '/setup'  },
];

const AppHeader = ({ title = 'StreamFlow' }: AppHeaderProps) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen]   = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    authAPI.getCurrentUser()
      .then((d) => { if (d.success && d.user) setEmail(d.user.email); })
      .catch(() => {});
  }, []);

  const handleNav = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    setOpen(false);
    await authAPI.logout();
    navigate('/auth');
  };

  const isActive = (path: string) => {
    if (path === '/settings') return location.pathname === '/settings';
    if (path === '/dashboard') return location.pathname === '/dashboard' && !new URLSearchParams(location.search).get('view');

    const [pathname, query = ""] = path.split('?');
    if (location.pathname !== pathname) return false;
    const expectedView = new URLSearchParams(query).get('view');
    return expectedView ? new URLSearchParams(location.search).get('view') === expectedView : false;
  };

  return (
    <>
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[#1F2937]/80 bg-[#07090B]/92 px-4 py-3 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-1.5 text-gray-500 transition-colors hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-lg font-extrabold tracking-tight text-[#00CFE8]">{title}</span>
        </div>
        <button
          onClick={() => navigate('/settings')}
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-[#1F2937] bg-[#111827]"
          aria-label="Profile"
        >
          <img
            src="/logo.png"
            alt="avatar"
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-[#1F2937]/85 bg-[#0B1115]/95 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center gap-3 border-b border-[#1F2937]/70 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00CFE8] text-black shadow-[0_0_30px_rgba(0,207,232,0.18)]">
            <img src="/logo.png" alt="" className="h-6 w-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div>
            <p className="text-sm font-extrabold leading-none text-white">StreamFlow</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00CFE8]/80">Enterprise Console</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-5">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.label}
                onClick={() => handleNav(item.path)}
                className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                  active
                    ? 'bg-[#00CFE8]/12 text-[#00CFE8] ring-1 ring-[#00CFE8]/16'
                    : 'text-gray-400 hover:bg-[#111827] hover:text-white'
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
                <span>{item.label}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00CFE8]" />}
              </button>
            );
          })}

          <div className="pt-5">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-600">Workspace</p>
            {quickItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNav(item.path)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-gray-400 transition-colors hover:bg-[#111827] hover:text-white"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="border-t border-[#1F2937]/70 p-4">
          <button
            onClick={() => navigate('/settings')}
            className="mb-3 flex w-full items-center gap-3 rounded-xl border border-[#1F2937] bg-[#0D1117] p-3 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#111827] text-[#00CFE8]">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{email ? email.split('@')[0] : 'Account'}</p>
              <p className="truncate text-xs text-gray-500">{email || 'Secure session'}</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/8 px-3 py-2.5 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/15"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Sidebar drawer */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 bg-[#0d0d0d] border-r border-[#1e1e1e] flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e1e]">
          <span className="text-[#00D7E5] font-bold text-lg">StreamFlow</span>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 rounded-lg text-gray-600 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User info */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1e1e1e]">
          <div className="w-10 h-10 rounded-full bg-[#1a1a2e] border border-[#2a2a3e] flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-[#00D7E5]" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">
              {email ? email.split('@')[0] : 'Guest'}
            </p>
            <p className="text-gray-600 text-xs truncate">{email || 'Not signed in'}</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 px-3 mb-2 mt-1">Navigation</p>
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.label}
                onClick={() => handleNav(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-colors text-left ${
                  active
                    ? 'bg-[#00D7E5]/10 text-[#00D7E5] border border-[#00D7E5]/20'
                    : 'text-gray-400 hover:bg-[#151515] hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 1.8} />
                <span className="font-semibold text-sm">{item.label}</span>
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#00D7E5]" />}
              </button>
            );
          })}

          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-700 px-3 mb-2 mt-4">Quick Access</p>
          {quickItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNav(item.path)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-gray-400 hover:bg-[#151515] hover:text-white transition-colors text-left"
            >
              <item.icon className="w-5 h-5 shrink-0" strokeWidth={1.8} />
              <span className="font-semibold text-sm">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e1e1e] space-y-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="font-bold text-sm">Logout</span>
          </button>
          <p className="text-center text-[10px] text-gray-700 font-bold uppercase tracking-widest">
            StreamFlow v2.4.12
          </p>
        </div>
      </aside>
    </>
  );
};

export default AppHeader;
