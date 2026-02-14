import { AlertTriangle, X } from 'lucide-react';

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
}: BalanceDiscrepancyWarningProps) {

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
          <p className="text-amber-400/80 text-sm mb-2">
            Your displayed balance ({profileBalance.toFixed(1)} coins) doesn't match your
            transaction history ({calculatedBalance.toFixed(1)} coins). Difference: {Math.abs(discrepancy).toFixed(1)} coins.
          </p>
          <p className="text-amber-400/60 text-xs">
            This discrepancy will be reviewed by administrators. Your actual balance is protected and will not be lost.
          </p>
        </div>
      </div>
    </div>
  );
}
