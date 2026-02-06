import { supabase } from './supabase';

export interface CardOwnership {
  id: string;
  card_user_id: string;
  owner_id: string;
  current_price: number;
  base_price: number;
  is_listed_for_sale: boolean;
  times_traded: number;
  last_sale_price: number | null;
  last_purchase_price?: number | null;
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

export function getSafeCardValue(card: CardOwnership | null | undefined): number {
  if (!card) return 20.00;
  if (card.current_price && card.current_price >= 20) return card.current_price;
  if (card.base_price && card.base_price >= 20) return card.base_price;
  return 20.00;
}

export function getSafeTimesTrade(card: CardOwnership | null | undefined): number {
  if (!card) return 0;
  return card.times_traded || 0;
}

export function getSafeLastSalePrice(card: CardOwnership | null | undefined): number | null {
  if (!card) return null;
  return card.last_sale_price || null;
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
  price_increase?: number;
  sale_price?: number;
  seller_payment?: number;
  seller_profit?: number;
  seller_purchase_price?: number;
  royalty_payment?: number;
  seller_id?: string;
  buyer_id?: string;
  original_owner_id?: string;
  is_first_sale?: boolean;
  royalty_paid?: boolean;
  transaction_type?: string;
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

  if (!data) return null;

  return {
    ...data,
    current_price: data.current_price || data.base_price || 20.00,
    base_price: data.base_price || 20.00,
    times_traded: data.times_traded || 0,
    last_sale_price: data.last_sale_price || null
  };
}

export async function getCardsOwnedByUser(userId: string): Promise<CardOwnership[]> {
  const { data, error } = await supabase
    .from('card_market_cache')
    .select('*')
    .eq('owner_id', userId)
    .neq('card_user_id', userId)
    .order('acquired_at', { ascending: false });

  if (error) {
    console.error('Error fetching owned cards:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    id: `${row.card_user_id}_${row.owner_id}`,
    card_user_id: row.card_user_id,
    owner_id: row.owner_id,
    current_price: row.current_price || row.base_price || 20.00,
    base_price: row.base_price || 20.00,
    is_listed_for_sale: row.is_listed_for_sale,
    times_traded: row.times_traded || 0,
    last_sale_price: row.last_sale_price || null,
    acquired_at: row.acquired_at,
    card_user: {
      username: row.original_owner_username || '',
      full_name: row.original_owner_username || '',
      avatar_url: row.owner_avatar || '',
    },
  }));
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
  return cards.reduce((total, card) => total + getSafeCardValue(card), 0);
}

export async function getMostValuableCards(limit: number = 10): Promise<CardOwnership[]> {
  const { data, error } = await supabase
    .from('card_market_cache')
    .select('*')
    .order('current_price', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching most valuable cards:', error);
    return [];
  }

  return (data || []).map(mapCacheToCardOwnership);
}

export async function getMostTradedCards(limit: number = 10): Promise<CardOwnership[]> {
  const { data, error } = await supabase
    .from('card_market_cache')
    .select('*')
    .order('times_traded', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching most traded cards:', error);
    return [];
  }

  return (data || []).map(mapCacheToCardOwnership);
}

function mapCacheToCardOwnership(row: any): CardOwnership {
  return {
    id: `${row.card_user_id}_${row.owner_id}`,
    card_user_id: row.card_user_id,
    owner_id: row.owner_id,
    current_price: row.current_price || row.base_price || 20.00,
    base_price: row.base_price || 20.00,
    is_listed_for_sale: row.is_listed_for_sale,
    times_traded: row.times_traded || 0,
    last_sale_price: row.last_sale_price || null,
    acquired_at: row.acquired_at,
    card_user: {
      username: row.original_owner_username || '',
      full_name: row.original_owner_username || '',
      avatar_url: row.owner_avatar || '',
    },
    owner: {
      username: row.owner_username || '',
      full_name: row.owner_username || '',
    },
  };
}

