import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Eye, UserPlus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { sendFriendRequest } from '../lib/friendRequests';
import { useTierBadges } from '../hooks/useTierBadges';
import { markNotificationsRead } from '../lib/notifications';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../components/ui/Shimmer';
import { SkeletonAvatar } from '../components/ui/SkeletonPresets';

interface ViewerData {
  viewer_id: string;
  username: string;
  avatar_url: string | null;
  overall_rating: number;
  position: string | null;
  team: string | null;
  coin_balance: number;
  is_manager: boolean;
  manager_wins: number;
  last_active: string;
  is_verified: boolean;
  has_social_badge: boolean;
  viewed_at: string;
  pac?: number;
  sho?: number;
  pas?: number;
  dri?: number;
  def?: number;
  phy?: number;
  card_worth?: number;
  rank?: number;
}

const VIEWERS_PER_PAGE = 20;

export default function ViewedMe() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [viewers, setViewers] = useState<ViewerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalViewers, setTotalViewers] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);
  const { tiers } = useTierBadges();

  const getTierForRating = (rating: number) => {
    return tiers.find(tier =>
      rating >= tier.overall_rating_min && rating <= tier.overall_rating_max
    );
  };

  useEffect(() => {
    if (user) {
      fetchViewers();
      markNotificationsRead(user.id, 'profile_view');
      markProfileViewsAsRead();
    }
  }, [user, currentPage]);

  const markProfileViewsAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase.rpc('mark_profile_views_read', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error marking profile views as read:', error);
      }
    } catch (error) {
      console.error('Exception marking profile views as read:', error);
    }
  };

  const fetchViewers = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { data: cacheData, error: cacheError } = await supabase
        .from('profile_view_cache')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cacheError) throw cacheError;

      const totalCount = cacheData?.recent_viewers_count || 0;
      setTotalViewers(totalCount);

      if (cacheData && cacheData.last_viewer_id) {
        const viewer: ViewerData = {
          viewer_id: cacheData.last_viewer_id,
          username: cacheData.last_viewer_username || 'Unknown',
          avatar_url: null,
          overall_rating: cacheData.overall_rating || 50,
          position: cacheData.position,
          team: cacheData.team,
          coin_balance: 0,
          is_manager: false,
          manager_wins: 0,
          last_active: cacheData.last_seen || cacheData.updated_at,
          is_verified: cacheData.is_verified || false,
          has_social_badge: false,
          viewed_at: cacheData.last_viewed_at,
        };
        setViewers([viewer]);
      } else {
        setViewers([]);
      }
    } catch (error) {
      console.error('Error fetching viewers:', error);
      setViewers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (recipientId: string) => {
    if (!user) return;

    setSendingRequest(recipientId);
    try {
      const { error } = await sendFriendRequest(recipientId);
      if (error) throw error;
      alert('Friend request sent!');
    } catch (error: any) {
      console.error('Error sending friend request:', error);
      alert(error?.message || 'Failed to send friend request');
    } finally {
      setSendingRequest(null);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 5) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const getOnlineStatus = (lastActive: string) => {
    const date = new Date(lastActive);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 5) {
      return { text: 'Online now', color: 'text-green-400', dotColor: 'bg-green-400' };
    } else if (diffMins < 60) {
      return { text: `Last online: ${diffMins} minutes ago`, color: 'text-yellow-400', dotColor: 'bg-yellow-400' };
    } else if (diffHours < 24) {
      return { text: `Last online: ${diffHours} hours ago`, color: 'text-orange-400', dotColor: 'bg-orange-400' };
    } else if (diffDays === 1) {
      return { text: 'Last online: Yesterday', color: 'text-orange-400', dotColor: 'bg-orange-400' };
    } else {
      return { text: `Last online: ${diffDays} days ago`, color: 'text-gray-400', dotColor: 'bg-gray-400' };
    }
  };

  const totalPages = Math.ceil(totalViewers / VIEWERS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 md:p-8 mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Eye className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl md:text-4xl font-black text-white">Viewed Me</h1>
          </div>
          <p className="text-white/60">
            {totalViewers === 0
              ? 'No one has viewed your profile yet'
              : `${totalViewers} ${totalViewers === 1 ? 'person has' : 'people have'} viewed your profile`}
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <StaggerItem key={i} index={i}>
                <div className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20 rounded-2xl p-6">
                  <div className="flex items-start gap-4">
                    <SkeletonAvatar size="lg" />
                    <div className="flex-1 space-y-3">
                      <ShimmerBar className="h-5 w-36 rounded" />
                      <ShimmerBar className="h-3 w-24 rounded" speed="slow" />
                      <div className="grid grid-cols-3 gap-2">
                        <ShimmerBar className="h-12 rounded-lg" speed="slow" />
                        <ShimmerBar className="h-12 rounded-lg" speed="slow" />
                        <ShimmerBar className="h-12 rounded-lg" speed="slow" />
                      </div>
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
            <SlowLoadMessage loading={true} message="Loading profile viewers..." />
          </div>
        ) : viewers.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-12 text-center">
            <Eye className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 text-lg mb-2">No profile views yet</p>
            <p className="text-white/40">Share your profile to get more views!</p>
          </div>
        ) : (
          <>
            <div className="space-y-6 mb-6">
              {viewers.map((viewer) => {
                const onlineStatus = getOnlineStatus(viewer.last_active);
                const tier = getTierForRating(viewer.overall_rating);

                return (
                  <div
                    key={viewer.viewer_id}
                    className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:border-white/40 transition-all"
                  >
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl overflow-hidden flex-shrink-0">
                          {viewer.avatar_url ? (
                            <img
                              src={viewer.avatar_url}
                              alt={viewer.username}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            viewer.username[0].toUpperCase()
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-xl font-black text-white">{viewer.username}</h3>
                            {viewer.is_verified && (
                              <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            )}
                            {viewer.has_social_badge && (
                              <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                                <span className="text-white text-xs">S</span>
                              </div>
                            )}
                            {viewer.is_manager && (
                              <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-bold rounded">
                                M
                              </span>
                            )}
                          </div>
                          <p className="text-white/60 text-sm mb-2">Viewed by {viewer.username}</p>
                          <div className="flex flex-wrap gap-2 text-sm mb-2">
                            <span className="text-white/40">{getTimeAgo(viewer.viewed_at)}</span>
                          </div>
                          <div className={`flex items-center gap-2 ${onlineStatus.color}`}>
                            <div className={`w-2 h-2 rounded-full ${onlineStatus.dotColor} animate-pulse`}></div>
                            <span className="text-sm font-semibold">{onlineStatus.text}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="bg-black/30 rounded-xl p-4 mb-4">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                            <div>
                              <div className="text-white/60 text-xs mb-1">Overall</div>
                              <div className="text-white font-black text-2xl">{viewer.overall_rating}</div>
                            </div>
                            {viewer.position && (
                              <div>
                                <div className="text-white/60 text-xs mb-1">Position</div>
                                <div className="text-white font-bold">{viewer.position}</div>
                              </div>
                            )}
                            {viewer.team && (
                              <div>
                                <div className="text-white/60 text-xs mb-1">Team</div>
                                <div className="text-white font-semibold truncate">{viewer.team}</div>
                              </div>
                            )}
                            {viewer.card_worth !== undefined && (
                              <div>
                                <div className="text-white/60 text-xs mb-1">Card Worth</div>
                                <div className="text-yellow-400 font-bold">{viewer.card_worth.toFixed(0)} coins</div>
                              </div>
                            )}
                            {viewer.rank && (
                              <div>
                                <div className="text-white/60 text-xs mb-1">Rank</div>
                                <div className="text-white font-bold">#{viewer.rank}</div>
                              </div>
                            )}
                            {tier && (
                              <div>
                                <div className="text-white/60 text-xs mb-1">Tier</div>
                                <div
                                  className="font-bold text-sm"
                                  style={{
                                    background: `linear-gradient(135deg, ${tier.gradient_from}, ${tier.gradient_via}, ${tier.gradient_to})`,
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                  }}
                                >
                                  {tier.tier_name}
                                </div>
                              </div>
                            )}
                          </div>

                          {viewer.pac !== undefined && (
                            <div className="grid grid-cols-6 gap-2 mt-4">
                              {[
                                { label: 'PAC', value: viewer.pac },
                                { label: 'SHO', value: viewer.sho },
                                { label: 'PAS', value: viewer.pas },
                                { label: 'DRI', value: viewer.dri },
                                { label: 'DEF', value: viewer.def },
                                { label: 'PHY', value: viewer.phy },
                              ].map((stat) => (
                                <div key={stat.label} className="text-center">
                                  <div className="text-white/60 text-xs mb-1">{stat.label}</div>
                                  <div className="text-white font-bold text-sm">{stat.value}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => navigate(`/profile/${viewer.username}`)}
                            className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            View Profile
                          </button>
                          <button
                            onClick={() => handleSendFriendRequest(viewer.viewer_id)}
                            disabled={sendingRequest === viewer.viewer_id}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                          >
                            {sendingRequest === viewer.viewer_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <UserPlus className="w-4 h-4" />
                            )}
                            Add Friend
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <span className="text-white font-semibold">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}