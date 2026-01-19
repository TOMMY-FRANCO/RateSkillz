import { useState } from 'react';
import { Flag, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ReportUserModalProps {
  reportedUserId: string;
  reportedUsername: string;
  onClose: () => void;
}

export default function ReportUserModal({ reportedUserId, reportedUsername, onClose }: ReportUserModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('submit_report', {
        p_reported_user_id: reportedUserId,
        p_reason: 'harassment'
      });

      if (rpcError) throw rpcError;

      if (data && !data.success) {
        throw new Error(data.error || 'Failed to submit report');
      }

      setSubmitted(true);

      // Auto-close after 2 seconds
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error submitting report:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <Flag className="w-5 h-5 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Report User</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Report Sent</h3>
              <p className="text-gray-400">
                Our team will review it. Thank you for helping keep our community safe.
              </p>
            </div>
          ) : (
            <>
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-yellow-200 text-sm font-medium mb-1">
                      Are you sure you want to report {reportedUsername}?
                    </p>
                    <p className="text-yellow-300/80 text-xs">
                      False reports waste our team's time and may result in action against your account.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <p className="text-gray-300">
                  This report will be sent to our UK moderation team for immediate review.
                  We take all reports seriously and will investigate this matter.
                </p>
                <p className="text-gray-400 text-sm">
                  Our team will review this report and take appropriate action if necessary.
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={submitting}
                  className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Flag className="w-4 h-4" />
                      <span>Report User</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
