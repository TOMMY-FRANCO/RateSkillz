import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { UserPlus, CheckCircle, Mail } from 'lucide-react';
import PasswordRequirements, { validatePassword } from '../components/PasswordRequirements';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (username.length < 3 || username.length > 20) {
      setError('Username must be between 3 and 20 characters');
      setLoading(false);
      return;
    }

    if (!validatePassword(password)) {
      setError('Password does not meet all requirements');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    const { error } = await signUp(email, password, username, fullName);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center mb-4">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-cyan-400 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-black" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">Check Your Email</h2>

          <div className="bg-gradient-to-r from-cyan-500/10 to-green-500/10 border border-cyan-500/30 rounded-xl p-6">
            <Mail className="w-12 h-12 text-cyan-400 mx-auto mb-4" />
            <p className="text-gray-300 mb-4">
              We've sent a verification email to:
            </p>
            <p className="text-cyan-400 font-semibold text-lg mb-4">{email}</p>
            <p className="text-gray-400 text-sm">
              Please click the link in the email to verify your account. You must verify your email before you can log in.
            </p>
          </div>

          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <p className="text-gray-400 text-sm mb-2">
              Didn't receive the email?
            </p>
            <p className="text-gray-500 text-xs">
              Check your spam folder or contact support if you need help.
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-cyan-400 rounded-xl flex items-center justify-center">
              <UserPlus className="w-8 h-8 text-black" />
            </div>
          </div>
          <h2 className="text-4xl font-bold text-white mb-2">Create Account</h2>
          <p className="text-gray-400">Join and create your player card</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-2">
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                placeholder="johndoe"
                minLength={3}
                maxLength={20}
              />
              <p className="mt-1 text-xs text-gray-500">3-20 characters, lowercase letters, numbers, and underscores only</p>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
              <PasswordRequirements password={password} />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-900 border border-gray-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                placeholder="••••••••"
                minLength={8}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !validatePassword(password) || password !== confirmPassword || !password || !confirmPassword}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>

          <p className="text-center text-gray-400">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors bg-none border-none cursor-pointer"
            >
              Log in
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
