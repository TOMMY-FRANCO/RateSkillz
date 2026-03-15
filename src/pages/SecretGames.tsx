import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function SecretGames() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black">
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-black/40 border-b border-purple-500/20">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate('/settings')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1
            className="text-white font-bold text-lg tracking-widest uppercase"
            style={{ textShadow: '0 0 12px rgba(168,85,247,0.9), 0 0 24px rgba(168,85,247,0.5)' }}
          >
            SECRET GAMES
          </h1>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-10 flex flex-col items-center justify-center">
        <div className="w-full bg-purple-500/5 border border-purple-500/20 rounded-2xl p-6 text-center backdrop-blur-sm">
          <div className="text-5xl mb-4">🔒</div>
          <h2
            className="text-white font-bold text-2xl tracking-widest uppercase mb-3"
            style={{ textShadow: '0 0 10px rgba(168,85,247,0.7)' }}
          >
            SECRET GAMES
          </h2>
          <p className="text-[#B0B8C8] text-sm">More games coming soon...</p>
        </div>
      </main>
    </div>
  );
}
