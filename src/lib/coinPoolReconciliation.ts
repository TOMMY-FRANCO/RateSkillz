import { supabase } from './supabase';

/**
 * Reconciles the community coin pool by comparing recorded distributed coins
 * with actual transaction history. Automatically corrects any discrepancies.
 */
export async function reconcileCoinPool(): Promise<{
  success: boolean;
  corrected: boolean;
  old_distributed?: number;
  new_distributed?: number;
  old_remaining?: number;
  new_remaining?: number;
  discrepancy?: number;
  error?: string;
}> {
  try {
    console.log('[Coin Pool Reconciliation] Starting reconciliation...');

    const { data, error } = await supabase.rpc('reconcile_coin_pool');

    if (error) {
      console.error('[Coin Pool Reconciliation] Error:', error);
      return {
        success: false,
        corrected: false,
        error: error.message
      };
    }

    if (data?.corrected) {
      console.log('[Coin Pool Reconciliation] Pool corrected:', {
        old_distributed: data.old_distributed,
        new_distributed: data.new_distributed,
        discrepancy: data.discrepancy
      });
    } else {
      console.log('[Coin Pool Reconciliation] Pool already correct');
    }

    return data;
  } catch (error: any) {
    console.error('[Coin Pool Reconciliation] Exception:', error);
    return {
      success: false,
      corrected: false,
      error: error.message
    };
  }
}

/**
 * Checks if the coin pool has a discrepancy without correcting it.
 * Useful for showing warnings in the UI.
 */
export async function checkCoinPoolDiscrepancy(): Promise<{
  hasDiscrepancy: boolean;
  discrepancy: number;
  recordedDistributed: number;
  actualDistributed: number;
  recordedRemaining: number;
  actualRemaining: number;
}> {
  try {
    const { data, error } = await supabase
      .from('coin_pool_verification')
      .select('*')
      .eq('pool_type', 'community')
      .maybeSingle();

    if (error || !data) {
      console.error('[Pool Check] Error:', error);
      return {
        hasDiscrepancy: false,
        discrepancy: 0,
        recordedDistributed: 0,
        actualDistributed: 0,
        recordedRemaining: 0,
        actualRemaining: 0
      };
    }

    const hasDiscrepancy = data.status === 'DISCREPANCY';

    return {
      hasDiscrepancy,
      discrepancy: parseFloat(data.discrepancy) || 0,
      recordedDistributed: parseFloat(data.recorded_distributed) || 0,
      actualDistributed: parseFloat(data.actual_distributed) || 0,
      recordedRemaining: parseFloat(data.recorded_remaining) || 0,
      actualRemaining: parseFloat(data.actual_remaining) || 0
    };
  } catch (error) {
    console.error('[Pool Check] Exception:', error);
    return {
      hasDiscrepancy: false,
      discrepancy: 0,
      recordedDistributed: 0,
      actualDistributed: 0,
      recordedRemaining: 0,
      actualRemaining: 0
    };
  }
}
