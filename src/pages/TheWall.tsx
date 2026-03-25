import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, RefreshCw, Send, AlertCircle, ChevronDown, ThumbsUp, ThumbsDown, Flag, X } from 'lucide-react';
import { DefaultAvatar } from '../components/ui/DefaultAvatar';
import { useToast } from '../contexts/ToastContext';
import { ShimmerBar } from '../components/ui/Shimmer';

const REPORT_REASONS = ['Hate Speech', 'Bullying/Harassment', 'Spam', 'Inappropriate Content', 'Other'] as const;
type ReportReason = typeof REPORT_REASONS[number];

interface WallPost {
  id: string;
  user_id: string;
  content: string;
  wall_date: string;
  week_start?: string;
  created_at: string;
  username?: string;
  avatar_url?: string | null;
  likes_count: number;
  dislikes_count: number;
  coins_earned: number;
  media_url?: string | null;
  media_type?: string | null;
}

const PAGE_SIZE = 20;

function getUKWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  return monday.toISOString().slice(0, 10);
}

function getTimeUntilMonday(): string {
  const now = new Date();
  const day = now.getDay();
  const daysUntil = day === 0 ? 1 : 8 - day;
  const next = new Date(now);
  next.setDate(now.getDate() + daysUntil);
  next.setHours(0, 0, 0, 0);
  const diff = next.getTime() - now.getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${d}d ${h}h ${m}m`;
}

function relativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function PostSkeleton() {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center space-x-3">
        <ShimmerBar className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <ShimmerBar className="h-3 w-32 rounded" />
          <ShimmerBar className="h-2 w-20 rounded" />
        </div>
      </div>
      <ShimmerBar className="h-3 w-full rounded" />
      <ShimmerBar className="h-3 w-3/4 rounded" />
      <div className="flex gap-2 pt-1">
        <ShimmerBar className="h-8 w-20 rounded-lg" />
        <ShimmerBar className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  );
}

export default function TheWall() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [posts, setPosts] = useState<WallPost[]>([]);
  const [userReactions, setUserReactions] = useState<Map<string, boolean>>(new Map());
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const [posting, setPosting] = useState(false);
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'tiktok' | 'twitter' | 'facebook' | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const [reportModalPostId, setReportModalPostId] = useState<string | null>(null);
  const [reportingPostId, setReportingPostId] = useState<string | null>(null);
  const [reportedPostIds, setReportedPostIds] = useState<Set<string>>(new Set());

  const weekStart = getUKWeekStart();
  const charsLeft = 280 - content.length;
  const hasPostedThisWeek = posts.some(p => p.user_id === user?.id && (p.week_start === weekStart || p.wall_date === weekStart));

  function detectMediaType(url: string): 'tiktok' | 'twitter' | 'facebook' | null {
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'twitter';
    if (url.includes('facebook.com') || url.includes('fb.watch')) return 'facebook';
    return null;
  }

  const fetchPosts = useCallback(async (from = 0): Promise<WallPost[]> => {
    const { data, error } = await supabase
      .from('wall_posts')
      .select('id, user_id, content, wall_date, week_start, created_at, username, avatar_url, likes_count, dislikes_count, coins_earned, media_url, media_type')
      .eq('week_start', weekStart)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    return (data as WallPost[]) || [];
  }, [weekStart]);

  const fetchUserReactions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('wall_reactions')
      .select('post_id, is_like')
      .eq('user_id', user.id);

    if (data) {
      const map = new Map<string, boolean>();
      (data as { post_id: string; is_like: boolean }[]).forEach(r => map.set(r.post_id, r.is_like));
      setUserReactions(map);
    }
  }, [user]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const data = await fetchPosts(0);
      setPosts(data);
      setAllLoaded(data.length < PAGE_SIZE);
      await fetchUserReactions();
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchPosts, fetchUserReactions]);

  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
      return;
    }
    loadInitial();
  }, [user]);

  useEffect(() => {
    if (mediaType === 'twitter') {
      if (!document.querySelector('script[src="https://platform.twitter.com/widgets.js"]')) {
        const s = document.createElement('script');
        s.src = 'https://platform.twitter.com/widgets.js';
        s.async = true;
        document.body.appendChild(s);
      }
    } else if (mediaType === 'tiktok') {
      if (!document.querySelector('script[src="https://www.tiktok.com/embed.js"]')) {
        const s = document.createElement('script');
        s.src = 'https://www.tiktok.com/embed.js';
        s.async = true;
        document.body.appendChild(s);
      }
    }
  }, [mediaType]);

  useEffect(() => {
    const hasTwitter = posts.some(p => p.media_type === 'twitter');
    const hasTiktok = posts.some(p => p.media_type === 'tiktok');
    if (hasTwitter && !document.querySelector('script[src="https://platform.twitter.com/widgets.js"]')) {
      const s = document.createElement('script');
      s.src = 'https://platform.twitter.com/widgets.js';
      s.async = true;
      document.body.appendChild(s);
    }
    if (hasTiktok && !document.querySelector('script[src="https://www.tiktok.com/embed.js"]')) {
      const s = document.createElement('script');
      s.src = 'https://www.tiktok.com/embed.js';
      s.async = true;
      document.body.appendChild(s);
    }
  }, [posts]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const data = await fetchPosts(0);
      setPosts(data);
      setAllLoaded(data.length < PAGE_SIZE);
      await fetchUserReactions();
    } catch {
      toast.error('Failed to refresh posts.');
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, fetchPosts, fetchUserReactions]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === 0 || isRefreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && containerRef.current && containerRef.current.scrollTop === 0) {
      setPullDistance(Math.min(diff, 100));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 60 && !isRefreshing) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  };

  const handleLoadMore = async () => {
    if (loadingMore || allLoaded) return;
    setLoadingMore(true);
    try {
      const data = await fetchPosts(posts.length);
      setPosts(prev => [...prev, ...data]);
      setAllLoaded(data.length < PAGE_SIZE);
    } catch {
      toast.error('Failed to load more posts.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleReport = async (postId: string, reason: ReportReason) => {
    if (!user || reportingPostId === postId) return;
    setReportingPostId(postId);
    try {
      const { error } = await supabase
        .from('wall_post_reports')
        .insert({ post_id: postId, reporter_id: user.id, reason, status: 'pending' });
      if (error) throw error;
      setReportedPostIds(prev => new Set(prev).add(postId));
      setReportModalPostId(null);
      toast.success('Post reported');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit report');
    } finally {
      setReportingPostId(null);
    }
  };

  const handlePost = async () => {
    if (!user || (!content.trim() && !mediaUrl) || posting || hasPostedThisWeek) return;
    const trimmedContent = content.trim();

    const { data: filterData } = await supabase
      .from('profanity_filter')
      .select('word, pattern')
      .eq('is_active', true);

    if (filterData && filterData.length > 0) {
      const lower = trimmedContent.toLowerCase();
      const hasProfanity = filterData.some((entry: { word: string; pattern: string | null }) => {
        if (entry.pattern) {
          try {
            return new RegExp(entry.pattern, 'i').test(trimmedContent);
          } catch {
            return false;
          }
        }
        return lower.includes(entry.word.toLowerCase());
      });
      if (hasProfanity) {
        toast.error('Your post contains inappropriate language');
        return;
      }
    }

    setPosting(true);
    try {
      const { data, error } = await supabase.rpc('post_to_wall', {
        p_user_id: user.id,
        p_content: trimmedContent,
        p_media_url: mediaUrl || null,
        p_media_type: mediaType || null,
      });
      if (error) throw error;
      const newPost: WallPost = {
        id: data?.id || `${Date.now()}`,
        user_id: user.id,
        content: trimmedContent,
        wall_date: weekStart,
        week_start: weekStart,
        created_at: new Date().toISOString(),
        username: profile?.username || undefined,
        avatar_url: profile?.avatar_url || null,
        likes_count: 0,
        dislikes_count: 0,
        coins_earned: 0,
        ...data,
      };
      setPosts(prev => [newPost, ...prev]);
      setContent('');
      setMediaUrl('');
      setMediaType(null);
      toast.success('Posted to The Wall!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to post. You may not have enough coins.');
    } finally {
      setPosting(false);
    }
  };

  const handleReact = async (postId: string, isLike: boolean) => {
    if (!user || reactingTo === postId) return;
    setReactingTo(postId);
    try {
      const { error } = await supabase.rpc('react_to_wall_post', {
        p_user_id: user.id,
        p_post_id: postId,
        p_is_like: isLike,
      });
      if (error) throw error;
      setUserReactions(prev => {
        const next = new Map(prev);
        next.set(postId, isLike);
        return next;
      });
      setPosts(prev =>
        prev.map(p => {
          if (p.id !== postId) return p;
          return {
            ...p,
            likes_count: isLike ? p.likes_count + 1 : p.likes_count,
            dislikes_count: !isLike ? p.dislikes_count + 1 : p.dislikes_count,
          };
        })
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to react.');
    } finally {
      setReactingTo(null);
    }
  };

  return (
    <div
      className="min-h-screen pb-24"
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center bg-gradient-to-b from-gray-900/90 to-transparent"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 100 }}
        >
          <RefreshCw className={`w-6 h-6 text-white ${isRefreshing ? 'animate-spin' : ''}`} />
        </div>
      )}

      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-white">The Wall</h1>
            <button
              onClick={handleRefresh}
              className="ml-auto text-[#B0B8C8] hover:text-[#00E0FF] transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-4">

        <div className="glass-card p-4 space-y-2">
          <p className="text-[#B0B8C8] text-sm leading-relaxed">
            The Wall is where the community speaks. Share your skills, drop a trick clip from TikTok, X or Facebook, and let the world react. One post per week — make it count.
          </p>
          <p className="text-[#00E0FF] text-xs font-semibold">
            Next reset in: {getTimeUntilMonday()}
          </p>
        </div>

        <div className="glass-card p-4 space-y-3">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value.slice(0, 280))}
            placeholder={hasPostedThisWeek ? "You've already posted this week. Come back next Monday!" : "What's on your mind this week?"}
            disabled={hasPostedThisWeek}
            rows={3}
            className="w-full bg-transparent text-white placeholder-[#B0B8C8] text-sm resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {!hasPostedThisWeek && (
            <div className="border-t border-white/10 pt-3 space-y-2">
              <input
                type="url"
                value={mediaUrl}
                onChange={e => {
                  const val = e.target.value;
                  setMediaUrl(val);
                  setMediaType(val ? detectMediaType(val) : null);
                }}
                placeholder="Paste a TikTok, X or Facebook link (optional)"
                className="w-full bg-transparent text-white placeholder-[#B0B8C8] text-sm focus:outline-none"
              />
              {mediaUrl && mediaType === null && (
                <p className="text-red-400 text-xs">Unrecognised link — only TikTok, X and Facebook links are supported</p>
              )}
              {mediaUrl && mediaType !== null && (
                <div className="space-y-2">
                  <p className="text-[#B0B8C8] text-xs">Preview</p>
                  {mediaType === 'twitter' && (
                    <blockquote className="twitter-tweet">
                      <a href={mediaUrl}>{mediaUrl}</a>
                    </blockquote>
                  )}
                  {mediaType === 'tiktok' && (
                    <blockquote className="tiktok-embed" cite={mediaUrl}></blockquote>
                  )}
                  {mediaType === 'facebook' && (
                    <div className="text-[#B0B8C8] text-sm flex items-center gap-2">
                      <span>📘</span>
                      <span className="truncate">{mediaUrl}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium ${charsLeft < 20 ? 'text-red-400' : 'text-[#B0B8C8]'}`}>
                {charsLeft} left
              </span>
              <span className="text-xs text-[#B0B8C8]">
                Costs <span className="text-[#FFD700] font-semibold">30 coins</span> to post
              </span>
            </div>
            <button
              onClick={handlePost}
              disabled={(!content.trim() && !mediaUrl) || posting || hasPostedThisWeek || charsLeft < 0}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#00E0FF] to-[#0099BB] text-black font-semibold text-sm rounded-xl transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {posting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Post
            </button>
          </div>
          {hasPostedThisWeek && (
            <p className="text-xs text-[#00E0FF]/80 text-center">
              One post per week — your post is live on The Wall.
            </p>
          )}
        </div>

        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <PostSkeleton key={i} />
            ))}
          </div>
        )}

        {!loading && fetchError && (
          <div className="glass-card p-6 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-[#B0B8C8] text-sm">Failed to load posts.</p>
            <button
              onClick={loadInitial}
              className="px-4 py-2 bg-gradient-to-r from-[#00E0FF] to-[#0099BB] text-black font-semibold text-sm rounded-xl hover:opacity-90 transition-all"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !fetchError && posts.length === 0 && (
          <div className="glass-card p-8 text-center">
            <p className="text-[#B0B8C8] text-sm">No posts yet this week. Be the first!</p>
          </div>
        )}

        {!loading && !fetchError && posts.length > 0 && (
          <div className="space-y-3">
            {posts.map(post => {
              const isOwnPost = post.user_id === user?.id;
              const hasReacted = userReactions.has(post.id);
              const reactionValue = userReactions.get(post.id);
              const isSubmitting = reactingTo === post.id;
              const reactionDisabled = isOwnPost || hasReacted || isSubmitting;

              return (
                <div key={post.id} className="glass-card p-4 space-y-3">
                  <div className="flex items-center space-x-3">
                    {post.avatar_url ? (
                      <img
                        src={post.avatar_url}
                        alt={post.username || 'User'}
                        className="w-10 h-10 rounded-full object-cover border border-white/10 flex-shrink-0"
                      />
                    ) : (
                      <DefaultAvatar size={40} className="rounded-full border border-white/10 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">
                        {post.username || 'Anonymous'}
                      </p>
                      <p className="text-[#B0B8C8] text-xs">
                        {relativeTime(post.created_at)}
                      </p>
                    </div>
                    {post.coins_earned > 0 && (
                      <span className="text-yellow-400 text-xs font-semibold flex-shrink-0">
                        +{post.coins_earned} coins
                      </span>
                    )}
                  </div>

                  <p className="text-white text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {post.content}
                  </p>

                  {post.media_type === 'twitter' && post.media_url && (
                    <blockquote className="twitter-tweet">
                      <a href={post.media_url}></a>
                    </blockquote>
                  )}
                  {post.media_type === 'tiktok' && post.media_url && (
                    <blockquote className="tiktok-embed" cite={post.media_url}></blockquote>
                  )}
                  {post.media_type === 'facebook' && post.media_url && (
                    <div className="glass-card p-3 flex items-center gap-2">
                      <span>📘</span>
                      <a
                        href={post.media_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#00E0FF] text-sm truncate"
                      >
                        {post.media_url}
                      </a>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleReact(post.id, true)}
                      disabled={reactionDisabled}
                      title={isOwnPost ? 'You cannot react to your own post' : undefined}
                      className={[
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                        reactionValue === true
                          ? 'bg-[rgba(0,255,133,0.3)] border-[#00FF85] text-[#00FF85]'
                          : 'bg-[rgba(0,255,133,0.1)] border-[rgba(0,255,133,0.2)] text-[#00FF85]',
                        reactionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[rgba(0,255,133,0.2)]',
                      ].join(' ')}
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ThumbsUp className="w-3.5 h-3.5" />
                      )}
                      <span>{post.likes_count}</span>
                    </button>

                    <button
                      onClick={() => handleReact(post.id, false)}
                      disabled={reactionDisabled}
                      title={isOwnPost ? 'You cannot react to your own post' : undefined}
                      className={[
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                        reactionValue === false
                          ? 'bg-[rgba(255,100,100,0.3)] border-red-400 text-red-400'
                          : 'bg-[rgba(255,100,100,0.1)] border-red-500/20 text-red-400',
                        reactionDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[rgba(255,100,100,0.2)]',
                      ].join(' ')}
                    >
                      {isSubmitting ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ThumbsDown className="w-3.5 h-3.5" />
                      )}
                      <span>{post.dislikes_count}</span>
                    </button>

                    {!isOwnPost && (
                      <button
                        onClick={() => setReportModalPostId(post.id)}
                        disabled={reportedPostIds.has(post.id)}
                        title={reportedPostIds.has(post.id) ? 'Already reported' : 'Report post'}
                        className={[
                          'ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm border transition-all',
                          reportedPostIds.has(post.id)
                            ? 'bg-[rgba(239,68,68,0.1)] border-red-500/20 text-red-400/50 cursor-not-allowed'
                            : 'bg-transparent border-transparent text-[#B0B8C8] hover:text-red-400 hover:border-red-500/30 hover:bg-[rgba(239,68,68,0.08)]',
                        ].join(' ')}
                      >
                        <Flag className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {!allLoaded && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full glass-card p-3 flex items-center justify-center gap-2 text-[#B0B8C8] hover:text-white transition-colors text-sm"
              >
                {loadingMore ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            )}

            {allLoaded && posts.length > 0 && (
              <p className="text-center text-[#B0B8C8] text-xs py-2">
                All posts loaded
              </p>
            )}
          </div>
        )}
      </main>

      {reportModalPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="glass-card w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base">Report Post</h3>
              <button
                onClick={() => setReportModalPostId(null)}
                className="text-[#B0B8C8] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-[#B0B8C8] text-sm">Select a reason for reporting this post:</p>
            <div className="space-y-2">
              {REPORT_REASONS.map(reason => (
                <button
                  key={reason}
                  onClick={() => handleReport(reportModalPostId, reason)}
                  disabled={reportingPostId === reportModalPostId}
                  className="w-full text-left px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm hover:border-red-500/40 hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {reportingPostId === reportModalPostId ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Submitting...
                    </span>
                  ) : reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => setReportModalPostId(null)}
              className="w-full py-2 text-sm text-[#B0B8C8] hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
