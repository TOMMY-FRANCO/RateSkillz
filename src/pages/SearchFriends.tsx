import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Search, Filter, X, Loader2, UserPlus, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import { sendFriendRequest } from '../lib/friendRequests';
import { ShimmerBar, StaggerItem, SlowLoadMessage } from '../components/ui/Shimmer';
import { SkeletonAvatar } from '../components/ui/SkeletonPresets';

interface SearchFilters {
  username: string;
  overallRangeMin: number | null;
  overallRangeMax: number | null;
  onlineStatus: 'any' | 'recent';
  team: string;
  pacMin: number | null;
  shoMin: number | null;
  pasMin: number | null;
  driMin: number | null;
  defMin: number | null;
  phyMin: number | null;
  coinSort: 'any' | 'high_to_low' | 'low_to_high';
  positions: string[];
  managersOnly: boolean;
  secondarySchoolId: string;
  collegeId: string;
  universityId: string;
}

interface EducationOption {
  id: string;
  name: string;
}

interface SearchResult {
  id: string;
  username: string;
  avatar_url: string | null;
  overall_rating: number;
  position: string | null;
  team: string | null;
  coin_balance: number;
  is_manager: boolean;
  manager_wins: number;
  last_active: string;
  is_verified: boolean;
  has_social_badge: boolean;
  pac?: number;
  sho?: number;
  pas?: number;
  dri?: number;
  def?: number;
  phy?: number;
}

const RESULTS_PER_PAGE = 20;

