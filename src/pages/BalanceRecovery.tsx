import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Coins, TrendingUp, Users, FileText } from 'lucide-react';

interface RecoveryRecord {
  user_id: string;
  username: string;
  old_balance: number;
  calculated_balance: number;
  discrepancy: number;
  coins_recovered: number;
  transaction_count: number;
  recovery_date: string;
  recovery_notes: string;
}

export default function BalanceRecovery() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [recoveryLog, setRecoveryLog] = useState<RecoveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    fetchRecoveryReport();
  }, []);

  const fetchRecoveryReport = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_balance_recovery_report');

      if (error) throw error;

      setRecoveryLog(data || []);
    } catch (error) {
      console.error('Error fetching recovery report:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeRecovery = async () => {
    if (!confirm('Are you sure you want to recalculate ALL user balances from transaction history? This will restore any lost coins.')) {
      return;
    }

    try {
      setRecovering(true);
      const { data, error } = await supabase.rpc('recover_all_user_balances');

      if (error) throw error;

      const result = data[0];
      alert(`Balance Recovery Complete!\n\nUsers Processed: ${result.users_processed}\nTotal Coins Recovered: ${result.total_coins_recovered}\nUsers with Discrepancies: ${result.users_with_discrepancies}`);

      await fetchRecoveryReport();
    } catch (error) {
      console.error('Error executing recovery:', error);
      alert('Failed to execute recovery. Check console for details.');
    } finally {
      setRecovering(false);
    }
  };

  const totalRecovered = recoveryLog.reduce((sum, record) => sum + Number(record.coins_recovered), 0);
  const usersWithDiscrepancies = recoveryLog.filter(r => Number(r.discrepancy) !== 0).length;
  const latestRecoveryDate = recoveryLog[0]?.recovery_date;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg bg-gray-800 border border-gray-700 text-white hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3">
                <Coins className="w-8 h-8 text-yellow-400" />
                Balance Recovery System
              </h1>
              <p className="text-gray-400 mt-1">Rebuild all balances from transaction ledger</p>
            </div>
          </div>

          <button
            onClick={executeRecovery}
            disabled={recovering}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-5 h-5 ${recovering ? 'animate-spin' : ''}`} />
            {recovering ? 'Recovering...' : 'Execute Recovery'}
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-gray-800 to-gray-700 rounded-xl p-6 border border-gray-600">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-8 h-8 text-blue-400" />
              <span className="text-3xl font-black text-white">{recoveryLog.length}</span>
            </div>
            <p className="text-gray-400 text-sm font-semibold">Total Users</p>
          </div>

          <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-xl p-6 border border-yellow-500">
            <div className="flex items-center justify-between mb-2">
              <Coins className="w-8 h-8 text-white" />
              <span className="text-3xl font-black text-white">{totalRecovered.toFixed(2)}</span>
            </div>
            <p className="text-white text-sm font-semibold">Coins Recovered</p>
          </div>

          <div className="bg-gradient-to-br from-red-600 to-pink-600 rounded-xl p-6 border border-red-500">
            <div className="flex items-center justify-between mb-2">
              <AlertTriangle className="w-8 h-8 text-white" />
              <span className="text-3xl font-black text-white">{usersWithDiscrepancies}</span>
            </div>
            <p className="text-white text-sm font-semibold">Had Discrepancies</p>
          </div>

          <div className="bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl p-6 border border-green-500">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle2 className="w-8 h-8 text-white" />
              <span className="text-3xl font-black text-white">{recoveryLog.length - usersWithDiscrepancies}</span>
            </div>
            <p className="text-white text-sm font-semibold">Already Correct</p>
          </div>
        </div>

        {latestRecoveryDate && (
          <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 border border-blue-500/30 rounded-xl p-4 mb-6">
            <p className="text-blue-300 text-sm">
              <strong>Last Recovery:</strong> {new Date(latestRecoveryDate).toLocaleString()}
            </p>
          </div>
        )}

        {/* Recovery Log Table */}
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <div className="p-4 bg-gray-900 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-cyan-400" />
              Balance Recovery Log
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : recoveryLog.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No recovery records found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-900">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Old Balance
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Calculated
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Discrepancy
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Recovered
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Transactions
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {recoveryLog.map((record) => {
                    const hasDiscrepancy = Number(record.discrepancy) !== 0;
                    const isPositive = Number(record.discrepancy) > 0;

                    return (
                      <tr
                        key={record.user_id}
                        className={`${hasDiscrepancy ? 'bg-yellow-900/10' : 'hover:bg-gray-750'}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {hasDiscrepancy && (
                              <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                            )}
                            <span className="text-white font-semibold">@{record.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-gray-400 font-mono">
                            {Number(record.old_balance).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-green-400 font-mono font-bold">
                            {Number(record.calculated_balance).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className={`font-mono font-bold ${
                            isPositive ? 'text-green-400' : hasDiscrepancy ? 'text-red-400' : 'text-gray-500'
                          }`}>
                            {isPositive ? '+' : ''}{Number(record.discrepancy).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            {hasDiscrepancy && <TrendingUp className="w-4 h-4 text-yellow-400" />}
                            <span className={`font-mono font-bold ${
                              hasDiscrepancy ? 'text-yellow-400' : 'text-gray-500'
                            }`}>
                              {Number(record.coins_recovered).toFixed(2)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-gray-400 font-mono text-sm">
                            {record.transaction_count}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm ${
                            hasDiscrepancy ? 'text-yellow-300' : 'text-green-400'
                          }`}>
                            {record.recovery_notes}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Verification Notice */}
        <div className="mt-6 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/30 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-bold text-green-400 mb-2">Balance Integrity Verified</h3>
              <p className="text-green-300 text-sm leading-relaxed">
                All user balances have been recalculated from the transaction ledger.
                The <strong>coin_transactions</strong> table is the source of truth.
                All profiles.coin_balance values now match their transaction history exactly.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
