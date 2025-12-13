import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Profile, Friendship } from '../lib/supabase';
import { ArrowLeft, Search, UserPlus, Users as UsersIcon } from 'lucide-react';

export default function Friends() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<(Profile & { friendship: Friendship })[]>([]);
  const [pendingRequests, setPendingRequests] = useState<(Profile & { friendship: Friendship })[]>([]);
  const [sentRequests, setSentRequests] = useState<(Profile & { friendship: Friendship })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchFriends();
    }
  }, [profile]);

  const fetchFriends = async () => {
    if (!profile) return;

    const { data: friendships } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${profile.id},receiver_id.eq.${profile.id}`);

    if (friendships) {
      const accepted = friendships.filter(f => f.status === 'accepted');
      const pending = friendships.filter(f => f.status === 'pending' && f.receiver_id === profile.id);
      const sent = friendships.filter(f => f.status === 'pending' && f.requester_id === profile.id);

      const friendIds = accepted.map(f =>
        f.requester_id === profile.id ? f.receiver_id : f.requester_id
      );

      if (friendIds.length > 0) {
        const { data: friendProfiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', friendIds);

        if (friendProfiles) {
          const friendsWithData = friendProfiles.map(fp => ({
            ...fp,
            friendship: accepted.find(f =>
              f.requester_id === fp.id || f.receiver_id === fp.id
            )!
          }));
          setFriends(friendsWithData);
        }
      }

      if (pending.length > 0) {
        const pendingIds = pending.map(p => p.requester_id);
        const { data: pendingProfiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', pendingIds);

        if (pendingProfiles) {
          const pendingWithData = pendingProfiles.map(pp => ({
            ...pp,
            friendship: pending.find(p => p.requester_id === pp.id)!
          }));
          setPendingRequests(pendingWithData);
        }
      }

      if (sent.length > 0) {
        const sentIds = sent.map(s => s.receiver_id);
        const { data: sentProfiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', sentIds);

        if (sentProfiles) {
          const sentWithData = sentProfiles.map(sp => ({
            ...sp,
            friendship: sent.find(s => s.receiver_id === sp.id)!
          }));
          setSentRequests(sentWithData);
        }
      }
    }

    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .or(`username.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%,school.ilike.%${searchQuery}%,college.ilike.%${searchQuery}%`)
      .neq('id', user?.id)
      .limit(10);

    if (data) {
      setSearchResults(data);
    }
  };

  const sendFriendRequest = async (receiverId: string) => {
    if (!profile) return;

    await supabase.from('friendships').insert({
      requester_id: profile.id,
      receiver_id: receiverId,
      status: 'pending'
    });

    fetchFriends();
    setSearchResults([]);
    setSearchQuery('');
  };

  const acceptRequest = async (friendshipId: string) => {
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId);

    fetchFriends();
  };

  const declineRequest = async (friendshipId: string) => {
    await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    fetchFriends();
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
              <h1 className="text-xl font-bold text-white">Friends</h1>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Search Friends</h2>
          <div className="flex space-x-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search by username, location, school, or college..."
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
            />
            <button
              onClick={handleSearch}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all flex items-center space-x-2"
            >
              <Search className="w-5 h-5" />
              <span>Search</span>
            </button>
          </div>

          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {searchResults.map((result) => (
                <div
                  key={result.id}
                  className="flex items-center justify-between bg-gray-800 rounded-lg p-4"
                >
                  <div>
                    <p className="text-white font-semibold">{result.username}</p>
                    <p className="text-gray-400 text-sm">
                      {[result.location, result.school, result.college].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <button
                    onClick={() => sendFriendRequest(result.id)}
                    className="px-4 py-2 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-all flex items-center space-x-2"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Add</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {pendingRequests.length > 0 && (
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Pending Requests</h2>
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between bg-gray-800 rounded-lg p-4"
                >
                  <div>
                    <p className="text-white font-semibold">{request.username}</p>
                    <p className="text-gray-400 text-sm">{request.full_name}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => acceptRequest(request.friendship.id)}
                      className="px-4 py-2 bg-green-500 text-black font-semibold rounded-lg hover:bg-green-400 transition-all"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => declineRequest(request.friendship.id)}
                      className="px-4 py-2 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-400 transition-all"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sentRequests.length > 0 && (
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Sent Requests</h2>
            <div className="space-y-3">
              {sentRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between bg-gray-800 rounded-lg p-4"
                >
                  <div>
                    <p className="text-white font-semibold">{request.username}</p>
                    <p className="text-gray-400 text-sm">{request.full_name}</p>
                  </div>
                  <span className="text-yellow-400 text-sm">Pending</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
            <UsersIcon className="w-6 h-6" />
            <span>My Friends ({friends.length})</span>
          </h2>

          {loading ? (
            <p className="text-gray-400">Loading friends...</p>
          ) : friends.length === 0 ? (
            <p className="text-gray-400">No friends yet. Search and add some friends above!</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {friends.map((friend) => (
                <button
                  key={friend.id}
                  onClick={() => navigate(`/profile/${friend.username}`)}
                  className="bg-gray-800 rounded-lg p-4 hover:border-cyan-500/50 border border-transparent transition-all text-left w-full cursor-pointer"
                >
                  <p className="text-white font-semibold">{friend.username}</p>
                  <p className="text-gray-400 text-sm">{friend.full_name}</p>
                  {friend.location && (
                    <p className="text-gray-500 text-xs mt-1">{friend.location}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
