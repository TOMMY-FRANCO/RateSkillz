import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { validatePassword, getPasswordRequirements } from '../../lib/passwordValidation';
import { OAuthButtons } from './OAuthButtons';
import { supabase } from '../../lib/supabase';

declare global {
  interface Window {
    grecaptcha: any;
  }
}

interface SignupFormProps {
  onSuccess?: () => void;
  onSwitchToLogin?: () => void;
}

async function generateDeviceFingerprint(): Promise<string> {
  const components = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency ?? '',
    navigator.platform ?? '',
  ];

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.textBaseline = 'top';
      ctx.font = '14px Arial';
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('RatingSkill™', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('RatingSkill™', 4, 17);
      components.push(canvas.toDataURL());
    }
  } catch {
    // Canvas blocked — skip
  }

  const raw = components.join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function SignupForm({ onSuccess, onSwitchToLogin }: SignupFormProps) {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [age, setAge] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);

  useEffect(() => {
    if (window.grecaptcha) {
      setRecaptchaLoaded(true);
      return;
    }
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (!siteKey) return;
    const existing = document.querySelector(`script[src*="recaptcha"]`);
    if (existing) {
      setRecaptchaLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setRecaptchaLoaded(true);
    document.body.appendChild(script);
  }, []);

  const executeRecaptcha = async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!window.grecaptcha || !recaptchaLoaded) {
        reject(new Error('reCAPTCHA not loaded'));
        return;
      }
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(import.meta.env.VITE_RECAPTCHA_SITE_KEY, { action: 'signup' })
          .then((token: string) => resolve(token))
          .catch((err: any) => reject(err));
      });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Full name is required');
      return;
    }

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (!/^[a-z0-9_]+$/.test(username)) {
      setError('Username can only contain lowercase letters, numbers, and underscores');
      return;
    }

    const validation = validatePassword(password);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid password');
      return;
    }

    const ageNum = age ? parseInt(age) : null;
    if (ageNum !== null && ageNum < 11) {
      setError('You must be at least 11 years old to use this app.');
      return;
    }
    if (ageNum !== null && ageNum > 150) {
      setError('Please enter a valid age (maximum 150).');
      return;
    }

    if (!termsAccepted) {
      setError('You must accept the Terms of Service to create an account');
      return;
    }

    setLoading(true);

    let recaptchaToken = '';
try {
  recaptchaToken = await executeRecaptcha();
} catch {
  // reCAPTCHA unavailable — proceed without it
}

let deviceFingerprint = '';
try {
  deviceFingerprint = await generateDeviceFingerprint();
  const { data: fingerprintExists } = await supabase
    .rpc('check_device_fingerprint', { p_fingerprint: deviceFingerprint });
  if (fingerprintExists) {
    setError('An account already exists on this device. If this is you, please sign in instead. If you are a different person, please use a different browser. Creating multiple accounts is not permitted.');
    setLoading(false);
    return;
  }
} catch {
  // Fingerprint check failed — proceed without it
}

const { error: signUpError } = await signUp(email, password, username, fullName, recaptchaToken, ageNum, deviceFingerprint);

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      if (onSuccess) {
        onSuccess();
      }
      navigate(`/profile/${username.toLowerCase()}`);
    }
  };

  return (
    <div className="space-y-6">
      <OAuthButtons mode="signup" theme="dark" />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-white/10"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[#1a1f2e] text-white/60">Or continue with email</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-md text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="signup-fullname" className="block text-sm font-medium text-white/80 mb-2">
            Full Name
          </label>
          <input
            id="signup-fullname"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/40 focus:outline-none focus:border-[#00E0FF]/50 transition-colors"
            placeholder="John Doe"
          />
        </div>

        <div>
          <label htmlFor="signup-username" className="block text-sm font-medium text-white/80 mb-2">
            Username
          </label>
          <input
            id="signup-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            required
            minLength={3}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/40 focus:outline-none focus:border-[#00E0FF]/50 transition-colors"
            placeholder="johndoe"
          />
          <p className="text-xs text-white/50 mt-1">Lowercase letters, numbers, and underscores only. Min 3 characters.</p>
        </div>

        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-white/80 mb-2">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/40 focus:outline-none focus:border-[#00E0FF]/50 transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="signup-password" className="block text-sm font-medium text-white/80 mb-2">
            Password
          </label>
          <input
            id="signup-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/40 focus:outline-none focus:border-[#00E0FF]/50 transition-colors"
            placeholder="8+ chars, 1 number, 1 symbol (!@#$%^&*)"
          />
          <p className="text-xs text-white/50 mt-1">{getPasswordRequirements()}</p>
        </div>

        <div>
          <label htmlFor="signup-age" className="block text-sm font-medium text-white/80 mb-2">
            Age (Optional)
          </label>
          <input
            id="signup-age"
            type="number"
            min="11"
            max="150"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-md text-white placeholder-white/40 focus:outline-none focus:border-[#00E0FF]/50 transition-colors"
            placeholder="Enter your age (11-150)"
          />
          <p className="text-xs text-white/50 mt-1">Minimum age: 11. Used for Safety & Privacy Settings</p>
        </div>

        <div>
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border border-white/20 bg-white/5 checked:bg-[#00E0FF] checked:border-[#00E0FF] cursor-pointer flex-shrink-0"
            />
            <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors leading-relaxed">
              I agree to the{' '}
              <Link
                to="/terms"
                target="_blank"
                className="text-[#00E0FF] hover:text-[#00E0FF]/80 underline"
              >
                Terms of Service
              </Link>
              {' '}and understand that virtual coins have no real-world value and cannot be withdrawn or exchanged for money.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-[#00E0FF] to-[#7B2FF7] hover:opacity-90 text-white font-medium py-2.5 px-4 rounded-md transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      {onSwitchToLogin && (
        <p className="text-center text-sm text-white/60">
          Already have an account?{' '}
          <button
            onClick={onSwitchToLogin}
            className="text-[#00E0FF] hover:text-[#00E0FF]/80 font-medium transition-colors"
          >
            Sign in
          </button>
        </p>
      )}
    </div>
  );
}
