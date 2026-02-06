import { useEffect, useRef, useState } from 'react';
import { playSound } from '../lib/sounds';

type BadgeSoundType = 'notification' | 'coin-received' | 'friend-request' | 'card-swap' | 'message-received';

interface NotificationBadgeProps {
  count: number;
  className?: string;
  soundType?: BadgeSoundType;
}

export default function NotificationBadge({ count, className = '', soundType = 'notification' }: NotificationBadgeProps) {
  const prevCountRef = useRef(count);
  const [visible, setVisible] = useState(count > 0);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (count > prevCountRef.current && prevCountRef.current >= 0) {
      playSound(soundType);
    }

    if (count > 0) {
      setVisible(true);
      setFadingOut(false);
    } else if (prevCountRef.current > 0 && count === 0) {
      setFadingOut(true);
      const timer = setTimeout(() => {
        setVisible(false);
        setFadingOut(false);
      }, 400);
      prevCountRef.current = count;
      return () => clearTimeout(timer);
    }

    prevCountRef.current = count;
  }, [count, soundType]);

  if (!visible) return null;

  const displayValue = count > 0 ? count : prevCountRef.current;
  const displayCount = displayValue > 100 ? '100+' : displayValue.toString();

  return (
    <div
      className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-lg border-2 border-black ${fadingOut ? 'animate-badge-fade-out' : 'animate-pulse'} ${className}`}
    >
      {displayCount}
    </div>
  );
}
