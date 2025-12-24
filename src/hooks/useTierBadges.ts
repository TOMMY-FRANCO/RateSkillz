import { useState, useEffect } from 'react';
import { fetchAllTierBadges, getTierByRating, validateUserTierAssignment, TierBadge, TierValidationResult } from '../lib/tierBadges';

export function useTierBadges() {
  const [tiers, setTiers] = useState<TierBadge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadTiers() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await fetchAllTierBadges();

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setTiers(data || []);
      setLoading(false);
    }

    loadTiers();
  }, []);

  return { tiers, loading, error };
}

export function useTierByRating(rating: number | undefined | null) {
  const [tier, setTier] = useState<TierBadge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rating === undefined || rating === null) {
      setTier(null);
      setLoading(false);
      setError(null);
      return;
    }

    async function loadTier() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await getTierByRating(rating);

      if (fetchError) {
        setError(fetchError.message);
        setLoading(false);
        return;
      }

      setTier(data);
      setLoading(false);
    }

    loadTier();
  }, [rating]);

  return { tier, loading, error };
}

export function useValidateTier(userId: string | undefined | null) {
  const [validation, setValidation] = useState<TierValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = async () => {
    if (!userId) {
      setError('User ID is required');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await validateUserTierAssignment(userId);

    if (!result.success) {
      setError(result.error || 'Validation failed');
    }

    setValidation(result);
    setLoading(false);
  };

  return { validation, loading, error, validate };
}
