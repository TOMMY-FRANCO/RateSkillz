function ShimmerBar({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-white/5 rounded-lg ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

function GlassPanel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 ${className}`}>
      {children}
    </div>
  );
}

const base = 'min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black px-4 py-6 max-w-md mx-auto space-y-4';

export function FriendsSkeleton() {
  return (
    <div className={base}>
      <ShimmerBar className="h-8 w-48" />
      <ShimmerBar className="h-10 w-full rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <GlassPanel key={i} className="flex items-center gap-3">
            <ShimmerBar className="w-12 h-12 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <ShimmerBar className="h-4 w-32" />
              <ShimmerBar className="h-3 w-20" />
            </div>
            <ShimmerBar className="h-8 w-20 rounded-lg flex-shrink-0" />
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}

export function InboxSkeleton() {
  return (
    <div className={base}>
      <ShimmerBar className="h-8 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <GlassPanel key={i} className="flex items-center gap-3">
            <ShimmerBar className="w-11 h-11 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2 min-w-0">
              <ShimmerBar className="h-4 w-28" />
              <ShimmerBar className="h-3 w-48" />
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <ShimmerBar className="h-3 w-10" />
              <ShimmerBar className="h-5 w-5 rounded-full" />
            </div>
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}

export function BattleModeSkeleton() {
  return (
    <div className={base}>
      <ShimmerBar className="h-8 w-40" />
      <GlassPanel className="space-y-3">
        <ShimmerBar className="h-5 w-32" />
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <ShimmerBar key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </GlassPanel>
      <GlassPanel>
        <ShimmerBar className="h-5 w-36 mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <ShimmerBar className="w-8 h-8 rounded-full flex-shrink-0" />
              <ShimmerBar className="h-4 flex-1" />
              <ShimmerBar className="h-4 w-16 flex-shrink-0" />
            </div>
          ))}
        </div>
      </GlassPanel>
      <ShimmerBar className="h-12 w-full rounded-xl" />
    </div>
  );
}

export function TradingDashboardSkeleton() {
  return (
    <div className={base}>
      <ShimmerBar className="h-8 w-44" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassPanel key={i} className="space-y-2">
            <ShimmerBar className="h-3 w-20" />
            <ShimmerBar className="h-7 w-16" />
          </GlassPanel>
        ))}
      </div>
      <GlassPanel className="space-y-3">
        <ShimmerBar className="h-5 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <ShimmerBar className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <ShimmerBar className="h-4 w-28" />
              <ShimmerBar className="h-3 w-20" />
            </div>
            <ShimmerBar className="h-8 w-20 rounded-lg flex-shrink-0" />
          </div>
        ))}
      </GlassPanel>
    </div>
  );
}

export function LeaderboardSkeleton() {
  return (
    <div className={base}>
      <ShimmerBar className="h-8 w-44" />
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <ShimmerBar key={i} className="h-9 flex-1 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <GlassPanel key={i} className="flex items-center gap-3">
            <ShimmerBar className="w-7 h-7 rounded-full flex-shrink-0" />
            <ShimmerBar className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <ShimmerBar className="h-4 w-28" />
              <ShimmerBar className="h-3 w-16" />
            </div>
            <ShimmerBar className="h-6 w-14 rounded-lg flex-shrink-0" />
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}

export function AddFriendByQRSkeleton() {
  return (
    <div className={base}>
      <ShimmerBar className="h-8 w-40" />
      <GlassPanel className="flex flex-col items-center space-y-4 py-6">
        <ShimmerBar className="w-48 h-48 rounded-2xl" />
        <ShimmerBar className="h-4 w-56" />
        <ShimmerBar className="h-4 w-40" />
      </GlassPanel>
      <ShimmerBar className="h-12 w-full rounded-xl" />
      <GlassPanel className="space-y-3">
        <ShimmerBar className="h-5 w-32" />
        <ShimmerBar className="h-10 w-full rounded-xl" />
        <ShimmerBar className="h-12 w-full rounded-xl" />
      </GlassPanel>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className={base}>
      <ShimmerBar className="h-8 w-32" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <GlassPanel key={i} className="flex items-center gap-4">
            <ShimmerBar className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <ShimmerBar className="h-4 w-36" />
              <ShimmerBar className="h-3 w-48" />
            </div>
            <ShimmerBar className="w-6 h-6 rounded flex-shrink-0" />
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}

export function TutorialSkeleton() {
  return (
    <div className={base}>
      <ShimmerBar className="h-8 w-36" />
      <GlassPanel className="space-y-4">
        <ShimmerBar className="h-40 w-full rounded-xl" />
        <ShimmerBar className="h-5 w-48" />
        <ShimmerBar className="h-4 w-full" />
        <ShimmerBar className="h-4 w-3/4" />
        <div className="flex gap-2 pt-2">
          <ShimmerBar className="h-10 flex-1 rounded-xl" />
          <ShimmerBar className="h-10 flex-1 rounded-xl" />
        </div>
      </GlassPanel>
      <div className="flex justify-center gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <ShimmerBar key={i} className="w-2 h-2 rounded-full" />
        ))}
      </div>
    </div>
  );
}

export function GenericPageSkeleton() {
  return (
    <div className={base}>
      <ShimmerBar className="h-8 w-40" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassPanel key={i} className="space-y-3">
            <ShimmerBar className="h-5 w-32" />
            <ShimmerBar className="h-4 w-full" />
            <ShimmerBar className="h-4 w-4/5" />
          </GlassPanel>
        ))}
      </div>
    </div>
  );
}
