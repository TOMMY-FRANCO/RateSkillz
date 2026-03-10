import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, RefreshCw, AlertCircle, CheckCircle, TrendingUp, Users, Database, Activity, Lock, Shield, Trash2, Loader2, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { reconcileUserBalance } from '../lib/balanceReconciliation';
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

interface UserDiscrepancy {
  user_id: string;
  username: string | null;
  profile_balance: number;
  latest_transaction_balance: number;
  discrepancy: number;
  status: string;
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
  const [logFilter, setLogFilter] = useState<'active' | 'resolved' | 'all'>('active');
  const [clearingWarnings, setClearingWarnings] = useState(false);
  const [clearResult, setClearResult] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [userDiscrepancies, setUserDiscrepancies] = useState<UserDiscrepancy[]>([]);
  const [discrepanciesLoading, setDiscrepanciesLoading] = useState(false);
  const [resolvingUser, setResolvingUser] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    loadDiscrepancyLogs();
  }, [logFilter]);

  async function loadAllData() {
    await Promise.all([
      loadCoinPoolStats(),
      loadResourcePools(),
      loadDiscrepancyLogs(),
      loadUserDiscrepancies()
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

      console.log('[AdminCoinPool] Coin pool stats loaded');
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

  async function loadUserDiscrepancies() {
    try {
      setDiscrepanciesLoading(true);
      const { data, error } = await supabase
        .from('balance_verification')
        .select('user_id, status, discrepancy, profile_balance, latest_transaction_balance')
        .eq('status', 'DISCREPANCY');

      if (error) throw error;

      if (!data || data.length === 0) {
        setUserDiscrepancies([]);
        return;
      }

      const userIds = data.map((d: any) => d.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const usernameMap = new Map((profiles || []).map((p: any) => [p.id, p.username]));

      const discrepancies: UserDiscrepancy[] = data.map((d: any) => ({
        user_id: d.user_id,
        username: usernameMap.get(d.user_id) || null,
        profile_balance: typeof d.profile_balance === 'string' ? parseFloat(d.profile_balance) : (d.profile_balance || 0),
        latest_transaction_balance: typeof d.latest_transaction_balance === 'string' ? parseFloat(d.latest_transaction_balance) : (d.latest_transaction_balance || 0),
        discrepancy: typeof d.discrepancy === 'string' ? parseFloat(d.discrepancy) : (d.discrepancy || 0),
        status: d.status,
      }));

      setUserDiscrepancies(discrepancies);
    } catch (error) {
      console.error('Error loading user discrepancies:', error);
    } finally {
      setDiscrepanciesLoading(false);
    }
  }

  async function handleResolveDiscrepancy(userId: string) {
    if (!confirm('Resolve this user\'s balance discrepancy? Their balance will be corrected to match their transaction history.')) {
      return;
    }

    try {
      setResolvingUser(userId);
      const result = await reconcileUserBalance(userId);

      if (result.success) {
        await Promise.all([
          loadUserDiscrepancies(),
          loadCoinPoolStats(),
          loadDiscrepancyLogs()
        ]);
      } else {
        console.error('Reconciliation failed:', result.error);
        alert(`Failed to resolve: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error resolving discrepancy:', error);
      alert(`Error: ${error.message || 'Unknown error'}`);
    } finally {
      setResolvingUser(null);
    }
  }

  async function handleSync() {
    try {
      setSyncing(true);
      const { data, error } = await supabase
        .rpc('sync_coin_pool_integrity')
        .single();

      if (error) throw error;

      console.log('Sync completed');
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

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6 border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <UserX className="w-6 h-6 text-red-400" />
                  <div>
                    <h2 className="text-xl font-bold text-white">User Balance Discrepancies</h2>
                    <p className="text-white/60 text-sm mt-1">Users whose profile balance does not match their transaction history</p>
                  </div>
                </div>
                <button
                  onClick={loadUserDiscrepancies}
                  disabled={discrepanciesLoading}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Refresh discrepancies"
                >
                  <RefreshCw className={`w-4 h-4 text-white/70 ${discrepanciesLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {discrepanciesLoading ? (
                <div className="text-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-white/60 mx-auto mb-3" />
                  <p className="text-white/60 text-sm">Scanning for discrepancies...</p>
                </div>
              ) : userDiscrepancies.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-white/60">No balance discrepancies detected</p>
                  <p className="text-white/40 text-sm mt-1">All user balances match their transaction history</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4">
                    <p className="text-red-300 text-sm font-medium">
                      {userDiscrepancies.length} user{userDiscrepancies.length !== 1 ? 's' : ''} with balance mismatches detected
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-3 text-white/60 font-medium">User</th>
                          <th className="text-right py-3 px-3 text-white/60 font-medium">Profile Balance</th>
                          <th className="text-right py-3 px-3 text-white/60 font-medium">Expected Balance</th>
                          <th className="text-right py-3 px-3 text-white/60 font-medium">Difference</th>
                          <th className="text-right py-3 px-3 text-white/60 font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userDiscrepancies.map((d) => (
                          <tr key={d.user_id} className="border-b border-white/5 hover:bg-white/5">
                            <td className="py-3 px-3">
                              <span className="text-white font-medium">{d.username || 'Unknown'}</span>
                              <p className="text-white/40 text-xs font-mono mt-0.5">{d.user_id.slice(0, 8)}...</p>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-white">
                              {d.profile_balance.toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-white">
                              {d.latest_transaction_balance.toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <span className={`font-mono font-bold ${d.discrepancy > 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                                {d.discrepancy > 0 ? '+' : ''}{d.discrepancy.toFixed(2)}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => handleResolveDiscrepancy(d.user_id)}
                                disabled={resolvingUser === d.user_id}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-300 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {resolvingUser === d.user_id ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Resolving...
                                  </>
                                ) : (
                                  <>
                                    <RefreshCw className="w-3 h-3" />
                                    Resolve
                                  </>
                                )}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

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
