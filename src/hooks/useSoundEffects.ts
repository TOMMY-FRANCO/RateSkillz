import { useState, useCallback, useMemo } from 'react';
import {
  playSound,
  getAudioPreferences,
  setAudioPreferences,
  type SoundName,
  type AudioPreferences,
} from '../lib/sounds';

export function useSoundEffects() {
  const [prefs, setPrefs] = useState<AudioPreferences>(getAudioPreferences);

  const updatePrefs = useCallback((update: Partial<AudioPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...update };
      setAudioPreferences(next);
      return next;
    });
  }, []);

  const play = useCallback((name: SoundName) => {
    playSound(name);
  }, []);

  return useMemo(
    () => ({ prefs, updatePrefs, play }),
    [prefs, updatePrefs, play]
  );
}
