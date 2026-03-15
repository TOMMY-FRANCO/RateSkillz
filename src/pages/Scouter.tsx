import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, RefreshCw, MapPin, MessageCircle, Plus, AlertCircle, X, Loader2, Trash2, Users } from 'lucide-react';
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
              {isScoutTeam && (
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
        </nav>

        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
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
        </main>
      </div>
    </>
  );
}
