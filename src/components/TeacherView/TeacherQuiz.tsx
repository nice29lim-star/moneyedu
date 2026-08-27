import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Award,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  LayoutDashboard,
  CheckCircle2,
  Users,
  Sparkles,
  Eye,
  EyeOff,
  Lightbulb,
} from 'lucide-react';
import { QuizItem, Session } from '../../types';
import { PixelBadge, PixelButton, PixelCard } from '../PixelUI';
import { playCoinSound, playSelectSound, playSuccessSound } from '../../utils/soundEffects';
import { syncManager } from '../../utils/syncManager';
import { INITIAL_QUIZZES } from '../../data/seedData';

interface TeacherQuizProps {
  session: Session | null;
  token: string;
  onBackToDashboard: () => void;
  onGoToNextModule: () => void;
}

export const TeacherQuiz: React.FC<TeacherQuizProps> = ({
  session,
  token,
  onBackToDashboard,
  onGoToNextModule,
}) => {
  const [quizzes, setQuizzes] = useState<QuizItem[]>(INITIAL_QUIZZES);
  const [currentIndex, setCurrentIndex] = useState(session?.currentQuizIndex ?? 0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [bonusAmount, setBonusAmount] = useState('100000');
  const [message, setMessage] = useState('');

  // Fetch quizzes from server if available, fallback to INITIAL_QUIZZES
  useEffect(() => {
    fetch('/api/quiz/list')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.quizzes) && data.quizzes.length > 0) {
          setQuizzes(data.quizzes);
        }
      })
      .catch(() => {});
  }, []);

  // Update currentIndex if session changes
  useEffect(() => {
    if (session && session.currentQuizIndex !== undefined) {
      setCurrentIndex(session.currentQuizIndex);
    }
  }, [session?.currentQuizIndex]);

  // Fetch students via multi-tier syncManager
  const fetchStudents = async () => {
    if (!session?.sessionId) return;
    try {
      const studentList = await syncManager.fetchStudents(session.sessionId, token);
      if (Array.isArray(studentList)) {
        setStudents(studentList);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStudents();
    const interval = setInterval(fetchStudents, 2500);

    const unsubscribe = syncManager.subscribe((type, payload) => {
      if (
        (type === 'STUDENT_JOINED' || type === 'BONUS_AWARDED' || type === 'BUDGET_SAVED') &&
        (!payload?.sessionId || payload.sessionId.toUpperCase() === session?.sessionId?.toUpperCase())
      ) {
        fetchStudents();
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [session?.sessionId, token]);

  const safeQuizzes = quizzes && quizzes.length > 0 ? quizzes : INITIAL_QUIZZES;
  const currentQuiz = safeQuizzes[currentIndex] || safeQuizzes[0];
  const safeOptions = Array.isArray(currentQuiz?.options) ? currentQuiz.options : [];

  // Sync quiz index with server and broadcast
  const syncQuizIndex = async (newIdx: number) => {
    if (!session?.sessionId) return;
    const clampedIdx = Math.max(0, Math.min(safeQuizzes.length - 1, newIdx));
    setCurrentIndex(clampedIdx);
    setShowAnswer(false); // Reset answer reveal on question change
    playSelectSound();

    // Broadcast instant sync to students
    syncManager.broadcast('QUIZ_INDEX_CHANGED', { sessionId: session.sessionId, quizIndex: clampedIdx });

    try {
      await fetch('/api/teacher/quiz/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
        body: JSON.stringify({
          sessionId: session.sessionId,
          quizIndex: clampedIdx,
          token,
        }),
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleGiveBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !session?.sessionId) return;

    const amt = Number(bonusAmount) || 0;
    try {
      const success = await syncManager.giveBonus(session.sessionId, selectedStudent.studentId, amt, token);
      if (success) {
        playCoinSound();
        setMessage(`${selectedStudent.name} 학생에게 +${amt.toLocaleString()}원 보너스 지급 완료!`);
        fetchStudents();
        setTimeout(() => {
          setSelectedStudent(null);
          setMessage('');
        }, 1200);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b-2 border-black">
        <div className="flex items-center gap-3">
          <PixelButton variant="secondary" size="sm" onClick={onBackToDashboard}>
            <span className="flex items-center gap-1">
              <LayoutDashboard size={14} />
              <span>대시보드로</span>
            </span>
          </PixelButton>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-[#2D3436] flex items-center gap-2">
              <span>💡 1단계: 금융 상식 퀴즈</span>
              <PixelBadge variant="gold">
                문제 {currentIndex + 1} / {safeQuizzes.length || 20}
              </PixelBadge>
            </h2>
            <p className="text-xs text-[#636E72] font-bold">
              문제를 읽고 학생의 구술 답변을 들은 뒤, 오른쪽 명단에서 정답자를 클릭하여 즉시 보너스를 지급하세요.
            </p>
          </div>
        </div>

        <PixelButton variant="gold" size="sm" onClick={onGoToNextModule}>
          <span className="flex items-center gap-1.5">
            <span>2단계 통장배분으로 이동</span>
            <ArrowRight size={14} />
          </span>
        </PixelButton>
      </div>

      {/* Main Grid: Left Question Box, Right Students Payout List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Question Card (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <PixelCard className="bg-white border-4 border-black rounded-3xl space-y-5 p-6 shadow-[8px_8px_0px_0px_#000] text-[#2D3436]">
            <div className="flex items-center justify-between">
              <PixelBadge variant="purple">{currentQuiz?.category || '금융 상식'}</PixelBadge>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => syncQuizIndex(currentIndex - 1)}
                  className="p-1.5 rounded-xl bg-white hover:bg-[#F8F9FA] disabled:opacity-30 text-[#2D3436] border-2 border-black shadow-[2px_2px_0px_0px_#000] transition-all"
                  title="이전 문제"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-xs font-mono px-2 text-[#2D3436] font-black">
                  {currentIndex + 1} / {safeQuizzes.length}
                </span>
                <button
                  type="button"
                  disabled={currentIndex >= safeQuizzes.length - 1}
                  onClick={() => syncQuizIndex(currentIndex + 1)}
                  className="p-1.5 rounded-xl bg-white hover:bg-[#F8F9FA] disabled:opacity-30 text-[#2D3436] border-2 border-black shadow-[2px_2px_0px_0px_#000] transition-all"
                  title="다음 문제"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* Question Text */}
            <div className="bg-[#FFFBEB] p-5 rounded-2xl border-2 border-black shadow-[3px_3px_0px_0px_#000]">
              <span className="text-xs font-black text-[#D63031] font-mono">Q{currentIndex + 1}.</span>
              <h3 className="text-lg sm:text-xl font-black text-[#2D3436] mt-1 leading-snug">
                {currentQuiz?.question || '문제를 준비 중입니다.'}
              </h3>
            </div>

            {/* 4 Choices */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {safeOptions.map((opt, optIdx) => {
                const isCorrect = optIdx === currentQuiz.answerIndex;
                const highlight = showAnswer && isCorrect;
                return (
                  <div
                    key={optIdx}
                    className={`p-3.5 rounded-2xl border-2 border-black transition-all ${
                      highlight
                        ? 'bg-[#EBFBF7] text-[#2D3436] shadow-[4px_4px_0px_0px_#000] ring-2 ring-[#00B894]'
                        : 'bg-[#F8F9FA] text-[#2D3436] shadow-[2px_2px_0px_0px_#000]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 border-2 border-black ${
                          highlight
                            ? 'bg-[#00B894] text-white'
                            : 'bg-white text-[#2D3436]'
                        }`}
                      >
                        {optIdx + 1}
                      </span>
                      <span className="text-sm font-black flex-1">{opt}</span>
                      {highlight && (
                        <span className="text-xs font-black text-[#00B894] bg-white px-2 py-0.5 rounded-lg border-2 border-black shadow-[1px_1px_0px_0px_#000]">
                          정답 ✓
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Teacher Answer Reveal Toggle Bar */}
            <div className="flex items-center justify-between p-3.5 bg-[#F1F2F6] rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-xl border-2 border-black ${showAnswer ? 'bg-[#00B894] text-white' : 'bg-white text-[#636E72]'}`}>
                  {showAnswer ? <Eye size={16} /> : <EyeOff size={16} />}
                </div>
                <span className="text-xs font-black text-[#2D3436]">
                  {showAnswer
                    ? '정답과 강사용 해설이 공개되었습니다.'
                    : '정답이 숨겨져 있습니다. 학생들의 구술 답변 후 공개하세요.'}
                </span>
              </div>
              <PixelButton
                variant={showAnswer ? 'secondary' : 'gold'}
                size="sm"
                onClick={() => {
                  playSelectSound();
                  setShowAnswer(!showAnswer);
                }}
              >
                <span className="flex items-center gap-1.5">
                  <Lightbulb size={14} />
                  <span>{showAnswer ? '정답 숨기기' : '정답 및 해설 공개'}</span>
                </span>
              </PixelButton>
            </div>

            {/* Teacher Explanation Box (revealed on button click) */}
            {showAnswer && (
              <div className="bg-[#FFFBEB] border-2 border-black rounded-2xl p-4 text-xs text-[#2D3436] font-bold leading-relaxed shadow-[2px_2px_0px_0px_#000] animate-in fade-in zoom-in duration-200">
                <div className="font-black text-[#D63031] flex items-center gap-1.5 mb-1.5">
                  <Sparkles size={14} />
                  <span>강사용 해설 및 지도 가이드</span>
                  <span className="ml-auto text-[11px] text-[#00B894] bg-white px-2 py-0.5 rounded-md border border-black font-black">
                    정답: {currentQuiz.answerIndex + 1}번 {safeOptions[currentQuiz.answerIndex]}
                  </span>
                </div>
                <p className="text-[13px] text-[#2D3436]">{currentQuiz?.explanation || '해설을 준비 중입니다.'}</p>
              </div>
            )}

            {/* Next Question Control */}
            <div className="flex justify-between items-center pt-2">
              <PixelButton
                variant="secondary"
                size="sm"
                disabled={currentIndex === 0}
                onClick={() => syncQuizIndex(currentIndex - 1)}
              >
                ◀ 이전 문제
              </PixelButton>

              <PixelButton
                variant="gold"
                size="md"
                disabled={currentIndex >= safeQuizzes.length - 1}
                onClick={() => syncQuizIndex(currentIndex + 1)}
              >
                <span>다음 문제 (학생 화면 동기화) ▶</span>
              </PixelButton>
            </div>
          </PixelCard>
        </div>

        {/* Right: Students Payout Board (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <PixelCard className="bg-white border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_#000] text-[#2D3436]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#FFD32D] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
                  <Users className="text-[#1A1A1A]" size={16} />
                </div>
                <h3 className="font-black text-base text-[#2D3436]">
                  정답자 보너스 즉시 지급 ({students.length}명)
                </h3>
              </div>
              <span className="text-[11px] text-[#D63031] font-black">이름 클릭 시 지급</span>
            </div>

            {students.length === 0 ? (
              <div className="text-center py-8 text-[#636E72] text-xs font-bold">
                접속한 학생이 없습니다.
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {students.map((st) => (
                  <div
                    key={st.studentId}
                    onClick={() => {
                      playSelectSound();
                      setSelectedStudent(st);
                    }}
                    className={`flex items-center justify-between p-3 rounded-2xl border-2 border-black cursor-pointer transition-all ${
                      selectedStudent?.studentId === st.studentId
                        ? 'bg-[#FFD32D] shadow-[4px_4px_0px_0px_#000]'
                        : 'bg-[#F8F9FA] hover:bg-[#FFFBEB] shadow-[2px_2px_0px_0px_#000]'
                    }`}
                  >
                    <div>
                      <div className="font-black text-sm text-[#2D3436] flex items-center gap-1.5">
                        <span>{st.name}</span>
                        <span className="text-xs text-[#636E72] font-mono font-bold">({st.studentNum})</span>
                      </div>
                      <div className="text-[11px] text-[#636E72] font-bold">
                        선택 직업: {st.jobTitle || '미선택'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-black text-[#00B894]">
                        +{(st.quizBonus || 0).toLocaleString()}원
                      </div>
                      <span className="inline-block mt-0.5 text-[10px] text-[#1A1A1A] font-black bg-[#FFD32D] px-2 py-0.5 rounded-lg border border-black shadow-[1px_1px_0px_0px_#000]">
                        보너스 지급 +
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </PixelCard>
        </div>
      </div>

      {/* Bonus Award Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <PixelCard className="w-full max-w-md bg-white border-4 border-black rounded-3xl p-6 shadow-[10px_10px_0px_0px_#000] text-[#2D3436]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#FFD32D] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
                  <Award className="text-[#1A1A1A]" size={18} />
                </div>
                <h3 className="font-black text-lg text-[#2D3436]">정답자 보너스 지급</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="text-[#636E72] hover:text-[#2D3436] text-lg font-black"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGiveBonus} className="space-y-4">
              <div className="bg-[#FFFBEB] p-3.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                <div className="text-xs text-[#636E72] font-bold">정답자 학생</div>
                <div className="text-lg font-black text-[#2D3436]">
                  {selectedStudent.name} ({selectedStudent.studentNum})
                </div>
                <div className="text-xs text-[#00B894] mt-1 font-mono font-black">
                  현재 누적 보너스: +{(selectedStudent.quizBonus || 0).toLocaleString()}원
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-[#2D3436] mb-1">
                  지급할 보너스 금액 (원)
                </label>
                <input
                  type="number"
                  step="10000"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(e.target.value)}
                  className="w-full bg-white border-2 border-black rounded-xl px-3 py-2 text-[#2D3436] font-mono text-lg font-black outline-none focus:bg-[#FFFBEB]"
                  autoFocus
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-4 gap-1.5">
                {[50000, 100000, 200000, 300000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      playSelectSound();
                      setBonusAmount(amt.toString());
                    }}
                    className={`py-1.5 rounded-xl border-2 border-black text-xs font-mono font-black transition-all ${
                      bonusAmount === amt.toString()
                        ? 'bg-[#FFD32D] text-[#1A1A1A] shadow-[2px_2px_0px_0px_#000]'
                        : 'bg-white text-[#636E72] hover:bg-[#F8F9FA]'
                    }`}
                  >
                    +{(amt / 10000).toFixed(0)}만
                  </button>
                ))}
              </div>

              {message && (
                <div className="bg-[#EBFBF7] border-2 border-black text-[#00B894] text-xs p-2.5 rounded-xl text-center font-black shadow-[2px_2px_0px_0px_#000]">
                  {message}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <PixelButton
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setSelectedStudent(null)}
                >
                  닫기
                </PixelButton>
                <PixelButton type="submit" variant="gold" className="flex-1">
                  즉시 저장 및 지급
                </PixelButton>
              </div>
            </form>
          </PixelCard>
        </div>
      )}
    </div>
  );
};

