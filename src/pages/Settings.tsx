import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, LogOut, User, Users, Bell, FileText, Shield, UserCheck, Volume2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../contexts/AuthContext';
import OnlineStatus from '../components/OnlineStatus';
import UsernameChanger from '../components/UsernameChanger';
import { displayUsername } from '../lib/username';
import { WhatsAppVerification } from '../components/WhatsAppVerification';
import { VerificationBadge } from '../components/VerificationBadge';
import { useSoundEffects } from '../hooks/useSoundEffects';
import { playSound } from '../lib/sounds';

export default function Settings() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [isVerified, setIsVerified] = useState(false);
  const [hasSocialBadge, setHasSocialBadge] = useState(false);
  const [friendCount, setFriendCount] = useState(0);
  const { prefs: audioPrefs, updatePrefs: updateAudioPrefs } = useSoundEffects();

  useEffect(() => {
    loadProfiles();
    if (profile) {
      fetchPendingRequests();
      fetchVerificationStatus();
    }
  }, [profile]);

  const fetchVerificationStatus = async () => {
    if (!profile) return;

    try {
      const { data } = await supabase
        .from('profiles')
        .select('is_verified, has_social_badge, friend_count')
        .eq('id', profile.id)
        .single();

      if (data) {
        setIsVerified(data.is_verified || false);
        setHasSocialBadge(data.has_social_badge || false);
        setFriendCount(data.friend_count || 0);
      }
    } catch (error) {
      console.error('Error fetching verification status:', error);
    }
  };

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

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <Shield className="w-6 h-6" />
              <span>Profile Verification</span>
            </h2>

            <div className="space-y-4 mb-4">
              <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex items-center gap-3">
                  <VerificationBadge
                    isVerified={isVerified}
                    hasSocialBadge={hasSocialBadge}
                    size="lg"
                  />
                  <div>
                    <p className="text-white font-semibold">
                      {!isVerified && 'Not Verified'}
                      {isVerified && !hasSocialBadge && 'Verified'}
                      {isVerified && hasSocialBadge && 'Verified + Social Badge'}
                    </p>
                    <p className="text-gray-400 text-sm">
                      {!isVerified && 'Share your profile to get verified'}
                      {isVerified && !hasSocialBadge && `${friendCount}/5 friends for social badge`}
                      {isVerified && hasSocialBadge && `${friendCount} friends connected`}
                    </p>
                  </div>
                </div>
              </div>

              {isVerified && !hasSocialBadge && (
                <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <UserCheck className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-yellow-200 font-semibold text-sm mb-1">
                        Get the Social Badge
                      </p>
                      <p className="text-yellow-300/80 text-xs">
                        Connect with {5 - friendCount} more friend{5 - friendCount !== 1 ? 's' : ''} to unlock the yellow circle around your blue checkmark!
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <WhatsAppVerification
              isVerified={isVerified}
              username={profile.username}
              onVerificationComplete={fetchVerificationStatus}
            />
          </div>

          <UsernameChanger />

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <Volume2 className="w-6 h-6" />
              <span>Sound Effects</span>
            </h2>
            <div className="space-y-4">
              {([
                { key: 'master' as const, label: 'Master Audio', desc: 'Enable all sound effects' },
                { key: 'transactions' as const, label: 'Transactions', desc: 'Purchases, coin transfers, swaps' },
                { key: 'battles' as const, label: 'Battles', desc: 'Win/loss results' },
                { key: 'notifications' as const, label: 'Notifications', desc: 'Alerts, rank changes, milestones' },
              ]).map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <div>
                    <p className="text-white font-semibold text-sm">{label}</p>
                    <p className="text-gray-400 text-xs">{desc}</p>
                  </div>
                  <button
                    onClick={() => {
                      const newVal = !audioPrefs[key];
                      updateAudioPrefs({ [key]: newVal });
                      if (newVal && (key === 'master' || audioPrefs.master)) {
                        playSound('notification');
                      }
                    }}
                    className={`relative w-12 h-7 rounded-full transition-colors ${
                      audioPrefs[key] && (key === 'master' || audioPrefs.master)
                        ? 'bg-cyan-500'
                        : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-transform ${
                        audioPrefs[key] && (key === 'master' || audioPrefs.master)
                          ? 'translate-x-6'
                          : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>

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
            <h2 className="text-xl font-bold text-white mb-4">Legal & About</h2>
            <div className="space-y-3 mb-4">
              <button
                onClick={() => navigate('/terms')}
                className="w-full flex items-center gap-3 p-4 bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-cyan-500/50 rounded-lg transition-all cursor-pointer text-left"
              >
                <FileText className="w-5 h-5 text-cyan-400" />
                <div>
                  <p className="text-white font-semibold">Terms of Service</p>
                  <p className="text-gray-400 text-sm">Review our terms and policies</p>
                </div>
              </button>
            </div>
            <p className="text-gray-400 text-sm">
              RatingSkill® - Create your personalised RatingSkill® card and get rated by friends.
            </p>
            <p className="text-gray-500 text-xs mt-4">Version 1.0.0</p>
          </div>
        </div>
      </main>
    </div>
  );
}
