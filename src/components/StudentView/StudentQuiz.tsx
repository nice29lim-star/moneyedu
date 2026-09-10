import React, { useState, useEffect } from 'react';
import { Sparkles, Coins, Wallet, Award, Presentation, ArrowRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Session, Student } from '../../types';
import { PixelBadge, PixelButton, PixelCard } from '../PixelUI';
import { playCoinSound } from '../../utils/soundEffects';
import { syncManager } from '../../utils/syncManager';
import { INITIAL_QUIZZES } from '../../data/seedData';

interface StudentQuizProps {
  student: Student;
  session: Session | null;
}

export const StudentQuiz: React.FC<StudentQuizProps> = ({ student, session }) => {
  const [showBonusCelebration, setShowBonusCelebration] = useState(false);
  const [bonusAddedAmount, setBonusAddedAmount] = useState<number>(0);
  const [localBonus, setLocalBonus] = useState(student?.quizBonus || 0);
  
  // Track quiz attempts locally (persisted to localStorage so it survives refresh during the same session)
  const [attemptedQuizzes, setAttemptedQuizzes] = useState<Record<number, 'correct' | 'incorrect'>>(() => {
    try {
      const stored = localStorage.getItem(`fc_quiz_attempts_${session?.sessionId}_${student?.studentId}`);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const currentQuizIndex = session?.currentQuizIndex || 0;
  const currentQuiz = INITIAL_QUIZZES[currentQuizIndex];
  const attemptStatus = attemptedQuizzes[currentQuizIndex]; // 'correct' | 'incorrect' | undefined

  // Sync props to local state
  useEffect(() => {
    setLocalBonus(student?.quizBonus || 0);
  }, [student?.quizBonus]);

  // Listen directly for BONUS_AWARDED events for 0-latency real-time feedback
  useEffect(() => {
    const unsubscribe = syncManager.subscribe((type, payload) => {
      if (type === 'BONUS_AWARDED' && payload) {
        const isMe =
          payload.studentId === student?.studentId ||
          (payload.name && payload.name === student?.name);
        if (isMe) {
          const amt = Number(payload.amount || 0);
          setLocalBonus((prev) => prev + amt);
          setBonusAddedAmount(amt);
          playCoinSound();
          setShowBonusCelebration(true);
          try {
            confetti({
              particleCount: 90,
              spread: 75,
              origin: { y: 0.55 },
              colors: ['#FFD32D', '#00B894', '#74B9FF', '#FF7675'],
            });
          } catch {}
          setTimeout(() => setShowBonusCelebration(false), 4500);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [student?.studentId, student?.name]);

  const handleOptionSelect = async (selectedIndex: number) => {
    if (attemptStatus) return; // Already attempted this question

    const isCorrect = selectedIndex === currentQuiz.answerIndex;
    const newStatus = isCorrect ? 'correct' : 'incorrect';

    // Update local attempt state
    const newAttemptedQuizzes = { ...attemptedQuizzes, [currentQuizIndex]: newStatus };
    setAttemptedQuizzes(newAttemptedQuizzes);
    try {
      localStorage.setItem(`fc_quiz_attempts_${session?.sessionId}_${student?.studentId}`, JSON.stringify(newAttemptedQuizzes));
    } catch {}

    if (isCorrect && session?.sessionId && student?.studentId) {
      // Correct answer! Request 100,000 won bonus
      await syncManager.studentGiveBonus(session.sessionId, student.studentId, 100000);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Student Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-3xl border-4 border-black shadow-[4px_4px_0px_0px_#000]">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#FFD32D] border-2 border-black flex items-center justify-center font-black text-base shadow-[2px_2px_0px_0px_#000]">
            🎓
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-base text-[#2D3436]">{student?.name}</span>
              <PixelBadge variant="gold">{student?.studentNum}</PixelBadge>
            </div>
            <span className="text-xs text-[#636E72] font-bold">
              {student?.selectedJob?.title
                ? `${student.selectedJob.title} • 월급 ${(student.selectedJob.monthlySalary || 0).toLocaleString()}원`
                : '금융캠프 참가자'}
            </span>
          </div>
        </div>

        <PixelBadge variant="green" className="animate-pulse">
          💡 1단계: 금융 상식 퀴즈 진행 중
        </PixelBadge>
      </div>

      {/* Main Student Balance & Focus Card */}
      <PixelCard className="bg-white border-4 border-black p-6 sm:p-8 rounded-3xl shadow-[8px_8px_0px_0px_#000] space-y-6 text-center">
        {/* Large Bonus Balance Display */}
        <div className="bg-[#FFFBEB] p-6 rounded-3xl border-3 border-black shadow-[4px_4px_0px_0px_#000] space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-xs font-black text-[#636E72] uppercase tracking-wider">
            <Award size={16} className="text-[#F59E0B]" />
            <span>내 퀴즈 누적 보너스 상금</span>
          </div>
          
          <div className="text-3xl sm:text-4xl font-black font-mono text-[#00B894] tracking-tight">
            +{localBonus.toLocaleString()}원
          </div>

          <p className="text-xs text-[#636E72] font-bold pt-1">
            획득한 퀴즈 보너스는 다음 단계(통장 배분)에서 월급과 함께 투자 원금으로 합산됩니다!
          </p>
        </div>

        {/* Real-time Quiz Section */}
        {currentQuiz && (
          <div className="bg-[#F8F9FA] p-5 sm:p-6 rounded-2xl border-2 border-black shadow-[3px_3px_0px_0px_#000] text-left space-y-4">
            <div className="flex items-center gap-2 font-black text-sm text-[#2D3436] mb-2">
              <div className="p-1.5 bg-[#74B9FF] text-[#1A1A1A] border-2 border-black rounded-xl shadow-[1px_1px_0px_0px_#000]">
                <Presentation size={18} />
              </div>
              <span>현재 퀴즈 (Q{currentQuiz.id})</span>
            </div>

            <div className="bg-white border-2 border-black p-4 rounded-xl shadow-[2px_2px_0px_0px_#000]">
              <p className="font-bold text-[#2D3436] text-[15px] leading-relaxed break-keep">
                {currentQuiz.question}
              </p>
            </div>

            {attemptStatus ? (
              <div className={`p-4 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] flex items-center justify-center gap-2 font-black text-lg ${attemptStatus === 'correct' ? 'bg-[#EBFBF7] text-[#00B894]' : 'bg-[#FFF0F0] text-[#FF7675]'}`}>
                {attemptStatus === 'correct' ? (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    <span>정답입니다! (+10만원)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-6 h-6" />
                    <span>아쉽게도 오답입니다. (다음 문제를 기다려주세요)</span>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {currentQuiz.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleOptionSelect(idx)}
                    className="p-4 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] font-bold text-sm text-[#2D3436] hover:bg-[#F1F3F5] active:translate-y-[2px] active:shadow-none transition-all text-left"
                  >
                    <span className="inline-block w-6 h-6 text-center leading-6 bg-[#2D3436] text-white rounded-md mr-2">
                      {idx + 1}
                    </span>
                    {opt}
                  </button>
                ))}
              </div>
            )}
            
            <p className="text-[11px] text-[#636E72] font-bold text-center mt-2">
              * 기회는 단 1번뿐입니다. 신중하게 선택하세요!
            </p>
          </div>
        )}

      </PixelCard>

      {/* Bonus Award Celebration Popup Modal */}
      {showBonusCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <PixelCard className="bg-white border-4 border-black p-8 text-center max-w-sm w-full space-y-4 rounded-3xl shadow-[12px_12px_0px_0px_#000] text-[#2D3436]">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FFD32D] border-4 border-black text-[#1A1A1A] flex items-center justify-center text-3xl animate-bounce shadow-[4px_4px_0px_0px_#000]">
              💰
            </div>
            
            <h3 className="text-2xl font-black text-[#2D3436]">
              보너스 입금 완료!
            </h3>
            
            <p className="text-xs sm:text-sm text-[#636E72] font-bold">
              퀴즈 정답 보너스가 지급되었습니다!
            </p>

            {bonusAddedAmount > 0 && (
              <div className="text-xl font-black font-mono text-[#00B894] bg-[#EBFBF7] py-2 px-4 rounded-2xl border-2 border-black inline-block shadow-[2px_2px_0px_0px_#000]">
                +{bonusAddedAmount.toLocaleString()}원 입금!
              </div>
            )}

            <div className="text-lg font-mono font-black text-[#2D3436] bg-[#FFFBEB] py-3 rounded-2xl border-2 border-black shadow-[3px_3px_0px_0px_#000]">
              총 누적 보너스: +{localBonus.toLocaleString()}원
            </div>

            <PixelButton
              variant="gold"
              size="md"
              className="w-full mt-2"
              onClick={() => setShowBonusCelebration(false)}
            >
              확인 완료!
            </PixelButton>
          </PixelCard>
        </div>
      )}
    </div>
  );
};
