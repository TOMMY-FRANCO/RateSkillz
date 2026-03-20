import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  ArrowLeft, ShoppingCart, Heart, Zap, Award, Sparkles,
  Loader2, CheckCircle, History, X,
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

// Animated mini card preview — each skin has a unique effect
function SkinPreview({ item }: { item: SkinItem }) {
  if (item.image_url) {
    return (
      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
    );
  }

  const skinName = item.name.toLowerCase();

  // NEON PULSE
  if (skinName.includes('neon')) {
    return (
      <div className="w-full h-full flex items-center justify-center relative"
        style={{ background: 'linear-gradient(135deg,#0f1829,#1a2640)' }}>
        <style>{`
          @keyframes neonPulse{0%{transform:translateX(-100%) skewX(-15deg);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(300%) skewX(-15deg);opacity:0}}
          @keyframes neonBorder{0%,100%{box-shadow:0 0 8px rgba(0,224,255,0.4),inset 0 0 8px rgba(0,224,255,0.1);border-color:rgba(0,224,255,0.6)}50%{box-shadow:0 0 20px rgba(0,224,255,0.9),inset 0 0 15px rgba(0,224,255,0.25);border-color:rgba(0,224,255,1)}}
          @keyframes neonGlow{0%,100%{opacity:0.3}50%{opacity:0.7}}
          .np-card{animation:neonBorder 2s ease-in-out infinite;border-color:rgba(0,224,255,0.6)!important}
          .np-sweep{position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(0,224,255,0.35) 50%,transparent 70%);animation:neonPulse 2.5s ease-in-out infinite}
          .np-sweep2{position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(0,255,200,0.2) 50%,transparent 70%);animation:neonPulse 2.5s ease-in-out infinite 1.25s}
          .np-glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(0,224,255,0.15) 0%,transparent 70%);animation:neonGlow 2s ease-in-out infinite}
        `}</style>
        <div className="np-glow" style={{ position:'absolute', inset:0 }} />
        <div className="np-card" style={{ width:80, height:110, borderRadius:10, background:'linear-gradient(135deg,#1e2d4a,#0f1829)', border:'2px solid', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4 }}>
          <div className="np-sweep" />
          <div className="np-sweep2" />
          <MiniCardInner statColor="rgba(0,224,255,0.3)" />
        </div>
        <PreviewLabel />
      </div>
    );
  }

  // LIGHTNING STRIKE
  if (skinName.includes('lightning')) {
    return (
      <div className="w-full h-full flex items-center justify-center relative"
        style={{ background: 'linear-gradient(135deg,#0f1829,#1a2640)' }}>
        <style>{`
          @keyframes glitchBorder{0%,89%,100%{border-color:rgba(56,189,248,0.3);box-shadow:0 0 4px rgba(56,189,248,0.2)}90%,92%{border-color:rgba(147,210,255,1);box-shadow:0 0 30px rgba(56,189,248,1),0 0 60px rgba(56,189,248,0.6)}91%{border-color:rgba(56,189,248,0.1);box-shadow:none}93%,95%{border-color:rgba(200,230,255,0.9);box-shadow:0 0 20px rgba(147,210,255,0.8)}94%{border-color:rgba(56,189,248,0.05);box-shadow:none}96%,98%{border-color:rgba(147,210,255,0.7);box-shadow:0 0 10px rgba(56,189,248,0.5)}97%{border-color:rgba(56,189,248,0.2)}}
          @keyframes glitchShift{0%,88%,100%{transform:translateX(0) skewX(0deg);opacity:1}89%{transform:translateX(-3px) skewX(-2deg);opacity:0.9}90%{transform:translateX(4px) skewX(1deg);opacity:1}91%{transform:translateX(-2px) skewX(3deg);opacity:0.7}92%{transform:translateX(0) skewX(0deg);opacity:1}93%{transform:translateX(3px) skewX(-1deg);opacity:0.8}94%{transform:translateX(-1px) skewX(0deg);opacity:1}96%{transform:translateX(2px) skewX(-2deg);opacity:0.9}}
          @keyframes bolt1A{0%,85%,100%{opacity:0}86%{opacity:1}87%{opacity:0}88%{opacity:0.8}89%{opacity:0}91%{opacity:1}92%{opacity:0}94%{opacity:0.6}95%{opacity:0}97%{opacity:1}98%{opacity:0}}
          @keyframes bolt2A{0%,87%,100%{opacity:0}88%,90%{opacity:0.9}89%{opacity:0}92%,93%{opacity:0.7}95%,96%{opacity:1}97%{opacity:0}}
          @keyframes bolt3A{0%,90%,100%{opacity:0}91%,92%{opacity:0.8}93%{opacity:0}96%,97%{opacity:0.6}98%{opacity:0}}
          @keyframes scanlineA{0%,88%,100%{opacity:0;top:-10px}89%{opacity:0.6;top:20%}90%{opacity:0;top:40%}92%{opacity:0.4;top:60%}93%{opacity:0;top:80%}95%{opacity:0.3;top:30%}96%{opacity:0}}
          @keyframes staticA{0%,87%,100%{opacity:0}88%,89%,91%,93%,95%,97%{opacity:0.12}90%,92%,94%,96%,98%{opacity:0}}
          .ls-card{animation:glitchBorder 2.5s linear infinite,glitchShift 2.5s linear infinite;border-color:rgba(56,189,248,0.3)!important}
          .ls-bolt1{position:absolute;top:5px;left:45%;animation:bolt1A 2.5s linear infinite}
          .ls-bolt2{position:absolute;top:25px;left:28%;animation:bolt2A 2.5s linear infinite}
          .ls-bolt3{position:absolute;top:10px;left:62%;animation:bolt3A 2.5s linear infinite}
          .ls-scan{position:absolute;left:0;right:0;height:3px;background:rgba(147,210,255,0.5);animation:scanlineA 2.5s linear infinite}
          .ls-static{position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,rgba(56,189,248,0.15) 0px,transparent 1px,transparent 3px);animation:staticA 2.5s linear infinite}
        `}</style>
        <div className="ls-card" style={{ width:80, height:110, borderRadius:10, background:'linear-gradient(135deg,#1e2d4a,#0f1829)', border:'2px solid', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4 }}>
          <div className="ls-static" />
          <div className="ls-scan" />
          <div className="ls-bolt1">
            <svg width="14" height="44" viewBox="0 0 14 44" fill="none">
              <polyline points="10,0 5,16 11,16 2,44" stroke="#7dd3fc" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="10,0 5,16 11,16 2,44" stroke="#bae6fd" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
            </svg>
          </div>
          <div className="ls-bolt2">
            <svg width="9" height="30" viewBox="0 0 9 30" fill="none">
              <polyline points="7,0 3,12 8,12 1,30" stroke="#93c5fd" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="ls-bolt3">
            <svg width="7" height="22" viewBox="0 0 7 22" fill="none">
              <polyline points="5,0 2,9 6,9 0,22" stroke="#7dd3fc" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <MiniCardInner statColor="rgba(56,189,248,0.4)" />
        </div>
        <PreviewLabel />
      </div>
    );
  }

  // PLATINUM SHIMMER
  if (skinName.includes('platinum')) {
    return (
      <div className="w-full h-full flex items-center justify-center relative"
        style={{ background: 'linear-gradient(135deg,#0f1829,#1a2640)' }}>
        <style>{`
          @keyframes platWave{0%{transform:translateX(-120%) translateY(-120%) rotate(-35deg)}70%{transform:translateX(180%) translateY(180%) rotate(-35deg)}71%,73%{transform:translateX(185%) translateY(185%) rotate(-35deg)}72%{transform:translateX(170%) translateY(170%) rotate(-35deg)}74%{transform:translateX(186%) translateY(186%) rotate(-35deg)}100%{transform:translateX(190%) translateY(190%) rotate(-35deg)}}
          @keyframes platWave2{0%{transform:translateX(-120%) translateY(-120%) rotate(-35deg)}65%{transform:translateX(175%) translateY(175%) rotate(-35deg)}66%,68%{transform:translateX(180%) translateY(180%) rotate(-35deg)}67%{transform:translateX(168%) translateY(168%) rotate(-35deg)}100%{transform:translateX(185%) translateY(185%) rotate(-35deg)}}
          @keyframes platWave3{0%{transform:translateX(-120%) translateY(-120%) rotate(-35deg)}60%,62%{transform:translateX(170%) translateY(170%) rotate(-35deg)}61%{transform:translateX(160%) translateY(160%) rotate(-35deg)}100%{transform:translateX(180%) translateY(180%) rotate(-35deg)}}
          @keyframes platGlitch{0%,58%,65%,100%{transform:translateX(0) skewX(0deg);opacity:1}59%{transform:translateX(-2px) skewX(-1deg);opacity:0.85}60%{transform:translateX(3px) skewX(1.5deg);opacity:0.9}61%{transform:translateX(-1px) skewX(0deg);opacity:1}63%{transform:translateX(2px) skewX(-0.5deg);opacity:0.88}64%{transform:translateX(0) skewX(0deg);opacity:1}}
          @keyframes platBorder{0%{border-color:rgba(180,180,200,0.3);box-shadow:0 0 6px rgba(200,200,220,0.15)}30%{border-color:rgba(220,220,240,0.7);box-shadow:0 0 16px rgba(200,200,220,0.5),inset 0 0 8px rgba(255,255,255,0.08)}58%{border-color:rgba(200,200,220,0.5)}59%,61%{border-color:rgba(240,240,255,0.9);box-shadow:0 0 20px rgba(220,220,255,0.7)}60%{border-color:rgba(160,160,180,0.2);box-shadow:none}65%{border-color:rgba(200,200,220,0.5)}100%{border-color:rgba(180,180,200,0.3);box-shadow:0 0 6px rgba(200,200,220,0.15)}}
          .ps-card{animation:platBorder 4s ease-in-out infinite,platGlitch 4s ease-in-out infinite;border-color:rgba(180,180,200,0.4)!important;background:linear-gradient(135deg,#1e2d4a,#151e30,#1a2640)!important}
          .ps-wave1{position:absolute;top:-60px;left:-60px;width:220px;height:220px;background:linear-gradient(135deg,transparent 0%,rgba(255,255,255,0.02) 35%,rgba(255,255,255,0.18) 45%,rgba(220,220,255,0.22) 50%,rgba(255,255,255,0.18) 55%,rgba(255,255,255,0.02) 65%,transparent 100%);animation:platWave 4s cubic-bezier(0.4,0,0.6,1) infinite}
          .ps-wave2{position:absolute;top:-60px;left:-60px;width:220px;height:220px;background:linear-gradient(135deg,transparent 0%,rgba(200,200,255,0.01) 38%,rgba(255,255,255,0.10) 48%,rgba(255,255,255,0.08) 52%,transparent 62%,transparent 100%);animation:platWave2 4s cubic-bezier(0.4,0,0.6,1) infinite 0.3s}
          .ps-wave3{position:absolute;top:-60px;left:-60px;width:220px;height:220px;background:linear-gradient(135deg,transparent 0%,rgba(180,180,220,0.005) 40%,rgba(255,255,255,0.06) 50%,transparent 60%,transparent 100%);animation:platWave3 4s cubic-bezier(0.4,0,0.6,1) infinite 0.6s}
        `}</style>
        <div className="ps-card" style={{ width:80, height:110, borderRadius:10, border:'2px solid', position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4 }}>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(180,180,200,0.05),rgba(120,120,160,0.03),rgba(180,180,200,0.06))' }} />
          <div className="ps-wave1" />
          <div className="ps-wave2" />
          <div className="ps-wave3" />
          <MiniCardInner statColor="rgba(180,180,200,0.4)" avatarBorder="rgba(200,200,220,0.3)" nameBg="rgba(200,200,220,0.3)" />
        </div>
        <PreviewLabel />
      </div>
    );
  }

  // Fallback generic preview
  const Icon = TYPE_ICONS[item.skin_type] || Sparkles;
  const colours = TYPE_COLOURS[item.skin_type] || 'from-[#00FF85] to-[#00E0FF]';
  return (
    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${colours} bg-opacity-10`}>
      <Icon className="w-10 h-10 text-white/40" />
    </div>
  );
}

function MiniCardInner({ statColor = 'rgba(0,224,255,0.3)', avatarBorder = 'rgba(255,255,255,0.2)', nameBg = 'rgba(255,255,255,0.25)' }) {
  return (
    <>
      <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#334155,#1e293b)', border:`1.5px solid ${avatarBorder}`, flexShrink:0 }} />
      <div style={{ width:48, height:6, background:nameBg, borderRadius:3 }} />
      <div style={{ display:'flex', gap:2 }}>
        {[0,1,2,3].map(i => <div key={i} style={{ width:10, height:10, background:statColor, borderRadius:2 }} />)}
      </div>
    </>
  );
}

function PreviewLabel() {
  return (
    <div style={{ position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.4)', textTransform:'uppercase', letterSpacing:'0.1em', whiteSpace:'nowrap' }}>
      Live preview
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
      console.error('Error fetching skin store:', err);
    } finally {
      setLoading(false);
    }
  };

  const isOwned = (id: string) => ownedSkins.some(s => s.skin_id === id);
  const isActive = (id: string) => ownedSkins.some(s => s.skin_id === id && s.is_active);
  const isWishlisted = (id: string) => wishlist.some(w => w.skin_id === id);

  const handlePurchase = async (skin: SkinItem) => {
    if (!user || !profile) return;
    if ((profile.coin_balance ?? 0) < skin.price) { toast.error('Not enough coins.'); return; }
    if (isOwned(skin.id)) { toast.info('You already own this skin.'); return; }
    setPurchasing(skin.id);
    try {
      const before = profile.coin_balance ?? 0;
      const after = before - skin.price;
      await supabase.from('profiles').update({ coin_balance: after }).eq('id', user.id);
      await supabase.from('coin_transactions').insert({ user_id: user.id, amount: -skin.price, transaction_type: 'purchase', description: `Skin purchased: ${skin.name}`, balance_after: after });
      await supabase.from('user_skins').insert({ user_id: user.id, skin_id: skin.id, is_active: false });
      await supabase.from('skin_purchases').insert({ user_id: user.id, skin_id: skin.id, amount: skin.price, balance_before: before, balance_after: after });
      await supabase.from('coin_pool').update({ distributed_coins: after, remaining_coins: after }).eq('pool_type', 'skin_shop_purchase').catch(() => {});
      await supabase.from('user_notifications').insert({ user_id: user.id, notification_type: 'transaction', message: `You purchased the "${skin.name}" skin for ${skin.price} coins. New balance: ${after} coins.`, activity_feed_type: 'skin_purchase' }).catch(() => {});
      await supabase.from('notifications').insert({ user_id: user.id, type: 'skin_purchase', message: `Congratulations! You just equipped the "${skin.name}" skin on your card. Looking fresh!` }).catch(() => {});
      if (isWishlisted(skin.id)) {
        await supabase.from('skin_wishlist').delete().eq('user_id', user.id).eq('skin_id', skin.id).catch(() => {});
        setWishlist(prev => prev.filter(w => w.skin_id !== skin.id));
      }
      setOwnedSkins(prev => [...prev, { skin_id: skin.id, is_active: false }]);
      await refreshProfile();
      await fetchAll();
      toast.success(`"${skin.name}" purchased!`);
    } catch (err: any) {
      toast.error(err?.message || 'Purchase failed.');
    } finally {
      setPurchasing(null);
    }
  };

  const handleActivate = async (skinId: string) => {
    if (!user) return;
    setActivating(skinId);
    try {
      await supabase.from('user_skins').update({ is_active: false }).eq('user_id', user.id);
      await supabase.from('user_skins').update({ is_active: true }).eq('user_id', user.id).eq('skin_id', skinId);
      setOwnedSkins(prev => prev.map(s => ({ ...s, is_active: s.skin_id === skinId })));
      toast.success('Skin activated!');
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
      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/dashboard')} className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors" aria-label="Back">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white">Card Skins</h1>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/shop')} className="bg-none border-none cursor-pointer hover:scale-105 transition-transform">
                <CoinBalance />
              </button>
              <button onClick={() => setShowCartPanel(true)} className="relative p-2 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] hover:bg-[rgba(0,224,255,0.15)] transition-all" aria-label="Wishlist">
                <ShoppingCart className="w-5 h-5" />
                {wishlist.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{wishlist.length}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 pt-4 pb-2">
        <div className="glass-card p-1 flex gap-1">
          {(['shop', 'wishlist', 'history'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${tab === t ? 'bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black' : 'text-[#B0B8C8] hover:text-white'}`}>
              {t === 'shop' ? 'Shop' : t === 'wishlist' ? `Wishlist${wishlist.length > 0 ? ` (${wishlist.length})` : ''}` : 'History'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-4 pb-28 space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
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
                    <p className="text-[#B0B8C8]/60 text-xs mt-0.5">{new Date(h.purchased_at).toLocaleDateString()}</p>
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
            <p className="text-[#B0B8C8] text-sm font-semibold">{tab === 'wishlist' ? 'Your wishlist is empty' : 'No skins available'}</p>
            <p className="text-[#B0B8C8]/50 text-xs mt-1">{tab === 'wishlist' ? 'Add skins from the shop' : 'Check back soon'}</p>
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
                  <div className="w-24 h-32 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-slate-900/60">
                    <SkinPreview item={skin} />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-white font-bold text-sm">{skin.name}</span>
                        {active && <span className="text-[10px] font-bold text-black bg-gradient-to-r from-[#00FF85] to-[#00E0FF] px-1.5 py-0.5 rounded">ACTIVE</span>}
                        {owned && !active && <span className="text-[10px] font-bold text-[#B0B8C8] bg-white/10 px-1.5 py-0.5 rounded">OWNED</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className={`text-[10px] font-bold text-black bg-gradient-to-r ${colours} px-1.5 py-0.5 rounded flex items-center gap-0.5`}>
                          <Icon className="w-2.5 h-2.5" />{TYPE_LABELS[skin.skin_type]}
                        </span>
                      </div>
                      <p className="text-[#B0B8C8] text-xs leading-relaxed line-clamp-3">{skin.description}</p>
                    </div>
                    <div className="flex items-center justify-between mt-3 flex-wrap gap-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[#FFD700] font-black text-sm">{skin.price}</span>
                        <span className="text-[#B0B8C8]/60 text-xs">coins</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {!owned && (
                          <button onClick={() => handleWishlist(skin.id)} disabled={isWishlistLoading}
                            className={`p-2 rounded-lg border transition-all ${wishlisted ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-white/5 border-white/10 text-[#B0B8C8] hover:text-red-400 hover:border-red-500/30'}`}
                            aria-label="Wishlist">
                            {isWishlistLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-current' : ''}`} />}
                          </button>
                        )}
                        {owned ? (
                          <button onClick={() => !active && handleActivate(skin.id)} disabled={active || isActivating}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${active ? 'bg-[#00FF85]/10 border border-[#00FF85]/30 text-[#00FF85] cursor-default' : 'bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black hover:opacity-90 disabled:opacity-50'}`}>
                            {isActivating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            {active ? 'Active' : 'Equip'}
                          </button>
                        ) : (
                          <button onClick={() => handlePurchase(skin)} disabled={isPurchasing || !canAfford}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${canAfford ? 'bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black hover:opacity-90 disabled:opacity-50' : 'bg-white/5 border border-white/10 text-[#B0B8C8]/50 cursor-not-allowed'}`}>
                            {isPurchasing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
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

      {showCartPanel && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/60" onClick={() => setShowCartPanel(false)} />
          <div className="w-80 bg-[#0f1829] border-l border-[rgba(0,224,255,0.3)] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h2 className="text-white font-bold">Wishlist & History</h2>
              <button onClick={() => setShowCartPanel(false)} className="text-[#B0B8C8] hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-[#B0B8C8] text-xs font-bold uppercase tracking-wider mb-2">Wishlist ({wishlistSkins.length})</p>
              {wishlistSkins.length === 0 ? (
                <p className="text-[#B0B8C8]/50 text-xs">Nothing in your wishlist yet.</p>
              ) : (
                wishlistSkins.map(skin => (
                  <div key={skin.id} className="glass-card p-3 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-bold truncate">{skin.name}</p>
                      <p className="text-[#FFD700] text-xs">{skin.price} coins</p>
                    </div>
                    <button onClick={() => handlePurchase(skin)} disabled={purchasing === skin.id || (profile?.coin_balance ?? 0) < skin.price}
                      className="px-2 py-1 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FFA500] text-black text-[10px] font-bold disabled:opacity-40">
                      {purchasing === skin.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Buy'}
                    </button>
                  </div>
                ))
              )}
              <p className="text-[#B0B8C8] text-xs font-bold uppercase tracking-wider mt-4 mb-2">Recent Purchases</p>
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
