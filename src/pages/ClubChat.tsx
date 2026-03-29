import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Send, RefreshCw, Flag, AlertCircle, Clock, Loader2, Radio } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface ChatMessage {
  id: string;
  user_id: string;
  team: string;
  message: string;
  is_flagged: boolean;
  created_at: string;
  chat_date: string;
  username?: string;
}

interface MatchSettings {
  id: string;
  team: string;
  match_status: 'none' | 'upcoming' | 'live';
  opponent: string | null;
  venue: string | null;
  match_date: string | null;
  is_premier_league: boolean;
}

const CHAT_START_HOUR = 16;
const CHAT_END_HOUR = 21;

function isChatActive(): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  return utcHour >= CHAT_START_HOUR && utcHour < CHAT_END_HOUR;
}

function getTimeUntilOpen(): string {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  if (utcHour >= CHAT_END_HOUR) {
    const minsLeft = (24 - utcHour + CHAT_START_HOUR) * 60 - utcMin;
    const h = Math.floor(minsLeft / 60);
    const m = minsLeft % 60;
    return `${h}h ${m}m`;
  }
  const minsLeft = (CHAT_START_HOUR - utcHour) * 60 - utcMin;
  const h = Math.floor(minsLeft / 60);
  const m = minsLeft % 60;
  return `${h}h ${m}m`;
}

