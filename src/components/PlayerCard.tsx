import { Profile } from '../contexts/AuthContext';
import { User } from 'lucide-react';

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
    large: 'w-[420px]',
  };

  return (
    <div className={`${sizeClasses[size]} relative mx-auto`}>
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-gray-900 shadow-2xl border-4 border-purple-400/30">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-400/20 via-transparent to-transparent"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMDMiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>

        <div className="relative p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col items-center space-y-1 bg-purple-900/50 rounded-lg px-4 py-3 backdrop-blur-sm border border-purple-400/30">
              <div className="text-6xl font-black text-white drop-shadow-lg">
                {overall}
              </div>
              <div className="text-sm font-bold text-white uppercase tracking-wider">
                {profile.position || 'RW'}
              </div>
            </div>

            <div className="bg-purple-700 px-4 py-2 rounded-lg text-white font-bold text-sm border border-purple-300/50">
              {profile.team || 'RS 25'}
            </div>
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

          <div className="bg-gradient-to-r from-purple-900/90 via-purple-800/90 to-purple-900/90 backdrop-blur-sm px-4 py-3 rounded-lg border border-purple-400/30 mb-4">
            <h3 className="text-3xl font-black text-white text-center tracking-wide uppercase drop-shadow-lg">
              {profile.full_name || profile.username}
            </h3>
          </div>

          <div className="grid grid-cols-6 gap-2 bg-gradient-to-r from-purple-950/80 via-black/80 to-purple-950/80 backdrop-blur-sm p-4 rounded-lg border border-purple-400/30">
            {Object.entries(stats).map(([key, value]) => (
              <div key={key} className="flex flex-col items-center">
                <span className="text-xs font-bold text-purple-200 uppercase tracking-wide">{key}</span>
                <span className="text-2xl font-black text-white drop-shadow-lg">{value}</span>
              </div>
            ))}
          </div>

          {ratings.length > 0 && (
            <div className="mt-4 text-center">
              <div className="inline-block bg-purple-900/50 px-4 py-2 rounded-full border border-purple-400/30">
                <p className="text-sm text-purple-100 font-semibold">
                  Rated by {ratings.length}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/5 pointer-events-none rounded-2xl"></div>
      </div>
    </div>
  );
}
