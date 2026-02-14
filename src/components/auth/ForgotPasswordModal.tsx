import { useState } from 'react';
import { X, Mail, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
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
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/password-reset-email`,
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

      if (!response.ok && result?.error?.includes('Too many')) {
        setError('Too many password reset requests. Please try again later.');
        return;
      }

      setSuccess(true);
      setEmail('');
    } catch (_err) {
      setError('Failed to send password reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError('');
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-md glass-card p-6 animate-in fade-in zoom-in duration-200">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-[#00E0FF] to-[#7B2FF7] rounded-full mb-3">
            <Mail className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Forgot Password?</h2>
          <p className="text-sm text-[#B0B8C8]">
            Enter your email and we'll send you a reset link
          </p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-green-400 font-semibold mb-1">Check your email!</p>
                  <p className="text-sm text-[#B0B8C8]">
                    If an account exists with that email, we've sent a password reset link.
                    The link will expire in 30 minutes.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSuccess(false)}
              className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white font-medium rounded-lg transition-colors"
            >
              Send another reset link
            </button>

            <button
              onClick={handleClose}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-[#00E0FF] to-[#7B2FF7] hover:opacity-90 text-white font-medium rounded-lg transition-opacity"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-white/80 mb-2">
                Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="you@example.com"
                className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/40 focus:outline-none focus:border-[#00E0FF]/50 transition-colors"
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full px-4 py-2.5 bg-gradient-to-r from-[#00E0FF] to-[#7B2FF7] hover:opacity-90 text-white font-medium rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5" />
                  <span>Send Reset Link</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
