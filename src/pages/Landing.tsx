import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoginForm } from '../components/auth/LoginForm';
import { SignupForm } from '../components/auth/SignupForm';
import { Users, Trophy, ShoppingBag, TrendingUp, Zap, Globe, Star } from 'lucide-react';

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(true);

  if (user) {
    navigate('/dashboard');
    return null;
  }

  const features = [
    {
      icon: Users,
      title: 'Build Your Network',
      description: 'Connect with friends and rate each other',
      gradient: 'from-[#00FF85] to-[#00E0FF]',
    },
    {
      icon: Trophy,
      title: 'Compete & Rank',
      description: 'Climb leaderboards in battle mode',
      gradient: 'from-[#FFD700] to-[#FFA500]',
    },
    {
      icon: ShoppingBag,
      title: 'Trade Player Cards',
      description: 'Buy and sell cards dynamically',
      gradient: 'from-[#00E0FF] to-[#38BDF8]',
    },
    {
      icon: TrendingUp,
      title: 'Earn Rewards',
      description: 'Get coins for activities',
      gradient: 'from-[#FF6B9D] to-[#C44569]',
    },
  ];

  const benefits = [
    {
      icon: Zap,
      title: 'Instant Setup',
      description: 'Create your profile in seconds',
      gradient: 'from-[#00E0FF] to-[#38BDF8]',
    },
    {
      icon: Globe,
      title: 'Global Community',
      description: 'Connect with players worldwide',
      gradient: 'from-[#00FF85] to-[#00E0FF]',
    },
    {
      icon: Star,
      title: 'Earn Rewards',
      description: 'Get coins for engagement',
      gradient: 'from-[#FFD700] to-[#FFA500]',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="glass-container rounded-none border-l-0 border-r-0 border-t-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-14">
            <h1 className="text-lg font-bold text-white heading-glow">
              RatingSkill®
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Auth Section */}
          <div className="max-w-md mx-auto mb-8">
            {/* Small Hero */}
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">
                Rate Skills, Build Your Legacy
              </h2>
              <p className="text-sm text-[#B0B8C8]">
                Create your player card and get rated by friends
              </p>
            </div>

            {/* Auth Form */}
            <div className="glass-card p-6">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setShowLogin(true)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                    showLogin
                      ? 'bg-gradient-to-r from-[#00E0FF] to-[#7B2FF7] text-white'
                      : 'text-[#B0B8C8] hover:text-white'
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setShowLogin(false)}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium text-sm transition-all ${
                    !showLogin
                      ? 'bg-gradient-to-r from-[#00E0FF] to-[#7B2FF7] text-white'
                      : 'text-[#B0B8C8] hover:text-white'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {showLogin ? <LoginForm /> : <SignupForm />}
            </div>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="glass-card p-4 hover:scale-105 transition-transform">
                  <div
                    className={`w-10 h-10 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-3`}
                  >
                    <Icon className="w-5 h-5 text-black" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-[#B0B8C8] leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Benefits Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <div key={index} className="glass-card p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-br ${benefit.gradient} flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className="w-5 h-5 text-black" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-white">{benefit.title}</div>
                      <div className="text-xs text-[#B0B8C8]">{benefit.description}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <footer className="text-center pt-6 pb-4 border-t border-white/10">
            <div className="text-white font-bold text-sm mb-2 heading-glow">
              RatingSkill®
            </div>
            <div className="flex items-center justify-center gap-3 text-xs text-[#B0B8C8]">
              <span>© 2026 RatingSkill</span>
              <span>•</span>
              <Link to="/terms" className="hover:text-white transition-colors">
                Terms & Conditions
              </Link>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
