import { useEffect, useRef, useState } from 'react';
import {
  playNotificationSound,
  type NotificationType,
} from '../lib/notificationSoundPreferences';

interface NotificationBadgeProps {
  count: number;
  className?: string;
  userId?: string;
  notificationType?: NotificationType | 'ad_available';
  capAt9?: boolean;
}

export default function NotificationBadge({
  count,
  className = '',
  userId,
  notificationType,
  capAt9 = false,
}: NotificationBadgeProps) {
  const prevCountRef = useRef(count);
  const [visible, setVisible] = useState(count > 0);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (
      count > prevCountRef.current &&
      prevCountRef.current >= 0 &&
      userId &&
      notificationType
    ) {
      playNotificationSound(userId, notificationType).catch((error) => {
        console.error('Error playing notification sound:', error);
      });
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
  }, [count, userId, notificationType]);

  if (!visible) return null;

  const displayValue = count > 0 ? count : prevCountRef.current;
  const displayCount = capAt9
    ? displayValue >= 9 ? '9+' : displayValue.toString()
    : displayValue > 100 ? '100+' : displayValue.toString();

  return (
    <div
      className={`absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5 shadow-lg border-2 border-black ${fadingOut ? 'animate-badge-fade-out' : 'animate-pulse'} ${className}`}
    >
      {displayCount}
    </div>
  );
}
