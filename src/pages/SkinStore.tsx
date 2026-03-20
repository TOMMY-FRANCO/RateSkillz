import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  ArrowLeft, ShoppingCart, Heart, Zap, Award, Sparkles,
  Loader2, CheckCircle, History, X, Coins,
} from 'lucide-react';
import { CoinBalance } from '../components/CoinBalance';

interface SkinItem {
  id: string;
  name: string;
  description: string;
  skin_type: 'border' | 'shimmer' | 'badge';
  price: number;
  image_url: string | null;
  preview_config: Record<string, any>;
}

interface UserSkin {
  skin_id: string;
  is_active: boolean;
}

interface WishlistItem {
  skin_id: string;
}

interface PurchaseHistory {
  id: string;
  skin_id: string;
  amount: number;
  balance_after: number;
  purchased_at: string;
  skin_items: { name: string; skin_type: string } | null;
}

type Tab = 'shop' | 'wishlist' | 'history';

const TYPE_ICONS: Record<string, any> = {
  shimmer: Sparkles,
  border: Award,
  badge: Zap,
};

const TYPE_LABELS: Record<string, string> = {
  shimmer: 'Shimmer',
  border: 'Border',
  badge: 'Badge',
};

const TYPE_COLOURS: Record<string, string> = {
  shimmer: 'from-[#00FF85] to-[#00E0FF]',
  border: 'from-[#FFD700] to-[#FFA500]',
  badge: 'from-[#FF6B9D] to-[#C44569]',
};

