import React from 'react';

interface NeonLoaderProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'cyan' | 'green';
  text?: string;
}

export function NeonLoader({ size = 'md', variant = 'cyan', text }: NeonLoaderProps) {
  const sizeStyles = {
    sm: 'w-8 h-8 border-2',
    md: 'w-12 h-12 border-3',
    lg: 'w-16 h-16 border-4',
  };

  const colorStyles = {
    cyan: 'border-neon-cyan border-t-transparent',
    green: 'border-neon-green border-t-transparent',
  };

  const glowStyles = {
    cyan: 'shadow-neon-cyan',
    green: 'shadow-neon-green',
  };

  const textColor = {
    cyan: 'text-neon-cyan',
    green: 'text-neon-green',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div
        className={`
          ${sizeStyles[size]} ${colorStyles[variant]} ${glowStyles[variant]}
          rounded-full animate-spin
        `}
        style={{
          filter: variant === 'cyan'
            ? 'drop-shadow(0 0 10px rgba(0,217,255,0.8))'
            : 'drop-shadow(0 0 10px rgba(57,255,20,0.8))',
        }}
      />
      {text && (
        <p className={`font-heading text-lg uppercase tracking-wider ${textColor[variant]} animate-neon-pulse`}>
          {text}
        </p>
      )}
    </div>
  );
}

export function NeonFullPageLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 bg-space flex items-center justify-center z-50">
      <div className="relative">
        <div className="absolute inset-0 bg-neon-cyan/20 blur-3xl animate-neon-pulse" />
        <NeonLoader size="lg" variant="cyan" text={text} />
      </div>
    </div>
  );
}
