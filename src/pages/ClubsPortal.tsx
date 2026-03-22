import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import { Shield, Loader2, ArrowLeft, Search, Upload, RefreshCw, ChevronDown, ChevronUp, Plus, Trash2, CreditCard as Edit2, Check, X, Ticket, Calendar, MapPin, Globe, Save, Instagram, Facebook, Youtube, Twitter } from 'lucide-react';

interface FootballClub {
  id: string;
  name: string;
  region: string;
  gender: string;
  league: string | null;
  borough: string | null;
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
  show_website: boolean;
  show_social_links: boolean;
  show_contact: boolean;
  show_matches: boolean;
  show_squad: boolean;
  show_staff: boolean;
  show_win_ratio: boolean;
  show_description: boolean;
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

interface SocialUrls {
  instagram_url: string;
  facebook_url: string;
  twitter_url: string;
  tiktok_url: string;
  youtube_url: string;
  threads_url: string;
}

function SocialInput({ icon, value, onChange, placeholder, color }: {
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  color: string;
}) {
  return (
    <div className="relative">
      <span className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 flex items-center justify-center pointer-events-none ${color}`}>
        {icon}
      </span>
      <input
        type="url"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-6 pr-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-600 transition-colors w-36"
      />
    </div>
  );
}

type VisibilityColumn = 'show_website' | 'show_social_links' | 'show_contact' | 'show_matches' | 'show_squad' | 'show_staff' | 'show_win_ratio' | 'show_description';

function ClubRow({
  club,
  toast,
  togglingId,
  uploadingId,
  badgeInputRefs,
  onToggleVerified,
  onTogglePartner,
  onBadgeUpload,
  onWebsiteUrlSave,
  onSocialUrlsSave,
  onToggleVisibility,
}: {
  club: FootballClub;
  toast: ReturnType<typeof useToast>;
  togglingId: string | null;
  uploadingId: string | null;
  badgeInputRefs: React.MutableRefObject<Record<string, HTMLInputElement | null>>;
  onToggleVerified: (club: FootballClub) => void;
  onTogglePartner: (club: FootballClub) => void;
  onBadgeUpload: (club: FootballClub, file: File) => void;
  onWebsiteUrlSave: (club: FootballClub, url: string) => Promise<void>;
  onSocialUrlsSave: (club: FootballClub, urls: SocialUrls) => Promise<void>;
  onToggleVisibility: (club: FootballClub, column: VisibilityColumn) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState(club.website_url ?? '');
  const [savingUrl, setSavingUrl] = useState(false);
  const [socialUrls, setSocialUrls] = useState<SocialUrls>({
    instagram_url: club.instagram_url ?? '',
    facebook_url: club.facebook_url ?? '',
    twitter_url: club.twitter_url ?? '',
    tiktok_url: club.tiktok_url ?? '',
    youtube_url: club.youtube_url ?? '',
    threads_url: club.threads_url ?? '',
  });
  const [savingSocial, setSavingSocial] = useState(false);

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
            <span className="text-xs text-gray-500">Website</span>
            <div className="flex items-center gap-1">
              <div className="relative">
                <Globe className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500 pointer-events-none" />
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={e => setWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                  className="pl-6 pr-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-600 transition-colors w-36"
                />
              </div>
              <button
                onClick={async () => {
                  setSavingUrl(true);
                  await onWebsiteUrlSave(club, websiteUrl);
                  setSavingUrl(false);
                }}
                disabled={savingUrl}
                className="p-1.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 hover:border-cyan-700 text-gray-400 hover:text-cyan-400 rounded-lg transition-all"
                title="Save website URL"
              >
                {savingUrl ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              </button>
            </div>
          </div>

          <div className="flex flex-col items-start gap-1">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-gray-500">Social Links</span>
              <button
                onClick={async () => {
                  setSavingSocial(true);
                  await onSocialUrlsSave(club, socialUrls);
                  setSavingSocial(false);
                }}
                disabled={savingSocial}
                className="flex items-center gap-1 px-2 py-0.5 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 hover:border-cyan-700 text-gray-400 hover:text-cyan-400 text-xs rounded-lg transition-all"
                title="Save all social links"
              >
                {savingSocial ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                <span>Save</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <SocialInput
                icon={<Instagram className="w-3 h-3" />}
                value={socialUrls.instagram_url}
                onChange={v => setSocialUrls(p => ({ ...p, instagram_url: v }))}
                placeholder="Instagram URL"
                color="text-pink-400"
              />
              <SocialInput
                icon={<Facebook className="w-3 h-3" />}
                value={socialUrls.facebook_url}
                onChange={v => setSocialUrls(p => ({ ...p, facebook_url: v }))}
                placeholder="Facebook URL"
                color="text-blue-400"
              />
              <SocialInput
                icon={<Twitter className="w-3 h-3" />}
                value={socialUrls.twitter_url}
                onChange={v => setSocialUrls(p => ({ ...p, twitter_url: v }))}
                placeholder="Twitter/X URL"
                color="text-white"
              />
              <SocialInput
                icon={
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V9.01a8.16 8.16 0 004.78 1.52V7.08a4.85 4.85 0 01-1.01-.39z"/>
                  </svg>
                }
                value={socialUrls.tiktok_url}
                onChange={v => setSocialUrls(p => ({ ...p, tiktok_url: v }))}
                placeholder="TikTok URL"
                color="text-white"
              />
              <SocialInput
                icon={<Youtube className="w-3 h-3" />}
                value={socialUrls.youtube_url}
                onChange={v => setSocialUrls(p => ({ ...p, youtube_url: v }))}
                placeholder="YouTube URL"
                color="text-red-400"
              />
              <SocialInput
                icon={
                  <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.587 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 013.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.578-1.33-.873-2.431-.879h-.01c-.928 0-1.686.216-2.246.64-.48.363-.91.926-1.05 1.87l-2.01-.301c.17-1.267.732-2.222 1.672-2.838.93-.607 2.126-.916 3.556-.916h.018c1.663.007 3.011.498 3.905 1.52.848.97 1.285 2.36 1.298 4.13a7.53 7.53 0 01-.14 1.44c1.097.622 1.97 1.493 2.548 2.788.868 1.982.856 4.912-1.399 7.106-1.746 1.71-3.975 2.571-6.849 2.594l-.023.001z"/>
                  </svg>
                }
                value={socialUrls.threads_url}
                onChange={v => setSocialUrls(p => ({ ...p, threads_url: v }))}
                placeholder="Threads URL"
                color="text-gray-300"
              />
            </div>
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

      <div className="px-6 pb-3 flex flex-wrap gap-x-5 gap-y-2 border-t border-gray-800/40 pt-3">
        {(
          [
            { col: 'show_website', label: 'Website' },
            { col: 'show_social_links', label: 'Social Links' },
            { col: 'show_contact', label: 'Contact' },
            { col: 'show_matches', label: 'Matches' },
            { col: 'show_squad', label: 'Squad' },
            { col: 'show_staff', label: 'Staff' },
            { col: 'show_win_ratio', label: 'Win Ratio' },
            { col: 'show_description', label: 'Description' },
          ] as { col: VisibilityColumn; label: string }[]
        ).map(({ col, label }) => (
          <div key={col} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onToggleVisibility(club, col)}
              disabled={togglingId === club.id + '_' + col}
              className={`relative w-8 h-4 rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-60 flex-shrink-0 ${club[col] ? 'bg-cyan-600' : 'bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${club[col] ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
            <span className="text-xs text-gray-400 whitespace-nowrap">{label}</span>
          </div>
        ))}
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
        .select('id, name, region, gender, league, borough, badge_url, website_url, instagram_url, facebook_url, twitter_url, tiktok_url, youtube_url, threads_url, is_verified, is_partner, show_website, show_social_links, show_contact, show_matches, show_squad, show_staff, show_win_ratio, show_description')
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

