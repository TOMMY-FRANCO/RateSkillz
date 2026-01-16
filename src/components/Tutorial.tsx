import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Trophy, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface TutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const tutorialSteps = [
  {
    title: "Welcome to RatingSkill®",
    subtitle: "Intro to Skill-Based Gaming Platform",
    content: `Welcome to RatingSkill®—where your real-world football skills become digital. This isn't a fantasy game with fictional players. You're the player. Your friends rate your actual abilities, your stats update based on real votes and you can build a team of real players, battle other managers and earn actual cash through skill-based competition.

RatingSkill® is a community-driven platform where everyone has equal opportunity. No pay-to-win mechanics. No fake players. Just you, your skills, and your grind. The early players who dominate now will become "Legendary" status and earn the most when the economy scales. Ready to start?`
  },
  {
    title: "Upload Your Photo - Create Your Player Card",
    subtitle: "Create Your Player Card",
    content: `Your player card is you in RatingSkill®. Your card goes live immediately. Your friends can find you, rate your skills and see your stats. Your card shows your Overall Score (1-100), position, team, card value and your global rank.

This is your first step to getting recognised. A good photo that looks professional helps—managers want to pick players they can trust. Once your card is created, you can start earning coins and building your reputation.`
  },
  {
    title: "Understand Ratings - PAC, SHO, PAS, DRI, DEF, PHY",
    subtitle: "How Skill Ratings Work",
    content: `Your card displays six core skill attributes, each rated 1-100:

• PAC (Pace): Your speed and agility on the pitch
• SHO (Shooting): Your accuracy and power when taking shots
• PAS (Passing): Your precision and vision in distributing the ball
• DRI (Dribbling): Your ball control and ability to beat defenders
• DEF (Defence): Your positioning and tackling ability
• PHY (Physical): Your strength and stamina

Your friends and other users vote on each attribute based on what they've seen you do in real matches. Your Overall Score is the average of all six stats. The better you play, the higher your ratings climb—but only if people believe they're accurate. Fake stats get no respect in the community.`
  },
  {
    title: "How Friends Rate You - Friends Vote on Your Skills",
    subtitle: "Your Friends Are Your Voters",
    content: `Once you add friends on RatingSkill®, they can visit your profile and vote on your six attributes. Each rating they give is anonymous, so there's no pressure. If your mate thinks you're rapid, he votes your Pace up. If he thinks your passing is weak, he votes it down.

The magic happens when multiple friends rate you—your stats become a crowd-sourced reflection of your actual ability. Your Overall Score stabilises as the average of all votes. The more friends voting, the more accurate your card becomes. This is why building a good friend network early matters.`
  },
  {
    title: "Earn Coins - Multiple Ways to Build Your Balance",
    subtitle: "Start Earning Right Away",
    content: `There are several ways to earn coins without spending a penny:

• Ads: +10 coins per ad per day 00:00AM GMT (decreases as phases progress)
• Share on WhatsApp: +10 coins (send your profile link, get rewarded instantly)
• Add Friends: +10 coins (for every 5 friends you add, once)
• Comment on Profiles: +0.1 coins per comment (leave feedback on friends' cards)

These daily earners add up fast. If you watch ads consistently and add friends regularly, you can earn 30+ coins per day in the Alpha phase. In 10 days of grinding, you'll have 100 coins—enough to build your first team. There's no catch. No pay-to-win. Just consistency.`
  },
  {
    title: "Buy Players - Build a Team of Five",
    subtitle: "Assemble Your Squad",
    content: `Once you have 100 coins, you can start buying player cards. Each card costs 20 coins at first, so 100 coins = 5 players. Strategy matters here—don't just buy random people. Buy friends you know are skilled. Check their stats. Look at their Overall Score and their individual attributes.

Your team's strength depends on your selections. If you pick players with inflated stats that nobody believes, you won't get battle requests. Pick a balanced, credible team and managers with similar-strength squads will want to battle you. Quality over quantity—always.`
  },
  {
    title: "Become a Manager - Unlock Manager Status",
    subtitle: "Level Up Your Role",
    content: `Once you own 5 player cards, you unlock Manager status automatically. You earn +100 coins as a one-time bonus for reaching this milestone. Now you're not just a player—you're a manager running a squad.

As a Manager, you can challenge other managers to battles, analyse matchups and compete for wins. Your team's performance reflects your management skill. The better your players and your tactical choices, the more battles you'll win. Winning battles is what generates real earnings down the road.`
  },
  {
    title: "Manager Battles - Compete, Analyse, Win",
    subtitle: "Battle Strategy & Skill",
    content: `Manager Battles are the competitive heart of RatingSkill®. You challenge another manager whose team has similar overall strength to yours. The battle outcome is based on player stats matchups—your Pace vs their Pace, your Shooting vs their Shooting, etc.

Before you battle, analyse the matchup. Can your team handle their formation? Do your defenders outmatch their forwards? Which battles can you win? Smart managers pick opponents strategically, build winning streaks, and climb the leaderboard. This is where the grind pays off—consistent wins build your reputation and earnings potential.`
  }
];

