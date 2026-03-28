import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { DefaultAvatar } from '../ui/DefaultAvatar';
import OnlineStatus from '../OnlineStatus';
import { getMultipleUserPresence, type UserPresence } from '../../lib/presence';
import { Loader2, RefreshCw, MapPin, GraduationCap, Building2, BookOpen, Users, User } from 'lucide-react';

const PAGE_SIZE = 20;

type LondonSubTab = 'boroughs' | 'schools' | 'colleges' | 'universities' | 'managers' | 'players';

interface UserEntry {
  id: string;
  username: string;
  avatar_url: string | null;
  overall_rating: number;
  position: string | null;
  team: string | null;
  last_active: string | null;
  group_label?: string;
}

interface GroupEntry {
  group_label: string;
  avg_rating: number;
  member_count: number;
  members: UserEntry[];
}

function Avatar({
  src, name,
}: { src: string | null; name: string }) {
  return src ? (
    <img
      src={src}
      alt={name}
      className="w-12 h-12 rounded-full object-cover border-2 border-[#00FF85]/50 flex-shrink-0"
      loading="lazy"
    />
  ) : (
    <DefaultAvatar size={48} className="rounded-full border-2 border-[#00FF85]/50 flex-shrink-0" />
  );
}

function UserCard({ entry, presence, onClick }: { entry: UserEntry; presence: UserPresence | undefined; onClick: () => void }) {
  return (
    <div
      className="glass-card p-4 cursor-pointer transition-all hover:border-[rgba(0,224,255,0.4)]"
      onClick={onClick}
    >
      <div className="flex items-center gap-3">
        <Avatar src={entry.avatar_url} name={entry.username} />
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-sm truncate">@{entry.username}</p>
          {entry.group_label && (
            <p className="text-[#00E0FF] text-xs truncate">{entry.group_label}</p>
          )}
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            {entry.position && (
              <span className="text-xs text-cyan-400 font-semibold">{entry.position}</span>
            )}
            {entry.team && (
              <span className="text-xs text-gray-400">{entry.team}</span>
            )}
          </div>
          <OnlineStatus lastActive={presence?.last_seen} size="small" className="mt-0.5" />
        </div>
        <div className="flex-shrink-0 text-right">
          <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
            {entry.overall_rating}
          </div>
          <div className="text-[10px] text-gray-500 font-semibold">OVR</div>
        </div>
      </div>
    </div>
  );
}

