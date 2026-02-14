import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { SignupForm } from '../components/auth/SignupForm';

export function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <div className="glass-card p-8">
          <h1 className="text-3xl font-bold text-white mb-6">Sign Up</h1>
          <SignupForm />
        </div>
      </div>
    </div>
  );
}
