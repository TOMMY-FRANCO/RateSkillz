import { useState, useEffect } from 'react';
import { X, Loader2, MessageCircle, Check, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getOrCreateConversation, sendMessage } from '../lib/messaging';

interface Friend {
  id: string;
  username: string;
  avatar_url: string | null;
}

interface QuizShareModalProps {
  userId: string;
  shareText: string;
  onClose: () => void;
}

export default function QuizShareModal({ userId, shareText, onClose }: QuizShareModalProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadFriends();
  }, []);

  const loadFriends = async () => {
    setLoading(true);
    try {
      const { data: friendRows } = await supabase
        .from('friends')
        .select('user_id, friend_id')
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');

      if (!friendRows || friendRows.length === 0) {
        setFriends([]);
        setLoading(false);
        return;
      }

      const friendIds = friendRows.map(r =>
        r.user_id === userId ? r.friend_id : r.user_id
      );

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', friendIds)
        .order('username');

      setFriends(profiles || []);
    } catch {
      setFriends([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (friendId: string) => {
    setSending(friendId);
    try {
      const conversationId = await getOrCreateConversation(userId, friendId);
      if (!conversationId) throw new Error('Failed to create conversation');

      const result = await sendMessage(conversationId, userId, friendId, shareText, true);
      if (result.error) throw new Error(result.error);

      setSent(prev => new Set(prev).add(friendId));
    } catch {
      // silently fail
    } finally {
      setSending(null);
    }
  };

  const filtered = search.trim()
    ? friends.filter(f => f.username.toLowerCase().includes(search.toLowerCase()))
    : friends;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 mb-4 sm:mb-0 glass-card overflow-hidden max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-[#00E0FF]" />
            <h3 className="text-white font-bold text-sm">Share via Chat</h3>
          </div>
          <button onClick={onClose} className="p-1 text-[#B0B8C8] hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {friends.length > 5 && (
          <div className="px-4 pt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B0B8C8]" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search friends..."
                className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-[#B0B8C8] focus:outline-none focus:border-[#00E0FF]/50"
              />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-[#00E0FF] animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-[#B0B8C8] text-sm py-8">
              {friends.length === 0 ? 'No friends to share with' : 'No matches found'}
            </p>
          ) : (
            filtered.map(friend => (
              <div key={friend.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/8 transition-colors">
                {friend.avatar_url ? (
                  <img
                    src={friend.avatar_url}
                    alt={friend.username}
                    className="w-10 h-10 rounded-full object-cover border-2 border-[rgba(0,224,255,0.3)]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center text-black font-bold text-sm border-2 border-[rgba(0,224,255,0.3)]">
                    {friend.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="flex-1 text-white font-medium text-sm truncate">
                  @{friend.username}
                </span>
                {sent.has(friend.id) ? (
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold">
                    <Check className="w-3.5 h-3.5" />
                    Sent
                  </div>
                ) : (
                  <button
                    onClick={() => handleSend(friend.id)}
                    disabled={sending === friend.id}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {sending === friend.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Send'
                    )}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
