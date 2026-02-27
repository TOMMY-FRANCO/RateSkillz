import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Send, Lock, AlertTriangle, Coins } from 'lucide-react';
import type { FriendStatus } from '../../hooks/useProfileData';

interface Comment {
  id: string;
  profile_id: string;
  user_id: string;
  content: string;
  upvotes: number;
  downvotes: number;
  username: string;
  created_at: string;
}

interface ProfileCommentsSectionProps {
  isOwner: boolean;
  isPreviewMode: boolean;
  friendStatus: FriendStatus;
  comments: Comment[];
  commentVotes: Record<string, { is_upvote: boolean; vote_id: string }>;
  commentError: string;
  submitting: boolean;
  coinEarned: number | null;
  onSubmitComment: (comment: string) => void;
  onCommentVote: (commentId: string, isUpvote: boolean) => void;
}

function formatDistanceToNow(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

export default function ProfileCommentsSection({
  isOwner,
  isPreviewMode,
  friendStatus,
  comments,
  commentVotes,
  commentError,
  submitting,
  coinEarned,
  onSubmitComment,
  onCommentVote,
}: ProfileCommentsSectionProps) {
  const [newComment, setNewComment] = useState('');

  const canComment = friendStatus === 'accepted' && !isOwner && !isPreviewMode;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    onSubmitComment(newComment);
    setNewComment('');
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 backdrop-blur-sm rounded-3xl p-5 sm:p-6 border border-cyan-500/20">
      <h3 className="text-lg sm:text-xl font-bold text-white mb-5 tracking-wide">
        Comments ({comments.length})
      </h3>

      {!canComment && (
        <div className="mb-5 p-4 bg-slate-800/60 rounded-2xl flex items-start gap-3 border border-slate-700/50">
          <div className="w-9 h-9 rounded-xl bg-slate-700/50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Lock className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-slate-400 text-sm leading-relaxed">
            {isOwner
              ? 'You cannot comment on your own profile'
              : isPreviewMode
              ? 'Comments disabled in preview mode'
              : 'Only friends can comment on this profile'}
          </p>
        </div>
      )}

      {canComment && (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="relative">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              rows={3}
              maxLength={500}
              className="w-full p-4 bg-slate-800/60 border border-slate-700/50 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 resize-none transition-all"
            />
            {commentError && (
              <div className="mt-3 p-3.5 bg-red-900/20 border border-red-500/30 rounded-xl flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-400 text-sm">{commentError}</p>
              </div>
            )}
            {coinEarned && (
              <div className="mt-3 p-3.5 bg-green-900/20 border border-green-500/30 rounded-xl flex items-center gap-2">
                <Coins className="w-5 h-5 text-green-400" />
                <p className="text-green-400 text-sm font-semibold">
                  You earned {coinEarned} coin{coinEarned !== 1 ? 's' : ''} for this comment
                </p>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-slate-500 text-sm">{newComment.length}/500</span>
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-cyan-500/20 hover:shadow-xl hover:shadow-cyan-500/30"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-slate-500 text-center py-8">No comments yet</p>
        ) : (
          comments.map((comment) => {
            const vote = commentVotes[comment.id];
            return (
              <div
                key={comment.id}
                className="bg-slate-800/60 rounded-2xl p-4 border border-slate-700/50 hover:border-slate-600/50 transition-all"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-white font-semibold">{comment.username}</span>
                    <span className="text-slate-500 text-sm ml-2">
                      {formatDistanceToNow(comment.created_at)}
                    </span>
                  </div>
                </div>
                <p className="text-slate-300 mb-3 leading-relaxed">{comment.content}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onCommentVote(comment.id, true)}
                    disabled={isPreviewMode}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                      vote?.is_upvote
                        ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                        : 'bg-slate-700/50 text-slate-400 hover:bg-green-500/10 hover:text-green-400 border border-transparent hover:border-green-500/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="text-sm font-medium">{comment.upvotes}</span>
                  </button>
                  <button
                    onClick={() => onCommentVote(comment.id, false)}
                    disabled={isPreviewMode}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all ${
                      vote && !vote.is_upvote
                        ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                        : 'bg-slate-700/50 text-slate-400 hover:bg-red-500/10 hover:text-red-400 border border-transparent hover:border-red-500/20'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                    <span className="text-sm font-medium">{comment.downvotes}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
