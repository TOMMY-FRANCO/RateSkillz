import { useState, useEffect, useCallback } from 'react';
import { User, CheckCircle, XCircle, Loader, AlertCircle, Clock, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  validateUsernameFormat,
  checkUsernameAvailable,
  canChangeUsername,
  changeUsername,
  displayUsername,
  normalizeUsername,
  type UsernameChangeAbility
} from '../lib/username';

let debounceTimer: NodeJS.Timeout;

export default function UsernameChanger() {
  const { profile, refreshProfile } = useAuth();
  const [newUsername, setNewUsername] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [changeAbility, setChangeAbility] = useState<UsernameChangeAbility | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      loadChangeAbility();
    }
  }, [profile]);

  const loadChangeAbility = async () => {
    if (!profile) return;

    setLoading(true);
    const ability = await canChangeUsername(profile.id);
    setChangeAbility(ability);
    setLoading(false);
  };

  const checkAvailability = useCallback(async (username: string) => {
    if (!username || !profile) {
      setIsAvailable(null);
      return;
    }

    const normalized = normalizeUsername(username);

    if (normalized === normalizeUsername(profile.username)) {
      setIsAvailable(null);
      setValidationError('This is your current username');
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
    setSuccessMessage(null);

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

  const handleSubmit = () => {
    if (!profile || !newUsername.trim()) return;

    const validation = validateUsernameFormat(newUsername);
    if (!validation.valid) {
      setValidationError(validation.error || null);
      return;
    }

    if (!isAvailable) {
      setValidationError('Username is not available');
      return;
    }

    if (!changeAbility?.can_change) {
      setValidationError(changeAbility?.error || 'Cannot change username at this time');
      return;
    }

    setShowConfirmation(true);
  };

  const confirmChange = async () => {
    if (!profile || !newUsername.trim()) return;

    setSubmitting(true);
    setShowConfirmation(false);

    try {
      const result = await changeUsername(profile.id, newUsername);

      if (result.success) {
        setSuccessMessage(`Username changed successfully to ${displayUsername(result.new_username || newUsername)}`);
        setNewUsername('');
        setIsAvailable(null);
        setValidationError(null);

        await refreshProfile();
        await loadChangeAbility();
      } else {
        setValidationError(result.error || 'Failed to change username');
      }
    } catch (error: any) {
      setValidationError(error.message || 'Failed to change username');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
        <div className="flex items-center justify-center py-8">
          <Loader className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const canChange = changeAbility?.can_change || false;
  const daysRemaining = changeAbility?.days_remaining || 0;
  const isFirstChange = changeAbility?.is_first_change || false;

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
          <User className="w-5 h-5 text-black" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Change Username</h3>
          <p className="text-sm text-gray-400">Customize your unique username</p>
        </div>
      </div>

      <div className="mb-6 p-4 bg-blue-900/20 border border-blue-600/50 rounded-xl">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300 space-y-1">
            <p className="font-semibold">Username Rules:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-200">
              <li>Maximum 16 characters</li>
              <li>Letters, numbers, one underscore, and one period only</li>
              <li>Cannot start or end with underscore or period</li>
              <li>Case-insensitive (stored lowercase, displayed uppercase)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Current Username
        </label>
        <div className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg">
          <p className="text-xl font-bold text-cyan-400">
            {displayUsername(profile.username)}
          </p>
        </div>
      </div>

      {!canChange && (
        <div className="mb-6 p-4 bg-orange-900/20 border border-orange-600/50 rounded-xl">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-orange-300 font-semibold mb-1">Username Change Cooldown</p>
              <p className="text-orange-200 text-sm">
                You can change your username again in <span className="font-bold">{daysRemaining}</span> {daysRemaining === 1 ? 'day' : 'days'}
              </p>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-900/20 border border-green-600/50 rounded-xl">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-300">{successMessage}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">
              New Username
            </label>
            <span className="text-xs text-gray-500">
              {newUsername.length}/16
            </span>
          </div>
          <input
            type="text"
            value={newUsername}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={!canChange || submitting}
            placeholder="Enter new username"
            maxLength={16}
            className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
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

        <button
          onClick={handleSubmit}
          disabled={!canChange || submitting || !newUsername.trim() || isAvailable !== true || !!validationError}
          className="w-full px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:from-gray-600 disabled:to-gray-600"
        >
          {submitting ? 'Changing Username...' : 'Change Username'}
        </button>

        {isFirstChange && canChange && (
          <p className="text-xs text-center text-gray-400">
            This is your first username change. After this, you'll need to wait 15 days between changes.
          </p>
        )}
      </div>

      {showConfirmation && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Confirm Username Change</h3>

            <div className="mb-6 space-y-3">
              <div className="p-4 bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Current Username</p>
                <p className="text-lg font-semibold text-white">
                  {displayUsername(profile.username)}
                </p>
              </div>

              <div className="flex items-center justify-center">
                <div className="text-cyan-400">→</div>
              </div>

              <div className="p-4 bg-cyan-900/20 border border-cyan-600/50 rounded-lg">
                <p className="text-sm text-cyan-300 mb-1">New Username</p>
                <p className="text-lg font-semibold text-cyan-400">
                  {displayUsername(newUsername)}
                </p>
              </div>

              {!isFirstChange && (
                <div className="p-3 bg-orange-900/20 border border-orange-600/50 rounded-lg">
                  <p className="text-sm text-orange-300">
                    You won't be able to change your username again for <span className="font-bold">15 days</span>
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmChange}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg transition-all"
              >
                Confirm Change
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
