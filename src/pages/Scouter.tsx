import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, RefreshCw, MapPin, MessageCircle, Plus, AlertCircle, X,
  Loader2, Trash2, Users, Shield, Search, ChevronDown, ChevronUp,
  CheckCircle, Ticket, Calendar, Trophy, ExternalLink,
  Instagram, Facebook, Youtube, Twitter,
} from 'lucide-react';
import { ShimmerBar } from '../components/ui/Shimmer';
import { useToast } from '../contexts/ToastContext';

const POSITIONS = ['GK', 'AM', 'WB', 'RW', 'LW', 'CM', 'CB', 'LB', 'RB', 'DM'];

interface ScoutListing {
  id: string;
  team_id: string;
  team_name: string;
  team_avatar_url: string | null;
  title: string;
  description: string | null;
  position_needed: string;
  location: string | null;
  age_min: number | null;
  age_max: number | null;
  trial_date: string | null;
  training_days: string | null;
  training_times: string | null;
  coin_reward: number;
  contact_details: string | null;
  whatsapp_link: string | null;
  is_active: boolean;
  interested_count: number;
  created_at: string;
}

interface CreateFormData {
  title: string;
  position_needed: string;
  description: string;
  age_min: string;
  age_max: string;
  location: string;
  training_days: string;
  training_times: string;
  trial_date: string;
  coin_reward: string;
  contact_details: string;
  whatsapp_link: string;
}

interface FootballClub {
  id: string;
  name: string;
  region: 'North' | 'East' | 'South' | 'West';
  gender: 'mens' | 'womens';
  league: string | null;
  borough: string | null;
  description: string | null;
  badge_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  twitter_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;
  threads_url: string | null;
  is_verified: boolean;
  is_partner: boolean;
}

interface ClubStaff {
  id: string;
  club_id: string;
  role: string;
  name: string;
  avatar_url: string | null;
  profile_id: string | null;
  profile?: { username: string } | null;
}

interface ClubPlayer {
  id: string;
  club_id: string;
  name: string;
  position: string | null;
  jersey_number: number | null;
  avatar_url: string | null;
  profile_id: string | null;
  profile?: { username: string } | null;
}

interface ClubMatch {
  id: string;
  club_id: string;
  match_date: string;
  opponent: string;
  venue: string | null;
  is_home: boolean;
  result: 'win' | 'loss' | 'draw' | 'upcoming';
  goals_for: number | null;
  goals_against: number | null;
  tickets_available: boolean;
  ticket_price: number | null;
  seats_remaining: number | null;
}

const DEFAULT_FORM: CreateFormData = {
  title: '',
  position_needed: '',
  description: '',
  age_min: '',
  age_max: '',
  location: '',
  training_days: '',
  training_times: '',
  trial_date: '',
  coin_reward: '0',
  contact_details: '',
  whatsapp_link: '',
};

const inputClass = `w-full px-3 py-2.5 rounded-lg text-sm bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-white placeholder-[#B0B8C8] focus:outline-none focus:border-[#00E0FF] transition-colors`;
const selectClass = `w-full px-3 py-2.5 rounded-lg text-sm font-semibold bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-white focus:outline-none focus:border-[#00E0FF] appearance-none cursor-pointer transition-colors hover:border-[rgba(0,224,255,0.5)]`;
const labelClass = `block text-xs font-semibold text-[#B0B8C8] mb-1`;

const REGIONS = ['All', 'North', 'East', 'South', 'West'] as const;
type RegionFilter = typeof REGIONS[number];

function ListingSkeleton() {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <ShimmerBar className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <ShimmerBar className="h-4 w-32 rounded" />
          <ShimmerBar className="h-3 w-48 rounded" />
        </div>
      </div>
      <ShimmerBar className="h-5 w-40 rounded" />
      <div className="flex gap-2">
        <ShimmerBar className="h-6 w-16 rounded-full" />
        <ShimmerBar className="h-6 w-24 rounded-full" />
      </div>
      <div className="flex gap-2 pt-1">
        <ShimmerBar className="h-9 flex-1 rounded-lg" />
        <ShimmerBar className="h-9 flex-1 rounded-lg" />
      </div>
    </div>
  );
}

