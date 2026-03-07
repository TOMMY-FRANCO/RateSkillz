import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle, XCircle, Trophy, Coins, Clock, Share2, MessageCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import QuizShareModal from '../components/QuizShareModal';

interface Question {
  id: number;
  question: string;
  options: string[];
  answer: string;
}

interface TodayResult {
  score: number;
  coins_earned: number;
  completed_at: string;
}

function getQuizResetTime(): Date {
  const now = new Date();
  const londonStr = now.toLocaleString('en-GB', { timeZone: 'Europe/London' });
  const parts = londonStr.split(/[/,\s:]+/);
  const londonHour = parseInt(parts[3], 10);

  const today7am = new Date(now);
  today7am.setUTCHours(7, 0, 0, 0);

  const offset = now.toLocaleString('en-GB', { timeZone: 'Europe/London', timeZoneName: 'shortOffset' });
  const isBST = offset.includes('+01') || offset.includes('+1');
  if (isBST) {
    today7am.setUTCHours(6, 0, 0, 0);
  }

  if (londonHour < 7) {
    today7am.setUTCDate(today7am.getUTCDate() - 1);
  }

  return today7am;
}

function getNextResetTime(): Date {
  const resetTime = getQuizResetTime();
  resetTime.setUTCDate(resetTime.getUTCDate() + 1);
  return resetTime;
}

function getWellDoneMessage(score: number): string {
  if (score === 10) return 'Perfect score! Outstanding!';
  if (score >= 7) return 'Great work!';
  if (score >= 4) return 'Good effort!';
  return 'Better luck next time!';
}

function getShareText(score: number): string {
  return `I scored ${score}/10 on the RatingSkill\u2122 Daily Quiz! ${getWellDoneMessage(score)} Download RatingSkill\u2122 and challenge me!`;
}

function NavBar({ onBack }: { onBack: () => void }) {
  return (
    <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14">
          <button onClick={onBack} className="p-2 -ml-2 text-[#B0B8C8] hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-white ml-2">Daily Quiz</h1>
        </div>
      </div>
    </nav>
  );
}

