import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowLeft, Search, X, Loader2, UserPlus, UserCheck, UserX, Clock, Eye,
  ChevronLeft, ChevronRight, ShieldCheck, Wifi,
} from 'lucide-react';
import { sendFriendRequest, removeFriend } from '../lib/friendRequests';
import { displayUsername } from '../lib/username';

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
  overall_rating: number;
  position: string | null;
  team: string | null;
  is_verified: boolean;
  updated_at: string;
}

type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

interface FriendStatusEntry {
  status: FriendStatus;
  id: string | null;
}

interface DropdownOption {
  id: string;
  name: string;
}

const POSITIONS = ['AM', 'SW', 'CB', 'CF', 'LB', 'RB'];

const RATING_TIERS = [
  { label: '0-10', min: 0, max: 10 },
  { label: '10-20', min: 10, max: 20 },
  { label: '20-30', min: 20, max: 30 },
  { label: '30-40', min: 30, max: 40 },
  { label: '40-50', min: 40, max: 50 },
  { label: '50-60', min: 50, max: 60 },
  { label: '60-70', min: 60, max: 70 },
  { label: '70-80', min: 70, max: 80 },
  { label: '80-90', min: 80, max: 90 },
  { label: '90-95', min: 90, max: 95 },
  { label: '96', min: 96, max: 96 },
  { label: '97', min: 97, max: 97 },
  { label: '98', min: 98, max: 98 },
  { label: '99', min: 99, max: 99 },
  { label: '100', min: 100, max: 100 },
];

const RESULTS_PER_PAGE = 20;

function getIsOnline(updatedAt: string): boolean {
  return Date.now() - new Date(updatedAt).getTime() < 5 * 60 * 1000;
}

function getTimeAgo(dateString: string): string {
  const diffMs = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMs / 3600000);
  const days = Math.floor(diffMs / 86400000);
  if (mins < 5) return 'Online now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
}

