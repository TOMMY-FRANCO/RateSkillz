import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Trophy, ShoppingBag, Swords, MessageCircle, Settings } from 'lucide-react';

export default function FloatingNav() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-space/90 backdrop-blur-md border-2 border-neon-cyan/50 rounded-full px-4 py-3 shadow-neon-cyan">
      <div className="flex items-center gap-2">
        <Link
          to="/dashboard"
          className={`p-3 rounded-full transition-all duration-300 ${
            isActive('/dashboard')
              ? 'bg-neon-cyan/20 text-neon-cyan shadow-neon-cyan'
              : 'text-white/60 hover:text-neon-cyan hover:bg-neon-cyan/10'
          }`}
          title="Home"
        >
          <Home size={20} />
        </Link>
        <Link
          to="/friends"
          className={`p-3 rounded-full transition-all duration-300 ${
            isActive('/friends')
              ? 'bg-neon-cyan/20 text-neon-cyan shadow-neon-cyan'
              : 'text-white/60 hover:text-neon-cyan hover:bg-neon-cyan/10'
          }`}
          title="Friends"
        >
          <Users size={20} />
        </Link>
        <Link
          to="/trading"
          className={`p-3 rounded-full transition-all duration-300 ${
            isActive('/trading')
              ? 'bg-neon-cyan/20 text-neon-cyan shadow-neon-cyan'
              : 'text-white/60 hover:text-neon-cyan hover:bg-neon-cyan/10'
          }`}
          title="Trading"
        >
          <ShoppingBag size={20} />
        </Link>
        <Link
          to="/battle-mode"
          className={`p-3 rounded-full transition-all duration-300 border-2 ${
            location.pathname === '/battle-mode'
              ? 'bg-neon-green/20 text-neon-green border-neon-green shadow-neon-green'
              : 'text-neon-green border-neon-green/50 hover:bg-neon-green/10 hover:border-neon-green shadow-neon-green'
          }`}
          title="Battle Mode"
        >
          <Swords size={20} />
        </Link>
        <Link
          to="/leaderboard"
          className={`p-3 rounded-full transition-all duration-300 ${
            isActive('/leaderboard')
              ? 'bg-neon-cyan/20 text-neon-cyan shadow-neon-cyan'
              : 'text-white/60 hover:text-neon-cyan hover:bg-neon-cyan/10'
          }`}
          title="Leaderboard"
        >
          <Trophy size={20} />
        </Link>
        <Link
          to="/inbox"
          className={`p-3 rounded-full transition-all duration-300 ${
            isActive('/inbox') || location.pathname.startsWith('/inbox/')
              ? 'bg-neon-cyan/20 text-neon-cyan shadow-neon-cyan'
              : 'text-white/60 hover:text-neon-cyan hover:bg-neon-cyan/10'
          }`}
          title="Messages"
        >
          <MessageCircle size={20} />
        </Link>
        <Link
          to="/settings"
          className={`p-3 rounded-full transition-all duration-300 ${
            isActive('/settings')
              ? 'bg-neon-cyan/20 text-neon-cyan shadow-neon-cyan'
              : 'text-white/60 hover:text-neon-cyan hover:bg-neon-cyan/10'
          }`}
          title="Settings"
        >
          <Settings size={20} />
        </Link>
      </div>
    </nav>
  );
}
