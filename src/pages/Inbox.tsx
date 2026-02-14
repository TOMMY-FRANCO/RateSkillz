import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Conversation, getUserConversations, formatTimestamp } from '../lib/messaging';
import { MessageCircle, ArrowLeft, User, RefreshCw } from 'lucide-react';
import { displayUsername } from '../lib/username';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../components/ui/Shimmer';
import { SkeletonAvatar } from '../components/ui/SkeletonPresets';
import { getMultipleUserPresence, type UserPresence } from '../lib/presence';
import OnlineStatus from '../components/OnlineStatus';
import { markNotificationsReadBatch } from '../lib/notifications';

export default function Inbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userPresence, setUserPresence] = useState<Map<string, UserPresence>>(new Map());

  const loadConversations = useCallback(async () => {
    if (!user) return;
    const convs = await getUserConversations(user.id);
    setConversations(convs);

    const userIds = convs.map((c) => c.other_user?.id).filter(Boolean) as string[];
    if (userIds.length > 0) {
      const presence = await getMultipleUserPresence(userIds);
      setUserPresence(presence);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const init = async () => {
      setLoading(true);
      await loadConversations();
      setLoading(false);
    };

    init();

    markNotificationsReadBatch(user.id, ['message', 'coin_received', 'coin_request']);
  }, [user, loadConversations]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const handleConversationClick = (conversation: Conversation) => {
    if (conversation.other_user) {
      navigate(`/inbox/${conversation.id}`, {
        state: { otherUser: conversation.other_user },
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-3xl font-black text-white">Messages</h1>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <StaggerItem key={i} index={i}>
                <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4">
                  <div className="flex items-center gap-4">
                    <SkeletonAvatar size="lg" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <ShimmerBar className="h-4 w-32 rounded" />
                        <ShimmerBar className="h-3 w-12 rounded" speed="slow" />
                      </div>
                      <ShimmerBar className="h-3 w-48 rounded" speed="slow" />
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
            <SlowLoadMessage loading={true} message="Loading conversations..." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-3xl font-black text-white flex-1">Messages</h1>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {conversations.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-12 text-center">
            <MessageCircle className="w-16 h-16 text-white/30 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">No messages yet</h2>
            <p className="text-gray-300">Start chatting with your friends!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => handleConversationClick(conversation)}
                className="w-full bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 p-4 hover:bg-white/10 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {conversation.other_user?.avatar_url ? (
                      <img
                        src={conversation.other_user.avatar_url}
                        alt={conversation.other_user.username}
                        width="56"
                        height="56"
                        className="w-14 h-14 rounded-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center">
                        <User className="w-7 h-7 text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-lg truncate">
                          @{conversation.other_user?.username || 'unknown'}
                        </h3>
                        {conversation.other_user && (
                          <OnlineStatus
                            lastActive={userPresence.get(conversation.other_user.id)?.last_seen}
                            showText={false}
                            size="small"
                          />
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                        {conversation.last_message_at ? formatTimestamp(conversation.last_message_at) : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-300 truncate">
                        {conversation.last_message_preview || 'No messages yet'}
                      </p>
                      {conversation.unread_count && conversation.unread_count > 0 && (
                        <span className="ml-2 flex-shrink-0 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
