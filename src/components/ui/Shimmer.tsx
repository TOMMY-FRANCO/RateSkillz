import { ReactNode, CSSProperties, useState, useEffect } from 'react';

type ShimmerSpeed = 'fast' | 'slow';

interface ShimmerBarProps {
  className?: string;
  speed?: ShimmerSpeed;
  style?: CSSProperties;
}

const shimmerGradient: Record<ShimmerSpeed, string> = {
  fast: 'bg-gradient-to-r from-transparent via-[var(--shimmer-accent-color)] to-transparent animate-shimmer-accent',
  slow: 'bg-gradient-to-r from-transparent via-[var(--shimmer-slow-color)] to-transparent animate-shimmer-slow',
};

export function ShimmerBar({ className = '', speed = 'fast', style }: ShimmerBarProps) {
  return (
    <div
      className={`relative overflow-hidden bg-[var(--shimmer-base)] animate-skeleton-pulse ${className}`}
      style={style}
    >
      <div className={`absolute inset-0 ${shimmerGradient[speed]}`} />
    </div>
  );
}

interface StaggerContainerProps {
  children: ReactNode;
  baseDelay?: number;
  className?: string;
}

export function StaggerContainer({ children, baseDelay = 0, className = '' }: StaggerContainerProps) {
  return (
    <div
      className={`animate-stagger-fade-in ${className}`}
      style={{ animationDelay: `${baseDelay}ms` }}
    >
      {children}
    </div>
  );
}

interface StaggerItemProps {
  children: ReactNode;
  index: number;
  interval?: number;
  className?: string;
}

export function StaggerItem({ children, index, interval = 50, className = '' }: StaggerItemProps) {
  return (
    <div
      className={`animate-stagger-fade-in ${className}`}
      style={{ animationDelay: `${index * interval}ms` }}
    >
      {children}
    </div>
  );
}

interface ContentRevealProps {
  children: ReactNode;
  visible: boolean;
  fallback?: ReactNode;
  className?: string;
}

export function ContentReveal({ children, visible, fallback, className = '' }: ContentRevealProps) {
  if (!visible) return fallback ? <>{fallback}</> : null;
  return <div className={`animate-content-reveal ${className}`}>{children}</div>;
}

interface SlowLoadMessageProps {
  loading: boolean;
  threshold?: number;
  message?: string;
  className?: string;
}

export function SlowLoadMessage({
  loading,
  threshold = 3000,
  message = 'Still loading...',
  className = '',
}: SlowLoadMessageProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), threshold);
    return () => clearTimeout(timer);
  }, [loading, threshold]);

  if (!show) return null;

  return (
    <p className={`text-center text-xs text-gray-500 animate-content-reveal pt-1 ${className}`}>
      {message}
    </p>
  );
}
