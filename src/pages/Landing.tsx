import { useNavigate, Link } from 'react-router-dom';
import { Star, Zap, Users, Trophy, ChevronRight } from 'lucide-react';
import { NeonButton } from '../components/ui/NeonButton';
import { NeonCard } from '../components/ui/NeonCard';
import { OAuthButtons } from '../components/auth/OAuthButtons';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-space relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-neon-cyan rounded-full blur-[150px]"></div>
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-neon-green rounded-full blur-[150px]"></div>
      </div>

      <nav className="fixed top-0 left-0 right-0 z-50 bg-space/90 backdrop-blur-md border-b-2 border-neon-cyan/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-neon-cyan to-neon-green rounded-lg flex items-center justify-center shadow-neon-cyan-strong">
                <Star className="w-7 h-7 text-white" fill="white" />
              </div>
              <h1 className="font-heading text-3xl font-bold text-neon-cyan neon-text-cyan">
                RATINGSKILL
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/login')}
                className="hidden sm:block px-6 py-2 text-white hover:text-neon-cyan transition-colors font-heading text-lg uppercase tracking-wider"
              >
                Sign In
              </button>
              <NeonButton onClick={() => navigate('/signup')} variant="cyan">
                Get Started
              </NeonButton>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-20 relative z-10">
        <section className="min-h-screen flex items-center py-12 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto w-full">
            <div className="text-center mb-16 animate-fade-in">
              <div className="inline-block mb-6 px-6 py-2 bg-neon-cyan/10 border-2 border-neon-cyan rounded-full">
                <p className="font-heading text-sm uppercase tracking-widest text-neon-cyan neon-text-cyan">
                  Video Game Stats for Real Life
                </p>
              </div>
              <h1 className="font-heading text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight uppercase">
                <span className="neon-text-cyan animate-neon-pulse">
                  Turn Skills
                </span>
                <br />
                <span className="neon-text-green animate-neon-pulse" style={{ animationDelay: '0.5s' }}>
                  Into Stats
                </span>
              </h1>
              <p className="text-xl sm:text-2xl text-white/80 mb-12 max-w-2xl mx-auto font-body">
                Build your player card, get rated by friends, and climb the leaderboard
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto mb-12">
                <NeonButton onClick={() => navigate('/signup')} variant="cyan" size="lg" className="flex-1">
                  <span className="flex items-center justify-center gap-2">
                    Start Now <ChevronRight className="w-5 h-5" />
                  </span>
                </NeonButton>
                <NeonButton onClick={() => navigate('/login')} variant="default" size="lg" className="flex-1">
                  Sign In
                </NeonButton>
              </div>

              <div className="max-w-md mx-auto">
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/20"></div>
                  </div>
                  <div className="relative flex justify-center">
                    <span className="px-4 bg-space text-white/60 text-sm font-heading uppercase tracking-wider">
                      Or continue with
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <OAuthButtons mode="signup" theme="dark" />
                </div>
              </div>
            </div>

            <div className="mb-20">
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-center text-white mb-4 uppercase">
                <span className="neon-text-cyan">Mission Phases</span>
              </h2>
              <p className="text-center text-white/60 mb-12 font-heading text-lg uppercase tracking-wider">
                Your Journey to Greatness
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
                <div className="hidden md:block absolute top-1/3 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-neon-cyan via-neon-green to-neon-cyan opacity-30"></div>

                <NeonCard variant="cyan" className="relative z-10 animate-slide-in-left">
                  <div className="p-8 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 bg-space border-3 border-neon-cyan rounded-full flex items-center justify-center shadow-neon-cyan-strong">
                      <span className="font-heading text-4xl font-bold text-neon-cyan neon-text-cyan">1</span>
                    </div>
                    <Zap className="w-12 h-12 text-neon-cyan mx-auto mb-4" />
                    <h3 className="font-heading text-2xl font-bold text-neon-cyan mb-3 uppercase neon-text-cyan">
                      Sign Up
                    </h3>
                    <p className="text-white/80 font-body">
                      Create your account and enter the arena. Quick setup, instant access.
                    </p>
                  </div>
                </NeonCard>

                <NeonCard variant="green" className="relative z-10 animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
                  <div className="p-8 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 bg-space border-3 border-neon-green rounded-full flex items-center justify-center shadow-neon-green-strong">
                      <span className="font-heading text-4xl font-bold text-neon-green neon-text-green">2</span>
                    </div>
                    <Users className="w-12 h-12 text-neon-green mx-auto mb-4" />
                    <h3 className="font-heading text-2xl font-bold text-neon-green mb-3 uppercase neon-text-green">
                      Upload Card
                    </h3>
                    <p className="text-white/80 font-body">
                      Build your player profile. Add your stats and let your abilities shine.
                    </p>
                  </div>
                </NeonCard>

                <NeonCard variant="cyan" className="relative z-10 animate-slide-in-right" style={{ animationDelay: '0.4s' }}>
                  <div className="p-8 text-center">
                    <div className="w-20 h-20 mx-auto mb-6 bg-space border-3 border-neon-cyan rounded-full flex items-center justify-center shadow-neon-cyan-strong">
                      <span className="font-heading text-4xl font-bold text-neon-cyan neon-text-cyan">3</span>
                    </div>
                    <Trophy className="w-12 h-12 text-neon-cyan mx-auto mb-4" />
                    <h3 className="font-heading text-2xl font-bold text-neon-cyan mb-3 uppercase neon-text-cyan">
                      Build Team
                    </h3>
                    <p className="text-white/80 font-body">
                      Connect with friends, rate each other, and dominate the leaderboard.
                    </p>
                  </div>
                </NeonCard>
              </div>
            </div>

            <div className="text-center">
              <NeonButton onClick={() => navigate('/signup')} variant="green" size="lg" className="animate-neon-glow">
                <span className="flex items-center gap-2">
                  <Star className="w-5 h-5" fill="currentColor" />
                  Join the Arena
                  <Star className="w-5 h-5" fill="currentColor" />
                </span>
              </NeonButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 bg-space/90 backdrop-blur-md border-t-2 border-neon-cyan/30 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-neon-cyan to-neon-green rounded-lg flex items-center justify-center shadow-neon-cyan">
                <Star className="w-6 h-6 text-white" fill="white" />
              </div>
              <span className="font-heading text-2xl font-bold text-neon-cyan neon-text-cyan">
                RATINGSKILL
              </span>
            </div>
            <p className="text-white/60 text-sm mb-4 font-heading uppercase tracking-wider">
              Video Game Stats for Real Life
            </p>
            <div className="flex justify-center gap-6 mb-4">
              <Link
                to="/terms"
                className="text-white/60 hover:text-neon-cyan text-sm transition-colors font-heading uppercase tracking-wider"
              >
                Terms of Service
              </Link>
            </div>
            <p className="text-white/40 text-xs font-mono">
              © {new Date().getFullYear()} RatingSkill.com - All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
