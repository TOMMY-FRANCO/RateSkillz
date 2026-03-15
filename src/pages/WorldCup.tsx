import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const TARGET = new Date('2026-06-11T00:00:00Z').getTime();

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  started: boolean;
}

function getTimeLeft(): TimeLeft {
  const diff = TARGET - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, started: true };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    started: false,
  };
}

function CountBox({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span
        className="text-yellow-400 font-black text-4xl tabular-nums leading-none"
        style={{ textShadow: '0 0 12px rgba(250,204,21,0.6)' }}
      >
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[#B0B8C8] text-xs uppercase tracking-widest">{label}</span>
    </div>
  );
}

export default function WorldCup() {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(getTimeLeft);

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen">
      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-[#B0B8C8] hover:text-[#00E0FF] transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-white">World Cup 2026</h1>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center justify-center">
        <div className="glass-container p-8 text-center w-full max-w-lg">
          <div className="text-6xl mb-4">🏆</div>

          <h2
            className="text-white font-bold text-3xl uppercase tracking-widest mb-2"
            style={{ textShadow: '0 0 14px rgba(250,204,21,0.8), 0 0 28px rgba(250,204,21,0.4)' }}
          >
            WORLD CUP 2026
          </h2>

          <p className="text-[#B0B8C8] text-sm mb-8">June 11 — July 19 2026</p>

          {timeLeft.started ? (
            <p className="text-[#00FF85] font-bold text-xl tracking-widest uppercase mb-8">
              TOURNAMENT HAS STARTED
            </p>
          ) : (
            <div className="flex flex-row gap-4 justify-center mb-8">
              <CountBox value={timeLeft.days} label="DAYS" />
              <CountBox value={timeLeft.hours} label="HOURS" />
              <CountBox value={timeLeft.minutes} label="MINS" />
              <CountBox value={timeLeft.seconds} label="SECS" />
            </div>
          )}

          <p className="text-[#B0B8C8] text-sm text-center">
            Live tables, fixtures, results and top scorers will appear here when the tournament begins.
          </p>
        </div>
      </main>
    </div>
  );
}
