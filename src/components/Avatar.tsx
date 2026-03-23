import { getAvatarUrl } from '../lib/avatarStorage';
import { DefaultAvatar } from './ui/DefaultAvatar';

interface AvatarProps {
  src: string | null;
  alt: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Avatar({ src, alt, size = 64, className = '', style }: AvatarProps) {
  const avatarUrl = src ? getAvatarUrl(src) : null;

  return avatarUrl ? (
    <img
      src={avatarUrl}
      alt={alt}
      width={size}
      height={size}
      className={`object-cover ${className}`}
      loading="lazy"
      style={style}
    />
  ) : (
    <DefaultAvatar size={size} className={className} />
  );
}
