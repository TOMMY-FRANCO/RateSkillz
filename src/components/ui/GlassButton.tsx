import { ReactNode, ButtonHTMLAttributes } from 'react';

interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  glow?: boolean;
}

export function GlassButton({
  children,
  variant = 'primary',
  className = '',
  glow = true,
  disabled,
  ...props
}: GlassButtonProps) {
  const baseStyles = `
    px-8 py-3 rounded-[20px] font-semibold uppercase text-sm tracking-wider
    backdrop-blur-[15px] transition-all duration-150
    active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variants = {
    primary: `
      bg-white/5 border border-[#00FF85] text-[#00FF85]
      ${glow ? 'shadow-[0_0_20px_rgba(0,255,133,0.4)]' : ''}
      hover:bg-[rgba(0,255,133,0.1)] hover:shadow-[0_0_30px_rgba(0,255,133,0.6)]
    `,
    secondary: `
      bg-white/5 border border-[#38BDF8] text-[#38BDF8]
      ${glow ? 'shadow-[0_0_20px_rgba(56,189,248,0.4)]' : ''}
      hover:bg-[rgba(56,189,248,0.1)] hover:shadow-[0_0_30px_rgba(56,189,248,0.6)]
    `,
    ghost: `
      bg-white/5 border border-white/10 text-white
      hover:bg-white/10 hover:border-[#00E0FF] hover:shadow-[0_0_20px_rgba(0,224,255,0.3)]
    `
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
