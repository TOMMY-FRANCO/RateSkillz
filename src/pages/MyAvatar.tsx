import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Sparkles, Loader2 } from 'lucide-react';

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

function isLight(hex: string): boolean {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 128;
}

function FootballAvatar({
  config,
  kit,
}: {
  config: AvatarConfig;
  kit: KitColors;
  username: string;
  number: string;
}) {
  const skin      = SKIN_COLORS[config.skin_tone];
  const hair      = HAIR_COLORS[config.hair_color];
  const eye       = EYE_COLORS[config.eye_color];
  const isMale    = config.gender === 'male';
  const primary   = kit.primary;
  const secondary = kit.secondary;
  const logoFill  = isLight(primary) ? secondary : '#FFFFFF';

  const gid    = config.skin_tone;
  const skinHi  = gid === 'dark' ? '#8C4A35' : gid === 'medium' ? '#DFA060' : '#FFF3E0';
  const skinMid = skin.skin;
  const skinLo  = skin.shade;

  return (
    <svg
      viewBox="0 0 220 500"
      width="200"
      height="455"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Football player avatar"
    >
      <defs>
        <linearGradient id={`face-${gid}`} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%"   stopColor={skinHi} />
          <stop offset="45%"  stopColor={skinMid} />
          <stop offset="100%" stopColor={skinLo} />
        </linearGradient>
        <linearGradient id={`face-h-${gid}`} x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%"   stopColor={skinLo} stopOpacity="0.7" />
          <stop offset="30%"  stopColor={skinMid} stopOpacity="0" />
          <stop offset="70%"  stopColor={skinMid} stopOpacity="0" />
          <stop offset="100%" stopColor={skinLo} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`neck-${gid}`} x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%"   stopColor={skinLo} />
          <stop offset="35%"  stopColor={skinMid} />
          <stop offset="65%"  stopColor={skinMid} />
          <stop offset="100%" stopColor={skinLo} />
        </linearGradient>
        <linearGradient id="shirtSide" x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.15)" />
          <stop offset="25%"  stopColor="rgba(0,0,0,0)" />
          <stop offset="75%"  stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.15)" />
        </linearGradient>
        <linearGradient id={`leg-${gid}`} x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%"   stopColor={skinLo} />
          <stop offset="40%"  stopColor={skinMid} />
          <stop offset="100%" stopColor={skinLo} />
        </linearGradient>
      </defs>

      {isMale ? (
        <>
          {/* ══ MALE FIGURE ══ */}

          {/* BOOTS */}
          <path d="M76 458 C70 458 64 455 62 450 C60 445 62 440 67 439 L84 439 C84 445 83 452 82 458 Z" fill="#374151" />
          <path d="M62 450 C60 454 62 459 67 461 C70 462 76 462 82 461 L82 458 C77 458 70 458 67 458 C64 457 62 454 62 450 Z" fill="#F9FAFB" opacity="0.3" />
          <path d="M144 458 C150 458 156 455 158 450 C160 445 158 440 153 439 L136 439 C136 445 137 452 138 458 Z" fill="#374151" />
          <path d="M158 450 C160 454 158 459 153 461 C150 462 144 462 138 461 L138 458 C143 458 150 458 153 458 C156 457 158 454 158 450 Z" fill="#F9FAFB" opacity="0.3" />

          {/* SOCKS */}
          <path d="M67 390 C66 390 64 391 64 393 L64 439 C64 440 65 441 67 441 L84 441 L84 390 Z" fill={primary} />
          <path d="M64 393 C64 391 66 390 67 390 L84 390 L84 402 L64 402 Z" fill={secondary} />
          <path d="M153 390 C154 390 156 391 156 393 L156 439 C156 440 155 441 153 441 L136 441 L136 390 Z" fill={primary} />
          <path d="M156 393 C156 391 154 390 153 390 L136 390 L136 402 L156 402 Z" fill={secondary} />

          {/* LEGS — lengthened, start at 275 */}
          <path d="M74 275 C70 275 66 277 65 281 L64 390 C64 392 65 393 67 393 L84 393 L84 273 Z" fill={`url(#leg-${gid})`} />
          <path d="M146 275 C150 275 154 277 155 281 L156 390 C156 392 155 393 153 393 L136 393 L136 273 Z" fill={`url(#leg-${gid})`} />

          {/* SHORTS — moved down to y=252 */}
          <path d="M66 252 C63 252 61 254 61 258 L65 275 C65 277 67 279 70 279 L84 279 L84 250 Z" fill={secondary} />
          <path d="M154 252 C157 252 159 254 159 258 L155 275 C155 277 153 279 150 279 L136 279 L136 250 Z" fill={secondary} />
          <path d="M61 252 C61 247 65 244 73 244 L84 244 L136 244 L147 244 C154 244 159 247 159 252 L159 262 C159 267 154 269 147 269 L73 269 C65 269 61 267 61 262 Z" fill={secondary} />
          <path d="M110 269 L110 279" stroke={primary} strokeWidth="1.5" strokeOpacity="0.4" fill="none" />

          {/* LEFT ARM — pulled in closer to body */}
          <path d="M82 163 C74 163 63 168 59 177 L52 207 C50 213 52 220 57 223 C62 225 67 222 69 217 L76 190 C79 182 81 176 83 170 Z" fill={secondary} />
          <path d="M52 207 C50 213 52 220 57 223 C62 225 67 222 69 217 L71 209 C66 212 59 211 57 207 Z" fill={primary} opacity="0.6" />
          <path d="M57 223 C53 223 49 228 49 233 C49 239 53 242 59 242 C65 242 70 239 71 233 C72 228 68 223 62 223 Z" fill={`url(#face-${gid})`} />
          <path d="M58 236 Q59 238 61 238 Q63 238 64 236" stroke={skinLo} strokeWidth="0.8" fill="none" opacity="0.5" />

          {/* RIGHT ARM — pulled in closer to body */}
          <path d="M138 163 C146 163 157 168 161 177 L168 207 C170 213 168 220 163 223 C158 225 153 222 151 217 L144 190 C141 182 139 176 137 170 Z" fill={secondary} />
          <path d="M168 207 C170 213 168 220 163 223 C158 225 153 222 151 217 L149 209 C154 212 161 211 163 207 Z" fill={primary} opacity="0.6" />
          <path d="M163 223 C167 223 171 228 171 233 C171 239 167 242 161 242 C155 242 150 239 149 233 C148 228 152 223 158 223 Z" fill={`url(#face-${gid})`} />
          <path d="M162 236 Q161 238 159 238 Q157 238 156 236" stroke={skinLo} strokeWidth="0.8" fill="none" opacity="0.5" />

          {/* SHIRT — narrower, from x=82 to x=138 */}
          <path d="M82 163 C75 163 69 168 68 175 L64 244 C64 247 68 249 75 249 L84 249 L136 249 L145 249 C152 249 156 247 156 244 L152 175 C151 168 145 163 138 163 Z" fill={primary} />
          <path d="M82 163 C75 163 69 168 68 175 L64 244 C64 247 68 249 75 249 L84 249 L136 249 L145 249 C152 249 156 247 156 244 L152 175 C151 168 145 163 138 163 Z" fill="url(#shirtSide)" />
          {/* V-collar */}
          <path d="M96 163 Q110 179 124 163" stroke={secondary} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M96 163 Q110 181 124 163" stroke={secondary} strokeWidth="1" fill="none" strokeOpacity="0.35" />
          {/* Sleeve seams */}
          <path d="M82 163 C79 171 77 181 77 191" stroke={secondary} strokeWidth="1.5" strokeOpacity="0.45" fill="none" />
          <path d="M138 163 C141 171 143 181 143 191" stroke={secondary} strokeWidth="1.5" strokeOpacity="0.45" fill="none" />
          {/* Logo */}
          <text x="91" y="195" fontSize="7" fontFamily="Arial, sans-serif" fontWeight="bold" fill={logoFill} textAnchor="middle">RatingSkill</text>
          <text x="91" y="205" fontSize="6" fontFamily="Arial, sans-serif" fill={logoFill} textAnchor="middle" opacity="0.85">.com</text>

          {/* NECK */}
          <path d="M101 146 C97 146 94 148 93 151 L93 165 C93 168 96 170 100 170 L120 170 C124 170 127 168 127 165 L127 151 C126 148 123 146 119 146 Z" fill={`url(#neck-${gid})`} />

          {/* EARS */}
          <path d="M76 100 C71 98 66 101 66 108 C66 115 71 121 77 119 C80 118 82 115 82 111 C82 105 80 101 76 100 Z" fill={`url(#face-${gid})`} />
          <path d="M76 103 C73 102 70 105 70 110 C70 115 73 118 76 117 C78 116 79 114 79 111 C79 107 78 104 76 103 Z" fill={skinLo} opacity="0.45" />
          <path d="M144 100 C149 98 154 101 154 108 C154 115 149 121 143 119 C140 118 138 115 138 111 C138 105 140 101 144 100 Z" fill={`url(#face-${gid})`} />
          <path d="M144 103 C147 102 150 105 150 110 C150 115 147 118 144 117 C142 116 141 114 141 111 C141 107 142 104 144 103 Z" fill={skinLo} opacity="0.45" />

          {/* HEAD — smaller, 76px wide instead of 84px */}
          <path d="M110 60 C89 60 74 74 74 95 C74 112 79 127 89 136 C95 142 102 146 110 146 C118 146 125 142 131 136 C141 127 146 112 146 95 C146 74 131 60 110 60 Z" fill={`url(#face-${gid})`} />
          <path d="M110 60 C89 60 74 74 74 95 C74 112 79 127 89 136 C95 142 102 146 110 146 C118 146 125 142 131 136 C141 127 146 112 146 95 C146 74 131 60 110 60 Z" fill={`url(#face-h-${gid})`} />

          {/* HAIR — male short fade, matched to smaller head */}
          <path d="M110 57 C90 57 74 66 73 81 C72 88 74 95 78 101 C79 95 81 88 84 84 C87 80 92 77 98 76 L110 74 L122 76 C128 77 133 80 136 84 C139 88 141 95 142 101 C146 95 148 88 147 81 C146 66 130 57 110 57 Z" fill={hair} />
          <path d="M73 81 C72 88 74 95 78 101 C76 98 75 93 75 87 C75 81 76 76 78 71 Z" fill={hair} opacity="0.45" />
          <path d="M147 81 C148 88 146 95 142 101 C144 98 145 93 145 87 C145 81 144 76 142 71 Z" fill={hair} opacity="0.45" />

          {/* FACE FEATURES — male */}
          {/* Brows */}
          <path d="M83 91 C86 86 92 85 97 87" stroke={hair} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M137 91 C134 86 128 85 123 87" stroke={hair} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          {/* Eye whites */}
          <path d="M80 100 C80 95 83 92 89 92 C95 92 98 95 98 100 C98 105 95 108 89 108 C83 108 80 105 80 100 Z" fill="white" />
          <path d="M122 100 C122 95 125 92 131 92 C137 92 140 95 140 100 C140 105 137 108 131 108 C125 108 122 105 122 100 Z" fill="white" />
          {/* Irises */}
          <circle cx="89"  cy="100" r="5" fill={eye} />
          <circle cx="131" cy="100" r="5" fill={eye} />
          {/* Pupils */}
          <circle cx="89"  cy="100" r="2.4" fill="#111" />
          <circle cx="131" cy="100" r="2.4" fill="#111" />
          {/* Highlights */}
          <circle cx="90.5" cy="98.5" r="1.4" fill="white" opacity="0.92" />
          <circle cx="132.5" cy="98.5" r="1.4" fill="white" opacity="0.92" />
          {/* Lower eyelid lines */}
          <path d="M80 102 C82 106 96 106 98 102" stroke={skinLo} strokeWidth="0.9" fill="none" opacity="0.4" />
          <path d="M122 102 C124 106 138 106 140 102" stroke={skinLo} strokeWidth="0.9" fill="none" opacity="0.4" />
          {/* Nose */}
          <path d="M110 108 C109 113 107 118 106 121 C108 123 112 123 114 121 C113 118 111 113 110 108 Z" fill={skinLo} opacity="0.4" />
          <path d="M106 121 C105 124 107 127 110 127 C113 127 115 124 114 121" stroke={skinLo} strokeWidth="1.3" fill="none" opacity="0.55" strokeLinecap="round" />
          {/* Smile */}
          <path d="M96 134 C99 142 121 142 124 134" stroke={skinLo} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.65" />
          <path d="M97 134 C100 141 120 141 123 134 C120 137 116 141 110 141 C104 141 100 137 97 134 Z" fill="white" opacity="0.88" />
          <path d="M96 134 C99 143 121 143 124 134" stroke={skinLo} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.4" />
        </>
      ) : (
        <>
          {/* ══ FEMALE FIGURE ══ */}

          {/* BOOTS */}
          <path d="M76 458 C70 458 64 455 62 450 C60 445 62 440 67 439 L84 439 C84 445 83 452 82 458 Z" fill="#374151" />
          <path d="M62 450 C60 454 62 459 67 461 C70 462 76 462 82 461 L82 458 C77 458 70 458 67 458 C64 457 62 454 62 450 Z" fill="#F9FAFB" opacity="0.3" />
          <path d="M144 458 C150 458 156 455 158 450 C160 445 158 440 153 439 L136 439 C136 445 137 452 138 458 Z" fill="#374151" />
          <path d="M158 450 C160 454 158 459 153 461 C150 462 144 462 138 461 L138 458 C143 458 150 458 153 458 C156 457 158 454 158 450 Z" fill="#F9FAFB" opacity="0.3" />

          {/* SOCKS */}
          <path d="M67 390 C66 390 64 391 64 393 L64 439 C64 440 65 441 67 441 L84 441 L84 390 Z" fill={primary} />
          <path d="M64 393 C64 391 66 390 67 390 L84 390 L84 402 L64 402 Z" fill={secondary} />
          <path d="M153 390 C154 390 156 391 156 393 L156 439 C156 440 155 441 153 441 L136 441 L136 390 Z" fill={primary} />
          <path d="M156 393 C156 391 154 390 153 390 L136 390 L136 402 L156 402 Z" fill={secondary} />

          {/* LEGS — lengthened */}
          <path d="M74 278 C70 278 66 280 65 284 L64 390 C64 392 65 393 67 393 L84 393 L84 276 Z" fill={`url(#leg-${gid})`} />
          <path d="M146 278 C150 278 154 280 155 284 L156 390 C156 392 155 393 153 393 L136 393 L136 276 Z" fill={`url(#leg-${gid})`} />

          {/* SHORTS */}
          <path d="M65 255 C62 255 60 257 60 261 L64 278 C64 280 66 282 69 282 L84 282 L84 253 Z" fill={secondary} />
          <path d="M155 255 C158 255 160 257 160 261 L156 278 C156 280 154 282 151 282 L136 282 L136 253 Z" fill={secondary} />
          <path d="M60 255 C60 250 64 247 72 247 L84 247 L136 247 L148 247 C156 247 160 250 160 255 L160 265 C160 270 156 272 148 272 L72 272 C64 272 60 270 60 265 Z" fill={secondary} />
          <path d="M110 272 L110 282" stroke={primary} strokeWidth="1.5" strokeOpacity="0.4" fill="none" />

          {/* LEFT ARM — slim, feminine */}
          <path d="M84 165 C76 165 65 170 61 179 L54 208 C52 214 54 221 59 224 C64 226 69 223 71 218 L78 191 C81 183 83 177 85 172 Z" fill={secondary} />
          <path d="M54 208 C52 214 54 221 59 224 C64 226 69 223 71 218 L73 210 C68 213 61 212 59 208 Z" fill={primary} opacity="0.6" />
          <path d="M59 224 C55 224 51 229 51 234 C51 240 55 243 61 243 C67 243 72 240 73 234 C74 229 70 224 64 224 Z" fill={`url(#face-${gid})`} />

          {/* RIGHT ARM — slim, feminine */}
          <path d="M136 165 C144 165 155 170 159 179 L166 208 C168 214 166 221 161 224 C156 226 151 223 149 218 L142 191 C139 183 137 177 135 172 Z" fill={secondary} />
          <path d="M166 208 C168 214 166 221 161 224 C156 226 151 223 149 218 L147 210 C152 213 159 212 161 208 Z" fill={primary} opacity="0.6" />
          <path d="M161 224 C165 224 169 229 169 234 C169 240 165 243 159 243 C153 243 148 240 147 234 C146 229 150 224 156 224 Z" fill={`url(#face-${gid})`} />

          {/* SHIRT — hourglass, narrower */}
          <path d="M84 165 C77 165 71 170 70 177 L66 247 C66 250 70 252 77 252 L84 252 L136 252 L143 252 C150 252 154 250 154 247 L150 177 C149 170 143 165 136 165 Z" fill={primary} />
          <path d="M84 165 C77 165 71 170 70 177 L66 247 C66 250 70 252 77 252 L84 252 L136 252 L143 252 C150 252 154 250 154 247 L150 177 C149 170 143 165 136 165 Z" fill="url(#shirtSide)" />
          {/* V-collar */}
          <path d="M96 165 Q110 181 124 165" stroke={secondary} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M96 165 Q110 183 124 165" stroke={secondary} strokeWidth="1" fill="none" strokeOpacity="0.35" />
          {/* Sleeve seams */}
          <path d="M84 165 C81 173 79 183 79 193" stroke={secondary} strokeWidth="1.5" strokeOpacity="0.45" fill="none" />
          <path d="M136 165 C139 173 141 183 141 193" stroke={secondary} strokeWidth="1.5" strokeOpacity="0.45" fill="none" />
          {/* Logo */}
          <text x="93" y="197" fontSize="7" fontFamily="Arial, sans-serif" fontWeight="bold" fill={logoFill} textAnchor="middle">RatingSkill</text>
          <text x="93" y="207" fontSize="6" fontFamily="Arial, sans-serif" fill={logoFill} textAnchor="middle" opacity="0.85">.com</text>

          {/* NECK */}
          <path d="M102 148 C98 148 95 150 94 153 L94 167 C94 170 97 172 101 172 L119 172 C123 172 126 170 126 167 L126 153 C125 150 122 148 118 148 Z" fill={`url(#neck-${gid})`} />

          {/* EARS */}
          <path d="M76 102 C71 100 66 103 66 110 C66 117 71 123 77 121 C80 120 82 117 82 113 C82 107 80 103 76 102 Z" fill={`url(#face-${gid})`} />
          <path d="M76 105 C73 104 70 107 70 112 C70 117 73 120 76 119 C78 118 79 116 79 113 C79 109 78 106 76 105 Z" fill={skinLo} opacity="0.4" />
          <path d="M144 102 C149 100 154 103 154 110 C154 117 149 123 143 121 C140 120 138 117 138 113 C138 107 140 103 144 102 Z" fill={`url(#face-${gid})`} />
          <path d="M144 105 C147 104 150 107 150 112 C150 117 147 120 144 119 C142 118 141 116 141 113 C141 109 142 106 144 105 Z" fill={skinLo} opacity="0.4" />

          {/* HEAD — softer oval, slightly narrower */}
          <path d="M110 62 C90 62 75 76 75 97 C75 115 80 130 90 139 C96 145 102 149 110 149 C118 149 124 145 130 139 C140 130 145 115 145 97 C145 76 130 62 110 62 Z" fill={`url(#face-${gid})`} />
          <path d="M110 62 C90 62 75 76 75 97 C75 115 80 130 90 139 C96 145 102 149 110 149 C118 149 124 145 130 139 C140 130 145 115 145 97 C145 76 130 62 110 62 Z" fill={`url(#face-h-${gid})`} />
          {/* Contour shading */}
          <path d="M80 111 C77 115 77 121 80 125" stroke={skinLo} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.2" />
          <path d="M140 111 C143 115 143 121 140 125" stroke={skinLo} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.2" />

          {/* HAIR — high ponytail, matched to smaller head */}
          <path d="M110 59 C88 59 72 70 72 88 C72 95 74 102 78 108 C79 101 81 93 85 88 C89 83 95 80 102 79 L110 77 L118 79 C125 80 131 83 135 88 C139 93 141 101 142 108 C146 102 148 95 148 88 C148 70 132 59 110 59 Z" fill={hair} />
          <path d="M72 88 C72 95 74 102 78 108 C76 105 75 100 75 94 C75 87 76 81 79 76 Z" fill={hair} opacity="0.4" />
          <path d="M148 88 C148 95 146 102 142 108 C144 105 145 100 145 94 C145 87 144 81 141 76 Z" fill={hair} opacity="0.4" />
          {/* Ponytail base */}
          <path d="M98 60 C100 50 105 42 110 38 C115 42 120 50 122 60 C118 56 114 54 110 53 C106 54 102 56 98 60 Z" fill={hair} />
          {/* Ponytail body */}
          <path d="M110 38 C103 34 97 26 98 18 C99 10 104 4 110 4 C116 4 121 10 122 18 C123 26 117 34 110 38 Z" fill={hair} />
          {/* Ponytail highlight */}
          <path d="M110 38 C106 32 104 24 106 17 C107 12 109 8 110 6 C111 8 113 12 114 17 C116 24 114 32 110 38 Z" fill={hair} opacity="0.35" />
          {/* Hair tie */}
          <path d="M104 52 C104 48 106 46 110 46 C114 46 116 48 116 52 C116 56 114 58 110 58 C106 58 104 56 104 52 Z" fill={secondary} />

          {/* FACE FEATURES — female */}
          {/* Brows */}
          <path d="M84 93 C87 88 94 86 100 89" stroke={hair} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M136 93 C133 88 126 86 120 89" stroke={hair} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          {/* Eye whites */}
          <path d="M81 103 C81 98 84 95 90 95 C96 95 99 98 99 103 C99 108 96 111 90 111 C84 111 81 108 81 103 Z" fill="white" />
          <path d="M121 103 C121 98 124 95 130 95 C136 95 139 98 139 103 C139 108 136 111 130 111 C124 111 121 108 121 103 Z" fill="white" />
          {/* Irises */}
          <circle cx="90"  cy="103" r="5.5" fill={eye} />
          <circle cx="130" cy="103" r="5.5" fill={eye} />
          {/* Pupils */}
          <circle cx="90"  cy="103" r="2.6" fill="#111" />
          <circle cx="130" cy="103" r="2.6" fill="#111" />
          {/* Highlights */}
          <circle cx="91.5" cy="101.5" r="1.5" fill="white" opacity="0.92" />
          <circle cx="131.5" cy="101.5" r="1.5" fill="white" opacity="0.92" />
          {/* Lower lids */}
          <path d="M81 105 C83 109 97 109 99 105" stroke={skinLo} strokeWidth="0.9" fill="none" opacity="0.35" />
          <path d="M121 105 C123 109 137 109 139 105" stroke={skinLo} strokeWidth="0.9" fill="none" opacity="0.35" />
          {/* Nose */}
          <path d="M110 111 C109 116 107 121 106 124 C108 126 112 126 114 124 C113 121 111 116 110 111 Z" fill={skinLo} opacity="0.38" />
          <path d="M106 124 C105 127 107 130 110 130 C113 130 115 127 114 124" stroke={skinLo} strokeWidth="1.3" fill="none" opacity="0.5" strokeLinecap="round" />
          {/* Smile */}
          <path d="M96 138 C100 146 120 146 124 138" stroke={skinLo} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />
          <path d="M97 138 C100 145 120 145 123 138 C120 141 116 144 110 144 C104 144 100 141 97 138 Z" fill="white" opacity="0.9" />
          <path d="M96 138 C100 147 120 147 124 138" stroke={skinLo} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.38" />
          <path d="M96 138 L124 138" stroke={skinLo} strokeWidth="0.8" fill="none" opacity="0.3" />
          {/* Cheek blush */}
          <ellipse cx="80"  cy="121" rx="8" ry="5" fill="#FFB3B3" opacity="0.28" />
          <ellipse cx="140" cy="121" rx="8" ry="5" fill="#FFB3B3" opacity="0.28" />
        </>
      )}
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
      <rect x="0" y="0" width="140" height="90" rx="10" fill={primary} />
      <rect x="0" y="0" width="30" height="90" rx="10" fill={secondary} />
      <rect x="110" y="0" width="30" height="90" rx="10" fill={secondary} />
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
          skin_tone:  saved.skin_tone  || 'medium',
          eye_color:  saved.eye_color  || 'brown',
          gender:     saved.gender     || (profileData.gender as Gender) || 'male',
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

          {/* Gender toggle — only if profile.gender is null */}
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
                  <div className="w-7 h-7 rounded-full border-2 border-white/20" style={{ backgroundColor: color }} />
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
                  <div className="w-7 h-7 rounded-full border-2 border-white/20" style={{ backgroundColor: val.skin }} />
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
                  <div className="w-7 h-7 rounded-full border-2 border-white/20" style={{ backgroundColor: color }} />
                  <span className="text-xs text-gray-300 capitalize">{key}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Active kit display */}
        <div className="glass-card p-4 flex items-center justify-between">
          <div>
            <p className="text-white font-semibold text-sm">Active Kit</p>
            <p className="text-gray-400 text-xs mt-0.5">Change your kit in the Skins Store</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg border border-white/20" style={{ backgroundColor: kit.primary }} title="Primary colour" />
            <div className="w-8 h-8 rounded-lg border border-white/20" style={{ backgroundColor: kit.secondary }} title="Secondary colour" />
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