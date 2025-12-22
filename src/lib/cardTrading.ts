import { supabase } from './supabase';

export interface CardOwnership {
  id: string;
  card_user_id: string;
  owner_id: string;
  current_price: number;
  base_price: number;
  is_listed_for_sale: boolean;
  asking_price: number | null;
  times_traded: number;
  last_sale_price: number | null;
  acquired_at: string;
  card_user?: {
    username: string;
    full_name: string;
    avatar_url: string;
  };
  owner?: {
    username: string;
    full_name: string;
  };
}

export interface CardTransaction {
  id: string;
  card_user_id: string;
  seller_id: string;
  buyer_id: string;
  sale_price: number;
  transaction_type: string;
  created_at: string;
  card_value_at_sale?: number;
  previous_value?: number;
  new_value?: number;
}

export interface CardSaleResult {
  success: boolean;
  error?: string;
  transaction_id?: string;
  previous_value?: number;
  new_value?: number;
  sale_price?: number;
  seller_id?: string;
  buyer_id?: string;
}

export interface CardOffer {
  id: string;
  card_user_id: string;
  current_owner_id: string;
  buyer_id: string;
  offer_amount: number;
  offer_type: string;
  status: string;
  message: string | null;
  created_at: string;
  responded_at: string | null;
  buyer?: {
    username: string;
    full_name: string;
  };
  card_user?: {
    username: string;
    full_name: string;
  };
}

export async function getCardOwnership(cardUserId: string): Promise<CardOwnership | null> {
  const { data, error } = await supabase
    .from('card_ownership')
    .select(`
      *,
      card_user:profiles!card_ownership_card_user_id_fkey(username, full_name, avatar_url),
      owner:profiles!card_ownership_owner_id_fkey(username, full_name)
    `)
    .eq('card_user_id', cardUserId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching card ownership:', error);
    return null;
  }

  return data;
}

export async function getCardsOwnedByUser(userId: string): Promise<CardOwnership[]> {
  const { data, error } = await supabase
    .from('card_ownership')
    .select(`
      *,
      card_user:profiles!card_ownership_card_user_id_fkey(username, full_name, avatar_url)
    `)
    .eq('owner_id', userId)
    .neq('card_user_id', userId)
    .order('acquired_at', { ascending: false });

  if (error) {
    console.error('Error fetching owned cards:', error);
    return [];
  }

  return data || [];
}

export async function createCardOffer(
  cardUserId: string,
  buyerId: string,
  offerAmount: number,
  offerType: string = 'purchase_request',
  message: string | null = null
): Promise<{ success: boolean; error?: string; offer_id?: string }> {
  const { data, error } = await supabase.rpc('create_card_offer', {
    p_card_user_id: cardUserId,
    p_buyer_id: buyerId,
    p_offer_amount: offerAmount,
    p_offer_type: offerType,
    p_message: message
  });

  if (error) {
    console.error('Error creating card offer:', error);
    return { success: false, error: error.message };
  }

  if (!data.success) {
    return { success: false, error: data.error };
  }

  return { success: true, offer_id: data.offer_id };
}

export async function acceptCardOffer(offerId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('accept_card_offer', {
    p_offer_id: offerId
  });

  if (error) {
    console.error('Error accepting card offer:', error);
    return { success: false, error: error.message };
  }

  if (!data.success) {
    return { success: false, error: data.error };
  }

  return { success: true };
}

export async function denyCardOffer(offerId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('deny_card_offer', {
    p_offer_id: offerId
  });

  if (error) {
    console.error('Error denying card offer:', error);
    return { success: false, error: error.message };
  }

  if (!data.success) {
    return { success: false, error: data.error };
  }

  return { success: true };
}

export async function listCardForSale(
  cardUserId: string,
  ownerId: string,
  askingPrice: number
): Promise<{ success: boolean; error?: string; minimum_price?: number }> {
  const { data, error } = await supabase.rpc('list_card_for_sale', {
    p_card_user_id: cardUserId,
    p_owner_id: ownerId,
    p_asking_price: askingPrice
  });

  if (error) {
    console.error('Error listing card for sale:', error);
    return { success: false, error: error.message };
  }

  if (!data.success) {
    return { success: false, error: data.error, minimum_price: data.minimum_price };
  }

  return { success: true };
}