export async function purchaseCardAtFixedPrice(
  cardUserId: string,
  buyerId: string
): Promise<CardSaleResult> {
  try {
    const { data, error } = await supabase.rpc('purchase_card_at_fixed_price', {
      p_card_user_id: cardUserId,
      p_buyer_id: buyerId
    });

    if (error) {
      console.error('Error purchasing card:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'No response from purchase transaction' };
    }

    return {
      success: data.success,
      error: data.error,
      transaction_id: data.transaction_id,
      previous_value: data.previous_value,
      new_value: data.new_value,
      sale_price: data.paid_amount,
      seller_payment: data.seller_received,
      royalty_payment: data.royalty_paid,
      is_first_sale: data.is_first_sale
    };
  } catch (err) {
    console.error('Exception purchasing card:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred'
    };
  }
}

export async function checkManagerOwnsBuyerOriginalCard(
  managerId: string,
  buyerId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_manager_owns_buyer_original_card', {
      p_manager_id: managerId,
      p_buyer_id: buyerId
    });

    if (error) {
      console.error('Error checking manager ownership restriction:', error);
      return false;
    }

    return data === true;
  } catch (error) {
    console.error('Error checking manager ownership restriction:', error);
    return false;
  }
}

export interface CardPurchaseRestriction {
  isRestricted: boolean;
  reason?: string;
}

export async function checkCardPurchaseRestriction(
  cardOwnerId: string,
  buyerId: string
): Promise<CardPurchaseRestriction> {
  const managerOwnsOriginalCard = await checkManagerOwnsBuyerOriginalCard(cardOwnerId, buyerId);

  if (managerOwnsOriginalCard) {
    return {
      isRestricted: true,
      reason: 'This manager owns one of your original cards. You cannot purchase from them.'
    };
  }

  return {
    isRestricted: false
  };
}

export async function getListedCardsForSale(): Promise<CardOwnership[]> {
  const { data, error } = await supabase
    .from('card_market_cache')
    .select('*')
    .eq('is_listed_for_sale', true)
    .order('current_price', { ascending: true });

  if (error) {
    console.error('Error fetching listed cards:', error);
    return [];
  }

  return (data || []).map(mapCacheToCardOwnership);
}

export interface CardWithRatings extends CardOwnership {
  pac?: number;
  sho?: number;
  pas?: number;
  dri?: number;
  def?: number;
  phy?: number;
  position?: string;
  team?: string;
  overall_rating?: number;
  tier_badge?: string;
}

export interface PurchaseRequest {
  id: string;
  card_user_id: string;
  buyer_id: string;
  seller_id: string;
  requested_price: number;
  status: string;
  request_type: string;
  created_at: string;
  response_date: string | null;
  buyer?: {
    username: string;
    full_name: string;
  };
  seller?: {
    username: string;
    full_name: string;
  };
  card_user?: {
    username: string;
    full_name: string;
  };
}

export async function getNotBoughtCards(): Promise<CardWithRatings[]> {
  const { data, error } = await supabase
    .from('card_ownership')
    .select(`
      *,
      card_user:profiles!card_ownership_card_user_id_fkey(
        id,
        username,
        full_name,
        avatar_url,
        position,
        team,
        overall_rating
      )
    `)
    .eq('times_traded', 0)
    .filter('owner_id', 'eq', supabase.raw('card_user_id'))
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching not bought cards:', error);
    return [];
  }

  const cardsWithRatings = await Promise.all(
    (data || []).map(async (card) => {
      const { data: avgRatings } = await supabase
        .from('ratings')
        .select('pac, sho, pas, dri, def, phy')
        .eq('rated_user_id', card.card_user_id);

      let ratings = { pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50 };
      if (avgRatings && avgRatings.length > 0) {
        const sum = (key: string) => avgRatings.reduce((acc, r: any) => acc + (r[key] || 0), 0);
        const count = avgRatings.length;
        ratings = {
          pac: Math.round(sum('pac') / count),
          sho: Math.round(sum('sho') / count),
          pas: Math.round(sum('pas') / count),
          dri: Math.round(sum('dri') / count),
          def: Math.round(sum('def') / count),
          phy: Math.round(sum('phy') / count),
        };
      }

      const { data: tierData } = await supabase
        .from('tier_badges')
        .select('badge_tier')
        .eq('user_id', card.card_user_id)
        .maybeSingle();

      return {
        ...card,
        ...ratings,
        position: card.card_user?.position || 'N/A',
        team: card.card_user?.team || 'N/A',
        overall_rating: card.card_user?.overall_rating || 50,
        tier_badge: tierData?.badge_tier || null,
      };
    })
  );

  return cardsWithRatings;
}

