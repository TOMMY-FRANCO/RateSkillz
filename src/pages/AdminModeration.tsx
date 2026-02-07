import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Shield, Flag, Ban, CheckCircle, ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';

interface Report {
  report_id: string;
  reported_user_id: string;
  reported_username: string;
  reported_display_name: string;
  reporter_id: string;
  reporter_username: string;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
}

export default function AdminModeration() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingReportId, setProcessingReportId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const adminCheckDoneRef = useRef(false);

  useEffect(() => {
    console.log('[AdminModeration] Profile check:', { profile: profile?.username, isAdmin: profile?.is_admin });

    if (!profile) {
      console.log('[AdminModeration] No profile - waiting...');
      return;
    }

    if (!profile.is_admin) {
      console.log('[AdminModeration] Not admin - redirecting to dashboard');
      navigate('/dashboard', { replace: true });
      return;
    }

    if (!adminCheckDoneRef.current) {
      console.log('[AdminModeration] Admin verified - loading reports');
      adminCheckDoneRef.current = true;
      loadReports();
    }
  }, [profile, navigate]);

  const loadReports = async () => {
    console.log('[AdminModeration] Starting to load reports...');
    setLoading(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('get_active_reports');

      if (rpcError) {
        console.error('[AdminModeration] RPC error:', rpcError);

        if (rpcError.message?.includes('Unauthorized') || rpcError.message?.includes('admin access required')) {
          setError('Access denied: Admin privileges required');
          navigate('/dashboard', { replace: true });
          return;
        }

        throw rpcError;
      }

      console.log('[AdminModeration] Reports loaded successfully:', data?.length || 0);
      setReports(data || []);
      setError('');
    } catch (err) {
      console.error('[AdminModeration] Error loading reports:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load reports';
      setError(errorMessage);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBanUser = async (reportId: string, targetUserId: string) => {
    if (!confirm('Are you sure you want to BAN this user? This action will disable their account.')) {
      return;
    }

    console.log('[AdminModeration] Banning user:', { reportId, targetUserId });
    setProcessingReportId(reportId);
    setError('');

    try {
      const notes = adminNotes[reportId] || '';

      const { data, error: rpcError } = await supabase.rpc('ban_user', {
        p_report_id: reportId,
        p_target_user_id: targetUserId,
        p_notes: notes
      });

      if (rpcError) {
        console.error('[AdminModeration] Ban user RPC error:', rpcError);
        throw rpcError;
      }

      if (data && !data.success) {
        console.error('[AdminModeration] Ban user failed:', data.error);
        throw new Error(data.error || 'Failed to ban user');
      }

      console.log('[AdminModeration] User banned successfully');
      await loadReports();
    } catch (err) {
      console.error('[AdminModeration] Error banning user:', err);
      setError(err instanceof Error ? err.message : 'Failed to ban user');
    } finally {
      setProcessingReportId(null);
    }
  };

  const handleClearReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to CLEAR this report? This marks the user as safe.')) {
      return;
    }

    console.log('[AdminModeration] Clearing report:', { reportId });
    setProcessingReportId(reportId);
    setError('');

    try {
      const notes = adminNotes[reportId] || '';

      const { data, error: rpcError } = await supabase.rpc('clear_report', {
        p_report_id: reportId,
        p_notes: notes
      });

      if (rpcError) {
        console.error('[AdminModeration] Clear report RPC error:', rpcError);
        throw rpcError;
      }

      if (data && !data.success) {
        console.error('[AdminModeration] Clear report failed:', data.error);
        throw new Error(data.error || 'Failed to clear report');
      }

      console.log('[AdminModeration] Report cleared successfully');
      await loadReports();
    } catch (err) {
      console.error('[AdminModeration] Error clearing report:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear report');
    } finally {
      setProcessingReportId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!profile?.is_admin) {
    return null; // 404-like experience
  }

  return (
    <div className="min-h-screen bg-black">
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-300 hover:text-cyan-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-red-400" />
                <div>
                  <h1 className="text-xl font-bold text-white">Admin HQ - London</h1>
                  {profile && (
                    <p className="text-xs text-gray-400">
                      Logged in as: {profile.username} {profile.is_admin ? '(Admin)' : ''}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={loadReports}
              disabled={loading}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-red-900/50 to-red-800/30 border border-red-700/50 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-red-400" />
              <div>
                <p className="text-sm text-gray-400">Active Reports</p>
                <p className="text-3xl font-bold text-white">
                  {reports.filter(r => r.status === 'active').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 border border-green-700/50 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-sm text-gray-400">Cleared</p>
                <p className="text-3xl font-bold text-white">
                  {reports.filter(r => r.status === 'cleared').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900/50 to-gray-800/30 border border-gray-700/50 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <Ban className="w-8 h-8 text-gray-400" />
              <div>
                <p className="text-sm text-gray-400">Banned</p>
                <p className="text-3xl font-bold text-white">
                  {reports.filter(r => r.status === 'banned').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
            <p className="text-gray-400">Loading reports...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Failed to Load Reports</h3>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadReports}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-all"
            >
              Try Again
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">All Clear!</h3>
            <p className="text-gray-400">No reports to review at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.report_id}
                className={`bg-gray-900 border rounded-xl p-6 ${
                  report.status === 'active'
                    ? 'border-red-500/50'
                    : report.status === 'cleared'
                    ? 'border-green-500/50'
                    : 'border-gray-700'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      report.status === 'active'
                        ? 'bg-red-500/20'
                        : report.status === 'cleared'
                        ? 'bg-green-500/20'
                        : 'bg-gray-700'
                    }`}>
                      <Flag className={`w-6 h-6 ${
                        report.status === 'active'
                          ? 'text-red-400'
                          : report.status === 'cleared'
                          ? 'text-green-400'
                          : 'text-gray-400'
                      }`} />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-white">
                        Report: {report.reported_username}
                      </p>
                      <p className="text-sm text-gray-400">
                        {report.reported_display_name || 'No display name'}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                    report.status === 'active'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : report.status === 'cleared'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-gray-700 text-gray-300 border border-gray-600'
                  }`}>
                    {report.status.toUpperCase()}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Reported By</p>
                    <p className="text-white font-medium">{report.reporter_username}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Reason</p>
                    <p className="text-white font-medium capitalize">{report.reason}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Submitted</p>
                    <p className="text-white font-medium">{formatDate(report.created_at)}</p>
                  </div>
                  {report.resolved_at && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Resolved</p>
                      <p className="text-white font-medium">{formatDate(report.resolved_at)}</p>
                    </div>
                  )}
                </div>

                {/* Admin Notes */}
                {report.status === 'active' ? (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Admin Notes (Optional)
                    </label>
                    <textarea
                      value={adminNotes[report.report_id] || ''}
                      onChange={(e) => setAdminNotes({
                        ...adminNotes,
                        [report.report_id]: e.target.value
                      })}
                      placeholder="Add notes about this decision..."
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                      rows={2}
                    />
                  </div>
                ) : report.admin_notes && (
                  <div className="mb-4 p-3 bg-gray-800 rounded-lg border border-gray-700">
                    <p className="text-xs text-gray-400 mb-1">Admin Notes:</p>
                    <p className="text-white text-sm">{report.admin_notes}</p>
                  </div>
                )}

                {/* Action Buttons - Only for active reports */}
                {report.status === 'active' && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleBanUser(report.report_id, report.reported_user_id)}
                      disabled={processingReportId === report.report_id}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {processingReportId === report.report_id ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <Ban className="w-5 h-5" />
                          <span>BAN USER</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleClearReport(report.report_id)}
                      disabled={processingReportId === report.report_id}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {processingReportId === report.report_id ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          <span>CLEAR REPORT</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
