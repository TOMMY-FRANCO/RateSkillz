import { MapPin, Play, Lock, Swords, Shield, Users, Loader2 } from 'lucide-react';
import { useArenaUnlocks } from '../../hooks/useArenaUnlocks';

interface ArenaData {
  slug: string;
  name: string;
  city: string;
  description: string;
  imageUrl: string;
}

const ARENAS: ArenaData[] = [
  {
    slug: 'london',
    name: 'The London Arena\u00AE',
    city: 'London',
    description: 'Welcome to the London Arena, here you can battle other Managers',
    imageUrl: 'https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    slug: 'manchester',
    name: 'The Manchester Arena\u00AE',
    city: 'Manchester',
    description: 'Battle in the heart of the North',
    imageUrl: 'https://images.pexels.com/photos/1563256/pexels-photo-1563256.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    slug: 'liverpool',
    name: 'The Liverpool Arena\u00AE',
    city: 'Liverpool',
    description: 'Compete on Merseyside',
    imageUrl: 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    slug: 'birmingham',
    name: 'The Birmingham Arena\u00AE',
    city: 'Birmingham',
    description: 'The Midlands battleground awaits',
    imageUrl: 'https://images.pexels.com/photos/1105766/pexels-photo-1105766.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    slug: 'leeds',
    name: 'The Leeds Arena\u00AE',
    city: 'Leeds',
    description: 'Yorkshire\'s premier arena',
    imageUrl: 'https://images.pexels.com/photos/373912/pexels-photo-373912.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
  {
    slug: 'bristol',
    name: 'The Bristol Arena\u00AE',
    city: 'Bristol',
    description: 'The South West showdown',
    imageUrl: 'https://images.pexels.com/photos/1486222/pexels-photo-1486222.jpeg?auto=compress&cs=tinysrgb&w=600',
  },
];

interface ArenaSelectionProps {
  onSelectArena: (slug: string) => void;
}

export default function ArenaSelection({ onSelectArena }: ArenaSelectionProps) {
  const { isUnlocked, getProgress, loading: countLoading, error: countError } = useArenaUnlocks();

  return (
    <div className="space-y-5">
      <div className="glass-container p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-red-500/20 to-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0 border border-red-500/30">
            <Shield className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Select Your Arena</h2>
            <p className="text-xs text-[#B0B8C8]">Choose a battle arena to compete against other Managers</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {ARENAS.map((arena) => {
          const unlocked = isUnlocked(arena.slug);
          const progress = getProgress(arena.slug);

          return (
            <div
              key={arena.slug}
              onClick={() => unlocked && onSelectArena(arena.slug)}
              className={`
                glass-card p-0 overflow-hidden transition-all duration-300
                ${unlocked
                  ? 'border border-[rgba(0,224,255,0.2)] hover:border-[#00E0FF] cursor-pointer group hover:-translate-y-0.5 hover:shadow-[0_0_16px_rgba(0,224,255,0.15)]'
                  : 'border border-white/5 opacity-60'}
              `}
            >
              <div className="flex items-stretch min-h-[130px]">
                <div className="w-32 sm:w-40 md:w-48 flex-shrink-0 relative overflow-hidden">
                  <img
                    src={arena.imageUrl}
                    alt={arena.city}
                    width="128"
                    height="130"
                    className={`w-full h-full object-cover ${!unlocked ? 'grayscale' : 'group-hover:scale-105 transition-transform duration-500'}`}
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                  <div className={`absolute inset-0 ${unlocked ? 'bg-gradient-to-r from-transparent to-[rgba(10,18,32,0.6)]' : 'bg-black/60'}`} />
                  {!unlocked && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Lock className="w-8 h-8 text-[#B0B8C8]/40" />
                    </div>
                  )}
                  {unlocked && (
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-1 bg-green-500/90 rounded-md text-[10px] font-bold text-white uppercase tracking-wider shadow-lg">
                        Live
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <MapPin className={`w-3.5 h-3.5 ${unlocked ? 'text-[#00E0FF]' : 'text-[#B0B8C8]/40'}`} />
                      <span className={`text-xs font-semibold uppercase tracking-wider ${unlocked ? 'text-[#00E0FF]' : 'text-[#B0B8C8]/40'}`}>
                        {arena.city}
                      </span>
                    </div>
                    <h3 className={`text-lg sm:text-xl font-bold mb-1 ${unlocked ? 'text-white' : 'text-[#B0B8C8]/40'}`}>
                      {arena.name}
                    </h3>
                    <p className={`text-sm ${unlocked ? 'text-[#B0B8C8]' : 'text-[#B0B8C8]/30'}`}>
                      {unlocked ? arena.description : `Unlocks at ${progress.target.toLocaleString()} users`}
                    </p>
                  </div>

                  <div className="mt-3">
                    {unlocked ? (
                      <button className="bg-gradient-to-r from-[#00E0FF] to-[#38BDF8] text-black font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 hover:opacity-90 transition-all group-hover:shadow-[0_0_12px_rgba(0,224,255,0.35)] active:scale-95">
                        <Play className="w-4 h-4" />
                        Enter Arena
                      </button>
                    ) : countLoading ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[#B0B8C8]/40 text-xs">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Loading progress...
                        </div>
                      </div>
                    ) : countError ? (
                      <div className="flex items-center gap-2 px-4 py-2 bg-[rgba(15,24,41,0.85)] rounded-lg border border-white/10">
                        <Lock className="w-3.5 h-3.5 text-[#B0B8C8]/40" />
                        <span className="text-[#B0B8C8]/40 text-sm font-semibold">Locked</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="relative h-3 bg-[rgba(15,24,41,0.85)] rounded-full overflow-hidden border border-white/10">
                          <div
                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#00E0FF]/60 to-[#38BDF8]/60 rounded-full transition-all duration-700"
                            style={{ width: `${Math.max(progress.percent, 1)}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Users className="w-3.5 h-3.5 text-[#B0B8C8]/40" />
                          <span className="text-[#B0B8C8]/60 font-semibold">
                            {progress.current.toLocaleString()}
                          </span>
                          <span className="text-[#B0B8C8]/30">of</span>
                          <span className="text-[#B0B8C8]/60 font-semibold">
                            {progress.target.toLocaleString()}
                          </span>
                          <span className="text-[#B0B8C8]/30">users</span>
                          <span className="text-[#B0B8C8]/30 ml-auto">{progress.percent.toFixed(1)}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {unlocked && (
                  <div className="hidden sm:flex items-center pr-5">
                    <div className="w-12 h-12 rounded-full bg-[rgba(0,224,255,0.08)] border border-[rgba(0,224,255,0.2)] flex items-center justify-center group-hover:bg-[rgba(0,224,255,0.15)] group-hover:border-[rgba(0,224,255,0.4)] transition-all">
                      <Swords className="w-5 h-5 text-[#00E0FF]" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
