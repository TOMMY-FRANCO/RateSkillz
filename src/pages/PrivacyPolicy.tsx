import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-3xl font-black text-white">Privacy Policy</h1>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8 space-y-6 text-gray-100">
          <div className="text-center pb-6 border-b border-white/10">
            <h2 className="text-2xl font-bold text-white mb-2">RATING SKILL</h2>
            <h3 className="text-xl font-semibold text-white mb-3">PRIVACY POLICY</h3>
            <p className="text-sm text-gray-300">Last Updated: February 2026</p>
          </div>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">1. Introduction</h3>
            <p className="leading-relaxed mb-2">
              Welcome to Rating Skill ("we", "our", "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, store and safeguard your information when you use our mobile application and website at RatingSkill.com.
            </p>
            <p className="leading-relaxed">
              Please read this policy carefully. If you disagree with its terms please discontinue use of the App.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">2. Information We Collect</h3>
            <p className="leading-relaxed mb-3">We collect the following types of information:</p>

            <h4 className="text-lg font-semibold text-white mb-2">Account Information</h4>
            <ul className="list-disc list-inside space-y-1 mb-4 text-gray-200">
              <li>Name or username</li>
              <li>Email address</li>
              <li>Profile picture (optional)</li>
              <li>School, college or university (optional)</li>
              <li>Social media links (optional)</li>
              <li>Gender (optional)</li>
            </ul>

            <h4 className="text-lg font-semibold text-white mb-2">App Activity</h4>
            <ul className="list-disc list-inside space-y-1 mb-4 text-gray-200">
              <li>Player skill ratings given and received</li>
              <li>Coins earned and spent</li>
              <li>Cards bought, sold and swapped</li>
              <li>Battle results and leaderboard positions</li>
              <li>Friends added and messages sent</li>
              <li>Profile views</li>
            </ul>

            <h4 className="text-lg font-semibold text-white mb-2">Technical Information</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-200">
              <li>Device type and operating system</li>
              <li>App version</li>
              <li>Login method (Google, Facebook, Email or Discord)</li>
              <li>Last online status</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">3. How We Use Your Information</h3>
            <p className="leading-relaxed mb-3">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-200">
              <li>Create and manage your account</li>
              <li>Display your player card and profile to friends</li>
              <li>Calculate and display skill ratings and leaderboard rankings</li>
              <li>Enable card trading, battle mode and coin transactions</li>
              <li>Send in-app notifications for messages, battles and activity</li>
              <li>Improve app performance and fix bugs</li>
              <li>Ensure the safety and security of all users</li>
              <li>Enforce our community guidelines and Terms of Service</li>
              <li>Provide fair and accurate ranking on leaderboards</li>
              <li>Keep the coin ledger honest and transparent</li>
              <li>Send safety alerts if someone reports a problem</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">4. What We Do Not Do</h3>
            <p className="leading-relaxed mb-3">We absolutely do not:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-200">
              <li>Track your location with GPS</li>
              <li>Follow you across other apps or websites</li>
              <li>Sell your data to advertisers or companies</li>
              <li>Share your information unless UK law requires it for safety purposes</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">5. Photos and Files</h3>
            <p className="leading-relaxed mb-2">
              If you choose to upload a profile picture, that photo is stored securely on our servers and displayed on your profile within the App. Profile pictures are entirely optional.
            </p>
            <p className="leading-relaxed">
              Users can download their player card as a PNG file to their device. This requires access to device storage which is used solely for saving the card image. No photo or file data is shared with third parties.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">6. Coins and Payments</h3>
            <p className="leading-relaxed">
              Rating Skill offers optional in-app purchases of coins. Payment transactions are processed securely through Google Play. We do not store your payment card details. Transaction history is stored within the App for your reference.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">7. Advertising</h3>
            <p className="leading-relaxed">
              Rating Skill displays short video advertisements of approximately 30 seconds which allow users to earn coins. These ads are served through third party advertising partners. These partners may collect certain non-personal technical data to serve relevant ads. We do not sell your personal data to advertisers.
            </p>
          </section>

          <section className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-3">8. Protection of Younger Users</h3>
            <p className="leading-relaxed mb-3">
              We take the safety of younger users extremely seriously. Rating Skill is designed to be Safe by Design.
            </p>

            <h4 className="text-lg font-semibold text-white mb-2">For users aged 11 to 17:</h4>
            <ul className="list-disc list-inside space-y-1 mb-4 text-gray-200">
              <li>Profiles are set to hidden by default</li>
              <li>Only usernames are displayed, not real names</li>
              <li>An educational safety window is shown at sign up encouraging users not to add strangers they do not know</li>
              <li>Direct messages only come from people they have invited as friends</li>
              <li>No random messages from strangers are permitted</li>
            </ul>

            <h4 className="text-lg font-semibold text-white mb-2">What we ask for from younger users (only what we need):</h4>
            <ul className="list-disc list-inside space-y-1 mb-4 text-gray-200">
              <li>Email address to keep their account secure</li>
              <li>A nickname so they stay anonymous</li>
              <li>School name only if they choose the School Leaderboard</li>
              <li>Game stats including wins, losses and skill ratings</li>
            </ul>

            <p className="leading-relaxed mb-4">
              We do not knowingly collect personal information from children under 11. If you believe a child under 11 has provided us with personal information please contact us immediately at{' '}
              <a href="mailto:Dev.ratingskill@gmail.com" className="text-blue-400 hover:text-blue-300 underline">
                Dev.ratingskill@gmail.com
              </a>.
            </p>

            <h4 className="text-lg font-semibold text-white mb-2">Parent and Guardian Information:</h4>
            <p className="leading-relaxed mb-2">
              Every player under 18 starts with maximum privacy settings automatically turned on. Your child's full profile is only visible to people they have personally chosen as friends. No one from other schools can contact them unless they share their nickname and add each other as friends.
            </p>
            <p className="leading-relaxed mb-2">
              Unlike many games there are no random rewards, loot boxes or lucky wins. Success comes from smart thinking and great strategy. Coins stay within the game and cannot be traded for real money or cashed out. Spending extra money does not make a player a better manager — only skill and strategy win games.
            </p>
            <p className="leading-relaxed mb-4">
              We recommend setting device-level spending limits if your child uses the App. If something feels wrong, use the Report button — we review every single report carefully and quickly. As the creator, I personally check all high-priority safety reports.
            </p>

            <h4 className="text-lg font-semibold text-white mb-2">Your child's complete privacy rights:</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-200">
              <li>They can delete their account at any time — one tap in Settings completely removes their account and all data permanently</li>
              <li>We do not know where they go, what apps they use or anything outside Rating Skill</li>
              <li>We do not make money from their information</li>
            </ul>
          </section>

          <section className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-3">9. Social Login and OAuth Data</h3>
            <p className="leading-relaxed mb-2">
              When you sign in using Google, Discord or Facebook ("Social Providers"), we collect and process certain personal data in compliance with UK GDPR and the Data Protection Act 2018.
            </p>
            <p className="leading-relaxed mb-2">
              We receive your email address, username/display name and profile picture from your chosen Social Provider. You control what information each provider shares with us through your provider's privacy settings.
            </p>
            <p className="leading-relaxed mb-2">
              We process this data based on your explicit consent (GDPR Article 6(1)(a)) when you authorise the connection. You can withdraw consent at any time by disconnecting the social account in your Settings.
            </p>
            <p className="leading-relaxed mb-2">
              Your social account information is securely stored in our database and linked to your Rating Skill profile. We do not share this data with third parties except as necessary to provide our service.
            </p>
            <p className="leading-relaxed">
              We retain your social login data for as long as your account is active. Upon account deletion, associated OAuth data is removed within 30 days.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">10. Data Sharing</h3>
            <p className="leading-relaxed mb-3">We do not sell your personal data to third parties. We may share data only with:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-200">
              <li>Service providers who help us operate the App such as hosting and analytics</li>
              <li>Law enforcement if required by law</li>
              <li>Third party login providers (Google, Facebook, Discord) when you choose to sign in through them</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">11. Data Security</h3>
            <p className="leading-relaxed">
              We take reasonable technical and organisational measures to protect your personal information against unauthorised access, loss or misuse. The App is optimised for speed and security.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">12. Data Retention and Deletion</h3>
            <p className="leading-relaxed">
              We retain your data for as long as your account is active. You can request deletion of your account and all associated data at any time by contacting us at the email address below or through account settings. Upon deletion your profile, ratings, cards and coins will be permanently removed.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">13. Your Rights Under UK GDPR</h3>
            <p className="leading-relaxed mb-3">Under UK GDPR you have the right to:</p>
            <ul className="list-disc list-inside space-y-1 mb-4 text-gray-200">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to how we use your data</li>
              <li>Request a copy of your data in a portable format</li>
              <li>Withdraw consent for social login at any time</li>
            </ul>
            <p className="leading-relaxed">
              To exercise any of these rights please contact us at the email address below.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">14. Third Party Services</h3>
            <p className="leading-relaxed mb-3">Rating Skill uses the following third party services which have their own privacy policies:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-200">
              <li>Google Play and Google Sign In</li>
              <li>Facebook Login</li>
              <li>Discord Login</li>
              <li>Firebase (app infrastructure)</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">15. Changes to This Policy</h3>
            <p className="leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify users of any significant changes through the App. The date at the top of this policy will always reflect the most recent update.
            </p>
          </section>

          <section className="border-t border-white/10 pt-6">
            <h3 className="text-xl font-bold text-white mb-3">16. Contact Us</h3>
            <p className="leading-relaxed mb-2">
              If you have any questions about this Privacy Policy or how we handle your data please contact us at:
            </p>
            <p className="leading-relaxed">
              Email:{' '}
              <a href="mailto:Dev.ratingskill@gmail.com" className="text-cyan-400 hover:text-cyan-300 underline">
                Dev.ratingskill@gmail.com
              </a>
            </p>
            <p className="leading-relaxed">
              Website: RatingSkill.com
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
