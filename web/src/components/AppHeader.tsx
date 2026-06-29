import { Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AppHeaderProps {
  title?: string;
}

const AppHeader = ({ title = 'StreamFlow' }: AppHeaderProps) => {
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-[#0A0A0A] sticky top-0 z-40 border-b border-[#111]">
      <button
        className="p-1.5 rounded-lg text-gray-500 hover:text-white transition-colors"
        aria-label="Menu"
      >
        <Menu className="w-6 h-6" />
      </button>

      <span className="text-[#00D7E5] font-bold text-xl tracking-tight">{title}</span>

      <button
        onClick={() => navigate('/settings')}
        className="w-9 h-9 rounded-full bg-[#1a1a2e] border border-[#2a2a3e] overflow-hidden flex items-center justify-center text-xs text-gray-400 font-bold"
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
  );
};

export default AppHeader;