function UserAvatar({ src, name }: { src: string | null; name: string }) {
  return src ? (
    <img
      src={src}
      alt={name}
      className="w-12 h-12 rounded-full object-cover border-2 border-[rgba(0,224,255,0.4)] flex-shrink-0"
      loading="lazy"
    />
  ) : (
    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#00FF85] to-[#00E0FF] flex items-center justify-center text-black font-black text-base border-2 border-[rgba(0,224,255,0.4)] flex-shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

const selectClass = `w-full px-3 py-2.5 rounded-lg text-sm font-semibold
  bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)]
  text-white focus:outline-none focus:border-[#00E0FF]
  appearance-none cursor-pointer transition-colors
  hover:border-[rgba(0,224,255,0.5)]`;

export default function SearchFriends() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [position, setPosition] = useState('');
  const [team, setTeam] = useState('');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [ratingTier, setRatingTier] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [collegeId, setCollegeId] = useState('');
  const [universityId, setUniversityId] = useState('');

  const [teams, setTeams] = useState<string[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsFailed, setTeamsFailed] = useState(false);
  const [schools, setSchools] = useState<DropdownOption[]>([]);
  const [schoolsLoading, setSchoolsLoading] = useState(true);
  const [schoolsFailed, setSchoolsFailed] = useState(false);
  const [colleges, setColleges] = useState<DropdownOption[]>([]);
  const [collegesLoading, setCollegesLoading] = useState(true);
  const [collegesFailed, setCollegesFailed] = useState(false);
  const [universities, setUniversities] = useState<DropdownOption[]>([]);
  const [universitiesLoading, setUniversitiesLoading] = useState(true);
  const [universitiesFailed, setUniversitiesFailed] = useState(false);

  const [friendStatuses, setFriendStatuses] = useState<Map<string, FriendStatusEntry>>(new Map());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadTeams();
    loadDropdownOptions();
  }, []);

  const loadTeams = async () => {
    setTeamsLoading(true);
    setTeamsFailed(false);
    const { data, error } = await supabase
      .from('profiles')
      .select('team')
      .not('team', 'is', null)
      .neq('team', '');
    if (error || !data) {
      setTeamsFailed(true);
    } else {
      const unique = [...new Set(data.map((r: any) => r.team as string).filter(Boolean))].sort();
      setTeams(unique);
    }
    setTeamsLoading(false);
  };

  const loadSchools = async () => {
    setSchoolsLoading(true);
    setSchoolsFailed(false);
    const { data, error } = await supabase
      .from('schools')
      .select('id, school_name')
      .order('school_name');
    if (error || !data) {
      setSchoolsFailed(true);
    } else {
      setSchools(data.map((r: any) => ({ id: r.id, name: r.school_name })));
    }
    setSchoolsLoading(false);
  };

  const loadColleges = async () => {
    setCollegesLoading(true);
    setCollegesFailed(false);
    const { data, error } = await supabase
      .from('colleges')
      .select('id, college_name')
      .order('college_name');
    if (error || !data) {
      setCollegesFailed(true);
    } else {
      setColleges(data.map((r: any) => ({ id: r.id, name: r.college_name })));
    }
    setCollegesLoading(false);
  };

  const loadUniversities = async () => {
    setUniversitiesLoading(true);
    setUniversitiesFailed(false);
    const { data, error } = await supabase
      .from('universities')
      .select('id, university_name')
      .order('university_name');
    if (error || !data) {
      setUniversitiesFailed(true);
    } else {
      setUniversities(data.map((r: any) => ({ id: r.id, name: r.university_name })));
    }
    setUniversitiesLoading(false);
  };

  const loadDropdownOptions = () => {
    loadSchools();
    loadColleges();
    loadUniversities();
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCurrentPage(1);
      performSearch(1);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, position, team, verifiedOnly, onlineOnly, ratingTier, schoolId, collegeId, universityId]);

  useEffect(() => {
    performSearch(currentPage);
  }, [currentPage]);

  const getEducationUserIds = async (): Promise<string[] | null> => {
    if (!schoolId && !collegeId && !universityId) return null;

    let q = supabase.from('profiles').select('id');
    if (schoolId) q = q.eq('secondary_school_id', schoolId);
    if (collegeId) q = q.eq('college_id', collegeId);
    if (universityId) q = q.eq('university_id', universityId);

    const { data } = await q;
    return data ? data.map((r: any) => r.id) : [];
  };

  const performSearch = async (page: number) => {
    if (!user) return;
    setLoading(true);
    setHasSearched(true);
    try {
      const educationIds = await getEducationUserIds();
      if (educationIds !== null && educationIds.length === 0) {
        setResults([]);
        setTotalResults(0);
        setLoading(false);
        return;
      }

      let q = supabase
        .from('searchable_users_cache')
        .select('user_id, username, avatar_url, overall_rating, position, team, is_verified, updated_at', { count: 'exact' })
        .neq('user_id', user.id);

      if (query.trim()) q = q.ilike('username', `%${query.trim()}%`);
      if (position) q = q.eq('position', position);
      if (team) q = q.eq('team', team);
      if (verifiedOnly) q = q.eq('is_verified', true);

      if (ratingTier) {
        const tier = RATING_TIERS.find(t => t.label === ratingTier);
        if (tier) q = q.gte('overall_rating', tier.min).lte('overall_rating', tier.max);
      }

      if (onlineOnly) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        q = q.gte('updated_at', fiveMinAgo);
      }

      if (educationIds !== null) {
        q = q.in('user_id', educationIds);
      }

      q = q.order('overall_rating', { ascending: false });
      const from = (page - 1) * RESULTS_PER_PAGE;
      q = q.range(from, from + RESULTS_PER_PAGE - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      const mapped: SearchResult[] = (data || []).map((r: any) => ({
        id: r.user_id,
        username: r.username,
        avatar_url: r.avatar_url,
        overall_rating: r.overall_rating,
        position: r.position,
        team: r.team,
        is_verified: r.is_verified,
        updated_at: r.updated_at,
      }));

      setResults(mapped);
      setTotalResults(count || 0);
      if (mapped.length > 0) loadFriendStatuses(mapped.map(r => r.id));
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  const loadFriendStatuses = async (userIds: string[]) => {
    if (!user || userIds.length === 0) return;
    try {
      const { data } = await supabase
        .from('friends')
        .select('id, user_id, friend_id, status')
        .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

      const map = new Map<string, FriendStatusEntry>();
      for (const uid of userIds) map.set(uid, { status: 'none', id: null });

      if (data) {
        for (const row of data) {
          const other = row.user_id === user.id ? row.friend_id : row.user_id;
          if (!userIds.includes(other)) continue;
          if (row.status === 'accepted') {
            map.set(other, { status: 'accepted', id: row.id });
          } else if (row.status === 'pending') {
            map.set(other, {
              status: row.user_id === user.id ? 'pending_sent' : 'pending_received',
              id: row.id,
            });
          }
        }
      }
      setFriendStatuses(map);
    } catch (err) {
      console.error('Error loading friend statuses:', err);
    }
  };

  const handleSendRequest = async (recipientId: string) => {
    setActionLoading(recipientId);
    try {
      const { data, error } = await sendFriendRequest(recipientId);
      if (error) throw error;
      setFriendStatuses(prev => {
        const next = new Map(prev);
        next.set(recipientId, { status: 'pending_sent', id: (data as any)?.id || null });
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelRequest = async (recipientId: string, friendshipId: string) => {
    setActionLoading(recipientId);
    try {
      const { error } = await removeFriend(friendshipId);
      if (error) throw error;
      setFriendStatuses(prev => {
        const next = new Map(prev);
        next.set(recipientId, { status: 'none', id: null });
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleAcceptRequest = async (recipientId: string, friendshipId: string) => {
    setActionLoading(recipientId);
    try {
      const { error } = await supabase.from('friends').update({ status: 'accepted' }).eq('id', friendshipId);
      if (error) throw error;
      setFriendStatuses(prev => {
        const next = new Map(prev);
        next.set(recipientId, { status: 'accepted', id: friendshipId });
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveFriend = async (recipientId: string, friendshipId: string) => {
    if (!confirm('Remove this friend?')) return;
    setActionLoading(recipientId);
    try {
      const { error } = await removeFriend(friendshipId);
      if (error) throw error;
      setFriendStatuses(prev => {
        const next = new Map(prev);
        next.set(recipientId, { status: 'none', id: null });
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const clearAll = () => {
    setQuery('');
    setPosition('');
    setTeam('');
    setVerifiedOnly(false);
    setOnlineOnly(false);
    setRatingTier('');
    setSchoolId('');
    setCollegeId('');
    setUniversityId('');
    setCurrentPage(1);
  };

  const hasActiveFilters = position || team || verifiedOnly || onlineOnly || ratingTier || schoolId || collegeId || universityId;
  const totalPages = Math.ceil(totalResults / RESULTS_PER_PAGE);

  return (
    <div className="min-h-screen">
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
            <h1 className="text-xl font-bold text-white">Search Friends</h1>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">

        {/* Search input */}
        <div className="glass-container p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B0B8C8]" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by username"
              autoComplete="off"
              className="w-full pl-10 pr-10 py-3 bg-transparent text-white placeholder-[#B0B8C8] text-sm focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#B0B8C8] hover:text-white transition-colors"
                aria-label="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="glass-container p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#B0B8C8] uppercase tracking-wider">Filters</span>
            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>

          {/* Row 1: Position + Team + Rating Tier */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#B0B8C8]">Position</label>
              <div className="relative">
                <select
                  value={position}
                  onChange={e => { setPosition(e.target.value); setCurrentPage(1); }}
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
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#B0B8C8]">Team</label>
              {teamsFailed ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[rgba(15,24,41,0.85)] border border-red-500/30">
                  <span className="text-xs text-red-400 flex-1">Failed to load</span>
                  <button
                    onClick={loadTeams}
                    className="text-xs font-semibold text-[#00E0FF] hover:text-white transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={team}
                    onChange={e => { setTeam(e.target.value); setCurrentPage(1); }}
                    disabled={teamsLoading}
                    className={`${selectClass} ${teamsLoading ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    <option value="">{teamsLoading ? 'Loading...' : 'All teams'}</option>
                    {teams.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                    {teamsLoading ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#B0B8C8] animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5 text-[#B0B8C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#B0B8C8]">Rating Tier</label>
              <div className="relative">
                <select
                  value={ratingTier}
                  onChange={e => { setRatingTier(e.target.value); setCurrentPage(1); }}
                  className={selectClass}
                >
                  <option value="">All ratings</option>
                  {RATING_TIERS.map(t => (
                    <option key={t.label} value={t.label}>{t.label}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                  <svg className="w-3.5 h-3.5 text-[#B0B8C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: School + College + University */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#B0B8C8]">School</label>
              {schoolsFailed ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[rgba(15,24,41,0.85)] border border-red-500/30">
                  <span className="text-xs text-red-400 flex-1">Failed to load</span>
                  <button onClick={loadSchools} className="text-xs font-semibold text-[#00E0FF] hover:text-white transition-colors">Retry</button>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={schoolId}
                    onChange={e => { setSchoolId(e.target.value); setCurrentPage(1); }}
                    disabled={schoolsLoading}
                    className={`${selectClass} ${schoolsLoading ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    <option value="">{schoolsLoading ? 'Loading...' : schools.length === 0 ? 'No schools available' : 'All schools'}</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                    {schoolsLoading ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#B0B8C8] animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5 text-[#B0B8C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#B0B8C8]">College</label>
              {collegesFailed ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[rgba(15,24,41,0.85)] border border-red-500/30">
                  <span className="text-xs text-red-400 flex-1">Failed to load</span>
                  <button onClick={loadColleges} className="text-xs font-semibold text-[#00E0FF] hover:text-white transition-colors">Retry</button>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={collegeId}
                    onChange={e => { setCollegeId(e.target.value); setCurrentPage(1); }}
                    disabled={collegesLoading}
                    className={`${selectClass} ${collegesLoading ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    <option value="">{collegesLoading ? 'Loading...' : colleges.length === 0 ? 'No colleges available' : 'All colleges'}</option>
                    {colleges.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                    {collegesLoading ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#B0B8C8] animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5 text-[#B0B8C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-[#B0B8C8]">University</label>
              {universitiesFailed ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[rgba(15,24,41,0.85)] border border-red-500/30">
                  <span className="text-xs text-red-400 flex-1">Failed to load</span>
                  <button onClick={loadUniversities} className="text-xs font-semibold text-[#00E0FF] hover:text-white transition-colors">Retry</button>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={universityId}
                    onChange={e => { setUniversityId(e.target.value); setCurrentPage(1); }}
                    disabled={universitiesLoading}
                    className={`${selectClass} ${universitiesLoading ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    <option value="">{universitiesLoading ? 'Loading...' : universities.length === 0 ? 'No universities available' : 'All universities'}</option>
                    {universities.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                    {universitiesLoading ? (
                      <Loader2 className="w-3.5 h-3.5 text-[#B0B8C8] animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5 text-[#B0B8C8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 3: Toggle buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => { setVerifiedOnly(v => !v); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                verifiedOnly
                  ? 'bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black shadow-[0_0_12px_rgba(0,224,255,0.35)]'
                  : 'bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-[#B0B8C8] hover:border-[#00E0FF] hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Verified only
            </button>

            <button
              onClick={() => { setOnlineOnly(v => !v); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                onlineOnly
                  ? 'bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black shadow-[0_0_12px_rgba(0,224,255,0.35)]'
                  : 'bg-[rgba(15,24,41,0.85)] border border-[rgba(0,224,255,0.2)] text-[#B0B8C8] hover:border-[#00E0FF] hover:text-white'
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              Online now
            </button>
          </div>
        </div>

        {/* Results count */}
        {hasSearched && !loading && (
          <p className="text-[#B0B8C8] text-xs px-1">
            {totalResults > 0
              ? <><span className="text-white font-bold">{totalResults}</span> {totalResults === 1 ? 'player' : 'players'} found{totalPages > 1 ? ` · Page ${currentPage} of ${totalPages}` : ''}</>
              : 'No players found'
            }
          </p>
        )}

        {/* Results */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-card p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/10 flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-white/10 rounded" />
                    <div className="h-3 w-20 bg-white/10 rounded" />
                  </div>
                  <div className="h-9 w-24 bg-white/10 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        ) : hasSearched && results.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Search className="w-10 h-10 text-[#B0B8C8]/20 mx-auto mb-3" />
            <p className="text-[#B0B8C8] text-sm font-semibold">No players found</p>
            <p className="text-[#B0B8C8]/50 text-xs mt-1">Try a different username or adjust the filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {results.map(result => {
              const fs = friendStatuses.get(result.id);
              const isProcessing = actionLoading === result.id;
              const online = getIsOnline(result.updated_at);

              return (
                <div key={result.id} className="glass-card p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <UserAvatar src={result.avatar_url} name={result.username} />
                      {online && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00FF85] rounded-full border-2 border-[#0f1829]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="text-white font-bold text-sm truncate max-w-[160px]">
                          {displayUsername(result.username)}
                        </span>
                        {result.is_verified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-[#00E0FF] flex-shrink-0" />
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black text-black bg-gradient-to-r from-[#00FF85] to-[#00E0FF] px-1.5 py-0.5 rounded">
                          {result.overall_rating}
                        </span>
                        {result.position && (
                          <span className="text-[10px] font-bold text-[#00E0FF] bg-[rgba(0,224,255,0.1)] px-1.5 py-0.5 rounded border border-[rgba(0,224,255,0.2)]">
                            {result.position}
                          </span>
                        )}
                        {result.team && (
                          <span className="text-[10px] text-[#B0B8C8] truncate max-w-[100px]">
                            {result.team}
                          </span>
                        )}
                        <span className={`text-[10px] ${online ? 'text-[#00FF85]' : 'text-[#B0B8C8]/60'}`}>
                          {getTimeAgo(result.updated_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => navigate(`/profile/${result.username}`)}
                        className="p-2 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] hover:bg-[rgba(0,224,255,0.15)] transition-all"
                        aria-label="View profile"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {(() => {
                        if (fs?.status === 'accepted') {
                          return (
                            <button
                              onClick={() => handleRemoveFriend(result.id, fs.id!)}
                              disabled={isProcessing}
                              className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 disabled:opacity-50 transition-all"
                              aria-label="Remove friend"
                            >
                              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                            </button>
                          );
                        }
                        if (fs?.status === 'pending_sent') {
                          return (
                            <button
                              onClick={() => handleCancelRequest(result.id, fs.id!)}
                              disabled={isProcessing}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[rgba(255,255,255,0.05)] border border-white/10 text-[#B0B8C8] text-xs font-semibold hover:bg-white/10 disabled:opacity-50 transition-all"
                            >
                              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
                              Pending
                            </button>
                          );
                        }
                        if (fs?.status === 'pending_received') {
                          return (
                            <button
                              onClick={() => handleAcceptRequest(result.id, fs.id!)}
                              disabled={isProcessing}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black text-xs font-bold hover:opacity-90 disabled:opacity-50 transition-all"
                            >
                              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                              Accept
                            </button>
                          );
                        }
                        return (
                          <button
                            onClick={() => handleSendRequest(result.id)}
                            disabled={isProcessing}
                            className="p-2 rounded-lg bg-[rgba(0,255,133,0.1)] border border-[rgba(0,255,133,0.25)] text-[#00FF85] hover:bg-[rgba(0,255,133,0.2)] disabled:opacity-50 transition-all"
                            aria-label="Add friend"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !loading && (
          <div className="glass-card p-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[rgba(0,224,255,0.15)] transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <span className="text-[#B0B8C8] text-sm font-semibold">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] text-[#00E0FF] text-sm font-semibold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[rgba(0,224,255,0.15)] transition-all"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
