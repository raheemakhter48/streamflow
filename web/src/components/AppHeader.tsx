import { useState, useEffect } from 'react';
import { Menu, X, Home, Tv, Film, Monitor, Settings, Zap, LogOut, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authAPI } from '@/lib/api';
import { toast } from 'sonner';

interface AppHeaderProps {
  title?: string;
}

const navItems = [
  { icon: Home,     label: 'Home',     path: '/dashboard'              },
  { icon: Tv,       label: 'Live TV',  path: '/dashboard?view=live'   },
  { icon: Film,     label: 'Movies',   path: '/dashboard?view=movie'  },
  { icon: Monitor,  label: 'Series',   path: '/dashboard?view=series' },
  { icon: Zap,      label: 'IPTV Setup', path: '/setup'               },
  { icon: Settings, label: 'Settings', path: '/settings'              },
];

const AppHeader = ({ title = 'StreamFlow' }: AppHeaderProps) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open, setOpen]   = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(localStorage.getItem('guest_name'));

  useEffect(() => {
    authAPI.getCurrentUser()
      .then((d) => {
        if (d.success && d.user) {
          setEmail(d.user.email);
          if (d.user.name) {
            setUserName(d.user.name);
          } else if (d.user.email?.includes('@guest.streamflow')) {
            const stored = localStorage.getItem('guest_name');
            setUserName(stored || 'Guest');
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleNav = (path: string) => {
    setOpen(false);
    const isGuest = email?.includes('@guest.streamflow') || !!localStorage.getItem('guest_name');
    if (path === '/setup' && isGuest) {
      toast.error('Account login or registration required for IPTV Setup');
      navigate('/auth');
      return;
    }
    navigate(path);
  };

  const handleLogout = async () => {
    setOpen(false);
    await authAPI.logout();
    navigate('/auth');
  };

  const isActive = (path: string) => {
    if (path === '/settings') return location.pathname === '/settings';
    if (path === '/setup') return location.pathname === '/setup';
    if (path === '/dashboard') return location.pathname === '/dashboard' && !new URLSearchParams(location.search).get('view');

    const [pathname, query = ""] = path.split('?');
    if (location.pathname !== pathname) return false;
    const expectedView = new URLSearchParams(query).get('view');
    return expectedView ? new URLSearchParams(location.search).get('view') === expectedView : false;
  };

  return (
    <>
      {/* Apple TV+ Header */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-white/10 bg-[#000000]/90 px-4 sm:px-8 backdrop-blur-2xl transition-colors">
        {/* Left Side: Mobile Hamburger Menu Button + Logo */}
        <div className="flex items-center gap-3 md:gap-6">
          <button
            onClick={() => setOpen(true)}
            className="md:hidden flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
            aria-label="Open left menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2.5 group"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black font-black text-sm shadow-md transition-transform group-hover:scale-105">
              
            </div>
            <div className="flex flex-col text-left">
              <span className="text-base font-black tracking-tight text-white leading-none">
                {title}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50">
                tv+
              </span>
            </div>
          </button>

          {/* Desktop Horizontal Navigation Bar */}
          <nav className="hidden md:flex items-center gap-1.5">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <button
                  key={item.label}
                  onClick={() => handleNav(item.path)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${
                    active
                      ? 'bg-white text-black shadow-lg scale-105'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Right Side: Account / Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-bold text-white transition-all hover:bg-white/20"
          >
            <User className="h-3.5 w-3.5 text-white/80" />
            <span className="max-w-[100px] sm:max-w-[140px] truncate">{userName || (email ? email.split('@')[0] : 'Account')}</span>
          </button>

          <button
            onClick={handleLogout}
            className="hidden sm:flex items-center gap-1.5 rounded-full bg-red-500/15 border border-red-500/20 px-3.5 py-1.5 text-xs font-bold text-red-300 transition-all hover:bg-red-500/25"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </header>

      {/* Mobile Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile Left Drawer Sidebar (with Close / Cross button) */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-80 max-w-[85vw] bg-[#0C0D12] border-r border-white/15 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header with Close Cross Button */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-black font-black text-sm">
              
            </div>
            <div className="flex flex-col text-left">
              <span className="text-white font-black text-base tracking-tight leading-none">StreamFlow</span>
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/50 mt-0.5">Navigation Menu</span>
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-full border border-white/15 bg-white/10 text-white hover:bg-white/20 active:scale-95 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Account Info Pill */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="w-10 h-10 rounded-full bg-white/10 border border-white/15 flex items-center justify-center shrink-0 text-white">
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white font-extrabold text-sm truncate">
              {userName || (email ? email.split('@')[0] : 'Guest User')}
            </p>
            <p className="text-white/50 text-xs truncate">{email || 'Active Streaming Session'}</p>
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-2">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.label}
                onClick={() => handleNav(item.path)}
                className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-full transition-all text-left text-sm font-bold ${
                  active
                    ? 'bg-white text-black shadow-lg'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Footer Logout Button */}
        <div className="p-5 border-t border-white/10 bg-black/40">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-full bg-red-500/15 border border-red-500/25 text-red-300 hover:bg-red-500/25 active:scale-95 transition-colors font-bold text-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
};

export default AppHeader;
