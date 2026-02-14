import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, X } from 'lucide-react';
import OnlineStatus from '../OnlineStatus';

interface ProfileHeaderProps {
  username: string;
  userPresenceData?: string;
  lastActive?: string;
  isPreviewMode: boolean;
  isOwner: boolean;
  onExitPreview: () => void;
}

export default function ProfileHeader({
  username,
  userPresenceData,
  lastActive,
  isPreviewMode,
  isOwner,
  onExitPreview,
}: ProfileHeaderProps) {
  const navigate = useNavigate();

  return (
    <>
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => isPreviewMode ? onExitPreview() : navigate('/settings')}
                className="text-gray-300 hover:text-cyan-400 transition-colors bg-none border-none cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-white">{username}'s Profile</h1>
                <OnlineStatus lastActive={userPresenceData || lastActive} size="medium" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {isPreviewMode && isOwner && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 border-b border-blue-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-8 h-8 bg-white/20 rounded-full">
                  <Eye className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold">Preview Mode</p>
                  <p className="text-blue-100 text-sm">This is how other users see your profile</p>
                </div>
              </div>
              <button
                onClick={onExitPreview}
                className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all"
              >
                <X className="w-4 h-4" />
                <span>Exit Preview</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
