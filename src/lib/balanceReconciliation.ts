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
    console.log('[Balance Reconciliation] Starting reconciliation for user:', userId);

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
      console.log('[Balance Reconciliation] Balance corrected:', {
        old: data.old_balance,
        new: data.new_balance,
        discrepancy: data.discrepancy
      });
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
      .select('*')
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
