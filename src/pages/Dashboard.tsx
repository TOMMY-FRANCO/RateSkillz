import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import PlayerCard, { Rating } from '../components/PlayerCard';
import { Settings, Users, LogOut, Edit } from 'lucide-react';

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchRatings();
    }
  }, [profile]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const fetchRatings = async () => {
    if (!profile) return;

    const allRatings = JSON.parse(localStorage.getItem('ratings') || '{}');
    const userRatings = Object.values(allRatings).filter(
      (rating: any) => rating.player_id === profile.id
    ) as Rating[];

    setRatings(userRatings);
    setLoading(false);
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                FC Rating
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/friends')}
                className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center space-x-2 bg-none border-none cursor-pointer"
              >
                <Users className="w-5 h-5" />
                <span className="hidden sm:inline">Friends</span>
              </button>
              <button
                onClick={() => navigate('/edit-profile')}
                className="text-gray-300 hover:text-cyan-400 transition-colors flex items-center space-x-2 bg-none border-none cursor-pointer"
              >
                <Edit className="w-5 h-5" />
                <span className="hidden sm:inline">Edit Profile</span>
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="text-gray-300 hover:text-cyan-400 transition-colors bg-none border-none cursor-pointer"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button
                onClick={handleSignOut}
                className="text-gray-300 hover:text-red-400 transition-colors bg-none border-none cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">
            Welcome, {profile.username}!
          </h2>
          <p className="text-gray-400">
            {ratings.length === 0
              ? 'Invite friends to rate your player card'
              : `Your card has been rated by ${ratings.length} ${ratings.length === 1 ? 'friend' : 'friends'}`}
          </p>
        </div>

        <div className="flex justify-center mb-12">
          {loading ? (
            <div className="text-white">Loading your card...</div>
          ) : (
            <PlayerCard profile={profile} ratings={ratings} />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <button
            onClick={() => navigate('/friends')}
            className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all group cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-cyan-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Friends</h3>
                <p className="text-gray-400 text-sm">Manage connections</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/edit-profile')}
            className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all group cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-cyan-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Edit className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Edit Profile</h3>
                <p className="text-gray-400 text-sm">Update your info</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/settings')}
            className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-xl p-6 hover:border-cyan-500/50 transition-all group cursor-pointer text-left w-full"
          >
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-cyan-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                <Settings className="w-6 h-6 text-black" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Settings</h3>
                <p className="text-gray-400 text-sm">Account options</p>
              </div>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}
