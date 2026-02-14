import { MapPin, Play, Lock, Swords, Shield } from 'lucide-react';

interface ArenaData {
  slug: string;
  name: string;
  city: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
}

const ARENAS: ArenaData[] = [
  {
    slug: 'london',
    name: 'The London Arena\u00AE',
    city: 'London',
    description: 'Welcome to the London Arena, here you can battle other Managers',
    imageUrl: 'https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&cs=tinysrgb&w=600',
    isActive: true,
  },
  {
    slug: 'manchester',
    name: 'The Manchester Arena\u00AE',
    city: 'Manchester',
    description: 'Coming Soon (2026)',
    imageUrl: 'https://images.pexels.com/photos/1563256/pexels-photo-1563256.jpeg?auto=compress&cs=tinysrgb&w=600',
    isActive: false,
  },
  {
    slug: 'liverpool',
    name: 'The Liverpool Arena\u00AE',
    city: 'Liverpool',
    description: 'Coming Soon (2026)',
    imageUrl: 'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg?auto=compress&cs=tinysrgb&w=600',
    isActive: false,
  },
  {
    slug: 'birmingham',
    name: 'The Birmingham Arena\u00AE',
    city: 'Birmingham',
    description: 'Coming Soon (2026)',
    imageUrl: 'https://images.pexels.com/photos/1105766/pexels-photo-1105766.jpeg?auto=compress&cs=tinysrgb&w=600',
    isActive: false,
  },
  {
    slug: 'leeds',
    name: 'The Leeds Arena\u00AE',
    city: 'Leeds',
    description: 'Coming Soon (2026)',
    imageUrl: 'https://images.pexels.com/photos/373912/pexels-photo-373912.jpeg?auto=compress&cs=tinysrgb&w=600',
    isActive: false,
  },
  {
    slug: 'bristol',
    name: 'The Bristol Arena\u00AE',
    city: 'Bristol',
    description: 'Coming Soon (2026)',
    imageUrl: 'https://images.pexels.com/photos/1486222/pexels-photo-1486222.jpeg?auto=compress&cs=tinysrgb&w=600',
    isActive: false,
  },
];

interface ArenaSelectionProps {
  onSelectArena: (slug: string) => void;
}

export default function ArenaSelection({ onSelectArena }: ArenaSelectionProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30 mb-4">
          <Shield className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-2">Select Your Arena</h2>
        <p className="text-white/50 max-w-md mx-auto">
          Choose a battle arena to compete against other Managers
        </p>
      </div>

      <div className="space-y-4">
        {ARENAS.map((arena) => (
          <div
            key={arena.slug}
            onClick={() => arena.isActive && onSelectArena(arena.slug)}
            className={`
              relative overflow-hidden rounded-2xl border transition-all duration-300
              ${arena.isActive
                ? 'border-cyan-500/40 bg-gradient-to-r from-slate-800/95 to-slate-700/95 hover:border-cyan-400 hover:shadow-lg hover:shadow-cyan-500/20 cursor-pointer group hover:-translate-y-0.5'
                : 'border-gray-700/40 bg-gradient-to-r from-gray-900/95 to-gray-800/95 opacity-50'}
            `}
          >
            <div className="flex items-stretch min-h-[130px]">
              <div className="w-32 sm:w-40 md:w-48 flex-shrink-0 relative overflow-hidden">
                <img
                  src={arena.imageUrl}
                  alt={arena.city}
                  className={`w-full h-full object-cover ${!arena.isActive ? 'grayscale' : 'group-hover:scale-105 transition-transform duration-500'}`}
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
                <div className={`absolute inset-0 ${arena.isActive ? 'bg-gradient-to-r from-transparent to-slate-800/50' : 'bg-black/60'}`} />
                {!arena.isActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Lock className="w-8 h-8 text-gray-400" />
                  </div>
                )}
                {arena.isActive && (
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
                    <MapPin className={`w-3.5 h-3.5 ${arena.isActive ? 'text-cyan-400' : 'text-gray-600'}`} />
                    <span className={`text-xs font-semibold uppercase tracking-wider ${arena.isActive ? 'text-cyan-400' : 'text-gray-600'}`}>
                      {arena.city}
                    </span>
                  </div>
                  <h3 className={`text-lg sm:text-xl font-bold mb-1 ${arena.isActive ? 'text-white' : 'text-gray-500'}`}>
                    {arena.name}
                  </h3>
                  <p className={`text-sm ${arena.isActive ? 'text-white/60' : 'text-gray-600'}`}>
                    {arena.description}
                  </p>
                </div>

                <div className="mt-3">
                  {arena.isActive ? (
                    <button className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-lg text-sm hover:from-cyan-400 hover:to-blue-500 transition-all group-hover:shadow-lg group-hover:shadow-cyan-500/30 active:scale-95">
                      <Play className="w-4 h-4" />
                      Enter Arena
                    </button>
                  ) : (
                    <button
                      disabled
                      className="flex items-center gap-2 px-5 py-2.5 bg-gray-800/60 text-gray-500 font-semibold rounded-lg text-sm cursor-not-allowed border border-gray-700/50"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      Coming Soon (2026)
                    </button>
                  )}
                </div>
              </div>

              {arena.isActive && (
                <div className="hidden sm:flex items-center pr-5">
                  <div className="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center group-hover:bg-cyan-500/20 group-hover:border-cyan-400/50 transition-all">
                    <Swords className="w-5 h-5 text-cyan-400" />
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
