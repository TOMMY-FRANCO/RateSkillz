import { useNavigate, Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { OAuthButtons } from '../components/OAuthButtons';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <nav className="glass-container fixed w-full z-50 rounded-none border-l-0 border-r-0 border-t-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00E0FF] to-[#5FFFFF] rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(0,224,255,0.6)]">
                <Star className="w-6 h-6 text-black" />
              </div>
              <h1 className="text-xl font-bold text-white heading-glow">
                RatingSkill®
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2 text-white hover:text-[#00E0FF] transition-colors bg-transparent border-none cursor-pointer font-semibold uppercase text-sm tracking-wider"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="btn-primary"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <section className="relative overflow-hidden min-h-[calc(100vh-4rem)] flex items-center">
          <div className="absolute inset-0">
            <div className="absolute top-20 left-10 w-96 h-96 bg-[#00E0FF]/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-[#5FFFFF]/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
          </div>

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full">
            <div className="text-center animate-fade-in">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00E0FF] to-[#5FFFFF] heading-glow">
                  Turn Your Skills Into Stats
                </span>
              </h1>
              <p className="text-xl text-[#B0B8C8] mb-12 max-w-2xl mx-auto">
                Join RatingSkill® and create your personalised player card. Let friends rate your abilities, create your profile and watch your stats rise as you level up.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                <button
                  onClick={() => navigate('/signup')}
                  className="btn-primary flex-1 py-4 text-base"
                >
                  Start Building Your Squad
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="btn-ghost flex-1 py-4 text-base"
                >
                  Sign In
                </button>
              </div>

              <div className="mt-8 max-w-md mx-auto">
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#B0B8C8]/30"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-3 bg-black text-[#B0B8C8]">Or continue with</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <OAuthButtons mode="signup" theme="dark" />
                </div>
              </div>

              <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="glass-card p-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#00E0FF] to-[#5FFFFF] rounded-lg flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(0,224,255,0.5)]">
                    <span className="text-3xl">⚽</span>
                  </div>
                  <h3 className="tech-header">Get Rated</h3>
                  <p className="text-[#B0B8C8] text-sm">
                    Friends rate your pace, shooting, passing, dribbling, defense and physical attributes
                  </p>
                </div>
                <div className="glass-card p-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#00E0FF] to-[#5FFFFF] rounded-lg flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(0,224,255,0.5)]">
                    <span className="text-3xl">📊</span>
                  </div>
                  <h3 className="tech-header">Build Your Card</h3>
                  <p className="text-[#B0B8C8] text-sm">
                    Your ratings combine to create your unique RatingSkill® card with your stats
                  </p>
                </div>
                <div className="glass-card p-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-[#00E0FF] to-[#5FFFFF] rounded-lg flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(0,224,255,0.5)]">
                    <span className="text-3xl">🏆</span>
                  </div>
                  <h3 className="tech-header">Share & Compete</h3>
                  <p className="text-[#B0B8C8] text-sm">
                    Share your card and climb the leaderboard to become the top-rated player
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="glass-container rounded-none border-l-0 border-r-0 border-b-0 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-[#00E0FF] to-[#5FFFFF] rounded-lg flex items-center justify-center shadow-[0_0_20px_rgba(0,224,255,0.6)]">
                <Star className="w-5 h-5 text-black" />
              </div>
              <span className="text-lg font-bold text-white">
                RatingSkill®
              </span>
            </div>
            <p className="text-[#B0B8C8] text-sm mb-2">
              Turn Your Skills Into Stats
            </p>
            <div className="flex justify-center gap-4 mb-2">
              <Link
                to="/terms"
                className="text-[#B0B8C8] hover:text-[#00E0FF] text-sm transition-colors"
              >
                Terms of Service
              </Link>
            </div>
            <p className="text-[#6B7280] text-xs">
              © {new Date().getFullYear()} RatingSkill.com - All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
