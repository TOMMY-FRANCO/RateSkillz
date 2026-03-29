import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import PlayerCard, { UserStats } from '../components/PlayerCard';
import { DefaultAvatar } from '../components/ui/DefaultAvatar';
import { getAvatarUrl } from '../lib/avatarStorage';
import { displayUsername } from '../lib/username';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Loader2,
  Shield,
  MapPin,
  Trophy,
  Users,
  Calendar,
  Clock,
  Home,
  Plane,
  CheckCircle,
  Star,
  User,
  ChevronRight,
} from 'lucide-react';

interface FootballClub {
  id: string;
  name: string;
  league: string | null;
  borough: string | null;
  stadium: string | null;
  description: string | null;
  badge_url: string | null;
  is_verified: boolean;
  is_partner: boolean;
}

interface ClubMatch {
  id: string;
  opponent: string;
  match_date: string;
  venue: string | null;
  is_home: boolean;
}

interface ClubPlayer {
  id: string;
  name: string;
  position: string | null;
  jersey_number: number | null;
  avatar_url: string | null;
  is_substitute: boolean;
  overall_rating: number | null;
  is_claimed: boolean;
  profile_id: string | null;
}

interface ClubStaff {
  id: string;
  name: string;
  role: string | null;
  avatar_url: string | null;
  profile_id: string | null;
}

interface FriendProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  avatar_position: { x: number; y: number; scale: number } | null;
  is_verified: boolean;
}

function Countdown({ targetDate }: { targetDate: string }) {
  const [diff, setDiff] = useState('');
  useEffect(() => {
    const calc = () => {
      const ms = new Date(targetDate).getTime() - Date.now();
      if (ms <= 0) { setDiff('Now'); return; }
      const s = Math.floor(ms / 1000);
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = s % 60;
      if (d > 0) setDiff(`${d}d ${h}h ${m}m`);
      else if (h > 0) setDiff(`${h}h ${m}m ${sec}s`);
      else setDiff(`${m}m ${sec}s`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [targetDate]);
  return <span className="font-mono">{diff}</span>;
}

function MiniAvatar({ avatarUrl, avatarPosition, username }: {
  avatarUrl: string | null;
  avatarPosition: { x: number; y: number; scale: number } | null;
  username: string;
}) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!avatarUrl) return;
    getAvatarUrl(avatarUrl).then(setResolvedUrl).catch(() => {});
  }, [avatarUrl]);

  if (resolvedUrl) {
    const pos = avatarPosition || { x: 50, y: 50, scale: 1 };
    return (
      <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 shrink-0">
        <div className="w-full h-full relative">
          <img
            src={resolvedUrl}
            alt={username}
            className="absolute"
            style={{
              width: `${pos.scale * 100}%`,
              height: `${pos.scale * 100}%`,
              left: `${50 - pos.x * pos.scale}%`,
              top: `${50 - pos.y * pos.scale}%`,
              objectFit: 'cover',
            }}
          />
        </div>
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden border border-white/20 shrink-0">
      <DefaultAvatar username={username} size={36} />
    </div>
  );
}

