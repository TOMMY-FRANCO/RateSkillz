import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, LogOut, User, Users, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../contexts/AuthContext';
import OnlineStatus from '../components/OnlineStatus';
import UsernameChanger from '../components/UsernameChanger';
import { displayUsername } from '../lib/username';

export default function Settings() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    loadProfiles();
    if (profile) {
      fetchPendingRequests();
    }
  }, [profile]);

  const fetchPendingRequests = async () => {
    if (!profile) return;

    try {
      const { data } = await supabase
        .from('friends')
        .select('id')
        .eq('friend_id', profile.id)
        .eq('status', 'pending');

      setPendingRequestsCount(data?.length || 0);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  };

  const loadProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('last_active', { ascending: false });

      if (!error && data) {
        setAllProfiles(data.filter((p) => p.id !== profile?.id));
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
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
              <button
                onClick={() => navigate('/dashboard')}
                className="text-gray-300 hover:text-cyan-400 transition-colors bg-none border-none cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white">Settings</h1>
            </div>
            <button
              onClick={() => navigate('/friends')}
              className="text-gray-300 hover:text-cyan-400 transition-colors relative bg-none border-none cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {pendingRequestsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                  {pendingRequestsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <User className="w-6 h-6" />
              <span>Account Information</span>
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                <p className="text-white font-semibold">{displayUsername(profile.username)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
                <p className="text-white">{profile.full_name || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Position</label>
                <p className="text-white">{profile.position || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Team</label>
                <p className="text-white">{profile.team || 'Not set'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Jersey Number</label>
                <p className="text-white">{profile.number || 'Not set'}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/edit-profile')}
              className="mt-6 inline-block px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all cursor-pointer border-none"
            >
              Edit Profile
            </button>
          </div>

          <UsernameChanger />

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">Actions</h2>
            <button
              onClick={handleSignOut}
              className="w-full px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-400 transition-all flex items-center justify-center space-x-2"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <Users className="w-6 h-6" />
              <span>Browse Players</span>
            </h2>
            {loading ? (
              <p className="text-gray-400">Loading players...</p>
            ) : allProfiles.length === 0 ? (
              <p className="text-gray-400">No other players yet. Invite friends to join!</p>
            ) : (
              <div className="space-y-3">
                {allProfiles.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/profile/${p.username}`)}
                    className="w-full flex items-center justify-between p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-cyan-500/50 rounded-lg transition-all cursor-pointer text-left"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center overflow-hidden">
                        {p.avatar_url ? (
                          <img
                            src={p.avatar_url}
                            alt={p.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-6 h-6 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <p className="text-white font-semibold">{displayUsername(p.username)}</p>
                        <p className="text-gray-400 text-sm">
                          {p.position || 'No position'} {p.team ? `• ${p.team}` : ''}
                        </p>
                      </div>
                    </div>
                    <OnlineStatus lastActive={p.last_active} size="small" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4">About</h2>
            <p className="text-gray-400 text-sm">
              RatingSkill® - Create your personalized RatingSkill® card and get rated by friends.
            </p>
            <p className="text-gray-500 text-xs mt-4">Version 1.0.0</p>
          </div>
        </div>
      </main>
    </div>
  );
}
