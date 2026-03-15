import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, AlertCircle, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { ShimmerBar } from '../components/ui/Shimmer';
import { useAuth } from '../contexts/AuthContext';

type Category = 'premier_league' | 'womens' | 'transfers' | 'general' | 'results';

interface NewsArticle {
  id: string;
  title: string;
  content: string | null;
  category: Category;
  likes_count: number;
  published_at: string | null;
  created_at: string;
}

const CATEGORY_STYLES: Record<Category, { label: string; className: string }> = {
  premier_league: { label: 'Premier League', className: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' },
  womens:         { label: "Women's",         className: 'bg-pink-500/20 text-pink-300 border border-pink-500/30' },
  transfers:      { label: 'Transfers',        className: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' },
  general:        { label: 'General',          className: 'bg-green-500/20 text-green-300 border border-green-500/30' },
  results:        { label: 'Results',          className: 'bg-orange-500/20 text-orange-300 border border-orange-500/30' },
};

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function ArticleSkeleton() {
  return (
    <div className="glass-card p-4 space-y-3">
      <ShimmerBar className="h-3 w-1/4 rounded-full" />
      <ShimmerBar className="h-5 w-3/4 rounded-md" />
      <ShimmerBar className="h-3 w-full rounded-md" />
      <ShimmerBar className="h-3 w-5/6 rounded-md" />
      <ShimmerBar className="h-3 w-2/3 rounded-md" />
    </div>
  );
}

interface ArticleCardProps {
  article: NewsArticle;
  liked: boolean;
  onToggleLike: (articleId: string, currentlyLiked: boolean) => void;
  loggedIn: boolean;
}

function ArticleCard({ article, liked, onToggleLike, loggedIn }: ArticleCardProps) {
  const cat = CATEGORY_STYLES[article.category] ?? CATEGORY_STYLES.general;

  return (
    <div className="glass-card p-4 space-y-3">
      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${cat.className}`}>
        {cat.label}
      </span>

      <h2 className="text-white font-bold text-lg leading-snug">{article.title}</h2>

      {article.content && (
        <p className="text-[#B0B8C8] text-sm leading-relaxed">{article.content}</p>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-[#B0B8C8] text-xs">
          {formatRelativeTime(article.published_at)}
        </span>

        <button
          onClick={() => loggedIn && onToggleLike(article.id, liked)}
          disabled={!loggedIn}
          aria-label={liked ? 'Unlike' : 'Like'}
          className={`flex items-center gap-1.5 text-sm transition-colors ${
            !loggedIn
              ? 'text-gray-600 cursor-not-allowed'
              : liked
              ? 'text-pink-400 hover:text-pink-300'
              : 'text-[#B0B8C8] hover:text-pink-400'
          }`}
        >
          <Heart
            className="w-4 h-4"
            fill={liked ? 'currentColor' : 'none'}
            strokeWidth={liked ? 0 : 1.5}
          />
          <span>{article.likes_count}</span>
        </button>
      </div>
    </div>
  );
}

export default function News() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchArticles = useCallback(async () => {
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('news_articles')
        .select('id, title, content, category, likes_count, published_at, created_at')
        .order('published_at', { ascending: false });

      if (fetchError) throw fetchError;
      setArticles((data as NewsArticle[]) ?? []);

      if (user) {
        const { data: likesData } = await supabase
          .from('news_likes')
          .select('article_id')
          .eq('user_id', user.id);

        setLikedIds(new Set((likesData ?? []).map((r: { article_id: string }) => r.article_id)));
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setLoading(true);
    try {
      await fetchArticles();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, fetchArticles]);

  const handleToggleLike = useCallback(async (articleId: string, currentlyLiked: boolean) => {
    if (!user) return;

    setLikedIds(prev => {
      const next = new Set(prev);
      if (currentlyLiked) next.delete(articleId);
      else next.add(articleId);
      return next;
    });

    setArticles(prev =>
      prev.map(a =>
        a.id === articleId
          ? { ...a, likes_count: Math.max(0, a.likes_count + (currentlyLiked ? -1 : 1)) }
          : a
      )
    );

    try {
      if (currentlyLiked) {
        const { error: delErr } = await supabase
          .from('news_likes')
          .delete()
          .eq('article_id', articleId)
          .eq('user_id', user.id);
        if (delErr) throw delErr;
      } else {
        const { error: insErr } = await supabase
          .from('news_likes')
          .insert({ article_id: articleId, user_id: user.id });
        if (insErr) throw insErr;
      }
    } catch {
      setLikedIds(prev => {
        const next = new Set(prev);
        if (currentlyLiked) next.add(articleId);
        else next.delete(articleId);
        return next;
      });
      setArticles(prev =>
        prev.map(a =>
          a.id === articleId
            ? { ...a, likes_count: Math.max(0, a.likes_count + (currentlyLiked ? 1 : -1)) }
            : a
        )
      );
    }
  }, [user]);

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

  return (
    <div
      className="min-h-screen"
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
            <h1 className="text-xl font-bold text-white">News</h1>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="ml-auto text-[#B0B8C8] hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-4">
        {loading && !error && (
          <>
            <ArticleSkeleton />
            <ArticleSkeleton />
            <ArticleSkeleton />
          </>
        )}

        {error && !loading && (
          <div className="glass-card p-6 flex flex-col items-center gap-4 text-center">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <p className="text-[#B0B8C8] text-sm">{error}</p>
            <button
              onClick={handleRefresh}
              className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        )}

        {!loading && !error && articles.length === 0 && (
          <div className="glass-card p-8 text-center">
            <p className="text-[#B0B8C8] text-sm">No articles yet. Check back soon.</p>
          </div>
        )}

        {!loading && !error && articles.map(article => (
          <ArticleCard
            key={article.id}
            article={article}
            liked={likedIds.has(article.id)}
            onToggleLike={handleToggleLike}
            loggedIn={!!user}
          />
        ))}
      </main>
    </div>
  );
}
