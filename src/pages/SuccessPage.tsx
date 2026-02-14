import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export function SuccessPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 text-center max-w-md">
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-white mb-2">Payment Successful!</h1>
        <p className="text-white/60 mb-6">
          Thank you for your purchase. Your subscription is now active.
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="bg-gradient-to-r from-[#00E0FF] to-[#7B2FF7] hover:opacity-90 text-white font-medium py-2.5 px-6 rounded-md transition-opacity"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
