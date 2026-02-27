import { useNavigate } from 'react-router-dom';
import { ThumbsUp, ThumbsDown, MessageCircle, UserPlus, UserCheck, UserX, Clock, Flag } from 'lucide-react';
import type { FriendStatus } from '../../hooks/useProfileData';

interface ProfileActionButtonsProps {
  isOwner: boolean;
  isEditingEnabled: boolean;
  friendStatus: FriendStatus;
  likes: number;
  dislikes: number;
  userVote: boolean | null;
  currentUserId?: string;
  profileId: string;
  onVote: (isLike: boolean) => void;
  onFriendRequest: () => void;
  onReport: () => void;
}

export default function ProfileActionButtons({
  isOwner,
  isEditingEnabled,
  friendStatus,
  likes,
  dislikes,
  userVote,
  currentUserId,
  profileId,
  onVote,
  onFriendRequest,
  onReport,
}: ProfileActionButtonsProps) {
  const navigate = useNavigate();

  const canVote = friendStatus === 'accepted';

  const handleMessage = async () => {
    if (!currentUserId || !profileId) return;

    const { getOrCreateConversation } = await import('../../lib/messaging');
    const conversationId = await getOrCreateConversation(currentUserId, profileId);
    if (conversationId) {
      navigate(`/chat/${conversationId}`);
    }
  };

  const getFriendButtonText = () => {
    switch (friendStatus) {
      case 'pending_sent':
        return 'Cancel Request';
      case 'pending_received':
        return 'Accept Request';
      case 'accepted':
        return 'Remove Friend';
      default:
        return 'Add Friend';
    }
  };

  const getFriendButtonIcon = () => {
    switch (friendStatus) {
      case 'pending_sent':
        return <Clock className="w-5 h-5" />;
      case 'pending_received':
        return <UserCheck className="w-5 h-5" />;
      case 'accepted':
        return <UserX className="w-5 h-5" />;
      default:
        return <UserPlus className="w-5 h-5" />;
    }
  };

  const getFriendButtonClass = () => {
    if (friendStatus === 'accepted') {
      return 'bg-red-600/10 text-red-400 border border-red-600/30 hover:bg-red-600/20';
    }
    if (friendStatus === 'pending_sent') {
      return 'bg-yellow-600/10 text-yellow-400 border border-yellow-600/30 hover:bg-yellow-600/20';
    }
    if (friendStatus === 'pending_received') {
      return 'bg-green-600/10 text-green-400 border border-green-600/30 hover:bg-green-600/20';
    }
    return 'bg-cyan-600/10 text-cyan-400 border border-cyan-600/30 hover:bg-cyan-600/20';
  };

  if (isOwner) return null;

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 backdrop-blur-sm rounded-3xl p-5 sm:p-6 mb-6 border border-cyan-500/20">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => onVote(true)}
          disabled={!canVote}
          className={`flex-1 min-w-[120px] py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold ${
            canVote
              ? userVote === true
                ? 'bg-green-500/15 text-green-400 border-2 border-green-500/40 shadow-lg shadow-green-500/10'
                : 'bg-slate-800/60 text-slate-300 hover:bg-green-500/10 hover:text-green-400 border border-slate-700/50 hover:border-green-500/30'
              : 'bg-slate-800/30 text-slate-600 cursor-not-allowed border border-slate-800/50'
          }`}
        >
          <ThumbsUp className="w-5 h-5" />
          <span>{likes}</span>
        </button>

        <button
          onClick={() => onVote(false)}
          disabled={!canVote}
          className={`flex-1 min-w-[120px] py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold ${
            canVote
              ? userVote === false
                ? 'bg-red-500/15 text-red-400 border-2 border-red-500/40 shadow-lg shadow-red-500/10'
                : 'bg-slate-800/60 text-slate-300 hover:bg-red-500/10 hover:text-red-400 border border-slate-700/50 hover:border-red-500/30'
              : 'bg-slate-800/30 text-slate-600 cursor-not-allowed border border-slate-800/50'
          }`}
        >
          <ThumbsDown className="w-5 h-5" />
          <span>{dislikes}</span>
        </button>

        {friendStatus === 'accepted' && (
          <button
            onClick={handleMessage}
            className="flex-1 min-w-[120px] py-3.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all flex items-center justify-center gap-2 font-semibold"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Message</span>
          </button>
        )}

        <button
          onClick={onFriendRequest}
          className={`flex-1 min-w-[120px] py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 font-semibold ${getFriendButtonClass()}`}
        >
          {getFriendButtonIcon()}
          <span>{getFriendButtonText()}</span>
        </button>

        <button
          onClick={onReport}
          className="py-3.5 px-5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 hover:border-red-500/40 transition-all flex items-center justify-center gap-2 font-semibold"
        >
          <Flag className="w-5 h-5" />
          <span>Report</span>
        </button>
      </div>

      {!canVote && (
        <p className="text-yellow-400/80 text-sm mt-4 text-center">
          You must be friends to like/dislike this profile
        </p>
      )}
    </div>
  );
}
