import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Loader2 } from 'lucide-react';
import { validatePassword, getPasswordRequirements } from '../lib/passwordValidation';
import { supabase } from '../lib/supabase';

declare global {
  interface Window {
    grecaptcha: any;
  }
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

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${import.meta.env.VITE_RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => setRecaptchaLoaded(true);
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
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
    setLoading(true);

    if (username.length < 3) {
      setError('Username must be at least 3 characters');
      setLoading(false);
      return;
    }

    const validation = validatePassword(password);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid password');
      setLoading(false);
      return;
    }

    const ageNum = age ? parseInt(age) : null;
    if (ageNum !== null && ageNum < 11) {
      setError('You must be at least 11 years old to use this app.');
      setLoading(false);
      return;
    }
    if (ageNum !== null && ageNum > 150) {
      setError('Please enter a valid age (maximum 150).');
      setLoading(false);
      return;
    }

    if (!termsAccepted) {
      setError('You must accept the Terms of Service to create an account');
      setLoading(false);
      return;
    }

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

const { error } = await signUp(email, password, username, fullName, recaptchaToken, ageNum, deviceFingerprint);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate(`/profile/${username.toLowerCase()}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#00FF85]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#38BDF8]/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        <div className="glass-container p-8 animate-fade-in">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-[#00FF85] to-[#00E0FF] rounded-xl flex items-center justify-center shadow-lg shadow-[#00FF85]/30">
                <UserPlus className="w-8 h-8 text-black" />
              </div>
            </div>
            <h2 className="text-4xl font-bold text-white mb-2 heading-glow">Create Account</h2>
            <p className="text-[#B0B8C8]">Join and create your player card</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="fullName" className="block text-sm font-semibold text-white mb-2 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-white mb-2 uppercase tracking-wider">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full"
                  placeholder="johndoe"
                />
                <p className="mt-1 text-xs text-[#6B7280]">Lowercase letters, numbers, and underscores only</p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-white mb-2 uppercase tracking-wider">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-white mb-2 uppercase tracking-wider">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                  placeholder="8+ chars, 1 number, 1 symbol (!@#$%^&*)"
                />
                <p className="mt-1 text-xs text-[#6B7280]">{getPasswordRequirements()}</p>
              </div>

              <div>
                <label htmlFor="age" className="block text-sm font-semibold text-white mb-2 uppercase tracking-wider">
                  Age (Optional)
                </label>
                <input
                  id="age"
                  type="number"
                  min="11"
                  max="150"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full"
                  placeholder="Enter your age (11-150)"
                />
                <p className="mt-1 text-xs text-[#6B7280]">Minimum age: 11. Used for Safety & Privacy Settings</p>
              </div>
            </div>

            <div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="w-5 h-5 mt-0.5 rounded border-2 border-[#B0B8C8] bg-[rgba(255,255,255,0.08)] checked:bg-[#00E0FF] checked:border-[#00E0FF] cursor-pointer"
                />
                <span className="text-sm text-[#B0B8C8] group-hover:text-white transition-colors">
                  I agree to the{' '}
                  <Link
                    to="/terms"
                    target="_blank"
                    className="text-[#00E0FF] hover:text-[#00FF85] underline"
                  >
                    Terms of Service
                  </Link>
                  {' '}and{' '}
                  <Link
                    to="/privacy-policy"
                    target="_blank"
                    className="text-[#00E0FF] hover:text-[#00FF85] underline"
                  >
                    Privacy Policy
                  </Link>
                  {' '}and understand that virtual coins have no real-world value and cannot be withdrawn or exchanged for money.
                </span>
              </label>
            </div>

            {error && (
              <div className="glass-container bg-red-500/10 border-red-500/50 p-4">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-4 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                'Create Account'
              )}
            </button>

            <p className="text-center text-[#B0B8C8]">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-[#00E0FF] hover:text-[#00FF85] font-semibold transition-colors bg-transparent border-none cursor-pointer"
              >
                Sign in
              </button>
            </p>

            <p className="text-center text-xs text-[#6B7280]">
              By signing up you agree to our{' '}
              <Link to="/terms" className="text-[#00E0FF] hover:text-[#00FF85] underline transition-colors">
                Terms of Service
              </Link>
              {' '}and{' '}
              <Link to="/privacy-policy" className="text-[#00E0FF] hover:text-[#00FF85] underline transition-colors">
                Privacy Policy
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
