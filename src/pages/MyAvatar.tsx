import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Sparkles, Loader2, Save } from 'lucide-react';

type HairColor = 'black' | 'brown' | 'blonde';
type SkinTone = 'dark' | 'medium' | 'light';
type EyeColor = 'blue' | 'green' | 'grey' | 'brown';
type Gender = 'male' | 'female';

interface AvatarConfig {
  hair_color: HairColor;
  skin_tone: SkinTone;
  eye_color: EyeColor;
  gender: Gender;
}

const SKIN_COLORS: Record<SkinTone, { skin: string; shade: string }> = {
  dark:   { skin: '#6B3A2A', shade: '#5A2E20' },
  medium: { skin: '#C68642', shade: '#A0692E' },
  light:  { skin: '#FDDBB4', shade: '#E8B98A' },
};

const HAIR_COLORS: Record<HairColor, string> = {
  black:  '#1A1A1A',
  brown:  '#5C3317',
  blonde: '#D4A017',
};

const EYE_COLORS: Record<EyeColor, string> = {
  blue:   '#4A90D9',
  green:  '#4CAF50',
  grey:   '#9E9E9E',
  brown:  '#795548',
};

const KIT_DEFAULT_PRIMARY   = '#FFFFFF';
const KIT_DEFAULT_SECONDARY = '#1E40AF';

interface KitColors {
  primary: string;
  secondary: string;
}

function FootballAvatar({
  config,
  kit,
  username,
  number,
}: {
  config: AvatarConfig;
  kit: KitColors;
  username: string;
  number: string;
}) {
  const skin = SKIN_COLORS[config.skin_tone];
  const hair = HAIR_COLORS[config.hair_color];
  const eye  = EYE_COLORS[config.eye_color];
  const isMale = config.gender === 'male';

  const primary   = kit.primary;
  const secondary = kit.secondary;

  const textOnPrimary = isLight(primary) ? '#000000' : '#FFFFFF';
  const textOnSecondary = isLight(secondary) ? '#000000' : '#FFFFFF';

  return (
    <svg
      viewBox="0 0 160 320"
      width="160"
      height="320"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Avatar"
    >
      {/* ── LEGS ── */}
      {/* Left thigh */}
      <rect x="55" y="188" width="22" height="50" rx="6" fill={primary} />
      {/* Right thigh */}
      <rect x="83" y="188" width="22" height="50" rx="6" fill={primary} />

      {/* Left shin */}
      <rect x="56" y="234" width="20" height="44" rx="5" fill="#FFFFFF" />
      {/* Right shin */}
      <rect x="84" y="234" width="20" height="44" rx="5" fill="#FFFFFF" />

      {/* Socks blue trim at top */}
      <rect x="56" y="234" width="20" height="6" rx="3" fill={secondary} />
      <rect x="84" y="234" width="20" height="6" rx="3" fill={secondary} />

      {/* Boots */}
      <rect x="54" y="272" width="24" height="12" rx="4" fill="#111827" />
      <rect x="82" y="272" width="24" height="12" rx="4" fill="#111827" />

      {/* ── SHORTS ── */}
      <rect x="52" y="182" width="56" height="22" rx="6" fill={primary} />
      <line x1="80" y1="182" x2="80" y2="204" stroke={secondary} strokeWidth="2" />

      {/* ── SHIRT BODY ── */}
      <rect x="44" y="112" width="72" height="75" rx="8" fill={primary} />

      {/* Shirt collar */}
      <path d="M72 112 Q80 120 88 112" stroke={secondary} strokeWidth="2" fill="none" />

      {/* Blue sleeves */}
      {/* Left sleeve */}
      <rect x="24" y="112" width="22" height="44" rx="6" fill={secondary} />
      {/* Right sleeve */}
      <rect x="114" y="112" width="22" height="44" rx="6" fill={secondary} />

      {/* Sleeve cuffs */}
      <rect x="24" y="150" width="22" height="6" rx="3" fill={primary} />
      <rect x="114" y="150" width="22" height="6" rx="3" fill={primary} />

      {/* "RatingSkill.com" on left chest */}
      <text
        x="57"
        y="133"
        fontSize="5.5"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill={isLight(primary) ? secondary : '#FFFFFF'}
        textAnchor="middle"
      >
        RatingSkill
      </text>
      <text
        x="57"
        y="140"
        fontSize="4.5"
        fontFamily="Arial, sans-serif"
        fill={isLight(primary) ? secondary : '#FFFFFF'}
        textAnchor="middle"
      >
        .com
      </text>

      {/* ── NECK ── */}
      <rect x="72" y="100" width="16" height="16" rx="4" fill={skin.skin} />

      {/* ── HEAD ── */}
      <ellipse cx="80" cy="82" rx="28" ry="30" fill={skin.skin} />

      {/* ── HAIR ── */}
      {isMale ? (
        /* Male: short sides, top coverage */
        <>
          <ellipse cx="80" cy="58" rx="28" ry="12" fill={hair} />
          <rect x="52" y="58" width="56" height="14" fill={hair} />
          {/* Fade sides */}
          <ellipse cx="54" cy="75" rx="4" ry="10" fill={hair} opacity="0.6" />
          <ellipse cx="106" cy="75" rx="4" ry="10" fill={hair} opacity="0.6" />
        </>
      ) : (
        /* Female: ponytail */
        <>
          <ellipse cx="80" cy="56" rx="28" ry="14" fill={hair} />
          <rect x="52" y="56" width="56" height="20" fill={hair} />
          {/* Ponytail */}
          <ellipse cx="108" cy="76" rx="7" ry="18" fill={hair} transform="rotate(20 108 76)" />
          <ellipse cx="113" cy="88" rx="5" ry="12" fill={hair} transform="rotate(30 113 88)" />
        </>
      )}

      {/* ── EARS ── */}
      <ellipse cx="52" cy="82" rx="5" ry="7" fill={skin.skin} />
      <ellipse cx="108" cy="82" rx="5" ry="7" fill={skin.skin} />
      <ellipse cx="52" cy="82" rx="3" ry="5" fill={skin.shade} />
      <ellipse cx="108" cy="82" rx="3" ry="5" fill={skin.shade} />

      {/* ── EYES ── */}
      {/* Eye whites */}
      <ellipse cx="70" cy="82" rx="7" ry="5.5" fill="white" />
      <ellipse cx="90" cy="82" rx="7" ry="5.5" fill="white" />
      {/* Irises */}
      <circle cx="70" cy="82" r="3.5" fill={eye} />
      <circle cx="90" cy="82" r="3.5" fill={eye} />
      {/* Pupils */}
      <circle cx="70" cy="82" r="1.5" fill="#111" />
      <circle cx="90" cy="82" r="1.5" fill="#111" />
      {/* Eye shine */}
      <circle cx="71" cy="81" r="0.8" fill="white" />
      <circle cx="91" cy="81" r="0.8" fill="white" />
      {/* Eyebrows */}
      <path d="M63 75 Q70 72 77 75" stroke={hair} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M83 75 Q90 72 97 75" stroke={hair} strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* ── NOSE ── */}
      <ellipse cx="80" cy="89" rx="3" ry="2" fill={skin.shade} />

      {/* ── SMILE ── */}
      <path d="M71 96 Q80 104 89 96" stroke={skin.shade} strokeWidth="2.2" fill="none" strokeLinecap="round" />

      {/* ── SHIRT BACK TEXT (shown via transform on a separate group) ── */}
      {/* We show it on the back by using a sub-section below the avatar */}
    </svg>
  );
}

