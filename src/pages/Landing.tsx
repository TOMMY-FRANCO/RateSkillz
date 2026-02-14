import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthModal } from '../components/auth/AuthModal';
import {
  Sparkles,
  Users,
  Trophy,
  TrendingUp,
  MessageCircle,
  ShoppingBag,
  Zap,
  Shield,
  Globe,
  Star,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  if (user) {
    navigate('/dashboard');
    return null;
  }

  const features = [
    {
      icon: Users,
      title: 'Build Your Network',
      description: 'Connect with friends, rate each other, and grow your community',
      gradient: 'from-[#00FF85] to-[#00E0FF]',
      shadowColor: '#00FF85',
    },
    {
      icon: Trophy,
      title: 'Compete & Rank',
      description: 'Climb the leaderboard and showcase your skills in battle mode',
      gradient: 'from-[#FFD700] to-[#FFA500]',
      shadowColor: '#FFD700',
    },
    {
      icon: ShoppingBag,
      title: 'Trade Player Cards',
      description: 'Buy, sell, and manage cards with our dynamic trading system',
      gradient: 'from-[#00E0FF] to-[#38BDF8]',
      shadowColor: '#00E0FF',
    },
    {
      icon: MessageCircle,
      title: 'Stay Connected',
      description: 'Real-time messaging and notifications to stay in touch',
      gradient: 'from-[#FF6B9D] to-[#C44569]',
      shadowColor: '#FF6B9D',
    },
    {
      icon: TrendingUp,
      title: 'Earn Rewards',
      description: 'Complete tasks, watch ads, and earn coins for activities',
      gradient: 'from-[#9333EA] to-[#7B2FF7]',
      shadowColor: '#9333EA',
    },
    {
      icon: Shield,
      title: 'Safe & Secure',
      description: 'Protected accounts with advanced security and moderation',
      gradient: 'from-[#10B981] to-[#059669]',
      shadowColor: '#10B981',
    },
  ];

  const stats = [
    { value: '10K+', label: 'Active Users' },
    { value: '50K+', label: 'Ratings Given' },
    { value: '25K+', label: 'Cards Traded' },
    { value: '100K+', label: 'Messages Sent' },
  ];

  const benefits = [
    'Create your unique player card profile',
    'Get rated by friends on multiple skills',
    'Compete in skill-based battles',
    'Trade cards and build your collection',
    'Earn coins through engagement',
    'Track your progress on leaderboards',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 overflow-x-hidden">
      <div className={`transition-opacity duration-1000 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
        {/* Header */}
        <header className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <h1 className="text-xl font-bold text-white heading-glow">
                  RatingSkill®
                </h1>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="btn-secondary px-6 py-2.5 text-sm"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative py-20 sm:py-32 px-4 sm:px-6 lg:px-8 overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500 rounded-full filter blur-[150px]"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full filter blur-[150px]"></div>
          </div>

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="text-center mb-12 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
                <Sparkles className="w-4 h-4 text-[#00E0FF]" />
                <span className="text-[#B0B8C8] text-sm font-medium">
                  The Future of Player Ratings
                </span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-white mb-6 leading-tight">
                Rate Skills,
                <br />
                <span className="bg-gradient-to-r from-[#00E0FF] via-[#00FF85] to-[#38BDF8] text-transparent bg-clip-text animate-glow">
                  Build Your Legacy
                </span>
              </h1>

              <p className="text-xl sm:text-2xl text-[#B0B8C8] mb-10 max-w-3xl mx-auto leading-relaxed">
                Create your player card, get rated by friends, trade cards, and compete in an epic social platform built for champions.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="btn-secondary px-8 py-4 text-base flex items-center gap-2 group"
                >
                  <span>Start Your Journey</span>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={() => {
                    const featuresSection = document.getElementById('features');
                    featuresSection?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="btn-ghost px-8 py-4 text-base"
                >
                  Learn More
                </button>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto animate-slide-up">
              {stats.map((stat, index) => (
                <div
                  key={index}
                  className="glass-card p-6 text-center"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="text-3xl sm:text-4xl font-black text-white heading-glow mb-2">
                    {stat.value}
                  </div>
                  <div className="text-[#B0B8C8] text-sm sm:text-base">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 relative">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 heading-glow">
                Everything You Need
              </h2>
              <p className="text-xl text-[#B0B8C8] max-w-2xl mx-auto">
                A complete platform to showcase your skills, connect with others, and build your reputation
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={index}
                    className="glass-card p-6 group cursor-pointer"
                    style={{
                      animation: 'fade-in 0.6s ease-out forwards',
                      animationDelay: `${index * 100}ms`,
                      opacity: 0,
                    }}
                  >
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}
                      style={{ boxShadow: `0 0 20px ${feature.shadowColor}40` }}
                    >
                      <Icon className="w-7 h-7 text-black" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-[#B0B8C8] leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent via-blue-900/20 to-transparent">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="animate-fade-in">
                <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 heading-glow">
                  Why Choose RatingSkill?
                </h2>
                <p className="text-xl text-[#B0B8C8] mb-8 leading-relaxed">
                  Join thousands of players building their reputation and competing in the ultimate social rating platform.
                </p>

                <div className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 animate-slide-up"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-[#00E0FF] to-[#00FF85] flex items-center justify-center shadow-lg shadow-[#00E0FF]/30">
                        <CheckCircle className="w-4 h-4 text-black" />
                      </div>
                      <p className="text-white text-lg">{benefit}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="glass-card p-8 animate-fade-in" style={{ animationDelay: '300ms' }}>
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00E0FF] to-[#38BDF8] flex items-center justify-center shadow-lg shadow-[#00E0FF]/30">
                        <Zap className="w-6 h-6 text-black" />
                      </div>
                      <div>
                        <div className="text-white font-bold text-lg">Instant Setup</div>
                        <div className="text-[#B0B8C8] text-sm">Create your profile in seconds</div>
                      </div>
                    </div>

                    <div className="section-divider"></div>

                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center shadow-lg shadow-[#00FF85]/30">
                        <Globe className="w-6 h-6 text-black" />
                      </div>
                      <div>
                        <div className="text-white font-bold text-lg">Global Community</div>
                        <div className="text-[#B0B8C8] text-sm">Connect with players worldwide</div>
                      </div>
                    </div>

                    <div className="section-divider"></div>

                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#FFD700] to-[#FFA500] flex items-center justify-center shadow-lg shadow-[#FFD700]/30">
                        <Star className="w-6 h-6 text-black" />
                      </div>
                      <div>
                        <div className="text-white font-bold text-lg">Earn Rewards</div>
                        <div className="text-[#B0B8C8] text-sm">Get coins for engagement</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <div className="glass-card p-12 text-center relative overflow-hidden animate-fade-in">
              <div className="absolute inset-0 bg-gradient-to-r from-[#00E0FF]/10 via-transparent to-[#00FF85]/10"></div>

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-6">
                  <Trophy className="w-4 h-4 text-[#FFD700]" />
                  <span className="text-[#B0B8C8] text-sm font-medium">
                    Join the Community
                  </span>
                </div>

                <h2 className="text-4xl sm:text-5xl font-black text-white mb-6 heading-glow">
                  Ready to Get Started?
                </h2>

                <p className="text-xl text-[#B0B8C8] mb-10 max-w-2xl mx-auto">
                  Create your player card, connect with friends, and start building your legacy today. It's free to join!
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="btn-secondary px-10 py-4 text-lg flex items-center gap-2 group"
                  >
                    <span>Create Account</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>

                <p className="text-[#B0B8C8] text-sm mt-6">
                  No credit card required • Free forever • Join 10,000+ users
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 sm:px-6 lg:px-8 border-t border-white/10">
          <div className="max-w-7xl mx-auto text-center">
            <div className="text-white font-bold text-lg mb-2 heading-glow">
              RatingSkill®
            </div>
            <p className="text-[#B0B8C8] text-sm">
              © 2026 RatingSkill. All rights reserved.
            </p>
          </div>
        </footer>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </div>
  );
}
