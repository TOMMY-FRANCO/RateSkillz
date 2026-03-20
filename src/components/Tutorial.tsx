import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Trophy, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
 
interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}
 
const tutorialSteps = [
  {
    title: "Welcome to RatingSkill®",
    subtitle: "Intro to Skill-Based Gaming Platform",
    content: `Welcome to RatingSkill®—where your real-world football skills become digital. This isn't a fantasy game with fictional players. You're the player. Your friends rate your actual abilities, your stats update based on real votes and you can build a team of real players, battle other managers and compete through skill-based competition.
 
RatingSkill® is a community-driven platform where everyone has equal opportunity. No pay-to-win mechanics. No fake players. Just you, your skills and your grind. The early players who dominate now will become "Legendary" status as the platform grows. Ready to start?
 
Note: All coins are in-app currency only and have no real-world monetary value.`
  },
  {
    title: "Upload Your Photo",
    subtitle: "Create Your Player Card",
    content: `Your player card is you in RatingSkill®. Your card goes live immediately. Your friends can find you, rate your skills and see your stats. Your card shows your Overall Score (1-100), position, team, card value and your global rank.
 
This is your first step to getting recognised. A good photo that looks professional helps—managers want to pick players they can trust. Once your card is created, you can start earning coins and building your reputation.`
  },
  {
    title: "Understand Ratings",
    subtitle: "PAC, SHO, PAS, DRI, DEF, PHY",
    content: `Your card displays six core skill attributes, each rated 1-100:
 
• PAC (Pace): Your speed and agility on the pitch
• SHO (Shooting): Your accuracy and power when taking shots
• PAS (Passing): Your precision and vision in distributing the ball
• DRI (Dribbling): Your ball control and ability to beat defenders
• DEF (Defence): Your positioning and tackling ability
• PHY (Physical): Your strength and stamina
 
Your Overall Score is the average of all six stats. The better you play, the higher your ratings climb.`
  },
  {
    title: "How Friends Rate You",
    subtitle: "Your Friends Are Your Voters",
    content: `Once you add friends on RatingSkill®, they can visit your profile and vote on your six attributes. Each rating they give is anonymous, so there's no pressure.
 
The magic happens when multiple friends rate you—your stats become a crowd-sourced reflection of your actual ability. Your Overall Score stabilises as the average of all votes. The more friends voting, the more accurate your card becomes.`
  },
  {
    title: "Earn Coins",
    subtitle: "Multiple Ways to Build Your Balance",
    content: `There are several ways to earn coins:
 
• Watch Ads: +5 coins per day
• Share on WhatsApp: +10 coins
• Share on Facebook: +10 coins
• Complete Tutorial: +5 coins (one-time)
• Comment on Profiles: +0.1 coins per comment
 
Tiered Friend Bonuses (one-time milestones):
• 5 friends → +10 coins
• 20 friends → +20 coins
• 40 friends → +50 coins
• 150 friends → +100 coins
 
Note: Coins are in-app currency only with no real-world value.`
  },
  {
    title: "Buy Players",
    subtitle: "Build a Team of Five",
    content: `Once you have enough coins, you can start buying player cards. Cards start at 20 coins and increase by 10 coins after every sale or swap.
 
Cards change colour based on overall rating rank:
• Rank 1–50: Purple
• Higher ranks unlock different colours
• The rarest colours are unique to the top players
 
Strategy matters — buy friends you know are skilled, check their stats and look at their Overall Score.`
  },
  {
    title: "Become a Manager",
    subtitle: "Unlock Manager Status",
    content: `Once you own 5 player cards, you unlock Manager status automatically. You earn +100 coins as a one-time bonus for reaching this milestone.
 
As a Manager, you can wager between 50 and 200 coins per battle. When your team wins, all five team members each earn 5 coins — even if their card wasn't directly played in that battle round.`
  },
  {
    title: "Manager Battles",
    subtitle: "Compete, Analyse, Win",
    content: `Manager Battles are the competitive heart of RatingSkill®. You challenge another manager whose team has similar overall strength to yours. The battle outcome is based on player stats matchups.
 
Before you battle, analyse the matchup. Smart managers pick opponents strategically, build winning streaks and climb the leaderboard. Consistent wins build your reputation and your coin balance.`
  },
  {
    title: "The London Arena®",
    subtitle: "Leaderboard & Regional Expansion",
    content: `The London Arena is the first competitive leaderboard on RatingSkill®. Players and managers compete for the top spots in the London region.
 
More arenas are coming soon. Once The London Arena® reaches 50,000 users, new city arenas will launch — Birmingham, Manchester, Liverpool, Leeds and Bristol. Get established in London now while the competition is smaller.`
  },
  {
    title: "Coming Soon",
    subtitle: "Card Skins & Premium Features",
    content: `More features are on the way to personalise your RatingSkill® experience:
 
Coming Soon:
• Card Skins: Customise the look of your player card with exclusive designs
• Lifetime Subscription: 500 coins unlocks lifetime access to premium features
 
Early users who build up their coin balance now will be best placed to unlock premium features the moment they launch.`
  }
];
 