export async function unlistCardFromSale(
  cardUserId: string,
  ownerId: string
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('unlist_card_from_sale', {
    p_card_user_id: cardUserId,
    p_owner_id: ownerId
  });

  if (error) {
    console.error('Error unlisting card:', error);
    return { success: false, error: error.message };
  }

  if (!data.success) {
    return { success: false, error: data.error };
  }

  return { success: true };
}

export async function getPendingCardOffers(userId: string): Promise<CardOffer[]> {
  const { data, error } = await supabase
    .from('card_offers')
    .select(`
      *,
      buyer:profiles!card_offers_buyer_id_fkey(username, full_name),
      card_user:profiles!card_offers_card_user_id_fkey(username, full_name)
    `)
    .eq('current_owner_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending offers:', error);
    return [];
  }

  return data || [];
}

export async function getCardTransactionHistory(cardUserId: string): Promise<CardTransaction[]> {
  const { data, error } = await supabase
    .from('card_transactions')
    .select('*')
    .eq('card_user_id', cardUserId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching transaction history:', error);
    return [];
  }

  return data || [];
}

export function calculatePotentialProfit(purchasePrice: number, sellingPrice: number): number {
  return Math.round((sellingPrice - purchasePrice) * 100) / 100;
}

export async function getPortfolioValue(userId: string): Promise<number> {
  const cards = await getCardsOwnedByUser(userId);
  return cards.reduce((total, card) => total + (card.current_price || 0), 0);
}

export async function getMostValuableCards(limit: number = 10): Promise<CardOwnership[]> {
  const { data, error } = await supabase
    .from('card_ownership')
    .select(`
      *,
      card_user:profiles!card_ownership_card_user_id_fkey(username, full_name, avatar_url),
      owner:profiles!card_ownership_owner_id_fkey(username, full_name)
    `)
    .order('current_price', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching most valuable cards:', error);
    return [];
  }

  return data || [];
}

export async function getMostTradedCards(limit: number = 10): Promise<CardOwnership[]> {
  const { data, error } = await supabase
    .from('card_ownership')
    .select(`
      *,
      card_user:profiles!card_ownership_card_user_id_fkey(username, full_name, avatar_url),
      owner:profiles!card_ownership_owner_id_fkey(username, full_name)
    `)
    .order('times_traded', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching most traded cards:', error);
    return [];
  }

  return data || [];
}

export async function executeCardSale(
  cardUserId: string,
  buyerId: string,
  salePrice: number
): Promise<CardSaleResult> {
  try {
    const { data, error } = await supabase.rpc('execute_card_sale', {
      p_card_user_id: cardUserId,
      p_buyer_id: buyerId,
      p_sale_price: salePrice
    });

    if (error) {
      console.error('Error executing card sale:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'No response from sale transaction' };
    }

    return {
      success: data.success,
      error: data.error,
      transaction_id: data.transaction_id,
      previous_value: data.previous_value,
      new_value: data.new_value,
      sale_price: data.sale_price,
      seller_id: data.seller_id,
      buyer_id: data.buyer_id
    };
  } catch (err) {
    console.error('Exception executing card sale:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred'
    };
  }
}

export async function getListedCardsForSale(): Promise<CardOwnership[]> {
  const { data, error } = await supabase
    .from('card_ownership')
    .select(`
      *,
      card_user:profiles!card_ownership_card_user_id_fkey(username, full_name, avatar_url),
      owner:profiles!card_ownership_owner_id_fkey(username, full_name)
    `)
    .eq('is_listed_for_sale', true)
    .order('asking_price', { ascending: true });

  if (error) {
    console.error('Error fetching listed cards:', error);
    return [];
  }

  return data || [];
}
