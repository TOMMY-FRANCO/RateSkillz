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
    content: `There are several ways to earn coins:

• Watch Ads: +5 coins per day (one 30-second ad, resets at 00:00 GMT — max 5 coins/day from ads)
• Share on WhatsApp: +10 coins (share your profile link, rewarded instantly)
• Share on Facebook: +10 coins (share your profile link, rewarded instantly)
• Complete Tutorial: +5 coins (one-time reward)
• Comment on Profiles: +0.1 coins per comment on a friend's profile

Tiered Friend Bonuses (one-time milestones):
• 5 friends → +10 coins
• 20 friends → +20 coins
• 40 friends → +50 coins
• 150 friends → +100 coins

You can also send coins to friends — capped at 100 coins sent per day total.

Note: Coins are in-app currency only with no real-world value. Only 5 coins can be earned per day through ads.`
  },
  {
    title: "Buy Players - Build a Team of Five",
    subtitle: "Assemble Your Squad",
    content: `Once you have enough coins, you can start buying player cards. Cards start at 20 coins and increase by 10 coins after every sale or swap. The seller receives half of that 10 coin increase, and the original card owner earns 5 coins every time their card is resold — a royalty for being rated highly.

Cards also change colour based on overall rating rank:
• Rank 1–50: Purple
• Higher ranks unlock different colours
• The rarest colours are unique to the top players: ranks 95, 96, 97, 98, 99 and 100 each have their own exclusive card colour

Strategy matters — buy friends you know are skilled, check their stats and look at their Overall Score. Quality selections give you the best chance in battles.`
  },
  {
    title: "Become a Manager - Unlock Manager Status",
    subtitle: "Level Up Your Role",
    content: `Once you own 5 player cards, you unlock Manager status automatically. You earn +100 coins as a one-time bonus for reaching this milestone. Now you're not just a player—you're a manager running a squad.

As a Manager, you can wager between 50 and 200 coins per battle. When your team wins, all five team members each earn 5 coins — even if their card wasn't directly played in that battle round.

Your team's performance reflects your management skill. The better your players and your tactical choices, the more battles you'll win.`
  },
  {
    title: "Manager Battles - Compete, Analyse, Win",
    subtitle: "Battle Strategy & Skill",
    content: `Manager Battles are the competitive heart of RatingSkill®. You challenge another manager whose team has similar overall strength to yours. The battle outcome is based on player stats matchups—your Pace vs their Pace, your Shooting vs their Shooting, etc.

Before you battle, analyse the matchup. Can your team handle their formation? Do your defenders outmatch their forwards? Which battles can you win? Smart managers pick opponents strategically, build winning streaks and climb the leaderboard. Consistent wins build your reputation and your coin balance.`
  },
  {
    title: "The London Arena® - Leaderboard & Regional Expansion",
    subtitle: "Compete Locally, Grow Globally",
    content: `The London Arena is the first competitive leaderboard on RatingSkill®. Players and managers compete for the top spots in the London region — rankings are based on your overall rating, manager wins and card value.

More arenas are coming soon. Once The London Arena® reaches 50,000 users, new city arenas will launch:

• The Birmingham Arena®
• The Manchester Arena®
• The Liverpool Arena®
• The Leeds Arena®
• The Bristol Arena®

Each arena will have its own leaderboard, giving local players a chance to dominate their city before competing nationally. Get established in London now while the competition is smaller.`
  },
  {
    title: "Coming Soon - Card Skins & Premium Features",
    subtitle: "Unlock the Full Experience",
    content: `More features are on the way to personalise your RatingSkill® experience:

Coming Soon:
• Card Skins: Customise the look of your player card with exclusive designs
• Lifetime Subscription: 500 coins unlocks lifetime access to premium features

These features are in development and will be rolling out as the platform grows. Early users who build up their coin balance now will be best placed to unlock premium features the moment they launch.`
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
      console.log('Completing tutorial');

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
        console.log('Tutorial completed successfully');
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
