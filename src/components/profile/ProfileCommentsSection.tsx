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
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl p-6 border border-cyan-500/20">
      <h3 className="text-xl font-bold text-white mb-4">
        Comments ({comments.length})
      </h3>

      {!canComment && (
        <div className="mb-4 p-4 bg-gray-800/50 rounded-lg flex items-start gap-3">
          <Lock className="w-5 h-5 text-gray-400 mt-0.5" />
          <p className="text-gray-400 text-sm">
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
              className="w-full p-4 bg-gray-800/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 resize-none"
            />
            {commentError && (
              <div className="mt-2 p-3 bg-red-900/20 border border-red-500/50 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-red-400 text-sm">{commentError}</p>
              </div>
            )}
            {coinEarned && (
              <div className="mt-2 p-3 bg-green-900/20 border border-green-500/50 rounded-lg flex items-center gap-2">
                <Coins className="w-5 h-5 text-green-400" />
                <p className="text-green-400 text-sm font-semibold">
                  You earned {coinEarned} coin{coinEarned !== 1 ? 's' : ''} for this comment
                </p>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-gray-500 text-sm">{newComment.length}/500</span>
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No comments yet</p>
        ) : (
          comments.map((comment) => {
            const vote = commentVotes[comment.id];
            return (
              <div
                key={comment.id}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <span className="text-white font-semibold">{comment.username}</span>
                    <span className="text-gray-500 text-sm ml-2">
                      {formatDistanceToNow(comment.created_at)}
                    </span>
                  </div>
                </div>
                <p className="text-gray-300 mb-3">{comment.content}</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onCommentVote(comment.id, true)}
                    disabled={isPreviewMode}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                      vote?.is_upvote
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-green-600/10 hover:text-green-400'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    <span className="text-sm">{comment.upvotes}</span>
                  </button>
                  <button
                    onClick={() => onCommentVote(comment.id, false)}
                    disabled={isPreviewMode}
                    className={`flex items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                      vote && !vote.is_upvote
                        ? 'bg-red-600/20 text-red-400'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-red-600/10 hover:text-red-400'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    <span className="text-sm">{comment.downvotes}</span>
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
