import { useState } from 'react';
import { X, Save, Instagram, Youtube, Facebook, Twitter } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EditSocialLinksProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentLinks: {
    instagram_url?: string;
    youtube_url?: string;
    facebook_url?: string;
    twitter_url?: string;
    tiktok_url?: string;
  } | null;
  onSave: () => void;
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  );
}

export default function EditSocialLinks({ isOpen, onClose, userId, currentLinks, onSave }: EditSocialLinksProps) {
  const [instagram, setInstagram] = useState(currentLinks?.instagram_url || '');
  const [youtube, setYoutube] = useState(currentLinks?.youtube_url || '');
  const [facebook, setFacebook] = useState(currentLinks?.facebook_url || '');
  const [twitter, setTwitter] = useState(currentLinks?.twitter_url || '');
  const [tiktok, setTiktok] = useState(currentLinks?.tiktok_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const { error: upsertError } = await supabase
        .from('social_links')
        .upsert({
          user_id: userId,
          instagram_url: instagram.trim() || null,
          youtube_url: youtube.trim() || null,
          facebook_url: facebook.trim() || null,
          twitter_url: twitter.trim() || null,
          tiktok_url: tiktok.trim() || null
        }, {
          onConflict: 'user_id'
        });

      if (upsertError) throw upsertError;

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save social links');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Edit Social Links</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-700 rounded-lg"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Instagram className="w-4 h-4 text-pink-500" />
              Instagram
            </label>
            <input
              type="text"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="username or full URL"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            />
            <p className="mt-1 text-xs text-gray-500">Example: @yourname or https://instagram.com/yourname</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Youtube className="w-4 h-4 text-red-500" />
              YouTube
            </label>
            <input
              type="text"
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              placeholder="Channel URL"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            />
            <p className="mt-1 text-xs text-gray-500">Example: https://youtube.com/@yourchannel</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Facebook className="w-4 h-4 text-blue-500" />
              Facebook
            </label>
            <input
              type="text"
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="Profile URL"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            />
            <p className="mt-1 text-xs text-gray-500">Example: https://facebook.com/yourprofile</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Twitter className="w-4 h-4 text-blue-400" />
              X (Twitter)
            </label>
            <input
              type="text"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              placeholder="username or full URL"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            />
            <p className="mt-1 text-xs text-gray-500">Example: @yourname or https://twitter.com/yourname</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <TikTokIcon className="w-4 h-4" />
              TikTok
            </label>
            <input
              type="text"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="username or full URL"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all"
            />
            <p className="mt-1 text-xs text-gray-500">Example: @yourname or https://tiktok.com/@yourname</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-cyan-500 hover:from-green-400 hover:to-cyan-400 text-black font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
