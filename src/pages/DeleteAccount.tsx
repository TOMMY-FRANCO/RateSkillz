import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trash2, Mail, Loader2, CheckCircle, AlertTriangle, ShieldAlert } from 'lucide-react';

export default function DeleteAccount() {
  const [email, setEmail] = useState('');
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

    if (!confirmed) {
      setError('Please confirm that you understand your account and all data will be permanently deleted');
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
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
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
                <h1 className="text-2xl font-bold text-white mb-3">Request Submitted</h1>
                <p className="text-gray-400 leading-relaxed">
                  Your account deletion request has been received. It will be processed within <span className="text-white font-semibold">30 days</span>.
                </p>
              </div>
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-left">
                <p className="text-sm text-gray-400">
                  Once processed, your account, profile, transaction history, messages, and all associated data will be permanently deleted and cannot be recovered.
                </p>
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
                <h1 className="text-3xl font-bold text-white mb-2">Delete Account</h1>
                <p className="text-gray-400">
                  Submit a request to permanently delete your RatingSkill account and all associated data.
                </p>
              </div>

              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">
                  This action is <strong>permanent and irreversible.</strong> All your data including your profile, coins, cards, messages, and transaction history will be deleted.
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
                    I understand that my account and <strong className="text-white">all associated data</strong> will be permanently deleted and cannot be recovered.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading || !email.trim() || !confirmed}
                  className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 disabled:bg-red-900/50 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
