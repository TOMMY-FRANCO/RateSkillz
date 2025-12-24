import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PlayerCard, { UserStats } from '../components/PlayerCard';
import SocialLinks from '../components/SocialLinks';
import { Eye, Users, ThumbsUp, Coins, Loader2 } from 'lucide-react';
import type { Profile } from '../contexts/AuthContext';
import { getUserStats } from '../lib/ratings';
import { formatCoinBalance, formatCoinBalanceFull } from '../lib/formatBalance';
import { updateMetaTags, getAbsoluteImageUrl, getProfileCardUrl } from '../lib/metaTags';

export default function PublicCard() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [socialLinks, setSocialLinks] = useState<any>(null);
  const [friendsCount, setFriendsCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [coinBalance, setCoinBalance] = useState<number>(0);
  const [balanceLoading, setBalanceLoading] = useState(true);

  useEffect(() => {
    if (username) {
      loadProfile();
    }
  }, [username]);

  const loadProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profileData) {
        setLoading(false);
        return;
      }

      setProfile(profileData);

      setViewsCount(profileData.profile_views_count || 0);

      const stats = await getUserStats(profileData.id);
      setUserStats(stats);

      const { data: socialLinksData } = await supabase
        .from('social_links')
        .select('*')
        .eq('user_id', profileData.id)
        .maybeSingle();

      setSocialLinks(socialLinksData);

      const { data: friendsData } = await supabase
        .from('friends')
        .select('id')
        .eq('status', 'accepted')
        .or(`user_id.eq.${profileData.id},friend_id.eq.${profileData.id}`);
      setFriendsCount(friendsData?.length || 0);

      const { data: likesData } = await supabase
        .from('profile_likes')
        .select('*')
        .eq('profile_id', profileData.id)
        .eq('is_like', true);
      setLikesCount(likesData?.length || 0);

      const { data: balanceData, error: balanceError } = await supabase
        .from('coins')
        .select('balance')
        .eq('user_id', profileData.id)
        .maybeSingle();

      if (balanceError) {
        console.error('Error loading coin balance:', balanceError);
      }

      console.log(`Coin balance for ${profileData.username}:`, balanceData?.balance || 0);
      setCoinBalance(balanceData?.balance || 0);
      setBalanceLoading(false);

      updateMetaTags({
        title: `${profileData.username}'s Football Player Card - RatingSkill`,
        description: `Check out ${profileData.full_name || profileData.username}'s Card! Overall Rating: ${profileData.overall_rating || 'Not Rated'}. Rate me on RatingSkill!`,
        image: getAbsoluteImageUrl(profileData.profile_picture_url),
        url: getProfileCardUrl(profileData.username),
        type: 'profile',
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading profile:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-4">Player not found</div>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-xl font-bold text-white">{profile.username}'s Player Card</h1>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-semibold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all"
            >
              Create Your Card
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex justify-center mb-8">
          <PlayerCard
            profile={profile}
            userStats={userStats}
            showDownloadButton={false}
            overallRating={profile.overall_rating}
          />
        </div>

        <div className="max-w-3xl mx-auto mb-8">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-6 text-center">Profile Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-14 h-14 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                  <Coins className="w-7 h-7 text-white" />
                </div>
                {balanceLoading ? (
                  <div className="flex items-center justify-center h-8">
                    <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                  </div>
                ) : (
                  <>
                    <span className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent">
                      {formatCoinBalance(coinBalance)}
                    </span>
                    <span className="text-sm text-gray-400">Balance</span>
                    <span className="text-xs text-gray-500">{formatCoinBalanceFull(coinBalance)} coins</span>
                  </>
                )}
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">{friendsCount}</span>
                <span className="text-sm text-gray-400">Friends</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
                  <Eye className="w-7 h-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">{viewsCount}</span>
                <span className="text-sm text-gray-400">Views</span>
              </div>
              <div className="flex flex-col items-center space-y-2">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-lg">
                  <ThumbsUp className="w-7 h-7 text-white" />
                </div>
                <span className="text-2xl font-bold text-white">{likesCount}</span>
                <span className="text-sm text-gray-400">Likes</span>
              </div>
            </div>
          </div>
        </div>

        <SocialLinks
          socialLinks={socialLinks}
          isOwner={false}
        />

        <div className="max-w-2xl mx-auto text-center mt-12">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8">
            <h2 className="text-2xl font-bold text-white mb-4">Want your own player card?</h2>
            <p className="text-gray-400 mb-6">Create your personalized football player card and share it with the world!</p>
            <button
              onClick={() => navigate('/')}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-cyan-500 text-black font-bold rounded-lg hover:from-green-400 hover:to-cyan-400 transition-all hover:scale-105 shadow-lg"
            >
              Get Started
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
