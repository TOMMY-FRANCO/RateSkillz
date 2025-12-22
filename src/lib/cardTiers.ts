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
  turquoise: {
    name: 'Turquoise',
    minRating: 60,
    maxRating: 69,
    gradient: 'from-cyan-500 via-teal-600 to-cyan-900',
    borderColor: 'border-cyan-300/50',
    glowColor: 'from-cyan-400/30',
    shimmerGradient: 'from-transparent via-cyan-300/20 to-transparent'
  },
  red: {
    name: 'Rich Red',
    minRating: 70,
    maxRating: 79,
    gradient: 'from-red-500 via-red-700 to-rose-900',
    borderColor: 'border-red-300/60',
    glowColor: 'from-red-400/30',
    shimmerGradient: 'from-transparent via-red-300/20 to-transparent'
  },
  silver: {
    name: 'Silver',
    minRating: 80,
    maxRating: 89,
    gradient: 'from-gray-300 via-slate-400 to-gray-600',
    borderColor: 'border-gray-200/70',
    glowColor: 'from-white/30',
    shimmerGradient: 'from-transparent via-white/30 to-transparent'
  },
  gold: {
    name: 'Gold',
    minRating: 90,
    maxRating: 95,
    gradient: 'from-yellow-400 via-amber-500 to-yellow-700',
    borderColor: 'border-yellow-300/80',
    glowColor: 'from-yellow-300/40',
    shimmerGradient: 'from-transparent via-yellow-200/40 to-transparent'
  },
  black: {
    name: 'Black',
    minRating: 96,
    maxRating: 100,
    gradient: 'from-gray-900 via-black to-slate-950',
    borderColor: 'border-white/60',
    glowColor: 'from-purple-500/40',
    shimmerGradient: 'from-transparent via-purple-300/30 to-transparent'
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
  if (overallRating >= 96) return CARD_TIERS.black;
  if (overallRating >= 90) return CARD_TIERS.gold;
  if (overallRating >= 80) return CARD_TIERS.silver;
  if (overallRating >= 70) return CARD_TIERS.red;
  if (overallRating >= 60) return CARD_TIERS.turquoise;
  return CARD_TIERS.default;
}

export function getTierBadgeColors(tier: CardTier): string {
  switch (tier.name) {
    case 'Black':
      return 'bg-gradient-to-r from-gray-900 to-black text-white border-white/70';
    case 'Gold':
      return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black border-yellow-300';
    case 'Silver':
      return 'bg-gradient-to-r from-gray-200 to-slate-300 text-gray-900 border-gray-400';
    case 'Rich Red':
      return 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-red-300';
    case 'Turquoise':
      return 'bg-gradient-to-r from-cyan-500 to-teal-500 text-white border-cyan-300';
    default:
      return 'bg-gradient-to-r from-purple-600 to-purple-700 text-white border-purple-300';
  }
}
