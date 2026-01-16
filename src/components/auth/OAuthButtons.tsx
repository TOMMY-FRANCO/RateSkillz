import { useState } from 'react';
import { supabase } from '../../lib/supabase';

interface OAuthButtonsProps {
  mode?: 'signin' | 'signup';
  theme?: 'light' | 'dark';
}

export function OAuthButtons({ mode = 'signin', theme = 'light' }: OAuthButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOAuthSignIn = async (provider: 'google' | 'discord' | 'facebook') => {
    setLoading(provider);
    setError(null);

    try {
      const redirectTo = 'https://niurjxqttyaxmjrladrs.supabase.co/auth/v1/callback';

      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (signInError) {
        console.error(`${provider} OAuth redirect error:`, signInError);
        throw signInError;
      }

      if (!data?.url) {
        throw new Error('No redirect URL received from OAuth provider');
      }

      // The redirect will happen automatically
    } catch (err: any) {
      console.error(`${provider} OAuth error:`, err);
      setError(err.message || `Failed to sign in with ${provider}. Please try again.`);
      setLoading(null);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        );
      case 'discord':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
        );
      case 'facebook':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669c1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getProviderColor = (provider: string) => {
    if (theme === 'dark') {
      switch (provider) {
        case 'google':
          return 'glass-card text-white border border-[#00E0FF]/30 hover:border-[#00E0FF]/50';
        case 'discord':
          return 'glass-card text-white border border-[#5865F2]/30 hover:border-[#5865F2]/50';
        case 'facebook':
          return 'glass-card text-white border border-[#1877F2]/30 hover:border-[#1877F2]/50';
        default:
          return 'glass-card text-white border border-[#B0B8C8]/30 hover:border-[#B0B8C8]/50';
      }
    }

    switch (provider) {
      case 'google':
        return 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-300';
      case 'discord':
        return 'bg-[#5865F2] hover:bg-[#4752C4] text-white';
      case 'facebook':
        return 'bg-[#1877F2] hover:bg-[#166FE5] text-white';
      default:
        return 'bg-gray-100 hover:bg-gray-200 text-gray-700';
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'google':
        return 'Google';
      case 'discord':
        return 'Discord';
      case 'facebook':
        return 'Facebook';
      default:
        return provider;
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className={`p-3 border rounded-md ${
          theme === 'dark'
            ? 'bg-red-500/10 border-red-500/30 text-red-400'
            : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="space-y-2">
        {(['google', 'discord', 'facebook'] as const).map((provider) => (
          <button
            key={provider}
            type="button"
            onClick={() => handleOAuthSignIn(provider)}
            disabled={loading !== null}
            className={`w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getProviderColor(provider)}`}
          >
            {loading === provider ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current" />
            ) : (
              getProviderIcon(provider)
            )}
            <span>
              {loading === provider
                ? 'Redirecting...'
                : `${mode === 'signup' ? 'Sign up' : 'Sign in'} with ${getProviderName(provider)}`}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
