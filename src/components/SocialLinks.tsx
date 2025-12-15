import { Instagram, Youtube, Facebook, Twitter } from 'lucide-react';
import { Edit } from 'lucide-react';

interface SocialLink {
  platform: string;
  url: string;
  icon: React.ReactNode;
  color: string;
}

interface SocialLinksProps {
  socialLinks: {
    instagram_url?: string;
    youtube_url?: string;
    facebook_url?: string;
    twitter_url?: string;
    tiktok_url?: string;
  } | null;
  isOwner: boolean;
  onEdit?: () => void;
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
    </svg>
  );
}

export default function SocialLinks({ socialLinks, isOwner, onEdit }: SocialLinksProps) {
  if (!socialLinks && !isOwner) return null;

  const links: SocialLink[] = [];

  if (socialLinks?.instagram_url) {
    links.push({
      platform: 'Instagram',
      url: socialLinks.instagram_url.startsWith('http')
        ? socialLinks.instagram_url
        : `https://instagram.com/${socialLinks.instagram_url.replace('@', '')}`,
      icon: <Instagram className="w-full h-full" />,
      color: 'from-purple-500 via-pink-500 to-red-500',
    });
  }

  if (socialLinks?.youtube_url) {
    links.push({
      platform: 'YouTube',
      url: socialLinks.youtube_url,
      icon: <Youtube className="w-full h-full" />,
      color: 'from-red-600 to-red-700',
    });
  }

  if (socialLinks?.facebook_url) {
    links.push({
      platform: 'Facebook',
      url: socialLinks.facebook_url,
      icon: <Facebook className="w-full h-full" />,
      color: 'from-blue-600 to-blue-700',
    });
  }

  if (socialLinks?.twitter_url) {
    links.push({
      platform: 'Twitter',
      url: socialLinks.twitter_url.startsWith('http')
        ? socialLinks.twitter_url
        : `https://twitter.com/${socialLinks.twitter_url.replace('@', '')}`,
      icon: <Twitter className="w-full h-full" />,
      color: 'from-blue-400 to-blue-500',
    });
  }

  if (socialLinks?.tiktok_url) {
    links.push({
      platform: 'TikTok',
      url: socialLinks.tiktok_url.startsWith('http')
        ? socialLinks.tiktok_url
        : `https://tiktok.com/@${socialLinks.tiktok_url.replace('@', '')}`,
      icon: <TikTokIcon className="w-full h-full" />,
      color: 'from-gray-900 to-pink-600',
    });
  }

  if (links.length === 0 && !isOwner) return null;

  return (
    <div className="max-w-2xl mx-auto mb-8">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">Social Links</h3>
          {isOwner && (
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-semibold rounded-lg transition-all text-sm"
            >
              <Edit className="w-4 h-4" />
              <span>Edit Links</span>
            </button>
          )}
        </div>

        {links.length > 0 ? (
          <div className="flex items-center justify-center gap-4 flex-wrap">
            {links.map((link) => (
              <a
                key={link.platform}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative"
              >
                <div className={`w-12 h-12 bg-gradient-to-br ${link.color} rounded-full flex items-center justify-center text-white hover:scale-110 transition-transform shadow-lg hover:shadow-xl`}>
                  {link.icon}
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-gray-400 whitespace-nowrap">{link.platform}</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-400 text-sm">No social links added yet</p>
            {isOwner && (
              <button
                onClick={onEdit}
                className="mt-3 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-semibold rounded-lg transition-all text-sm"
              >
                Add Social Links
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
