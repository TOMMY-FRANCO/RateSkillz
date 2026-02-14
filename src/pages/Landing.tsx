import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoginForm } from '../components/auth/LoginForm';
import { SignupForm } from '../components/auth/SignupForm';

export default function Landing() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(true);

  if (user) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Header */}
      <header className="glass-container rounded-none border-l-0 border-r-0 border-t-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-16">
            <h1 className="text-xl font-bold text-white heading-glow">
              RatingSkill®
            </h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Small Hero */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">
              Rate Skills, Build Your Legacy
            </h2>
            <p className="text-[#B0B8C8]">
              Create your player card and get rated by friends
            </p>
          </div>

          {/* Auth Form */}
          <div className="glass-card p-8">
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setShowLogin(true)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                  showLogin
                    ? 'bg-gradient-to-r from-[#00E0FF] to-[#7B2FF7] text-white'
                    : 'text-[#B0B8C8] hover:text-white'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setShowLogin(false)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
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
      </div>
    </div>
  );
}