const OVERALL_RANGES = [
  { label: '1-10', min: 1, max: 10 },
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

const POSITIONS = ['AM', 'SW', 'CB', 'CF', 'LB', 'RB'];

export default function SearchFriends() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  const [filters, setFilters] = useState<SearchFilters>({
    username: '',
    overallRangeMin: null,
    overallRangeMax: null,
    onlineStatus: 'any',
    team: '',
    pacMin: null,
    shoMin: null,
    pasMin: null,
    driMin: null,
    defMin: null,
    phyMin: null,
    coinSort: 'any',
    positions: [],
    managersOnly: false,
    secondarySchoolId: '',
    collegeId: '',
    universityId: '',
  });

  const [schoolSearch, setSchoolSearch] = useState('');
  const [collegeSearch, setCollegeSearch] = useState('');
  const [universitySearch, setUniversitySearch] = useState('');

  const [schoolOptions, setSchoolOptions] = useState<EducationOption[]>([]);
  const [collegeOptions, setCollegeOptions] = useState<EducationOption[]>([]);
  const [universityOptions, setUniversityOptions] = useState<EducationOption[]>([]);

  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false);
  const [showCollegeDropdown, setShowCollegeDropdown] = useState(false);
  const [showUniversityDropdown, setShowUniversityDropdown] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [filters, currentPage]);

  const performSearch = async () => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from('searchable_users_cache')
        .select('*', { count: 'exact' })
        .neq('user_id', user.id);

      if (filters.username) {
        query = query.ilike('username', `%${filters.username}%`);
      }

      if (filters.overallRangeMin !== null && filters.overallRangeMax !== null) {
        query = query.gte('overall_rating', filters.overallRangeMin).lte('overall_rating', filters.overallRangeMax);
      }

      if (filters.team) {
        query = query.ilike('team', `%${filters.team}%`);
      }

      if (filters.positions.length > 0) {
        query = query.in('position', filters.positions);
      }

      if (filters.onlineStatus === 'recent') {
        query = query.order('updated_at', { ascending: false });
      } else {
        query = query.order('overall_rating', { ascending: false });
      }

      const from = (currentPage - 1) * RESULTS_PER_PAGE;
      const to = from + RESULTS_PER_PAGE - 1;
      query = query.range(from, to);

      const { data: cacheData, error: cacheError, count } = await query;

      if (cacheError) throw cacheError;

      const mappedResults = (cacheData || []).map((row: any) => ({
        id: row.user_id,
        username: row.username,
        avatar_url: row.avatar_url,
        overall_rating: row.overall_rating,
        position: row.position,
        team: row.team,
        coin_balance: 0,
        is_manager: false,
        manager_wins: 0,
        last_active: row.updated_at,
        is_verified: row.is_verified,
        has_social_badge: false,
        pac: undefined,
        sho: undefined,
        pas: undefined,
        dri: undefined,
        def: undefined,
        phy: undefined,
      }));

      setResults(mappedResults);
      setTotalResults(count || 0);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSendFriendRequest = async (recipientId: string) => {
    if (!user) return;

    setSendingRequest(recipientId);
    try {
      await sendFriendRequest(user.id, recipientId);
      alert('Friend request sent!');
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('Failed to send friend request');
    } finally {
      setSendingRequest(null);
    }
  };

  const togglePosition = (position: string) => {
    setFilters((prev) => ({
      ...prev,
      positions: prev.positions.includes(position)
        ? prev.positions.filter((p) => p !== position)
        : [...prev.positions, position],
    }));
    setCurrentPage(1);
  };

  const selectOverallRange = (min: number, max: number) => {
    setFilters((prev) => ({
      ...prev,
      overallRangeMin: min,
      overallRangeMax: max,
    }));
    setCurrentPage(1);
  };

  const searchSchools = async (term: string) => {
    if (term.length < 2) {
      setSchoolOptions([]);
      return;
    }
    const { data } = await supabase
      .from('schools')
      .select('id, school_name')
      .ilike('school_name', `%${term}%`)
      .order('school_name')
      .limit(50);

    setSchoolOptions(data?.map(s => ({ id: s.id, name: s.school_name })) || []);
  };

  const searchColleges = async (term: string) => {
    if (term.length < 2) {
      setCollegeOptions([]);
      return;
    }
    const { data } = await supabase
      .from('colleges')
      .select('id, college_name')
      .ilike('college_name', `%${term}%`)
      .order('college_name')
      .limit(50);

    setCollegeOptions(data?.map(c => ({ id: c.id, name: c.college_name })) || []);
  };

  const searchUniversities = async (term: string) => {
    if (term.length < 2) {
      setUniversityOptions([]);
      return;
    }
    const { data } = await supabase
      .from('universities')
      .select('id, university_name')
      .ilike('university_name', `%${term}%`)
      .order('university_name')
      .limit(50);

    setUniversityOptions(data?.map(u => ({ id: u.id, name: u.university_name })) || []);
  };

  const handleSchoolSearch = (value: string) => {
    setSchoolSearch(value);
    setShowSchoolDropdown(true);
    searchSchools(value);
  };

  const handleCollegeSearch = (value: string) => {
    setCollegeSearch(value);
    setShowCollegeDropdown(true);
    searchColleges(value);
  };

  const handleUniversitySearch = (value: string) => {
    setUniversitySearch(value);
    setShowUniversityDropdown(true);
    searchUniversities(value);
  };

  const selectSchool = (option: EducationOption) => {
    setFilters(prev => ({ ...prev, secondarySchoolId: option.id }));
    setSchoolSearch(option.name);
    setShowSchoolDropdown(false);
    setCurrentPage(1);
  };

  const selectCollege = (option: EducationOption) => {
    setFilters(prev => ({ ...prev, collegeId: option.id }));
    setCollegeSearch(option.name);
    setShowCollegeDropdown(false);
    setCurrentPage(1);
  };

  const selectUniversity = (option: EducationOption) => {
    setFilters(prev => ({ ...prev, universityId: option.id }));
    setUniversitySearch(option.name);
    setShowUniversityDropdown(false);
    setCurrentPage(1);
  };

  const clearSchool = () => {
    setFilters(prev => ({ ...prev, secondarySchoolId: '' }));
    setSchoolSearch('');
    setSchoolOptions([]);
    setCurrentPage(1);
  };

  const clearCollege = () => {
    setFilters(prev => ({ ...prev, collegeId: '' }));
    setCollegeSearch('');
    setCollegeOptions([]);
    setCurrentPage(1);
  };

  const clearUniversity = () => {
    setFilters(prev => ({ ...prev, universityId: '' }));
    setUniversitySearch('');
    setUniversityOptions([]);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      username: '',
      overallRangeMin: null,
      overallRangeMax: null,
      onlineStatus: 'any',
      team: '',
      pacMin: null,
      shoMin: null,
      pasMin: null,
      driMin: null,
      defMin: null,
      phyMin: null,
      coinSort: 'any',
      positions: [],
      managersOnly: false,
      secondarySchoolId: '',
      collegeId: '',
      universityId: '',
    });
    setSchoolSearch('');
    setCollegeSearch('');
    setUniversitySearch('');
    setSchoolOptions([]);
    setCollegeOptions([]);
    setUniversityOptions([]);
    setCurrentPage(1);
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 5) return 'Online now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const totalPages = Math.ceil(totalResults / RESULTS_PER_PAGE);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="mb-6 flex items-center gap-2 text-white/60 hover:text-white transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 md:p-8 mb-6">
          <h1 className="text-3xl md:text-4xl font-black text-white mb-2">Search Friends</h1>
          <p className="text-white/60 mb-6">Find and connect with players around the world</p>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                placeholder="Search by username..."
                value={filters.username}
                onChange={(e) => {
                  setFilters((prev) => ({ ...prev, username: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-full bg-white/10 border border-white/20 rounded-xl pl-12 pr-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Filter className="w-5 h-5" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>

          {showFilters && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">Filters</h3>
                <button
                  onClick={clearFilters}
                  className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <X className="w-4 h-4" />
                  Clear All
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Overall Rating Range</label>
                <div className="flex flex-wrap gap-2">
                  {OVERALL_RANGES.map((range) => (
                    <button
                      key={range.label}
                      onClick={() => selectOverallRange(range.min, range.max)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                        filters.overallRangeMin === range.min && filters.overallRangeMax === range.max
                          ? 'bg-blue-600 text-white'
                          : 'bg-white/10 text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Positions</label>
                <div className="flex flex-wrap gap-2">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos}
                      onClick={() => togglePosition(pos)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        filters.positions.includes(pos)
                          ? 'bg-green-600 text-white'
                          : 'bg-white/10 text-white/80 hover:bg-white/20'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Team</label>
                  <input
                    type="text"
                    placeholder="Filter by team..."
                    value={filters.team}
                    onChange={(e) => {
                      setFilters((prev) => ({ ...prev, team: e.target.value }));
                      setCurrentPage(1);
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">Sort by Coins</label>
                  <select
                    value={filters.coinSort}
                    onChange={(e) => {
                      setFilters((prev) => ({ ...prev, coinSort: e.target.value as any }));
                      setCurrentPage(1);
                    }}
                    className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="any">Any</option>
                    <option value="high_to_low">Most coins first</option>
                    <option value="low_to_high">Least coins first</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Individual Stats (Minimum)</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {['pac', 'sho', 'pas', 'dri', 'def', 'phy'].map((stat) => (
                    <div key={stat}>
                      <label className="block text-xs text-white/60 mb-1 uppercase">{stat}</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="Min"
                        value={filters[`${stat}Min` as keyof SearchFilters] || ''}
                        onChange={(e) => {
                          const value = e.target.value ? parseInt(e.target.value) : null;
                          setFilters((prev) => ({ ...prev, [`${stat}Min`]: value }));
                          setCurrentPage(1);
                        }}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.managersOnly}
                    onChange={(e) => {
                      setFilters((prev) => ({ ...prev, managersOnly: e.target.checked }));
                      setCurrentPage(1);
                    }}
                    className="w-5 h-5 rounded border-white/20 bg-white/10 text-blue-600 focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-white font-semibold">Show only managers</span>
                </label>
              </div>

              <div className="border-t border-white/10 pt-6">
                <h4 className="text-md font-bold text-white mb-4">Education Filters</h4>
                <p className="text-sm text-white/60 mb-4">Find friends from your schools, colleges, or universities</p>

                <div className="space-y-4">
                  <div className="relative">
                    <label className="block text-sm font-semibold text-white mb-2">Secondary School</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="text"
                        value={schoolSearch}
                        onChange={(e) => handleSchoolSearch(e.target.value)}
                        onFocus={() => setShowSchoolDropdown(true)}
                        placeholder="Search for secondary school..."
                        className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-10 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {filters.secondarySchoolId && (
                        <button
                          type="button"
                          onClick={clearSchool}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/60 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {showSchoolDropdown && schoolOptions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-white/20 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {schoolOptions.map(option => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => selectSchool(option)}
                            className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 transition-colors"
                          >
                            {option.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-semibold text-white mb-2">College</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="text"
                        value={collegeSearch}
                        onChange={(e) => handleCollegeSearch(e.target.value)}
                        onFocus={() => setShowCollegeDropdown(true)}
                        placeholder="Search for college..."
                        className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-10 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {filters.collegeId && (
                        <button
                          type="button"
                          onClick={clearCollege}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/60 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {showCollegeDropdown && collegeOptions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-white/20 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {collegeOptions.map(option => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => selectCollege(option)}
                            className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 transition-colors"
                          >
                            {option.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <label className="block text-sm font-semibold text-white mb-2">University</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        type="text"
                        value={universitySearch}
                        onChange={(e) => handleUniversitySearch(e.target.value)}
                        onFocus={() => setShowUniversityDropdown(true)}
                        placeholder="Search for university..."
                        className="w-full bg-white/10 border border-white/20 rounded-lg pl-10 pr-10 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {filters.universityId && (
                        <button
                          type="button"
                          onClick={clearUniversity}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/60 hover:text-white"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {showUniversityDropdown && universityOptions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-white/20 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {universityOptions.map(option => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => selectUniversity(option)}
                            className="w-full px-4 py-2 text-left text-white hover:bg-slate-700 transition-colors"
                          >
                            {option.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-2">Online Status</label>
                <select
                  value={filters.onlineStatus}
                  onChange={(e) => {
                    setFilters((prev) => ({ ...prev, onlineStatus: e.target.value as any }));
                    setCurrentPage(1);
                  }}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="any">Any</option>
                  <option value="recent">Most recent online first</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <StaggerItem key={i} index={i}>
                <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
                  <div className="flex items-center gap-4">
                    <SkeletonAvatar size="lg" />
                    <div className="flex-1 space-y-2">
                      <ShimmerBar className="h-5 w-36 rounded" />
                      <ShimmerBar className="h-3 w-24 rounded" speed="slow" />
                    </div>
                    <div className="flex gap-2">
                      <ShimmerBar className="h-9 w-20 rounded-lg" />
                      <ShimmerBar className="h-9 w-20 rounded-lg" />
                    </div>
                  </div>
                </div>
              </StaggerItem>
            ))}
            <SlowLoadMessage loading={true} message="Searching users..." />
          </div>
        ) : results.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-12 text-center">
            <p className="text-white/60 text-lg">No results found. Try adjusting your filters.</p>
          </div>
        ) : (
          <>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 mb-6">
              <p className="text-white/80">
                Found <span className="font-bold text-white">{totalResults}</span> players
                {totalPages > 1 && (
                  <span className="text-white/60">
                    {' '}
                    (Page {currentPage} of {totalPages})
                  </span>
                )}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20 rounded-2xl p-6 hover:border-white/40 transition-all"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-black text-xl overflow-hidden flex-shrink-0">
                      {result.avatar_url ? (
                        <img src={result.avatar_url} alt={result.username} className="w-full h-full object-cover" />
                      ) : (
                        result.username[0].toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-black text-white truncate">{result.username}</h3>
                        {result.is_verified && (
                          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs">✓</span>
                          </div>
                        )}
                        {result.has_social_badge && (
                          <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs">S</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="bg-black/40 px-2 py-1 rounded text-white font-bold">
                          OVR {result.overall_rating}
                        </span>
                        {result.position && (
                          <span className="bg-white/10 px-2 py-1 rounded text-white font-semibold">
                            {result.position}
                          </span>
                        )}
                        {result.team && (
                          <span className="bg-white/10 px-2 py-1 rounded text-white/80 truncate max-w-[150px]">
                            {result.team}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-4 text-sm">
                    <div className="bg-black/20 rounded-lg p-2 text-center">
                      <div className="text-yellow-400 font-bold">{result.coin_balance.toFixed(0)}</div>
                      <div className="text-white/60 text-xs">Coins</div>
                    </div>
                    {result.is_manager && (
                      <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 rounded-lg p-2 text-center border border-yellow-300/30">
                        <div className="text-yellow-400 font-bold">{result.manager_wins}</div>
                        <div className="text-white/80 text-xs">Manager Wins</div>
                      </div>
                    )}
                    <div className="bg-black/20 rounded-lg p-2 text-center">
                      <div className="text-green-400 font-bold text-xs">{getTimeAgo(result.last_active)}</div>
                      <div className="text-white/60 text-xs">Last seen</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/profile/${result.username}`)}
                      className="flex-1 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      View Profile
                    </button>
                    <button
                      onClick={() => handleSendFriendRequest(result.id)}
                      disabled={sendingRequest === result.id}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      {sendingRequest === result.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4" />
                      )}
                      Add Friend
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <span className="text-white font-semibold">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}