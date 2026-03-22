import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Shield, Loader2, ArrowLeft, Search, Upload, RefreshCw, ChevronDown, ChevronUp, Plus, Trash2, CreditCard as Edit2, Check, X, Ticket, Calendar, MapPin } from 'lucide-react';

interface FootballClub {
  id: string;
  name: string;
  region: string;
  gender: string;
  league: string | null;
  borough: string | null;
  badge_url: string | null;
  is_verified: boolean;
  is_partner: boolean;
}

interface ClubMatch {
  id: string;
  club_id: string;
  opponent: string;
  match_date: string;
  venue: string | null;
  is_home: boolean;
  tickets_available: boolean;
  ticket_price: number | null;
  seats_remaining: number | null;
  result: string | null;
  score: string | null;
  created_at: string;
}

const emptyForm = {
  opponent: '',
  match_date: '',
  venue: '',
  is_home: true,
  tickets_available: false,
  ticket_price: '',
  seats_remaining: '',
};

type MatchForm = typeof emptyForm;

function ResultPill({ result }: { result: string }) {
  const map: Record<string, string> = {
    win: 'bg-green-500/20 text-green-400 border-green-500/30',
    loss: 'bg-red-500/20 text-red-400 border-red-500/30',
    draw: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border capitalize ${map[result] ?? 'bg-gray-700 text-gray-400 border-gray-600'}`}>
      {result}
    </span>
  );
}

function MatchesPanel({ club, toast }: { club: FootballClub; toast: ReturnType<typeof useToast> }) {
  const [matches, setMatches] = useState<ClubMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MatchForm>(emptyForm);
  const [editingResult, setEditingResult] = useState<string | null>(null);
  const [resultForm, setResultForm] = useState({ result: '', score: '' });
  const [savingResult, setSavingResult] = useState(false);

  const loadMatches = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('club_matches')
        .select('*')
        .eq('club_id', club.id)
        .order('match_date', { ascending: true });
      if (error) throw error;
      setMatches(data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  }, [club.id]);

  useEffect(() => { loadMatches(); }, [loadMatches]);

  const handleSave = async () => {
    if (!form.opponent.trim()) { toast.error('Opponent name is required'); return; }
    if (!form.match_date) { toast.error('Match date is required'); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        club_id: club.id,
        opponent: form.opponent.trim(),
        match_date: form.match_date,
        venue: form.venue.trim() || null,
        is_home: form.is_home,
        tickets_available: form.tickets_available,
        ticket_price: form.tickets_available && form.ticket_price !== '' ? Number(form.ticket_price) : null,
        seats_remaining: form.tickets_available && form.seats_remaining !== '' ? Number(form.seats_remaining) : null,
      };
      const { error } = await supabase.from('club_matches').insert(payload);
      if (error) throw error;
      toast.success('Match added');
      setForm(emptyForm);
      setShowForm(false);
      await loadMatches();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add match');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (matchId: string) => {
    setDeletingId(matchId);
    try {
      const { error } = await supabase.from('club_matches').delete().eq('id', matchId);
      if (error) throw error;
      setMatches(prev => prev.filter(m => m.id !== matchId));
      toast.success('Match deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete match');
    } finally {
      setDeletingId(null);
    }
  };

  const openEditResult = (match: ClubMatch) => {
    setEditingResult(match.id);
    setResultForm({ result: match.result || '', score: match.score || '' });
  };

  const handleSaveResult = async (matchId: string) => {
    if (!resultForm.result) { toast.error('Please select a result'); return; }
    setSavingResult(true);
    try {
      const { error } = await supabase
        .from('club_matches')
        .update({ result: resultForm.result, score: resultForm.score.trim() || null })
        .eq('id', matchId);
      if (error) throw error;
      setMatches(prev => prev.map(m => m.id === matchId ? { ...m, result: resultForm.result, score: resultForm.score.trim() || null } : m));
      toast.success('Result saved');
      setEditingResult(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save result');
    } finally {
      setSavingResult(false);
    }
  };

  const now = new Date();
  const isPast = (dateStr: string) => new Date(dateStr) < now;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
        <span className="ml-2 text-xs text-gray-400">Loading matches...</span>
      </div>
    );
  }

  return (
    <div className="px-6 pb-4 pt-2 space-y-3">
      {matches.length === 0 && !showForm && (
        <p className="text-xs text-gray-500 py-2">No matches yet.</p>
      )}

      {matches.length > 0 && (
        <div className="space-y-2">
          {matches.map(match => (
            <div key={match.id} className="bg-gray-800/60 border border-gray-700/60 rounded-lg p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-medium">{match.opponent}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-semibold ${match.is_home ? 'bg-cyan-900/50 text-cyan-400' : 'bg-gray-700 text-gray-400'}`}>
                      {match.is_home ? 'Home' : 'Away'}
                    </span>
                    {match.result && <ResultPill result={match.result} />}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(match.match_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {match.venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {match.venue}
                      </span>
                    )}
                    {match.score && (
                      <span className="text-white font-semibold">{match.score}</span>
                    )}
                  </div>

                  {match.tickets_available && (
                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                      <Ticket className="w-3 h-3" />
                      <span>Tickets available</span>
                      {match.ticket_price != null && <span>· £{match.ticket_price}</span>}
                      {match.seats_remaining != null && <span>· {match.seats_remaining} seats left</span>}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isPast(match.match_date) && editingResult !== match.id && (
                    <button
                      onClick={() => openEditResult(match)}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-all border border-gray-600"
                    >
                      <Edit2 className="w-3 h-3" />
                      Result
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(match.id)}
                    disabled={deletingId === match.id}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                  >
                    {deletingId === match.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {editingResult === match.id && (
                <div className="mt-3 pt-3 border-t border-gray-700/60 flex items-center gap-2 flex-wrap">
                  <select
                    value={resultForm.result}
                    onChange={e => setResultForm(f => ({ ...f, result: e.target.value }))}
                    className="bg-gray-900 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-600"
                  >
                    <option value="">Select result</option>
                    <option value="win">Win</option>
                    <option value="loss">Loss</option>
                    <option value="draw">Draw</option>
                  </select>
                  <input
                    type="text"
                    value={resultForm.score}
                    onChange={e => setResultForm(f => ({ ...f, score: e.target.value }))}
                    placeholder="Score e.g. 2-1"
                    className="bg-gray-900 border border-gray-600 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-600 w-28"
                  />
                  <button
                    onClick={() => handleSaveResult(match.id)}
                    disabled={savingResult}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-xs rounded-lg transition-all"
                  >
                    {savingResult ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Save
                  </button>
                  <button
                    onClick={() => setEditingResult(null)}
                    className="p-1.5 text-gray-500 hover:text-gray-300 rounded-lg transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-white">New Match</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Opponent *</label>
              <input
                type="text"
                value={form.opponent}
                onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))}
                placeholder="Team name"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-600 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Match Date &amp; Time *</label>
              <input
                type="datetime-local"
                value={form.match_date}
                onChange={e => setForm(f => ({ ...f, match_date: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-600 transition-colors"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-400">Venue</label>
              <input
                type="text"
                value={form.venue}
                onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                placeholder="Stadium or ground"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-600 transition-colors"
              />
            </div>

            <div className="flex items-center gap-6 pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Home</span>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_home: !f.is_home }))}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${form.is_home ? 'bg-cyan-600' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${form.is_home ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">Tickets</span>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tickets_available: !f.tickets_available }))}
                  className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${form.tickets_available ? 'bg-emerald-600' : 'bg-gray-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${form.tickets_available ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          </div>

          {form.tickets_available && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Ticket Price (£)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.ticket_price}
                  onChange={e => setForm(f => ({ ...f, ticket_price: e.target.value }))}
                  placeholder="0.00"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-600 transition-colors"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Seats Remaining</label>
                <input
                  type="number"
                  min="0"
                  value={form.seats_remaining}
                  onChange={e => setForm(f => ({ ...f, seats_remaining: e.target.value }))}
                  placeholder="0"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-600 transition-colors"
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-all"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Match'}
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(emptyForm); }}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-sm rounded-lg transition-all"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-800/80 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 text-gray-400 hover:text-cyan-400 text-xs rounded-lg transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Match
        </button>
      )}
    </div>
  );
}

