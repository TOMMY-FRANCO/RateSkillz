import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export async function vibrate(duration = 30): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(duration);
    }
  } catch {}
}
