import React from 'react';

interface NeonCardProps {
  variant?: 'cyan' | 'green' | 'default';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export function NeonCard({
  variant = 'cyan',
  children,
  className = '',
  onClick,
  hover = true,
}: NeonCardProps) {
  const borderColor = {
    cyan: 'border-neon-cyan',
    green: 'border-neon-green',
    default: 'border-white/30',
  };

  const glowColor = {
    cyan: 'shadow-neon-cyan hover:shadow-neon-cyan-strong',
    green: 'shadow-neon-green hover:shadow-neon-green-strong',
    default: 'shadow-lg hover:shadow-xl',
  };

  const hoverEffects = hover ? 'hover:scale-105 hover:-translate-y-1' : '';
  const cursorStyle = onClick ? 'cursor-pointer' : '';

  return (
    <div
      onClick={onClick}
      className={`
        bg-space/60 backdrop-blur-sm border-2 ${borderColor[variant]}
        ${glowColor[variant]} rounded-lg overflow-hidden
        transition-all duration-300 ${hoverEffects} ${cursorStyle} ${className}
      `}
      style={{
        background: 'linear-gradient(135deg, rgba(10, 14, 39, 0.8) 0%, rgba(11, 47, 31, 0.8) 100%)',
      }}
    >
      {children}
    </div>
  );
}