function ClubRow({
  club,
  toast,
  togglingId,
  uploadingId,
  badgeInputRefs,
  onToggleVerified,
  onTogglePartner,
  onBadgeUpload,
}: {
  club: FootballClub;
  toast: ReturnType<typeof useToast>;
  togglingId: string | null;
  uploadingId: string | null;
  badgeInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  onToggleVerified: (club: FootballClub) => void;
  onTogglePartner: (club: FootballClub) => void;
  onBadgeUpload: (club: FootballClub, file: File) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-800/60 last:border-0">
      <div className="flex items-center gap-4 px-6 py-4 hover:bg-gray-800/20 transition-colors">
        <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
          {club.badge_url ? (
            <img src={club.badge_url} alt={club.name} className="w-full h-full object-cover" />
          ) : (
            <Shield className="w-5 h-5 text-gray-600" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-medium text-sm truncate">{club.name}</p>
          <p className="text-gray-500 text-xs mt-0.5">
            {club.region} · {club.gender} · {club.league || 'No league'}
          </p>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-gray-500">Verified</span>
            <button
              onClick={() => onToggleVerified(club)}
              disabled={togglingId === club.id + '_verified'}
              className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-60 ${club.is_verified ? 'bg-cyan-600' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${club.is_verified ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-gray-500">Partner</span>
            <button
              onClick={() => onTogglePartner(club)}
              disabled={togglingId === club.id + '_partner'}
              className="flex items-center justify-center w-10 h-5 focus:outline-none disabled:opacity-60"
              title={club.is_partner ? 'Remove partner' : 'Mark as partner'}
            >
              <div className="relative flex items-center justify-center w-5 h-5">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${club.is_partner ? 'bg-green-400' : 'bg-gray-500'}`} />
                <span className={`relative inline-flex rounded-full h-3 w-3 ${club.is_partner ? 'bg-green-400' : 'bg-gray-500'}`} />
              </div>
            </button>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-gray-500">Badge</span>
            <button
              onClick={() => badgeInputRefs.current[club.id]?.click()}
              disabled={uploadingId === club.id}
              className="flex items-center gap-1 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white text-xs rounded-lg transition-all"
            >
              {uploadingId === club.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
              <span>{uploadingId === club.id ? 'Uploading' : 'Upload'}</span>
            </button>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={el => { badgeInputRefs.current[club.id] = el; }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) onBadgeUpload(club, file);
                e.target.value = '';
              }}
            />
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-gray-500">Matches</span>
            <button
              onClick={() => setExpanded(x => !x)}
              className="flex items-center gap-1 px-2.5 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-700 text-gray-300 hover:text-cyan-400 text-xs rounded-lg transition-all"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <span>{expanded ? 'Hide' : 'View'}</span>
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="bg-gray-900/40 border-t border-gray-800/60">
          <MatchesPanel club={club} toast={toast} />
        </div>
      )}
    </div>
  );
}

export default function ClubsPortal() {
  const navigate = useNavigate();
  const toast = useToast();
  const [clubs, setClubs] = useState<FootballClub[]>([]);
  const [clubsLoading, setClubsLoading] = useState(false);
  const [clubSearch, setClubSearch] = useState('');
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const badgeInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadClubs = useCallback(async () => {
    setClubsLoading(true);
    try {
      const { data, error } = await supabase
        .from('football_clubs')
        .select('id, name, region, gender, league, borough, badge_url, is_verified, is_partner')
        .order('region')
        .order('name');
      if (error) throw error;
      setClubs(data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load clubs');
    } finally {
      setClubsLoading(false);
    }
  }, []);

  useEffect(() => { loadClubs(); }, [loadClubs]);

  const handleToggleVerified = async (club: FootballClub) => {
    setTogglingId(club.id + '_verified');
    try {
      const { error } = await supabase.from('football_clubs').update({ is_verified: !club.is_verified }).eq('id', club.id);
      if (error) throw error;
      setClubs(prev => prev.map(c => c.id === club.id ? { ...c, is_verified: !c.is_verified } : c));
      toast.success(`${club.name} ${!club.is_verified ? 'verified' : 'unverified'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update verified status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleTogglePartner = async (club: FootballClub) => {
    setTogglingId(club.id + '_partner');
    try {
      const { error } = await supabase.from('football_clubs').update({ is_partner: !club.is_partner }).eq('id', club.id);
      if (error) throw error;
      setClubs(prev => prev.map(c => c.id === club.id ? { ...c, is_partner: !c.is_partner } : c));
      toast.success(`${club.name} ${!club.is_partner ? 'marked as partner' : 'removed from partners'}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update partner status');
    } finally {
      setTogglingId(null);
    }
  };

  const handleBadgeUpload = async (club: FootballClub, file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2MB'); return; }
    setUploadingId(club.id);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${club.id}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('club-badges').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('club-badges').getPublicUrl(path);
      const badge_url = urlData.publicUrl;
      const { error: updateError } = await supabase.from('football_clubs').update({ badge_url }).eq('id', club.id);
      if (updateError) throw updateError;
      setClubs(prev => prev.map(c => c.id === club.id ? { ...c, badge_url } : c));
      toast.success(`Badge uploaded for ${club.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload badge');
    } finally {
      setUploadingId(null);
    }
  };

  const filteredClubs = clubs.filter(c => c.name.toLowerCase().includes(clubSearch.toLowerCase()));

  return (
    <div className="min-h-screen bg-black pb-24">
      <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/dashboard')} className="text-gray-300 hover:text-cyan-400 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-cyan-400" />
                <h1 className="text-xl font-bold text-white">Clubs Portal</h1>
              </div>
            </div>
            <button
              onClick={loadClubs}
              disabled={clubsLoading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-gray-300 hover:text-white text-sm font-semibold rounded-lg transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${clubsLoading ? 'animate-spin' : ''}`} />
              {clubsLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="border border-gray-800 rounded-xl bg-gray-900/50 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white">Clubs Management</h2>
              {!clubsLoading && (
                <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                  {filteredClubs.length} club{filteredClubs.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-b border-gray-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={clubSearch}
                onChange={e => setClubSearch(e.target.value)}
                placeholder="Search clubs by name..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-600 transition-colors"
              />
            </div>
          </div>

          {clubsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              <span className="ml-3 text-gray-400 text-sm">Loading clubs...</span>
            </div>
          ) : filteredClubs.length === 0 ? (
            <div className="py-16 text-center text-gray-500 text-sm">
              {clubSearch ? 'No clubs match your search.' : 'No clubs found.'}
            </div>
          ) : (
            <div>
              {filteredClubs.map(club => (
                <ClubRow
                  key={club.id}
                  club={club}
                  toast={toast}
                  togglingId={togglingId}
                  uploadingId={uploadingId}
                  badgeInputRefs={badgeInputRefs}
                  onToggleVerified={handleToggleVerified}
                  onTogglePartner={handleTogglePartner}
                  onBadgeUpload={handleBadgeUpload}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