function ClubSkeleton() {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <ShimmerBar className="w-14 h-14 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <ShimmerBar className="h-5 w-36 rounded" />
          <ShimmerBar className="h-3 w-24 rounded" />
          <ShimmerBar className="h-3 w-20 rounded" />
        </div>
      </div>
      <ShimmerBar className="h-3 w-full rounded" />
      <ShimmerBar className="h-3 w-4/5 rounded" />
    </div>
  );
}

function RippleBadge({ isPartner }: { isPartner: boolean }) {
  return (
    <div className="relative flex items-center justify-center w-5 h-5 flex-shrink-0">
      <span
        className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${
          isPartner ? 'bg-green-400' : 'bg-gray-500'
        }`}
      />
      <span
        className={`relative inline-flex rounded-full h-3 w-3 ${
          isPartner ? 'bg-green-400' : 'bg-gray-500'
        }`}
      />
    </div>
  );
}

function ResultPill({ result }: { result: 'win' | 'loss' | 'draw' }) {
  const styles = {
    win: 'bg-green-500/20 border border-green-500/40 text-green-400',
    loss: 'bg-red-500/20 border border-red-500/40 text-red-400',
    draw: 'bg-yellow-500/20 border border-yellow-500/40 text-yellow-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${styles[result]}`}>
      {result}
    </span>
  );
}

function PlayerAvatarCard({
  name,
  avatarUrl,
  position,
  jerseyNumber,
  username,
  onClick,
}: {
  name: string;
  avatarUrl: string | null;
  position?: string | null;
  jerseyNumber?: number | null;
  username?: string | null;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name}
          className="w-10 h-10 rounded-full object-cover border-2 border-[rgba(0,224,255,0.3)] flex-shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00FF85] to-[#38BDF8] flex items-center justify-center text-black font-black text-sm flex-shrink-0">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-white text-xs font-bold truncate">{name}</p>
        {(position || jerseyNumber != null) && (
          <p className="text-[#B0B8C8] text-xs truncate">
            {jerseyNumber != null ? `#${jerseyNumber}` : ''}
            {jerseyNumber != null && position ? ' · ' : ''}
            {position || ''}
          </p>
        )}
        {username && (
          <p className="text-[#00E0FF] text-xs truncate">@{username}</p>
        )}
      </div>
    </div>
  );
}

