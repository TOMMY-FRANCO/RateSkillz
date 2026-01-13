import { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className = '', hover = false, onClick }: GlassCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        bg-white/5 backdrop-blur-[15px]
        border border-white/10 rounded-[20px]
        transition-all duration-300 ease-out
        ${hover ? 'hover:bg-white/10 hover:shadow-[0_0_30px_rgba(0,255,133,0.2)] hover:-translate-y-1 cursor-pointer' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
