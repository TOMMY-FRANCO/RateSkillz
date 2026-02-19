import { X } from 'lucide-react';

const QUICK_MESSAGES = [
  'Battle me! ⚽',
  'Rematch?',
  'Your move! 🏆',
  'Check my new stats 👀',
  'I want to buy your card',
  'Your card value is rising!',
  "You've been gone too long!",
  'Come back and battle me!',
  'I owe you coins next battle!',
];

const DAILY_LIMIT = 3;

interface QuickMessageTrayProps {
  onSend: (text: string) => void;
  onClose: () => void;
  usedToday: number;
  disabled?: boolean;
}

export default function QuickMessageTray({ onSend, onClose, usedToday, disabled }: QuickMessageTrayProps) {
  const remaining = DAILY_LIMIT - usedToday;
  const isLimitReached = remaining <= 0;

  return (
    <div className="w-full animate-[slideUpFade_0.2s_ease-out]">
      <div className="bg-gray-900/95 backdrop-blur-md border border-white/10 rounded-2xl mx-0 mb-2 overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-base">⚽</span>
            <span className="text-white font-semibold text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
              Quick Messages
            </span>
          </div>
          <div className="flex items-center gap-3">
            {isLimitReached ? (
              <span className="text-xs text-red-400 font-medium" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Limit reached for today
              </span>
            ) : (
              <span className="text-xs text-gray-400" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                {remaining} of {DAILY_LIMIT} left today
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-3 py-3">
          {isLimitReached ? (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">⚽</div>
              <p className="text-gray-400 text-sm" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                You've reached your limit of {DAILY_LIMIT} quick messages for today.
              </p>
              <p className="text-gray-500 text-xs mt-1" style={{ fontFamily: 'Montserrat, sans-serif' }}>
                Resets at midnight
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {QUICK_MESSAGES.map((msg) => (
                <button
                  key={msg}
                  onClick={() => !disabled && onSend(msg)}
                  disabled={disabled}
                  className="bg-white/5 hover:bg-gradient-to-r hover:from-cyan-600/40 hover:to-teal-600/40 border border-white/10 hover:border-cyan-500/50 text-white text-xs font-medium px-3 py-2 rounded-xl transition-all duration-150 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'Montserrat, sans-serif' }}
                >
                  {msg}
                </button>
              ))}
            </div>
          )}
        </div>

        {!isLimitReached && (
          <div className="px-4 pb-3">
            <div className="flex gap-1">
              {Array.from({ length: DAILY_LIMIT }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all ${
                    i < usedToday
                      ? 'bg-gradient-to-r from-cyan-500 to-teal-500'
                      : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export { QUICK_MESSAGES, DAILY_LIMIT };