export default function Connections() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [club, setClub] = useState<FootballClub | null>(null);
  const [nextMatch, setNextMatch] = useState<ClubMatch | null>(null);
  const [squad, setSquad] = useState<ClubPlayer[]>([]);
  const [staff, setStaff] = useState<ClubStaff[]>([]);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [connectedCount, setConnectedCount] = useState<number>(0);
  const [userStats, setUserStats] = useState<UserStats | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userTeam = profile?.team;

  const loadAll = useCallback(async (silent = false) => {
    if (!profile || !userTeam) { setLoading(false); return; }
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const [clubRes, statsRes] = await Promise.all([
        supabase
          .from('football_clubs')
          .select('id, name, league, borough, stadium, description, badge_url, is_verified, is_partner')
          .eq('name', userTeam)
          .maybeSingle(),
        supabase
          .from('user_stats')
          .select('id, user_id, pac, sho, pas, dri, def, phy, overall, rating_count, created_at, updated_at')
          .eq('user_id', profile.id)
          .maybeSingle(),
      ]);

      if (clubRes.error) throw clubRes.error;
      const foundClub: FootballClub | null = clubRes.data;
      setClub(foundClub);
      setUserStats(statsRes.data || null);

      const [countRes, friendsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('team', userTeam),
        supabase
          .from('friends')
          .select('user_id, friend_id')
          .eq('status', 'accepted')
          .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`),
      ]);

      setConnectedCount(countRes.count ?? 0);

      if (friendsRes.data && friendsRes.data.length > 0) {
        const otherIds = friendsRes.data.map((f: any) =>
          f.user_id === profile.id ? f.friend_id : f.user_id
        );
        const { data: friendProfiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, avatar_position, is_verified, team')
          .in('id', otherIds)
          .eq('team', userTeam);
        setFriends(
          (friendProfiles || []).map((p: any) => ({
            id: p.id,
            username: p.username,
            avatar_url: p.avatar_url,
            avatar_position: p.avatar_position,
            is_verified: !!p.is_verified,
          }))
        );
      } else {
        setFriends([]);
      }

      if (foundClub) {
        const [matchRes, squadRes, staffRes] = await Promise.all([
          supabase
            .from('club_matches')
            .select('id, opponent, match_date, venue, is_home')
            .eq('club_id', foundClub.id)
            .gt('match_date', new Date().toISOString())
            .order('match_date', { ascending: true })
            .limit(1),
          supabase
            .from('club_players')
            .select('id, name, position, jersey_number, avatar_url, is_substitute, overall_rating, is_claimed, profile_id')
            .eq('club_id', foundClub.id)
            .order('jersey_number', { ascending: true }),
          supabase
            .from('club_staff')
            .select('id, name, role, avatar_url, profile_id')
            .eq('club_id', foundClub.id)
            .order('created_at', { ascending: true }),
        ]);

        setNextMatch(matchRes.data?.[0] || null);
        setSquad(squadRes.data || []);
        setStaff(staffRes.data || []);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load connections');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile, userTeam]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleRefresh = () => loadAll(true);

  const starters = squad.filter(p => !p.is_substitute);
  const subs = squad.filter(p => p.is_substitute);

  if (!userTeam) {
    return (
      <div className="min-h-screen pb-24">
        <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16 gap-3">
              <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-[#B0B8C8] hover:text-[#00E0FF] transition-colors bg-transparent border-none cursor-pointer">
                <ArrowLeft className="w-5 h-5" />
                <span className="font-semibold">Back</span>
              </button>
              <h1 className="text-xl font-bold text-white heading-glow flex-1 text-center">Connections</h1>
              <div className="w-16" />
            </div>
          </div>
        </nav>
        <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center gap-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">No Club Set</h2>
          <p className="text-[#B0B8C8] text-sm leading-relaxed max-w-xs">
            You must pick a club in your profile to access Connections.
          </p>
          <button onClick={() => navigate('/edit-profile')} className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold text-sm hover:opacity-90 transition-all">
            Edit Profile
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* Nav */}
      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 gap-3">
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-[#B0B8C8] hover:text-[#00E0FF] transition-colors bg-transparent border-none cursor-pointer">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-semibold">Back</span>
            </button>
            <h1 className="text-xl font-bold text-white heading-glow flex-1 text-center">Connections</h1>
            <button onClick={handleRefresh} disabled={refreshing} className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors bg-transparent border-none cursor-pointer">
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </nav>

      {loading ? (
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        </div>
      ) : error ? (
        <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center gap-4 text-center">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <p className="text-white font-bold">Something went wrong</p>
          <p className="text-[#B0B8C8] text-sm">{error}</p>
          <button onClick={handleRefresh} className="px-5 py-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 text-sm font-semibold hover:bg-cyan-500/30 transition-all">
            Try Again
          </button>
        </div>
      ) : (
        <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

          {/* Player Card */}
          {profile && (
            <div className="flex justify-center">
              <PlayerCard
                profile={profile}
                userStats={userStats}
                size="medium"
                overallRating={profile.overall_rating}
                isVerified={!!profile.is_verified}
                hasSocialBadge={!!profile.has_social_badge}
              />
            </div>
          )}

          {/* Club Info */}
          <div className="glass-card p-5 space-y-4">
            <div className="flex items-center gap-4">
              {club?.badge_url ? (
                <img src={club.badge_url} alt={club.name} className="w-16 h-16 object-contain rounded-xl bg-white/5 p-1 border border-white/10" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-cyan-600/30 to-blue-700/30 border border-white/10 flex items-center justify-center">
                  <Shield className="w-8 h-8 text-cyan-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-white font-black text-lg leading-tight">{userTeam}</h2>
                  {club?.is_verified && (
                    <CheckCircle className="w-4 h-4 text-cyan-400 shrink-0" />
                  )}
                  {club?.is_partner && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">Partner</span>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 mt-1">
                  {club?.league && (
                    <div className="flex items-center gap-1.5 text-[#B0B8C8] text-xs">
                      <Trophy className="w-3 h-3 shrink-0" />
                      <span>{club.league}</span>
                    </div>
                  )}
                  {club?.borough && (
                    <div className="flex items-center gap-1.5 text-[#B0B8C8] text-xs">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span>{club.borough}</span>
                    </div>
                  )}
                  {club?.stadium && (
                    <div className="flex items-center gap-1.5 text-[#B0B8C8] text-xs">
                      <Home className="w-3 h-3 shrink-0" />
                      <span>{club.stadium}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!club && (
              <p className="text-[#B0B8C8] text-xs bg-white/5 rounded-xl px-3 py-2">
                No club profile found for <span className="text-white font-semibold">{userTeam}</span> — stats are limited until the club is registered.
              </p>
            )}

            {club?.description && (
              <p className="text-[#B0B8C8] text-sm leading-relaxed">{club.description}</p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
                <Users className="w-4 h-4 text-cyan-400" />
                <span className="text-cyan-300 font-bold text-sm">{connectedCount}</span>
                <span className="text-cyan-400/70 text-xs">members</span>
              </div>
            </div>
          </div>

          {/* Next Match */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              Next Match
            </h3>
            {nextMatch ? (
              <div className="rounded-xl bg-gradient-to-r from-blue-900/60 to-cyan-900/60 border border-cyan-400/20 p-4 space-y-2">
                <div className="flex items-center gap-3">
                  {nextMatch.is_home ? (
                    <Home className="w-4 h-4 text-green-400 shrink-0" />
                  ) : (
                    <Plane className="w-4 h-4 text-orange-400 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm">
                      {nextMatch.is_home ? `${userTeam} vs ${nextMatch.opponent}` : `${nextMatch.opponent} vs ${userTeam}`}
                    </p>
                    <p className="text-[#B0B8C8] text-xs">
                      {nextMatch.is_home ? 'Home' : 'Away'}
                      {nextMatch.venue ? ` · ${nextMatch.venue}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-3 h-3 text-cyan-400 shrink-0" />
                  <span className="text-[#B0B8C8]">
                    {new Date(nextMatch.match_date).toLocaleDateString('en-GB', {
                      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                    })}
                    {' · '}
                    {new Date(nextMatch.match_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                  <span className="text-amber-300 font-semibold">
                    <Countdown targetDate={nextMatch.match_date} />
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Calendar className="w-8 h-8 text-gray-600" />
                <p className="text-[#B0B8C8] text-sm">No upcoming matches scheduled</p>
              </div>
            )}
          </div>

          {/* Friends in same club */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Friends at {userTeam}
              {friends.length > 0 && (
                <span className="ml-auto text-cyan-400 font-bold text-sm">{friends.length}</span>
              )}
            </h3>
            {friends.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Users className="w-8 h-8 text-gray-600" />
                <p className="text-[#B0B8C8] text-sm">None of your friends are at this club</p>
                <button onClick={() => navigate('/search-friends')} className="text-cyan-400 text-xs font-semibold hover:underline">
                  Find Friends
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {friends.map(f => (
                  <button
                    key={f.id}
                    onClick={() => navigate(`/profile/${f.id}`)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors text-left"
                  >
                    <MiniAvatar avatarUrl={f.avatar_url} avatarPosition={f.avatar_position} username={f.username} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white text-sm font-semibold truncate">{displayUsername(f.username)}</span>
                        {f.is_verified && <CheckCircle className="w-3 h-3 text-cyan-400 shrink-0" />}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Squad */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Squad
              {squad.length > 0 && (
                <span className="ml-auto text-[#B0B8C8] text-xs font-normal">{squad.length} players</span>
              )}
            </h3>
            {squad.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <User className="w-8 h-8 text-gray-600" />
                <p className="text-[#B0B8C8] text-sm">No squad registered yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {starters.length > 0 && (
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider px-1 pt-1">Starting XI</p>
                )}
                {starters.map(p => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    onNavigate={p.profile_id ? () => navigate(`/profile/${p.profile_id}`) : undefined}
                  />
                ))}
                {subs.length > 0 && (
                  <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider px-1 pt-2">Substitutes</p>
                )}
                {subs.map(p => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    onNavigate={p.profile_id ? () => navigate(`/profile/${p.profile_id}`) : undefined}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Staff */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="text-white font-bold text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-400" />
              Staff
              {staff.length > 0 && (
                <span className="ml-auto text-[#B0B8C8] text-xs font-normal">{staff.length} members</span>
              )}
            </h3>
            {staff.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Star className="w-8 h-8 text-gray-600" />
                <p className="text-[#B0B8C8] text-sm">No staff listed yet</p>
              </div>
            ) : (
              <div className="space-y-1">
                {staff.map(s => (
                  <StaffRow
                    key={s.id}
                    member={s}
                    onNavigate={s.profile_id ? () => navigate(`/profile/${s.profile_id}`) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ player, onNavigate }: { player: ClubPlayer; onNavigate?: () => void }) {
  const Tag = onNavigate ? 'button' : 'div';
  return (
    <Tag
      onClick={onNavigate}
      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl transition-colors text-left ${
        onNavigate ? 'hover:bg-white/5 cursor-pointer' : ''
      }`}
    >
      <div className="w-7 h-7 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
        {player.jersey_number != null ? (
          <span className="text-white text-xs font-bold">{player.jersey_number}</span>
        ) : (
          <User className="w-3.5 h-3.5 text-gray-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-semibold truncate">{player.name}</span>
          {player.is_claimed && (
            <CheckCircle className="w-3 h-3 text-cyan-400 shrink-0" />
          )}
        </div>
        {player.position && (
          <span className="text-gray-500 text-xs">{player.position}</span>
        )}
      </div>
      {player.overall_rating != null && (
        <span className="text-xs font-bold text-amber-400 shrink-0">{player.overall_rating}</span>
      )}
      {onNavigate && <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />}
    </Tag>
  );
}

function StaffRow({ member, onNavigate }: { member: ClubStaff; onNavigate?: () => void }) {
  const Tag = onNavigate ? 'button' : 'div';
  return (
    <Tag
      onClick={onNavigate}
      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl transition-colors text-left ${
        onNavigate ? 'hover:bg-white/5 cursor-pointer' : ''
      }`}
    >
      <div className="w-7 h-7 rounded-lg bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
        <User className="w-3.5 h-3.5 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-white text-sm font-semibold truncate block">{member.name}</span>
        {member.role && (
          <span className="text-gray-500 text-xs">{member.role}</span>
        )}
      </div>
      {onNavigate && <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />}
    </Tag>
  );
}
