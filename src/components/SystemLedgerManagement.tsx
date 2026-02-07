import { useState, useEffect } from 'react';
import { Calendar, Database, CheckCircle, AlertTriangle, TrendingUp, RefreshCw, ArrowRight, Coins } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LedgerEntry {
  id: string;
  source_pool: string;
  destination_pool: string;
  amount: number;
  reason: string;
  transfer_date: string;
  notes: string | null;
}

interface PoolIntegrityResult {
  sync_date: string;
  pools_checked: number;
  pools_with_issues: number;
  total_discrepancy: number;
  overall_status: 'HEALTHY' | 'ISSUES_DETECTED';
  pool_details: Array<{
    pool_name: string;
    current_balance: number;
    ledger_inflow: number;
    ledger_outflow: number;
    net_ledger_change: number;
    discrepancy: number;
    status: 'SYNCED' | 'INITIAL_BALANCE' | 'DISCREPANCY_DETECTED';
    notes: string;
  }>;
}

export default function SystemLedgerManagement() {
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [integrityResult, setIntegrityResult] = useState<PoolIntegrityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [distributionResult, setDistributionResult] = useState<any>(null);

  useEffect(() => {
    loadLedgerHistory();
  }, []);

  async function loadLedgerHistory() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .rpc('get_system_ledger_history', { p_limit: 50, p_offset: 0 });

      if (error) throw error;
      setLedgerEntries(data || []);
    } catch (error) {
      console.error('Error loading ledger history:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyIntegrity() {
    try {
      setVerifying(true);
      const { data, error } = await supabase
        .rpc('verify_pool_integrity')
        .single();

      if (error) throw error;
      setIntegrityResult(data);
    } catch (error) {
      console.error('Error verifying integrity:', error);
    } finally {
      setVerifying(false);
    }
  }

  async function handleMonthlyDistribution() {
    if (!confirm('Execute monthly distribution? This will transfer 4,000 coins from Infrastructure_Reserve (2,000 to Coder_Credits, 2,000 to Monthly_Infrastructure_Cost).')) {
      return;
    }

    try {
      setDistributing(true);
      setDistributionResult(null);

      const { data, error } = await supabase
        .rpc('execute_monthly_distribution')
        .single();

      if (error) throw error;
      setDistributionResult(data);

      if (data.success) {
        await loadLedgerHistory();
      }
    } catch (error) {
      console.error('Error executing distribution:', error);
      setDistributionResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setDistributing(false);
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
      hour12: false,
    }).format(date);
  }

  function formatNumber(num: number) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }

  return (
    <div className="space-y-6">
      {/* Monthly Distribution Card */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Monthly Distribution</h3>
              <p className="text-white/60 text-sm">Execute monthly 4,000 coin distribution</p>
            </div>
          </div>
          <button
            onClick={handleMonthlyDistribution}
            disabled={distributing}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-purple-500/50 transition-all disabled:opacity-50"
          >
            {distributing ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Distributing...
              </span>
            ) : (
              'Execute Distribution'
            )}
          </button>
        </div>

        {distributionResult && (
          <div className={`mt-4 p-4 rounded-lg ${distributionResult.success ? 'bg-green-500/20 border border-green-500/50' : 'bg-red-500/20 border border-red-500/50'}`}>
            {distributionResult.success ? (
              <div>
                <div className="flex items-center gap-2 text-green-400 font-medium mb-2">
                  <CheckCircle className="w-5 h-5" />
                  Distribution Successful
                </div>
                <div className="text-white/80 text-sm space-y-1">
                  <p>Date: {formatDate(distributionResult.distribution_date)}</p>
                  <p>Total Distributed: {formatNumber(distributionResult.total_distributed)} coins</p>
                  <div className="mt-2 space-y-1">
                    {distributionResult.transfers?.map((transfer: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-white/60">
                        <ArrowRight className="w-4 h-4" />
                        {transfer.from} → {transfer.to}: {formatNumber(transfer.amount)} coins
                      </div>
                    ))}
                  </div>
                  <p className="mt-2">New Infrastructure Reserve Balance: {formatNumber(distributionResult.new_infrastructure_balance)} coins</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
                  <AlertTriangle className="w-5 h-5" />
                  Distribution Failed
                </div>
                <p className="text-white/80 text-sm">{distributionResult.error}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Integrity Verification Card */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Pool Integrity Verification</h3>
              <p className="text-white/60 text-sm">Compare pools against system ledger</p>
            </div>
          </div>
          <button
            onClick={handleVerifyIntegrity}
            disabled={verifying}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg font-medium hover:shadow-lg hover:shadow-blue-500/50 transition-all disabled:opacity-50"
          >
            {verifying ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Verifying...
              </span>
            ) : (
              'Verify Integrity'
            )}
          </button>
        </div>

        {integrityResult && (
          <div className="mt-4 space-y-4">
            <div className={`p-4 rounded-lg ${integrityResult.overall_status === 'HEALTHY' ? 'bg-green-500/20 border border-green-500/50' : 'bg-yellow-500/20 border border-yellow-500/50'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {integrityResult.overall_status === 'HEALTHY' ? (
                    <CheckCircle className="w-5 h-5 text-green-400" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                  )}
                  <span className="font-medium text-white">
                    {integrityResult.overall_status === 'HEALTHY' ? 'All Pools Healthy' : 'Issues Detected'}
                  </span>
                </div>
                <span className="text-white/60 text-sm">{formatDate(integrityResult.sync_date)}</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-white/60">Pools Checked</p>
                  <p className="text-white font-medium">{integrityResult.pools_checked}</p>
                </div>
                <div>
                  <p className="text-white/60">Issues Found</p>
                  <p className="text-white font-medium">{integrityResult.pools_with_issues}</p>
                </div>
                <div>
                  <p className="text-white/60">Total Discrepancy</p>
                  <p className="text-white font-medium">{formatNumber(integrityResult.total_discrepancy)} coins</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {integrityResult.pool_details.map((pool) => (
                <div
                  key={pool.pool_name}
                  className={`p-3 rounded-lg border ${
                    pool.status === 'SYNCED'
                      ? 'bg-green-500/10 border-green-500/30'
                      : pool.status === 'INITIAL_BALANCE'
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'bg-yellow-500/10 border-yellow-500/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">{pool.pool_name}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      pool.status === 'SYNCED'
                        ? 'bg-green-500/20 text-green-400'
                        : pool.status === 'INITIAL_BALANCE'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {pool.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs text-white/60">
                    <div>
                      <p>Balance</p>
                      <p className="text-white">{formatNumber(pool.current_balance)}</p>
                    </div>
                    <div>
                      <p>Inflow</p>
                      <p className="text-white">{formatNumber(pool.ledger_inflow)}</p>
                    </div>
                    <div>
                      <p>Outflow</p>
                      <p className="text-white">{formatNumber(pool.ledger_outflow)}</p>
                    </div>
                    <div>
                      <p>Discrepancy</p>
                      <p className="text-white">{formatNumber(pool.discrepancy)}</p>
                    </div>
                  </div>
                  <p className="text-white/60 text-xs mt-2">{pool.notes}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* System Ledger History */}
      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">System Ledger History</h3>
              <p className="text-white/60 text-sm">Recent pool-to-pool transfers</p>
            </div>
          </div>
          <button
            onClick={loadLedgerHistory}
            disabled={loading}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 text-white/40 animate-spin mx-auto mb-2" />
            <p className="text-white/60">Loading ledger entries...</p>
          </div>
        ) : ledgerEntries.length === 0 ? (
          <div className="text-center py-8">
            <Database className="w-12 h-12 text-white/20 mx-auto mb-2" />
            <p className="text-white/60">No ledger entries yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {ledgerEntries.map((entry) => (
              <div key={entry.id} className="p-3 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    <span className="text-white font-medium">{formatNumber(entry.amount)} coins</span>
                  </div>
                  <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                    {entry.reason.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-white/60 mb-1">
                  <span>{entry.source_pool}</span>
                  <ArrowRight className="w-4 h-4" />
                  <span>{entry.destination_pool}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-white/40">
                  <span>{formatDate(entry.transfer_date)}</span>
                  {entry.notes && <span className="italic">{entry.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
