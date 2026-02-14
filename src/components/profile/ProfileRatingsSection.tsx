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
      <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-cyan-500/20">
        <div className="flex items-center gap-2 text-gray-400">
          <Lock className="w-5 h-5" />
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
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-cyan-500/20 mb-6">
      <h3 className="text-xl font-bold text-white mb-4">
        {myRating ? 'Update Your Rating' : 'Rate This Player'}
      </h3>

      <div className="space-y-4">
        {stats.map(({ key, label, description }) => (
          <div key={key} className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-gray-300 font-medium">{label}</label>
              <span className="text-cyan-400 font-bold">{editingRatings[key as keyof typeof editingRatings]}</span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              value={editingRatings[key as keyof typeof editingRatings]}
              onChange={(e) => onRatingChange(key, parseInt(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
            />
            <p className="text-xs text-gray-500">{description}</p>
          </div>
        ))}
      </div>

      {ratingError && (
        <div className="mt-4 p-3 bg-red-900/20 border border-red-500/50 rounded-lg">
          <p className="text-red-400 text-sm">{ratingError}</p>
        </div>
      )}

      {ratingSuccess && (
        <div className="mt-4 p-3 bg-green-900/20 border border-green-500/50 rounded-lg">
          <p className="text-green-400 text-sm">Rating saved successfully</p>
        </div>
      )}

      <button
        onClick={onSaveRatings}
        disabled={savingRating}
        className="mt-6 w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {savingRating ? 'Saving...' : myRating ? 'Update Rating' : 'Save Rating'}
      </button>
    </div>
  );
}
