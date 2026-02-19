import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Mail, User, Loader2, CheckCircle, AlertTriangle, ShieldAlert, Info } from 'lucide-react';

export default function DeleteAccount() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }

    if (!confirmed) {
      setError('Please confirm that you understand deletion is permanent and cannot be undone');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-account-request`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: email.trim().toLowerCase(),
            username: username.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result?.success) {
        setError(result?.error || 'Failed to submit deletion request. Please try again.');
        return;
      }

      setSuccess(true);
    } catch (_err) {
      setError('Failed to submit deletion request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deletedItems = [
    'Profile information (name, bio, avatar, location)',
    'Player card and card ownership history',
    'Coin balance and all coin transactions',
    'Messages and conversation history',
    'Ratings given and received',
    'Transaction history and purchase records',
    'Friend connections and friend requests',
    'All other personal data associated with your account',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-start justify-center p-4 py-10">
      <div className="w-full max-w-lg">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm border border-gray-700 rounded-2xl p-8 shadow-2xl">
          {success ? (
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500/20 border border-green-500/30 rounded-full">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white mb-3">Request Received</h1>
                <p className="text-gray-400 leading-relaxed">
                  Your account deletion request has been received and will be processed within{' '}
                  <span className="text-white font-semibold">30 days</span>.
                </p>
              </div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-left space-y-2">
                <p className="text-sm text-gray-300 font-medium">What happens next:</p>
                <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
                  <li>Our team will review and process your request</li>
                  <li>Your account and all data will be permanently deleted</li>
                  <li>Some data may be retained for up to 30 days for legal and fraud prevention purposes</li>
                  <li>You will not receive a confirmation email once deletion is complete</li>
                </ul>
              </div>
              <Link
                to="/"
                className="inline-block w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all text-center"
              >
                Return to Home
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-full mb-4">
                  <Trash2 className="w-8 h-8 text-red-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">RatingSkill Account Deletion Request</h1>
                <p className="text-gray-400 text-sm leading-relaxed">
                  Submitting this form will request permanent deletion of your RatingSkill account and all associated data. This action cannot be reversed.
                </p>
              </div>

              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-5 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">
                  <strong className="text-red-200">Warning:</strong> Deletion is permanent and irreversible. Once processed, your account cannot be restored.
                </p>
              </div>

              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 mb-5">
                <p className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-red-400" />
                  The following data will be permanently deleted:
                </p>
                <ul className="space-y-1.5">
                  {deletedItems.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-gray-400">
                      <span className="text-red-400 mt-0.5 flex-shrink-0">&#8226;</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-300/90">
                  Some data may be retained for up to <strong className="text-amber-200">30 days</strong> for legal and fraud prevention purposes before being permanently removed.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="Enter your account email"
                      className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                      disabled={loading}
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="Enter your username"
                      className="w-full pl-10 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
                      disabled={loading}
                      autoComplete="username"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative flex-shrink-0 mt-0.5">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => {
                        setConfirmed(e.target.checked);
                        if (error) setError('');
                      }}
                      className="sr-only"
                      disabled={loading}
                    />
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                        confirmed
                          ? 'bg-red-500 border-red-500'
                          : 'bg-gray-900 border-gray-600 group-hover:border-gray-400'
                      }`}
                    >
                      {confirmed && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-300 leading-relaxed">
                    I understand that deletion is <strong className="text-white">permanent and cannot be undone</strong>, and that my account and all associated data will be irreversibly removed.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading || !email.trim() || !username.trim() || !confirmed}
                  className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-900/40 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Submitting Request...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      <span>Submit Deletion Request</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-700">
                <p className="text-center text-sm text-gray-400">
                  Changed your mind?{' '}
                  <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold">
                    Sign In
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
