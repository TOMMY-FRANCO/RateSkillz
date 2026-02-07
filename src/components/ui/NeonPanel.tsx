import React from 'react';

interface NeonPanelProps {
  title?: string;
  variant?: 'cyan' | 'green' | 'default';
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export function NeonPanel({
  title,
  variant = 'cyan',
  children,
  className = '',
  headerAction,
}: NeonPanelProps) {
  const borderColor = {
    cyan: 'border-neon-cyan shadow-neon-cyan',
    green: 'border-neon-green shadow-neon-green',
    default: 'border-white/30 shadow-lg',
  };

  const titleColor = {
    cyan: 'text-neon-cyan',
    green: 'text-neon-green',
    default: 'text-white',
  };

  const titleGlow = {
    cyan: 'neon-text-cyan',
    green: 'neon-text-green',
    default: '',
  };

  return (
    <div
      className={`bg-space/80 backdrop-blur-sm border-2 ${borderColor[variant]} rounded-lg overflow-hidden ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgba(10, 14, 39, 0.95) 0%, rgba(11, 47, 31, 0.95) 100%)',
      }}
    >
      {title && (
        <div className={`px-6 py-4 border-b-2 ${borderColor[variant]} bg-black/30 flex justify-between items-center`}>
          <h3 className={`font-heading text-2xl font-bold uppercase tracking-wider ${titleColor[variant]} ${titleGlow[variant]}`}>
            {title}
          </h3>
          {headerAction}
        </div>
      )}
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}
