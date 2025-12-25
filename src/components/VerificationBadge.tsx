import { CheckCircle, XCircle } from 'lucide-react';

interface VerificationBadgeProps {
  isVerified: boolean;
  hasSocialBadge: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function VerificationBadge({
  isVerified,
  hasSocialBadge,
  size = 'md',
  className = ''
}: VerificationBadgeProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const iconSize = {
    sm: 16,
    md: 24,
    lg: 32
  };

  if (!isVerified) {
    return (
      <div className={`relative inline-flex items-center justify-center ${className}`}>
        <XCircle
          className={`${sizeClasses[size]} text-red-500`}
          size={iconSize[size]}
          strokeWidth={2.5}
        />
      </div>
    );
  }

  if (isVerified && !hasSocialBadge) {
    return (
      <div className={`relative inline-flex items-center justify-center ${className}`}>
        <CheckCircle
          className={`${sizeClasses[size]} text-blue-500`}
          size={iconSize[size]}
          strokeWidth={2.5}
        />
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <div className="relative">
        <div
          className={`absolute inset-0 rounded-full border-[3px] border-yellow-400 animate-pulse`}
          style={{
            transform: 'scale(1.3)',
            boxShadow: '0 0 12px rgba(250, 204, 21, 0.6)'
          }}
        />
        <CheckCircle
          className={`${sizeClasses[size]} text-blue-500 relative z-10`}
          size={iconSize[size]}
          strokeWidth={2.5}
        />
      </div>
    </div>
  );
}