export default function Tutorial({ isOpen, onClose, onComplete }: TutorialProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showCompletion, setShowCompletion] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);

  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;
  const isLastStep = currentStep === tutorialSteps.length - 1;

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
    if (!user) {
      console.error('No user found');
      return;
    }

    setIsCompleting(true);

    try {
      console.log('Calling complete_tutorial for user:', user.id);

      const { data, error } = await supabase.rpc('complete_tutorial', {
        user_uuid: user.id
      });

      console.log('Tutorial completion response:', { data, error });

      if (error) {
        console.error('RPC error:', error);
        alert(`Tutorial completion failed: ${error.message}`);
        setIsCompleting(false);
        return;
      }

      if (data?.success) {
        console.log('Tutorial completed successfully!', data);
        setCoinsEarned(data.coins_earned || 5);
        setShowCompletion(true);

        setTimeout(() => {
          if (onComplete) {
            onComplete();
          }
          onClose();
        }, 3000);
      } else {
        console.error('Tutorial completion failed:', data?.message);
        alert(`Tutorial completion failed: ${data?.message || 'Unknown error'}`);
        setIsCompleting(false);
      }
    } catch (error) {
      console.error('Error completing tutorial:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsCompleting(false);
    }
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
        <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-8 max-w-md w-full text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIwLjUiIG9wYWNpdHk9IjAuMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20"></div>

          <div className="relative z-10">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-full mb-4 animate-bounce">
              <Trophy className="w-10 h-10 text-white" />
            </div>

            <h2 className="text-3xl font-bold text-white mb-2">
              Congratulations!
            </h2>

            <p className="text-white/90 text-lg mb-4">
              Tutorial Complete!
            </p>

            <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 mb-4">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-6 h-6 text-yellow-300" />
                <span className="text-2xl font-bold text-white">
                  +5 Coins Earned
                </span>
                <Sparkles className="w-6 h-6 text-yellow-300" />
              </div>
            </div>

            <p className="text-white/80 text-sm">
              You now understand the RatingSkill® platform!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 rounded-2xl w-full max-w-3xl relative my-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white/60 text-sm">
                Step {currentStep + 1} of {tutorialSteps.length}
              </span>
              <button
                onClick={handleSkip}
                className="text-white/60 hover:text-white text-sm transition-colors"
              >
                Skip Tutorial
              </button>
            </div>

            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-green-500 h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">
              {tutorialSteps[currentStep].title}
            </h2>
            <h3 className="text-xl text-blue-400 mb-4">
              {tutorialSteps[currentStep].subtitle}
            </h3>
            <div className="text-white/80 leading-relaxed whitespace-pre-line">
              {tutorialSteps[currentStep].content}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <button
              onClick={handleBack}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                currentStep === 0
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>

            <button
              onClick={handleNext}
              disabled={isCompleting}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-gradient-to-r from-blue-500 to-green-500 text-white hover:from-blue-600 hover:to-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCompleting ? (
                'Completing...'
              ) : isLastStep ? (
                <>
                  Complete & Earn 5 Coins
                  <Trophy className="w-5 h-5" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
