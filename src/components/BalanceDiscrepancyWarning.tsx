import { AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useState } from 'react';
import { reconcileUserBalance } from '../lib/balanceReconciliation';

interface BalanceDiscrepancyWarningProps {
  profileBalance: number;
  calculatedBalance: number;
  discrepancy: number;
  onDismiss?: () => void;
  onReconciled?: () => void;
}

export default function BalanceDiscrepancyWarning({
  profileBalance,
  calculatedBalance,
  discrepancy,
  onDismiss,
  onReconciled,
}: BalanceDiscrepancyWarningProps) {
  const [reconciling, setReconciling] = useState(false);
  const [reconciled, setReconciled] = useState(false);

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const { data: { user } } = await (await import('../lib/supabase')).supabase.auth.getUser();
      if (!user) return;

      const result = await reconcileUserBalance(user.id);

      if (result.success && result.corrected) {
        setReconciled(true);
        onReconciled?.();
        setTimeout(() => {
          onDismiss?.();
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to reconcile:', error);
    } finally {
      setReconciling(false);
    }
  };

  if (reconciled) {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4 animate-content-reveal">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-emerald-300 font-semibold text-sm mb-1">
              Balance Corrected
            </h3>
            <p className="text-emerald-400/80 text-sm">
              Your balance has been synchronized successfully.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 mb-4 animate-content-reveal">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-amber-300 font-semibold text-sm">
              Balance Mismatch Detected
            </h3>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-amber-400/60 hover:text-amber-400 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <p className="text-amber-400/80 text-sm mb-3">
            Your displayed balance ({profileBalance.toFixed(1)} coins) doesn't match your
            transaction history ({calculatedBalance.toFixed(1)} coins). Difference: {Math.abs(discrepancy).toFixed(1)} coins.
          </p>
          <button
            onClick={handleReconcile}
            disabled={reconciling}
            className="bg-amber-500 hover:bg-amber-400 text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {reconciling ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-900/30 border-t-gray-900"></div>
                Fixing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Fix Balance
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