function ClubCard({
  club,
  expanded,
  onToggle,
  navigate,
}: {
  club: FootballClub;
  expanded: boolean;
  onToggle: () => void;
  navigate: (path: string) => void;
}) {
  const [staff, setStaff] = useState<ClubStaff[]>([]);
  const [players, setPlayers] = useState<ClubPlayer[]>([]);
  const [matches, setMatches] = useState<ClubMatch[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(false);

  const recentMatches = matches.filter(m => m.result !== 'upcoming').slice(0, 5);
  const upcomingMatches = matches.filter(m => m.result === 'upcoming');

  const wins = recentMatches.filter(m => m.result === 'win').length;
  const losses = recentMatches.filter(m => m.result === 'loss').length;
  const draws = recentMatches.filter(m => m.result === 'draw').length;

  const loadDetails = useCallback(async () => {
    if (detailsLoaded || loadingDetails) return;
    setLoadingDetails(true);
    try {
      const [staffRes, playersRes, matchesRes] = await Promise.all([
        supabase
          .from('club_staff')
          .select('*, profile:profiles(username)')
          .eq('club_id', club.id)
          .order('role'),
        supabase
          .from('club_players')
          .select('*, profile:profiles(username)')
          .eq('club_id', club.id)
          .order('jersey_number', { ascending: true, nullsFirst: false }),
        supabase
          .from('club_matches')
          .select('*')
          .eq('club_id', club.id)
          .order('match_date', { ascending: false })
          .limit(20),
      ]);
      setStaff((staffRes.data || []) as ClubStaff[]);
      setPlayers((playersRes.data || []) as ClubPlayer[]);
      setMatches((matchesRes.data || []) as ClubMatch[]);
      setDetailsLoaded(true);
    } finally {
      setLoadingDetails(false);
    }
  }, [club.id, detailsLoaded, loadingDetails]);

  const handleToggle = () => {
    if (!expanded && !detailsLoaded) {
      loadDetails();
    }
    onToggle();
  };

  return (
    <div className="glass-card overflow-hidden">
      <div
        className="p-4 cursor-pointer select-none"
        onClick={handleToggle}
      >
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-full flex-shrink-0 bg-gray-700 border-2 border-[rgba(0,224,255,0.2)] flex items-center justify-center overflow-hidden">
            {club.is_verified && club.badge_url ? (
              <img
                src={club.badge_url}
                alt={club.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <Shield className="w-7 h-7 text-gray-500" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-bold text-base leading-tight">{club.name}</h3>
              <RippleBadge isPartner={club.is_partner} />
              {!club.is_partner && (
                <span className="text-gray-500 text-xs font-normal">Not yet a RatingSkill partner</span>
              )}
              {club.is_verified && (
                <CheckCircle className="w-4 h-4 text-[#00E0FF] flex-shrink-0" />
              )}
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {club.league && (
                <span className="text-[#B0B8C8] text-xs">{club.league}</span>
              )}
              {club.borough && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-[#B0B8C8]" />
                  <span className="text-[#B0B8C8] text-xs">{club.borough}</span>
                </div>
              )}
            </div>

            {club.is_partner && (
              <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/15 border border-green-500/30 text-green-400">
                Partner Club
              </span>
            )}
          </div>

          <div className="flex-shrink-0 ml-1 mt-1">
            {expanded
              ? <ChevronUp className="w-4 h-4 text-[#B0B8C8]" />
              : <ChevronDown className="w-4 h-4 text-[#B0B8C8]" />
            }
          </div>
        </div>

        {club.description && (
          <p className="mt-3 text-[#B0B8C8] text-xs leading-relaxed line-clamp-2">
            {club.description}
          </p>
        )}

        {club.is_partner && recentMatches.length > 0 && !expanded && (
          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
            <span className="text-[#B0B8C8] text-xs font-semibold mr-1">Recent:</span>
            {recentMatches.map(m => (
              <ResultPill key={m.id} result={m.result as 'win' | 'loss' | 'draw'} />
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t border-white/10 px-4 pb-4 space-y-5">
          {loadingDetails && (
            <div className="py-6 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 text-[#00E0FF] animate-spin" />
              <span className="text-[#B0B8C8] text-sm">Loading club details...</span>
            </div>
          )}

          {detailsLoaded && (
            <>
              {club.description && (
                <div className="pt-4">
                  <p className="text-[#B0B8C8] text-sm leading-relaxed">{club.description}</p>
                </div>
              )}

              {club.is_partner && recentMatches.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 pt-2">
                    <Trophy className="w-4 h-4 text-yellow-400" />
                    <h4 className="text-white font-bold text-sm">Recent Results</h4>
                    <span className="text-[#B0B8C8] text-xs ml-auto">
                      {wins}W · {draws}D · {losses}L
                    </span>
                  </div>
                  <div className="space-y-2">
                    {recentMatches.map(m => (
                      <div key={m.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                        <ResultPill result={m.result as 'win' | 'loss' | 'draw'} />
                        <span className="text-white text-xs font-semibold flex-1 min-w-0 truncate">
                          vs {m.opponent}
                        </span>
                        {m.goals_for != null && m.goals_against != null && (
                          <span className="text-[#B0B8C8] text-xs font-mono">
                            {m.goals_for}–{m.goals_against}
                          </span>
                        )}
                        <span className="text-[#B0B8C8] text-xs">
                          {new Date(m.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {club.is_partner && upcomingMatches.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-[#00E0FF]" />
                    <h4 className="text-white font-bold text-sm">Upcoming Matches</h4>
                  </div>
                  <div className="space-y-2">
                    {upcomingMatches.map(m => (
                      <div key={m.id} className="px-3 py-2.5 rounded-lg bg-[rgba(0,224,255,0.05)] border border-[rgba(0,224,255,0.15)]">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-xs font-bold flex-1">vs {m.opponent}</span>
                          <span className="text-[#00E0FF] text-xs font-semibold">
                            {new Date(m.match_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        {m.venue && (
                          <div className="flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3 text-[#B0B8C8]" />
                            <span className="text-[#B0B8C8] text-xs">{m.venue} · {m.is_home ? 'Home' : 'Away'}</span>
                          </div>
                        )}
                        {m.tickets_available && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <Ticket className="w-3.5 h-3.5 text-green-400" />
                            <span className="text-green-400 text-xs font-semibold">
                              Tickets available
                              {m.ticket_price != null ? ` · £${m.ticket_price.toFixed(2)}` : ''}
                              {m.seats_remaining != null ? ` · ${m.seats_remaining} seats left` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {staff.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-[#B0B8C8]" />
                    <h4 className="text-white font-bold text-sm">Staff</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {staff.map(s => (
                      <PlayerAvatarCard
                        key={s.id}
                        name={s.name}
                        avatarUrl={s.avatar_url}
                        position={s.role}
                        username={s.profile?.username ?? null}
                        onClick={
                          s.profile?.username
                            ? () => navigate(`/profile/${s.profile!.username}`)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {players.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-[#B0B8C8]" />
                    <h4 className="text-white font-bold text-sm">Players</h4>
                    <span className="text-[#B0B8C8] text-xs ml-auto">{players.length} registered</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {players.map(p => (
                      <PlayerAvatarCard
                        key={p.id}
                        name={p.name}
                        avatarUrl={p.avatar_url}
                        position={p.position}
                        jerseyNumber={p.jersey_number}
                        username={p.profile?.username ?? null}
                        onClick={
                          p.profile?.username
                            ? () => navigate(`/profile/${p.profile!.username}`)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {detailsLoaded && staff.length === 0 && players.length === 0 && !club.is_partner && (
                <div className="py-4 text-center">
                  <p className="text-[#B0B8C8] text-sm">No additional details available yet.</p>
                </div>
              )}

              {club.is_partner && (club.website_url || club.instagram_url || club.facebook_url || club.twitter_url || club.tiktok_url || club.youtube_url || club.threads_url) && (
                <div className="pt-1 flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                  {club.website_url && (
                    <a
                      href={club.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] text-xs font-semibold hover:bg-[rgba(0,224,255,0.15)] transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Website
                    </a>
                  )}
                  {club.instagram_url && (
                    <a
                      href={club.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-400 text-xs font-semibold hover:bg-pink-500/20 transition-all"
                    >
                      <Instagram className="w-3 h-3" />
                      Instagram
                    </a>
                  )}
                  {club.facebook_url && (
                    <a
                      href={club.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold hover:bg-blue-500/20 transition-all"
                    >
                      <Facebook className="w-3 h-3" />
                      Facebook
                    </a>
                  )}
                  {club.twitter_url && (
                    <a
                      href={club.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white text-xs font-semibold hover:bg-white/10 transition-all"
                    >
                      <Twitter className="w-3 h-3" />
                      Twitter/X
                    </a>
                  )}
                  {club.tiktok_url && (
                    <a
                      href={club.tiktok_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white text-xs font-semibold hover:bg-white/10 transition-all"
                    >
                      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.01a8.16 8.16 0 004.78 1.52V7.08a4.85 4.85 0 01-1.01-.39z"/>
                      </svg>
                      TikTok
                    </a>
                  )}
                  {club.youtube_url && (
                    <a
                      href={club.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 transition-all"
                    >
                      <Youtube className="w-3 h-3" />
                      YouTube
                    </a>
                  )}
                  {club.threads_url && (
                    <a
                      href={club.threads_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/15 text-white text-xs font-semibold hover:bg-white/10 transition-all"
                    >
                      <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.587 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 013.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.578-1.33-.873-2.431-.879h-.01c-.928 0-1.686.216-2.246.64-.48.363-.91.926-1.05 1.87l-2.01-.301c.17-1.267.732-2.222 1.672-2.838.93-.607 2.126-.916 3.556-.916h.018c1.663.007 3.011.498 3.905 1.52.848.97 1.285 2.36 1.298 4.13a7.53 7.53 0 01-.14 1.44c1.097.622 1.97 1.493 2.548 2.788.868 1.982.856 4.912-1.399 7.106-1.746 1.71-3.975 2.571-6.849 2.594l-.023.001z"/>
                      </svg>
                      Threads
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ClubsTab() {
  const navigate = useNavigate();
  const [clubs, setClubs] = useState<FootballClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gender, setGender] = useState<'mens' | 'womens'>('mens');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedClubId, setExpandedClubId] = useState<string | null>(null);
  const [collapsedRegions, setCollapsedRegions] = useState<Set<string>>(new Set());

  const fetchClubs = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('football_clubs')
        .select('*')
        .order('name');
      if (err) throw err;
      setClubs((data || []) as FootballClub[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load clubs');
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchClubs();
      setLoading(false);
    };
    load();
  }, [fetchClubs]);

  const toggleRegion = (region: string) => {
    setCollapsedRegions(prev => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  };

  const filtered = clubs.filter(c => {
    if (c.gender !== gender) return false;
    if (regionFilter !== 'All' && c.region !== regionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.borough || '').toLowerCase().includes(q) ||
        (c.league || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const regionOrder: Array<'North' | 'East' | 'South' | 'West'> = ['North', 'East', 'South', 'West'];
  const activeRegions = regionFilter === 'All'
    ? regionOrder.filter(r => filtered.some(c => c.region === r))
    : ([regionFilter] as Array<'North' | 'East' | 'South' | 'West'>).filter(r => filtered.some(c => c.region === r));

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => <ClubSkeleton key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card p-8 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
        <p className="text-[#B0B8C8] text-sm">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchClubs().finally(() => setLoading(false)); }}
          className="px-4 py-2 rounded-lg bg-[rgba(0,224,255,0.1)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] text-sm font-semibold hover:bg-[rgba(0,224,255,0.2)] transition-all"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B0B8C8] pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search clubs, boroughs, leagues..."
          className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-white placeholder-[#B0B8C8] focus:outline-none focus:border-[#00E0FF] transition-colors"
        />
      </div>

      <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/10">
        <button
          onClick={() => setGender('mens')}
          className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
            gender === 'mens'
              ? 'bg-gradient-to-r from-[#00FF85] to-[#38BDF8] text-black'
              : 'text-[#B0B8C8] hover:text-white'
          }`}
        >
          Men's
        </button>
        <button
          onClick={() => setGender('womens')}
          className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
            gender === 'womens'
              ? 'bg-gradient-to-r from-[#00FF85] to-[#38BDF8] text-black'
              : 'text-[#B0B8C8] hover:text-white'
          }`}
        >
          Women's
        </button>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {REGIONS.map(r => (
          <button
            key={r}
            onClick={() => setRegionFilter(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              regionFilter === r
                ? 'bg-[rgba(0,224,255,0.15)] border-[rgba(0,224,255,0.4)] text-[#00E0FF]'
                : 'border-white/10 text-[#B0B8C8] hover:border-white/20 hover:text-white bg-white/5'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <Shield className="w-10 h-10 text-[#B0B8C8]/20 mx-auto mb-3" />
          <p className="text-[#B0B8C8] text-sm font-semibold">No clubs found</p>
          <p className="text-[#B0B8C8]/50 text-xs mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeRegions.map(region => {
            const regionClubs = filtered.filter(c => c.region === region);
            const isCollapsed = collapsedRegions.has(region);
            return (
              <div key={region}>
                <button
                  onClick={() => toggleRegion(region)}
                  className="flex items-center gap-2 w-full mb-3 group"
                >
                  <span className="text-xs font-bold text-[#00E0FF] uppercase tracking-widest">
                    {region} London
                  </span>
                  <span className="text-[#B0B8C8] text-xs">({regionClubs.length})</span>
                  <div className="flex-1 h-px bg-white/10" />
                  {isCollapsed
                    ? <ChevronDown className="w-3.5 h-3.5 text-[#B0B8C8] group-hover:text-white transition-colors" />
                    : <ChevronUp className="w-3.5 h-3.5 text-[#B0B8C8] group-hover:text-white transition-colors" />
                  }
                </button>
                {!isCollapsed && (
                  <div className="space-y-3">
                    {regionClubs.map(club => (
                      <ClubCard
                        key={club.id}
                        club={club}
                        expanded={expandedClubId === club.id}
                        onToggle={() => setExpandedClubId(
                          expandedClubId === club.id ? null : club.id
                        )}
                        navigate={navigate}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateListingModal({
  onClose,
  onCreated,
  profile,
  userId,
}: {
  onClose: () => void;
  onCreated: (listing: ScoutListing) => void;
  profile: any;
  userId: string;
}) {
  const toast = useToast();
  const [form, setForm] = useState<CreateFormData>(DEFAULT_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const set = (field: keyof CreateFormData, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.title.trim()) { setFormError('Title is required'); return; }
    if (!form.position_needed) { setFormError('Position is required'); return; }
    if (!form.location.trim()) { setFormError('Location is required'); return; }

    setSubmitting(true);
    try {
      const payload = {
        team_id: userId,
        team_name: profile?.username || profile?.full_name || 'Team',
        team_avatar_url: profile?.avatar_url || null,
        title: form.title.trim(),
        description: form.description.trim() || null,
        position_needed: form.position_needed,
        location: form.location.trim(),
        age_min: form.age_min ? parseInt(form.age_min) : null,
        age_max: form.age_max ? parseInt(form.age_max) : null,
        training_days: form.training_days.trim() || null,
        training_times: form.training_times.trim() || null,
        trial_date: form.trial_date || null,
        coin_reward: parseFloat(form.coin_reward) || 0,
        contact_details: form.contact_details.trim() || null,
        whatsapp_link: form.whatsapp_link.trim() || null,
        is_active: true,
        interested_count: 0,
      };

      const { data, error } = await supabase
        .from('scout_listings')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      toast.success('Listing created!');
      onCreated(data as ScoutListing);
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to create listing');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm overflow-y-auto py-4 px-4">
      <div className="glass-container w-full max-w-lg rounded-2xl p-6 space-y-5 my-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Create Listing</h2>
          <button
            onClick={onClose}
            className="text-[#B0B8C8] hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Title <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. Seeking striker for U18 squad"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Position Needed <span className="text-red-400">*</span></label>
            <div className="relative">
              <select
                value={form.position_needed}
                onChange={e => set('position_needed', e.target.value)}
                className={selectClass}
                required
              >
                <option value="">Select position</option>
                {POSITIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                <svg className="w-3.5 h-3.5 text-[#B0B8C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Tell players about your team and what you're looking for..."
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Min Age</label>
              <input
                type="number"
                value={form.age_min}
                onChange={e => set('age_min', e.target.value)}
                placeholder="e.g. 16"
                min={0}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Max Age</label>
              <input
                type="number"
                value={form.age_max}
                onChange={e => set('age_max', e.target.value)}
                placeholder="e.g. 21"
                min={0}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Location <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.location}
              onChange={e => set('location', e.target.value)}
              placeholder="e.g. London, UK"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Training Days</label>
            <input
              type="text"
              value={form.training_days}
              onChange={e => set('training_days', e.target.value)}
              placeholder="Monday and Wednesday"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Training Times</label>
            <input
              type="text"
              value={form.training_times}
              onChange={e => set('training_times', e.target.value)}
              placeholder="7pm to 9pm"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Trial Date</label>
            <input
              type="date"
              value={form.trial_date}
              onChange={e => set('trial_date', e.target.value)}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>

          <div>
            <label className={labelClass}>Coin Reward</label>
            <input
              type="number"
              value={form.coin_reward}
              onChange={e => set('coin_reward', e.target.value)}
              min={0}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Contact Details</label>
            <input
              type="text"
              value={form.contact_details}
              onChange={e => set('contact_details', e.target.value)}
              placeholder="e.g. coach@teamname.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>WhatsApp Link</label>
            <input
              type="text"
              value={form.whatsapp_link}
              onChange={e => set('whatsapp_link', e.target.value)}
              placeholder="https://wa.me/..."
              className={inputClass}
            />
          </div>

          {formError && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-xs">{formError}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold bg-white/5 border border-white/10 text-[#B0B8C8] hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-[#00FF85] to-[#38BDF8] text-black hover:opacity-90 disabled:opacity-60 transition-all"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? 'Creating...' : 'Create Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Scouter() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'listings' | 'clubs'>('listings');

  const [listings, setListings] = useState<ScoutListing[]>([]);
  const [myInterests, setMyInterests] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interestLoading, setInterestLoading] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [positionFilter, setPositionFilter] = useState('');
  const [locationSearch, setLocationSearch] = useState('');

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isVerified = profile?.is_verified ?? false;
  const isScoutTeam = (profile as any)?.is_scout_team ?? false;

  const fetchData = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const [listingsRes, interestsRes] = await Promise.all([
        supabase
          .from('scout_listings')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('scout_interests')
          .select('listing_id')
          .eq('user_id', user.id),
      ]);

      if (listingsRes.error) throw listingsRes.error;
      if (interestsRes.error) throw interestsRes.error;

      setListings(listingsRes.data || []);
      setMyInterests(new Set((interestsRes.data || []).map((r: any) => r.listing_id)));
    } catch (err: any) {
      setError(err?.message || 'Failed to load listings');
    }
  }, [user]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    };
    load();
  }, [fetchData]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await fetchData();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [isRefreshing, fetchData]);

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

  const handleInterested = async (listingId: string) => {
    if (!user || !isVerified) return;
    setInterestLoading(listingId);
    try {
      const { error } = await supabase.rpc('express_scout_interest', { listing_id: listingId });
      if (error) throw error;
      setMyInterests(prev => new Set([...prev, listingId]));
      toast.success('Interest expressed!');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to express interest');
    } finally {
      setInterestLoading(null);
    }
  };

  const handleRemoveListing = async (listingId: string) => {
    if (!user) return;
    setRemoveLoading(listingId);
    try {
      const { error } = await supabase
        .from('scout_listings')
        .update({ is_active: false })
        .eq('id', listingId)
        .eq('team_id', user.id);
      if (error) throw error;
      setListings(prev => prev.filter(l => l.id !== listingId));
      toast.success('Listing removed');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to remove listing');
    } finally {
      setRemoveLoading(null);
    }
  };

  const handleMessage = (teamUserId: string) => {
    navigate(`/chat/${teamUserId}`);
  };

  const handleListingCreated = (newListing: ScoutListing) => {
    setListings(prev => [newListing, ...prev]);
  };

  const filtered = listings.filter(l => {
    if (positionFilter && l.position_needed !== positionFilter) return false;
    if (locationSearch.trim() && !(l.location || '').toLowerCase().includes(locationSearch.trim().toLowerCase())) return false;
    return true;
  });

  return (
    <>
      {showCreateModal && user && (
        <CreateListingModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleListingCreated}
          profile={profile}
          userId={user.id}
        />
      )}

      <div
        className="min-h-screen pb-28"
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
              <h1 className="text-xl font-bold text-white flex-1">Scouter</h1>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              {isScoutTeam && activeTab === 'listings' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#00FF85] to-[#38BDF8] text-black text-xs font-bold hover:opacity-90 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Create Listing
                </button>
              )}
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-0">
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setActiveTab('listings')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'listings'
                    ? 'border-[#00E0FF] text-[#00E0FF]'
                    : 'border-transparent text-[#B0B8C8] hover:text-white'
                }`}
              >
                Listings
              </button>
              <button
                onClick={() => setActiveTab('clubs')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'clubs'
                    ? 'border-[#00E0FF] text-[#00E0FF]'
                    : 'border-transparent text-[#B0B8C8] hover:text-white'
                }`}
              >
                Clubs
              </button>
            </div>
          </div>
        </nav>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
          {activeTab === 'clubs' ? (
            <ClubsTab />
          ) : (
            <>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <select
                    value={positionFilter}
                    onChange={e => setPositionFilter(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">All positions</option>
                    {POSITIONS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                    <svg className="w-3.5 h-3.5 text-[#B0B8C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <input
                  type="text"
                  value={locationSearch}
                  onChange={e => setLocationSearch(e.target.value)}
                  placeholder="Search location..."
                  className="flex-1 px-3 py-2.5 rounded-lg text-sm bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-white placeholder-[#B0B8C8] focus:outline-none focus:border-[#00E0FF] transition-colors"
                />
              </div>

              {loading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => <ListingSkeleton key={i} />)}
                </div>
              ) : error ? (
                <div className="glass-card p-8 text-center space-y-3">
                  <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
                  <p className="text-[#B0B8C8] text-sm">{error}</p>
                  <button
                    onClick={() => { setLoading(true); fetchData().finally(() => setLoading(false)); }}
                    className="px-4 py-2 rounded-lg bg-[rgba(0,224,255,0.1)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] text-sm font-semibold hover:bg-[rgba(0,224,255,0.2)] transition-all"
                  >
                    Retry
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="glass-card p-10 text-center">
                  <MapPin className="w-10 h-10 text-[#B0B8C8]/20 mx-auto mb-3" />
                  <p className="text-[#B0B8C8] text-sm font-semibold">No listings found</p>
                  <p className="text-[#B0B8C8]/50 text-xs mt-1">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filtered.map(listing => {
                    const alreadyInterested = myInterests.has(listing.id);
                    const isProcessing = interestLoading === listing.id;
                    const isRemoving = removeLoading === listing.id;
                    const canAct = isVerified;
                    const isOwner = user?.id === listing.team_id;

                    return (
                      <div key={listing.id} className="glass-card p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          {listing.team_avatar_url ? (
                            <img
                              src={listing.team_avatar_url}
                              alt={listing.team_name}
                              className="w-10 h-10 rounded-full object-cover border-2 border-[rgba(0,224,255,0.3)] flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00FF85] to-[#38BDF8] flex items-center justify-center text-black font-black text-base flex-shrink-0">
                              {listing.team_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-white font-bold text-sm truncate">{listing.team_name}</p>
                            {isOwner && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <Users className="w-3 h-3 text-[#00E0FF]" />
                                <span className="text-[#00E0FF] text-xs font-semibold">
                                  {listing.interested_count} interested
                                </span>
                              </div>
                            )}
                          </div>
                          {isOwner && (
                            <button
                              onClick={() => handleRemoveListing(listing.id)}
                              disabled={isRemoving}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold hover:bg-red-500/20 disabled:opacity-50 transition-all flex-shrink-0"
                              aria-label="Remove listing"
                            >
                              {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                              Remove
                            </button>
                          )}
                        </div>

                        <h3 className="text-white text-lg font-bold leading-tight">{listing.title}</h3>

                        <div className="flex flex-wrap gap-2 items-center">
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold text-[#00E0FF] bg-[rgba(0,224,255,0.1)] border border-[rgba(0,224,255,0.2)]">
                            {listing.position_needed}
                          </span>

                          {listing.coin_reward > 0 && (
                            <span className="px-2.5 py-1 rounded-full text-xs font-bold text-black bg-gradient-to-r from-[#00FF85] to-[#38BDF8]">
                              {listing.coin_reward} coins reward
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          {listing.location && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-[#B0B8C8] flex-shrink-0" />
                              <span className="text-[#B0B8C8] text-xs">{listing.location}</span>
                            </div>
                          )}

                          {(listing.age_min || listing.age_max) && (
                            <p className="text-[#B0B8C8] text-xs">
                              Age: {listing.age_min ?? '?'} – {listing.age_max ?? '?'}
                            </p>
                          )}

                          {listing.trial_date && (
                            <p className="text-yellow-400 text-xs font-semibold">
                              Trial date: {new Date(listing.trial_date).toLocaleDateString()}
                            </p>
                          )}

                          {listing.training_days && (
                            <p className="text-[#B0B8C8] text-xs">
                              Training: {listing.training_days}{listing.training_times ? ` · ${listing.training_times}` : ''}
                            </p>
                          )}

                          {listing.contact_details && (
                            <p className="text-[#B0B8C8] text-xs">Contact: {listing.contact_details}</p>
                          )}

                          {listing.whatsapp_link && (
                            <a
                              href={listing.whatsapp_link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs text-[#00FF85] font-semibold hover:underline"
                            >
                              WhatsApp
                            </a>
                          )}
                        </div>

                        {!isOwner && (
                          <div className="flex gap-2 pt-1">
                            <div className="relative flex-1 group">
                              <button
                                onClick={() => canAct && !alreadyInterested && handleInterested(listing.id)}
                                disabled={!canAct || isProcessing || alreadyInterested}
                                className={`w-full py-2.5 rounded-lg text-sm font-bold transition-all ${
                                  alreadyInterested
                                    ? 'bg-[rgba(0,255,133,0.15)] border border-[#00FF85]/40 text-[#00FF85] cursor-default'
                                    : canAct
                                    ? 'bg-[rgba(0,255,133,0.1)] border border-[rgba(0,255,133,0.25)] text-[#00FF85] hover:bg-[rgba(0,255,133,0.2)]'
                                    : 'bg-white/5 border border-white/10 text-[#B0B8C8]/50 cursor-not-allowed'
                                }`}
                              >
                                {isProcessing ? 'Sending...' : 'Interested'}
                              </button>
                              {!canAct && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-[#0f1829] border border-white/10 text-[#B0B8C8] text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                                  You must be verified to respond
                                </div>
                              )}
                            </div>

                            <div className="relative flex-1 group">
                              <button
                                onClick={() => canAct && handleMessage(listing.team_id)}
                                disabled={!canAct}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold transition-all ${
                                  canAct
                                    ? 'bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] hover:bg-[rgba(0,224,255,0.15)]'
                                    : 'bg-white/5 border border-white/10 text-[#B0B8C8]/50 cursor-not-allowed'
                                }`}
                              >
                                <MessageCircle className="w-4 h-4" />
                                Message
                              </button>
                              {!canAct && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-lg bg-[#0f1829] border border-white/10 text-[#B0B8C8] text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                                  You must be verified to respond
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}
