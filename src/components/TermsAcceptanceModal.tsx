import { useState } from 'react';
import { X, FileText, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface TermsAcceptanceModalProps {
  onAccept: () => void;
}

export default function TermsAcceptanceModal({ onAccept }: TermsAcceptanceModalProps) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const handleAccept = async () => {
    if (!accepted || !profile) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ terms_accepted_at: new Date().toISOString() })
        .eq('id', profile.id);

      if (error) throw error;

      onAccept();
    } catch (error) {
      console.error('Error accepting terms:', error);
      alert('Failed to save terms acceptance. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-purple-500/30 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
              <FileText className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Terms of Service Update</h2>
              <p className="text-sm text-gray-300">Please review and accept to continue</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-1" />
            <div>
              <p className="font-semibold text-yellow-300 mb-1">Action Required</p>
              <p className="text-sm text-gray-300">
                We've updated our Terms of Service. You must review and accept these terms to continue using RatingSkill.
              </p>
            </div>
          </div>

          <div className="bg-white/5 rounded-xl p-4 space-y-3">
            <h3 className="font-bold text-white text-lg">Key Points:</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span>You must be at least 13 years old to use RatingSkill</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span>You are responsible for your account security and content</span>
              </li>
              <li className="flex gap-2">
                <span className="text-red-400 font-bold">•</span>
                <span className="font-semibold text-red-300">
                  Virtual coins have NO real-world cash value and cannot be withdrawn or exchanged for money
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span>All coin purchases are final and non-refundable</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span>Card trading is conducted using virtual coins within the platform only</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span>You retain ownership of your content but grant us license to display it</span>
              </li>
              <li className="flex gap-2">
                <span className="text-purple-400 font-bold">•</span>
                <span>Prohibited: harassment, fraud, bots, selling coins for real money</span>
              </li>
            </ul>
          </div>

          <button
            onClick={() => navigate('/terms')}
            className="w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl transition-colors border border-white/10 font-medium"
          >
            Read Full Terms of Service
          </button>
        </div>

        <div className="p-6 border-t border-white/10 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="w-5 h-5 mt-0.5 rounded border-2 border-gray-600 bg-gray-800 checked:bg-purple-600 checked:border-purple-600 cursor-pointer"
            />
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
              I have read and agree to the{' '}
              <button
                onClick={() => navigate('/terms')}
                className="text-purple-400 hover:text-purple-300 underline"
              >
                Terms of Service
              </button>
              . I understand that virtual coins have no real-world value and cannot be withdrawn or exchanged for money.
            </span>
          </label>

          <div className="flex gap-3">
            <button
              onClick={handleDecline}
              disabled={loading}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
            >
              Decline & Sign Out
            </button>
            <button
              onClick={handleAccept}
              disabled={!accepted || loading}
              className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white py-3 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Accepting...' : 'Accept & Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
