import { useNavigate } from 'react-router-dom';
import { Star, Users, TrendingUp, Share2 } from 'lucide-react';

export default function Landing() {
  const navigate = useNavigate();
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
                FC Rating
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/login')}
                className="text-gray-300 hover:text-white transition-colors font-medium bg-none border-none cursor-pointer"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all cursor-pointer border-none"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-transparent to-cyan-500/10"></div>
          <div className="absolute inset-0">
            <div className="absolute top-20 left-10 w-72 h-72 bg-green-500/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl"></div>
          </div>

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
            <div className="text-center">
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-black text-white mb-6 leading-tight">
                Create Your
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                  FIFA Player Card
                </span>
              </h1>
              <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
                Get rated by friends on your football skills. Build your ultimate player card and share it with the world.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
                <button
                  onClick={() => navigate('/signup')}
                  className="px-8 py-4 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all text-lg shadow-lg shadow-cyan-500/50 cursor-pointer border-none"
                >
                  Get Started Free
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-gray-800 text-white font-semibold rounded-lg hover:bg-gray-700 transition-all text-lg border border-gray-700 cursor-pointer"
                >
                  Sign In
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-gradient-to-b from-black to-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">
                How It Works
              </h2>
              <p className="text-gray-400 text-lg">
                Three simple steps to create your player card
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8 text-center hover:border-cyan-500/50 transition-all">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users className="w-8 h-8 text-black" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">1. Create Profile</h3>
                <p className="text-gray-400">
                  Sign up and create your profile with a photo. Choose your unique username and customize your info.
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8 text-center hover:border-cyan-500/50 transition-all">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Star className="w-8 h-8 text-black" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">2. Get Rated</h3>
                <p className="text-gray-400">
                  Connect with friends and let them anonymously rate your PAC, SHO, PAS, DRI, DEF, and PHY stats.
                </p>
              </div>

              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8 text-center hover:border-cyan-500/50 transition-all">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Share2 className="w-8 h-8 text-black" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-4">3. Share Card</h3>
                <p className="text-gray-400">
                  Share your FIFA-style player card on social media and show off your ratings to everyone.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-20 bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">
                Premium Features
              </h2>
              <p className="text-gray-400 text-lg">
                Everything you need to build your player reputation
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { title: 'FIFA-Style Cards', description: 'Professional looking player cards with modern design' },
                { title: 'Anonymous Ratings', description: 'Friends rate you privately without bias' },
                { title: 'Friend System', description: 'Connect with friends via username, school, or location' },
                { title: 'Social Sharing', description: 'Share on Twitter, WhatsApp, Instagram, and more' },
                { title: 'Real-time Updates', description: 'See your ratings update instantly' },
                { title: 'Comments & Likes', description: 'Get feedback from your community' },
                { title: 'Secure & Private', description: 'Your data is safe and protected' },
                { title: 'Mobile Friendly', description: 'Works perfectly on all devices' },
              ].map((feature, index) => (
                <div
                  key={index}
                  className="bg-gray-800 border border-gray-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500/20 to-cyan-500/20 rounded-lg flex items-center justify-center mb-4">
                    <TrendingUp className="w-5 h-5 text-cyan-400" />
                  </div>
                  <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                  <p className="text-gray-400 text-sm">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 bg-black">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-4xl font-bold text-white mb-6">
              Ready to Create Your Player Card?
            </h2>
            <p className="text-xl text-gray-400 mb-8">
              Join thousands of players building their football reputation
            </p>
            <button
              onClick={() => navigate('/signup')}
              className="inline-block px-8 py-4 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all text-lg shadow-lg shadow-cyan-500/50 cursor-pointer border-none"
            >
              Get Started Now
            </button>
          </div>
        </section>
      </main>

      <footer className="bg-gray-900 border-t border-gray-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center text-gray-400">
            <p>&copy; 2024 FC Rating. Built for football players.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
