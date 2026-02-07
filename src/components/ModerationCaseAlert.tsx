import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Send, CheckCircle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ModerationCase {
  case_id: string;
  reason_code: string;
  reason_details: string | null;
  status: string;
  severity: string;
  appeal_deadline: string;
  appeal_text: string | null;
  appeal_submitted_at: string | null;
  is_resolved: boolean;
  resolution_action: string | null;
  created_at: string;
}

export default function ModerationCaseAlert() {
  const [cases, setCases] = useState<ModerationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<ModerationCase | null>(null);
  const [appealText, setAppealText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_my_moderation_cases');

      if (rpcError) throw rpcError;

      // Filter for active cases only (not resolved)
      const activeCases = (data || []).filter((c: ModerationCase) => !c.is_resolved);
      setCases(activeCases);
    } catch (err) {
      console.error('Error loading moderation cases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAppeal = async () => {
    if (!selectedCase || !appealText.trim()) {
      setError('Please write your appeal');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const { data, error: rpcError } = await supabase.rpc('submit_appeal', {
        p_case_id: selectedCase.case_id,
        p_appeal_text: appealText.trim()
      });

      if (rpcError) throw rpcError;

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to submit appeal');
      }

      setSuccess('Appeal submitted successfully! Our team will review it.');
      setSelectedCase(null);
      setAppealText('');

      // Reload cases
      await loadCases();
    } catch (err) {
      console.error('Error submitting appeal:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit appeal');
    } finally {
      setSubmitting(false);
    }
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h remaining`;
    }

    return `${hours}h ${minutes}m remaining`;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'High': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'Medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  if (loading) return null;

  if (cases.length === 0) return null;

  return (
    <>
      <div className="space-y-4 mb-6">
        {cases.map((moderationCase) => {
          const timeRemaining = getTimeRemaining(moderationCase.appeal_deadline);
          const isExpired = timeRemaining === 'Expired';
          const canAppeal = !isExpired && !moderationCase.appeal_submitted_at;

          return (
            <div
              key={moderationCase.case_id}
              className="bg-gradient-to-br from-red-900/20 to-orange-900/20 border-2 border-red-500/50 rounded-xl p-6 shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-red-500/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-400" />
                </div>

                <div className="flex-1">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">
                        Intent to Block - Account Under Review
                      </h3>
                      <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${getSeverityColor(moderationCase.severity)}`}>
                        {moderationCase.severity} Priority
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="bg-black/30 rounded-lg p-4">
                      <p className="text-sm font-semibold text-gray-300 mb-1">Reported Reason:</p>
                      <p className="text-white font-medium">{moderationCase.reason_code}</p>
                      {moderationCase.reason_details && (
                        <p className="text-gray-400 text-sm mt-2">{moderationCase.reason_details}</p>
                      )}
                    </div>

                    {moderationCase.status === 'Appealed' ? (
                      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-cyan-200 font-semibold mb-1">Appeal Submitted</p>
                          <p className="text-cyan-300/80 text-sm">
                            Your appeal is under review. You'll be notified when a decision is made.
                          </p>
                          <p className="text-cyan-400 text-xs mt-2">
                            Submitted: {new Date(moderationCase.appeal_submitted_at!).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ) : canAppeal ? (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-5 h-5 text-yellow-400" />
                          <p className="text-yellow-200 font-semibold">
                            {timeRemaining}
                          </p>
                        </div>
                        <p className="text-yellow-300/80 text-sm mb-3">
                          You have until {new Date(moderationCase.appeal_deadline).toLocaleString()} to submit an appeal.
                        </p>
                        <button
                          onClick={() => setSelectedCase(moderationCase)}
                          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-lg transition-all flex items-center gap-2"
                        >
                          <Send className="w-4 h-4" />
                          Submit Appeal
                        </button>
                      </div>
                    ) : (
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <p className="text-red-200 font-semibold mb-1">Appeal Deadline Passed</p>
                        <p className="text-red-300/80 text-sm">
                          The appeal window has closed. Automatic enforcement will be applied.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Appeal Modal */}
      {selectedCase && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">Submit Appeal</h2>
              <button
                onClick={() => {
                  setSelectedCase(null);
                  setAppealText('');
                  setError('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 mb-6">
                <p className="text-cyan-200 text-sm mb-2">
                  <strong>Case Reason:</strong> {selectedCase.reason_code}
                </p>
                {selectedCase.reason_details && (
                  <p className="text-cyan-300/80 text-sm">
                    <strong>Details:</strong> {selectedCase.reason_details}
                  </p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Your Appeal <span className="text-red-400">*</span>
                </label>
                <p className="text-gray-400 text-sm mb-3">
                  Explain why you believe this report is incorrect or provide context for your actions.
                  Be honest and specific.
                </p>
                <textarea
                  value={appealText}
                  onChange={(e) => setAppealText(e.target.value)}
                  placeholder="Write your appeal here..."
                  rows={8}
                  maxLength={2000}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors resize-none"
                  disabled={submitting}
                />
                <p className="mt-2 text-xs text-gray-500">
                  {appealText.length}/2000 characters
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
                  <p className="text-green-400 text-sm">{success}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedCase(null);
                    setAppealText('');
                    setError('');
                  }}
                  disabled={submitting}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAppeal}
                  disabled={submitting || !appealText.trim()}
                  className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Submit Appeal</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
