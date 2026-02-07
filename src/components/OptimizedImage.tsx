import { useState, useEffect, useRef } from 'react';
import { User } from 'lucide-react';

interface OptimizedImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
  loading?: 'lazy' | 'eager';
}

/**
 * Optimized image component with lazy loading and fallback
 * Improves performance by:
 * - Lazy loading images by default
 * - Showing placeholder while loading
 * - Handling errors gracefully
 * - Using IntersectionObserver for efficient loading
 */
export default function OptimizedImage({
  src,
  alt,
  className = '',
  fallbackIcon,
  loading = 'lazy',
}: OptimizedImageProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!src || loading === 'eager') {
      setImageSrc(src || null);
      return;
    }

    // Use IntersectionObserver for lazy loading
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            observerRef.current?.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before visible
      }
    );

    if (imgRef.current) {
      observerRef.current.observe(imgRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [src, loading]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  if (!src || hasError) {
    return (
      <div className={`${className} flex items-center justify-center bg-white/10`}>
        {fallbackIcon || <User className="w-8 h-8 text-white/40" />}
      </div>
    );
  }

  return (
    <>
      {isLoading && (
        <div className={`${className} absolute inset-0 flex items-center justify-center bg-white/5 animate-pulse`}>
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin"></div>
        </div>
      )}
      <img
        ref={imgRef}
        src={imageSrc || undefined}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onLoad={handleLoad}
        onError={handleError}
        loading={loading}
      />
    </>
  );
}