export async function getNoManagerCards(): Promise<CardWithRatings[]> {
  const { data, error } = await supabase
    .from('card_ownership')
    .select(`
      *,
      card_user:profiles!card_ownership_card_user_id_fkey(
        id,
        username,
        full_name,
        avatar_url,
        position,
        team,
        overall_rating
      ),
      owner:profiles!card_ownership_owner_id_fkey(
        id,
        username,
        full_name,
        is_manager
      )
    `)
    .gt('times_traded', 0)
    .or('is_manager.is.false,is_manager.is.null', { foreignTable: 'owner' })
    .order('current_price', { ascending: true });

  if (error) {
    console.error('Error fetching no manager cards:', error);
    return [];
  }

  const cardsWithRatings = await Promise.all(
    (data || []).map(async (card) => {
      const { data: avgRatings } = await supabase
        .from('ratings')
        .select('pac, sho, pas, dri, def, phy')
        .eq('rated_user_id', card.card_user_id);

      let ratings = { pac: 50, sho: 50, pas: 50, dri: 50, def: 50, phy: 50 };
      if (avgRatings && avgRatings.length > 0) {
        const sum = (key: string) => avgRatings.reduce((acc, r: any) => acc + (r[key] || 0), 0);
        const count = avgRatings.length;
        ratings = {
          pac: Math.round(sum('pac') / count),
          sho: Math.round(sum('sho') / count),
          pas: Math.round(sum('pas') / count),
          dri: Math.round(sum('dri') / count),
          def: Math.round(sum('def') / count),
          phy: Math.round(sum('phy') / count),
        };
      }

      const { data: tierData } = await supabase
        .from('tier_badges')
        .select('badge_tier')
        .eq('user_id', card.card_user_id)
        .maybeSingle();

      return {
        ...card,
        ...ratings,
        position: card.card_user?.position || 'N/A',
        team: card.card_user?.team || 'N/A',
        overall_rating: card.card_user?.overall_rating || 50,
        tier_badge: tierData?.badge_tier || null,
      };
    })
  );

  return cardsWithRatings;
}

export async function createPurchaseRequest(
  cardUserId: string,
  buyerId: string,
  requestedPrice: number,
  requestType: string = 'not_bought'
): Promise<{ success: boolean; error?: string; request_id?: string }> {
  const { data, error } = await supabase.rpc('create_purchase_request', {
    p_card_user_id: cardUserId,
    p_buyer_id: buyerId,
    p_requested_price: requestedPrice,
    p_request_type: requestType
  });

  if (error) {
    console.error('Error creating purchase request:', error);
    return { success: false, error: error.message };
  }

  if (!data.success) {
    return { success: false, error: data.error };
  }

  return { success: true, request_id: data.request_id };
}

export async function approvePurchaseRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('approve_purchase_request', {
    p_request_id: requestId
  });

  if (error) {
    console.error('Error approving purchase request:', error);
    return { success: false, error: error.message };
  }

  if (!data.success) {
    return { success: false, error: data.error };
  }

  return { success: true };
}

export async function declinePurchaseRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('decline_purchase_request', {
    p_request_id: requestId
  });

  if (error) {
    console.error('Error declining purchase request:', error);
    return { success: false, error: error.message };
  }

  if (!data.success) {
    return { success: false, error: data.error };
  }

  return { success: true };
}

export async function getPendingPurchaseRequests(userId: string): Promise<PurchaseRequest[]> {
  const { data, error } = await supabase
    .from('purchase_requests')
    .select(`
      *,
      buyer:profiles!purchase_requests_buyer_id_fkey(username, full_name),
      seller:profiles!purchase_requests_seller_id_fkey(username, full_name),
      card_user:profiles!purchase_requests_card_user_id_fkey(username, full_name)
    `)
    .eq('seller_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching pending purchase requests:', error);
    return [];
  }

  return data || [];
}

export interface BuyoutResult {
  success: boolean;
  error?: string;
  transaction_id?: string;
  card_price?: number;
  payment_to_holder?: number;
  total_cost?: number;
  coins_burned?: number;
}

export async function buyMyselfOut(
  cardUserId: string,
  originalOwnerId: string
): Promise<BuyoutResult> {
  try {
    const { data, error } = await supabase.rpc('buy_myself_out', {
      p_card_user_id: cardUserId,
      p_original_owner_id: originalOwnerId
    });

    if (error) {
      console.error('Error buying out card:', error);
      return { success: false, error: error.message };
    }

    if (!data) {
      return { success: false, error: 'No response from buyout transaction' };
    }

    return {
      success: data.success,
      error: data.error,
      transaction_id: data.transaction_id,
      card_price: data.card_price,
      payment_to_holder: data.payment_to_holder,
      total_cost: data.total_cost,
      coins_burned: data.coins_burned
    };
  } catch (err) {
    console.error('Exception buying out card:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred'
    };
  }
}
