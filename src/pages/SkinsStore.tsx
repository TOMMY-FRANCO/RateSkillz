import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Sparkles, CheckCircle, Loader2, ShoppingBag, Zap } from 'lucide-react';

interface KitItem {
  id: string;
  name: string;
  description: string;
  price_gbp: number;
  stripe_price_id: string | null;
  kit_primary_color: string;
  kit_secondary_color: string;
  kit_pattern: string | null;
  is_active: boolean;
}

interface UserKit {
  kit_id: string;
  is_active: boolean;
}

function KitPreview({
  primary,
  secondary,
  size = 'md',
}: {
  primary: string;
  secondary: string;
  size?: 'sm' | 'md';
}) {
  const w = size === 'sm' ? 60 : 80;
  const h = size === 'sm' ? 70 : 90;
  return (
    <svg viewBox="0 0 80 90" width={w} height={h} xmlns="http://www.w3.org/2000/svg">
      {/* Shirt body */}
      <rect x="10" y="20" width="60" height="55" rx="8" fill={primary} />
      {/* Sleeves */}
      <rect x="0" y="20" width="14" height="36" rx="5" fill={secondary} />
      <rect x="66" y="20" width="14" height="36" rx="5" fill={secondary} />
      {/* Collar */}
      <path d="M33 20 Q40 28 47 20" stroke={secondary} strokeWidth="2" fill="none" />
      {/* Small logo text */}
      <text
        x="40"
        y="52"
        fontSize="6"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill={isLight(primary) ? secondary : '#FFFFFF'}
        textAnchor="middle"
      >
        RS
      </text>
    </svg>
  );
}

function isLight(hex: string): boolean {
  const h = (hex || '#000000').replace('#', '').padEnd(6, '0');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export default function SkinsStore() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [kits, setKits] = useState<KitItem[]>([]);
  const [userKits, setUserKits] = useState<UserKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile?.id]);

  const fetchData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [kitsRes, userKitsRes] = await Promise.all([
        supabase
          .from('kit_items')
          .select('id, name, description, price_gbp, stripe_price_id, kit_primary_color, kit_secondary_color, kit_pattern, is_active')
          .eq('is_active', true)
          .order('price_gbp', { ascending: true }),
        supabase
          .from('user_kits')
          .select('kit_id, is_active')
          .eq('user_id', profile.id),
      ]);

      if (kitsRes.error) throw kitsRes.error;
      setKits(kitsRes.data || []);
      setUserKits(userKitsRes.data || []);
    } catch (err) {
      console.error('Failed to load kits:', err);
      showMessage('error', 'Failed to load kits. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const ownsKit = (kitId: string) =>
    userKits.some(uk => uk.kit_id === kitId);

  const activeKitId = userKits.find(uk => uk.is_active)?.kit_id;

  const handleEquip = async (kit: KitItem) => {
    if (!profile) return;
    setActionLoading(kit.id);
    try {
      const alreadyOwns = ownsKit(kit.id);

      if (alreadyOwns) {
        await supabase
          .from('user_kits')
          .update({ is_active: false })
          .eq('user_id', profile.id);

        await supabase
          .from('user_kits')
          .update({ is_active: true })
          .eq('user_id', profile.id)
          .eq('kit_id', kit.id);
      } else {
        await supabase
          .from('user_kits')
          .update({ is_active: false })
          .eq('user_id', profile.id);

        await supabase.from('user_kits').insert({
          user_id: profile.id,
          kit_id: kit.id,
          is_active: true,
        });
      }

      await fetchData();
      showMessage('success', `${kit.name} equipped!`);
    } catch (err) {
      console.error('Failed to equip kit:', err);
      showMessage('error', 'Failed to equip kit. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBuy = async (kit: KitItem) => {
    if (!profile || !kit.stripe_price_id) return;
    setActionLoading(kit.id);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-kit-checkout`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          kit_id: kit.id,
          user_id: profile.id,
          price_id: kit.stripe_price_id,
          success_url: `${window.location.origin}/skins-store?success=1`,
          cancel_url: `${window.location.origin}/skins-store`,
        }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'No checkout URL returned');
      }
    } catch (err: any) {
      console.error('Failed to start checkout:', err);
      showMessage('error', err.message || 'Failed to start purchase. Please try again.');
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center space-x-2 text-[#B0B8C8] hover:text-[#00E0FF] transition-colors bg-transparent border-none cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-semibold">Back</span>
            </button>
            <h1 className="text-2xl font-bold text-white heading-glow">Skins Store</h1>
            <div className="w-16" />
          </div>
        </div>
      </nav>

      {message && (
        <div className="fixed top-20 right-4 z-50 max-w-xs">
          <div className={`glass-card p-3 border ${message.type === 'success' ? 'border-green-500/40' : 'border-red-500/40'}`}>
            <div className="flex items-center gap-2">
              {message.type === 'success'
                ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                : <Zap className="w-4 h-4 text-red-400 flex-shrink-0" />}
              <p className="text-sm text-white">{message.text}</p>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        <div className="text-center mb-6">
          <p className="text-gray-400 text-sm">Customise your player's kit. Equip any kit you own.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
          </div>
        ) : kits.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <ShoppingBag className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-400 mb-1">No kits available</h3>
            <p className="text-gray-500 text-sm">Check back soon for new kits!</p>
          </div>
        ) : (
          kits.map(kit => {
            const isFree    = kit.price_gbp === 0;
            const owned     = ownsKit(kit.id);
            const isEquipped = activeKitId === kit.id;
            const isLoading  = actionLoading === kit.id;

            return (
              <div
                key={kit.id}
                className={`glass-card p-5 transition-all ${isEquipped ? 'border-2 border-cyan-400/50 shadow-lg shadow-cyan-500/10' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <KitPreview primary={kit.kit_primary_color} secondary={kit.kit_secondary_color} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-white font-bold text-base">{kit.name}</h3>
                      {isEquipped && (
                        <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs font-bold rounded-full border border-cyan-500/30">
                          Active
                        </span>
                      )}
                      {isFree && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30">
                          Free
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{kit.description}</p>
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-5 h-5 rounded-full border border-white/20"
                        style={{ backgroundColor: kit.kit_primary_color }}
                        title="Primary"
                      />
                      <div
                        className="w-5 h-5 rounded-full border border-white/20"
                        style={{ backgroundColor: kit.kit_secondary_color }}
                        title="Secondary"
                      />
                      {!isFree && (
                        <span className="ml-auto text-white font-bold text-base">
                          £{Number(kit.price_gbp).toFixed(2)}
                        </span>
                      )}
                    </div>

                    {isEquipped ? (
                      <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold">
                        <CheckCircle className="w-4 h-4" />
                        Currently equipped
                      </div>
                    ) : isFree || owned ? (
                      <button
                        onClick={() => handleEquip(kit)}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black hover:opacity-90 transition-all disabled:opacity-50 shadow-lg shadow-cyan-500/20"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        Equip
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBuy(kit)}
                        disabled={isLoading || !kit.stripe_price_id}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm btn-primary disabled:opacity-50 transition-all"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBag className="w-4 h-4" />}
                        Buy for £{Number(kit.price_gbp).toFixed(2)}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div className="pt-2">
          <button
            onClick={() => navigate('/my-avatar')}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm glass-card text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/10 transition-all"
          >
            <Sparkles className="w-5 h-5" />
            View My Avatar
          </button>
        </div>
      </main>
    </div>
  );
}
