import { supabase } from './supabase';

/**
 * Reconciles a user's balance by comparing their profile balance
 * with their latest transaction balance_after value.
 * Automatically corrects any discrepancies.
 */
export async function reconcileUserBalance(userId: string): Promise<{
  success: boolean;
  corrected: boolean;
  old_balance?: number;
  new_balance?: number;
  discrepancy?: number;
  error?: string;
}> {
  try {
    console.log('[Balance Reconciliation] Starting reconciliation');

    const { data, error } = await supabase
      .rpc('reconcile_user_balance', {
        p_user_id: userId,
        p_correction_source: 'app_load'
      });

    if (error) {
      console.error('[Balance Reconciliation] Error:', error);
      return {
        success: false,
        corrected: false,
        error: error.message
      };
    }

    if (data?.corrected) {
      console.log('[Balance Reconciliation] Balance corrected');
    } else {
      console.log('[Balance Reconciliation] Balance already correct');
    }

    return data;
  } catch (error: any) {
    console.error('[Balance Reconciliation] Exception:', error);
    return {
      success: false,
      corrected: false,
      error: error.message
    };
  }
}

/**
 * Checks if a user has a balance discrepancy without correcting it.
 * Useful for showing warnings in the UI.
 */
export async function checkBalanceDiscrepancy(userId: string): Promise<{
  hasDiscrepancy: boolean;
  discrepancy: number;
  profileBalance: number;
  transactionBalance: number;
}> {
  try {
    const { data, error } = await supabase
      .from('balance_verification')
      .select('user_id, status, discrepancy, profile_balance, latest_transaction_balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      console.error('[Balance Check] Error:', error);
      return {
        hasDiscrepancy: false,
        discrepancy: 0,
        profileBalance: 0,
        transactionBalance: 0
      };
    }

    const hasDiscrepancy = data.status === 'DISCREPANCY';

    return {
      hasDiscrepancy,
      discrepancy: parseFloat(data.discrepancy) || 0,
      profileBalance: parseFloat(data.profile_balance) || 0,
      transactionBalance: parseFloat(data.latest_transaction_balance) || 0
    };
  } catch (error) {
    console.error('[Balance Check] Exception:', error);
    return {
      hasDiscrepancy: false,
      discrepancy: 0,
      profileBalance: 0,
      transactionBalance: 0
    };
  }
}

/**
 * Pull-based balance integrity check for current user.
 * Called manually via pull-to-refresh or refresh button.
 * NO real-time monitoring or automatic triggers.
 */
export async function checkBalanceIntegrity(): Promise<{
  success: boolean;
  hasDiscrepancy: boolean;
  profileBalance: number;
  calculatedBalance: number;
  discrepancy: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc('check_balance_integrity');

    if (error) {
      console.error('[Balance Integrity] Error:', error);
      return {
        success: false,
        hasDiscrepancy: false,
        profileBalance: 0,
        calculatedBalance: 0,
        discrepancy: 0,
        error: error.message
      };
    }

    if (!data || !data.success) {
      return {
        success: false,
        hasDiscrepancy: false,
        profileBalance: 0,
        calculatedBalance: 0,
        discrepancy: 0,
        error: data?.error || 'Unknown error'
      };
    }

    return {
      success: true,
      hasDiscrepancy: data.has_discrepancy || false,
      profileBalance: parseFloat(data.profile_balance) || 0,
      calculatedBalance: parseFloat(data.calculated_balance) || 0,
      discrepancy: parseFloat(data.discrepancy) || 0
    };
  } catch (error: any) {
    console.error('[Balance Integrity] Exception:', error);
    return {
      success: false,
      hasDiscrepancy: false,
      profileBalance: 0,
      calculatedBalance: 0,
      discrepancy: 0,
      error: error.message
    };
  }
}
