import { formatTimeAgo, isOnline } from '../lib/presence';

interface OnlineStatusProps {
  lastActive?: string;
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export default function OnlineStatus({
  lastActive,
  showText = true,
  size = 'medium',
  className = ''
}: OnlineStatusProps) {
  const userIsOnline = isOnline(lastActive);
  const statusText = formatTimeAgo(lastActive);

  const dotSizeClasses = {
    small: 'w-2 h-2',
    medium: 'w-3 h-3',
    large: 'w-4 h-4',
  };

  const textSizeClasses = {
    small: 'text-xs',
    medium: 'text-sm',
    large: 'text-base',
  };

  if (showText) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className="relative inline-flex">
          <div
            className={`${dotSizeClasses[size]} rounded-full ${
              userIsOnline ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />
          {userIsOnline && (
            <div
              className={`absolute inset-0 ${dotSizeClasses[size]} rounded-full bg-green-500 animate-ping opacity-75`}
            />
          )}
        </div>
        <span className={`${textSizeClasses[size]} ${
          userIsOnline ? 'text-green-400' : 'text-gray-400'
        } font-medium`}>
          {statusText}
        </span>
      </div>
    );
  }

  return (
    <div className={`relative inline-flex ${className}`}>
      <div
        className={`${dotSizeClasses[size]} rounded-full ${
          userIsOnline ? 'bg-green-500' : 'bg-gray-500'
        }`}
      />
      {userIsOnline && (
        <div
          className={`absolute inset-0 ${dotSizeClasses[size]} rounded-full bg-green-500 animate-ping opacity-75`}
        />
      )}
    </div>
  );
}
