import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PlayerCard from '../components/PlayerCard';
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
    { title: 'Messages', description: 'Chat with friends' },
    { title: 'Friends', description: 'Manage connections' },
    { title: 'Card Trading', description: 'Buy & sell cards' },
    { title: 'Battle Mode', description: 'Card battles & wagers' },
    { title: 'Daily Quiz', description: 'Earn coins daily' },
    { title: 'Matchday', description: 'Premier League' },
    { title: 'Predictions', description: 'Predict & earn coins' },
    { title: 'World Cup 2026', description: 'Coming June 2026' },
    { title: 'Football Match', description: 'Organise and wager' },
    { title: 'Scouter', description: 'Find local teams' },
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

          {/* Player Card */}
<div className="flex justify-center mb-8">
  <PlayerCard
    profile={{
      id: 'f6832f92-0877-46cc-9231-1ca01ccd2364',
username: 'test123',
      full_name: 'Test User',
      position: 'AM',
      team: 'Chelsea',
      overall_rating: 98,
      is_manager: false,
      coin_balance: 0,
    } as any}
    userStats={{
      id: 'f6832f92-0877-46cc-9231-1ca01ccd2364',
user_id: 'f6832f92-0877-46cc-9231-1ca01ccd2364',
      pac: 98, sho: 98, pas: 98,
      dri: 98, def: 98, phy: 98,
      overall: 98,
      rating_count: 10,
      created_at: '',
      updated_at: '',
    }}
    isVerified={true}
    hasSocialBadge={false}
    overallRating={98}
    size="large"
  />
</div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {features.map((feature, index) => (
              <div key={index} className="glass-card p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00E0FF]/20 to-[#7B2FF7]/20 border border-[rgba(0,224,255,0.3)] flex items-center justify-center flex-shrink-0">
                  <span className="text-[#00E0FF] font-black text-sm">{index + 1}</span>
                </div>
                <div>
                  <div className="text-white font-bold text-sm">{feature.title}</div>
                  <div className="text-[#B0B8C8] text-xs">{feature.description}</div>
                </div>
              </div>
            ))}
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
