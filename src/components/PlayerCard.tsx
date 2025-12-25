import { useRef } from 'react';
import { Profile } from '../contexts/AuthContext';
import { User, Download, Coins, Award } from 'lucide-react';
import html2canvas from 'html2canvas';
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
    small: 'w-64',
    medium: 'w-80',
    large: 'w-[420px]',
  };

  const handleDownload = async () => {
    if (!cardRef.current) return;

    try {
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

        <div className="relative p-6">
          <div className="flex flex-wrap items-center justify-center gap-1.5 mb-4">
            <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-md border border-white/30 transition-all duration-300">
              <div className="flex flex-col items-center">
                <span className="text-xl font-black text-white leading-none">{overall}</span>
                <span className="text-[8px] font-bold text-gray-300 uppercase">OVR</span>
              </div>
            </div>

            <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-md border border-white/30 flex items-center justify-center transition-all duration-300">
              <VerificationBadge
                isVerified={isVerified}
                hasSocialBadge={hasSocialBadge}
                size="sm"
              />
            </div>

            {tier.name !== 'Default' && (
              <div className={`${tierBadgeColors} px-2.5 py-1.5 rounded-md border transition-all duration-300`}>
                <div className="flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase">{tier.name}</span>
                </div>
              </div>
            )}

            {profile.is_manager && (
              <div className="bg-gradient-to-r from-red-500 to-orange-500 px-2.5 py-1.5 rounded-md border-2 border-yellow-300 transition-all duration-300">
                <span className="text-white font-black text-sm">M</span>
              </div>
            )}

            {profile.position && (
              <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-md border border-white/30 transition-all duration-300">
                <span className="text-[9px] font-black text-white uppercase">{profile.position}</span>
              </div>
            )}

            {profile.number && (
              <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-md border border-white/30 transition-all duration-300">
                <span className="text-[9px] font-black text-white">#{profile.number}</span>
              </div>
            )}

            {profile.team && (
              <div className="bg-black/60 backdrop-blur-sm px-2.5 py-1.5 rounded-md border border-white/30 transition-all duration-300">
                <span className="text-[9px] font-black text-white uppercase truncate max-w-[80px]">{profile.team}</span>
              </div>
            )}

            {cardValue && (
              <div className="bg-gradient-to-r from-yellow-400 to-amber-500 px-2.5 py-1.5 rounded-md border border-yellow-200 transition-all duration-300">
                <div className="flex items-center gap-0.5">
                  <Coins className="w-3 h-3 text-black" />
                  <span className="text-[9px] font-black text-black">{cardValue}</span>
                </div>
              </div>
            )}

            {rank && (
              <div className="bg-gradient-to-r from-yellow-400 to-orange-500 px-2.5 py-1.5 rounded-md border border-yellow-200 transition-all duration-300">
                <div className="flex items-center gap-0.5">
                  <span className="text-[9px] font-black text-black">#{rank.position}</span>
                </div>
              </div>
            )}
          </div>

          <div className="relative h-64 mb-4">
            <div className="w-full h-full mx-auto flex items-end justify-center">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="object-contain max-h-full"
                  style={
                    profile.avatar_position
                      ? {
                          transform: `translate(${profile.avatar_position.x}px, ${profile.avatar_position.y}px) scale(${profile.avatar_position.scale})`,
                          transformOrigin: 'center bottom',
                        }
                      : undefined
                  }
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-32 h-32 text-purple-300/30" />
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-r from-black/70 via-black/60 to-black/70 backdrop-blur-sm px-4 py-3 rounded-lg border border-white/20 mb-4 transition-all duration-700">
            <h3 className="text-3xl font-black text-white text-center tracking-wide uppercase drop-shadow-lg">
              {profile.full_name || displayUsername(profile.username)}
            </h3>
          </div>

          <div className="grid grid-cols-6 gap-2 bg-gradient-to-r from-black/70 via-black/80 to-black/70 backdrop-blur-sm p-4 rounded-lg border border-white/20 transition-all duration-700">
            {Object.entries(stats).map(([key, value]) => (
              <div key={key} className="flex flex-col items-center">
                <span className="text-xs font-bold text-gray-300 uppercase tracking-wide">{key}</span>
                <span className="text-2xl font-black text-white drop-shadow-lg">{value}</span>
              </div>
            ))}
          </div>

          {ratings.length > 0 && (
            <div className="mt-4 text-center">
              <div className="inline-block bg-black/40 px-4 py-2 rounded-full border border-white/20 transition-all duration-700">
                <p className="text-sm text-white font-semibold">
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
          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-600 hover:to-cyan-600 transition-all shadow-lg hover:shadow-xl hover:scale-105"
        >
          <Download className="w-5 h-5" />
          Download PNG
        </button>
      )}
    </div>
  );
}
