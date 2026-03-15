import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, RefreshCw, Send, AlertCircle, ChevronDown } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { ShimmerBar } from '../components/ui/Shimmer';

interface WallPost {
  id: string;
  user_id: string;
  content: string;
  wall_date: string;
  created_at: string;
  username?: string;
  avatar_url?: string | null;
}

interface WallReaction {
  post_id: string;
  reaction_type: string;
}

const PAGE_SIZE = 20;

function getTodayDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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
    </div>
  );
}

export default function TheWall() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [posts, setPosts] = useState<WallPost[]>([]);
  const [userReactions, setUserReactions] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);
  const [posting, setPosting] = useState(false);
  const [content, setContent] = useState('');

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = getTodayDate();
  const charsLeft = 280 - content.length;
  const hasPostedToday = posts.some(p => p.user_id === user?.id && p.wall_date === today);

  const fetchPosts = useCallback(async (from = 0): Promise<WallPost[]> => {
    const { data, error } = await supabase
      .from('wall_posts')
      .select('id, user_id, content, wall_date, created_at, username, avatar_url')
      .eq('wall_date', today)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    return (data as WallPost[]) || [];
  }, [today]);

  const fetchUserReactions = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('wall_reactions')
      .select('post_id, reaction_type')
      .eq('user_id', user.id);

    if (data) {
      const map = new Map<string, string>();
      (data as WallReaction[]).forEach(r => map.set(r.post_id, r.reaction_type));
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

  const handlePost = async () => {
    if (!user || !content.trim() || posting || hasPostedToday) return;
    setPosting(true);
    try {
      const { data, error } = await supabase.rpc('post_to_wall', {
        p_user_id: user.id,
        p_content: content.trim(),
      });
      if (error) throw error;
      const newPost: WallPost = {
        id: data?.id || `${Date.now()}`,
        user_id: user.id,
        content: content.trim(),
        wall_date: today,
        created_at: new Date().toISOString(),
        username: profile?.username || undefined,
        avatar_url: profile?.avatar_url || null,
        ...data,
      };
      setPosts(prev => [newPost, ...prev]);
      setContent('');
      toast.success('Posted to The Wall!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to post. You may not have enough coins.');
    } finally {
      setPosting(false);
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

        <div className="glass-card p-4 space-y-3">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value.slice(0, 280))}
            placeholder={hasPostedToday ? "You've already posted today. Come back tomorrow!" : "What's on your mind today?"}
            disabled={hasPostedToday}
            rows={3}
            className="w-full bg-transparent text-white placeholder-[#B0B8C8] text-sm resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
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
              disabled={!content.trim() || posting || hasPostedToday || charsLeft < 0}
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
          {hasPostedToday && (
            <p className="text-xs text-[#00E0FF]/80 text-center">
              One post per day — your post is live on The Wall.
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
            <p className="text-[#B0B8C8] text-sm">No posts yet today. Be the first!</p>
          </div>
        )}

        {!loading && !fetchError && posts.length > 0 && (
          <div className="space-y-3">
            {posts.map(post => (
              <div key={post.id} className="glass-card p-4 space-y-2">
                <div className="flex items-center space-x-3">
                  {post.avatar_url ? (
                    <img
                      src={post.avatar_url}
                      alt={post.username || 'User'}
                      className="w-10 h-10 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00E0FF]/30 to-[#0099BB]/30 flex items-center justify-center border border-white/10">
                      <span className="text-white font-bold text-sm">
                        {(post.username || '?')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="text-white font-semibold text-sm">
                      {post.username || 'Anonymous'}
                    </p>
                    <p className="text-[#B0B8C8] text-xs">
                      {new Date(post.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {userReactions.has(post.id) && (
                    <span className="ml-auto text-lg">{userReactions.get(post.id)}</span>
                  )}
                </div>
                <p className="text-[#D0D8E8] text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {post.content}
                </p>
              </div>
            ))}

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
    </div>
  );
}