  const handleSocialUrlsSave = async (club: FootballClub, urls: SocialUrls) => {
    try {
      const { error } = await supabase
        .from('football_clubs')
        .update({
          instagram_url: urls.instagram_url.trim() || null,
          facebook_url: urls.facebook_url.trim() || null,
          twitter_url: urls.twitter_url.trim() || null,
          tiktok_url: urls.tiktok_url.trim() || null,
          youtube_url: urls.youtube_url.trim() || null,
          threads_url: urls.threads_url.trim() || null,
        })
        .eq('id', club.id);
      if (error) throw error;
      setClubs(prev => prev.map(c => c.id === club.id ? {
        ...c,
        instagram_url: urls.instagram_url.trim() || null,
        facebook_url: urls.facebook_url.trim() || null,
        twitter_url: urls.twitter_url.trim() || null,
        tiktok_url: urls.tiktok_url.trim() || null,
        youtube_url: urls.youtube_url.trim() || null,
        threads_url: urls.threads_url.trim() || null,
      } : c));
      toast.success(`Social links saved for ${club.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save social links');
    }
  };

  const handleWebsiteUrlSave = async (club: FootballClub, url: string) => {
    try {
      const { error } = await supabase
        .from('football_clubs')
        .update({ website_url: url.trim() || null })
        .eq('id', club.id);
      if (error) throw error;
      setClubs(prev => prev.map(c => c.id === club.id ? { ...c, website_url: url.trim() || null } : c));
      toast.success(`Website URL saved for ${club.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save website URL');
    }
  };

  const handleToggleVisibility = async (club: FootballClub, column: VisibilityColumn) => {
    setTogglingId(club.id + '_' + column);
    try {
      const newValue = !club[column];
      const { error } = await supabase.from('football_clubs').update({ [column]: newValue }).eq('id', club.id);
      if (error) throw error;
      setClubs(prev => prev.map(c => c.id === club.id ? { ...c, [column]: newValue } : c));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update visibility');
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
                  onWebsiteUrlSave={handleWebsiteUrlSave}
                  onSocialUrlsSave={handleSocialUrlsSave}
                  onToggleVisibility={handleToggleVisibility}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
