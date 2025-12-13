import { isUserOnline } from '../contexts/AuthContext';

interface OnlineStatusProps {
  lastActive?: string;
  size?: 'small' | 'medium' | 'large';
}

export default function OnlineStatus({ lastActive, size = 'medium' }: OnlineStatusProps) {
  const isOnline = isUserOnline(lastActive);

  const sizeClasses = {
    small: 'w-2 h-2',
    medium: 'w-3 h-3',
    large: 'w-4 h-4',
  };

  return (
    <div className="relative inline-flex">
      <div
        className={`${sizeClasses[size]} rounded-full ${
          isOnline ? 'bg-green-500' : 'bg-red-500'
        }`}
      />
      {isOnline && (
        <div
          className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-green-500 animate-ping opacity-75`}
        />
      )}
    </div>
  );
}
