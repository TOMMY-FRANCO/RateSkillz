import { Profile } from '../contexts/AuthContext';
import { User } from 'lucide-react';
import OnlineStatus from './OnlineStatus';

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

interface PlayerCardProps {
  profile: Profile;
  ratings?: Rating[];
  size?: 'small' | 'medium' | 'large';
}

export default function PlayerCard({ profile, ratings = [], size = 'large' }: PlayerCardProps) {
  const calculateAverageRating = (attribute: keyof Omit<Rating, 'id' | 'rater_id' | 'player_id' | 'comment' | 'created_at'>) => {
    if (ratings.length === 0) return 50;
    const sum = ratings.reduce((acc, rating) => acc + rating[attribute], 0);
    return Math.round(sum / ratings.length);
  };

  const stats = {
    PAC: calculateAverageRating('pac'),
    SHO: calculateAverageRating('sho'),
    PAS: calculateAverageRating('pas'),
    DRI: calculateAverageRating('dri'),
    DEF: calculateAverageRating('def'),
    PHY: calculateAverageRating('phy'),
  };

  const overall = Math.round(Object.values(stats).reduce((a, b) => a + b, 0) / 6);

  const sizeClasses = {
    small: 'w-64',
    medium: 'w-80',
    large: 'w-96',
  };

  return (
    <div className={`${sizeClasses[size]} relative`}>
      <div
        className="relative bg-gradient-to-br from-gray-900 via-gray-800 to-black shadow-2xl border-2 border-cyan-500/30"
        style={{
          clipPath: 'polygon(0 0, 100% 0, 100% 85%, 50% 100%, 0 85%)',
          paddingBottom: '110%'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-cyan-500/5"></div>

        <div className="absolute inset-0 p-6 flex flex-col">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1">
              <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                {overall}
              </div>
              <div className="text-xs font-semibold text-cyan-400 tracking-wider">
                OVERALL
              </div>
            </div>

            <div className="flex flex-col items-end space-y-2">
              <div className="text-right">
                <div className="text-sm font-bold text-green-400">RS 25</div>
                <div className="text-xs text-gray-400">PLAYER</div>
              </div>
              <OnlineStatus lastActive={profile.last_active} size="medium" />
            </div>
          </div>

          <div className="relative mb-4 flex-shrink-0">
            <div className="w-48 h-48 mx-auto rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 overflow-hidden border-2 border-cyan-500/30 shadow-lg">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="w-full h-full object-cover"
                  style={
                    profile.avatar_position
                      ? {
                          transform: `translate(${profile.avatar_position.x}px, ${profile.avatar_position.y}px) scale(${profile.avatar_position.scale})`,
                          transformOrigin: 'center center',
                        }
                      : undefined
                  }
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-24 h-24 text-gray-600" />
                </div>
              )}
            </div>
          </div>

          <div className="text-center mb-6">
            <h3 className="text-2xl font-black text-white tracking-wide uppercase">
              {profile.username}
            </h3>
            {profile.full_name && (
              <p className="text-sm text-gray-400 mt-1">{profile.full_name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {Object.entries(stats).map(([key, value]) => (
              <div
                key={key}
                className="bg-black/40 rounded-lg p-3 border border-gray-700/50 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-400">{key}</span>
                  <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                    {value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {ratings.length > 0 && (
            <div className="mt-auto text-center pb-8">
              <p className="text-xs text-gray-500">
                Rated by {ratings.length} {ratings.length === 1 ? 'friend' : 'friends'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
