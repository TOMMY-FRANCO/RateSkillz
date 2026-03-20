import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { validateUsernameFormat, checkUsernameAvailable } from '../lib/username';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle, XCircle, Sparkles } from 'lucide-react';

export default function UsernameSetup() {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [formatError, setFormatError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // If user already has a customized username, send them to dashboard
  useEffect(() => {
    if (profile?.username_customized) {
      navigate('/dashboard', { replace: true });
    }
  }, [profile]);

  // Debounced availability check
  useEffect(() => {
    if (!username || formatError) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    const timer = setTimeout(async () => {
      const isAvailable = await checkUsernameAvailable(username, profile?.id);
      setAvailable(isAvailable);
      setChecking(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [username, formatError]);

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setSaveError(null);
    setAvailable(null);
    const validation = validateUsernameFormat(value);
    setFormatError(validation.valid ? null : (validation.error || null));
  };

  const handleConfirm = async () => {
    if (!profile || !username || formatError || !available) return;
    setSaving(true);
    setSaveError(null);

    try {
      // Direct update — this is their first-time pick so no cooldown applies
      const { error } = await supabase
        .from('profiles')
        .update({
          username: username.toLowerCase(),
          username_customized: true,
          username_last_changed: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      // Log to username history
      await supabase.from('username_history').insert({
        user_id: profile.id,
        old_username: profile.username,
        new_username: username.toLowerCase(),
      }).catch(() => {});

      await refreshProfile();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save username. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (!profile) return;
    // Mark as customized so they don't see this screen again
    await supabase
      .from('profiles')
      .update({ username_customized: true })
      .eq('id', profile.id)
      .catch(() => {});
    await refreshProfile();
    navigate('/dashboard', { replace: true });
  };

  const isValid = username.length > 0 && !formatError && available === true && !checking;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2">Choose Your Username</h1>
          <p className="text-slate-400 text-sm">
            Pick a username for your profile. You can change it again after 14 days.
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-6 backdrop-blur-sm shadow-xl">

          {/* Current generated username */}
          {profile?.username && (
            <div className="mb-5 p-3 bg-slate-800/60 rounded-xl border border-slate-700/40">
              <p className="text-xs text-slate-500 mb-1">Generated username</p>
              <p className="text-sm font-bold text-slate-300 uppercase">{profile.username}</p>
            </div>
          )}

          {/* Username input */}
          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              New Username
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={e => handleUsernameChange(e.target.value.trim())}
                placeholder="e.g. john_fc"
                maxLength={16}
                className="w-full px-4 py-3 pr-10 bg-slate-800/80 border border-slate-600/60 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500/60 transition-colors"
                autoComplete="off"
                autoCapitalize="none"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checking && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
                {!checking && available === true && <CheckCircle className="w-4 h-4 text-green-400" />}
                {!checking && available === false && <XCircle className="w-4 h-4 text-red-400" />}
              </div>
            </div>

            {/* Feedback messages */}
            <div className="mt-2 min-h-[20px]">
              {formatError && (
                <p className="text-xs text-red-400">{formatError}</p>
              )}
              {!formatError && available === false && (
                <p className="text-xs text-red-400">Username is already taken</p>
              )}
              {!formatError && available === true && (
                <p className="text-xs text-green-400">Username is available</p>
              )}
              {!formatError && !username && (
                <p className="text-xs text-slate-500">Letters, numbers, one underscore or period. Max 16 characters.</p>
              )}
            </div>
          </div>

          {saveError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <p className="text-xs text-red-400">{saveError}</p>
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={!isValid || saving}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:from-cyan-400 hover:to-blue-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 mb-3"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Confirm Username'
            )}
          </button>

          {/* Skip */}
          <button
            onClick={handleSkip}
            disabled={saving}
            className="w-full py-2.5 text-slate-400 text-sm font-medium hover:text-white transition-colors"
          >
            Keep generated username for now
          </button>
        </div>
      </div>
    </div>
  );
}
