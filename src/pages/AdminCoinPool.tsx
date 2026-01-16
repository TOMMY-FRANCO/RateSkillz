import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, RefreshCw, AlertCircle, CheckCircle, TrendingUp, Users, Database, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCoinPool } from '../hooks/useCoinPool';

interface DiscrepancyLog {
  id: string;
  correction_type: string;
  old_balance: number;
  new_balance: number;
  discrepancy: number;
  notes: string;
  corrected_at: string;
}

export default function AdminCoinPool() {
  const navigate = useNavigate();
  const { stats, loading, syncing, syncPool, refetch } = useCoinPool();
  const [logs, setLogs] = useState<DiscrepancyLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    loadDiscrepancyLogs();
  }, []);

  async function loadDiscrepancyLogs() {
    try {
      setLogsLoading(true);
      const { data, error } = await supabase
        .rpc('get_coin_pool_discrepancy_logs', { limit_count: 20 });

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
      await syncPool();
      await loadDiscrepancyLogs();
    } catch (error) {
      console.error('Sync failed:', error);
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
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Coin Pool Admin Dashboard</h1>
          <p className="text-white/60">Monitor and manage coin pool integrity</p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
            <p className="text-white/60">Loading pool status...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Database className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="text-white/60 text-sm font-medium">Total Pool</h3>
                </div>
                <p className="text-2xl font-bold text-white">
                  {stats.total_coins.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                  </div>
                  <h3 className="text-white/60 text-sm font-medium">Actual Distributed</h3>
                </div>
                <p className="text-2xl font-bold text-white">
                  {stats.actual_distributed.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <Coins className="w-5 h-5 text-purple-400" />
                  </div>
                  <h3 className="text-white/60 text-sm font-medium">Remaining</h3>
                </div>
                <p className="text-2xl font-bold text-white">
                  {stats.remaining_coins.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
                <div className="flex items-center gap-3 mb-3">
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

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Activity className="w-6 h-6 text-white" />
                  <h2 className="text-xl font-bold text-white">Pool Integrity Status</h2>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                    <TrendingUp className="w-5 h-5 text-blue-400" />
                    <span className="text-white/60 text-sm">Distribution</span>
                  </div>
                  <p className="text-lg font-bold text-white">
                    {stats.distribution_percentage.toFixed(6)}%
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Recorded Distributed:</span>
                  <span className="font-mono text-white">{stats.distributed_coins.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-white/60">Actual Distributed:</span>
                  <span className="font-mono text-white">{stats.actual_distributed.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-white/60">Last Updated:</span>
                  <span className="text-white/60">{formatDate(stats.last_updated)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-orange-400" />
                  <h2 className="text-xl font-bold text-white">Discrepancy Logs</h2>
                </div>
                <button
                  onClick={loadDiscrepancyLogs}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Refresh logs"
                >
                  <RefreshCw className="w-4 h-4 text-white/70" />
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
                  <p className="text-white/60">No discrepancies detected</p>
                  <p className="text-white/40 text-sm mt-1">Pool has been perfectly in sync</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                          <span className="text-white font-semibold">{log.correction_type}</span>
                        </div>
                        <span className="text-white/40 text-sm">{formatDate(log.corrected_at)}</span>
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
                        <p className="text-white/60 text-sm bg-white/5 rounded p-2 font-mono">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
