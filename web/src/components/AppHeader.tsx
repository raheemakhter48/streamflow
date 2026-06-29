import { useState, useEffect } from 'react';
import { Menu, X, Home, Tv, Film, Monitor, Settings, Zap, Shield, LogOut, User } from 'lucide-react';
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
  { icon: Shield, label: 'Admin',      path: '/admin'  },
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
    if (path === '/dashboard') return location.pathname === '/dashboard' && !location.search.includes('view=');
    return location.pathname + location.search === path || location.search.includes(path.split('?')[1] || '__');
  };

  return (
    <>
      {/* Header bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#0A0A0A] sticky top-0 z-40 border-b border-[#111]">
        {/* Left: hamburger (mobile) + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:text-white transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
          <span className="text-[#00D7E5] font-bold text-xl tracking-tight">{title}</span>
        </div>

        {/* Center: desktop nav links */}
        <nav className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.label}
                onClick={() => handleNav(item.path)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'bg-[#00D7E5]/10 text-[#00D7E5]' : 'text-gray-400 hover:text-white hover:bg-[#151515]'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right: avatar */}
        <button
          onClick={() => navigate('/settings')}
          className="w-9 h-9 rounded-full bg-[#1a1a2e] border border-[#2a2a3e] overflow-hidden flex items-center justify-center"
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