export default function Tutorial({ isOpen, onClose, onComplete }: TutorialProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
 
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;
  const isLastStep = currentStep === tutorialSteps.length - 1;
 
  // Handle Android hardware back button — close tutorial instead of minimising app
  useEffect(() => {
    if (!isOpen) return;
    const handleBackButton = (e: PopStateEvent) => {
      e.preventDefault();
      onClose();
    };
    window.history.pushState({ tutorialOpen: true }, '');
    window.addEventListener('popstate', handleBackButton);
    return () => {
      window.removeEventListener('popstate', handleBackButton);
    };
  }, [isOpen, onClose]);
 
  const handleNext = async () => {
    if (isLastStep) {
      await handleComplete();
    } else {
      setCurrentStep(prev => Math.min(prev + 1, tutorialSteps.length - 1));
    }
  };
 
  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };
 
  const handleComplete = async () => {
    if (!user) return;
    setIsCompleting(true);
    try {
      const { data, error } = await supabase.rpc('complete_tutorial', {
        user_uuid: user.id
      });
      if (error) {
        console.error('RPC error:', error);
        alert(`Tutorial completion failed: ${error.message}`);
        setIsCompleting(false);
        return;
      }
      if (data?.success) {
        setShowCompletion(true);
      } else {
        alert(`Tutorial completion failed: ${data?.message || 'Unknown error'}`);
        setIsCompleting(false);
      }
    } catch (error) {
      console.error('Error completing tutorial:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsCompleting(false);
    }
  };
 
  const handleDismissCompletion = () => {
    if (onComplete) onComplete();
    onClose();
  };
 
  const handleSkip = () => {
    if (confirm('Are you sure you want to skip the tutorial? You can access it again anytime from the menu.')) {
      onClose();
    }
  };
 
  if (!isOpen) return null;
 
  if (showCompletion) {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 max-w-sm w-full text-center relative overflow-hidden">
          <button
            onClick={handleDismissCompletion}
            className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-full mb-3 animate-bounce">
              <Trophy className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-1">Congratulations!</h2>
            <p className="text-white/90 mb-4">Tutorial Complete!</p>
            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3 mb-4">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5 text-yellow-300" />
                <span className="text-xl font-bold text-white">+5 Coins Earned</span>
                <Sparkles className="w-5 h-5 text-yellow-300" />
              </div>
            </div>
            <p className="text-white/80 text-sm mb-4">You now understand the RatingSkill® platform!</p>
            <button
              onClick={handleDismissCompletion}
              className="w-full py-2.5 bg-white/20 hover:bg-white/30 text-white font-bold rounded-xl transition-all"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
 
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col overflow-y-auto" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)', paddingLeft: '12px', paddingRight: '12px', paddingBottom: '16px' }}>
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 rounded-2xl w-full max-w-lg relative mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-white/60 text-xs">
                Step {currentStep + 1} of {tutorialSteps.length}
              </span>
              <button
                onClick={handleSkip}
                className="text-white/50 hover:text-white text-xs transition-colors"
              >
                Skip
              </button>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-3 text-white/60 hover:text-white transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
 
        {/* Content */}
        <div className="p-4">
          <h2 className="text-lg font-bold text-white mb-0.5">
            {tutorialSteps[currentStep].title}
          </h2>
          <h3 className="text-sm text-blue-400 mb-3">
            {tutorialSteps[currentStep].subtitle}
          </h3>
          <div className="text-white/80 text-sm leading-relaxed whitespace-pre-line max-h-64 overflow-y-auto pr-1">
            {tutorialSteps[currentStep].content}
          </div>
        </div>
 
        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-white/10">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
              currentStep === 0
                ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
 
          <button
            onClick={handleNext}
            disabled={isCompleting}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCompleting ? (
              'Completing...'
            ) : isLastStep ? (
              <>
                Complete & Earn 5 Coins
                <Trophy className="w-4 h-4" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}