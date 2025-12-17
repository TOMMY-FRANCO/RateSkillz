import React, { useEffect, useState } from 'react';
import { CheckCircle, ArrowRight, Home } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

export function CheckoutSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [loading, setLoading] = useState(true);
  const [orderDetails, setOrderDetails] = useState<any>(null);

  useEffect(() => {
    if (sessionId) {
      // In a real app, you might want to verify the session with your backend
      setLoading(false);
    }
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Confirming your purchase...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100 mb-6">
            <CheckCircle className="h-12 w-12 text-green-600" />
          </div>
          
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Payment Successful!
          </h2>
          
          <p className="text-gray-600 mb-8">
            Thank you for your purchase. Your payment has been processed successfully.
          </p>

          {sessionId && (
            <div className="bg-gray-100 rounded-lg p-4 mb-8">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Session ID:</span>
                <br />
                <span className="font-mono text-xs break-all">{sessionId}</span>
              </p>
            </div>
          )}

          <div className="space-y-4">
            <Link
              to="/profile"
              className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              View Profile
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            
            <Link
              to="/"
              className="w-full flex justify-center items-center px-4 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Home className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}