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
  const skin    = SKIN_COLORS[config.skin_tone];
  const hair    = HAIR_COLORS[config.hair_color];
  const eye     = EYE_COLORS[config.eye_color];
  const isMale  = config.gender === 'male';
  const primary   = kit.primary;
  const secondary = kit.secondary;
  const logoFill  = isLight(primary) ? secondary : '#FFFFFF';

  const skinGradId   = `sg-${config.skin_tone}`;
  const skinHiColor  = config.skin_tone === 'dark'   ? '#8B5240'
                     : config.skin_tone === 'medium' ? '#D9975A'
                     : '#FFF0DA';

  return (
    <svg
      viewBox="0 0 200 420"
      width="200"
      height="420"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Football player avatar"
    >
      <defs>
        {/* Skin gradient — lighter highlight on top, darker shadow below */}
        <linearGradient id={skinGradId} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%"   stopColor={skinHiColor} />
          <stop offset="60%"  stopColor={skin.skin} />
          <stop offset="100%" stopColor={skin.shade} />
        </linearGradient>
        {/* Neck gradient */}
        <linearGradient id={`nk-${config.skin_tone}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor={skin.shade} />
          <stop offset="40%"  stopColor={skin.skin} />
          <stop offset="100%" stopColor={skin.shade} />
        </linearGradient>
        {/* Shirt body shading */}
        <linearGradient id="shirtGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.12)" />
          <stop offset="50%"  stopColor="rgba(255,255,255,0.06)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.12)" />
        </linearGradient>
      </defs>

      {/* ═══════════════════════════════════════════
          BOOTS — drawn first so legs layer on top
      ═══════════════════════════════════════════ */}
      {/* Left boot */}
      <path
        d="M68 388 C62 388 58 385 57 381 C56 377 58 373 63 372 L80 372 L80 388 Z"
        fill="#1F2937"
      />
      <path
        d="M57 381 C56 384 57 388 62 390 L80 390 L80 388 L63 388 C60 388 58 385 57 381 Z"
        fill="#111827"
      />
      {/* Right boot */}
      <path
        d="M132 388 C138 388 142 385 143 381 C144 377 142 373 137 372 L120 372 L120 388 Z"
        fill="#1F2937"
      />
      <path
        d="M143 381 C144 384 143 388 138 390 L120 390 L120 388 L137 388 C140 388 142 385 143 381 Z"
        fill="#111827"
      />

      {/* ═══════════════════════════════════════════
          SOCKS
      ═══════════════════════════════════════════ */}
      {/* Left sock */}
      <path
        d="M63 320 C62 320 60 321 60 323 L60 372 C60 373 61 374 63 374 L80 374 L80 320 Z"
        fill={primary}
      />
      {/* Left sock secondary stripe */}
      <path
        d="M60 323 C60 321 62 320 63 320 L80 320 L80 330 L60 330 Z"
        fill={secondary}
      />
      {/* Right sock */}
      <path
        d="M137 320 C138 320 140 321 140 323 L140 372 C140 373 139 374 137 374 L120 374 L120 320 Z"
        fill={primary}
      />
      {/* Right sock secondary stripe */}
      <path
        d="M140 323 C140 321 138 320 137 320 L120 320 L120 330 L140 330 Z"
        fill={secondary}
      />

      {/* ═══════════════════════════════════════════
          LEGS (shorts region blends into thighs)
      ═══════════════════════════════════════════ */}
      {/* Left thigh + shin — single curved shape */}
      <path
        d="M68 250 C64 250 62 252 62 256 L60 320 C60 322 61 323 63 323 L80 323 L80 248 Z"
        fill={primary}
        opacity="0.95"
      />
      {/* Right thigh + shin */}
      <path
        d="M132 250 C136 250 138 252 138 256 L140 320 C140 322 139 323 137 323 L120 323 L120 248 Z"
        fill={primary}
        opacity="0.95"
      />

      {/* ═══════════════════════════════════════════
          SHORTS
      ═══════════════════════════════════════════ */}
      <path
        d="M62 210
           C60 210 58 212 58 215
           L60 252 C60 254 62 256 65 256
           L80 256 L80 210 Z"
        fill={secondary}
      />
      <path
        d="M138 210
           C140 210 142 212 142 215
           L140 252 C140 254 138 256 135 256
           L120 256 L120 210 Z"
        fill={secondary}
      />
      {/* Shorts waistband / centre */}
      <path
        d="M58 210 C58 206 62 204 68 204 L80 204 L120 204 L132 204 C138 204 142 206 142 210 L142 218 C142 222 138 224 132 224 L68 224 C62 224 58 222 58 218 Z"
        fill={secondary}
      />
      {/* Centre seam on shorts */}
      <path
        d="M100 224 L100 256"
        stroke={primary}
        strokeWidth="1.5"
        strokeOpacity="0.5"
        fill="none"
      />

      {/* ═══════════════════════════════════════════
          ARMS & HANDS
      ═══════════════════════════════════════════ */}
      {/* Left sleeve (secondary colour) */}
      <path
        d="M68 140
           C60 140 48 144 44 152
           L38 178
           C36 184 38 190 44 192
           C48 193 52 191 54 187
           L60 164
           C62 158 64 154 68 152 Z"
        fill={secondary}
      />
      {/* Left sleeve seam curve */}
      <path
        d="M68 140 C66 146 62 152 60 158"
        stroke={primary}
        strokeWidth="1"
        strokeOpacity="0.4"
        fill="none"
      />
      {/* Left cuff */}
      <path
        d="M38 178 C36 184 38 190 44 192 C48 193 52 191 54 187 L56 180 C52 182 46 182 44 178 Z"
        fill={primary}
        opacity="0.7"
      />
      {/* Left hand */}
      <path
        d="M44 192 C40 192 36 196 36 200 C36 205 40 208 45 208 C50 208 55 205 56 200 C57 196 53 192 48 192 Z"
        fill={`url(#${skinGradId})`}
      />

      {/* Right sleeve */}
      <path
        d="M132 140
           C140 140 152 144 156 152
           L162 178
           C164 184 162 190 156 192
           C152 193 148 191 146 187
           L140 164
           C138 158 136 154 132 152 Z"
        fill={secondary}
      />
      {/* Right sleeve seam */}
      <path
        d="M132 140 C134 146 138 152 140 158"
        stroke={primary}
        strokeWidth="1"
        strokeOpacity="0.4"
        fill="none"
      />
      {/* Right cuff */}
      <path
        d="M162 178 C164 184 162 190 156 192 C152 193 148 191 146 187 L144 180 C148 182 154 182 156 178 Z"
        fill={primary}
        opacity="0.7"
      />
      {/* Right hand */}
      <path
        d="M156 192 C160 192 164 196 164 200 C164 205 160 208 155 208 C150 208 145 205 144 200 C143 196 147 192 152 192 Z"
        fill={`url(#${skinGradId})`}
      />

      {/* ═══════════════════════════════════════════
          SHIRT BODY
      ═══════════════════════════════════════════ */}
      <path
        d="M68 140
           C62 140 58 144 58 150
           L58 204
           C58 208 62 210 68 210
           L132 210
           C138 210 142 208 142 204
           L142 150
           C142 144 138 140 132 140 Z"
        fill={primary}
      />
      {/* Shading overlay on shirt */}
      <path
        d="M68 140 C62 140 58 144 58 150 L58 204 C58 208 62 210 68 210 L132 210 C138 210 142 208 142 204 L142 150 C142 144 138 140 132 140 Z"
        fill="url(#shirtGrad)"
      />

      {/* Shirt collar — V-neck */}
      <path
        d="M88 140 Q100 155 112 140"
        stroke={secondary}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M88 140 Q100 158 112 140"
        stroke={secondary}
        strokeWidth="1"
        fill="none"
        strokeOpacity="0.4"
      />

      {/* Sleeve seam lines on shirt shoulders */}
      <path
        d="M68 140 C65 148 63 156 63 165"
        stroke={secondary}
        strokeWidth="1.5"
        strokeOpacity="0.5"
        fill="none"
      />
      <path
        d="M132 140 C135 148 137 156 137 165"
        stroke={secondary}
        strokeWidth="1.5"
        strokeOpacity="0.5"
        fill="none"
      />

      {/* RatingSkill.com logo on left chest */}
      <text
        x="82"
        y="168"
        fontSize="6.5"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill={logoFill}
        textAnchor="middle"
      >
        RatingSkill
      </text>
      <text
        x="82"
        y="177"
        fontSize="5.5"
        fontFamily="Arial, sans-serif"
        fill={logoFill}
        textAnchor="middle"
        opacity="0.85"
      >
        .com
      </text>

      {/* ═══════════════════════════════════════════
          NECK
      ═══════════════════════════════════════════ */}
      <path
        d="M88 128 C86 128 84 129 83 131 L83 142 C83 144 85 146 88 146 L112 146 C115 146 117 144 117 142 L117 131 C116 129 114 128 112 128 Z"
        fill={`url(#nk-${config.skin_tone})`}
      />

      {/* ═══════════════════════════════════════════
          HEAD
      ═══════════════════════════════════════════ */}
      {/* Ears — behind head */}
      <path
        d="M64 88 C59 86 55 89 55 95 C55 101 59 106 65 104 C68 103 70 100 70 97 C70 92 68 89 64 88 Z"
        fill={`url(#${skinGradId})`}
      />
      <path
        d="M136 88 C141 86 145 89 145 95 C145 101 141 106 135 104 C132 103 130 100 130 97 C130 92 132 89 136 88 Z"
        fill={`url(#${skinGradId})`}
      />
      {/* Inner ear shadow */}
      <path
        d="M64 91 C61 90 59 93 59 97 C59 101 61 104 64 103 C66 102 67 100 67 97 C67 93 66 91 64 91 Z"
        fill={skin.shade}
        opacity="0.5"
      />
      <path
        d="M136 91 C139 90 141 93 141 97 C141 101 139 104 136 103 C134 102 133 100 133 97 C133 93 134 91 136 91 Z"
        fill={skin.shade}
        opacity="0.5"
      />

      {/* Head shape — oval with gentle jawline curve */}
      <path
        d="M100 52
           C78 52 62 65 62 85
           C62 100 66 113 75 122
           C80 127 88 130 100 130
           C112 130 120 127 125 122
           C134 113 138 100 138 85
           C138 65 122 52 100 52 Z"
        fill={`url(#${skinGradId})`}
      />

      {/* ═══════════════════════════════════════════
          HAIR
      ═══════════════════════════════════════════ */}
      {isMale ? (
        <>
          {/* Male — short crop top, faded sides */}
          <path
            d="M100 50
               C80 50 63 58 62 72
               C61 78 63 83 66 87
               C67 82 68 76 70 73
               C72 70 76 68 80 68
               L100 66
               L120 68
               C124 68 128 70 130 73
               C132 76 133 82 134 87
               C137 83 139 78 138 72
               C137 58 120 50 100 50 Z"
            fill={hair}
          />
          {/* Side fade — left */}
          <path
            d="M62 72 C61 78 63 84 66 88 C64 85 63 80 63 75 C63 70 64 65 66 61 Z"
            fill={hair}
            opacity="0.5"
          />
          {/* Side fade — right */}
          <path
            d="M138 72 C139 78 137 84 134 88 C136 85 137 80 137 75 C137 70 136 65 134 61 Z"
            fill={hair}
            opacity="0.5"
          />
        </>
      ) : (
        <>
          {/* Female — full head coverage */}
          <path
            d="M100 48
               C78 48 60 60 60 78
               C60 85 62 91 66 96
               C66 90 67 83 70 78
               C73 73 78 70 84 70
               L100 68
               L116 70
               C122 70 127 73 130 78
               C133 83 134 90 134 96
               C138 91 140 85 140 78
               C140 60 122 48 100 48 Z"
            fill={hair}
          />
          {/* Side hair falling down */}
          <path
            d="M62 80 C60 87 60 96 63 104 C66 110 70 115 74 119 C70 112 67 104 66 96 C65 90 64 84 62 80 Z"
            fill={hair}
          />
          <path
            d="M138 80 C140 87 140 96 137 104 C134 110 130 115 126 119 C130 112 133 104 134 96 C135 90 136 84 138 80 Z"
            fill={hair}
          />
          {/* Ponytail — sweeps back from right side */}
          <path
            d="M130 82
               C134 80 140 80 145 84
               C152 90 155 100 153 112
               C151 122 146 130 140 134
               C136 136 132 136 130 132
               C134 128 137 122 138 114
               C139 106 137 96 132 90
               C130 86 129 84 130 82 Z"
            fill={hair}
          />
          {/* Ponytail tail tip */}
          <path
            d="M140 134 C138 140 136 146 134 150 C132 154 130 156 128 155 C130 150 133 144 135 137 C137 130 138 124 138 118 C139 124 140 130 140 134 Z"
            fill={hair}
          />
          {/* Hair band */}
          <path
            d="M130 100 C133 98 137 98 139 100 C141 102 141 105 139 107 C137 109 133 109 131 107 C129 105 129 102 130 100 Z"
            fill={secondary}
          />
        </>
      )}

      {/* ═══════════════════════════════════════════
          FACE FEATURES
      ═══════════════════════════════════════════ */}

      {/* Eyebrows */}
      <path
        d="M76 82 C79 78 84 77 88 79"
        stroke={hair}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M112 82 C109 78 104 77 100 79"
        stroke={hair}
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Eye whites */}
      <path
        d="M76 91 C76 87 78 85 82 85 C86 85 88 87 88 91 C88 95 86 97 82 97 C78 97 76 95 76 91 Z"
        fill="white"
      />
      <path
        d="M112 91 C112 87 114 85 118 85 C122 85 124 87 124 91 C124 95 122 97 118 97 C114 97 112 95 112 91 Z"
        fill="white"
      />
      {/* Irises */}
      <circle cx="82"  cy="91" r="4.5" fill={eye} />
      <circle cx="118" cy="91" r="4.5" fill={eye} />
      {/* Pupils */}
      <circle cx="82"  cy="91" r="2.2" fill="#111" />
      <circle cx="118" cy="91" r="2.2" fill="#111" />
      {/* Eye shine highlights */}
      <circle cx="83.5" cy="89.5" r="1.2" fill="white" opacity="0.9" />
      <circle cx="119.5" cy="89.5" r="1.2" fill="white" opacity="0.9" />
      {/* Lower eyelid line */}
      <path
        d="M76 93 C78 96 86 96 88 93"
        stroke={skin.shade}
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M112 93 C114 96 122 96 124 93"
        stroke={skin.shade}
        strokeWidth="0.8"
        fill="none"
        opacity="0.5"
      />

      {/* Nose — subtle curved bridge and nostrils */}
      <path
        d="M100 96 C99 100 97 104 96 107 C98 109 102 109 104 107 C103 104 101 100 100 96 Z"
        fill={skin.shade}
        opacity="0.45"
      />
      <path
        d="M96 107 C95 110 97 112 100 112 C103 112 105 110 104 107"
        stroke={skin.shade}
        strokeWidth="1.2"
        fill="none"
        opacity="0.6"
        strokeLinecap="round"
      />

      {/* Smile — wide curve showing teeth */}
      <path
        d="M84 118 C87 125 100 127 116 118"
        stroke={skin.shade}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Teeth */}
      <path
        d="M85 118 C88 124 100 126 115 118 C112 124 105 128 100 128 C95 128 88 124 85 118 Z"
        fill="white"
        opacity="0.9"
      />
      {/* Smile mouth outline */}
      <path
        d="M84 118 C87 126 100 129 116 118"
        stroke={skin.shade}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.5"
      />
      {/* Cheek blush */}
      <ellipse cx="74"  cy="110" rx="7" ry="4" fill="#FF9999" opacity="0.25" />
      <ellipse cx="126" cy="110" rx="7" ry="4" fill="#FF9999" opacity="0.25" />
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
