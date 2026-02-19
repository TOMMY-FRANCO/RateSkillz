type SoundName =
  | 'coin-purchase'
  | 'battle-win'
  | 'battle-loss'
  | 'rank-up'
  | 'rank-down'
  | 'notification'
  | 'coin-received'
  | 'friend-request'
  | 'card-swap'
  | 'milestone'
  | 'message-sent'
  | 'message-received'
  | 'button-click';

export const BUTTON_SOUNDS_KEY = 'buttonSoundsEnabled';
export const BUTTON_VIBRATION_KEY = 'buttonVibrationEnabled';

let audioCtx: AudioContext | null = null;
let unlocked = false;

function getContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function unlockAudio() {
  if (unlocked) return;
  const ctx = getContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  const buf = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.connect(ctx.destination);
  src.start(0);
  unlocked = true;
}

function setupUnlockListeners() {
  const events = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click'];
  const handler = () => {
    unlockAudio();
    events.forEach((e) => document.removeEventListener(e, handler, true));
  };
  events.forEach((e) => document.addEventListener(e, handler, true));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && audioCtx?.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  });
}

if (typeof window !== 'undefined') {
  setupUnlockListeners();
}

function tone(
  ctx: AudioContext,
  freq: number,
  start: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration);
}

function noise(
  ctx: AudioContext,
  start: number,
  duration: number,
  volume: number,
  filterFreq: number
) {
  const bufSize = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start(start);
  src.stop(start + duration);
}

const SYNTH: Record<SoundName, (ctx: AudioContext) => void> = {
  'coin-purchase': (ctx) => {
    const t = ctx.currentTime;
    tone(ctx, 1200, t, 0.08, 0.15, 'sine');
    tone(ctx, 1800, t + 0.05, 0.12, 0.12, 'sine');
  },
  'battle-win': (ctx) => {
    const t = ctx.currentTime;
    tone(ctx, 523, t, 0.15, 0.12, 'triangle');
    tone(ctx, 659, t + 0.1, 0.15, 0.12, 'triangle');
    tone(ctx, 784, t + 0.2, 0.15, 0.12, 'triangle');
    tone(ctx, 1047, t + 0.3, 0.3, 0.15, 'triangle');
  },
  'battle-loss': (ctx) => {
    const t = ctx.currentTime;
    tone(ctx, 400, t, 0.2, 0.08, 'sine');
    tone(ctx, 300, t + 0.15, 0.25, 0.06, 'sine');
  },
  'rank-up': (ctx) => {
    const t = ctx.currentTime;
    noise(ctx, t, 0.15, 0.04, 4000);
    tone(ctx, 600, t, 0.1, 0.1, 'sine');
    tone(ctx, 900, t + 0.08, 0.15, 0.1, 'sine');
  },
  'rank-down': (ctx) => {
    const t = ctx.currentTime;
    noise(ctx, t, 0.12, 0.03, 2000);
    tone(ctx, 600, t, 0.1, 0.06, 'sine');
    tone(ctx, 400, t + 0.08, 0.12, 0.06, 'sine');
  },
  'notification': (ctx) => {
    const t = ctx.currentTime;
    tone(ctx, 880, t, 0.08, 0.1, 'sine');
    tone(ctx, 1100, t + 0.06, 0.1, 0.08, 'sine');
  },
  'coin-received': (ctx) => {
    const t = ctx.currentTime;
    tone(ctx, 800, t, 0.1, 0.1, 'sine');
    tone(ctx, 1000, t + 0.08, 0.1, 0.1, 'sine');
    tone(ctx, 1200, t + 0.16, 0.15, 0.12, 'sine');
  },
  'friend-request': (ctx) => {
    const t = ctx.currentTime;
    tone(ctx, 660, t, 0.12, 0.1, 'triangle');
    tone(ctx, 880, t + 0.1, 0.15, 0.08, 'triangle');
    tone(ctx, 770, t + 0.22, 0.12, 0.06, 'triangle');
  },
  'card-swap': (ctx) => {
    const t = ctx.currentTime;
    noise(ctx, t, 0.2, 0.05, 6000);
    tone(ctx, 700, t + 0.15, 0.08, 0.1, 'sine');
    tone(ctx, 1100, t + 0.2, 0.15, 0.12, 'sine');
  },
  'milestone': (ctx) => {
    const t = ctx.currentTime;
    tone(ctx, 523, t, 0.2, 0.12, 'triangle');
    tone(ctx, 659, t + 0.1, 0.2, 0.12, 'triangle');
    tone(ctx, 784, t + 0.2, 0.2, 0.12, 'triangle');
    tone(ctx, 1047, t + 0.35, 0.4, 0.15, 'triangle');
    tone(ctx, 784, t + 0.5, 0.15, 0.08, 'sine');
  },
  'message-sent': (ctx) => {
    const t = ctx.currentTime;
    noise(ctx, t, 0.08, 0.02, 5000);
    tone(ctx, 900, t + 0.02, 0.1, 0.06, 'sine');
  },
  'message-received': (ctx) => {
    const t = ctx.currentTime;
    tone(ctx, 700, t, 0.08, 0.08, 'sine');
    tone(ctx, 1000, t + 0.06, 0.12, 0.08, 'sine');
  },
  'button-click': (ctx) => {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.03);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.03);
  },
};

export function playSound(name: SoundName) {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    SYNTH[name](ctx);
  } catch {}
}

export function playSoundPreview(name: SoundName) {
  try {
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    SYNTH[name](ctx);
  } catch {}
}

export function playButtonClick() {
  try {
    if (localStorage.getItem(BUTTON_SOUNDS_KEY) === 'false') return;
    const ctx = getContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    SYNTH['button-click'](ctx);
  } catch {}
}

export function triggerButtonVibration() {
  try {
    if (localStorage.getItem(BUTTON_VIBRATION_KEY) === 'false') return;
    import('./haptics').then(({ vibrate }) => vibrate(30));
  } catch {}
}

export function triggerButtonFeedback() {
  playButtonClick();
  triggerButtonVibration();
}

export type { SoundName };
