import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Shield, Flag, AlertTriangle, Loader2, ArrowLeft, Clock, CheckCircle, XCircle, AlertOctagon, MessageCircleOff, Filter } from 'lucide-react';

interface ModerationCase {
  case_id: string;
  target_user_id: string;
  target_username: string;
  reporter_id: string;
  reporter_username: string;
  reason_code: string;
  reason_details: string | null;
  status: string;
  severity: string;
  appeal_deadline: string;
  appeal_text: string | null;
  appeal_submitted_at: string | null;
  is_resolved: boolean;
  resolution_action: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function AdminModeration() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<ModerationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingCaseId, setProcessingCaseId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [selectedResolution, setSelectedResolution] = useState<Record<string, string>>({});
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [filterStats, setFilterStats] = useState<any>(null);
  const [showFilteredComments, setShowFilteredComments] = useState(false);
  const adminCheckDoneRef = useRef(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    if (adminCheckDoneRef.current) return;

    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        console.log('[AdminModeration] admin check:', { isAdmin: data?.is_admin, userId: user.id });
        if (data?.is_admin !== true) {
          navigate('/dashboard', { replace: true });
          return;
        }
        adminCheckDoneRef.current = true;
        setIsAdmin(true);
        loadCases();
        loadFilterStats();
      });
  }, [user?.id, navigate]);

  const loadCases = async () => {
    console.log('[AdminModeration] Starting to load cases...');
    setLoading(true);
    setError('');

    try {
      const { data, error: rpcError } = await supabase.rpc('get_all_moderation_cases');

      if (rpcError) {
        console.error('[AdminModeration] RPC error:', rpcError);

        if (rpcError.message?.includes('Unauthorized') || rpcError.message?.includes('admin access required')) {
          setError('Access denied: Admin privileges required');
          navigate('/dashboard', { replace: true });
          return;
        }

        throw rpcError;
      }

      console.log('[AdminModeration] Cases loaded successfully');
      setCases(data || []);
      setError('');
    } catch (err) {
      console.error('[AdminModeration] Error loading cases:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load cases';
      setError(errorMessage);
      setCases([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFilterStats = async () => {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_filtered_comments_stats');

      if (rpcError) {
        console.error('[AdminModeration] Error loading filter stats:', rpcError);
        return;
      }

      if (data && data.length > 0) {
        setFilterStats(data[0]);
      }
    } catch (err) {
      console.error('[AdminModeration] Error loading filter stats:', err);
    }
  };

  const handleResolveCase = async (caseId: string) => {
    const resolution = selectedResolution[caseId];
    if (!resolution) {
      setError('Please select a resolution action');
      return;
    }

    const confirmMessage = resolution === 'Permanent Block'
      ? 'Are you sure you want to PERMANENTLY BLOCK this user? This action will disable their account and put them on a 30-day legal hold.'
      : `Are you sure you want to resolve this case with: ${resolution}?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    console.log('[AdminModeration] Resolving case:', { caseId, resolution });
    setProcessingCaseId(caseId);
    setError('');

    try {
      const notes = adminNotes[caseId] || '';

      const { data, error: rpcError } = await supabase.rpc('resolve_moderation_case', {
        p_case_id: caseId,
        p_resolution_action: resolution,
        p_admin_notes: notes || null
      });

      if (rpcError) {
        console.error('[AdminModeration] Resolve case RPC error:', rpcError);
        throw rpcError;
      }

      if (data && !data.success) {
        console.error('[AdminModeration] Resolve case failed:', data.error);
        throw new Error(data.error || 'Failed to resolve case');
      }

      console.log('[AdminModeration] Case resolved successfully');
      await loadCases();
      setExpandedCaseId(null);
    } catch (err) {
      console.error('[AdminModeration] Error resolving case:', err);
      setError(err instanceof Error ? err.message : 'Failed to resolve case');
    } finally {
      setProcessingCaseId(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'High': return 'text-orange-400 bg-orange-500/20 border-orange-500/30';
      case 'Medium': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Appealed': return 'text-cyan-400 bg-cyan-500/20';
      case 'Pending': return 'text-yellow-400 bg-yellow-500/20';
      case 'Resolved': return 'text-green-400 bg-green-500/20';
      case 'Auto-Escalated': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
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
      return `${days}d ${hours % 24}h`;
    }

    return `${hours}h ${minutes}m`;
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

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black pb-24">
      <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
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
                  <h1 className="text-xl font-bold text-white">Admin HQ - Moderation Center</h1>
                  {profile && (
                    <p className="text-xs text-gray-400">
                      {profile.username} • Admin
                    </p>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={loadCases}
              disabled={loading}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-cyan-900/30 to-cyan-800/20 border border-cyan-700/50 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <Flag className="w-8 h-8 text-cyan-400" />
              <div>
                <p className="text-sm text-gray-400">Total Cases</p>
                <p className="text-3xl font-bold text-white">{cases.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 border border-yellow-700/50 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <Clock className="w-8 h-8 text-yellow-400" />
              <div>
                <p className="text-sm text-gray-400">Pending</p>
                <p className="text-3xl font-bold text-white">
                  {cases.filter(c => c.status === 'Pending').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-cyan-900/30 to-blue-800/20 border border-cyan-700/50 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <AlertOctagon className="w-8 h-8 text-cyan-400" />
              <div>
                <p className="text-sm text-gray-400">Appealed</p>
                <p className="text-3xl font-bold text-white">
                  {cases.filter(c => c.status === 'Appealed').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-900/30 to-green-800/20 border border-green-700/50 rounded-xl p-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-sm text-gray-400">Resolved</p>
                <p className="text-3xl font-bold text-white">
                  {cases.filter(c => c.is_resolved).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Filtered Comments Section */}
        {filterStats && (
          <div className="mb-8">
            <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/20 border border-purple-700/50 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Filter className="w-6 h-6 text-purple-400" />
                  <div>
                    <h2 className="text-xl font-bold text-white">Profanity Filter</h2>
                    <p className="text-sm text-gray-400">Auto-blocking inappropriate comments</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFilteredComments(!showFilteredComments)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-all"
                >
                  {showFilteredComments ? 'Hide Details' : 'View Details'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-black/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageCircleOff className="w-5 h-5 text-purple-400" />
                    <p className="text-sm text-gray-400">Total Blocked</p>
                  </div>
                  <p className="text-3xl font-bold text-white">{filterStats.total_filtered || 0}</p>
                </div>

                <div className="bg-black/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-yellow-400" />
                    <p className="text-sm text-gray-400">Today</p>
                  </div>
                  <p className="text-3xl font-bold text-white">{filterStats.filtered_today || 0}</p>
                </div>

                <div className="bg-black/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5 text-orange-400" />
                    <p className="text-sm text-gray-400">This Week</p>
                  </div>
                  <p className="text-3xl font-bold text-white">{filterStats.filtered_this_week || 0}</p>
                </div>
              </div>

              {showFilteredComments && filterStats.recent_logs && (
                <div className="mt-6 pt-6 border-t border-purple-700/50">
                  <h3 className="text-lg font-bold text-white mb-4">Recent Blocked Comments</h3>
                  <div className="space-y-3">
                    {filterStats.recent_logs.slice(0, 10).map((log: any) => (
                      <div key={log.id} className="bg-black/30 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-white">{log.username}</p>
                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                              log.filter_reason === 'profanity' ? 'bg-red-500/20 text-red-400' :
                              log.filter_reason === 'url' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {log.filter_reason.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {new Date(log.created_at).toLocaleString()}
                          </p>
                        </div>
                        <p className="text-sm text-gray-300 mb-2 italic">"{log.comment_text}"</p>
                        {log.matched_words && log.matched_words.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {log.matched_words.map((word: string, idx: number) => (
                              <span key={idx} className="px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-300">
                                {word}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
            <p className="text-gray-400">Loading moderation cases...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Failed to Load Cases</h3>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadCases}
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-all"
            >
              Try Again
            </button>
          </div>
        ) : cases.length === 0 ? (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-white mb-2">All Clear!</h3>
            <p className="text-gray-400">No moderation cases to review at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cases.map((moderationCase) => {
              const isExpanded = expandedCaseId === moderationCase.case_id;
              const timeRemaining = getTimeRemaining(moderationCase.appeal_deadline);

              return (
                <div
                  key={moderationCase.case_id}
                  className={`bg-gray-900 border rounded-xl transition-all ${
                    moderationCase.status === 'Appealed'
                      ? 'border-cyan-500/50 shadow-lg shadow-cyan-500/20'
                      : moderationCase.status === 'Pending'
                      ? 'border-yellow-500/50'
                      : moderationCase.is_resolved
                      ? 'border-green-500/30'
                      : 'border-gray-700'
                  }`}
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold text-white">
                            {moderationCase.target_username}
                          </h3>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getSeverityColor(moderationCase.severity)}`}>
                            {moderationCase.severity}
                          </div>
                          <div className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(moderationCase.status)}`}>
                            {moderationCase.status}
                          </div>
                        </div>
                        <p className="text-gray-400 text-sm mb-1">
                          <span className="font-semibold">{moderationCase.reason_code}</span>
                        </p>
                        <p className="text-gray-500 text-sm">
                          Reported by: {moderationCase.reporter_username} • {formatDate(moderationCase.created_at)}
                        </p>
                      </div>

                      <button
                        onClick={() => setExpandedCaseId(isExpanded ? null : moderationCase.case_id)}
                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-all"
                      >
                        {isExpanded ? 'Collapse' : 'View Details'}
                      </button>
                    </div>

                    {moderationCase.reason_details && (
                      <div className="bg-black/30 rounded-lg p-3 mb-4">
                        <p className="text-sm text-gray-300">{moderationCase.reason_details}</p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className={`${timeRemaining === 'Expired' ? 'text-red-400' : 'text-gray-300'}`}>
                          Appeal: {timeRemaining}
                        </span>
                      </div>
                      {moderationCase.appeal_submitted_at && (
                        <div className="text-cyan-400 font-semibold">
                          ✓ Appeal Submitted
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="mt-6 pt-6 border-t border-gray-700 space-y-4">
                        {moderationCase.appeal_text && (
                          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                            <p className="text-sm font-semibold text-cyan-300 mb-2">User's Appeal:</p>
                            <p className="text-white">{moderationCase.appeal_text}</p>
                            <p className="text-xs text-cyan-400 mt-2">
                              Submitted: {formatDate(moderationCase.appeal_submitted_at!)}
                            </p>
                          </div>
                        )}

                        {!moderationCase.is_resolved ? (
                          <div className="bg-gray-800 rounded-lg p-4 space-y-4">
                            <div>
                              <label className="block text-sm font-semibold text-gray-300 mb-2">
                                Resolution Action
                              </label>
                              <select
                                value={selectedResolution[moderationCase.case_id] || ''}
                                onChange={(e) => setSelectedResolution(prev => ({
                                  ...prev,
                                  [moderationCase.case_id]: e.target.value
                                }))}
                                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                                disabled={processingCaseId === moderationCase.case_id}
                              >
                                <option value="">Select action...</option>
                                <option value="None">Dismiss (No Action)</option>
                                <option value="Warning">Issue Warning</option>
                                <option value="7-Day Suspension">7-Day Suspension</option>
                                <option value="Permanent Block">Permanent Block</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-sm font-semibold text-gray-300 mb-2">
                                Admin Notes (Optional)
                              </label>
                              <textarea
                                value={adminNotes[moderationCase.case_id] || ''}
                                onChange={(e) => setAdminNotes(prev => ({
                                  ...prev,
                                  [moderationCase.case_id]: e.target.value
                                }))}
                                placeholder="Add notes about your decision..."
                                rows={3}
                                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 resize-none"
                                disabled={processingCaseId === moderationCase.case_id}
                              />
                            </div>

                            <button
                              onClick={() => handleResolveCase(moderationCase.case_id)}
                              disabled={
                                processingCaseId === moderationCase.case_id ||
                                !selectedResolution[moderationCase.case_id]
                              }
                              className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                              {processingCaseId === moderationCase.case_id ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Processing...</span>
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4" />
                                  <span>Resolve Case</span>
                                </>
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                            <p className="text-green-300 font-semibold mb-2">
                              ✓ Case Resolved: {moderationCase.resolution_action}
                            </p>
                            {moderationCase.admin_notes && (
                              <p className="text-gray-300 text-sm mb-2">
                                <span className="font-semibold">Admin Notes:</span> {moderationCase.admin_notes}
                              </p>
                            )}
                            <p className="text-xs text-gray-400">
                              Resolved: {formatDate(moderationCase.resolved_at!)}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
