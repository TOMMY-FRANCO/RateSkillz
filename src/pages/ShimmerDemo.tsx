import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  SkeletonCard,
  SkeletonRow,
  SkeletonAvatar,
  SkeletonText,
  SkeletonButton,
  SkeletonLimitRow
} from '../components/ui/SkeletonPresets';

export default function ShimmerDemo() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-white/60 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <h1 className="text-3xl font-bold text-white mb-8">Shimmer Loading Demo</h1>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Skeleton Card</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <SkeletonCard rows={3} />
              <SkeletonCard rows={4} />
              <SkeletonCard rows={2} />
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Skeleton Rows</h2>
            <div className="glass-card p-6 space-y-4">
              <SkeletonRow index={0} />
              <SkeletonRow index={1} />
              <SkeletonRow index={2} />
              <SkeletonRow index={3} />
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Avatar Variations</h2>
            <div className="glass-card p-6 flex items-center gap-4">
              <SkeletonAvatar size="sm" />
              <SkeletonAvatar size="md" />
              <SkeletonAvatar size="lg" />
              <SkeletonAvatar size="lg" shape="rounded" />
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Text Variations</h2>
            <div className="glass-card p-6 space-y-4">
              <SkeletonText width={200} />
              <SkeletonText width="100%" />
              <SkeletonText lines={3} />
              <SkeletonText lines={5} width="80%" />
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Buttons</h2>
            <div className="glass-card p-6 space-y-4">
              <SkeletonButton />
              <SkeletonButton shimmer={false} />
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Limit Rows</h2>
            <div className="glass-card p-6 space-y-3">
              <SkeletonLimitRow />
              <SkeletonLimitRow />
              <SkeletonLimitRow />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
