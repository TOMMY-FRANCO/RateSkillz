import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Plus, Save, Loader2, CreditCard as Edit2, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

interface MatchSetting {
  id: string;
  team: string;
  match_status: 'none' | 'upcoming' | 'live';
  opponent: string | null;
  venue: string | null;
  match_date: string | null;
  is_premier_league: boolean;
  updated_at: string | null;
}

interface FormState {
  team: string;
  match_status: 'none' | 'upcoming' | 'live';
  opponent: string;
  venue: string;
  match_date: string;
  is_premier_league: boolean;
}

const ALLOWED_USERNAMES = ['test123', 'tommy_franco'];

const defaultForm: FormState = {
  team: '',
  match_status: 'none',
  opponent: '',
  venue: '',
  match_date: '',
  is_premier_league: false,
};

export default function ChatMatchSettings() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [settings, setSettings] = useState<MatchSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(defaultForm);

  const isAllowed = profile && ALLOWED_USERNAMES.includes(profile.username);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('club_match_settings')
        .select('id, team, match_status, opponent, venue, match_date, is_premier_league, updated_at')
        .order('team');
      if (error) throw error;
      setSettings(data || []);
    } catch {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isAllowed) return;
    loadSettings();
  }, [isAllowed, loadSettings]);

  const handleEdit = (setting: MatchSetting) => {
    setEditingId(setting.id);
    setShowForm(true);
    setForm({
      team: setting.team,
      match_status: setting.match_status,
      opponent: setting.opponent || '',
      venue: setting.venue || '',
      match_date: setting.match_date
        ? new Date(setting.match_date).toISOString().slice(0, 16)
        : '',
      is_premier_league: setting.is_premier_league,
    });
  };

  const handleNew = () => {
    setEditingId(null);
    setForm(defaultForm);
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  const handleSave = async () => {
    if (!form.team.trim()) {
      toast.error('Team name is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        team: form.team.trim(),
        match_status: form.match_status,
        opponent: form.opponent.trim() || null,
        venue: form.venue.trim() || null,
        match_date: form.match_date ? new Date(form.match_date).toISOString() : null,
        is_premier_league: form.is_premier_league,
      };

      if (editingId) {
        const { error } = await supabase
          .from('club_match_settings')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Match settings updated');
      } else {
        const { error } = await supabase
          .from('club_match_settings')
          .insert(payload);
        if (error) throw error;
        toast.success('Match settings created');
      }

      handleCancel();
      await loadSettings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (!isAllowed) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <p className="text-white font-bold">Access Denied</p>
          <button onClick={() => navigate('/dashboard')} className="text-cyan-400 text-sm hover:underline">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const statusColor = (s: string) =>
    s === 'live' ? 'text-red-400' : s === 'upcoming' ? 'text-cyan-400' : 'text-gray-500';

  const statusBg = (s: string) =>
    s === 'live' ? 'bg-red-500/15 border-red-500/30' : s === 'upcoming' ? 'bg-cyan-500/15 border-cyan-500/30' : 'bg-white/5 border-white/10';

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
            <h1 className="text-xl font-bold text-white heading-glow flex-1 text-center">
              Chat Match Settings
            </h1>
            <button
              onClick={handleNew}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-sm font-semibold bg-transparent border-none cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Form */}
        {showForm && (
          <div className="glass-card p-5 space-y-4">
            <h2 className="text-white font-bold text-base">
              {editingId ? 'Edit Match Setting' : 'New Match Setting'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-[#B0B8C8] text-xs font-semibold mb-1 block">Team Name *</label>
                <input
                  type="text"
                  value={form.team}
                  onChange={e => setForm(f => ({ ...f, team: e.target.value }))}
                  placeholder="e.g. Arsenal FC"
                  className="w-full glass-input px-3 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 focus:border-cyan-500/50 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[#B0B8C8] text-xs font-semibold mb-1 block">Match Status</label>
                <div className="flex gap-2">
                  {(['none', 'upcoming', 'live'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setForm(f => ({ ...f, match_status: s }))}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all capitalize ${
                        form.match_status === s
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      {s === 'none' ? 'None' : s}
                    </button>
                  ))}
                </div>
              </div>

              {form.match_status !== 'none' && (
                <>
                  <div>
                    <label className="text-[#B0B8C8] text-xs font-semibold mb-1 block">Opponent</label>
                    <input
                      type="text"
                      value={form.opponent}
                      onChange={e => setForm(f => ({ ...f, opponent: e.target.value }))}
                      placeholder="e.g. Chelsea FC"
                      className="w-full glass-input px-3 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[#B0B8C8] text-xs font-semibold mb-1 block">Venue</label>
                    <input
                      type="text"
                      value={form.venue}
                      onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                      placeholder="e.g. Emirates Stadium"
                      className="w-full glass-input px-3 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 focus:border-cyan-500/50 focus:outline-none"
                    />
                  </div>

                  {form.match_status === 'upcoming' && (
                    <div>
                      <label className="text-[#B0B8C8] text-xs font-semibold mb-1 block">
                        Match Date & Time (local)
                      </label>
                      <input
                        type="datetime-local"
                        value={form.match_date}
                        onChange={e => setForm(f => ({ ...f, match_date: e.target.value }))}
                        className="w-full glass-input px-3 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 focus:border-cyan-500/50 focus:outline-none"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setForm(f => ({ ...f, is_premier_league: !f.is_premier_league }))}
                      className={`w-10 h-5 rounded-full transition-colors ${
                        form.is_premier_league ? 'bg-cyan-500' : 'bg-white/20'
                      } relative`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow ${
                        form.is_premier_league ? 'translate-x-5' : 'translate-x-0.5'
                      }`} />
                    </div>
                    <span className="text-[#B0B8C8] text-sm">Premier League match</span>
                  </label>
                </>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleCancel}
                className="flex-1 py-2.5 rounded-xl border border-white/10 text-gray-400 text-sm font-semibold hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* List */}
        <div className="glass-card p-5 space-y-3">
          <h2 className="text-white font-bold text-base">All Teams</h2>

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
            </div>
          ) : settings.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-[#B0B8C8] text-sm">No settings yet</p>
              <p className="text-gray-500 text-xs">Click "New" to add a team's match info</p>
            </div>
          ) : (
            settings.map(s => (
              <div key={s.id} className={`rounded-xl p-4 border flex items-center gap-3 ${statusBg(s.match_status)}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-bold text-sm truncate">{s.team}</span>
                    <span className={`text-xs font-semibold capitalize ${statusColor(s.match_status)}`}>
                      {s.match_status === 'live' && '● '}
                      {s.match_status}
                    </span>
                    {s.is_premier_league && (
                      <span className="text-xs text-purple-400 font-semibold">PL</span>
                    )}
                  </div>
                  {s.opponent && (
                    <p className="text-[#B0B8C8] text-xs mt-0.5">vs {s.opponent}</p>
                  )}
                  {s.venue && (
                    <p className="text-gray-500 text-xs">{s.venue}</p>
                  )}
                  {s.match_date && (
                    <p className="text-gray-500 text-xs">
                      {new Date(s.match_date).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleEdit(s)}
                  className="shrink-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-[#B0B8C8] hover:text-white border-none cursor-pointer"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="glass-card p-4 flex items-center gap-3">
          <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
          <p className="text-[#B0B8C8] text-xs">
            Changes take effect immediately. Users will see match banners in their Club Chat.
          </p>
        </div>
      </div>
    </div>
  );
}
