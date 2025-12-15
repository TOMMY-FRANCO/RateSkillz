import { X, Twitter, MessageCircle, Facebook, Instagram, Link2, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  fullName: string;
  overallRating: number;
}

export default function ShareCardModal({ isOpen, onClose, username, fullName, overallRating }: ShareCardModalProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}/card/${username}`;
  const shareText = `Check out ${fullName}'s Football Player Card! Overall Rating: ${overallRating}. Rate me on PlayerCard!`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleShareTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  };

  const handleShareWhatsApp = () => {
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleShareFacebook = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, '_blank', 'width=550,height=420');
  };

  const handleShareInstagram = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Share Your Card</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-3">
          <button
            onClick={handleShareTwitter}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white font-semibold rounded-lg transition-all"
          >
            <Twitter className="w-5 h-5" />
            <span>Share to X (Twitter)</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-lg transition-all"
          >
            <MessageCircle className="w-5 h-5" />
            <span>Share to WhatsApp</span>
          </button>

          <button
            onClick={handleShareFacebook}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all"
          >
            <Facebook className="w-5 h-5" />
            <span>Share to Facebook</span>
          </button>

          <button
            onClick={handleShareInstagram}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:from-pink-600 hover:via-red-600 hover:to-yellow-600 text-white font-semibold rounded-lg transition-all"
          >
            <Instagram className="w-5 h-5" />
            <span>Copy Link for Instagram</span>
          </button>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-lg opacity-20"></div>
            <button
              onClick={handleCopyLink}
              className="relative w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-semibold rounded-lg transition-all border border-cyan-500/30"
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5 text-green-400" />
                  <span className="text-green-400">Link Copied!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-5 h-5" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {copied && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-400 text-center font-medium">
              Link copied! Paste it in your Instagram bio or story
            </p>
          </div>
        )}

        <div className="mt-6 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <p className="text-xs text-gray-400 text-center break-all">{shareUrl}</p>
        </div>
      </div>
    </div>
  );
}
