import { useNavigate, Link } from 'react-router-dom';
import { Star } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
  console.log('🏠 Landing page rendering');

  return (
    <div className="min-h-screen bg-black">
      <nav className="bg-black/50 backdrop-blur-sm border-b border-gray-800 fixed w-full z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-cyan-400 rounded-lg flex items-center justify-center">
                <Star className="w-6 h-6 text-black" />
              </div>
              <h1 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                RatingSkill.com
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 text-white hover:text-cyan-400 transition-colors bg-transparent border-none cursor-pointer font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all border-none cursor-pointer"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <section className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex items-center">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-cyan-500/10"></div>
          <div className="absolute inset-0">
            <div className="absolute top-20 left-10 w-72 h-72 bg-green-500/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"></div>
          </div>

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
            <div className="text-center">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-white mb-6 leading-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                  Turn Your Skills Into Stats
                </span>
              </h1>
              <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
                Join RatingSkill® and create your personalized player card. Let friends rate your abilities, create your profile and watch your stats rise as you level up.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <button
                  onClick={() => navigate('/signup')}
                  className="px-8 py-4 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all text-lg shadow-lg shadow-cyan-500/50 cursor-pointer border-none flex-1"
                >
                  Start Building Your Squad
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-gray-900 border border-gray-700 text-white font-bold rounded-lg hover:bg-gray-800 hover:border-cyan-500 transition-all text-lg cursor-pointer flex-1"
                >
                  Sign In
                </button>
              </div>

              <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
                <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-xl">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-cyan-400 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">⚽</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Get Rated</h3>
                  <p className="text-gray-400 text-sm">
                    Friends rate your pace, shooting, passing, dribbling, defense, and physical attributes
                  </p>
                </div>
                <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-xl">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-cyan-400 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">📊</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Build Your Card</h3>
                  <p className="text-gray-400 text-sm">
                    Your ratings combine to create your unique RatingSkill® card with your stats
                  </p>
                </div>
                <div className="p-6 bg-gray-900/50 border border-gray-800 rounded-xl">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-cyan-400 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🏆</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Share & Compete</h3>
                  <p className="text-gray-400 text-sm">
                    Share your card and climb the leaderboard to become the top-rated player
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-gray-900 border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-cyan-400 rounded-lg flex items-center justify-center">
                <Star className="w-5 h-5 text-black" />
              </div>
              <span className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                RatingSkill®
              </span>
            </div>
            <p className="text-gray-400 text-sm mb-2">
              Turn Your Skills Into Stats
            </p>
            <div className="flex justify-center gap-4 mb-2">
              <Link
                to="/terms"
                className="text-gray-400 hover:text-cyan-400 text-sm transition-colors"
              >
                Terms of Service
              </Link>
            </div>
            <p className="text-gray-500 text-xs">
              © {new Date().getFullYear()} RatingSkill.com - All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
