/**
 * Card Tier System
 *
 * Defines tier badges based on overall player rating.
 * Each tier has a unique name, colour scheme, and visual effects.
 *
 * Tier Structure:
 * - Under 60: Default (no special colour)
 * - 60-69: EXCEPTIONAL (Metallic Blue)
 * - 70-79: REMARKABLE (Metallic Rich Red)
 * - 80-89: UNIQUE (Metallic Silver)
 * - 90-95: TALENTED (Metallic Gold)
 * - 96: PHENOMENAL (Metallic Dark Orange)
 * - 97: OUTSTANDING (Metallic Lime Green)
 * - 98: ABNORMAL (Metallic Hot Pink)
 * - 99: RARE (Metallic Black)
 * - 100: LEGENDARY (Metallic Pearl/Light Pink)
 */

export interface CardTier {
  name: string;
  minRating: number;
  maxRating: number;
  gradient: string;
  borderColor: string;
  glowColor: string;
  shimmerGradient: string;
}

export const CARD_TIERS: Record<string, CardTier> = {
  default: {
    name: 'Default',
    minRating: 0,
    maxRating: 59,
    gradient: 'from-purple-600 via-purple-700 to-gray-900',
    borderColor: 'border-purple-400/30',
    glowColor: 'from-pink-400/20',
    shimmerGradient: 'from-transparent via-transparent to-white/5'
  },
  exceptional: {
    name: 'EXCEPTIONAL',
    minRating: 60,
    maxRating: 69,
    gradient: 'from-sky-400 via-blue-500 to-blue-800',
    borderColor: 'border-sky-300/60',
    glowColor: 'from-sky-400/30',
    shimmerGradient: 'from-transparent via-sky-300/25 to-transparent'
  },
  remarkable: {
    name: 'REMARKABLE',
    minRating: 70,
    maxRating: 79,
    gradient: 'from-red-500 via-red-600 to-red-900',
    borderColor: 'border-red-300/70',
    glowColor: 'from-red-400/35',
    shimmerGradient: 'from-transparent via-red-300/25 to-transparent'
  },
  unique: {
    name: 'UNIQUE',
    minRating: 80,
    maxRating: 89,
    gradient: 'from-gray-300 via-slate-400 to-gray-600',
    borderColor: 'border-gray-200/70',
    glowColor: 'from-white/30',
    shimmerGradient: 'from-transparent via-white/30 to-transparent'
  },
  talented: {
    name: 'TALENTED',
    minRating: 90,
    maxRating: 95,
    gradient: 'from-yellow-400 via-amber-500 to-yellow-700',
    borderColor: 'border-yellow-300/80',
    glowColor: 'from-yellow-300/40',
    shimmerGradient: 'from-transparent via-yellow-200/40 to-transparent'
  },
  phenomenal: {
    name: 'PHENOMENAL',
    minRating: 96,
    maxRating: 96,
    gradient: 'from-orange-600 via-orange-700 to-orange-900',
    borderColor: 'border-orange-400/80',
    glowColor: 'from-orange-400/40',
    shimmerGradient: 'from-transparent via-orange-300/35 to-transparent'
  },
  outstanding: {
    name: 'OUTSTANDING',
    minRating: 97,
    maxRating: 97,
    gradient: 'from-lime-400 via-lime-500 to-lime-700',
    borderColor: 'border-lime-300/80',
    glowColor: 'from-lime-400/40',
    shimmerGradient: 'from-transparent via-lime-300/35 to-transparent'
  },
  abnormal: {
    name: 'ABNORMAL',
    minRating: 98,
    maxRating: 98,
    gradient: 'from-pink-500 via-pink-600 to-pink-800',
    borderColor: 'border-pink-300/80',
    glowColor: 'from-pink-400/40',
    shimmerGradient: 'from-transparent via-pink-300/35 to-transparent'
  },
  rare: {
    name: 'RARE',
    minRating: 99,
    maxRating: 99,
    gradient: 'from-gray-900 via-black to-slate-950',
    borderColor: 'border-white/70',
    glowColor: 'from-purple-500/40',
    shimmerGradient: 'from-transparent via-purple-300/35 to-transparent'
  },
  legendary: {
    name: 'LEGENDARY',
    minRating: 100,
    maxRating: 100,
    gradient: 'from-pink-100 via-pink-200 to-rose-300',
    borderColor: 'border-pink-200/90',
    glowColor: 'from-pink-200/50',
    shimmerGradient: 'from-transparent via-pink-100/40 to-transparent'
  }
};

export function calculateOverallRating(stats: {
  PAC?: number;
  SHO?: number;
  PAS?: number;
  DRI?: number;
  DEF?: number;
  PHY?: number;
  pac?: number;
  sho?: number;
  pas?: number;
  dri?: number;
  def?: number;
  phy?: number;
}): number {
  const pac = stats.PAC ?? stats.pac ?? 50;
  const sho = stats.SHO ?? stats.sho ?? 50;
  const pas = stats.PAS ?? stats.pas ?? 50;
  const dri = stats.DRI ?? stats.dri ?? 50;
  const def = stats.DEF ?? stats.def ?? 50;
  const phy = stats.PHY ?? stats.phy ?? 50;

  const average = (pac + sho + pas + dri + def + phy) / 6;
  return Math.round(average);
}

export function getCardTier(overallRating: number): CardTier {
  if (overallRating === 100) return CARD_TIERS.legendary;
  if (overallRating === 99) return CARD_TIERS.rare;
  if (overallRating === 98) return CARD_TIERS.abnormal;
  if (overallRating === 97) return CARD_TIERS.outstanding;
  if (overallRating === 96) return CARD_TIERS.phenomenal;
  if (overallRating >= 90) return CARD_TIERS.talented;
  if (overallRating >= 80) return CARD_TIERS.unique;
  if (overallRating >= 70) return CARD_TIERS.remarkable;
  if (overallRating >= 60) return CARD_TIERS.exceptional;
  return CARD_TIERS.default;
}

export function getTierBadgeColors(tier: CardTier): string {
  switch (tier.name) {
    case 'LEGENDARY':
      return 'bg-gradient-to-r from-pink-100 to-pink-200 text-gray-900 border-pink-200';
    case 'RARE':
      return 'bg-gradient-to-r from-gray-900 to-black text-white border-white/70';
    case 'ABNORMAL':
      return 'bg-gradient-to-r from-pink-500 to-pink-600 text-white border-pink-300';
    case 'OUTSTANDING':
      return 'bg-gradient-to-r from-lime-400 to-lime-500 text-black border-lime-300';
    case 'PHENOMENAL':
      return 'bg-gradient-to-r from-orange-600 to-orange-700 text-white border-orange-400';
    case 'TALENTED':
      return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black border-yellow-300';
    case 'UNIQUE':
      return 'bg-gradient-to-r from-gray-200 to-slate-300 text-gray-900 border-gray-400';
    case 'REMARKABLE':
      return 'bg-gradient-to-r from-red-500 to-red-600 text-white border-red-300';
    case 'EXCEPTIONAL':
      return 'bg-gradient-to-r from-sky-400 to-blue-500 text-white border-sky-300';
    default:
      return 'bg-gradient-to-r from-purple-600 to-purple-700 text-white border-purple-300';
  }
}
