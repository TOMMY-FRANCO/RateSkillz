import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Message,
  getConversationMessages,
  sendMessage,
  markMessagesAsRead,
  subscribeToMessages,
  subscribeToUserStatus,
  subscribeToTypingStatus,
  setTypingStatus,
  getUserStatus,
  formatTimestamp,
} from '../lib/messaging';
import { ArrowLeft, Send, User, Check, CheckCheck, Coins } from 'lucide-react';
import { displayUsername } from '../lib/username';
import SendCoinsModal from '../components/SendCoinsModal';
import { checkCanSendCoins, subscribeToCoinTransfers } from '../lib/coinTransfers';
import { supabase } from '../lib/supabase';

export default function Chat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const otherUser = location.state?.otherUser as {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    is_verified?: boolean;
  };

  const [showSendCoinsModal, setShowSendCoinsModal] = useState(false);
  const [canSendCoins, setCanSendCoins] = useState(false);
  const [sendCoinsTooltip, setSendCoinsTooltip] = useState('');
  const [coinTransferNotifications, setCoinTransferNotifications] = useState<
    Array<{ id: string; amount: number; sender_id: string; recipient_id: string; created_at: string }>
  >([]);

  useEffect(() => {
    if (!user || !conversationId) return;

    const loadMessages = async () => {
      setLoading(true);
      const msgs = await getConversationMessages(conversationId);
      setMessages(msgs);
      setLoading(false);

      await markMessagesAsRead(conversationId, user.id);
    };

    loadMessages();

    const unsubscribeMessages = subscribeToMessages(conversationId, (message) => {
      setMessages((prev) => [...prev, message]);
      if (message.recipient_id === user.id) {
        markMessagesAsRead(conversationId, user.id);
      }
      scrollToBottom();
    });

    const unsubscribeTyping = subscribeToTypingStatus(conversationId, (status) => {
      if (status && status.user_id !== user.id) {
        setOtherUserTyping(status.is_typing);
      } else {
        setOtherUserTyping(false);
      }
    });

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
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

    const unsubscribeStatus = subscribeToUserStatus(otherUser.id, (status) => {
      setIsOnline(status.is_online);
      setLastSeen(status.last_seen);
    });

    return () => {
      unsubscribeStatus();
    };
  }, [otherUser]);

  useEffect(() => {
    if (!user || !otherUser || !conversationId) return;

    const checkEligibility = async () => {
      const result = await checkCanSendCoins(user.id, otherUser.id);
      setCanSendCoins(result.canSend);
      setSendCoinsTooltip(result.reason || '');
    };

    checkEligibility();

    const loadOtherUserVerification = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_verified')
        .eq('id', otherUser.id)
        .maybeSingle();

      if (data) {
        otherUser.is_verified = data.is_verified;
      }
    };

    loadOtherUserVerification();

    const unsubscribeTransfers = subscribeToCoinTransfers(conversationId, (transfer) => {
      setCoinTransferNotifications((prev) => [...prev, transfer]);
      setTimeout(() => {
        setCoinTransferNotifications((prev) => prev.filter((t) => t.id !== transfer.id));
      }, 5000);
    });

    return () => {
      unsubscribeTransfers();
    };
  }, [user, otherUser, conversationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleTyping = () => {
    if (!user || !conversationId) return;

    setTypingStatus(user.id, conversationId, true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setTypingStatus(user.id, conversationId, false);
    }, 2000);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !conversationId || !otherUser || !newMessage.trim() || sending) return;

    setSending(true);
    await sendMessage(conversationId, user.id, otherUser.id, newMessage.trim());
    setNewMessage('');
    setSending(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setTypingStatus(user.id, conversationId, false);
  };

  const handleTransferComplete = async (amount: number) => {
    if (!user || !conversationId || !otherUser) return;

    await sendMessage(
      conversationId,
      user.id,
      otherUser.id,
      `Sent ${amount} coins`
    );
  };

  if (loading || !otherUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col">
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
              <div className="relative">
                {otherUser.avatar_url ? (
                  <img
                    src={otherUser.avatar_url}
                    alt={otherUser.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                )}
                {isOnline && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900"></div>
                )}
              </div>

              <div>
                <h2 className="font-bold text-white text-lg">
                  {otherUser.full_name || displayUsername(otherUser.username)}
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
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto max-w-4xl w-full mx-auto px-4 py-6">
        <div className="space-y-4">
          {messages.map((message) => {
            const isSentByMe = message.sender_id === user?.id;
            const isCoinTransfer = message.content.includes('Sent') && message.content.includes('coins');

            return (
              <div
                key={message.id}
                className={`flex ${isSentByMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                    isCoinTransfer
                      ? isSentByMe
                        ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-br-none'
                        : 'bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-bl-none'
                      : isSentByMe
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-none'
                      : 'bg-white/10 backdrop-blur-sm text-white rounded-bl-none border border-white/20'
                  }`}
                >
                  {isCoinTransfer && (
                    <div className="flex items-center gap-2 mb-1">
                      <Coins className="w-4 h-4" />
                      <span className="text-xs font-semibold">Coin Transfer</span>
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
            );
          })}

          {coinTransferNotifications.map((notification) => (
            <div
              key={notification.id}
              className="flex justify-center animate-fade-in"
            >
              <div className="bg-yellow-500/20 border border-yellow-500/50 px-4 py-2 rounded-full text-yellow-300 text-sm font-semibold flex items-center gap-2">
                <Coins className="w-4 h-4" />
                {notification.sender_id === user?.id
                  ? `You sent ${notification.amount} coins`
                  : `Received ${notification.amount} coins`}
              </div>
            </div>
          ))}

          {otherUserTyping && (
            <div className="flex justify-start">
              <div className="bg-white/10 backdrop-blur-sm px-4 py-3 rounded-2xl rounded-bl-none border border-white/20">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="bg-black/20 backdrop-blur-sm border-t border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <form onSubmit={handleSend} className="flex gap-3">
            <div className="relative group">
              <button
                type="button"
                onClick={() => canSendCoins && setShowSendCoinsModal(true)}
                disabled={!canSendCoins}
                className={`bg-white/10 text-white p-3 rounded-xl font-bold transition-all flex items-center justify-center ${
                  canSendCoins
                    ? 'hover:bg-yellow-500/20 hover:text-yellow-400'
                    : 'opacity-50 cursor-not-allowed'
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
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                handleTyping();
              }}
              placeholder="Type a message..."
              className="flex-1 bg-white/10 text-white placeholder-gray-400 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-white/10"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              Send
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
          recipientFullName={otherUser.full_name}
          recipientIsVerified={otherUser.is_verified || false}
          conversationId={conversationId}
          onTransferComplete={handleTransferComplete}
        />
      )}
    </div>
  );
}
