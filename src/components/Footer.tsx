import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-gray-900/50 border-t border-white/10 backdrop-blur-sm py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-gray-400 text-sm">
            © 2026 RatingSkill®. All rights reserved.
          </div>
          <div className="flex gap-6">
            <Link
              to="/terms"
              className="text-gray-400 hover:text-cyan-400 text-sm transition-colors"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
