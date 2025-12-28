import { Link, useLocation } from 'react-router-dom';
import { Home, Users, Trophy, ShoppingBag, Swords, MessageCircle, Settings } from 'lucide-react';

export default function FloatingNav() {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="floating-nav">
      <div className="flex items-center gap-2">
        <Link
          to="/dashboard"
          className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
          title="Home"
        >
          <Home size={20} />
        </Link>
        <Link
          to="/friends"
          className={`nav-item ${isActive('/friends') ? 'active' : ''}`}
          title="Friends"
        >
          <Users size={20} />
        </Link>
        <Link
          to="/trading"
          className={`nav-item ${isActive('/trading') ? 'active' : ''}`}
          title="Trading"
        >
          <ShoppingBag size={20} />
        </Link>
        <Link
          to="/battle-mode"
          className="nav-item battle"
          title="Battle Mode"
        >
          <Swords size={20} />
        </Link>
        <Link
          to="/leaderboard"
          className={`nav-item ${isActive('/leaderboard') ? 'active' : ''}`}
          title="Leaderboard"
        >
          <Trophy size={20} />
        </Link>
        <Link
          to="/inbox"
          className={`nav-item ${isActive('/inbox') || location.pathname.startsWith('/inbox/') ? 'active' : ''}`}
          title="Messages"
        >
          <MessageCircle size={20} />
        </Link>
        <Link
          to="/settings"
          className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
          title="Settings"
        >
          <Settings size={20} />
        </Link>
      </div>
    </nav>
  );
}
