import { ShimmerBar, StaggerItem } from './Shimmer';
import type { CSSProperties } from 'react';

type ShimmerSpeed = 'fast' | 'slow';

interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const avatarSizes = {
  sm: 'w-8 h-8',
  md: 'w-9 h-9',
  lg: 'w-12 h-12',
};

export function SkeletonAvatar({ size = 'md', className = '' }: SkeletonAvatarProps) {
  return <ShimmerBar className={`${avatarSizes[size]} rounded-full flex-shrink-0 ${className}`} />;
}

interface SkeletonTextProps {
  width?: string | number;
  lines?: number;
  lineHeight?: string;
  speed?: ShimmerSpeed;
  className?: string;
}

export function SkeletonText({
  width,
  lines = 1,
  lineHeight = 'h-3.5',
  speed = 'fast',
  className = '',
}: SkeletonTextProps) {
  if (lines === 1) {
    const style: CSSProperties = width ? { width: typeof width === 'number' ? `${width}px` : width } : {};
    return <ShimmerBar className={`${lineHeight} rounded ${className}`} speed={speed} style={style} />;
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => {
        const lineWidth = i === lines - 1 ? '60%' : `${100 - i * 10}%`;
        return (
          <ShimmerBar
            key={i}
            className={`${lineHeight} rounded`}
            speed={speed}
            style={{ width: lineWidth }}
          />
        );
      })}
    </div>
  );
}

interface SkeletonRowProps {
  index?: number;
  avatarSize?: 'sm' | 'md' | 'lg';
  nameWidth?: number;
  showMeta?: boolean;
  className?: string;
}

export function SkeletonRow({
  index = 0,
  avatarSize = 'md',
  nameWidth = 110,
  showMeta = true,
  className = '',
}: SkeletonRowProps) {
  return (
    <StaggerItem index={index} className={`flex items-center gap-3 ${className}`}>
      <SkeletonAvatar size={avatarSize} />
      <StaggerItem index={index} interval={100} className="flex-1 space-y-1.5">
        <SkeletonText width={nameWidth - index * 12} />
        {showMeta && <SkeletonText width={64} lineHeight="h-2.5" />}
      </StaggerItem>
    </StaggerItem>
  );
}

interface SkeletonCardProps {
  rows?: number;
  className?: string;
}

export function SkeletonCard({ rows = 3, className = '' }: SkeletonCardProps) {
  return (
    <div className={`bg-white/[0.03] rounded-xl border border-white/[0.06] p-3 space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} index={i} />
      ))}
    </div>
  );
}

interface SkeletonButtonProps {
  className?: string;
  shimmer?: boolean;
}

export function SkeletonButton({ className = '', shimmer = true }: SkeletonButtonProps) {
  return (
    <div className={`h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center relative overflow-hidden ${className}`}>
      {shimmer && (
        <>
          <ShimmerBar className="h-4 w-28 rounded" />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent animate-shimmer-slow" />
        </>
      )}
    </div>
  );
}

interface SkeletonLimitRowProps {
  className?: string;
}

export function SkeletonLimitRow({ className = '' }: SkeletonLimitRowProps) {
  return (
    <div className={`flex justify-between ${className}`}>
      <ShimmerBar className="h-3.5 w-28 rounded" speed="slow" />
      <ShimmerBar className="h-3.5 w-20 rounded" speed="slow" />
    </div>
  );
}
