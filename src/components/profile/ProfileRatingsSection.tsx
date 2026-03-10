import { Lock } from 'lucide-react';
import type { FriendStatus } from '../../hooks/useProfileData';

interface ProfileRatingsSectionProps {
  isOwner: boolean;
  isEditingEnabled: boolean;
  friendStatus: FriendStatus;
  myRating: any | null;
  editingRatings: {
    pac: number;
    sho: number;
    pas: number;
    dri: number;
    def: number;
    phy: number;
  };
  savingRating: boolean;
  ratingError: string | null;
  ratingSuccess: boolean;
  onRatingChange: (stat: string, value: number) => void;
  onSaveRatings: () => void;
}

export default function ProfileRatingsSection({
  isOwner,
  isEditingEnabled,
  friendStatus,
  myRating,
  editingRatings,
  savingRating,
  ratingError,
  ratingSuccess,
  onRatingChange,
  onSaveRatings,
}: ProfileRatingsSectionProps) {
  const canRate = friendStatus === 'accepted' && !isOwner;

  if (isOwner || !canRate) {
    return (
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-cyan-500/20">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center">
            <Lock className="w-5 h-5" />
          </div>
          <p className="text-sm">
            {isOwner
              ? 'You cannot rate your own profile'
              : 'Only friends can rate this profile'}
          </p>
        </div>
      </div>
    );
  }

  const stats = [
    { key: 'pac', label: 'PAC', description: 'Pace' },
    { key: 'sho', label: 'SHO', description: 'Shooting' },
    { key: 'pas', label: 'PAS', description: 'Passing' },
    { key: 'dri', label: 'DRI', description: 'Dribbling' },
    { key: 'def', label: 'DEF', description: 'Defense' },
    { key: 'phy', label: 'PHY', description: 'Physical' },
  ];

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-cyan-500/20 mb-6">
      <h3 className="text-lg sm:text-xl font-bold text-white mb-5 tracking-wide">
        {myRating ? 'Update Your Rating' : 'Rate This Player'}
      </h3>

      <div className="space-y-5">
        {stats.map(({ key, label, description }) => (
          <div key={key} className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-slate-300 font-semibold text-sm">{label}</label>
              <span className="text-cyan-400 font-bold text-lg tabular-nums">{editingRatings[key as keyof typeof editingRatings]}</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={editingRatings[key as keyof typeof editingRatings]}
              onChange={(e) => onRatingChange(key, parseInt(e.target.value))}
              className="w-full h-2 bg-slate-700/80 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <p className="text-xs text-slate-500">{description}</p>
          </div>
        ))}
      </div>

      {ratingError && (
        <div className="mt-4 p-3.5 bg-red-900/20 border border-red-500/30 rounded-xl">
          <p className="text-red-400 text-sm">{ratingError}</p>
        </div>
      )}

      {ratingSuccess && (
        <div className="mt-4 p-3.5 bg-green-900/20 border border-green-500/30 rounded-xl">
          <p className="text-green-400 text-sm">Rating saved successfully</p>
        </div>
      )}

      <button
        onClick={onSaveRatings}
        disabled={savingRating}
        className="mt-6 w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30"
      >
        {savingRating ? 'Saving...' : myRating ? 'Update Rating' : 'Save Rating'}
      </button>
    </div>
  );
}
