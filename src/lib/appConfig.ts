/**
 * Get the base URL for the application
 * In production, always uses https://ratingskill.com
 * In development, falls back to window.location.origin
 */
export function getAppUrl(): string {
  // Use VITE_APP_URL from environment variables (production)
  const envUrl = import.meta.env.VITE_APP_URL;

  if (envUrl) {
    return envUrl;
  }

  // Fallback for local development
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  // Default fallback (should never be reached in normal usage)
  return 'https://ratingskill.com';
}