function ShirtBack({
  config,
  kit,
  username,
  number,
}: {
  config: AvatarConfig;
  kit: KitColors;
  username: string;
  number: string;
}) {
  const primary   = kit.primary;
  const secondary = kit.secondary;

  return (
    <svg viewBox="0 0 140 90" width="140" height="90" xmlns="http://www.w3.org/2000/svg">
      {/* Back of shirt */}
      <rect x="0" y="0" width="140" height="90" rx="10" fill={primary} />
      <rect x="0" y="0" width="30" height="90" rx="10" fill={secondary} />
      <rect x="110" y="0" width="30" height="90" rx="10" fill={secondary} />

      {/* Username above number */}
      <text
        x="70"
        y="32"
        fontSize="12"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill={isLight(primary) ? secondary : '#FFFFFF'}
        textAnchor="middle"
      >
        {username.length > 10 ? username.slice(0, 10) : username}
      </text>

      {/* Number */}
      <text
        x="70"
        y="72"
        fontSize="38"
        fontFamily="Arial, sans-serif"
        fontWeight="900"
        fill={isLight(primary) ? secondary : '#FFFFFF'}
        textAnchor="middle"
      >
        {number || '10'}
      </text>
    </svg>
  );
}

function isLight(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

export default function MyAvatar() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [config, setConfig] = useState<AvatarConfig>({
    hair_color: 'black',
    skin_tone: 'medium',
    eye_color: 'brown',
    gender: (profile?.gender as Gender) || 'male',
  });
  const [kit, setKit] = useState<KitColors>({ primary: KIT_DEFAULT_PRIMARY, secondary: KIT_DEFAULT_SECONDARY });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    loadAvatarData();
  }, [profile?.id]);

  const loadAvatarData = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('avatar_config, gender')
        .eq('id', profile.id)
        .maybeSingle();

      if (profileData?.avatar_config) {
        const saved = profileData.avatar_config as AvatarConfig;
        setConfig({
          hair_color: saved.hair_color || 'black',
          skin_tone: saved.skin_tone || 'medium',
          eye_color: saved.eye_color || 'brown',
          gender: saved.gender || (profileData.gender as Gender) || 'male',
        });
      } else if (profileData?.gender) {
        setConfig(prev => ({ ...prev, gender: profileData.gender as Gender }));
      }

      const { data: userKitData } = await supabase
        .from('user_kits')
        .select('kit_id, is_active, kit_items(kit_primary_color, kit_secondary_color)')
        .eq('user_id', profile.id)
        .eq('is_active', true)
        .maybeSingle();

      if (userKitData?.kit_items) {
        const ki = userKitData.kit_items as any;
        setKit({
          primary:   ki.kit_primary_color   || KIT_DEFAULT_PRIMARY,
          secondary: ki.kit_secondary_color || KIT_DEFAULT_SECONDARY,
        });
      }
    } catch (err) {
      console.error('Failed to load avatar data:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = useCallback(async (updated: AvatarConfig) => {
    if (!profile) return;
    setSaving(true);
    try {
      await supabase
        .from('profiles')
        .update({ avatar_config: updated })
        .eq('id', profile.id);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save avatar config:', err);
    } finally {
      setSaving(false);
    }
  }, [profile?.id]);

  const update = (key: keyof AvatarConfig, value: string) => {
    const updated = { ...config, [key]: value } as AvatarConfig;
    setConfig(updated);
    saveConfig(updated);
  };

  const username = profile?.username || 'Player';
  const number   = (profile as any)?.number || '10';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
      </div>
    );
  }

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
            <h1 className="text-2xl font-bold text-white heading-glow">My Avatar</h1>
            <div className="w-16 flex justify-end">
              {saving && <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />}
              {!saving && saved && <span className="text-green-400 text-sm font-semibold">Saved!</span>}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-8 space-y-6">

        {/* Avatar display */}
        <div className="glass-card p-6 flex flex-col items-center gap-4">
          <h2 className="text-lg font-bold text-white">Front View</h2>
          <FootballAvatar config={config} kit={kit} username={username} number={number} />
        </div>

        {/* Shirt back */}
        <div className="glass-card p-6 flex flex-col items-center gap-3">
          <h2 className="text-lg font-bold text-white">Shirt Back</h2>
          <ShirtBack config={config} kit={kit} username={username} number={number} />
          <p className="text-gray-400 text-xs text-center">Name and number shown on kit back</p>
        </div>

        {/* Customisation */}
        <div className="glass-card p-5 space-y-5">
          <h2 className="text-lg font-bold text-white">Customise</h2>

          {/* Gender — only show toggle if profile.gender is null */}
          {!profile?.gender && (
            <div>
              <p className="text-sm font-semibold text-[#B0B8C8] mb-2">Gender</p>
              <div className="flex gap-3">
                {(['male', 'female'] as Gender[]).map(g => (
                  <button
                    key={g}
                    onClick={() => update('gender', g)}
                    className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all border ${
                      config.gender === g
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white border-transparent shadow-lg shadow-cyan-500/20'
                        : 'bg-white/5 text-gray-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {g === 'male' ? 'Male' : 'Female'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hair Colour */}
          <div>
            <p className="text-sm font-semibold text-[#B0B8C8] mb-2">Hair Colour</p>
            <div className="flex gap-3">
              {(Object.entries(HAIR_COLORS) as [HairColor, string][]).map(([key, color]) => (
                <button
                  key={key}
                  onClick={() => update('hair_color', key)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                    config.hair_color === key
                      ? 'border-cyan-400 bg-cyan-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-300 capitalize">{key}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Skin Tone */}
          <div>
            <p className="text-sm font-semibold text-[#B0B8C8] mb-2">Skin Tone</p>
            <div className="flex gap-3">
              {(Object.entries(SKIN_COLORS) as [SkinTone, { skin: string; shade: string }][]).map(([key, val]) => (
                <button
                  key={key}
                  onClick={() => update('skin_tone', key)}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                    config.skin_tone === key
                      ? 'border-cyan-400 bg-cyan-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: val.skin }}
                  />
                  <span className="text-xs text-gray-300 capitalize">
                    {key === 'dark' ? 'Dark' : key === 'medium' ? 'Medium' : 'Light'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Eye Colour */}
          <div>
            <p className="text-sm font-semibold text-[#B0B8C8] mb-2">Eye Colour</p>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(EYE_COLORS) as [EyeColor, string][]).map(([key, color]) => (
                <button
                  key={key}
                  onClick={() => update('eye_color', key)}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                    config.eye_color === key
                      ? 'border-cyan-400 bg-cyan-500/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div
                    className="w-7 h-7 rounded-full border-2 border-white/20"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs text-gray-300 capitalize">{key}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Kit colours info */}
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Active Kit</p>
            <p className="text-gray-400 text-xs mt-0.5">Change your kit in the Skins Store</p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg border border-white/20"
              style={{ backgroundColor: kit.primary }}
              title="Primary colour"
            />
            <div
              className="w-8 h-8 rounded-lg border border-white/20"
              style={{ backgroundColor: kit.secondary }}
              title="Secondary colour"
            />
          </div>
        </div>

        <button
          onClick={() => navigate('/skins-store')}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black hover:opacity-90 transition-all shadow-lg shadow-cyan-500/20"
        >
          <Sparkles className="w-5 h-5" />
          Go to Skins Store
        </button>
      </main>
    </div>
  );
}
