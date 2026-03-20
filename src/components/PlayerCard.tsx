import { useRef, useEffect, useState } from 'react';
import { Profile } from '../contexts/AuthContext';
import { User, Download, Coins, Award } from 'lucide-react';
import { displayUsername } from '../lib/username';
import { calculateOverallRating, getCardTier, getTierBadgeColors } from '../lib/cardTiers';
import { getAvatarUrl } from '../lib/avatarStorage';
import { VerificationBadge } from './VerificationBadge';
import { supabase } from '../lib/supabase';

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

interface ActiveSkin {
  name: string;
  skin_type: 'border' | 'shimmer' | 'badge';
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

// Skin overlay component — renders the correct effect based on skin name
function SkinOverlay({ skin }: { skin: ActiveSkin }) {
  const name = skin.name.toLowerCase();

  // NEON PULSE
  if (name.includes('neon')) {
    return (
      <>
        <style>{`
          @keyframes npSweep{0%{transform:translateX(-100%) skewX(-15deg);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(300%) skewX(-15deg);opacity:0}}
          @keyframes npSweep2{0%{transform:translateX(-100%) skewX(-15deg);opacity:0}20%{opacity:1}80%{opacity:1}100%{transform:translateX(300%) skewX(-15deg);opacity:0}}
          @keyframes npBorder{0%,100%{box-shadow:0 0 12px rgba(0,224,255,0.5),inset 0 0 12px rgba(0,224,255,0.15)}50%{box-shadow:0 0 28px rgba(0,224,255,1),inset 0 0 20px rgba(0,224,255,0.3)}}
          @keyframes npGlow{0%,100%{opacity:0.25}50%{opacity:0.6}}
          .np-overlay-border{animation:npBorder 2s ease-in-out infinite;position:absolute;inset:0;border-radius:1rem;pointer-events:none;z-index:10}
          .np-overlay-sweep{position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(0,224,255,0.3) 50%,transparent 70%);animation:npSweep 2.5s ease-in-out infinite;pointer-events:none;z-index:11;border-radius:1rem}
          .np-overlay-sweep2{position:absolute;inset:0;background:linear-gradient(105deg,transparent 30%,rgba(0,255,200,0.18) 50%,transparent 70%);animation:npSweep2 2.5s ease-in-out infinite 1.25s;pointer-events:none;z-index:11;border-radius:1rem}
          .np-overlay-glow{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 30%,rgba(0,224,255,0.18) 0%,transparent 65%);animation:npGlow 2s ease-in-out infinite;pointer-events:none;z-index:10;border-radius:1rem}
        `}</style>
        <div className="np-overlay-border" />
        <div className="np-overlay-glow" />
        <div className="np-overlay-sweep" />
        <div className="np-overlay-sweep2" />
      </>
    );
  }

  // LIGHTNING STRIKE
  if (name.includes('lightning')) {
    return (
      <>
        <style>{`
          @keyframes lsBorder{0%,89%,100%{box-shadow:0 0 6px rgba(56,189,248,0.3)}90%,92%{box-shadow:0 0 35px rgba(56,189,248,1),0 0 70px rgba(56,189,248,0.5)}91%{box-shadow:0 0 4px rgba(56,189,248,0.1)}93%,95%{box-shadow:0 0 22px rgba(147,210,255,0.8)}94%{box-shadow:none}96%,98%{box-shadow:0 0 12px rgba(56,189,248,0.5)}}
          @keyframes lsShift{0%,88%,100%{transform:skewX(0deg);opacity:1}89%{transform:skewX(-1.5deg);opacity:0.9}90%{transform:skewX(1deg);opacity:1}91%{transform:skewX(2deg);opacity:0.75}92%{transform:skewX(0deg);opacity:1}93%{transform:skewX(-1deg);opacity:0.85}96%{transform:skewX(1.5deg);opacity:0.9}97%{transform:skewX(0deg);opacity:1}}
          @keyframes lsBolt1{0%,85%,100%{opacity:0}86%{opacity:0.9}87%{opacity:0}88%{opacity:0.7}89%{opacity:0}91%{opacity:0.9}92%{opacity:0}94%{opacity:0.5}95%{opacity:0}97%{opacity:0.8}98%{opacity:0}}
          @keyframes lsBolt2{0%,87%,100%{opacity:0}88%,90%{opacity:0.8}89%{opacity:0}92%,93%{opacity:0.6}95%,96%{opacity:0.9}97%{opacity:0}}
          @keyframes lsScan{0%,88%,100%{opacity:0;top:-10px}89%{opacity:0.5;top:15%}90%{opacity:0;top:35%}92%{opacity:0.35;top:60%}93%{opacity:0;top:80%}95%{opacity:0.25;top:30%}96%{opacity:0}}
          @keyframes lsStatic{0%,87%,100%{opacity:0}88%,89%,91%,93%,95%,97%{opacity:0.1}90%,92%,94%,96%,98%{opacity:0}}
          .ls-overlay-wrap{position:absolute;inset:0;border-radius:1rem;overflow:hidden;pointer-events:none;z-index:10;animation:lsShift 2.5s linear infinite}
          .ls-overlay-border{position:absolute;inset:0;border-radius:1rem;animation:lsBorder 2.5s linear infinite}
          .ls-overlay-static{position:absolute;inset:0;background-image:repeating-linear-gradient(0deg,rgba(56,189,248,0.12) 0px,transparent 1px,transparent 3px);animation:lsStatic 2.5s linear infinite}
          .ls-overlay-scan{position:absolute;left:0;right:0;height:3px;background:rgba(147,210,255,0.45);animation:lsScan 2.5s linear infinite}
          .ls-bolt1{position:absolute;top:8%;left:42%;animation:lsBolt1 2.5s linear infinite}
          .ls-bolt2{position:absolute;top:22%;left:25%;animation:lsBolt2 2.5s linear infinite}
          .ls-bolt3{position:absolute;top:12%;left:65%;animation:lsBolt1 2.5s linear infinite 1.25s}
        `}</style>
        <div className="ls-overlay-wrap">
          <div className="ls-overlay-border" />
          <div className="ls-overlay-static" />
          <div className="ls-overlay-scan" />
          <div className="ls-bolt1">
            <svg width="18" height="55" viewBox="0 0 18 55" fill="none">
              <polyline points="13,0 6,20 14,20 3,55" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="13,0 6,20 14,20 3,55" stroke="#bae6fd" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
            </svg>
          </div>
          <div className="ls-bolt2">
            <svg width="11" height="38" viewBox="0 0 11 38" fill="none">
              <polyline points="8,0 4,15 9,15 1,38" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="ls-bolt3">
            <svg width="9" height="28" viewBox="0 0 9 28" fill="none">
              <polyline points="6,0 3,11 7,11 0,28" stroke="#7dd3fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </>
    );
  }

  // PLATINUM SHIMMER
  if (name.includes('platinum')) {
    return (
      <>
        <style>{`
          @keyframes psWave1{0%{transform:translateX(-130%) translateY(-130%) rotate(-35deg)}70%{transform:translateX(190%) translateY(190%) rotate(-35deg)}71%,73%{transform:translateX(195%) translateY(195%) rotate(-35deg)}72%{transform:translateX(180%) translateY(180%) rotate(-35deg)}74%{transform:translateX(196%) translateY(196%) rotate(-35deg)}100%{transform:translateX(200%) translateY(200%) rotate(-35deg)}}
          @keyframes psWave2{0%{transform:translateX(-130%) translateY(-130%) rotate(-35deg)}65%{transform:translateX(185%) translateY(185%) rotate(-35deg)}66%,68%{transform:translateX(190%) translateY(190%) rotate(-35deg)}67%{transform:translateX(175%) translateY(175%) rotate(-35deg)}100%{transform:translateX(195%) translateY(195%) rotate(-35deg)}}
          @keyframes psWave3{0%{transform:translateX(-130%) translateY(-130%) rotate(-35deg)}60%,62%{transform:translateX(178%) translateY(178%) rotate(-35deg)}61%{transform:translateX(168%) translateY(168%) rotate(-35deg)}100%{transform:translateX(188%) translateY(188%) rotate(-35deg)}}
          @keyframes psGlitch{0%,58%,65%,100%{transform:skewX(0deg);opacity:1}59%{transform:skewX(-1deg);opacity:0.87}60%{transform:skewX(1.5deg);opacity:0.92}61%{transform:skewX(0deg);opacity:1}63%{transform:skewX(1deg);opacity:0.9}64%{transform:skewX(0deg);opacity:1}}
          @keyframes psBorder{0%{box-shadow:0 0 8px rgba(200,200,220,0.2)}30%{box-shadow:0 0 20px rgba(210,210,240,0.55),inset 0 0 10px rgba(255,255,255,0.1)}58%{box-shadow:0 0 14px rgba(200,200,220,0.4)}59%,61%{box-shadow:0 0 25px rgba(230,230,255,0.75)}60%{box-shadow:none}65%{box-shadow:0 0 14px rgba(200,200,220,0.4)}100%{box-shadow:0 0 8px rgba(200,200,220,0.2)}}
          .ps-overlay-wrap{position:absolute;inset:0;border-radius:1rem;overflow:hidden;pointer-events:none;z-index:10;animation:psGlitch 4s ease-in-out infinite}
          .ps-overlay-border{position:absolute;inset:0;border-radius:1rem;animation:psBorder 4s ease-in-out infinite}
          .ps-wave1{position:absolute;top:-80px;left:-80px;width:300px;height:300px;background:linear-gradient(135deg,transparent 0%,rgba(255,255,255,0.02) 35%,rgba(255,255,255,0.2) 45%,rgba(225,225,255,0.24) 50%,rgba(255,255,255,0.2) 55%,rgba(255,255,255,0.02) 65%,transparent 100%);animation:psWave1 4s cubic-bezier(0.4,0,0.6,1) infinite}
          .ps-wave2{position:absolute;top:-80px;left:-80px;width:300px;height:300px;background:linear-gradient(135deg,transparent 0%,rgba(200,200,255,0.01) 38%,rgba(255,255,255,0.12) 48%,rgba(255,255,255,0.09) 52%,transparent 62%,transparent 100%);animation:psWave2 4s cubic-bezier(0.4,0,0.6,1) infinite 0.3s}
          .ps-wave3{position:absolute;top:-80px;left:-80px;width:300px;height:300px;background:linear-gradient(135deg,transparent 0%,rgba(180,180,220,0.005) 40%,rgba(255,255,255,0.07) 50%,transparent 60%,transparent 100%);animation:psWave3 4s cubic-bezier(0.4,0,0.6,1) infinite 0.6s}
        `}</style>
        <div className="ps-overlay-wrap">
          <div className="ps-overlay-border" />
          <div className="ps-wave1" />
          <div className="ps-wave2" />
          <div className="ps-wave3" />
        </div>
      </>
    );
  }

  return null;
}

export default function PlayerCard({ profile, ratings = [], userStats, size = 'large', rank, showDownloadButton = false, overallRating, cardValue, isVerified = false, hasSocialBadge = false }: PlayerCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [activeSkin, setActiveSkin] = useState<ActiveSkin | null>(null);

  // Fetch active skin for this profile's card
  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from('user_skins')
      .select('skin_id, is_active, skin_items(name, skin_type)')
      .eq('user_id', profile.id)
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.skin_items) {
          setActiveSkin(data.skin_items as ActiveSkin);
        }
      })
      .catch(() => {});
  }, [profile?.id]);

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

          {/* Skin overlay — renders on top of card content, under shimmer gradient */}
          {activeSkin && <SkinOverlay skin={activeSkin} />}

          <div className="relative p-4" style={{ zIndex: 20 }}>
            {/* Card Info - Clean 2-Line Layout */}
            <div className="mb-3 space-y-1.5">
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <div className="glass-container px-2 py-1 rounded-lg border border-white/20 min-w-[45px]">
                  <div className="flex flex-col items-center">
                    <span className="text-base font-black text-white leading-none stats-number">{overall}</span>
                    <span className="text-[8px] font-bold text-[#B0B8C8] uppercase">OVR</span>
                  </div>
                </div>
                <div className="glass-container px-2 py-1 rounded-lg border border-white/20 flex items-center justify-center min-w-[32px]">
                  <VerificationBadge isVerified={isVerified} hasSocialBadge={hasSocialBadge} size="sm" />
                </div>
                {tier.name !== 'Default' && (
                  <div className={`${tierBadgeColors} px-2 py-1 rounded-lg border`}>
                    <div className="flex items-center gap-0.5">
                      <Award className="w-3 h-3" />
                      <span className="text-[8px] font-black uppercase whitespace-nowrap">{tier.name}</span>
                    </div>
                  </div>
                )}
                {profile.is_manager && (
                  <div className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-2 py-1 rounded-lg border border-yellow-300 shadow-lg shadow-yellow-500/30">
                    <span className="text-black font-black text-[10px] uppercase">MGR</span>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {profile.position && (
                  <div className="glass-container px-2 py-1 rounded-lg border border-white/20">
                    <span className="text-[8px] font-black text-white uppercase">{profile.position}</span>
                  </div>
                )}
                {profile.team && (
                  <div className="glass-container px-2 py-1 rounded-lg border border-white/20 max-w-[80px]">
                    <span className="text-[8px] font-black text-white uppercase truncate block">{profile.team}</span>
                  </div>
                )}
                {cardValue && (
                  <div className="bg-gradient-to-r from-[#FFD700] to-[#FFA500] px-2 py-1 rounded-lg border border-yellow-300 shadow-lg shadow-yellow-500/30">
                    <div className="flex items-center gap-0.5">
                      <Coins className="w-3 h-3 text-black" />
                      <span className="text-[8px] font-black text-black">{cardValue}</span>
                    </div>
                  </div>
                )}
                {rank && (
                  <div className="bg-gradient-to-r from-[#00FF85] to-[#00E0FF] px-2 py-1 rounded-lg border border-[#00FF85]/50 shadow-lg shadow-[#00FF85]/30">
                    <span className="text-[8px] font-black text-black">#{rank.position}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-center mb-3">
              <div className="relative w-[120px] h-[120px] rounded-full overflow-hidden border-4 border-white/20 shadow-xl">
                {profile.avatar_url ? (
                  <img
                    src={getAvatarUrl(profile.avatar_url) || profile.avatar_url}
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

            <div className="glass-container px-3 py-2 rounded-lg border border-white/20 mb-3">
              <h3 className="text-lg font-black text-white text-center tracking-wide uppercase">
                {profile.username}
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-2 glass-container p-3 rounded-lg border border-white/20 mb-2">
              {Object.entries(stats).map(([key, value]) => (
                <div key={key} className="flex flex-col items-center">
                  <span className="text-[9px] font-bold text-[#B0B8C8] uppercase tracking-wide">{key}</span>
                  <span className="text-xl font-black text-white stats-number">{value}</span>
                </div>
              ))}
            </div>

            {ratings.length > 0 && (
              <div className="text-center">
                <div className="inline-block glass-container px-3 py-1 rounded-full border border-white/20">
                  <p className="text-[10px] text-white font-semibold">Rated by {ratings.length}</p>
                </div>
              </div>
            )}
          </div>

          <div className={`absolute inset-0 bg-gradient-to-t ${tier.shimmerGradient} pointer-events-none rounded-2xl transition-all duration-700`} style={{ zIndex: 15 }}></div>
        </div>
      </div>

      {showDownloadButton && (
        <button onClick={handleDownload} className="btn-primary flex items-center gap-2">
          <Download className="w-5 h-5" />
          Download PNG
        </button>
      )}
    </div>
  );
}
