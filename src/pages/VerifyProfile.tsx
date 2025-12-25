import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function VerifyProfile() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (token) {
      verifyProfile(token);
    }
  }, [token]);

  const verifyProfile = async (verificationToken: string) => {
    try {
      const { data, error } = await supabase
        .rpc('confirm_whatsapp_verification', {
          p_token: verificationToken
        });

      if (error) throw error;

      if (data?.success) {
        setStatus('success');
        setMessage('Your profile has been verified successfully!');

        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data?.message || 'Verification failed');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setStatus('error');
      setMessage('Invalid or expired verification link');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="text-center">
          {status === 'loading' && (
            <>
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Verifying Profile...
              </h1>
              <p className="text-gray-600">
                Please wait while we verify your profile
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Verified Successfully!
              </h1>
              <p className="text-gray-600 mb-6">
                {message}
              </p>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  You now have a blue checkmark badge on your profile!
                </p>
              </div>
              <p className="text-sm text-gray-500 mt-4">
                Redirecting to homepage...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Verification Failed
              </h1>
              <p className="text-gray-600 mb-6">
                {message}
              </p>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Homepage
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
