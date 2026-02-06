import { useEffect, useRef } from 'react';
import { playSound } from '../lib/sounds';

interface NotificationBadgeProps {
  count: number;
  className?: string;
  soundType?: 'notification' | 'coin-received' | 'friend-request';
}

export default function NotificationBadge({ count, className = '', soundType = 'notification' }: NotificationBadgeProps) {
  const prevCountRef = useRef(count);

  useEffect(() => {
    if (count > prevCountRef.current && prevCountRef.current >= 0) {
      playSound(soundType);
    }
    prevCountRef.current = count;
  }, [count, soundType]);

  if (count === 0) return null;

  const displayCount = count > 100 ? '100+' : count.toString();

  return (
    <div
      className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-lg border-2 border-black animate-pulse ${className}`}
    >
      {displayCount}
    </div>
  );
}
