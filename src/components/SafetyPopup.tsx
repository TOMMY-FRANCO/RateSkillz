import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface SafetyPopupProps {
  onAccept: () => void;
  userId: string;
}

export default function SafetyPopup({ onAccept, userId }: SafetyPopupProps) {
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      // Mark safety popup as shown
      const { error } = await supabase
        .from('profiles')
        .update({ safety_popup_shown: true })
        .eq('id', userId);

      if (error) throw error;
      onAccept();
    } catch (err) {
      console.error('Error marking safety popup as shown:', err);
      // Still allow them to proceed even if update fails
      onAccept();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white rounded-t-2xl">
          <h2 className="text-3xl font-bold text-center">
            🏆 Play it Smart. Play it Safe.
          </h2>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-gray-700 text-lg">
            Welcome to RatingSkill School League! You're here to show you're the best manager,
            but the best managers also play smart and stay safe. Here's what you need to know:
          </p>

          {/* Section 1 */}
          <div className="bg-blue-50 rounded-xl p-5 space-y-3">
            <h3 className="text-xl font-bold text-blue-900">
              1. 🕵️ Your Profile is Private
            </h3>
            <p className="text-gray-800 font-semibold">Only Your Real Friends Can See You</p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li>• Your profile is hidden by default—only people you've added as Friends can see it</li>
              <li>• Use your Manager Nickname 'Username' (stay anonymous on the leaderboards)</li>
            </ul>
            <p className="text-gray-800 font-semibold mt-3">
              You're In Control — Share your Manager 'Username' only with people you actually know at school.
            </p>
          </div>

          {/* Section 2 */}
          <div className="bg-red-50 rounded-xl p-5 space-y-3">
            <h3 className="text-xl font-bold text-red-900">
              2. 🛡️ Fair Play Only
            </h3>
            <p className="text-gray-700">
              RatingSkill is 100% Skill-Based — No cheating, no trash talk, no griefing allowed.
            </p>
            <p className="text-gray-800 font-semibold">If You See Something Wrong:</p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li>• Hit the Red Flag button on any profile</li>
              <li>• Our UK mods (including the creator) will review it ASAP</li>
              <li>• You're protected — we have your back</li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="bg-yellow-50 rounded-xl p-5 space-y-3">
            <h3 className="text-xl font-bold text-yellow-900">
              3. 💸 Coins are for Winning, Not Real Money
            </h3>
            <p className="text-gray-800 font-semibold">How Coins Work:</p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li>• You earn coins by playing and winning matches</li>
              <li>• Coins are only for in-game strategy — they're worth zero real money</li>
              <li>• You can't trade them, sell them or cash them out</li>
            </ul>
            <p className="text-gray-800 font-semibold mt-3">Before Buying Extra Coins:</p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li>• Always ask the person who pays for your phone/device first</li>
              <li>• These aren't real purchases that give you an advantage — you win by being skilled, not by spending money</li>
            </ul>
          </div>

          {/* Section 4 */}
          <div className="bg-green-50 rounded-xl p-5 space-y-3">
            <h3 className="text-xl font-bold text-green-900">
              4. 🏫 Play Hard, Log Off, Live Life
            </h3>
            <p className="text-gray-800 font-semibold">The Best Managers Know Balance:</p>
            <ul className="space-y-2 text-gray-700 ml-4">
              <li>• Win your matches, then step away and do something else</li>
              <li>• Don't be glued to your phone 24/7—take real breaks</li>
              <li>• Go outside, hang with friends, do your homework</li>
              <li>• Your 'Username' is for people you know in real life—keep it that way</li>
            </ul>
          </div>

          {/* Accept Button */}
          <button
            onClick={handleAccept}
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-bold py-4 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-lg shadow-lg"
          >
            {loading ? 'Loading...' : 'I AGREE - LET\'S PLAY'}
          </button>

          <p className="text-center text-sm text-gray-500">
            By clicking "I AGREE", you confirm you understand these safety guidelines
          </p>
        </div>
      </div>
    </div>
  );
}