function Countdown({ targetDate }: { targetDate: string }) {
  const [diff, setDiff] = useState('');

  useEffect(() => {
    const calc = () => {
      const now = Date.now();
      const target = new Date(targetDate).getTime();
      const ms = target - now;
      if (ms <= 0) { setDiff('Now'); return; }
      const totalSecs = Math.floor(ms / 1000);
      const d = Math.floor(totalSecs / 86400);
      const h = Math.floor((totalSecs % 86400) / 3600);
      const m = Math.floor((totalSecs % 3600) / 60);
      const s = totalSecs % 60;
      if (d > 0) setDiff(`${d}d ${h}h ${m}m`);
      else if (h > 0) setDiff(`${h}h ${m}m ${s}s`);
      else setDiff(`${m}m ${s}s`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [targetDate]);

  return <span>{diff}</span>;
}

export default function ClubChat() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [matchSettings, setMatchSettings] = useState<MatchSettings | null>(null);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [chatActive] = useState(isChatActive);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const userTeam = profile?.team;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const loadMessages = useCallback(async (silent = false) => {
    if (!userTeam) return;
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('club_chat_messages')
        .select('id, user_id, team, message, is_flagged, created_at, chat_date')
        .eq('team', userTeam)
        .eq('chat_date', today)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((m: any) => m.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', userIds);

        const profileMap = new Map<string, string>();
        profilesData?.forEach((p: any) => profileMap.set(p.id, p.username));

        setMessages(data.map((m: any) => ({
          ...m,
          username: profileMap.get(m.user_id) || 'Unknown',
        })));
      } else {
        setMessages([]);
      }
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userTeam, toast]);

  const loadMatchSettings = useCallback(async () => {
    if (!userTeam) return;
    try {
      const { data } = await supabase
        .from('club_match_settings')
        .select('id, team, match_status, opponent, venue, match_date, is_premier_league')
        .eq('team', userTeam)
        .maybeSingle();
      setMatchSettings(data || null);
    } catch {
      // non-critical
    }
  }, [userTeam]);

  useEffect(() => {
    if (userTeam) {
      loadMessages();
      loadMatchSettings();
    } else {
      setLoading(false);
    }
  }, [userTeam, loadMessages, loadMatchSettings]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleRefresh = async () => {
    await Promise.all([loadMessages(true), loadMatchSettings()]);
  };

  const handleSend = async () => {
    if (!profile || !userTeam) return;
    const trimmed = messageText.trim();
    if (!trimmed) return;
    if (trimmed.length > 280) {
      toast.error('Message too long (max 280 characters)');
      return;
    }
    if (!chatActive) {
      toast.error('Club Chat is only active 16:00–21:00 UTC');
      return;
    }

    setSending(true);
    try {
      const { data: filterData } = await supabase
        .from('profanity_filter')
        .select('word, pattern')
        .eq('is_active', true);

      if (filterData && filterData.length > 0) {
        const lower = trimmed.toLowerCase();
        const hasProfanity = filterData.some((entry: { word: string; pattern: string | null }) => {
          if (entry.pattern) {
            try {
              return new RegExp(entry.pattern, 'i').test(trimmed);
            } catch {
              return false;
            }
          }
          return lower.includes(entry.word.toLowerCase());
        });
        if (hasProfanity) {
          toast.error('Your message contains inappropriate language');
          setSending(false);
          return;
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const { error } = await supabase
        .from('club_chat_messages')
        .insert({
          user_id: profile.id,
          team: userTeam,
          message: trimmed,
          chat_date: today,
        });

      if (error) throw error;

      setMessageText('');
      await loadMessages(true);
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleReport = async (messageId: string) => {
    if (!profile) return;
    if (reportedIds.has(messageId)) {
      toast.error('Already reported');
      return;
    }
    try {
      const { error } = await supabase
        .from('club_chat_reports')
        .insert({
          message_id: messageId,
          reporter_id: profile.id,
          reason: 'Flagged by user',
        });
      if (error) throw error;
      setReportedIds(prev => new Set([...prev, messageId]));
      toast.success('Message reported');
    } catch {
      toast.error('Failed to report message');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!userTeam) {
    return (
      <div className="min-h-screen pb-24">
        <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16 gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-[#B0B8C8] hover:text-[#00E0FF] transition-colors bg-transparent border-none cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="font-semibold">Back</span>
              </button>
              <h1 className="text-2xl font-bold text-white heading-glow ml-auto mr-auto">Club Chat</h1>
              <div className="w-16" />
            </div>
          </div>
        </nav>
        <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">No Team Set</h2>
          <p className="text-[#B0B8C8] text-sm leading-relaxed">
            You need to set a London club team in your profile to access Club Chat.
          </p>
          <button
            onClick={() => navigate('/edit-profile')}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm hover:opacity-90 transition-all"
          >
            Edit Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col pb-24">
      {/* Nav */}
      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-[#B0B8C8] hover:text-[#00E0FF] transition-colors bg-transparent border-none cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-semibold">Back</span>
            </button>
            <h1 className="text-xl font-bold text-white heading-glow flex-1 text-center">
              {userTeam} Chat
            </h1>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors bg-transparent border-none cursor-pointer"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-lg mx-auto w-full px-4 py-4 flex flex-col gap-3 flex-1">

        {/* Match Banner */}
        {matchSettings && matchSettings.match_status !== 'none' && (
          <div className={`rounded-2xl p-4 ${
            matchSettings.match_status === 'live'
              ? 'bg-gradient-to-r from-red-600/90 to-orange-600/90 border border-red-400/30'
              : 'bg-gradient-to-r from-blue-900/80 to-cyan-900/80 border border-cyan-400/20'
          }`}>
            {matchSettings.match_status === 'live' ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-300 rounded-full animate-pulse" />
                  <span className="text-red-100 font-black text-sm uppercase tracking-wider">Live</span>
                </div>
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">
                    {userTeam} vs {matchSettings.opponent}
                  </p>
                  {matchSettings.venue && (
                    <p className="text-red-200 text-xs mt-0.5">{matchSettings.venue}</p>
                  )}
                </div>
                <Radio className="w-5 h-5 text-red-200 animate-pulse" />
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-cyan-300 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">
                    {userTeam} vs {matchSettings.opponent}
                  </p>
                  {matchSettings.venue && (
                    <p className="text-cyan-200 text-xs mt-0.5">{matchSettings.venue}</p>
                  )}
                  {matchSettings.match_date && (
                    <p className="text-cyan-300 text-xs mt-1 font-semibold">
                      Kickoff in: <Countdown targetDate={matchSettings.match_date} />
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat window */}
        <div className="glass-card flex-1 flex flex-col min-h-[52vh] max-h-[60vh] overflow-hidden">
          {/* Chat active / closed indicator */}
          <div className={`px-4 py-2 flex items-center gap-2 border-b ${
            chatActive ? 'border-green-500/20 bg-green-500/5' : 'border-orange-500/20 bg-orange-500/5'
          }`}>
            <div className={`w-2 h-2 rounded-full ${chatActive ? 'bg-green-400 animate-pulse' : 'bg-orange-400'}`} />
            {chatActive ? (
              <span className="text-green-400 text-xs font-semibold">Chat Active · 16:00–21:00 UTC</span>
            ) : (
              <span className="text-orange-400 text-xs font-semibold">
                Chat Closed · Opens in {getTimeUntilOpen()} (UTC)
              </span>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                <p className="text-[#B0B8C8] text-sm font-semibold">No messages yet today</p>
                <p className="text-gray-500 text-xs">Be the first to start the conversation!</p>
              </div>
            ) : (
              messages.map(msg => {
                const isOwn = msg.user_id === profile?.id;
                return (
                  <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`max-w-[78%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <span className={`text-xs font-semibold ${isOwn ? 'text-cyan-400 text-right' : 'text-[#B0B8C8]'}`}>
                        {isOwn ? 'You' : msg.username}
                      </span>
                      <div className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        isOwn
                          ? 'bg-gradient-to-br from-cyan-600/80 to-blue-700/80 text-white rounded-tr-sm'
                          : 'bg-white/8 text-white rounded-tl-sm border border-white/10'
                      }`}>
                        {msg.message}
                      </div>
                      <div className={`flex items-center gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                        <span className="text-gray-500 text-xs">
                          {new Date(msg.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {!isOwn && (
                          <button
                            onClick={() => handleReport(msg.id)}
                            title="Report message"
                            className={`transition-colors ${
                              reportedIds.has(msg.id)
                                ? 'text-orange-400 cursor-default'
                                : 'text-gray-600 hover:text-orange-400 cursor-pointer'
                            } bg-transparent border-none`}
                          >
                            <Flag className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        {chatActive ? (
          <div className="flex gap-2 items-end">
            <textarea
              value={messageText}
              onChange={e => setMessageText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Say something to your club..."
              rows={1}
              maxLength={280}
              className="flex-1 glass-input resize-none rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 bg-white/5 border border-white/10 focus:border-cyan-500/50 focus:outline-none transition-all"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={sending || !messageText.trim()}
              className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shrink-0 hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
            >
              {sending ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        ) : (
          <div className="glass-card p-4 flex items-center gap-3 text-center justify-center">
            <Clock className="w-4 h-4 text-orange-400 shrink-0" />
            <p className="text-[#B0B8C8] text-sm">
              Chat opens at <span className="text-white font-semibold">16:00 UTC</span> daily
            </p>
          </div>
        )}

        <p className="text-gray-600 text-xs text-center">
          Today's messages · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </p>
      </div>
    </div>
  );
}
