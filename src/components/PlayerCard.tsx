import { useRef } from 'react';
import { Profile } from '../contexts/AuthContext';
import { User, Download, Coins, Award } from 'lucide-react';
import { displayUsername } from '../lib/username';
import { calculateOverallRating, getCardTier, getTierBadgeColors } from '../lib/cardTiers';
import { VerificationBadge } from './VerificationBadge';

export interface Rating {
  id: string;
  rater_id: string;
  player_id: string;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  comment?: string;
  created_at: string;
}

export interface UserStats {
  id: string;
  user_id: string;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  overall: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

interface PlayerCardProps {
  profile: Profile;
  ratings?: Rating[];
  userStats?: UserStats | null;
  size?: 'small' | 'medium' | 'large';
  rank?: { position: number; total: number };
  showDownloadButton?: boolean;
  overallRating?: number;
  cardValue?: number;
  isVerified?: boolean;
  hasSocialBadge?: boolean;
}

export default function PlayerCard({ profile, ratings = [], userStats, size = 'large', rank, showDownloadButton = false, overallRating, cardValue, isVerified = false, hasSocialBadge = false }: PlayerCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const stats = userStats ? {
    PAC: userStats.pac,
    SHO: userStats.sho,
    PAS: userStats.pas,
    DRI: userStats.dri,
    DEF: userStats.def,
    PHY: userStats.phy,
  } : {
    PAC: 50,
    SHO: 50,
    PAS: 50,
    DRI: 50,
    DEF: 50,
    PHY: 50,
  };

  const calculatedOverall = calculateOverallRating(stats);
  const overall = overallRating ?? (userStats?.overall || profile.overall_rating || calculatedOverall);
  const tier = getCardTier(overall);
  const tierBadgeColors = getTierBadgeColors(tier);

  const sizeClasses = {
    small: 'w-[240px]',
    medium: 'w-[260px]',
    large: 'w-[280px]',
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;

    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
        logging: false,
      });

      const link = document.createElement('a');
      link.download = `${profile.username}-player-card.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error downloading card:', error);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div ref={cardRef} className={`${sizeClasses[size]} relative transition-all duration-700`}>
        <div className={`relative rounded-2xl overflow-hidden bg-gradient-to-br ${tier.gradient} shadow-2xl border-4 ${tier.borderColor} transition-all duration-700`}>
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] ${tier.glowColor} via-transparent to-transparent transition-all duration-700`}></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDMiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>

        <div className="relative p-4">
          {/* Card Info - Clean 2-Line Layout */}
          <div className="mb-3 space-y-1.5">
            {/* Line 1: Overall Score | Verification | Tier | Manager */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {/* Overall Score */}
              <div className="glass-container px-2 py-1 rounded-lg border border-white/20 min-w-[45px]">
                <div className="flex flex-col items-center">
                  <span className="text-base font-black text-white leading-none stats-number">{overall}</span>
                  <span className="text-[8px] font-bold text-[#B0B8C8] uppercase">OVR</span>
                </div>
              </div>

              {/* Verification Badge */}
              <div className="glass-container px-2 py-1 rounded-lg border border-white/20 flex items-center justify-center min-w-[32px]">
                <VerificationBadge
                  isVerified={isVerified}
                  hasSocialBadge={hasSocialBadge}
                  size="sm"
                />
              </div>

              {/* Tier Name */}
              {tier.name !== 'Default' && (
                <div className={`${tierBadgeColors} px-2 py-1 rounded-lg border`}>
                  <div className="flex items-center gap-0.5">
                    <Award className="w-3 h-3" />
                    <span className="text-[8px] font-black uppercase whitespace-nowrap">{tier.name}</span>
                  </div>
                </div>
              )}

              {/* Manager Badge */}
              {profile.is_manager && (
                <div className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-2 py-1 rounded-lg border border-yellow-300 shadow-lg shadow-yellow-500/30">
                  <span className="text-black font-black text-[10px] uppercase">MGR</span>
                </div>
              )}
            </div>

            {/* Line 2: Position | Team | Card Worth | Rank */}
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {/* Position */}
              {profile.position && (
                <div className="glass-container px-2 py-1 rounded-lg border border-white/20">
                  <span className="text-[8px] font-black text-white uppercase">{profile.position}</span>
                </div>
              )}

              {/* Team */}
              {profile.team && (
                <div className="glass-container px-2 py-1 rounded-lg border border-white/20 max-w-[80px]">
                  <span className="text-[8px] font-black text-white uppercase truncate block">{profile.team}</span>
                </div>
              )}

              {/* Card Worth */}
              {cardValue && (
                <div className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-2 py-1 rounded-lg border border-yellow-300 shadow-lg shadow-yellow-500/30">
                  <div className="flex items-center gap-0.5">
                    <Coins className="w-3 h-3 text-black" />
                    <span className="text-[8px] font-black text-black">{cardValue}</span>
                  </div>
                </div>
              )}

              {/* Global Leaderboard Rank */}
              {rank && (
                <div className="bg-gradient-to-r from-[#00FF85] to-[#00E0FF] px-2 py-1 rounded-lg border border-[#00FF85]/50 shadow-lg shadow-[#00FF85]/30">
                  <span className="text-[8px] font-black text-black">#{rank.position}</span>
                </div>
              )}
            </div>
          </div>

          {/* Profile Picture - 120x120px centered */}
          <div className="flex justify-center mb-3">
            <div className="relative w-[120px] h-[120px] rounded-full overflow-hidden border-4 border-white/20 shadow-xl">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  width="120"
                  height="120"
                  className="w-full h-full object-cover"
                  loading="lazy"
                  style={
                    profile.avatar_position
                      ? {
                          transform: `translate(${profile.avatar_position.x}px, ${profile.avatar_position.y}px) scale(${profile.avatar_position.scale})`,
                          transformOrigin: 'center',
                        }
                      : undefined
                  }
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-black/40">
                  <User className="w-16 h-16 text-white/30" />
                </div>
              )}
            </div>
          </div>

          {/* Player Name */}
          <div className="glass-container px-3 py-2 rounded-lg border border-white/20 mb-3">
            <h3 className="text-lg font-black text-white text-center tracking-wide uppercase">
              {profile.username}
            </h3>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2 glass-container p-3 rounded-lg border border-white/20 mb-2">
            {Object.entries(stats).map(([key, value]) => (
              <div key={key} className="flex flex-col items-center">
                <span className="text-[9px] font-bold text-[#B0B8C8] uppercase tracking-wide">{key}</span>
                <span className="text-xl font-black text-white stats-number">{value}</span>
              </div>
            ))}
          </div>

          {/* Ratings Count */}
          {ratings.length > 0 && (
            <div className="text-center">
              <div className="inline-block glass-container px-3 py-1 rounded-full border border-white/20">
                <p className="text-[10px] text-white font-semibold">
                  Rated by {ratings.length}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className={`absolute inset-0 bg-gradient-to-t ${tier.shimmerGradient} pointer-events-none rounded-2xl transition-all duration-700`}></div>
        </div>
      </div>

      {showDownloadButton && (
        <button
          onClick={handleDownload}
          className="btn-primary flex items-center gap-2"
        >
          <Download className="w-5 h-5" />
          Download PNG
        </button>
      )}
    </div>
  );
}
