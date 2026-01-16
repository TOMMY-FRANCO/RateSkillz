import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TermsOfService() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
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
            <h2 className="text-2xl font-bold text-white mb-2">TERMS OF SERVICE FOR RATINGSKILL</h2>
            <p className="text-sm text-gray-300">Effective Date: January 15, 2026</p>
            <p className="text-xs text-gray-400 mt-1">Last Updated: January 15, 2026 - Added Social Login & OAuth Privacy Compliance</p>
          </div>

          <section>
            <p className="leading-relaxed">
              Welcome to RatingSkill® ("we," "our," or "us"). By accessing or using RatingSkill.com (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h3>
            <p className="leading-relaxed">
              By creating an account, uploading content, or using any features of RatingSkill, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">2. Description of Service</h3>
            <p className="leading-relaxed">
              RatingSkill is a social platform where users can create digital football-style player cards, rate skills, trade cards, and interact with friends. The Service includes features such as card creation, skill ratings, comments, likes, profile views, and an in-platform virtual coin system.
            </p>
          </section>

          <section className="bg-red-500/10 border-2 border-red-500/50 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-3">3. Virtual Coins - No Real-World Value</h3>
            <p className="font-bold text-lg text-red-300 mb-3">
              IMPORTANT: Coins used on RatingSkill have NO real-world cash value and CANNOT be withdrawn, redeemed, or exchanged for real money under any circumstances.
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Coins are virtual tokens used solely within the RatingSkill platform for entertainment purposes.</li>
              <li>Coins can be earned through platform activities (watching advertisements, receiving comments, card trading) or purchased through our coin shop.</li>
              <li>Any coins purchased are final and non-refundable.</li>
              <li>Coins cannot be transferred outside the platform, sold for cash, or converted to any form of real-world currency.</li>
              <li>We reserve the right to adjust, modify, or remove coins from user accounts for violations of these Terms or for maintenance purposes.</li>
              <li className="font-bold text-red-300">Coins have no monetary value and are provided for entertainment and engagement within the platform only.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">4. User Accounts</h3>
            <ul className="space-y-2 list-disc list-inside">
              <li>You must be at least 13 years old to use RatingSkill.</li>
              <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
              <li>You agree to provide accurate and complete information during registration.</li>
              <li>You are responsible for all activities that occur under your account.</li>
              <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">5. User Content</h3>
            <ul className="space-y-2 list-disc list-inside">
              <li>You retain ownership of content you upload (photos, comments, ratings).</li>
              <li>By uploading content, you grant RatingSkill a worldwide, non-exclusive, royalty-free license to use, display, and distribute your content on the platform.</li>
              <li>You are responsible for ensuring you have the right to upload any content you post.</li>
              <li>You agree not to upload content that is illegal, offensive, harassing, defamatory, or infringes on others' rights.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">6. Card Trading and Transactions</h3>
            <ul className="space-y-2 list-disc list-inside">
              <li>Card trading is conducted using virtual coins within the platform.</li>
              <li>All card transactions are final once completed.</li>
              <li>Card values increase automatically by 10 coins after each sale according to our platform rules.</li>
              <li>Original card owners receive ongoing royalties from resales as part of the platform mechanics.</li>
              <li>We are not responsible for disputes between users regarding card trades.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">7. Prohibited Conduct</h3>
            <p className="mb-2">You agree not to:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Use the Service for any illegal purposes.</li>
              <li>Harass, abuse, or harm other users.</li>
              <li>Attempt to manipulate coin earnings, card values, or ratings through fraudulent means.</li>
              <li>Use bots, scripts, or automated tools to gain unfair advantages.</li>
              <li>Sell, trade, or attempt to exchange coins or cards for real money outside the platform.</li>
              <li>Impersonate others or create fake accounts.</li>
              <li>Upload malicious code or attempt to hack the Service.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">8. Intellectual Property</h3>
            <p className="leading-relaxed">
              RatingSkill and its original content, features, and functionality are owned by RatingSkill and are protected by international copyright, trademark, and other intellectual property laws. The RatingSkill name, logo, and all related names and logos are trademarks of RatingSkill.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">9. Termination</h3>
            <ul className="space-y-2 list-disc list-inside">
              <li>We reserve the right to suspend or terminate your account at any time for violations of these Terms.</li>
              <li>Upon termination, you lose access to your account, including all coins, cards, and content.</li>
              <li>You may delete your account at any time through account settings.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">10. Disclaimers</h3>
            <ul className="space-y-2 list-disc list-inside">
              <li>RatingSkill is provided "as is" without warranties of any kind.</li>
              <li>We do not guarantee the Service will be uninterrupted, secure, or error-free.</li>
              <li>We are not responsible for user-generated content or interactions between users.</li>
              <li>Virtual coins have no real-world value and we make no representations about their utility beyond entertainment on our platform.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">11. Limitation of Liability</h3>
            <p className="leading-relaxed">
              To the maximum extent permitted by law, RatingSkill shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service. Our total liability for any claims related to the Service shall not exceed the amount you paid us in the past 12 months, if any.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">12. Purchases and Refunds</h3>
            <ul className="space-y-2 list-disc list-inside">
              <li>Coin purchases through our coin shop are processed through secure third-party payment processors.</li>
              <li>All purchases are final and non-refundable.</li>
              <li>By purchasing coins, you acknowledge they have no cash value and cannot be refunded or withdrawn.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">13. Privacy</h3>
            <p className="leading-relaxed">
              Your use of the Service is also governed by our Privacy Policy, which explains how we collect, use, and protect your personal information.
            </p>
          </section>

          <section className="bg-blue-500/10 border-2 border-blue-500/50 rounded-xl p-6">
            <h3 className="text-xl font-bold text-white mb-3">14. Social Login & OAuth Privacy Compliance</h3>
            <p className="leading-relaxed mb-4">
              When you sign in using Google, Discord, or Facebook ("Social Providers"), we collect and process certain personal data in compliance with UK GDPR and Data Protection Act 2018.
            </p>

            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-white mb-2">Data We Collect:</h4>
                <p className="leading-relaxed">
                  We receive your email address, username/display name, and profile picture from your chosen Social Provider. You control what information each provider shares with us through your provider's privacy settings.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2">Legal Basis:</h4>
                <p className="leading-relaxed">
                  We process this data based on your explicit consent (GDPR Article 6(1)(a)) when you authorize the connection. You can withdraw consent anytime by disconnecting the social account in your Settings.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2">Data Storage:</h4>
                <p className="leading-relaxed">
                  Your social account information is securely stored in our database and linked to your RatingSkill profile. We do not share this data with third parties except as necessary to provide our service.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2">Your Rights:</h4>
                <p className="leading-relaxed">
                  Under UK GDPR, you have the right to access, correct, delete, or port your data. You can request deletion of your social account link or entire profile by contacting us.
                </p>
              </div>

              <div>
                <h4 className="font-bold text-white mb-2">Third-Party Policies:</h4>
                <p className="leading-relaxed">
                  The Social Providers' collection and use of your data is governed by their own privacy policies. We recommend reviewing{' '}
                  <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                    Google Privacy Policy
                  </a>
                  ,{' '}
                  <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                    Discord Privacy Policy
                  </a>
                  , and{' '}
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

              <div className="border-t border-blue-500/30 pt-4 mt-4">
                <p className="leading-relaxed">
                  For questions about how we handle your data, contact us at{' '}
                  <a href="mailto:tommy.franco.com@gmail.com" className="text-blue-400 hover:text-blue-300 underline">
                    tommy.franco.com@gmail.com
                  </a>
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">15. Changes to Terms</h3>
            <ul className="space-y-2 list-disc list-inside">
              <li>We reserve the right to modify these Terms at any time.</li>
              <li>We will notify users of material changes via email or platform notification.</li>
              <li>Continued use of the Service after changes constitutes acceptance of the modified Terms.</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">16. Governing Law</h3>
            <p className="leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of England and Wales, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">17. Dispute Resolution</h3>
            <p className="leading-relaxed">
              Any disputes arising from these Terms or your use of the Service shall be resolved through binding arbitration rather than in court, except where prohibited by law.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">18. Contact Information</h3>
            <p className="leading-relaxed">
              If you have questions about these Terms, please contact us at:
            </p>
            <ul className="mt-2 space-y-1">
              <li><strong>Email:</strong> tommy.franco.com@gmail.com</li>
              <li><strong>Website:</strong> www.ratingskill.com</li>
            </ul>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">19. Severability</h3>
            <p className="leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary and the remaining provisions shall remain in full force and effect.
            </p>
          </section>

          <section>
            <h3 className="text-xl font-bold text-white mb-3">20. Entire Agreement</h3>
            <p className="leading-relaxed">
              These Terms constitute the entire agreement between you and RatingSkill regarding the Service and supersede all prior agreements.
            </p>
          </section>

          <section className="border-t border-white/10 pt-6">
            <p className="leading-relaxed font-medium text-center">
              By using RatingSkill, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
