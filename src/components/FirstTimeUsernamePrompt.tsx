import { useState, useCallback, useEffect } from 'react';
import { User, CheckCircle, XCircle, Loader, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  validateUsernameFormat,
  checkUsernameAvailable,
  changeUsername,
  displayUsername,
  normalizeUsername
} from '../lib/username';

let debounceTimer: NodeJS.Timeout;

interface FirstTimeUsernamePromptProps {
  onComplete: () => void;
}

export default function FirstTimeUsernamePrompt({ onComplete }: FirstTimeUsernamePromptProps) {
  const { profile, refreshProfile } = useAuth();
  const [newUsername, setNewUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) {
      setNewUsername(profile.username);
    }
  }, [profile]);

  const checkAvailability = useCallback(async (username: string) => {
    if (!username || !profile) {
      setIsAvailable(null);
      return;
    }

    const normalized = normalizeUsername(username);

    if (normalized === normalizeUsername(profile.username)) {
      setIsAvailable(true);
      setValidationError(null);
      return;
    }

    setIsChecking(true);
    setIsAvailable(null);

    const available = await checkUsernameAvailable(normalized, profile.id);
    setIsAvailable(available);
    setIsChecking(false);

    if (!available) {
      setValidationError('Username is already taken');
    }
  }, [profile]);

  const handleInputChange = (value: string) => {
    setNewUsername(value);
    setValidationError(null);
    setIsAvailable(null);

    if (!value.trim()) {
      return;
    }

    const validation = validateUsernameFormat(value);
    if (!validation.valid) {
      setValidationError(validation.error || null);
      return;
    }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      checkAvailability(value);
    }, 500);
  };

  const handleKeepCurrent = async () => {
    if (!profile) return;

    setSubmitting(true);
    try {
      await changeUsername(profile.id, profile.username);
      await refreshProfile();
      onComplete();
    } catch (error) {
      console.error('Error keeping username:', error);
      onComplete();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustomize = async () => {
    if (!profile || !newUsername.trim()) return;

    const validation = validateUsernameFormat(newUsername);
    if (!validation.valid) {
      setValidationError(validation.error || null);
      return;
    }

    if (!isAvailable && normalizeUsername(newUsername) !== normalizeUsername(profile.username)) {
      setValidationError('Username is not available');
      return;
    }

    setSubmitting(true);

    try {
      if (normalizeUsername(newUsername) !== normalizeUsername(profile.username)) {
        const result = await changeUsername(profile.id, newUsername);

        if (!result.success) {
          setValidationError(result.error || 'Failed to change username');
          setSubmitting(false);
          return;
        }
      }

      await refreshProfile();
      onComplete();
    } catch (error: any) {
      setValidationError(error.message || 'Failed to change username');
      setSubmitting(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-8 max-w-md w-full">
        <div className="flex items-center justify-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
        </div>

        <h2 className="text-2xl font-bold text-white text-center mb-2">
          Welcome to the Team!
        </h2>
        <p className="text-gray-400 text-center mb-6">
          Customize your username or keep the one we generated for you
        </p>

        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-600/50 rounded-xl">
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300 space-y-1">
              <p className="font-semibold">Username Rules:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-200 text-xs">
                <li>Max 16 characters</li>
                <li>Letters, numbers, one _ and one . only</li>
                <li>Cannot start/end with _ or .</li>
                <li>Displayed in UPPERCASE everywhere</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Your Username
              </label>
              <span className="text-xs text-gray-500">
                {newUsername.length}/16
              </span>
            </div>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => handleInputChange(e.target.value)}
              disabled={submitting}
              placeholder="Enter username"
              maxLength={16}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
            />
          </div>

          {newUsername && (
            <div className="p-3 bg-gray-800/50 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Preview:</p>
              <p className="text-lg font-bold text-cyan-400">
                {displayUsername(newUsername)}
              </p>
            </div>
          )}

          {isChecking && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader className="w-4 h-4 animate-spin" />
              <span>Checking availability...</span>
            </div>
          )}

          {!isChecking && isAvailable === true && !validationError && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>Username is available!</span>
            </div>
          )}

          {!isChecking && isAvailable === false && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <XCircle className="w-4 h-4" />
              <span>Username is already taken</span>
            </div>
          )}

          {validationError && (
            <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-600/50 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{validationError}</p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <button
            onClick={handleCustomize}
            disabled={
              submitting ||
              !newUsername.trim() ||
              (normalizeUsername(newUsername) !== normalizeUsername(profile.username) && isAvailable !== true) ||
              !!validationError
            }
            className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Setting up...' : normalizeUsername(newUsername) === normalizeUsername(profile.username) ? 'Keep This Username' : 'Use This Username'}
          </button>

          {normalizeUsername(newUsername) !== normalizeUsername(profile.username) && (
            <button
              onClick={handleKeepCurrent}
              disabled={submitting}
              className="w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all disabled:opacity-50"
            >
              Keep Generated Username
            </button>
          )}
        </div>

        <p className="text-xs text-center text-gray-500 mt-4">
          You can change your username anytime in settings (once every 15 days after first change)
        </p>
      </div>
    </div>
  );
}
