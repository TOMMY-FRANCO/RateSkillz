import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Message,
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
  getUserStatus,
  formatTimestamp,
  getPrewrittenMessageCount,
} from '../lib/messaging';
import { ArrowLeft, Send, User, Check, CheckCheck, Coins, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { displayUsername } from '../lib/username';
import SendCoinsModal from '../components/SendCoinsModal';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../components/ui/Shimmer';
import { SkeletonAvatar } from '../components/ui/SkeletonPresets';
import { checkCanSendCoins } from '../lib/coinTransfers';
import { supabase } from '../lib/supabase';
import { playSound } from '../lib/sounds';
import QuickMessageTray, { DAILY_LIMIT } from '../components/QuickMessageTray';
import EmojiPicker from '../components/EmojiPicker';

interface OtherUserInfo {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_verified?: boolean;
}

export default function Chat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [otherUser, setOtherUser] = useState<OtherUserInfo | null>(location.state?.otherUser || null);
  const [newMessage, setNewMessage] = useState(location.state?.unsentMessage || '');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [showSendCoinsModal, setShowSendCoinsModal] = useState(false);
  const [canSendCoins, setCanSendCoins] = useState(false);
  const [sendCoinsTooltip, setSendCoinsTooltip] = useState('');

  const [showQuickTray, setShowQuickTray] = useState(false);
  const [prewrittenUsedToday, setPrewrittenUsedToday] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    const msgs = await getConversationMessages(conversationId);
    setMessages(msgs);
    if (user) {
      await markMessagesAsRead(conversationId, user.id);
    }
  }, [conversationId, user]);

  useEffect(() => {
    if (!user || !conversationId) return;

    const loadConversationData = async () => {
      setLoading(true);

      let resolvedOtherUser = otherUser;

      if (!resolvedOtherUser) {
        const { data: conv } = await supabase
          .from('conversations')
          .select('user_one_id, user_two_id')
          .eq('id', conversationId)
          .maybeSingle();

        if (!conv) {
          navigate('/inbox');
          return;
        }

        const otherUserId = conv.user_one_id === user.id ? conv.user_two_id : conv.user_one_id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, is_verified')
          .eq('id', otherUserId)
          .maybeSingle();

        if (!profile) {
          navigate('/inbox');
          return;
        }

        resolvedOtherUser = profile;
        setOtherUser(profile);
      }

      await loadMessages();
      setLoading(false);
    };

    loadConversationData();
  }, [conversationId, user]);

  useEffect(() => {
    if (!otherUser) return;

    const loadUserStatus = async () => {
      const status = await getUserStatus(otherUser.id);
      if (status) {
        setIsOnline(status.is_online);
        setLastSeen(status.last_seen);
      }
    };

    loadUserStatus();
  }, [otherUser]);

  useEffect(() => {
    if (!user || !otherUser || !conversationId) return;

    const checkEligibility = async () => {
      const result = await checkCanSendCoins(user.id, otherUser.id);
      setCanSendCoins(result.canSend);
      setSendCoinsTooltip(result.reason || '');
    };

    const loadPrewrittenCount = async () => {
      const count = await getPrewrittenMessageCount(user.id, otherUser.id);
      setPrewrittenUsedToday(count);
    };

    checkEligibility();
    loadPrewrittenCount();

    const loadOtherUserVerification = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_verified')
        .eq('id', otherUser.id)
        .maybeSingle();

      if (data) {
        setOtherUser((prev) => prev ? { ...prev, is_verified: data.is_verified } : prev);
      }
    };

    loadOtherUserVerification();
  }, [user, otherUser?.id, conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    await loadMessages();
    setRefreshing(false);
    setPullDistance(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === 0 || refreshing) return;
    const diff = e.touches[0].clientY - touchStartY.current;
    if (diff > 0 && containerRef.current && containerRef.current.scrollTop === 0) {
      setPullDistance(Math.min(diff, 80));
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 50 && !refreshing) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
    touchStartY.current = 0;
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !conversationId || !otherUser || !newMessage.trim() || sending) return;

    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);
    setSendError(null);

    const { message, error } = await sendMessage(conversationId, user.id, otherUser.id, content);
    if (message) {
      playSound('message-sent');
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    } else {
      setSendError(error || 'Failed to send message');
      setNewMessage(content);
    }
    setSending(false);
  };

  const handleQuickMessageSend = async (text: string) => {
    if (!user || !conversationId || !otherUser || sending) return;
    if (prewrittenUsedToday >= DAILY_LIMIT) return;

    setSending(true);
    setSendError(null);

    const { message, error } = await sendMessage(conversationId, user.id, otherUser.id, text, true);
    if (message) {
      playSound('message-sent');
      setPrewrittenUsedToday((prev) => prev + 1);
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      if (prewrittenUsedToday + 1 >= DAILY_LIMIT) {
        setShowQuickTray(false);
      }
    } else {
      setSendError(error || 'Failed to send message');
    }
    setSending(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setNewMessage((prev) => prev + emoji);
      return;
    }
    const start = input.selectionStart ?? newMessage.length;
    const end = input.selectionEnd ?? newMessage.length;
    const updated = newMessage.slice(0, start) + emoji + newMessage.slice(end);
    setNewMessage(updated);
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + emoji.length;
      input.setSelectionRange(pos, pos);
    });
  };

  const handleTransferComplete = async (amount: number) => {
    if (!user || !conversationId || !otherUser) return;

    const { message } = await sendMessage(
      conversationId,
      user.id,
      otherUser.id,
      `Sent ${amount} coins`
    );
    if (message) {
      playSound('coin-received');
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    }
  };

  const navigateToProfile = () => {
    if (!otherUser) return;
    navigate(`/profile/${otherUser.username}`, {
      state: {
        fromChat: true,
        conversationId,
        otherUser,
        unsentMessage: newMessage,
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
        <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <ShimmerBar className="w-10 h-10 rounded-lg" />
              <SkeletonAvatar size="md" />
              <div className="space-y-2">
                <ShimmerBar className="h-4 w-32 rounded" />
                <ShimmerBar className="h-3 w-20 rounded" speed="slow" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <StaggerItem key={i} index={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
              <ShimmerBar
                className={`h-14 rounded-2xl ${i % 2 === 0 ? 'rounded-bl-none' : 'rounded-br-none'}`}
                style={{ width: `${140 + (i % 3) * 60}px` }}
                speed="slow"
              />
            </StaggerItem>
          ))}
          <SlowLoadMessage loading={true} message="Loading messages..." />
        </div>
      </div>
    );
  }

  if (!otherUser) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col">
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/inbox')}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>

            <div className="flex items-center gap-3 flex-1">
              <button
                onClick={navigateToProfile}
                className="relative flex-shrink-0 focus:outline-none group"
                title={`View @${otherUser.username}'s profile`}
              >
                {otherUser.avatar_url ? (
                  <img
                    src={otherUser.avatar_url}
                    alt={otherUser.username}
                    width="48"
                    height="48"
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-transparent group-hover:ring-cyan-400/70 transition-all duration-200"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center ring-2 ring-transparent group-hover:ring-cyan-400/70 transition-all duration-200">
                    <User className="w-6 h-6 text-white" />
                  </div>
                )}
                {isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900 pointer-events-none"></div>
                )}
              </button>

              <div>
                <h2 className="font-bold text-white text-lg">
                  @{otherUser.username}
                </h2>
                <p className="text-sm text-gray-300">
                  {isOnline ? (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Online
                    </span>
                  ) : lastSeen ? (
                    `Last seen ${formatTimestamp(lastSeen)}`
                  ) : (
                    'Offline'
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
              title="Refresh messages"
            >
              <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {pullDistance > 0 && (
        <div
          className="flex justify-center items-center bg-gradient-to-b from-cyan-500/10 to-transparent transition-all"
          style={{ height: `${pullDistance}px`, opacity: pullDistance / 80 }}
        >
          <RefreshCw className={`text-cyan-400 ${pullDistance > 50 ? 'animate-spin' : ''}`} size={20} />
        </div>
      )}

      <div
        className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6"
        ref={containerRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                <Send className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-gray-400 text-lg font-medium">No messages yet</p>
              <p className="text-gray-500 text-sm mt-1">Send a message to start the conversation</p>
            </div>
          )}

          {messages.map((message, index) => {
            const isSentByMe = message.sender_id === user?.id;
            const isCoinTransfer = message.content.includes('Sent') && message.content.includes('coins');
            const prevMessage = index > 0 ? messages[index - 1] : null;
            const showDateDivider = !prevMessage ||
              new Date(message.created_at).toDateString() !== new Date(prevMessage.created_at).toDateString();

            const showAvatar = !isSentByMe;

            return (
              <div key={message.id}>
                {showDateDivider && (
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-white/5 text-gray-400 text-xs px-3 py-1 rounded-full">
                      {new Date(message.created_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                )}
                <div
                  className={`flex items-end gap-2 ${isSentByMe ? 'justify-end' : 'justify-start'} animate-[fadeSlideIn_0.2s_ease-out]`}
                >
                  {showAvatar && (
                    <button
                      onClick={navigateToProfile}
                      className="flex-shrink-0 mb-1 focus:outline-none group"
                      title={`View @${otherUser.username}'s profile`}
                    >
                      {otherUser.avatar_url ? (
                        <img
                          src={otherUser.avatar_url}
                          alt={otherUser.username}
                          width="28"
                          height="28"
                          className="w-7 h-7 rounded-full object-cover ring-1 ring-transparent group-hover:ring-cyan-400/60 transition-all"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center ring-1 ring-transparent group-hover:ring-cyan-400/60 transition-all">
                          <User className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                    </button>
                  )}
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl transition-all ${
                      isCoinTransfer
                        ? isSentByMe
                          ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-br-none'
                          : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-bl-none'
                        : isSentByMe
                        ? 'bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-br-none'
                        : 'bg-white/10 backdrop-blur-sm text-white rounded-bl-none border border-white/20'
                    }`}
                  >
                    {isCoinTransfer && (
                      <div className="flex items-center gap-2 mb-1">
                        <Coins className="w-4 h-4" />
                        <span className="text-xs font-semibold">Coin Transfer</span>
                      </div>
                    )}
                    {message.is_prewritten && !isCoinTransfer && (
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-xs">⚽</span>
                        <span className="text-xs opacity-60 font-medium">Quick message</span>
                      </div>
                    )}
                    <p className="break-words">{message.content}</p>
                    <div className="flex items-center justify-end gap-1 mt-1">
                      <span className="text-xs opacity-70">
                        {new Date(message.created_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      {isSentByMe && (
                        <span className="text-xs opacity-70">
                          {message.is_read ? (
                            <CheckCheck className="w-3 h-3 text-blue-300" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {sendError && (
        <div className="max-w-4xl mx-auto px-4 w-full">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2 mb-2 flex items-center gap-2 animate-[fadeSlideIn_0.2s_ease-out]">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-red-300 text-sm flex-1">{sendError}</p>
            <button onClick={() => setSendError(null)} className="text-red-400 hover:text-red-300 text-sm font-medium">
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="bg-black/20 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-4xl mx-auto px-4 pt-2 pb-4">
          {showQuickTray && (
            <QuickMessageTray
              onSend={handleQuickMessageSend}
              onClose={() => setShowQuickTray(false)}
              usedToday={prewrittenUsedToday}
              disabled={sending}
            />
          )}
          {showEmojiPicker && (
            <EmojiPicker
              onSelect={handleEmojiSelect}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <div className="relative group flex-shrink-0">
              <button
                type="button"
                onClick={() => canSendCoins && setShowSendCoinsModal(true)}
                disabled={!canSendCoins}
                className={`w-11 h-11 rounded-xl font-bold transition-all flex items-center justify-center flex-shrink-0 ${
                  canSendCoins
                    ? 'bg-white/10 hover:bg-yellow-500/20 hover:text-yellow-400 text-white'
                    : 'bg-white/10 text-white opacity-50 cursor-not-allowed'
                }`}
                title={canSendCoins ? 'Send coins' : sendCoinsTooltip}
              >
                <Coins className="w-5 h-5" />
              </button>
              {!canSendCoins && sendCoinsTooltip && (
                <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-xs rounded-lg py-2 px-3 whitespace-nowrap border border-white/20">
                    {sendCoinsTooltip}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !showQuickTray;
                setShowQuickTray(next);
                if (next) setShowEmojiPicker(false);
              }}
              className={`w-11 h-11 rounded-xl transition-all flex items-center justify-center flex-shrink-0 text-lg leading-none ${
                showQuickTray
                  ? 'bg-gradient-to-r from-cyan-600/40 to-teal-600/40 border border-cyan-500/50'
                  : 'bg-white/10 hover:bg-white/20 border border-white/10'
              } ${prewrittenUsedToday >= DAILY_LIMIT ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={prewrittenUsedToday >= DAILY_LIMIT ? 'Daily quick message limit reached' : 'Quick messages'}
            >
              ⚽
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !showEmojiPicker;
                setShowEmojiPicker(next);
                if (next) setShowQuickTray(false);
              }}
              className={`w-11 h-11 rounded-xl transition-all flex items-center justify-center flex-shrink-0 text-lg leading-none ${
                showEmojiPicker
                  ? 'bg-gradient-to-r from-cyan-600/40 to-teal-600/40 border border-cyan-500/50'
                  : 'bg-white/10 hover:bg-white/20 border border-white/10'
              }`}
              title="Emoji picker"
            >
              😊
            </button>

            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 bg-white/10 text-white placeholder-gray-400 rounded-xl px-4 h-11 focus:outline-none focus:ring-2 focus:ring-cyan-500 border border-white/10"
              disabled={sending}
            />

            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="w-11 h-11 bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-xl font-bold hover:from-cyan-700 hover:to-teal-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center flex-shrink-0"
              title="Send"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </div>

      {conversationId && otherUser && (
        <SendCoinsModal
          isOpen={showSendCoinsModal}
          onClose={() => setShowSendCoinsModal(false)}
          recipientId={otherUser.id}
          recipientUsername={otherUser.username}
          recipientFullName={null}
          recipientIsVerified={otherUser.is_verified || false}
          conversationId={conversationId}
          onTransferComplete={handleTransferComplete}
        />
      )}
    </div>
  );
}
