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

  const gid = config.skin_tone;
  const skinHi   = gid === 'dark' ? '#8C4A35' : gid === 'medium' ? '#DFA060' : '#FFF3E0';
  const skinMid  = skin.skin;
  const skinLo   = skin.shade;

  return (
    <svg
      viewBox="0 0 220 480"
      width="220"
      height="480"
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
          <stop offset="0%"   stopColor="rgba(0,0,0,0.18)" />
          <stop offset="20%"  stopColor="rgba(0,0,0,0)" />
          <stop offset="80%"  stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
        </linearGradient>
        <linearGradient id={`leg-${gid}`} x1="0" y1="0.5" x2="1" y2="0.5">
          <stop offset="0%"   stopColor={skinLo} />
          <stop offset="40%"  stopColor={skinMid} />
          <stop offset="100%" stopColor={skinLo} />
        </linearGradient>
      </defs>

      {isMale ? (
        <>
          {/* ══════════════════════════════════
              MALE FIGURE
          ══════════════════════════════════ */}

          {/* ── BOOTS ── */}
          <path d="M74 448 C68 448 62 445 60 440 C58 435 60 430 65 429 L84 429 C84 435 83 442 82 448 Z" fill="#374151" />
          <path d="M60 440 C58 444 60 449 65 451 C68 452 75 452 82 451 L82 448 C76 448 69 448 65 448 C62 447 60 444 60 440 Z" fill="#F9FAFB" opacity="0.3" />
          <path d="M146 448 C152 448 158 445 160 440 C162 435 160 430 155 429 L136 429 C136 435 137 442 138 448 Z" fill="#374151" />
          <path d="M160 440 C162 444 160 449 155 451 C152 452 145 452 138 451 L138 448 C144 448 151 448 155 448 C158 447 160 444 160 440 Z" fill="#F9FAFB" opacity="0.3" />

          {/* ── SOCKS ── */}
          <path d="M65 375 C64 375 62 376 62 378 L62 429 C62 430 63 431 65 431 L84 431 L84 375 Z" fill={primary} />
          <path d="M62 378 C62 376 64 375 65 375 L84 375 L84 388 L62 388 Z" fill={secondary} />
          <path d="M155 375 C156 375 158 376 158 378 L158 429 C158 430 157 431 155 431 L136 431 L136 375 Z" fill={primary} />
          <path d="M158 378 C158 376 156 375 155 375 L136 375 L136 388 L158 388 Z" fill={secondary} />

          {/* ── LEGS ── */}
          <path d="M72 285 C68 285 64 287 63 291 L62 375 C62 377 63 378 65 378 L84 378 L84 283 Z" fill={`url(#leg-${gid})`} />
          <path d="M148 285 C152 285 156 287 157 291 L158 375 C158 377 157 378 155 378 L136 378 L136 283 Z" fill={`url(#leg-${gid})`} />

          {/* ── SHORTS ── */}
          <path d="M64 245 C61 245 59 247 59 251 L63 285 C63 287 65 289 68 289 L84 289 L84 243 Z" fill={secondary} />
          <path d="M156 245 C159 245 161 247 161 251 L157 285 C157 287 155 289 152 289 L136 289 L136 243 Z" fill={secondary} />
          <path d="M59 245 C59 240 63 237 70 237 L84 237 L136 237 L150 237 C157 237 161 240 161 245 L161 255 C161 260 157 262 150 262 L70 262 C63 262 59 260 59 255 Z" fill={secondary} />
          <path d="M110 262 L110 289" stroke={primary} strokeWidth="1.5" strokeOpacity="0.4" fill="none" />

          {/* ── LEFT ARM ── */}
          <path d="M77 160 C68 160 55 166 50 176 L42 208 C40 214 42 222 48 225 C53 227 58 224 60 219 L68 188 C71 180 74 175 77 172 Z" fill={secondary} />
          <path d="M77 160 C74 168 70 176 68 184" stroke={primary} strokeWidth="1.2" strokeOpacity="0.5" fill="none" />
          <path d="M42 208 C40 214 42 222 48 225 C53 227 58 224 60 219 L62 210 C57 213 50 212 48 208 Z" fill={primary} opacity="0.6" />
          <path d="M48 225 C44 225 40 230 40 235 C40 241 44 244 50 244 C56 244 61 241 62 235 C63 230 59 225 53 225 Z" fill={`url(#face-${gid})`} />
          <path d="M49 238 Q50 240 52 240 Q54 240 55 238" stroke={skinLo} strokeWidth="0.8" fill="none" opacity="0.5" />
          <path d="M48 237 Q49 235 51 235" stroke={skinLo} strokeWidth="0.7" fill="none" opacity="0.4" />

          {/* ── RIGHT ARM ── */}
          <path d="M143 160 C152 160 165 166 170 176 L178 208 C180 214 178 222 172 225 C167 227 162 224 160 219 L152 188 C149 180 146 175 143 172 Z" fill={secondary} />
          <path d="M143 160 C146 168 150 176 152 184" stroke={primary} strokeWidth="1.2" strokeOpacity="0.5" fill="none" />
          <path d="M178 208 C180 214 178 222 172 225 C167 227 162 224 160 219 L158 210 C163 213 170 212 172 208 Z" fill={primary} opacity="0.6" />
          <path d="M172 225 C176 225 180 230 180 235 C180 241 176 244 170 244 C164 244 159 241 158 235 C157 230 161 225 167 225 Z" fill={`url(#face-${gid})`} />
          <path d="M171 238 Q170 240 168 240 Q166 240 165 238" stroke={skinLo} strokeWidth="0.8" fill="none" opacity="0.5" />
          <path d="M172 237 Q171 235 169 235" stroke={skinLo} strokeWidth="0.7" fill="none" opacity="0.4" />

          {/* ── SHIRT ── */}
          <path d="M77 160 C70 160 64 165 63 172 L59 237 C59 240 63 242 70 242 L84 242 L136 242 L150 242 C157 242 161 240 161 237 L157 172 C156 165 150 160 143 160 Z" fill={primary} />
          <path d="M77 160 C70 160 64 165 63 172 L59 237 C59 240 63 242 70 242 L84 242 L136 242 L150 242 C157 242 161 240 161 237 L157 172 C156 165 150 160 143 160 Z" fill="url(#shirtSide)" />
          <path d="M93 160 Q110 178 127 160" stroke={secondary} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M93 160 Q110 180 127 160" stroke={secondary} strokeWidth="1" fill="none" strokeOpacity="0.35" />
          <path d="M77 160 C74 168 72 178 72 188" stroke={secondary} strokeWidth="1.5" strokeOpacity="0.45" fill="none" />
          <path d="M143 160 C146 168 148 178 148 188" stroke={secondary} strokeWidth="1.5" strokeOpacity="0.45" fill="none" />
          <text x="90" y="192" fontSize="7" fontFamily="Arial, sans-serif" fontWeight="bold" fill={logoFill} textAnchor="middle">RatingSkill</text>
          <text x="90" y="202" fontSize="6" fontFamily="Arial, sans-serif" fill={logoFill} textAnchor="middle" opacity="0.85">.com</text>

          {/* ── NECK ── */}
          <path d="M99 143 C95 143 92 145 91 148 L91 162 C91 165 94 167 98 167 L122 167 C126 167 129 165 129 162 L129 148 C128 145 125 143 121 143 Z" fill={`url(#neck-${gid})`} />

          {/* ── EARS ── */}
          <path d="M72 97 C67 95 62 98 62 105 C62 112 67 118 73 116 C76 115 78 112 78 108 C78 102 76 98 72 97 Z" fill={`url(#face-${gid})`} />
          <path d="M72 100 C69 99 66 102 66 107 C66 112 69 115 72 114 C74 113 75 111 75 108 C75 104 74 101 72 100 Z" fill={skinLo} opacity="0.45" />
          <path d="M148 97 C153 95 158 98 158 105 C158 112 153 118 147 116 C144 115 142 112 142 108 C142 102 144 98 148 97 Z" fill={`url(#face-${gid})`} />
          <path d="M148 100 C151 99 154 102 154 107 C154 112 151 115 148 114 C146 113 145 111 145 108 C145 104 146 101 148 100 Z" fill={skinLo} opacity="0.45" />

          {/* ── HEAD ── */}
          <path d="M110 55 C86 55 68 70 68 92 C68 110 73 126 84 136 C90 142 99 146 110 146 C121 146 130 142 136 136 C147 126 152 110 152 92 C152 70 134 55 110 55 Z" fill={`url(#face-${gid})`} />
          <path d="M110 55 C86 55 68 70 68 92 C68 110 73 126 84 136 C90 142 99 146 110 146 C121 146 130 142 136 136 C147 126 152 110 152 92 C152 70 134 55 110 55 Z" fill={`url(#face-h-${gid})`} />

          {/* ── HAIR — male short fade ── */}
          <path d="M110 52 C88 52 70 62 69 78 C68 85 70 92 74 98 C75 92 77 85 80 81 C83 77 88 74 94 73 L110 71 L126 73 C132 74 137 77 140 81 C143 85 145 92 146 98 C150 92 152 85 151 78 C150 62 132 52 110 52 Z" fill={hair} />
          <path d="M69 78 C68 85 70 92 74 98 C72 95 71 90 71 84 C71 78 72 73 74 68 Z" fill={hair} opacity="0.45" />
          <path d="M151 78 C152 85 150 92 146 98 C148 95 149 90 149 84 C149 78 148 73 146 68 Z" fill={hair} opacity="0.45" />

          {/* ── FACE FEATURES — male ── */}
          <path d="M84 88 C87 83 93 82 98 84" stroke={hair} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d="M136 88 C133 83 127 82 122 84" stroke={hair} strokeWidth="2.8" fill="none" strokeLinecap="round" />
          <path d="M84 98 C84 93 87 90 91 90 C95 90 98 93 98 98 C98 103 95 106 91 106 C87 106 84 103 84 98 Z" fill="white" />
          <path d="M122 98 C122 93 125 90 129 90 C133 90 136 93 136 98 C136 103 133 106 129 106 C125 106 122 103 122 98 Z" fill="white" />
          <circle cx="91"  cy="98" r="5" fill={eye} />
          <circle cx="129" cy="98" r="5" fill={eye} />
          <circle cx="91"  cy="98" r="2.4" fill="#111" />
          <circle cx="129" cy="98" r="2.4" fill="#111" />
          <circle cx="92.5" cy="96.5" r="1.4" fill="white" opacity="0.92" />
          <circle cx="130.5" cy="96.5" r="1.4" fill="white" opacity="0.92" />
          <path d="M84 100 C86 104 96 104 98 100" stroke={skinLo} strokeWidth="0.9" fill="none" opacity="0.4" />
          <path d="M122 100 C124 104 134 104 136 100" stroke={skinLo} strokeWidth="0.9" fill="none" opacity="0.4" />
          <path d="M110 106 C109 111 107 116 106 119 C108 121 112 121 114 119 C113 116 111 111 110 106 Z" fill={skinLo} opacity="0.4" />
          <path d="M106 119 C105 122 107 125 110 125 C113 125 115 122 114 119" stroke={skinLo} strokeWidth="1.3" fill="none" opacity="0.55" strokeLinecap="round" />
          <path d="M96 132 C99 140 110 143 124 132" stroke={skinLo} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.65" />
          <path d="M97 132 C100 139 110 142 123 132 C120 138 116 143 110 143 C104 143 100 138 97 132 Z" fill="white" opacity="0.88" />
          <path d="M96 132 C99 141 110 144 124 132" stroke={skinLo} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.4" />
        </>
      ) : (
        <>
          {/* ══════════════════════════════════
              FEMALE FIGURE (hourglass)
          ══════════════════════════════════ */}

          {/* ── BOOTS ── */}
          <path d="M76 448 C70 448 64 445 62 440 C60 435 62 430 67 429 L84 429 C84 435 83 442 82 448 Z" fill="#374151" />
          <path d="M62 440 C60 444 62 449 67 451 C70 452 76 452 82 451 L82 448 C77 448 70 448 67 448 C64 447 62 444 62 440 Z" fill="#F9FAFB" opacity="0.3" />
          <path d="M144 448 C150 448 156 445 158 440 C160 435 158 430 153 429 L136 429 C136 435 137 442 138 448 Z" fill="#374151" />
          <path d="M158 440 C160 444 158 449 153 451 C150 452 144 452 138 451 L138 448 C143 448 150 448 153 448 C156 447 158 444 158 440 Z" fill="#F9FAFB" opacity="0.3" />

          {/* ── SOCKS ── */}
          <path d="M67 375 C66 375 64 376 64 378 L64 429 C64 430 65 431 67 431 L84 431 L84 375 Z" fill={primary} />
          <path d="M64 378 C64 376 66 375 67 375 L84 375 L84 388 L64 388 Z" fill={secondary} />
          <path d="M153 375 C154 375 156 376 156 378 L156 429 C156 430 155 431 153 431 L136 431 L136 375 Z" fill={primary} />
          <path d="M156 378 C156 376 154 375 153 375 L136 375 L136 388 L156 388 Z" fill={secondary} />

          {/* ── LEGS ── */}
          <path d="M73 287 C69 287 65 289 64 293 L64 375 C64 377 65 378 67 378 L84 378 L84 285 Z" fill={`url(#leg-${gid})`} />
          <path d="M147 287 C151 287 155 289 156 293 L156 375 C156 377 155 378 153 378 L136 378 L136 285 Z" fill={`url(#leg-${gid})`} />

          {/* ── SHORTS ── */}
          <path d="M65 248 C62 248 60 250 60 254 L64 287 C64 289 66 291 69 291 L84 291 L84 246 Z" fill={secondary} />
          <path d="M155 248 C158 248 160 250 160 254 L156 287 C156 289 154 291 151 291 L136 291 L136 246 Z" fill={secondary} />
          <path d="M60 248 C60 243 64 240 72 240 L84 240 L136 240 L148 240 C156 240 160 243 160 248 L160 258 C160 263 156 265 148 265 L72 265 C64 265 60 263 60 258 Z" fill={secondary} />
          <path d="M110 265 L110 291" stroke={primary} strokeWidth="1.5" strokeOpacity="0.4" fill="none" />

          {/* ── LEFT ARM — feminine, slimmer ── */}
          <path d="M80 162 C72 162 60 167 56 176 L48 207 C46 213 48 221 54 223 C59 225 64 222 66 217 L74 187 C77 179 79 174 82 170 Z" fill={secondary} />
          <path d="M80 162 C77 170 73 178 71 186" stroke={primary} strokeWidth="1.2" strokeOpacity="0.5" fill="none" />
          <path d="M48 207 C46 213 48 221 54 223 C59 225 64 222 66 217 L68 208 C63 211 56 210 54 207 Z" fill={primary} opacity="0.6" />
          <path d="M54 223 C50 223 46 228 46 233 C46 239 50 242 56 242 C62 242 67 239 68 233 C69 228 65 223 59 223 Z" fill={`url(#face-${gid})`} />

          {/* ── RIGHT ARM — feminine ── */}
          <path d="M140 162 C148 162 160 167 164 176 L172 207 C174 213 172 221 166 223 C161 225 156 222 154 217 L146 187 C143 179 141 174 138 170 Z" fill={secondary} />
          <path d="M140 162 C143 170 147 178 149 186" stroke={primary} strokeWidth="1.2" strokeOpacity="0.5" fill="none" />
          <path d="M172 207 C174 213 172 221 166 223 C161 225 156 222 154 217 L152 208 C157 211 164 210 166 207 Z" fill={primary} opacity="0.6" />
          <path d="M166 223 C170 223 174 228 174 233 C174 239 170 242 164 242 C158 242 153 239 152 233 C151 228 155 223 161 223 Z" fill={`url(#face-${gid})`} />

          {/* ── SHIRT — hourglass shaped ── */}
          <path d="M80 162 C72 162 65 167 64 175 L60 240 C60 243 64 245 72 245 L84 245 L136 245 L148 245 C156 245 160 243 160 240 L156 175 C155 167 148 162 140 162 Z" fill={primary} />
          <path d="M80 162 C72 162 65 167 64 175 L60 240 C60 243 64 245 72 245 L84 245 L136 245 L148 245 C156 245 160 243 160 240 L156 175 C155 167 148 162 140 162 Z" fill="url(#shirtSide)" />
          <path d="M94 162 Q110 180 126 162" stroke={secondary} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M94 162 Q110 182 126 162" stroke={secondary} strokeWidth="1" fill="none" strokeOpacity="0.35" />
          <path d="M80 162 C77 170 75 180 75 190" stroke={secondary} strokeWidth="1.5" strokeOpacity="0.45" fill="none" />
          <path d="M140 162 C143 170 145 180 145 190" stroke={secondary} strokeWidth="1.5" strokeOpacity="0.45" fill="none" />
          <text x="92" y="194" fontSize="7" fontFamily="Arial, sans-serif" fontWeight="bold" fill={logoFill} textAnchor="middle">RatingSkill</text>
          <text x="92" y="204" fontSize="6" fontFamily="Arial, sans-serif" fill={logoFill} textAnchor="middle" opacity="0.85">.com</text>

          {/* ── NECK ── */}
          <path d="M101 145 C97 145 94 147 93 150 L93 164 C93 167 96 169 100 169 L120 169 C124 169 127 167 127 164 L127 150 C126 147 123 145 119 145 Z" fill={`url(#neck-${gid})`} />

          {/* ── EARS ── */}
          <path d="M73 99 C68 97 63 100 63 107 C63 114 68 120 74 118 C77 117 79 114 79 110 C79 104 77 100 73 99 Z" fill={`url(#face-${gid})`} />
          <path d="M73 102 C70 101 67 104 67 109 C67 114 70 117 73 116 C75 115 76 113 76 110 C76 106 75 103 73 102 Z" fill={skinLo} opacity="0.4" />
          <path d="M147 99 C152 97 157 100 157 107 C157 114 152 120 146 118 C143 117 141 114 141 110 C141 104 143 100 147 99 Z" fill={`url(#face-${gid})`} />
          <path d="M147 102 C150 101 153 104 153 109 C153 114 150 117 147 116 C145 115 144 113 144 110 C144 106 145 103 147 102 Z" fill={skinLo} opacity="0.4" />

          {/* ── HEAD — female, softer oval ── */}
          <path d="M110 57 C87 57 69 72 69 95 C69 114 74 130 85 139 C91 145 100 149 110 149 C120 149 129 145 135 139 C146 130 151 114 151 95 C151 72 133 57 110 57 Z" fill={`url(#face-${gid})`} />
          <path d="M110 57 C87 57 69 72 69 95 C69 114 74 130 85 139 C91 145 100 149 110 149 C120 149 129 145 135 139 C146 130 151 114 151 95 C151 72 133 57 110 57 Z" fill={`url(#face-h-${gid})`} />
          {/* Contour shading — cheeks and nose sides */}
          <path d="M79 108 C76 112 76 118 79 122" stroke={skinLo} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.2" />
          <path d="M141 108 C144 112 144 118 141 122" stroke={skinLo} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.2" />
          <path d="M103 102 C101 108 101 116 103 120" stroke={skinLo} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.25" />
          <path d="M117 102 C119 108 119 116 117 120" stroke={skinLo} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.25" />

          {/* ── HAIR — high ponytail ── */}
          <path d="M110 54 C86 54 68 66 68 85 C68 92 70 99 74 105 C75 98 77 90 81 85 C85 80 91 77 98 76 L110 74 L122 76 C129 77 135 80 139 85 C143 90 145 98 146 105 C150 99 152 92 152 85 C152 66 134 54 110 54 Z" fill={hair} />
          <path d="M68 85 C68 92 70 99 74 105 C72 102 71 97 71 91 C71 84 72 78 75 73 Z" fill={hair} opacity="0.4" />
          <path d="M152 85 C152 92 150 99 146 105 C148 102 149 97 149 91 C149 84 148 78 145 73 Z" fill={hair} opacity="0.4" />
          {/* Ponytail base pulled up from crown */}
          <path d="M96 56 C98 46 104 38 110 34 C116 38 122 46 124 56 C120 52 116 50 110 49 C104 50 100 52 96 56 Z" fill={hair} />
          {/* Ponytail body — flowing teardrop rising up */}
          <path d="M110 34 C102 30 96 22 97 14 C98 6 104 0 110 0 C116 0 122 6 123 14 C124 22 118 30 110 34 Z" fill={hair} />
          {/* Ponytail volume highlight */}
          <path d="M110 34 C106 28 104 20 106 13 C107 8 109 4 110 2 C111 4 113 8 114 13 C116 20 114 28 110 34 Z" fill={hair} opacity="0.35" />
          {/* Hair tie */}
          <path d="M104 50 C104 46 106 44 110 44 C114 44 116 46 116 50 C116 54 114 56 110 56 C106 56 104 54 104 50 Z" fill={secondary} />
          <path d="M104 50 C104 46 106 44 110 44 C114 44 116 46 116 50" stroke={skinLo} strokeWidth="0.8" fill="none" opacity="0.3" />

          {/* ── FACE FEATURES — female ── */}
          {/* Full arched brows */}
          <path d="M83 90 C86 85 93 83 99 86" stroke={hair} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          <path d="M137 90 C134 85 127 83 121 86" stroke={hair} strokeWidth="2.6" fill="none" strokeLinecap="round" />
          {/* Large almond eyes */}
          <path d="M81 101 C81 96 84 93 90 93 C96 93 99 96 99 101 C99 106 96 109 90 109 C84 109 81 106 81 101 Z" fill="white" />
          <path d="M121 101 C121 96 124 93 130 93 C136 93 139 96 139 101 C139 106 136 109 130 109 C124 109 121 106 121 101 Z" fill="white" />
          <circle cx="90"  cy="101" r="5.5" fill={eye} />
          <circle cx="130" cy="101" r="5.5" fill={eye} />
          <circle cx="90"  cy="101" r="2.6" fill="#111" />
          <circle cx="130" cy="101" r="2.6" fill="#111" />
          <circle cx="91.5" cy="99.5" r="1.5" fill="white" opacity="0.92" />
          <circle cx="131.5" cy="99.5" r="1.5" fill="white" opacity="0.92" />
          <path d="M81 103 C83 107 97 107 99 103" stroke={skinLo} strokeWidth="0.9" fill="none" opacity="0.35" />
          <path d="M121 103 C123 107 137 107 139 103" stroke={skinLo} strokeWidth="0.9" fill="none" opacity="0.35" />
          {/* Nose — defined bridge */}
          <path d="M110 109 C109 114 107 119 106 122 C108 124 112 124 114 122 C113 119 111 114 110 109 Z" fill={skinLo} opacity="0.38" />
          <path d="M106 122 C105 125 107 128 110 128 C113 128 115 125 114 122" stroke={skinLo} strokeWidth="1.3" fill="none" opacity="0.5" strokeLinecap="round" />
          {/* Full lips — smile showing teeth */}
          <path d="M96 136 C100 144 120 144 124 136" stroke={skinLo} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.6" />
          <path d="M97 136 C100 143 120 143 123 136 C120 139 116 142 110 142 C104 142 100 139 97 136 Z" fill="white" opacity="0.9" />
          <path d="M96 136 C100 145 120 145 124 136" stroke={skinLo} strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.38" />
          <path d="M96 136 L124 136" stroke={skinLo} strokeWidth="0.8" fill="none" opacity="0.3" />
          {/* Cheek blush */}
          <ellipse cx="80"  cy="119" rx="8" ry="5" fill="#FFB3B3" opacity="0.28" />
          <ellipse cx="140" cy="119" rx="8" ry="5" fill="#FFB3B3" opacity="0.28" />
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
