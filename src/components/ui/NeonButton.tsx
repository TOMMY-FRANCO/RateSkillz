import React from 'react';

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'cyan' | 'green' | 'default';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export function NeonButton({
  variant = 'cyan',
  size = 'md',
  className = '',
  children,
  ...props
}: NeonButtonProps) {
  const baseStyles = 'font-heading font-semibold tracking-wide uppercase transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden';

  const variantStyles = {
    cyan: 'bg-space/50 border-2 border-neon-cyan text-neon-cyan hover:bg-neon-cyan/10 hover:shadow-neon-cyan-strong',
    green: 'bg-space/50 border-2 border-neon-green text-neon-green hover:bg-neon-green/10 hover:shadow-neon-green-strong',
    default: 'bg-space/70 border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50',
  };

  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };

  const neonGlow = variant === 'cyan'
    ? 'shadow-neon-cyan hover:animate-neon-pulse'
    : variant === 'green'
    ? 'shadow-neon-green hover:animate-neon-pulse'
    : '';

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${neonGlow} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
