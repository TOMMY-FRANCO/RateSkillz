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
  backPath?: string;
  backState?: Record<string, unknown>;
}

export default function ProfileHeader({
  username,
  userPresenceData,
  lastActive,
  isPreviewMode,
  isOwner,
  onExitPreview,
  backPath,
  backState,
}: ProfileHeaderProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (isPreviewMode) {
      onExitPreview();
    } else if (backPath) {
      navigate(backPath, { state: backState });
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <>
      <nav className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleBack}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/60 text-slate-300 hover:text-cyan-400 hover:bg-slate-700/60 transition-all border border-slate-700/50"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-white tracking-tight">{username}'s Profile</h1>
                <OnlineStatus lastActive={userPresenceData || lastActive} size="medium" />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {isPreviewMode && isOwner && (
        <div className="bg-gradient-to-r from-cyan-600 to-blue-600 border-b border-cyan-500/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center justify-center w-9 h-9 bg-white/20 rounded-xl">
                  <Eye className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-semibold tracking-tight">Preview Mode</p>
                  <p className="text-cyan-100 text-sm">This is how other users see your profile</p>
                </div>
              </div>
              <button
                onClick={onExitPreview}
                className="flex items-center space-x-2 px-4 py-2 bg-white/15 hover:bg-white/25 text-white rounded-xl transition-all border border-white/20"
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
