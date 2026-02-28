import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
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
          <h1 className="text-3xl font-black text-white">Terms of Service</h1>
        </div>

        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-8 space-y-6 text-gray-100">
          <div className="text-center pb-6 border-b border-white/10">
            <h2 className="text-2xl font-bold text-white mb-2">RATING SKILL</h2>
            <h3 className="text-xl font-semibold text-white mb-3">TERMS OF SERVICE</h3>
            <p className="text-sm text-gray-300">Effective Date: January 15, 2026</p>
            <p className="text-xs text-gray-400 mt-1">Last Updated: February 2026</p>
          </div>

          <section>
            <p className="leading-relaxed">
              Welcome to RatingSkill&reg; ("we," "our," or "us"). By accessing or using RatingSkill.com (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h3>
            <p className="leading-relaxed">
              By creating an account, uploading content, or using any features of Rating Skill, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">2. Description of Service</h3>
            <p className="leading-relaxed">
              Rating Skill is a social football platform where users can create digital football-style player cards, rate skills, trade cards, battle in manager mode and interact with friends. The Service includes card creation, skill ratings, comments, likes, profile views, coin earning and spending, leaderboards, battle mode and an in-platform virtual coin system.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">3. Eligibility and Age Requirements</h3>
            <p className="leading-relaxed mb-2">
              You must be at least 11 years old to use Rating Skill. By using the App you confirm that you are at least 11 years old.
            </p>
            <p className="leading-relaxed mb-2">
              Users aged 11 to 17 are considered minors. If you are a minor your parent or guardian should review and agree to these Terms on your behalf.
            </p>
            <p className="leading-relaxed">
              We reserve the right to suspend or terminate any account we believe belongs to a user under the age of 11.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">4. Account Registration</h3>
            <p className="leading-relaxed mb-3">
              To access full features of Rating Skill you must create an account. You can register using Google, Facebook, Discord or email. When creating an account you agree to:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Provide accurate and truthful information</li>
              <li>Keep your login credentials secure and confidential</li>
              <li>Not share your account with anyone else</li>
              <li>Not create more than one account per person</li>
              <li>Notify us immediately if you suspect unauthorised access to your account</li>
            </ul>
            <p className="leading-relaxed mt-3">
              You are responsible for all activity that occurs under your account.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">5. Username Rules</h3>
            <p className="leading-relaxed mb-3">Your username must not:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Contain offensive, hateful or discriminatory language</li>
              <li>Impersonate another person or brand</li>
              <li>Contain personal information such as your full name or address</li>
              <li>Violate any third party rights</li>
            </ul>
            <p className="leading-relaxed mt-3">
              We reserve the right to change or remove any username that violates these rules. Usernames can be changed once every 14 days.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">6. Community Guidelines and Acceptable Use</h3>
            <p className="leading-relaxed mb-3">
              Rating Skill is a community built on friendly competition and respect. By using the App you agree not to:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Harass, bully, threaten or abuse other users</li>
              <li>Use offensive, racist, sexist or discriminatory language</li>
              <li>Post or share inappropriate, explicit or harmful content</li>
              <li>Spam other users with messages or coin requests</li>
              <li>Attempt to manipulate ratings dishonestly</li>
              <li>Create fake accounts or impersonate other users</li>
              <li>Use the App for any illegal purpose</li>
              <li>Attempt to hack, exploit or disrupt the App or its servers</li>
              <li>Scrape, copy or reproduce any part of the App without permission</li>
              <li>Use bots, scripts or automated tools to gain unfair advantages</li>
              <li>Sell, trade or attempt to exchange coins or cards for real money outside the platform</li>
            </ul>
            <p className="leading-relaxed mt-3">
              Our profanity detection system monitors content within the App. Violations of these guidelines may result in warnings, shadow banning or permanent account termination.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">7. Rating System</h3>
            <p className="leading-relaxed mb-3">
              Skill ratings on Rating Skill are submitted anonymously by friends. By using the rating system you agree to:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Rate other users honestly and fairly</li>
              <li>Not manipulate ratings through fake accounts or coordinated abuse</li>
              <li>Accept that ratings reflect the opinions of your friends and not those of Rating Skill</li>
            </ul>
            <p className="leading-relaxed mt-3">
              We are not responsible for ratings submitted by users. If you believe you have been rated maliciously or unfairly you can report the issue through the App.
            </p>
          </section>

          <section className="bg-red-500/10 border-2 border-red-500/50 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-3">8. Virtual Coins -- No Real World Value</h3>
            <p className="leading-relaxed mb-3">
              Rating Skill uses a virtual currency called Coins. Coins can be:
            </p>
            <ul className="space-y-2 list-disc list-inside mb-4">
              <li>Earned through watching short video advertisements</li>
              <li>Earned through completing tutorials</li>
              <li>Earned through sharing the App</li>
              <li>Earned through adding friends</li>
              <li>Purchased through in-app purchases</li>
              <li>Won or lost through battle mode wagering</li>
            </ul>
            <p className="font-bold text-lg text-red-300 mb-3">
              IMPORTANT -- Please read carefully:
            </p>
            <p className="leading-relaxed mb-3">
              Coins are virtual tokens used solely within the Rating Skill platform for entertainment purposes. They have NO real world cash value and CANNOT be withdrawn, redeemed or exchanged for real money under any circumstances.
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Coins cannot be transferred outside the platform, sold for cash or converted to any form of real world currency</li>
              <li>Coins can be sent between friends within the app only, capped at 100 coins per day</li>
              <li>We reserve the right to adjust, modify or remove coins from any account found to be exploiting the system fraudulently</li>
              <li className="font-bold text-red-300">All coin purchases are final and non-refundable except where required by law</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">9. Battle Mode and Wagering</h3>
            <p className="leading-relaxed mb-3">
              Battle mode allows Managers to wager between 50 and 200 coins per match. By participating in battle mode you agree that:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Coin wagering is for entertainment purposes only</li>
              <li>Coins have no real world monetary value</li>
              <li>Wagers are final once a battle has begun</li>
              <li>The outcome of battles is determined by player stats and strategic decisions</li>
              <li>We are not responsible for coins lost through battle mode</li>
            </ul>
            <p className="leading-relaxed mt-3">
              Battle mode is a skill based feature and is not considered gambling as no real money or items of real world value are at stake.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">10. Player Cards</h3>
            <p className="leading-relaxed mb-3">
              Every user on Rating Skill has a player card. By using the card system you agree that:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Cards start at 20 coins and increase in value with every trade by 10 coins</li>
              <li>When your card is sold you receive 5 coins per transaction</li>
              <li>When a user buys 5 cards they become a Manager</li>
              <li>Cards can be bought back by the original user at the current card price plus 100 coins</li>
              <li>Card values are determined by the App and cannot be manually set by users</li>
              <li>All card transactions are final once completed</li>
              <li>We are not responsible for disputes between users regarding card trades</li>
              <li>We reserve the right to adjust the card system at any time</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">11. User Content</h3>
            <p className="leading-relaxed mb-3">
              You retain ownership of content you upload including photos, comments and ratings. By uploading content you:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Grant Rating Skill a worldwide, non-exclusive, royalty-free licence to use, display and distribute your content on the platform</li>
              <li>Confirm you have the right to upload any content you post</li>
              <li>Accept full responsibility for content you submit</li>
              <li>Agree not to upload content that is illegal, offensive, harassing, defamatory or infringes on others' rights</li>
              <li>Understand that content may be reviewed by our moderation team</li>
            </ul>
            <p className="leading-relaxed mt-3">
              We reserve the right to remove any content that violates these Terms without notice.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">12. In-App Purchases and Refunds</h3>
            <p className="leading-relaxed mb-3">
              Rating Skill offers optional in-app purchases including coin packages starting from &pound;1.00, custom card skins, lifetime subscription and premium unlocks.
            </p>
            <p className="leading-relaxed mb-3">
              All purchases are processed through Google Play. By making a purchase you agree to Google Play's payment terms. We do not store your payment details.
            </p>
            <p className="leading-relaxed">
              All purchases are final and non-refundable except where required by applicable law. By purchasing coins you acknowledge they have no cash value and cannot be refunded or withdrawn. If you have an issue with a purchase please contact us at the email address below.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">13. Advertising</h3>
            <p className="leading-relaxed mb-3">
              Rating Skill displays short video advertisements of approximately 30 seconds. By using the App you agree that:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Advertisements may be shown when earning daily coins</li>
              <li>Ad content is provided by third party advertising partners</li>
              <li>We are not responsible for the content of third party advertisements</li>
              <li>You must be of appropriate age to view advertised content</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">14. Reporting and Moderation</h3>
            <p className="leading-relaxed mb-2">
              Rating Skill has a report button on all user profiles. Reports are reviewed by our admin team. Reported users may be shadow banned pending investigation.
            </p>
            <p className="leading-relaxed">
              We take all reports seriously especially those involving the safety of younger users. We reserve the right to ban any user permanently without notice for serious violations.
            </p>
          </section>

          <section className="bg-blue-500/10 border-2 border-blue-500/50 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-3">15. Social Login and OAuth Privacy Compliance</h3>
            <p className="leading-relaxed mb-4">
              When you sign in using Google, Discord or Facebook ("Social Providers"), we collect and process certain personal data in compliance with UK GDPR and the Data Protection Act 2018.
            </p>

            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-white mb-2">Data We Collect:</h4>
                <p className="leading-relaxed">
                  We receive your email address, username/display name and profile picture from your chosen Social Provider. You control what information each provider shares with us through your provider's privacy settings.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2">Legal Basis:</h4>
                <p className="leading-relaxed">
                  We process this data based on your explicit consent (GDPR Article 6(1)(a)) when you authorise the connection. You can withdraw consent at any time by disconnecting the social account in your Settings.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2">Data Storage:</h4>
                <p className="leading-relaxed">
                  Your social account information is securely stored in our database and linked to your Rating Skill profile. We do not share this data with third parties except as necessary to provide our service.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2">Your Rights:</h4>
                <p className="leading-relaxed">
                  Under UK GDPR you have the right to access, correct, delete or port your data. You can request deletion of your social account link or entire profile by contacting us.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2">Third Party Policies:</h4>
                <p className="leading-relaxed">
                  The Social Providers' collection and use of your data is governed by their own privacy policies. We recommend reviewing the{' '}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                    Google Privacy Policy
                  </a>
                  ,{' '}
                  <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                    Discord Privacy Policy
                  </a>
                  {' '}and{' '}
                  <a href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                    Facebook Data Policy
                  </a>
                  .
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2">Data Retention:</h4>
                <p className="leading-relaxed">
                  We retain your social login data for as long as your account is active. Upon account deletion, associated OAuth data is removed within 30 days.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">16. Intellectual Property</h3>
            <p className="leading-relaxed mb-2">
              All content within Rating Skill including but not limited to the app design, logo, graphics, card system, arena system, coin system and all associated branding is the intellectual property of Rating Skill and is protected by copyright law.
            </p>
            <p className="leading-relaxed mb-2">
              You may not copy, reproduce, distribute or create derivative works from any part of the App without our express written permission.
            </p>
            <p className="leading-relaxed">
              You may download your own player card as a PNG for personal sharing purposes only.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">17. Account Suspension and Termination</h3>
            <p className="leading-relaxed mb-2">
              We reserve the right to suspend or permanently terminate any account at our discretion for violations of these Terms, fraudulent or abusive behaviour, creating multiple accounts, attempting to exploit or hack the App, or any behaviour we deem harmful to the community.
            </p>
            <p className="leading-relaxed mb-2">
              Upon termination your account, coins, cards and all associated data will be removed. You may delete your account at any time through account settings.
            </p>
            <p className="leading-relaxed">
              We are not obligated to provide a refund for any purchased coins upon termination due to Terms violations.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">18. Disclaimers</h3>
            <p className="leading-relaxed">
              Rating Skill is provided on an "as is" and "as available" basis without warranties of any kind. We do not guarantee the Service will be uninterrupted, secure or error-free. We are not responsible for user-generated content or interactions between users. Virtual coins have no real world value and we make no representations about their utility beyond entertainment on our platform.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">19. Limitation of Liability</h3>
            <p className="leading-relaxed">
              To the maximum extent permitted by law, Rating Skill shall not be liable for any indirect, incidental, special, consequential or punitive damages arising from your use of the Service. Our total liability for any claims related to the Service shall not exceed the amount you paid us in the past 12 months, if any.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">20. Changes to These Terms</h3>
            <p className="leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of material changes via email or platform notification. Continued use of the Service after changes constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">21. Governing Law</h3>
            <p className="leading-relaxed">
              These Terms are governed by and construed in accordance with the laws of England and Wales. Any disputes arising from these Terms shall be subject to the jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">22. Dispute Resolution</h3>
            <p className="leading-relaxed">
              Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration rather than in court, except where prohibited by law.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">23. Severability</h3>
            <p className="leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary and the remaining provisions shall remain in full force and effect.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">24. Entire Agreement</h3>
            <p className="leading-relaxed">
              These Terms constitute the entire agreement between you and Rating Skill regarding the Service and supersede all prior agreements.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">25. Contact Us</h3>
            <p className="leading-relaxed mb-3">
              If you have questions about these Terms please contact us at:
            </p>
            <ul className="space-y-1">
              <li>
                <strong>Email:</strong>{' '}
                <a href="mailto:Dev.ratingskill@gmail.com" className="text-blue-400 hover:text-blue-300 underline">
                  Dev.ratingskill@gmail.com
                </a>
              </li>
              <li><strong>Website:</strong> www.ratingskill.com</li>
            </ul>
          </section>

          <section className="border-t border-white/10 pt-6">
            <p className="leading-relaxed font-medium text-center">
              By using Rating Skill you acknowledge that you have read, understood and agree to be bound by these Terms of Service.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
