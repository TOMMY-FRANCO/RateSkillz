interface NotificationBadgeProps {
  count: number;
  className?: string;
}

export default function NotificationBadge({ count, className = '' }: NotificationBadgeProps) {
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
