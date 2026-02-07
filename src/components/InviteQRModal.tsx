import { useEffect, useRef, useState } from 'react';
import { X, Share2, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { getAppUrl } from '../lib/appConfig';

interface InviteQRModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

export default function InviteQRModal({ isOpen, onClose, username }: InviteQRModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      generateQRCode();
    }
  }, [isOpen, username]);

  const generateQRCode = async () => {
    setLoading(true);
    setError('');

    try {
      const baseUrl = getAppUrl();
      const url = `${baseUrl}/invite?ref=${encodeURIComponent(username)}`;
      setInviteUrl(url);

      if (canvasRef.current) {
        await QRCode.toCanvas(canvasRef.current, url, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
        });
      }
    } catch (err) {
      console.error('QR code generation error:', err);
      setError('Failed to generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteUrl) {
      navigator.clipboard.writeText(inviteUrl);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="glass-container max-w-md w-full p-6 relative animate-fade-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#00FF85] to-[#00E0FF] rounded-xl flex items-center justify-center shadow-lg shadow-[#00FF85]/30">
              <Share2 className="w-8 h-8 text-black" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 heading-glow">Invite to RatingSkill</h2>
          <p className="text-[#B0B8C8] text-sm">
            Share this QR code to invite new users to join the app
          </p>
        </div>

        <div className="flex flex-col items-center space-y-4">
          {loading && (
            <div className="flex items-center justify-center h-[300px]">
              <Loader2 className="w-8 h-8 text-[#00E0FF] animate-spin" />
            </div>
          )}

          {error && (
            <div className="glass-container bg-red-500/10 border-red-500/50 p-4 w-full">
              <p className="text-red-400 text-sm text-center">{error}</p>
              <button
                onClick={generateQRCode}
                className="mt-2 text-[#00E0FF] hover:text-[#00FF85] text-sm font-semibold transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {!loading && !error && (
            <>
              <div className="bg-white p-4 rounded-xl">
                <canvas ref={canvasRef} />
              </div>

              <div className="w-full space-y-3">
                <div className="glass-container p-3">
                  <p className="text-xs text-[#B0B8C8] mb-1">Invite Link</p>
                  <p className="text-white text-sm break-all font-mono">{inviteUrl}</p>
                </div>

                <button
                  onClick={handleCopyLink}
                  className="btn-secondary w-full py-3"
                >
                  Copy Invite Link
                </button>
              </div>

              <p className="text-xs text-[#6B7280] text-center">
                New users who scan this code will be directed to the signup page
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
