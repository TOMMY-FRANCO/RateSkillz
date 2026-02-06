import { useState } from 'react';
import { ArrowLeft, Play, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ShimmerBar, StaggerContainer, StaggerItem, ContentReveal, SlowLoadMessage } from '../components/ui/Shimmer';
import { SkeletonAvatar, SkeletonText, SkeletonRow, SkeletonCard, SkeletonButton, SkeletonLimitRow } from '../components/ui/SkeletonPresets';
import { AnimatedCounter } from '../components/ui/AnimatedCounter';

function DemoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{title}</h3>
      <div className="bg-gray-900/60 border border-white/[0.08] rounded-xl p-5">
        {children}
      </div>
    </div>
  );
}

export default function ShimmerDemo() {
  const navigate = useNavigate();
  const [counterVal, setCounterVal] = useState(0);
  const [revealVisible, setRevealVisible] = useState(false);
  const [staggerKey, setStaggerKey] = useState(0);
  const [slowLoadActive, setSlowLoadActive] = useState(false);

  const replayStagger = () => setStaggerKey((k) => k + 1);

  return (
    <div className="min-h-screen pb-32 pt-6 px-4">
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Shimmer Library</h1>
            <p className="text-gray-500 text-sm mt-0.5">All loading state primitives in one place</p>
          </div>
        </div>

        <DemoSection title="ShimmerBar -- Base Primitive">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">speed="fast" (2.5s, amber 12%)</p>
              <ShimmerBar className="h-4 w-full rounded" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">speed="slow" (3.5s, amber 8%)</p>
              <ShimmerBar className="h-4 w-full rounded" speed="slow" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">Custom shapes</p>
              <div className="flex items-center gap-3">
                <ShimmerBar className="w-10 h-10 rounded-full" />
                <ShimmerBar className="w-10 h-10 rounded-xl" />
                <ShimmerBar className="flex-1 h-3 rounded" />
              </div>
            </div>
          </div>
        </DemoSection>

        <DemoSection title="SkeletonAvatar">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <SkeletonAvatar size="sm" />
              <p className="text-[10px] text-gray-600 mt-1">sm</p>
            </div>
            <div className="text-center">
              <SkeletonAvatar size="md" />
              <p className="text-[10px] text-gray-600 mt-1">md</p>
            </div>
            <div className="text-center">
              <SkeletonAvatar size="lg" />
              <p className="text-[10px] text-gray-600 mt-1">lg</p>
            </div>
          </div>
        </DemoSection>

        <DemoSection title="SkeletonText">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">Single line (width variants)</p>
              <div className="space-y-2">
                <SkeletonText width={80} />
                <SkeletonText width={160} />
                <SkeletonText width="60%" />
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">Multi-line (3 lines)</p>
              <SkeletonText lines={3} />
            </div>
          </div>
        </DemoSection>

        <DemoSection title="SkeletonRow & SkeletonCard">
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">Single row</p>
              <SkeletonRow index={0} />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-2">SkeletonCard (3 rows auto-staggered)</p>
              <SkeletonCard rows={3} />
            </div>
          </div>
        </DemoSection>

        <DemoSection title="SkeletonButton & SkeletonLimitRow">
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
              <SkeletonButton className="flex-1" />
            </div>
            <SkeletonLimitRow />
          </div>
        </DemoSection>

        <DemoSection title="StaggerItem -- Cascading Reveals">
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500">50ms interval between items</p>
              <button
                onClick={replayStagger}
                className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Replay
              </button>
            </div>
            <div key={staggerKey} className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <StaggerItem key={i} index={i}>
                  <div className="flex items-center gap-3">
                    <SkeletonAvatar size="sm" />
                    <ShimmerBar className="h-3 rounded flex-1" style={{ maxWidth: `${200 - i * 20}px` }} />
                  </div>
                </StaggerItem>
              ))}
            </div>
          </div>
        </DemoSection>

        <DemoSection title="StaggerContainer -- Grouped Delay">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">Two groups with 300ms offset</p>
            <button
              onClick={replayStagger}
              className="flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Replay
            </button>
          </div>
          <div key={`group-${staggerKey}`} className="space-y-4">
            <StaggerContainer>
              <ShimmerBar className="h-10 rounded-lg" />
            </StaggerContainer>
            <StaggerContainer baseDelay={300}>
              <ShimmerBar className="h-10 rounded-lg" />
            </StaggerContainer>
          </div>
        </DemoSection>

        <DemoSection title="AnimatedCounter -- Number Reveal">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 mb-2">400ms cubic ease-out</p>
              <span className="text-3xl font-bold text-amber-400">
                <AnimatedCounter value={counterVal} />
              </span>
              <span className="text-gray-500 ml-2 text-sm">coins</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCounterVal(145.5)}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors flex items-center gap-1.5"
              >
                <Play className="w-3 h-3" />
                Count to 145.5
              </button>
              <button
                onClick={() => setCounterVal(0)}
                className="px-3 py-1.5 text-xs font-semibold bg-white/5 text-gray-400 rounded-lg hover:bg-white/10 transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </DemoSection>

        <DemoSection title="ContentReveal -- Skeleton to Content">
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">200ms fade + blur transition</p>
              <button
                onClick={() => setRevealVisible((v) => !v)}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-400 rounded-lg hover:bg-emerald-500/20 transition-colors"
              >
                {revealVisible ? 'Show Skeleton' : 'Reveal Content'}
              </button>
            </div>
            <ContentReveal
              visible={revealVisible}
              fallback={
                <div className="flex items-center gap-3">
                  <SkeletonAvatar />
                  <div className="flex-1 space-y-1.5">
                    <ShimmerBar className="h-4 w-32 rounded" />
                    <ShimmerBar className="h-3 w-20 rounded" />
                  </div>
                </div>
              }
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold">
                  JD
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">John Doe</p>
                  <p className="text-gray-500 text-xs">@johndoe</p>
                </div>
              </div>
            </ContentReveal>
          </div>
        </DemoSection>

        <DemoSection title="SlowLoadMessage -- Timeout Fallback">
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">Appears after 3s threshold (demo: 1s)</p>
              <button
                onClick={() => setSlowLoadActive((v) => !v)}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-500/10 text-amber-400 rounded-lg hover:bg-amber-500/20 transition-colors"
              >
                {slowLoadActive ? 'Stop Loading' : 'Start Loading'}
              </button>
            </div>
            {slowLoadActive && (
              <div className="space-y-2">
                <SkeletonCard rows={2} />
                <SlowLoadMessage loading={slowLoadActive} threshold={1000} message="Loading friends..." />
              </div>
            )}
          </div>
        </DemoSection>

        <DemoSection title="Composition -- Full Modal Skeleton">
          <div className="space-y-5">
            <div>
              <StaggerContainer>
                <SkeletonText width={56} />
              </StaggerContainer>
              <SkeletonCard rows={4} className="mt-2" />
            </div>
            <StaggerContainer baseDelay={300}>
              <div className="flex items-center justify-between mb-3">
                <SkeletonText width={56} />
                <SkeletonText width={96} />
              </div>
              <div className="flex gap-2 mb-4">
                {[0, 1, 2, 3].map((i) => (
                  <StaggerItem key={i} index={i} interval={40} className="flex-1">
                    <ShimmerBar className="h-10 rounded-lg" />
                  </StaggerItem>
                ))}
              </div>
              <ShimmerBar className="h-2 rounded-full" speed="slow" />
            </StaggerContainer>
            <StaggerContainer baseDelay={450} className="bg-white/[0.03] rounded-xl p-4 border border-white/[0.04] space-y-2.5">
              <SkeletonLimitRow />
              <SkeletonLimitRow />
            </StaggerContainer>
            <StaggerContainer baseDelay={500} className="flex gap-3">
              <div className="flex-1 h-12 rounded-xl bg-white/[0.03] border border-white/[0.06]" />
              <SkeletonButton className="flex-1" />
            </StaggerContainer>
          </div>
        </DemoSection>

        <div className="bg-gray-900/40 border border-white/[0.06] rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">CSS Variables</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['--shimmer-accent-color', 'amber 12% (fast shimmer)'],
              ['--shimmer-slow-color', 'amber 8% (slow shimmer)'],
              ['--shimmer-base', 'white 6% (skeleton bg)'],
              ['--shimmer-speed-fast', '2.5s'],
              ['--shimmer-speed-slow', '3.5s'],
              ['--shimmer-pulse-speed', '1.8s'],
              ['--shimmer-stagger-base', '50ms'],
              ['--shimmer-reveal-duration', '0.2s'],
            ].map(([name, desc]) => (
              <div key={name} className="flex items-start gap-2 py-1">
                <code className="text-amber-400/80 font-mono text-[11px] whitespace-nowrap">{name}</code>
                <span className="text-gray-600">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
