import { useState, useEffect } from 'react';
import { X, Coins, ShieldCheck, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { displayUsername } from '../lib/username';

interface SendCoinsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId: string;
  recipientUsername: string;
  recipientFullName: string | null;
  recipientIsVerified: boolean;
  conversationId: string;
  onTransferComplete: (amount: number) => void;
}

const COIN_AMOUNTS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export default function SendCoinsModal({
  isOpen,
  onClose,
  recipientId,
  recipientUsername,
  recipientFullName,
  recipientIsVerified,
  conversationId,
  onTransferComplete,
}: SendCoinsModalProps) {
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [senderBalance, setSenderBalance] = useState(0);
  const [remainingSendLimit, setRemainingSendLimit] = useState(0);
  const [remainingReceiveLimit, setRemainingReceiveLimit] = useState(0);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadLimitsAndBalance();
      setSelectedAmount(10);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, recipientId]);

  const loadLimitsAndBalance = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [balanceResult, sendLimitResult, receiveLimitResult] = await Promise.all([
        supabase.from('coins').select('balance').eq('user_id', user.id).maybeSingle(),
        supabase.rpc('get_remaining_send_limit', { p_user_id: user.id }),
        supabase.rpc('get_remaining_receive_limit', { p_user_id: recipientId }),
      ]);

      if (balanceResult.data) {
        setSenderBalance(Number(balanceResult.data.balance));
      }

      if (sendLimitResult.data !== null) {
        setRemainingSendLimit(Number(sendLimitResult.data));
      }

      if (receiveLimitResult.data !== null) {
        setRemainingReceiveLimit(Number(receiveLimitResult.data));
      }
    } catch (err) {
      console.error('Error loading limits:', err);
      setError('Failed to load transfer limits');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCoins = async () => {
    setProcessing(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in');
        return;
      }

      const { data, error: transferError } = await supabase.rpc('process_coin_transfer', {
        p_sender_id: user.id,
        p_recipient_id: recipientId,
        p_amount: selectedAmount,
        p_conversation_id: conversationId,
      });

      if (transferError) {
        setError(transferError.message);
        return;
      }

      if (data && !data.success) {
        setError(data.error || 'Transfer failed');
        return;
      }

      setSuccess(true);
      setRemainingSendLimit(Number(data.remaining_send_limit));
      setRemainingReceiveLimit(Number(data.remaining_receive_limit));

      onTransferComplete(selectedAmount);

      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Error sending coins:', err);
      setError('An unexpected error occurred');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  const canAfford = senderBalance >= selectedAmount;
  const withinSendLimit = remainingSendLimit >= selectedAmount;
  const withinReceiveLimit = remainingReceiveLimit >= selectedAmount;
  const canSend = canAfford && withinSendLimit && withinReceiveLimit && !loading && !processing;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 rounded-2xl border border-white/20 max-w-md w-full p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Coins className="w-7 h-7 text-yellow-400" />
            Send Coins
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={processing}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        ) : success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Coins className="w-8 h-8 text-green-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Transfer Successful!</h3>
            <p className="text-gray-300">
              Sent {selectedAmount} coins to {recipientFullName || displayUsername(recipientUsername)}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-400">Sending to</p>
                  <p className="text-lg font-bold text-white flex items-center gap-2">
                    {recipientFullName || displayUsername(recipientUsername)}
                    {recipientIsVerified && (
                      <ShieldCheck className="w-5 h-5 text-blue-400" />
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Your Balance</p>
                  <p className="text-white font-bold">{senderBalance.toFixed(1)} coins</p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Select Amount
              </label>
              <div className="grid grid-cols-5 gap-2">
                {COIN_AMOUNTS.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setSelectedAmount(amount)}
                    disabled={processing}
                    className={`py-3 px-2 rounded-lg font-bold transition-all ${
                      selectedAmount === amount
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white scale-105 shadow-lg'
                        : 'bg-white/10 text-white hover:bg-white/20 border border-white/20'
                    } disabled:opacity-50`}
                  >
                    {amount}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 mb-6 border border-white/10 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">You can send today:</span>
                <span className={`font-bold ${remainingSendLimit >= selectedAmount ? 'text-green-400' : 'text-red-400'}`}>
                  {remainingSendLimit} coins
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Friend can receive today:</span>
                <span className={`font-bold ${remainingReceiveLimit >= selectedAmount ? 'text-green-400' : 'text-red-400'}`}>
                  {remainingReceiveLimit} coins
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            {!canAfford && (
              <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-300 text-sm">Insufficient balance</p>
              </div>
            )}

            {!withinSendLimit && canAfford && (
              <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-300 text-sm">
                  Daily send limit exceeded. You can send {remainingSendLimit} more coins today.
                </p>
              </div>
            )}

            {!withinReceiveLimit && canAfford && withinSendLimit && (
              <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-yellow-300 text-sm">
                  Recipient can only receive {remainingReceiveLimit} more coins today.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={processing}
                className="flex-1 bg-white/10 text-white py-3 rounded-xl font-bold hover:bg-white/20 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendCoins}
                disabled={!canSend}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-xl font-bold hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processing ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Coins className="w-5 h-5" />
                    Send {selectedAmount} Coins
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
