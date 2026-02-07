import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, RefreshCw, AlertCircle, CheckCircle, TrendingUp, Users, Database, Activity, Lock, Shield, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import SystemLedgerManagement from '../components/SystemLedgerManagement';

interface ResourcePool {
  id: string;
  pool_name: string;
  pool_type: string;
  total_coins: number;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CoinPoolStats {
  pool_name: string;
  total_coins: number;
  distributed_coins: number;
  actual_distributed: number;
  remaining_coins: number;
  discrepancy: number;
  is_synced: boolean;
  total_users_with_coins: number;
  last_updated: string;
}

interface DiscrepancyLog {
  id: string;
  user_id: string | null;
  username: string | null;
  correction_type: string;
  old_balance: number;
  new_balance: number;
  discrepancy: number;
  notes: string;
  corrected_by: string | null;
  corrected_at: string;
  status: string;
}

export default function AdminCoinPool() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<CoinPoolStats | null>(null);
  const [resourcePools, setResourcePools] = useState<ResourcePool[]>([]);
  const [logs, setLogs] = useState<DiscrepancyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [logsLoading, setLogsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [logFilter, setLogFilter] = useState<'active' | 'resolved' | 'all'>('active');
  const [clearingWarnings, setClearingWarnings] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      checkAdminAccess();
    }
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      loadAllData();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      loadDiscrepancyLogs();
    }
  }, [logFilter]);

  async function checkAdminAccess() {
    // Don't re-check if already verified as admin
    if (isAdmin) {
      console.log('[AdminCoinPool] Already verified as admin, skipping check');
      return;
    }

    console.log('[AdminCoinPool] Starting admin access check...');
    console.log('[AdminCoinPool] User:', user?.id, user?.email);

    try {
      if (!user) {
        console.error('[AdminCoinPool] No user found - redirecting to home');
        setAdminError('Not logged in. Please log in to access this page.');
        setCheckingAdmin(false);
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      let isUserAdmin = false;

      try {
        console.log('[AdminCoinPool] Calling is_user_admin RPC...');
        const { data, error } = await supabase
          .rpc('is_user_admin', { p_user_id: user.id })
          .single();

        if (error) {
          console.warn('[AdminCoinPool] RPC call failed, falling back to direct query:', error);

          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single();

          if (profileError) {
            console.error('[AdminCoinPool] Direct query also failed:', profileError);
            throw profileError;
          }

          console.log('[AdminCoinPool] Direct query result:', profileData);
          isUserAdmin = profileData?.is_admin || false;
        } else {
          console.log('[AdminCoinPool] RPC result:', data);
          isUserAdmin = data || false;
        }
      } catch (err: any) {
        console.error('[AdminCoinPool] Error checking admin status:', err);
        setAdminError(`Error checking admin status: ${err.message || 'Unknown error'}`);
        isUserAdmin = false;
      }

      console.log('[AdminCoinPool] Admin check result:', isUserAdmin);

      if (!isUserAdmin) {
        console.warn('[AdminCoinPool] User is not an admin - access denied');
        setAdminError('Access denied. You do not have admin privileges.');

        try {
          await supabase.rpc('log_admin_access', {
            p_user_id: user.id,
            p_action_type: 'access_denied',
            p_resource_accessed: 'admin_coin_pool',
            p_access_granted: false,
            p_notes: 'User attempted to access admin dashboard without admin privileges'
          });
        } catch (logError) {
          console.warn('[AdminCoinPool] Failed to log access denial:', logError);
        }

        setCheckingAdmin(false);
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      console.log('[AdminCoinPool] Admin access granted!');
      setIsAdmin(true);
      setAdminError(null);
      setCheckingAdmin(false);

      try {
        await supabase.rpc('log_admin_access', {
          p_user_id: user.id,
          p_action_type: 'access_granted',
          p_resource_accessed: 'admin_coin_pool',
          p_access_granted: true,
          p_notes: 'Admin accessed coin pool dashboard'
        });
      } catch (logError) {
        console.warn('[AdminCoinPool] Failed to log access grant:', logError);
      }

    } catch (error: any) {
      console.error('[AdminCoinPool] Critical error checking admin access:', error);
      setAdminError(`Critical error: ${error.message || 'Unknown error'}`);
      setCheckingAdmin(false);
      setTimeout(() => navigate('/'), 2000);
    }
  }

  async function loadAllData() {
    await Promise.all([
      loadCoinPoolStats(),
      loadResourcePools(),
      loadDiscrepancyLogs()
    ]);
  }

  async function loadCoinPoolStats() {
    try {
      setLoading(true);
      setLoadError(null);
      console.log('[AdminCoinPool] Loading coin pool stats...');

      const { data, error } = await supabase
        .rpc('get_coin_pool_status')
        .single();

      if (error) {
        console.error('[AdminCoinPool] Error from get_coin_pool_status:', error);
        throw error;
      }

      console.log('[AdminCoinPool] Coin pool stats loaded:', data);
      setStats(data);
      setLastRefresh(new Date());
    } catch (error: any) {
      console.error('[AdminCoinPool] Error loading coin pool stats:', error);
      setLoadError(`Failed to load coin pool stats: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadResourcePools() {
    try {
      const { data, error } = await supabase
        .rpc('get_resource_pools');

      if (error) throw error;

      setResourcePools(data || []);
    } catch (error) {
      console.error('Error loading resource pools:', error);
    }
  }

  async function loadDiscrepancyLogs() {
    try {
      setLogsLoading(true);
      const { data, error } = await supabase
        .rpc('get_audit_log_by_status', { p_status: logFilter });

      if (error) throw error;

      setLogs(data || []);
    } catch (error) {
      console.error('Error loading discrepancy logs:', error);
    } finally {
      setLogsLoading(false);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      const { data, error } = await supabase
        .rpc('sync_coin_pool_integrity')
        .single();

      if (error) throw error;

      console.log('Sync result:', data);
      await loadAllData();
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setSyncing(false);
    }
  }

  async function handleRefresh() {
    await loadAllData();
  }

  async function handleClearStaleWarnings() {
    if (!confirm('Clear all stale balance warnings? This will remove old warning notifications for users with verified balances.')) {
      return;
    }

    try {
      setClearingWarnings(true);
      setClearResult(null);

      const { data, error } = await supabase
        .rpc('clear_warnings_for_resolved_users');

      if (error) throw error;

      const result = data as { success: boolean; users_cleared: number; total_warnings_cleared: number };
      setClearResult(`Successfully cleared ${result.total_warnings_cleared} warnings for ${result.users_cleared} users`);

      await loadDiscrepancyLogs();
    } catch (error) {
      console.error('Failed to clear warnings:', error);
      setClearResult('Failed to clear warnings. Please try again.');
    } finally {
      setClearingWarnings(false);
      setTimeout(() => setClearResult(null), 5000);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  }

  if (checkingAdmin || adminError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          {adminError ? (
            <>
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
              <p className="text-white/80 mb-4">{adminError}</p>
              <p className="text-white/60 text-sm">Redirecting to home page...</p>
            </>
          ) : (
            <>
              <Shield className="w-12 h-12 text-blue-400 animate-pulse mx-auto mb-4" />
              <p className="text-white/60">Verifying admin access...</p>
              <p className="text-white/40 text-sm mt-2">Please wait while we check your permissions</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Coin Pool Admin Dashboard</h1>
          <p className="text-white/60">Monitor and manage coin pool integrity</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <Lock className="w-4 h-4 text-yellow-400" />
            <span className="text-yellow-400 text-sm font-medium">Admin Access Only</span>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-6 border border-white/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white/60 text-sm">
              <Activity className="w-4 h-4" />
              Last refreshed: {lastRefresh.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg font-medium transition-colors text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh All Data
            </button>
          </div>
        </div>

        {loadError && (
          <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-6 mb-6 border border-red-500/50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="text-red-400 font-bold mb-2">Error Loading Data</h3>
                <p className="text-white/80 text-sm">{loadError}</p>
                <button
                  onClick={handleRefresh}
                  className="mt-3 px-4 py-2 bg-red-500/30 hover:bg-red-500/40 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && !stats ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
            <p className="text-white/60">Loading pool status...</p>
            <p className="text-white/40 text-sm mt-2">This may take a moment...</p>
          </div>
        ) : stats ? (
          <>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Coins className="w-6 h-6 text-green-400" />
                    {stats.pool_name}
                  </h2>
                  <p className="text-white/60 text-sm mt-1">Primary pool for user rewards, ad viewing, comments, and all community distributions</p>
                </div>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white rounded-lg font-medium transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Database className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-white/60 text-sm font-medium">Total Pool</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {stats.total_coins.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-green-400" />
                    </div>
                    <h3 className="text-white/60 text-sm font-medium">Actual Distributed</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {stats.actual_distributed.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Coins className="w-5 h-5 text-purple-400" />
                    </div>
                    <h3 className="text-white/60 text-sm font-medium">Remaining</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {stats.remaining_coins.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                      <Users className="w-5 h-5 text-yellow-400" />
                    </div>
                    <h3 className="text-white/60 text-sm font-medium">Active Users</h3>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {stats.total_users_with_coins.toLocaleString('en-GB')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/10">
                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {stats.is_synced ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-400" />
                    )}
                    <span className="text-white/60 text-sm">Sync Status</span>
                  </div>
                  <p className={`text-lg font-bold ${stats.is_synced ? 'text-green-400' : 'text-yellow-400'}`}>
                    {stats.is_synced ? 'In Sync' : 'Out of Sync'}
                  </p>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Coins className="w-5 h-5 text-yellow-400" />
                    <span className="text-white/60 text-sm">Discrepancy</span>
                  </div>
                  <p className={`text-lg font-bold ${Math.abs(stats.discrepancy) > 0.01 ? 'text-red-400' : 'text-green-400'}`}>
                    {stats.discrepancy.toFixed(2)} coins
                  </p>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    <span className="text-white/60 text-sm">Last Updated</span>
                  </div>
                  <p className="text-sm font-medium text-white">
                    {formatDate(stats.last_updated)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-6 h-6 text-orange-400" />
                <h2 className="text-xl font-bold text-white">Resource Pools (Read-Only)</h2>
              </div>
              <p className="text-white/60 text-sm mb-6">Non-revenue reserve pools. These are never touched by automated distribution systems.</p>

              <div className="space-y-4">
                {resourcePools.map((pool) => (
                  <div key={pool.id} className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-bold text-lg mb-1">{pool.pool_name}</h3>
                        <p className="text-white/60 text-sm mb-3">{pool.description}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-white/40 text-xs uppercase tracking-wider">{pool.pool_type}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-white">
                          {pool.total_coins.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-white/40 text-xs mt-1">Total Reserve</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <SystemLedgerManagement />

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-orange-400" />
                  <h2 className="text-xl font-bold text-white">Balance Audit Log</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClearStaleWarnings}
                    disabled={clearingWarnings}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Clear stale balance warnings for resolved users"
                  >
                    <Trash2 className={`w-4 h-4 ${clearingWarnings ? 'animate-pulse' : ''}`} />
                    <span className="text-sm font-medium">Clear Stale Warnings</span>
                  </button>
                  <button
                    onClick={loadDiscrepancyLogs}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    title="Refresh logs"
                  >
                    <RefreshCw className="w-4 h-4 text-white/70" />
                  </button>
                </div>
              </div>

              {clearResult && (
                <div className={`mb-4 px-4 py-3 rounded-lg ${
                  clearResult.includes('Successfully')
                    ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                    : 'bg-red-500/20 text-red-300 border border-red-500/30'
                }`}>
                  <p className="text-sm font-medium">{clearResult}</p>
                </div>
              )}

              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setLogFilter('active')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    logFilter === 'active'
                      ? 'bg-orange-500 text-white shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  Active Warnings
                  {logFilter === 'active' && logs.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                      {logs.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setLogFilter('resolved')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    logFilter === 'resolved'
                      ? 'bg-green-500 text-white shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  Resolved Issues
                </button>
                <button
                  onClick={() => setLogFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    logFilter === 'all'
                      ? 'bg-blue-500 text-white shadow-lg'
                      : 'bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  All History
                </button>
              </div>

              {logsLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-6 h-6 border-4 border-white/20 border-t-white rounded-full mx-auto mb-3"></div>
                  <p className="text-white/60 text-sm">Loading logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-white/60">
                    {logFilter === 'active'
                      ? 'No active warnings'
                      : logFilter === 'resolved'
                      ? 'No resolved issues'
                      : 'No audit log entries'}
                  </p>
                  <p className="text-white/40 text-sm mt-1">
                    {logFilter === 'active' && 'All systems operating normally'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          {log.status === 'active' ? (
                            <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                          )}
                          <div>
                            <span className="text-white font-semibold">{log.correction_type}</span>
                            {log.username && (
                              <span className="ml-2 text-white/40 text-sm">({log.username})</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            log.status === 'active'
                              ? 'bg-orange-500/20 text-orange-400'
                              : log.status === 'resolved'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {log.status}
                          </span>
                          <p className="text-white/40 text-xs mt-1">{formatDate(log.corrected_at)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                        <div>
                          <span className="text-white/60">Old: </span>
                          <span className="font-mono text-white">{log.old_balance.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-white/60">New: </span>
                          <span className="font-mono text-white">{log.new_balance.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-white/60">Discrepancy: </span>
                          <span className={`font-mono font-bold ${log.discrepancy > 0 ? 'text-red-400' : 'text-green-400'}`}>
                            {log.discrepancy > 0 ? '+' : ''}{log.discrepancy.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {log.notes && (
                        <p className="text-white/60 text-sm bg-white/5 rounded p-2 font-mono leading-relaxed">
                          {log.notes}
                        </p>
                      )}

                      {log.corrected_by && (
                        <p className="text-white/40 text-xs mt-2">
                          Corrected by: {log.corrected_by}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