const SUB_TABS: { key: LondonSubTab; label: string; icon: React.ReactNode }[] = [
  { key: 'boroughs', label: 'Boroughs', icon: <MapPin className="w-3.5 h-3.5" /> },
  { key: 'schools', label: 'Schools', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { key: 'colleges', label: 'Colleges', icon: <Building2 className="w-3.5 h-3.5" /> },
  { key: 'universities', label: 'Universities', icon: <GraduationCap className="w-3.5 h-3.5" /> },
  { key: 'managers', label: 'Managers', icon: <Users className="w-3.5 h-3.5" /> },
  { key: 'players', label: 'Players', icon: <User className="w-3.5 h-3.5" /> },
];

function privacyFilter(query: any) {
  return query
    .eq('hide_from_leaderboard', false)
    .or('age.gte.18,and(age.gte.11,age.lte.17,hide_from_leaderboard.eq.false)');
}

export default function LondonLeaderboardTab() {
  const navigate = useNavigate();
  const [activeSubTab, setActiveSubTab] = useState<LondonSubTab>('boroughs');
  const [entries, setEntries] = useState<UserEntry[]>([]);
  const [groups, setGroups] = useState<GroupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userPresence, setUserPresence] = useState<Map<string, UserPresence>>(new Map());
  const [pullStart, setPullStart] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData(false);
  }, [activeSubTab]);

  const fetchData = async (append: boolean) => {
    const offset = append ? entries.length : 0;
    if (!append) {
      setLoading(true);
      setEntries([]);
      setGroups([]);
    }
    setFetchError(null);

    try {
      if (activeSubTab === 'boroughs') {
        await fetchBoroughs();
      } else if (activeSubTab === 'schools') {
        await fetchEducation('schools', offset, append);
      } else if (activeSubTab === 'colleges') {
        await fetchEducation('colleges', offset, append);
      } else if (activeSubTab === 'universities') {
        await fetchEducation('universities', offset, append);
      } else if (activeSubTab === 'managers') {
        await fetchManagers(offset, append);
      } else if (activeSubTab === 'players') {
        await fetchPlayers(offset, append);
      }
    } catch (err: any) {
      console.error('Error fetching London leaderboard:', err);
      setFetchError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const fetchBoroughs = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, overall_rating, position, team, last_active, city, age, hide_from_leaderboard, is_city_visible')
      .eq('is_city_visible', true)
      .eq('hide_from_leaderboard', false)
      .not('city', 'is', null);

    if (error) throw error;

    const rows = (data || []).filter(p => {
      if (p.hide_from_leaderboard) return false;
      if (p.age !== null && p.age < 11) return false;
      return true;
    });

    const cityMap = new Map<string, { sum: number; count: number; members: UserEntry[] }>();
    for (const p of rows) {
      const city = p.city as string;
      if (!cityMap.has(city)) cityMap.set(city, { sum: 0, count: 0, members: [] });
      const bucket = cityMap.get(city)!;
      bucket.sum += p.overall_rating || 0;
      bucket.count += 1;
      bucket.members.push({
        id: p.id,
        username: p.username,
        avatar_url: p.avatar_url,
        overall_rating: p.overall_rating ?? 50,
        position: p.position,
        team: p.team,
        last_active: p.last_active,
        group_label: city,
      });
    }

    const grouped: GroupEntry[] = Array.from(cityMap.entries())
      .map(([city, { sum, count, members }]) => ({
        group_label: city,
        avg_rating: Math.round(sum / count),
        member_count: count,
        members: members.sort((a, b) => b.overall_rating - a.overall_rating),
      }))
      .sort((a, b) => b.avg_rating - a.avg_rating);

    setGroups(grouped);
    setHasMore(false);

    const allIds = rows.map(p => p.id);
    if (allIds.length > 0) {
      const presence = await getMultipleUserPresence(allIds);
      setUserPresence(presence);
    }
  };

  const fetchEducation = async (
    type: 'schools' | 'colleges' | 'universities',
    offset: number,
    append: boolean
  ) => {
    const tableMap = { schools: 'schools', colleges: 'colleges', universities: 'universities' };
    const idCol = { schools: 'secondary_school_id', colleges: 'college_id', universities: 'university_id' };
    const nameCol = { schools: 'school_name', colleges: 'college_name', universities: 'university_name' };

    let profileQuery = supabase
      .from('profiles')
      .select(`id, username, avatar_url, overall_rating, position, team, last_active, age, hide_from_leaderboard, ${idCol[type]}`)
      .eq('hide_from_leaderboard', false)
      .not(idCol[type], 'is', null)
      .order('overall_rating', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (type === 'universities') {
      profileQuery = profileQuery.gte('age', 18);
    }

    const { data: profileData, error: profileError } = await profileQuery;
    if (profileError) throw profileError;

    const filtered = (profileData || []).filter(p => {
      if (p.hide_from_leaderboard) return false;
      if (p.age !== null && p.age < 11) return false;
      return true;
    });

    const eduIds = [...new Set(filtered.map(p => (p as any)[idCol[type]]).filter(Boolean))];

    let eduMap = new Map<string, string>();
    if (eduIds.length > 0) {
      const { data: eduData } = await supabase
        .from(tableMap[type])
        .select(`id, ${nameCol[type]}`)
        .in('id', eduIds);
      eduMap = new Map((eduData || []).map((e: any) => [e.id, e[nameCol[type]]]));
    }

    const newEntries: UserEntry[] = filtered.map(p => ({
      id: p.id,
      username: p.username,
      avatar_url: p.avatar_url,
      overall_rating: p.overall_rating ?? 50,
      position: p.position,
      team: p.team,
      last_active: p.last_active,
      group_label: eduMap.get((p as any)[idCol[type]]) || 'Unknown',
    }));

    if (append) {
      setEntries(prev => [...prev, ...newEntries]);
    } else {
      setEntries(newEntries);
    }
    setHasMore(filtered.length === PAGE_SIZE);

    const ids = newEntries.map(e => e.id);
    if (ids.length > 0) {
      const presence = await getMultipleUserPresence(ids);
      setUserPresence(prev => new Map([...prev, ...presence]));
    }
  };

  const fetchManagers = async (offset: number, append: boolean) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, overall_rating, position, team, last_active, age, hide_from_leaderboard')
      .eq('is_manager', true)
      .eq('hide_from_leaderboard', false)
      .order('overall_rating', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const filtered = (data || []).filter(p => {
      if (p.hide_from_leaderboard) return false;
      if (p.age !== null && p.age < 11) return false;
      return true;
    });

    const newEntries: UserEntry[] = filtered.map(p => ({
      id: p.id,
      username: p.username,
      avatar_url: p.avatar_url,
      overall_rating: p.overall_rating ?? 50,
      position: p.position,
      team: p.team,
      last_active: p.last_active,
    }));

    if (append) {
      setEntries(prev => [...prev, ...newEntries]);
    } else {
      setEntries(newEntries);
    }
    setHasMore(filtered.length === PAGE_SIZE);

    const ids = newEntries.map(e => e.id);
    if (ids.length > 0) {
      const presence = await getMultipleUserPresence(ids);
      setUserPresence(prev => new Map([...prev, ...presence]));
    }
  };

  const fetchPlayers = async (offset: number, append: boolean) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, overall_rating, position, team, last_active, age, hide_from_leaderboard')
      .eq('hide_from_leaderboard', false)
      .order('overall_rating', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;

    const filtered = (data || []).filter(p => {
      if (p.hide_from_leaderboard) return false;
      if (p.age !== null && p.age < 11) return false;
      return true;
    });

    const newEntries: UserEntry[] = filtered.map(p => ({
      id: p.id,
      username: p.username,
      avatar_url: p.avatar_url,
      overall_rating: p.overall_rating ?? 50,
      position: p.position,
      team: p.team,
      last_active: p.last_active,
    }));

    if (append) {
      setEntries(prev => [...prev, ...newEntries]);
    } else {
      setEntries(newEntries);
    }
    setHasMore(filtered.length === PAGE_SIZE);

    const ids = newEntries.map(e => e.id);
    if (ids.length > 0) {
      const presence = await getMultipleUserPresence(ids);
      setUserPresence(prev => new Map([...prev, ...presence]));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData(false);
    setRefreshing(false);
  };

  const handleLoadMore = async () => {
    setLoadingMore(true);
    await fetchData(true);
  };

  const handleSubTabChange = (tab: LondonSubTab) => {
    if (tab === activeSubTab) return;
    setActiveSubTab(tab);
    setEntries([]);
    setGroups([]);
    setHasMore(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      setPullStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStart > 0) {
      const distance = e.touches[0].clientY - pullStart;
      if (distance > 0 && distance < 150) setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 80) await handleRefresh();
    setPullStart(0);
    setPullDistance(0);
  };

  const totalCount = activeSubTab === 'boroughs'
    ? groups.reduce((s, g) => s + g.member_count, 0)
    : entries.length;

  return (
    <div
      ref={containerRef}
      className="space-y-6"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullDistance > 0 && (
        <div className="flex justify-center">
          <div className="glass-card px-4 py-2 rounded-full">
            <RefreshCw className={`w-5 h-5 text-cyan-400 ${pullDistance > 80 ? 'animate-spin' : ''}`} />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPin className="w-6 h-6 text-cyan-400" />
          <div>
            <h3 className="text-lg font-bold text-white">London Arena</h3>
            <p className="text-sm text-gray-400">
              {totalCount > 0 ? `${totalCount} members` : 'Community leaderboards'}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 text-gray-400 hover:text-cyan-400 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleSubTabChange(tab.key)}
            className={`
              flex items-center gap-1.5 px-4 py-2 rounded-full font-semibold text-sm whitespace-nowrap transition-all flex-shrink-0
              ${activeSubTab === tab.key
                ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/20'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'}
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
        </div>
      ) : fetchError ? (
        <div className="text-center py-10">
          <p className="text-red-400 mb-4">{fetchError}</p>
          <button
            onClick={() => fetchData(false)}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      ) : activeSubTab === 'boroughs' ? (
        <BoroughsList groups={groups} userPresence={userPresence} onNavigate={(username) => navigate(`/profile/${username}`)} />
      ) : (
        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-gray-400 mb-1">No results</h3>
              <p className="text-gray-500 text-sm">No users found for this category.</p>
            </div>
          ) : (
            entries.map(entry => (
              <UserCard
                key={entry.id}
                entry={entry}
                presence={userPresence.get(entry.id)}
                onClick={() => navigate(`/profile/${entry.username}`)}
              />
            ))
          )}

          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          )}

          {!loadingMore && hasMore && entries.length > 0 && (
            <div className="flex justify-center pt-2">
              <button
                onClick={handleLoadMore}
                className="px-6 py-3 glass-card text-[#00E0FF] font-semibold text-sm rounded-xl transition-all hover:border-[rgba(0,224,255,0.5)]"
              >
                Load More
              </button>
            </div>
          )}

          {!hasMore && entries.length > 0 && (
            <p className="text-center text-gray-500 text-sm py-4">All {entries.length} results loaded</p>
          )}
        </div>
      )}
    </div>
  );
}

function BoroughsList({
  groups,
  userPresence,
  onNavigate,
}: {
  groups: GroupEntry[];
  userPresence: Map<string, UserPresence>;
  onNavigate: (username: string) => void;
}) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  if (groups.length === 0) {
    return (
      <div className="text-center py-16">
        <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-gray-400 mb-1">No borough data</h3>
        <p className="text-gray-500 text-sm">Users must enable city visibility to appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group, index) => (
        <div key={group.group_label} className="glass-card overflow-hidden">
          <button
            className="w-full p-4 flex items-center gap-3 text-left transition-all hover:bg-white/5"
            onClick={() => setExpandedGroup(expandedGroup === group.group_label ? null : group.group_label)}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center">
              <span className="text-sm font-black text-cyan-400">#{index + 1}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">{group.group_label}</p>
              <p className="text-gray-400 text-xs">{group.member_count} member{group.member_count !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-cyan-400">
                {group.avg_rating}
              </div>
              <div className="text-[10px] text-gray-500">AVG OVR</div>
            </div>
          </button>

          {expandedGroup === group.group_label && (
            <div className="border-t border-white/5 p-3 space-y-2">
              {group.members.map(member => (
                <UserCard
                  key={member.id}
                  entry={member}
                  presence={userPresence.get(member.id)}
                  onClick={() => onNavigate(member.username)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
