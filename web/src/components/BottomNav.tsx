import { Home, Tv, Film, Monitor, Settings, Radio, Heart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const tabs = [
  { label: 'Home',      icon: Home,     path: '/dashboard',                view: 'home'      },
  { label: 'Live TV',   icon: Tv,       path: '/dashboard?view=live',      view: 'live'      },
  { label: 'Favorites', icon: Heart,    path: '/dashboard?view=favorites', view: 'favorites' },
  { label: 'Streams',   icon: Radio,    path: '/dashboard?view=streams',   view: 'streams'   },
  { label: 'Movies',    icon: Film,     path: '/dashboard?view=movie',     view: 'movie'     },
  { label: 'Settings',  icon: Settings, path: '/settings',                 view: null        },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentView = new URLSearchParams(location.search).get('view') || 'home';

  const isActive = (tab: typeof tabs[0]) => {
    if (tab.path === '/settings') return location.pathname === '/settings';
    if (location.pathname === '/')          return tab.view === 'home';
    if (location.pathname !== '/dashboard') return false;
    return currentView === tab.view;
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around bg-[#0f0f0f] border-t border-[#1f1f1f] h-16 px-1">
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <button
            key={tab.label}
            onClick={() => navigate(tab.path)}
            className={`flex flex-col items-center justify-center gap-0.5 w-14 h-full transition-colors ${
              active ? 'text-[#00D7E5]' : 'text-[#555] hover:text-[#888]'
            }`}
          >
            <div className="relative">
              <tab.icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.8} />
              {tab.label === 'Streams' && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                </span>
              )}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wide">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNav;
