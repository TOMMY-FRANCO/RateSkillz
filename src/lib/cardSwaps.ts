import { supabase } from './supabase';
import { CardOwnership } from './cardTrading';

export interface SwapListing {
  id: string;
  user_id: string;
  card_user_id: string;
  listed_at: string;
  status: 'active' | 'swapped' | 'delisted';
  created_at: string;
  card?: CardOwnership;
  manager?: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface CardSwap {
  id: string;
  manager_a_id: string;
  manager_b_id: string;
  card_a_user_id: string;
  card_b_user_id: string;
  status: 'pending' | 'accepted' | 'completed' | 'declined' | 'cancelled';
  initiated_by: string;
  created_at: string;
  completed_at: string | null;
  card_a?: CardOwnership;
  card_b?: CardOwnership;
  manager_a?: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  manager_b?: {
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface SwapTransaction {
  id: string;
  swap_id: string;
  payer_id: string;
  payee_id: string;
  card_user_id: string;
  amount: number;
  transaction_type: string;
  created_at: string;
}

export async function listCardForSwap(
  userId: string,
  cardUserId: string
): Promise<{ success: boolean; error?: string; listing_id?: string }> {
  try {
    const { data, error } = await supabase.rpc('list_card_for_swap', {
      p_user_id: userId,
      p_card_user_id: cardUserId,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error listing card for swap:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to list card',
    };
  }
}

export async function proposeCardSwap(
  initiatorId: string,
  initiatorCardUserId: string,
  targetCardUserId: string
): Promise<{ success: boolean; error?: string; swap_id?: string }> {
  try {
    const { data, error } = await supabase.rpc('propose_card_swap', {
      p_initiator_id: initiatorId,
      p_initiator_card_user_id: initiatorCardUserId,
      p_target_card_user_id: targetCardUserId,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error proposing card swap:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to propose swap',
    };
  }
}

export async function acceptCardSwap(
  swapId: string,
  acceptorId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('accept_card_swap', {
      p_swap_id: swapId,
      p_acceptor_id: acceptorId,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error accepting card swap:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to accept swap',
    };
  }
}

export async function declineCardSwap(
  swapId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('decline_card_swap', {
      p_swap_id: swapId,
      p_user_id: userId,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error declining card swap:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to decline swap',
    };
  }
}

export async function cancelSwapListing(
  listingId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('cancel_swap_listing', {
      p_listing_id: listingId,
      p_user_id: userId,
    });

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error cancelling swap listing:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to cancel listing',
    };
  }
}

export async function getActiveSwapListings(): Promise<SwapListing[]> {
  try {
    const { data: listings, error } = await supabase
      .from('card_swap_listings')
      .select('id, user_id, card_user_id, listed_at, status, created_at')
      .eq('status', 'active')
      .order('listed_at', { ascending: false });

    if (error) throw error;
    if (!listings) return [];

    const enrichedListings = await Promise.all(
      listings.map(async (listing) => {
        const [cardResult, managerResult] = await Promise.all([
          supabase
            .from('card_ownership')
            .select(`
              *,
              profile:profiles!card_ownership_card_user_id_fkey(
                id,
                username,
                full_name,
                avatar_url,
                position,
                overall_rating,
                team
              )
            `)
            .eq('card_user_id', listing.card_user_id)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('username, full_name, avatar_url')
            .eq('id', listing.user_id)
            .maybeSingle(),
        ]);

        return {
          ...listing,
          card: cardResult.data || undefined,
          manager: managerResult.data || undefined,
        };
      })
    );

    return enrichedListings;
  } catch (err) {
    console.error('Error getting swap listings:', err);
    return [];
  }
}

export async function getMySwapListings(userId: string): Promise<SwapListing[]> {
  try {
    const { data: listings, error } = await supabase
      .from('card_swap_listings')
      .select('id, user_id, card_user_id, listed_at, status, created_at')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('listed_at', { ascending: false });

    if (error) throw error;
    if (!listings) return [];

    const enrichedListings = await Promise.all(
      listings.map(async (listing) => {
        const { data: card } = await supabase
          .from('card_ownership')
          .select(`
            *,
            profile:profiles!card_ownership_card_user_id_fkey(
              id,
              username,
              full_name,
              avatar_url,
              position,
              overall_rating,
              team
            )
          `)
          .eq('card_user_id', listing.card_user_id)
          .maybeSingle();

        return {
          ...listing,
          card: card || undefined,
        };
      })
    );

    return enrichedListings;
  } catch (err) {
    console.error('Error getting my swap listings:', err);
    return [];
  }
}

export async function getPendingSwapOffers(userId: string): Promise<CardSwap[]> {
  try {
    const { data: swaps, error } = await supabase
      .from('card_swaps')
      .select('id, manager_a_id, manager_b_id, card_a_user_id, card_b_user_id, status, initiated_by, created_at, completed_at')
      .eq('status', 'pending')
      .or(`manager_a_id.eq.${userId},manager_b_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!swaps) return [];

    const enrichedSwaps = await Promise.all(
      swaps.map(async (swap) => {
        const [cardA, cardB, managerA, managerB] = await Promise.all([
          supabase
            .from('card_ownership')
            .select(`
              *,
              profile:profiles!card_ownership_card_user_id_fkey(
                id,
                username,
                full_name,
                avatar_url,
                position,
                overall_rating,
                team
              )
            `)
            .eq('card_user_id', swap.card_a_user_id)
            .maybeSingle(),
          supabase
            .from('card_ownership')
            .select(`
              *,
              profile:profiles!card_ownership_card_user_id_fkey(
                id,
                username,
                full_name,
                avatar_url,
                position,
                overall_rating,
                team
              )
            `)
            .eq('card_user_id', swap.card_b_user_id)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('username, full_name, avatar_url')
            .eq('id', swap.manager_a_id)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('username, full_name, avatar_url')
            .eq('id', swap.manager_b_id)
            .maybeSingle(),
        ]);

        return {
          ...swap,
          card_a: cardA.data || undefined,
          card_b: cardB.data || undefined,
          manager_a: managerA.data || undefined,
          manager_b: managerB.data || undefined,
        };
      })
    );

    return enrichedSwaps;
  } catch (err) {
    console.error('Error getting pending swap offers:', err);
    return [];
  }
}

export async function getSwapHistory(userId: string): Promise<CardSwap[]> {
  try {
    const { data: swaps, error } = await supabase
      .from('card_swaps')
      .select('id, manager_a_id, manager_b_id, card_a_user_id, card_b_user_id, status, initiated_by, created_at, completed_at')
      .eq('status', 'completed')
      .or(`manager_a_id.eq.${userId},manager_b_id.eq.${userId}`)
      .order('completed_at', { ascending: false })
      .limit(20);

    if (error) throw error;
    if (!swaps) return [];

    const enrichedSwaps = await Promise.all(
      swaps.map(async (swap) => {
        const [cardA, cardB, managerA, managerB] = await Promise.all([
          supabase
            .from('card_ownership')
            .select(`
              *,
              profile:profiles!card_ownership_card_user_id_fkey(
                id,
                username,
                full_name,
                avatar_url,
                position,
                overall_rating,
                team
              )
            `)
            .eq('card_user_id', swap.card_a_user_id)
            .maybeSingle(),
          supabase
            .from('card_ownership')
            .select(`
              *,
              profile:profiles!card_ownership_card_user_id_fkey(
                id,
                username,
                full_name,
                avatar_url,
                position,
                overall_rating,
                team
              )
            `)
            .eq('card_user_id', swap.card_b_user_id)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('username, full_name, avatar_url')
            .eq('id', swap.manager_a_id)
            .maybeSingle(),
          supabase
            .from('profiles')
            .select('username, full_name, avatar_url')
            .eq('id', swap.manager_b_id)
            .maybeSingle(),
        ]);

        return {
          ...swap,
          card_a: cardA.data || undefined,
          card_b: cardB.data || undefined,
          manager_a: managerA.data || undefined,
          manager_b: managerB.data || undefined,
        };
      })
    );

    return enrichedSwaps;
  } catch (err) {
    console.error('Error getting swap history:', err);
    return [];
  }
}

export async function getManagedCards(userId: string): Promise<CardOwnership[]> {
  try {
    const { data, error } = await supabase
      .from('card_ownership')
      .select(`
        *,
        profile:profiles!card_ownership_card_user_id_fkey(
          id,
          username,
          full_name,
          avatar_url,
          position,
          overall_rating,
          team
        )
      `)
      .eq('owner_id', userId)
      .neq('card_user_id', userId)
      .order('current_price', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Error getting managed cards:', err);
    return [];
  }
}
