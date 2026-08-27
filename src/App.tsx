import React, { useState, useEffect } from 'react';
import { Session, Student, AppView } from './types';
import { Header } from './components/Header';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TeacherLogin } from './components/TeacherView/TeacherLogin';
import { TeacherDashboard } from './components/TeacherView/TeacherDashboard';
import { TeacherQuiz } from './components/TeacherView/TeacherQuiz';
import { TeacherBudget } from './components/TeacherView/TeacherBudget';
import { TeacherStock } from './components/TeacherView/TeacherStock';
import { TeacherReport } from './components/TeacherView/TeacherReport';
import { StudentLogin } from './components/StudentView/StudentLogin';
import { StudentLobby } from './components/StudentView/StudentLobby';
import { StudentQuiz } from './components/StudentView/StudentQuiz';
import { StudentBudget } from './components/StudentView/StudentBudget';
import { StudentStock } from './components/StudentView/StudentStock';
import { StudentReport } from './components/StudentView/StudentReport';
import { PixelButton, PixelCard, PixelBadge } from './components/PixelUI';
import { playSelectSound } from './utils/soundEffects';
import { GraduationCap, Gamepad2, Sparkles, School, ShieldCheck } from 'lucide-react';
import { syncManager } from './utils/syncManager';
import { supabaseDb } from './utils/supabaseClient';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('landing');
  const [teacherToken, setTeacherToken] = useState<string>(() => {
    return localStorage.getItem('fc_teacher_token') || '';
  });
  const [session, setSession] = useState<Session | null>(null);
  const [student, setStudent] = useState<Student | null>(() => {
    try {
      const saved = localStorage.getItem('fc_student');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [sessionId, setSessionId] = useState<string>(() => {
    return localStorage.getItem('fc_session_id') || '';
  });

  // Restore saved teacher or student session metadata without forcing view change
  useEffect(() => {
    if (teacherToken) {
      fetch(`/api/teacher/auth/validate?token=${teacherToken}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.ok && data.activeSession) {
            setSession(data.activeSession);
            setSessionId(data.activeSession.sessionId);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Poll active session state
  const pollSession = async () => {
    if (!sessionId) return;
    try {
      const data = await syncManager.pollSessionState(sessionId, student?.studentId);
      if (data && data.ok && data.session) {
        setSession(data.session);

        // If student is logged in, sync student state and follow module
        if (student) {
          const updatedStudentData = data.myStudent || data.student;
          if (updatedStudentData && updatedStudentData.studentId === student.studentId) {
            setStudent((prev) => {
              if (prev && prev.studentId !== updatedStudentData.studentId) return prev;
              const updated = { ...(prev || student), ...updatedStudentData };
              if (data.myAsset) {
                if (data.myAsset.cash !== undefined) updated.cash = data.myAsset.cash;
                if (data.myAsset.totalStockValuation !== undefined) updated.stockValuation = data.myAsset.totalStockValuation;
                if (data.myAsset.totalAsset !== undefined) updated.totalAsset = data.myAsset.totalAsset;
              }
              localStorage.setItem('fc_student', JSON.stringify(updated));
              return updated;
            });
          }

          // If student is in a student view (other than login), route according to current session module
          if (currentView.startsWith('student-') && currentView !== 'student-login') {
            if (data.session.isCompleted) {
              if (currentView !== 'student-report') {
                setCurrentView('student-report');
              }
            } else {
              const targetModule = data.session.currentModule;
              const expectedView: AppView =
                targetModule === 'lobby'
                  ? 'student-lobby'
                  : targetModule === 'quiz'
                  ? 'student-quiz'
                  : targetModule === 'budget'
                  ? 'student-budget'
                  : targetModule === 'stock'
                  ? 'student-stock'
                  : 'student-report';

              // If the student has already entered student-stock (because they finished budget early),
              // and the session module is 'budget', DO NOT downgrade them back to 'student-budget'
              if (currentView === 'student-stock' && targetModule === 'budget') {
                // Keep student in student-stock
              } else if (currentView !== expectedView) {
                setCurrentView(expectedView);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Session poll error:', e);
    }
  };

  useEffect(() => {
    pollSession();
    const interval = setInterval(pollSession, 2500);

    // Instant real-time listener for module changes, quiz index sync, and bonus awards
    const unsubscribe = syncManager.subscribe((type, payload) => {
      if (type === 'MODULE_CHANGED' && payload && payload.sessionId?.toUpperCase() === sessionId?.toUpperCase()) {
        const targetModule = payload.currentModule;
        // CRITICAL: Only redirect if current user is actively on a student screen
        if (currentView.startsWith('student-') && currentView !== 'student-login') {
          const expectedView: AppView =
            targetModule === 'lobby'
              ? 'student-lobby'
              : targetModule === 'quiz'
              ? 'student-quiz'
              : targetModule === 'budget'
              ? 'student-budget'
              : targetModule === 'stock'
              ? 'student-stock'
              : 'student-report';

          if (currentView === 'student-stock' && targetModule === 'budget') {
            return;
          }
          setCurrentView(expectedView);
        }
      }
      if (type === 'QUIZ_INDEX_CHANGED' && payload && payload.sessionId?.toUpperCase() === sessionId?.toUpperCase()) {
        setSession((prev) => (prev ? { ...prev, currentQuizIndex: payload.quizIndex } : prev));
      }
      if (type === 'BONUS_AWARDED' && payload && payload.sessionId?.toUpperCase() === sessionId?.toUpperCase()) {
        if (
          student &&
          (payload.studentId === student.studentId ||
            (payload.name && payload.name === student.name))
        ) {
          setStudent((prev) => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              quizBonus: (prev.quizBonus || 0) + Number(payload.amount || 0),
              cash: (prev.cash || 0) + Number(payload.amount || 0),
            };
            localStorage.setItem('fc_student', JSON.stringify(updated));
            return updated;
          });
        }
      }
    });

    // Supabase Cloud Realtime Channel Subscription
    let unsubSb = () => {};
    if (sessionId && supabaseDb.isReady()) {
      unsubSb = supabaseDb.subscribeToSession(
        sessionId,
        (updatedSession) => {
          setSession(updatedSession);
          // CRITICAL: Only redirect if current user is actively on a student screen
          if (currentView.startsWith('student-') && currentView !== 'student-login') {
            if (updatedSession.isCompleted) {
              setCurrentView('student-report');
            } else {
              const targetMod = updatedSession.currentModule;
              const expected: AppView =
                targetMod === 'lobby'
                  ? 'student-lobby'
                  : targetMod === 'quiz'
                  ? 'student-quiz'
                  : targetMod === 'budget'
                  ? 'student-budget'
                  : targetMod === 'stock'
                  ? 'student-stock'
                  : 'student-report';

              if (currentView === 'student-stock' && targetMod === 'budget') {
                return;
              }
              setCurrentView(expected);
            }
          }
        },
        (updatedStudent) => {
          if (student && updatedStudent.studentId === student.studentId) {
            setStudent((prev) => ({ ...(prev || student), ...updatedStudent }));
          }
        },
        (updatedAsset) => {
          if (student && updatedAsset.studentId === student.studentId) {
            setStudent((prev) => {
              if (!prev) return prev;
              const updated = {
                ...prev,
                cash: updatedAsset.cash,
                stockValuation: updatedAsset.totalStockValuation,
                totalAsset: updatedAsset.totalAsset,
              };
              localStorage.setItem('fc_student', JSON.stringify(updated));
              return updated;
            });
          }
        }
      );
    }

    return () => {
      clearInterval(interval);
      unsubscribe();
      unsubSb();
    };
  }, [sessionId, student?.studentId, currentView]);

  // Handlers for Teacher
  const handleTeacherLoginSuccess = (token: string, sess?: Session | null) => {
    setTeacherToken(token);
    localStorage.setItem('fc_teacher_token', token);

    // Strictly clear student state so teacher view is never contaminated
    localStorage.removeItem('fc_student');
    setStudent(null);

    if (sess) {
      setSession(sess);
      setSessionId(sess.sessionId);
      localStorage.setItem('fc_session_id', sess.sessionId);
      localStorage.setItem(`fc_session_${sess.sessionId.toUpperCase()}`, JSON.stringify(sess));
    } else if (!session) {
      // Create a fallback local session code (e.g. CAMP2026)
      const generatedCode = 'CAMP' + Math.floor(1000 + Math.random() * 9000);
      const newSess: Session = {
        sessionId: generatedCode,
        currentModule: 'lobby',
        stockRound: 1,
        stockState: 'waiting',
        currentQuizIndex: 0,
        isCompleted: false,
        activeNewsSlots: [],
        revealedNewsIds: [1, 2, 3],
        createdAt: Date.now(),
      };
      setSession(newSess);
      setSessionId(generatedCode);
      localStorage.setItem('fc_session_id', generatedCode);
      localStorage.setItem(`fc_session_${generatedCode.toUpperCase()}`, JSON.stringify(newSess));
    }
    setCurrentView('teacher-dashboard');
  };

  const handleTeacherLogout = () => {
    localStorage.removeItem('fc_teacher_token');
    localStorage.removeItem('fc_session_id');
    localStorage.removeItem('fc_student');
    setTeacherToken('');
    setSession(null);
    setStudent(null);
    setSessionId('');
    setCurrentView('landing');
  };

  // Handlers for Student
  const handleStudentLoginSuccess = (st: Student, sessId: string, freshSession?: Session | null) => {
    const cleanSession = sessId.toUpperCase();
    const activeSession: Session = freshSession || {
      sessionId: cleanSession,
      currentModule: 'lobby',
      stockRound: 1,
      stockState: 'waiting',
      currentQuizIndex: 0,
      isCompleted: false,
      activeNewsSlots: [],
      revealedNewsIds: [1, 2, 3],
      createdAt: Date.now(),
    };

    // Strictly clear teacher token so student is never in teacher mode
    localStorage.removeItem('fc_teacher_token');
    setTeacherToken('');

    setStudent(st);
    setSessionId(cleanSession);
    setSession(activeSession);
    localStorage.setItem('fc_session_id', cleanSession);
    localStorage.setItem('fc_student', JSON.stringify(st));
    localStorage.setItem(`fc_session_${cleanSession}`, JSON.stringify(activeSession));

    // Route to appropriate module based on fresh session (NOT stale state)
    if (activeSession.isCompleted) {
      setCurrentView('student-report');
    } else if (activeSession.currentModule === 'quiz') {
      setCurrentView('student-quiz');
    } else if (activeSession.currentModule === 'budget') {
      setCurrentView('student-budget');
    } else if (activeSession.currentModule === 'stock') {
      setCurrentView('student-stock');
    } else if (activeSession.currentModule === 'report') {
      setCurrentView('student-report');
    } else {
      setCurrentView('student-lobby');
    }
  };

  const handleStudentLogout = () => {
    localStorage.removeItem('fc_student');
    localStorage.removeItem('fc_session_id');
    setStudent(null);
    setSession(null);
    setSessionId('');
    setCurrentView('landing');
  };

  const isTeacherRole = currentView.startsWith('teacher-');
  const isStudentRole = currentView.startsWith('student-');

  return (
    <div className="min-h-screen bg-[#FFFBEB] text-[#2D3436] font-sans flex flex-col selection:bg-[#FFD32D] selection:text-[#1A1A1A]">
      {/* Universal Vibrant Header */}
      <Header
        currentView={currentView}
        session={session}
        student={isTeacherRole ? null : student}
        onNavigate={(view) => {
          playSelectSound();
          setCurrentView(view);
        }}
        onLogout={isTeacherRole ? handleTeacherLogout : isStudentRole ? handleStudentLogout : student ? handleStudentLogout : handleTeacherLogout}
      />

      {/* Main View Router */}
      <main className="flex-1 pb-16">
        <ErrorBoundary>
          {/* 1. Landing Screen (Role Selector) */}
          {currentView === 'landing' && (
          <div className="max-w-4xl mx-auto px-4 py-10 sm:py-14 space-y-8">
            {/* Hero Title */}
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border-2 border-black text-[#1A1A1A] text-xs font-black font-mono shadow-[3px_3px_0px_0px_#000]">
                <Sparkles size={14} className="text-[#FF7675]" />
                <span>2D RETRO FINANCIAL EDUCATION CAMP</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-black text-[#2D3436] tracking-tight leading-tight">
                금융교육 캠프 모의주식 웹앱
              </h1>

              <p className="text-sm sm:text-base text-[#636E72] max-w-2xl mx-auto leading-relaxed font-bold">
                상업고등학교 학생들을 위한 3단 실전 금융 시뮬레이션!
                <br className="hidden sm:inline" />
                <span className="text-[#D63031] font-black">1단계 금융 상식 퀴즈</span> ➔{' '}
                <span className="text-[#00B894] font-black">2단계 직업&통장 배분</span> ➔{' '}
                <span className="text-[#0984E3] font-black">3단계 5라운드 모의주식 투자</span>
              </p>
            </div>

            {/* Role Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Student Card */}
              <div
                onClick={() => {
                  playSelectSound();
                  setCurrentView('student-login');
                }}
                className="group p-8 rounded-3xl border-4 border-black bg-white hover:bg-[#F8F9FA] cursor-pointer transition-all duration-150 space-y-5 shadow-[8px_8px_0px_0px_#000] hover:shadow-[10px_10px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px]"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#74B9FF] border-4 border-black flex items-center justify-center text-3xl shadow-[3px_3px_0px_0px_#000] group-hover:scale-105 transition-transform">
                  <Gamepad2 className="text-[#1A1A1A] w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-black text-[#0984E3] uppercase tracking-wider">
                    STUDENT PLAYER
                  </span>
                  <h2 className="text-2xl font-black text-[#2D3436]">학생 입장하기</h2>
                  <p className="text-xs text-[#636E72] leading-relaxed font-bold">
                    선생님이 공유해주신 초대코드를 입력하고 퀴즈를 풀며 모의주식 시드머니를 모아 최고 수익률에 도전하세요!
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-2 text-[#0984E3] text-xs font-black">
                  <span>게임 플레이어 시작하기 ➔</span>
                </div>
              </div>

              {/* Teacher Card */}
              <div
                onClick={() => {
                  playSelectSound();
                  setCurrentView('teacher-login');
                }}
                className="group p-8 rounded-3xl border-4 border-black bg-white hover:bg-[#F8F9FA] cursor-pointer transition-all duration-150 space-y-5 shadow-[8px_8px_0px_0px_#000] hover:shadow-[10px_10px_0px_0px_#000] active:translate-x-[2px] active:translate-y-[2px]"
              >
                <div className="w-16 h-16 rounded-2xl bg-[#FFD32D] border-4 border-black flex items-center justify-center text-3xl shadow-[3px_3px_0px_0px_#000] group-hover:scale-105 transition-transform">
                  <GraduationCap className="text-[#1A1A1A] w-8 h-8" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs font-black text-[#D63031] uppercase tracking-wider">
                    INSTRUCTOR ADMIN
                  </span>
                  <h2 className="text-2xl font-black text-[#2D3436]">강사 관리자 로그인</h2>
                  <p className="text-xs text-[#636E72] leading-relaxed font-bold">
                    세션을 개설하고 학생 접속 현황 확인, 퀴즈 출제 및 정답 보너스 지급, 6라운드 주식 상장/마감을 실시간 제어합니다.
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-2 text-[#D63031] text-xs font-black">
                  <span>강사용 대시보드 열기 ➔</span>
                </div>
              </div>
            </div>

            {/* Feature Badges Footnote */}
            <div className="bg-white border-4 border-black rounded-2xl p-4 text-xs text-[#2D3436] font-bold flex flex-wrap items-center justify-around gap-4 text-center shadow-[4px_4px_0px_0px_#000]">
              <span className="flex items-center gap-1.5 text-[#2D3436]">
                <ShieldCheck size={16} className="text-[#00B894]" />
                <span>20인 실전 동시접속 최적화</span>
              </span>
              <span className="flex items-center gap-1.5 text-[#2D3436]">
                <span>⚡</span>
                <span>실시간 세션 동기화</span>
              </span>
              <span className="flex items-center gap-1.5 text-[#2D3436]">
                <span>🖼️</span>
                <span>Canvas 성적표 PNG 즉시 발급</span>
              </span>
            </div>
          </div>
        )}

        {/* 2. Teacher Views */}
        {currentView === 'teacher-login' && (
          <TeacherLogin onLoginSuccess={handleTeacherLoginSuccess} />
        )}

        {currentView === 'teacher-dashboard' && (
          <TeacherDashboard
            session={session}
            token={teacherToken}
            onStartModule={(mod) => {
              syncManager.updateSessionModule(sessionId, mod, teacherToken);
              if (mod === 'quiz') setCurrentView('teacher-quiz');
              else if (mod === 'budget') setCurrentView('teacher-budget');
              else if (mod === 'stock') setCurrentView('teacher-stock');
              else if (mod === 'report') setCurrentView('teacher-report');
              pollSession();
            }}
            onStartNewSession={async () => {
              const newCode = 'CAMP' + Math.floor(1000 + Math.random() * 9000);
              const newSess: Session = {
                sessionId: newCode,
                currentModule: 'lobby',
                stockRound: 1,
                stockState: 'waiting',
                currentQuizIndex: 0,
                isCompleted: false,
                activeNewsSlots: [],
                revealedNewsIds: [1, 2, 3],
                createdAt: Date.now(),
              };
              setSession(newSess);
              setSessionId(newCode);
              localStorage.setItem('fc_session_id', newCode);
              localStorage.setItem(`fc_session_${newCode}`, JSON.stringify(newSess));

              // Clean student data for fresh session
              localStorage.removeItem('fc_student');
              setStudent(null);

              // Save to Supabase Cloud Database immediately
              syncManager.saveSession(newSess);

              // Try Express start session
              try {
                fetch('/api/session/start', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-teacher-token': teacherToken },
                  body: JSON.stringify({ preferredCode: newCode, token: teacherToken }),
                }).catch(() => {});
              } catch {}

              // Try GAS start session
              const gasUrl = import.meta.env.VITE_GAS_API_URL;
              if (gasUrl && gasUrl.includes('script.google.com')) {
                try {
                  fetch(gasUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'createSession', teacherName: '선생님' }),
                  }).catch(() => {});
                } catch {}
              }

              syncManager.broadcast('SESSION_CREATED', { sessionId: newCode, session: newSess });
              pollSession();
            }}
            onInitDb={async () => {
              try {
                await fetch('/api/init-db', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'x-teacher-token': teacherToken },
                  body: JSON.stringify({ token: teacherToken }),
                });
              } catch {}
              pollSession();
            }}
            onSessionUpdated={() => pollSession()}
          />
        )}

        {currentView === 'teacher-quiz' && (
          <TeacherQuiz
            session={session}
            token={teacherToken}
            onBackToDashboard={() => setCurrentView('teacher-dashboard')}
            onGoToNextModule={() => {
              // Advance session to budget & broadcast to students
              syncManager.updateSessionModule(sessionId, 'budget', teacherToken);
              setCurrentView('teacher-budget');
              pollSession();
            }}
          />
        )}

        {currentView === 'teacher-budget' && (
          <TeacherBudget
            session={session}
            token={teacherToken}
            onBackToDashboard={() => setCurrentView('teacher-dashboard')}
            onGoToNextModule={() => {
              // Advance session to stock & broadcast to students
              syncManager.updateSessionModule(sessionId, 'stock', teacherToken);
              setCurrentView('teacher-stock');
              pollSession();
            }}
          />
        )}

        {currentView === 'teacher-stock' && (
          <TeacherStock
            session={session}
            token={teacherToken}
            onBackToDashboard={() => setCurrentView('teacher-dashboard')}
            onGoToReport={() => {
              syncManager.updateSessionModule(sessionId, 'report', teacherToken);
              setCurrentView('teacher-report');
              pollSession();
            }}
            onRefreshSession={() => pollSession()}
          />
        )}

        {currentView === 'teacher-report' && (
          <TeacherReport
            session={session}
            token={teacherToken}
            onBackToDashboard={() => setCurrentView('teacher-dashboard')}
          />
        )}

        {/* 3. Student Views */}
        {currentView === 'student-login' && (
          <StudentLogin
            initialSessionId={sessionId}
            onLoginSuccess={handleStudentLoginSuccess}
          />
        )}

        {currentView.startsWith('student-') && currentView !== 'student-login' && !student && (
          <StudentLogin
            initialSessionId={sessionId}
            onLoginSuccess={handleStudentLoginSuccess}
          />
        )}

        {currentView === 'student-lobby' && student && (
          <StudentLobby student={student} session={session} />
        )}

        {currentView === 'student-quiz' && student && (
          <StudentQuiz student={student} session={session} />
        )}

        {currentView === 'student-budget' && student && (
          <StudentBudget
            student={student}
            session={session}
            onBudgetSaved={(updatedSt) => {
              if (updatedSt) {
                setStudent(updatedSt);
                localStorage.setItem('fc_student', JSON.stringify(updatedSt));
              }
              pollSession();
            }}
            onGoToStock={(updatedSt) => {
              if (updatedSt) {
                setStudent(updatedSt);
                localStorage.setItem('fc_student', JSON.stringify(updatedSt));
              }
              setCurrentView('student-stock');
              pollSession();
            }}
          />
        )}

        {currentView === 'student-stock' && student && (
          <StudentStock
            student={student}
            session={session}
            onRefreshSession={() => pollSession()}
          />
        )}

        {currentView === 'student-report' && student && (
          <StudentReport student={student} session={session} />
        )}
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="border-t-4 border-black bg-white py-4 px-4 text-center text-xs text-[#636E72] font-mono font-bold shadow-[0_-4px_0px_0px_#000]">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <span>🎮 금융교육 캠프 모의주식 웹앱 • Commercial High School EdTech</span>
          <span>Designed with Vibrant Pop & Retro 2D Aesthetic</span>
        </div>
      </footer>
    </div>
  );
}
