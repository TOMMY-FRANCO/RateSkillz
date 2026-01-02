import { BookOpen, X } from 'lucide-react';

interface TutorialPromptProps {
  isOpen: boolean;
  onStartTutorial: () => void;
  onDismiss: () => void;
}

export default function TutorialPrompt({ isOpen, onStartTutorial, onDismiss }: TutorialPromptProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 max-w-md w-full relative border border-blue-500/20 shadow-2xl">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-green-500 rounded-full flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">
            Welcome to RatingSkill®!
          </h2>

          <p className="text-white/70 mb-6">
            Take a quick 10-step tutorial to learn how the platform works and earn 5 coins as a reward!
          </p>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={onStartTutorial}
              className="w-full py-3 px-6 rounded-lg bg-gradient-to-r from-blue-500 to-green-500 text-white font-medium hover:from-blue-600 hover:to-green-600 transition-all"
            >
              Start Tutorial (+5 Coins)
            </button>

            <button
              onClick={onDismiss}
              className="w-full py-3 px-6 rounded-lg bg-white/5 text-white/70 font-medium hover:bg-white/10 hover:text-white transition-all"
            >
              Maybe Later
            </button>
          </div>

          <p className="text-white/40 text-xs mt-4">
            You can access the tutorial anytime from your dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
