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
    px-8 py-3 rounded-lg font-bold uppercase text-sm tracking-wider
    backdrop-blur-[15px] transition-all duration-150
    active:scale-[0.96] disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const variants = {
    primary: `
      bg-[rgba(15,24,41,0.85)] border-[1.5px] border-[#00E0FF] text-[#5FFFFF]
      ${glow ? 'shadow-[0_0_20px_rgba(0,224,255,0.4)]' : ''}
      hover:bg-[rgba(0,224,255,0.15)] hover:border-[#5FFFFF] hover:shadow-[0_0_30px_rgba(0,224,255,0.6)]
    `,
    secondary: `
      bg-[rgba(15,24,41,0.85)] border-[1.5px] border-[#38BDF8] text-[#38BDF8]
      ${glow ? 'shadow-[0_0_20px_rgba(56,189,248,0.4)]' : ''}
      hover:bg-[rgba(56,189,248,0.1)] hover:shadow-[0_0_30px_rgba(56,189,248,0.6)]
    `,
    ghost: `
      bg-[rgba(15,24,41,0.6)] border border-[rgba(0,224,255,0.3)] text-white
      hover:bg-[rgba(15,24,41,0.95)] hover:border-[#00E0FF] hover:shadow-[0_0_20px_rgba(0,224,255,0.4)]
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