function CountdownTimer({ targetTime }: { targetTime: Date }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const tick = () => {
      const diff = targetTime.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        window.location.reload();
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return (
    <div className="flex items-center justify-center gap-2 text-[#B0B8C8]">
      <Clock className="w-4 h-4" />
      <span className="text-sm">Next quiz in</span>
      <span className="font-mono font-bold text-white text-lg tracking-wider">{timeLeft}</span>
    </div>
  );
}

function ConfettiEffect() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 2;
        const duration = 2.5 + Math.random() * 2;
        const size = 6 + Math.random() * 8;
        const colors = ['#00FF85', '#00E0FF', '#FFD700', '#FF6B6B', '#FF85C8', '#85C8FF'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        const rotation = Math.random() * 360;

        return (
          <div
            key={i}
            className="absolute animate-confetti"
            style={{
              left: `${left}%`,
              top: '-10px',
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: color,
              borderRadius: Math.random() > 0.5 ? '50%' : '2px',
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
              transform: `rotate(${rotation}deg)`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
        .animate-confetti {
          animation: confetti-fall linear forwards;
        }
      `}</style>
    </div>
  );
}

function ShareButtons({ score, userId }: { score: number; userId: string }) {
  const [showChatModal, setShowChatModal] = useState(false);
  const text = getShareText(score);
  const encoded = encodeURIComponent(text);

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encoded}`, '_blank');
  };

  const handleDiscord = () => {
    navigator.clipboard.writeText(text);
  };

  return (
    <>
      <div className="space-y-3">
        <p className="text-[#B0B8C8] text-xs font-semibold uppercase tracking-wider text-center">Share your score</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleWhatsApp}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-xs font-bold hover:bg-[#25D366]/20 transition-all"
          >
            <Share2 className="w-4 h-4" />
            WhatsApp
          </button>
          <button
            onClick={handleFacebook}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#1877F2]/10 border border-[#1877F2]/30 text-[#1877F2] text-xs font-bold hover:bg-[#1877F2]/20 transition-all"
          >
            <Share2 className="w-4 h-4" />
            Facebook
          </button>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleDiscord}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#5865F2]/10 border border-[#5865F2]/30 text-[#5865F2] text-xs font-bold hover:bg-[#5865F2]/20 transition-all"
          >
            <Share2 className="w-4 h-4" />
            Discord
          </button>
          <button
            onClick={() => setShowChatModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#00E0FF]/10 border border-[#00E0FF]/30 text-[#00E0FF] text-xs font-bold hover:bg-[#00E0FF]/20 transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            In-App Chat
          </button>
        </div>
      </div>

      {showChatModal && (
        <QuizShareModal
          userId={userId}
          shareText={text}
          onClose={() => setShowChatModal(false)}
        />
      )}
    </>
  );
}

function ScoreDisplay({ score, coins }: { score: number; coins: number }) {
  return (
    <div className="flex items-center justify-center gap-8">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Trophy className="w-5 h-5 text-[#FFD700]" />
          <span className="text-3xl font-bold text-white">{score}</span>
          <span className="text-[#B0B8C8] text-lg">/10</span>
        </div>
        <p className="text-[#B0B8C8] text-xs">Score</p>
      </div>
      <div className="w-px h-12 bg-white/10" />
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <Coins className="w-5 h-5 text-[#00FF85]" />
          <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00FF85] to-[#00E0FF]">
            {coins}
          </span>
        </div>
        <p className="text-[#B0B8C8] text-xs">Coins Earned</p>
      </div>
    </div>
  );
}

export default function DailyQuiz() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const questionsRef = useRef<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [todayResult, setTodayResult] = useState<TodayResult | null>(null);
  const [timer, setTimer] = useState(30);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const answeredRef = useRef(false);
  const scoreRef = useRef(0);

  const goBack = useCallback(() => navigate('/dashboard'), [navigate]);

  const checkTodayCompletion = useCallback(async () => {
    if (!user) return null;
    const resetTime = getQuizResetTime();
    const { data } = await supabase
      .from('quiz_results')
      .select('score, coins_earned, completed_at')
      .eq('user_id', user.id)
      .gte('completed_at', resetTime.toISOString())
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);

      try {
        const existing = await checkTodayCompletion();
        if (cancelled) return;

        if (existing) {
          setTodayResult(existing);
          setLoading(false);
          return;
        }

        const resp = await fetch(
          'https://raw.githubusercontent.com/TOMMY-FRANCO/RateSkillz/main/public/quiz-questions.json'
        );
        if (!resp.ok) throw new Error('Failed to load questions');

        const allQuestions: Question[] = await resp.json();
        if (cancelled) return;

        if (!Array.isArray(allQuestions) || allQuestions.length === 0) {
          throw new Error('No questions available');
        }

        const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
        questionsRef.current = shuffled.slice(0, 10);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
  }, [checkTodayCompletion]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const advanceToNext = useCallback(async (newScore: number) => {
    const questions = questionsRef.current;
    const isLast = currentIndex === questions.length - 1;

    if (isLast) {
      setSubmitting(true);
      try {
        const { data, error: rpcError } = await supabase.rpc('complete_quiz', {
          p_user_id: user!.id,
          p_score: newScore,
        });

        if (rpcError) throw rpcError;

        const result = data as { success: boolean; coins_earned?: number; error?: string };
        if (!result.success) throw new Error(result.error || 'Failed to save quiz');

        setCoinsEarned(result.coins_earned ?? newScore);
      } catch {
        setCoinsEarned(newScore);
      } finally {
        setSubmitting(false);
        setQuizComplete(true);
      }
    } else {
      setCurrentIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsRevealed(false);
      answeredRef.current = false;
      setTimer(30);
    }
  }, [currentIndex, user]);

  const processAnswer = useCallback((answerIndex: number | null) => {
    if (answeredRef.current) return;
    answeredRef.current = true;
    clearTimer();

    const questions = questionsRef.current;
    const currentQuestion = questions[currentIndex];
    const isCorrect = answerIndex !== null && currentQuestion.options[answerIndex] === currentQuestion.answer;
    const newScore = isCorrect ? scoreRef.current + 1 : scoreRef.current;

    setSelectedAnswer(answerIndex);
    setIsRevealed(true);
    if (isCorrect) {
      scoreRef.current = newScore;
      setScore(newScore);
    }

    setTimeout(() => {
      advanceToNext(newScore);
    }, 1500);
  }, [currentIndex, clearTimer, advanceToNext]);

  useEffect(() => {
    if (loading || error || todayResult || quizComplete || questionsRef.current.length === 0) return;
    if (isRevealed) return;

    answeredRef.current = false;
    setTimer(30);
    clearTimer();

    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          processAnswer(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return clearTimer;
  }, [currentIndex, loading, error, todayResult, quizComplete, isRevealed, clearTimer, processAnswer]);

  const handleAnswer = useCallback((answerIndex: number) => {
    if (answeredRef.current || isRevealed || submitting) return;
    processAnswer(answerIndex);
  }, [isRevealed, submitting, processAnswer]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <NavBar onBack={goBack} />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">
          <div className="glass-card p-4 animate-pulse space-y-4">
            <div className="h-6 bg-white/10 rounded w-3/4" />
            <div className="h-12 bg-white/10 rounded" />
            <div className="h-12 bg-white/10 rounded" />
            <div className="h-12 bg-white/10 rounded" />
            <div className="h-12 bg-white/10 rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <NavBar onBack={goBack} />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">
          <div className="glass-card p-10 text-center space-y-4">
            <XCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h2 className="text-lg font-bold text-white">Failed to Load Quiz</h2>
            <p className="text-[#B0B8C8] text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black text-sm font-bold rounded-lg"
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (todayResult) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <NavBar onBack={goBack} />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">
          <div className="glass-card p-8 text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-full flex items-center justify-center shadow-lg shadow-[#FFD700]/30">
              <CheckCircle className="w-10 h-10 text-black" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Quiz Completed!</h2>
              <p className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#FFA500]">
                {getWellDoneMessage(todayResult.score)}
              </p>
            </div>
            <ScoreDisplay score={todayResult.score} coins={todayResult.coins_earned} />
            <div className="pt-2">
              <CountdownTimer targetTime={getNextResetTime()} />
            </div>
            <ShareButtons score={todayResult.score} userId={user!.id} />
            <button
              onClick={goBack}
              className="px-6 py-2.5 bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
            >
              Back to Dashboard
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (quizComplete) {
    const showConfetti = score >= 8;
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        {showConfetti && <ConfettiEffect />}
        <NavBar onBack={goBack} />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">
          {submitting ? (
            <div className="glass-card p-10 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-[#00E0FF] animate-spin mx-auto" />
              <p className="text-[#B0B8C8]">Saving your results...</p>
            </div>
          ) : (
            <div className="glass-card p-8 text-center space-y-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-full flex items-center justify-center shadow-lg shadow-[#FFD700]/30 animate-bounce">
                <Trophy className="w-10 h-10 text-black" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-white">Quiz Complete!</h2>
                <p className="text-lg font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] to-[#FFA500]">
                  {getWellDoneMessage(score)}
                </p>
              </div>
              <ScoreDisplay score={score} coins={coinsEarned} />
              <div className="pt-2">
                <CountdownTimer targetTime={getNextResetTime()} />
              </div>
              <ShareButtons score={score} userId={user!.id} />
              <button
                onClick={goBack}
                className="px-6 py-2.5 bg-gradient-to-r from-[#00FF85] to-[#00E0FF] text-black text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
              >
                Back to Dashboard
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  const questions = questionsRef.current;
  const currentQuestion = questions[currentIndex];

  if (!currentQuestion) return null;

  const timerPercent = (timer / 30) * 100;
  const timerColor = timer <= 5 ? 'from-red-500 to-red-400' : timer <= 10 ? 'from-amber-500 to-amber-400' : 'from-[#00FF85] to-[#00E0FF]';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center">
              <button onClick={goBack} className="p-2 -ml-2 text-[#B0B8C8] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white ml-2">Daily Quiz</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                timer <= 5 ? 'bg-red-500/15 border border-red-500/30' : timer <= 10 ? 'bg-amber-500/15 border border-amber-500/30' : 'bg-white/5 border border-white/10'
              }`}>
                <Clock className={`w-3.5 h-3.5 ${timer <= 5 ? 'text-red-400' : timer <= 10 ? 'text-amber-400' : 'text-[#B0B8C8]'}`} />
                <span className={`text-sm font-bold font-mono ${
                  timer <= 5 ? 'text-red-400 animate-pulse' : timer <= 10 ? 'text-amber-400' : 'text-white'
                }`}>
                  {timer}s
                </span>
              </div>
              <span className="text-[#B0B8C8] text-sm font-medium">
                {currentIndex + 1}<span className="text-white/30">/</span>{questions.length}
              </span>
              <div className="flex items-center gap-1">
                <Trophy className="w-4 h-4 text-[#FFD700]" />
                <span className="text-white text-sm font-bold">{score}</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">
        <div className="space-y-1.5">
          <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#00FF85] to-[#00E0FF] transition-all duration-500 ease-out rounded-full"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
          <div className="w-full bg-white/5 rounded-full h-1 overflow-hidden">
            <div
              className={`h-full bg-gradient-to-r ${timerColor} rounded-full transition-all duration-1000 ease-linear`}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        </div>

        <div className="glass-card p-6 space-y-6">
          <h2 className="text-lg font-bold text-white leading-relaxed">
            {currentQuestion.question}
          </h2>

          <div className="space-y-3">
            {currentQuestion.options.map((option, idx) => {
              let btnClass = 'glass-card p-4 w-full text-left transition-all duration-300 border-2 ';

              if (!isRevealed) {
                btnClass += 'border-transparent hover:border-[#00E0FF]/50 cursor-pointer active:scale-[0.98]';
              } else if (idx === currentQuestion.correct) {
                btnClass += 'border-emerald-400 bg-emerald-400/10';
              } else if (idx === selectedAnswer && idx !== currentQuestion.correct) {
                btnClass += 'border-red-400 bg-red-400/10';
              } else {
                btnClass += 'border-transparent opacity-50';
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  disabled={isRevealed}
                  className={btnClass}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${
                      isRevealed && idx === currentQuestion.correct
                        ? 'bg-emerald-400 text-black'
                        : isRevealed && idx === selectedAnswer && idx !== currentQuestion.correct
                          ? 'bg-red-400 text-black'
                          : 'bg-white/10 text-[#B0B8C8]'
                    }`}>
                      {isRevealed && idx === currentQuestion.correct ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : isRevealed && idx === selectedAnswer && idx !== currentQuestion.correct ? (
                        <XCircle className="w-4 h-4" />
                      ) : (
                        String.fromCharCode(65 + idx)
                      )}
                    </div>
                    <span className={`text-sm font-medium ${
                      isRevealed && idx === currentQuestion.correct
                        ? 'text-emerald-400'
                        : isRevealed && idx === selectedAnswer && idx !== currentQuestion.correct
                          ? 'text-red-400'
                          : 'text-white'
                    }`}>
                      {option}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
