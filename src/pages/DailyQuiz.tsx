import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle, XCircle, Trophy, Coins } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Question {
  question: string;
  options: string[];
  correct: number;
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

export default function DailyQuiz() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [questions, setQuestions] = useState<Question[]>([]);
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
        setQuestions(shuffled.slice(0, 10));
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

  const handleAnswer = useCallback(async (answerIndex: number) => {
    if (isRevealed || submitting) return;

    const currentQuestion = questions[currentIndex];
    const isCorrect = answerIndex === currentQuestion.correct;
    const newScore = isCorrect ? score + 1 : score;

    setSelectedAnswer(answerIndex);
    setIsRevealed(true);
    if (isCorrect) setScore(newScore);

    const isLast = currentIndex === questions.length - 1;

    setTimeout(async () => {
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
      }
    }, 1500);
  }, [isRevealed, submitting, questions, currentIndex, score, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-14">
              <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 text-[#B0B8C8] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white ml-2">Daily Quiz</h1>
            </div>
          </div>
        </nav>
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">
          <div className="glass-card p-4 animate-pulse space-y-4">
            <div className="h-6 bg-white/10 rounded w-3/4"></div>
            <div className="h-12 bg-white/10 rounded"></div>
            <div className="h-12 bg-white/10 rounded"></div>
            <div className="h-12 bg-white/10 rounded"></div>
            <div className="h-12 bg-white/10 rounded"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-14">
              <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 text-[#B0B8C8] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white ml-2">Daily Quiz</h1>
            </div>
          </div>
        </nav>
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
        <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-14">
              <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 text-[#B0B8C8] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white ml-2">Daily Quiz</h1>
            </div>
          </div>
        </nav>
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 space-y-5">
          <div className="glass-card p-8 text-center space-y-6">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-[#FFD700] to-[#FFA500] rounded-full flex items-center justify-center shadow-lg shadow-[#FFD700]/30">
              <CheckCircle className="w-10 h-10 text-black" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Quiz Completed!</h2>
              <p className="text-[#B0B8C8]">You've already completed today's quiz</p>
            </div>
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Trophy className="w-5 h-5 text-[#FFD700]" />
                  <span className="text-3xl font-bold text-white">{todayResult.score}</span>
                  <span className="text-[#B0B8C8] text-lg">/10</span>
                </div>
                <p className="text-[#B0B8C8] text-xs">Score</p>
              </div>
              <div className="w-px h-12 bg-white/10"></div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Coins className="w-5 h-5 text-[#00FF85]" />
                  <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00FF85] to-[#00E0FF]">
                    {todayResult.coins_earned}
                  </span>
                </div>
                <p className="text-[#B0B8C8] text-xs">Coins Earned</p>
              </div>
            </div>
            <p className="text-[#B0B8C8] text-xs">Come back tomorrow at 7am for a new quiz!</p>
            <button
              onClick={() => navigate('/dashboard')}
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
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
        <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-14">
              <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 text-[#B0B8C8] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white ml-2">Daily Quiz</h1>
            </div>
          </div>
        </nav>
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
                <p className="text-[#B0B8C8]">Great job on today's quiz</p>
              </div>
              <div className="flex items-center justify-center gap-8">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Trophy className="w-5 h-5 text-[#FFD700]" />
                    <span className="text-3xl font-bold text-white">{score}</span>
                    <span className="text-[#B0B8C8] text-lg">/10</span>
                  </div>
                  <p className="text-[#B0B8C8] text-xs">Score</p>
                </div>
                <div className="w-px h-12 bg-white/10"></div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Coins className="w-5 h-5 text-[#00FF85]" />
                    <span className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00FF85] to-[#00E0FF]">
                      {coinsEarned}
                    </span>
                  </div>
                  <p className="text-[#B0B8C8] text-xs">Coins Earned</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/dashboard')}
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

  const currentQuestion = questions[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <nav className="glass-container rounded-none border-l-0 border-r-0 border-t-0 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center">
              <button onClick={() => navigate('/dashboard')} className="p-2 -ml-2 text-[#B0B8C8] hover:text-white transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="text-xl font-bold text-white ml-2">Daily Quiz</h1>
            </div>
            <div className="flex items-center gap-3">
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
        <div className="w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#00FF85] to-[#00E0FF] transition-all duration-500 ease-out rounded-full"
            style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
          />
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