function SkinPreview({ item }: { item: SkinItem }) {
  const Icon = TYPE_ICONS[item.skin_type] || Sparkles;
  const colours = TYPE_COLOURS[item.skin_type] || 'from-[#00FF85] to-[#00E0FF]';

  if (item.image_url) {
    return (
      <img
        src={item.image_url}
        alt={item.name}
        className="w-full h-full object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <div className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br ${colours} bg-opacity-10 relative overflow-hidden`}>
      {/* Simulated card preview */}
      <div className="relative w-20 h-28 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-white/20 flex items-center justify-center shadow-lg overflow-hidden">
        {item.skin_type === 'shimmer' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
        )}
        {item.skin_type === 'border' && (
          <div className={`absolute inset-0 rounded-xl border-4 border-transparent bg-gradient-to-br ${colours} opacity-80`} style={{ mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)', maskComposite: 'exclude' }} />
        )}
        <Icon className="w-8 h-8 text-white/80" />
        {item.skin_type === 'badge' && (
          <div className={`absolute top-1 right-1 w-5 h-5 rounded-full bg-gradient-to-br ${colours} flex items-center justify-center shadow-lg`}>
            <Icon className="w-3 h-3 text-black" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function SkinStore() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState<Tab>('shop');
  const [skins, setSkins] = useState<SkinItem[]>([]);
  const [ownedSkins, setOwnedSkins] = useState<UserSkin[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [history, setHistory] = useState<PurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [activating, setActivating] = useState<string | null>(null);
  const [wishlistLoading, setWishlistLoading] = useState<string | null>(null);
  const [showCartPanel, setShowCartPanel] = useState(false);

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [skinsRes, ownedRes, wishlistRes, historyRes] = await Promise.all([
        supabase.from('skin_items').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('user_skins').select('skin_id, is_active').eq('user_id', user.id),
        supabase.from('skin_wishlist').select('skin_id').eq('user_id', user.id),
        supabase.from('skin_purchases')
          .select('id, skin_id, amount, balance_after, purchased_at, skin_items(name, skin_type)')
          .eq('user_id', user.id)
          .order('purchased_at', { ascending: false })
          .limit(20),
      ]);
      if (skinsRes.data) setSkins(skinsRes.data);
      if (ownedRes.data) setOwnedSkins(ownedRes.data);
      if (wishlistRes.data) setWishlist(wishlistRes.data);
      if (historyRes.data) setHistory(historyRes.data as any);
    } catch (err) {
      console.error('Error fetching skin store data:', err);
    } finally {
      setLoading(false);
    }
  };

  const isOwned = (skinId: string) => ownedSkins.some(s => s.skin_id === skinId);
  const isActive = (skinId: string) => ownedSkins.some(s => s.skin_id === skinId && s.is_active);
  const isWishlisted = (skinId: string) => wishlist.some(w => w.skin_id === skinId);

  const handlePurchase = async (skin: SkinItem) => {
    if (!user || !profile) return;
    if ((profile.coin_balance ?? 0) < skin.price) {
      toast.error('Not enough coins to purchase this skin.');
      return;
    }
    if (isOwned(skin.id)) {
      toast.info('You already own this skin.');
      return;
    }

    setPurchasing(skin.id);
    try {
      const balanceBefore = profile.coin_balance ?? 0;
      const balanceAfter = balanceBefore - skin.price;

      // Deduct coins
      const { error: balanceError } = await supabase
        .from('profiles')
        .update({ coin_balance: balanceAfter })
        .eq('id', user.id);
      if (balanceError) throw balanceError;

      // Log coin transaction
      await supabase.from('coin_transactions').insert({
        user_id: user.id,
        amount: -skin.price,
        transaction_type: 'purchase',
        description: `Skin purchased: ${skin.name}`,
        balance_after: balanceAfter,
      });

      // Add to user_skins
      await supabase.from('user_skins').insert({
        user_id: user.id,
        skin_id: skin.id,
        is_active: false,
      });

      // Log skin purchase
      await supabase.from('skin_purchases').insert({
        user_id: user.id,
        skin_id: skin.id,
        amount: skin.price,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
      });

      // Credit skin_shop_purchase pool
      await supabase
        .from('coin_pool')
        .update({
          distributed_coins: supabase.rpc('increment', { x: skin.price }),
          remaining_coins: supabase.rpc('decrement', { x: skin.price }),
        })
        .eq('pool_type', 'skin_shop_purchase')
        .catch(() => {
          // Pool update is non-critical, don't block purchase
        });

      // Notify transactions
      await supabase.from('user_notifications').insert({
        user_id: user.id,
        notification_type: 'transaction',
        message: `You purchased the "${skin.name}" skin for ${skin.price} coins. New balance: ${balanceAfter} coins.`,
        activity_feed_type: 'skin_purchase',
      }).catch(() => {});

      // Activity feed entry
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'skin_purchase',
        message: `🎉 Congratulations! You just equipped the "${skin.name}" skin on your card. Looking fresh!`,
      }).catch(() => {});

      // Remove from wishlist if present
      if (isWishlisted(skin.id)) {
        await supabase.from('skin_wishlist').delete().eq('user_id', user.id).eq('skin_id', skin.id).catch(() => {});
        setWishlist(prev => prev.filter(w => w.skin_id !== skin.id));
      }

      setOwnedSkins(prev => [...prev, { skin_id: skin.id, is_active: false }]);
      await refreshProfile();
      await fetchAll();
      toast.success(`"${skin.name}" purchased successfully!`);
    } catch (err: any) {
      toast.error(err?.message || 'Purchase failed. Please try again.');
    } finally {
      setPurchasing(null);
    }
  };

  const handleActivate = async (skinId: string) => {
    if (!user) return;
    setActivating(skinId);
    try {
      // Deactivate all
      await supabase.from('user_skins').update({ is_active: false }).eq('user_id', user.id);
      // Activate selected
      await supabase.from('user_skins').update({ is_active: true }).eq('user_id', user.id).eq('skin_id', skinId);
      setOwnedSkins(prev => prev.map(s => ({ ...s, is_active: s.skin_id === skinId })));
      toast.success('Skin activated on your card!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to activate skin.');
    } finally {
      setActivating(null);
    }
  };

  const handleWishlist = async (skinId: string) => {
    if (!user) return;
    setWishlistLoading(skinId);
    try {
      if (isWishlisted(skinId)) {
        await supabase.from('skin_wishlist').delete().eq('user_id', user.id).eq('skin_id', skinId);
        setWishlist(prev => prev.filter(w => w.skin_id !== skinId));
        toast.info('Removed from wishlist.');
      } else {
        await supabase.from('skin_wishlist').insert({ user_id: user.id, skin_id: skinId });
        setWishlist(prev => [...prev, { skin_id: skinId }]);
        toast.success('Added to wishlist!');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update wishlist.');
    } finally {
      setWishlistLoading(null);
    }
  };

  const wishlistSkins = skins.filter(s => isWishlisted(s.id));

  const displaySkins = tab === 'wishlist' ? wishlistSkins : skins;

  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors"
                aria-label="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white">Card Skins</h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/shop')}
                className="bg-none border-none cursor-pointer hover:scale-105 transition-transform"
              >
                <CoinBalance />
              </button>
              <button
                onClick={() => setShowCartPanel(true)}
                className="relative p-2 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] hover:bg-[rgba(0,224,255,0.15)] transition-all"
                aria-label="Wishlist & History"
              >
                <ShoppingCart className="w-5 h-5" />
                {wishlist.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {wishlist.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Tabs */}
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-2">
        <div className="glass-card p-1 flex gap-1">
          {(['shop', 'wishlist', 'history'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                tab === t
                  ? 'bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black'
                  : 'text-[#B0B8C8] hover:text-white'
              }`}
            >
              {t === 'shop' ? 'Shop' : t === 'wishlist' ? `Wishlist ${wishlist.length > 0 ? `(${wishlist.length})` : ''}` : 'History'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-4 pb-28 space-y-3">

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="flex gap-4">
                  <div className="w-24 h-32 bg-white/10 rounded-xl flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-2">
                    <div className="h-4 w-32 bg-white/10 rounded" />
                    <div className="h-3 w-48 bg-white/10 rounded" />
                    <div className="h-3 w-40 bg-white/10 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>

        ) : tab === 'history' ? (
          history.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <History className="w-10 h-10 text-[#B0B8C8]/20 mx-auto mb-3" />
              <p className="text-[#B0B8C8] text-sm font-semibold">No purchases yet</p>
              <p className="text-[#B0B8C8]/50 text-xs mt-1">Your skin purchase history will appear here</p>
            </div>
          ) : (
            history.map(h => (
              <div key={h.id} className="glass-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-bold text-sm">{(h.skin_items as any)?.name || 'Unknown Skin'}</p>
                    <p className="text-[#B0B8C8] text-xs mt-0.5 capitalize">{(h.skin_items as any)?.skin_type} effect</p>
                    <p className="text-[#B0B8C8]/60 text-xs mt-0.5">
                      {new Date(h.purchased_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-red-400 font-bold text-sm">-{h.amount} coins</p>
                    <p className="text-[#B0B8C8]/60 text-xs mt-0.5">Balance: {h.balance_after}</p>
                  </div>
                </div>
              </div>
            ))
          )

        ) : displaySkins.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Heart className="w-10 h-10 text-[#B0B8C8]/20 mx-auto mb-3" />
            <p className="text-[#B0B8C8] text-sm font-semibold">
              {tab === 'wishlist' ? 'Your wishlist is empty' : 'No skins available'}
            </p>
            <p className="text-[#B0B8C8]/50 text-xs mt-1">
              {tab === 'wishlist' ? 'Add skins from the shop to your wishlist' : 'Check back soon'}
            </p>
          </div>

        ) : (
          displaySkins.map(skin => {
            const owned = isOwned(skin.id);
            const active = isActive(skin.id);
            const wishlisted = isWishlisted(skin.id);
            const isPurchasing = purchasing === skin.id;
            const isActivating = activating === skin.id;
            const isWishlistLoading = wishlistLoading === skin.id;
            const canAfford = (profile?.coin_balance ?? 0) >= skin.price;
            const Icon = TYPE_ICONS[skin.skin_type] || Sparkles;
            const colours = TYPE_COLOURS[skin.skin_type] || 'from-[#00FF85] to-[#00E0FF]';

            return (
              <div key={skin.id} className={`glass-card p-4 ${active ? 'border-[#00FF85]/50' : ''}`}>
                <div className="flex gap-4">
                  {/* Preview */}
                  <div className="w-24 h-32 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-slate-900/60">
                    <SkinPreview item={skin} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-white font-bold text-sm">{skin.name}</span>
                        {active && (
                          <span className="text-[10px] font-bold text-black bg-gradient-to-r from-[#00FF85] to-[#00E0FF] px-1.5 py-0.5 rounded">
                            ACTIVE
                          </span>
                        )}
                        {owned && !active && (
                          <span className="text-[10px] font-bold text-[#B0B8C8] bg-white/10 px-1.5 py-0.5 rounded">
                            OWNED
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`text-[10px] font-bold text-black bg-gradient-to-r ${colours} px-1.5 py-0.5 rounded flex items-center gap-0.5`}>
                          <Icon className="w-2.5 h-2.5" />
                          {TYPE_LABELS[skin.skin_type]}
                        </span>
                      </div>

                      <p className="text-[#B0B8C8] text-xs leading-relaxed line-clamp-3">
                        {skin.description}
                      </p>
                    </div>

                    {/* Price + Actions */}
                    <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                      <div className="flex items-center gap-1">
                        <Coins className="w-3.5 h-3.5 text-[#FFD700]" />
                        <span className="text-[#FFD700] font-black text-sm">{skin.price}</span>
                        <span className="text-[#B0B8C8]/60 text-xs">coins</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Wishlist button */}
                        {!owned && (
                          <button
                            onClick={() => handleWishlist(skin.id)}
                            disabled={isWishlistLoading}
                            className={`p-2 rounded-lg border transition-all ${
                              wishlisted
                                ? 'bg-red-500/20 border-red-500/40 text-red-400'
                                : 'bg-white/5 border-white/10 text-[#B0B8C8] hover:text-red-400 hover:border-red-500/30'
                            }`}
                            aria-label="Wishlist"
                          >
                            {isWishlistLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-current' : ''}`} />}
                          </button>
                        )}

                        {/* Main action */}
                        {owned ? (
                          <button
                            onClick={() => !active && handleActivate(skin.id)}
                            disabled={active || isActivating}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                              active
                                ? 'bg-[#00FF85]/10 border border-[#00FF85]/30 text-[#00FF85] cursor-default'
                                : 'bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black hover:opacity-90 disabled:opacity-50'
                            }`}
                          >
                            {isActivating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            {active ? 'Active' : 'Equip'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePurchase(skin)}
                            disabled={isPurchasing || !canAfford}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                              canAfford
                                ? 'bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black hover:opacity-90 disabled:opacity-50'
                                : 'bg-white/5 border border-white/10 text-[#B0B8C8]/50 cursor-not-allowed'
                            }`}
                          >
                            {isPurchasing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Coins className="w-3.5 h-3.5" />}
                            {canAfford ? 'Buy Now' : 'Not enough coins'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* Cart/Wishlist Side Panel */}
      {showCartPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setShowCartPanel(false)} />
          <div className="w-80 bg-[#0f1829] border-l border-[rgba(0,224,255,0.3)] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-white font-bold">Wishlist & History</h2>
              <button onClick={() => setShowCartPanel(false)} className="text-[#B0B8C8] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-[#B0B8C8] text-xs font-bold uppercase tracking-wider mb-2">
                Wishlist ({wishlistSkins.length})
              </p>
              {wishlistSkins.length === 0 ? (
                <p className="text-[#B0B8C8]/50 text-xs">Nothing in your wishlist yet.</p>
              ) : (
                wishlistSkins.map(skin => (
                  <div key={skin.id} className="glass-card p-3 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-bold truncate">{skin.name}</p>
                      <p className="text-[#FFD700] text-xs">{skin.price} coins</p>
                    </div>
                    <button
                      onClick={() => handlePurchase(skin)}
                      disabled={purchasing === skin.id || (profile?.coin_balance ?? 0) < skin.price}
                      className="px-2 py-1 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black text-[10px] font-bold disabled:opacity-40"
                    >
                      {purchasing === skin.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Buy'}
                    </button>
                  </div>
                ))
              )}

              <p className="text-[#B0B8C8] text-xs font-bold uppercase tracking-wider mt-4 mb-2">
                Recent Purchases
              </p>
              {history.slice(0, 5).length === 0 ? (
                <p className="text-[#B0B8C8]/50 text-xs">No purchases yet.</p>
              ) : (
                history.slice(0, 5).map(h => (
                  <div key={h.id} className="glass-card p-3">
                    <p className="text-white text-xs font-bold">{(h.skin_items as any)?.name}</p>
                    <p className="text-red-400 text-xs">-{h.amount} coins</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
