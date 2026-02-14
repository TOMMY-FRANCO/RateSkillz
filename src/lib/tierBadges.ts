import { supabase } from './supabase';

export interface TierBadge {
  id: string;
  tier_name: string;
  overall_rating_min: number;
  overall_rating_max: number;
  color_code: string;
  metallic_property: string;
  gradient_from: string;
  gradient_via: string;
  gradient_to: string;
  border_color: string;
  glow_color: string;
  shimmer_gradient: string;
  created_at: string;
  updated_at: string;
}

export interface TierValidationResult {
  success: boolean;
  user_id?: string;
  overall_rating?: number;
  tier_name?: string;
  tier_id?: string;
  error?: string;
  rating?: number;
}

export async function fetchAllTierBadges(): Promise<{ data: TierBadge[] | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('tier_badges')
      .select('id, tier_name, overall_rating_min, overall_rating_max, color_code, metallic_property, gradient_from, gradient_via, gradient_to, border_color, glow_color, shimmer_gradient')
      .order('overall_rating_min', { ascending: true });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error fetching tier badges') };
  }
}

export async function getTierByRating(rating: number): Promise<{ data: TierBadge | null; error: Error | null }> {
  try {
    if (rating < 0 || rating > 100) {
      return { data: null, error: new Error('Rating must be between 0 and 100') };
    }

    const { data, error } = await supabase
      .from('tier_badges')
      .select('id, tier_name, overall_rating_min, overall_rating_max, color_code, metallic_property, gradient_from, gradient_via, gradient_to, border_color, glow_color, shimmer_gradient')
      .lte('overall_rating_min', rating)
      .gte('overall_rating_max', rating)
      .maybeSingle();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (!data) {
      return { data: null, error: new Error(`No tier found for rating ${rating}`) };
    }

    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Unknown error fetching tier') };
  }
}

export async function validateUserTierAssignment(userId: string): Promise<TierValidationResult> {
  try {
    if (!userId) {
      return {
        success: false,
        error: 'User ID is required'
      };
    }

    const { data, error } = await supabase.rpc('validate_tier_assignment', {
      user_id: userId
    });

    if (error) {
      return {
        success: false,
        error: error.message
      };
    }

    return data as TierValidationResult;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error validating tier'
    };
  }
}

export function getTierNameByRating(rating: number): string {
  if (rating < 0 || rating > 100) return 'Default';
  if (rating === 100) return 'LEGENDARY';
  if (rating === 99) return 'RARE';
  if (rating === 98) return 'ABNORMAL';
  if (rating === 97) return 'OUTSTANDING';
  if (rating === 96) return 'PHENOMENAL';
  if (rating >= 90) return 'TALENTED';
  if (rating >= 80) return 'UNIQUE';
  if (rating >= 70) return 'REMARKABLE';
  if (rating >= 60) return 'EXCEPTIONAL';
  return 'Default';
}

export function getTierDisplayName(rating: number | undefined | null): string {
  if (rating === undefined || rating === null) {
    return '';
  }

  const tierName = getTierNameByRating(rating);
  return tierName === 'Default' ? '' : tierName;
}
