import React, { useState, useEffect } from 'react';
import { User, KeyRound, ArrowRight, Sparkles, Gamepad2, School, AlertCircle } from 'lucide-react';
import { Student, Session } from '../../types';
import { PixelBadge, PixelButton, PixelCard } from '../PixelUI';
import { playSelectSound, playSuccessSound, playBuzzerSound } from '../../utils/soundEffects';
import { syncManager } from '../../utils/syncManager';
import { supabaseDb, isSupabaseReady } from '../../utils/supabaseClient';

interface StudentLoginProps {
  initialSessionId?: string;
  onLoginSuccess: (student: Student, sessionId: string, freshSession?: Session | null) => void;
}

export const StudentLogin: React.FC<StudentLoginProps> = ({
  initialSessionId = '',
  onLoginSuccess,
}) => {
  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem('last_sessionId') || localStorage.getItem('fc_session_id') || initialSessionId;
    return saved || '1001';
  });
  const [name, setName] = useState('');
  const [studentNum, setStudentNum] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedSession = localStorage.getItem('last_sessionId') || localStorage.getItem('fc_session_id');
    const savedName = localStorage.getItem('last_studentName');
    const savedNum = localStorage.getItem('last_studentNum');
    if (savedSession) setSessionId(savedSession);
    if (savedName) setName(savedName);
    if (savedNum) setStudentNum(savedNum);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSession = (sessionId || '').trim().toUpperCase();
    const cleanName = (name || '').trim();
    const cleanNum = (studentNum || '').trim();

    if (!cleanSession || !cleanName || !cleanNum) {
      setError('세션 코드, 이름, 학번을 모두 정확히 입력해주세요.');
      return;
    }

    setLoading(true);
    setError('');

    const localStudentId = `${cleanName}_${cleanNum}`;

    try {
      let loggedStudent: Student | null = null;
      let targetSession: Session | null = null;
      let existingAsset: any = null;

      // 1. Check if session exists in Supabase (or local fallback)
      if (isSupabaseReady()) {
        try {
          const sbSession = await supabaseDb.getSession(cleanSession);
          if (sbSession) {
            targetSession = sbSession;
          } else {
            const localSess = syncManager.getSession(cleanSession);
            if (localSess && localSess.sessionId.toUpperCase() === cleanSession) {
              targetSession = localSess;
            } else {
              // Create local session fallback if matching code
              targetSession = {
                sessionId: cleanSession,
                currentModule: 'lobby',
                stockRound: 0,
                stockState: 'waiting',
                currentQuizIndex: 0,
                isCompleted: false,
                activeNewsSlots: [],
                revealedNewsIds: [1, 2, 3],
                createdAt: Date.now(),
              };
              syncManager.saveSession(targetSession);
            }
          }

          // Check if student already exists
          const [existingSbStudent, sbAsset] = await Promise.all([
            supabaseDb.getStudent(cleanSession, localStudentId),
            supabaseDb.getStudentAsset(cleanSession, localStudentId),
          ]);

          if (existingSbStudent) {
            loggedStudent = existingSbStudent;
          }
          if (sbAsset) {
            existingAsset = sbAsset;
            if (loggedStudent) {
              loggedStudent.cash = sbAsset.cash;
              loggedStudent.initialInvestment = sbAsset.initialInvestment;
              if (sbAsset.holdings) {
                loggedStudent.holdings = Array.isArray(sbAsset.holdings)
                  ? sbAsset.holdings
                  : Object.values(sbAsset.holdings);
              }
            }
          }
        } catch (sbErr: any) {
          console.error('Supabase query error:', sbErr);
        }
      }

      // 2. Check local storage fallback
      if (!loggedStudent) {
        const localStudents = syncManager.getLocalStudents(cleanSession);
        const match = localStudents.find(
          (s) => s.studentId === localStudentId || (s.name === cleanName && s.studentNum === cleanNum)
        );
        if (match) {
          loggedStudent = match;
        }
      }

      // 3. Initialize new student if not exists
      if (!loggedStudent) {
        loggedStudent = {
          sessionId: cleanSession,
          studentId: localStudentId,
          name: cleanName,
          studentNum: cleanNum,
          quizBonus: 0,
          cash: 0,
          initialInvestment: 0,
          loginTime: Date.now(),
        };
      }

      // Register / update student record
      if (isSupabaseReady()) {
        try {
          await supabaseDb.upsertStudent(loggedStudent);
          if (!existingAsset) {
            await supabaseDb.upsertStudentAsset({
              sessionId: cleanSession,
              studentId: localStudentId,
              studentName: cleanName,
              cash: loggedStudent.cash ?? 0,
              initialInvestment: loggedStudent.initialInvestment ?? 0,
              holdings: {},
              totalStockValuation: 0,
              totalAsset: loggedStudent.cash ?? 0,
              profitAmount: 0,
              profitRate: 0,
              tradedThisRound: false,
            });
          }
        } catch (err) {
          console.error('Supabase register error:', err);
        }
      }

      // Also register to local sync manager
      syncManager.saveStudentLocally(cleanSession, loggedStudent);

      // Notify express server
      try {
        await fetch('/api/student/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: cleanSession,
            name: cleanName,
            studentNum: cleanNum,
          }),
        });
      } catch {}

      // Save credentials for next visit
      localStorage.setItem('last_sessionId', cleanSession);
      localStorage.setItem('last_studentName', cleanName);
      localStorage.setItem('last_studentNum', cleanNum);
      localStorage.setItem('fc_session_id', cleanSession);
      localStorage.setItem('fc_student', JSON.stringify(loggedStudent));

      playSuccessSound();
      onLoginSuccess(loggedStudent, cleanSession, targetSession);
    } catch (err: any) {
      console.error(err);
      setError('입장 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const fillSampleStudent = (sampleName: string, sampleNum: string) => {
    playSelectSound();
    setName(sampleName);
    setStudentNum(sampleNum);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <PixelCard className="w-full max-w-md p-6 sm:p-8 bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_#000] text-[#2D3436]">
        {/* Top Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 bg-[#74B9FF] border-4 border-black rounded-2xl flex items-center justify-center text-3xl shadow-[3px_3px_0px_0px_#000]">
            <Gamepad2 className="text-[#1A1A1A] w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-[#2D3436] tracking-wider">
            학생 캠프 입장
          </h2>
          <p className="text-xs text-[#636E72] mt-1 font-bold">
            강사님이 안내한 세션 코드와 본인 정보를 입력하세요.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-black text-[#2D3436] uppercase flex items-center gap-1">
                <KeyRound size={14} className="text-[#D63031]" />
                <span>세션 코드 (강사님이 개설한 번호)</span>
              </label>
              <span className="text-[10px] text-[#636E72] font-bold">
                예: 1001, 7777
              </span>
            </div>
            <input
              id="input-student-session"
              type="text"
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value.toUpperCase())}
              placeholder="예: 1001"
              className="w-full bg-white border-3 border-black focus:border-[#74B9FF] rounded-xl px-4 py-2.5 text-lg text-[#2D3436] font-mono font-black tracking-wider uppercase outline-none shadow-[2px_2px_0px_0px_#000] transition-all"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black text-[#2D3436] uppercase mb-1 flex items-center gap-1">
                <User size={14} className="text-[#0984E3]" />
                <span>학생 이름</span>
              </label>
              <input
                id="input-student-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 홍길동"
                className="w-full bg-white border-2 border-black focus:border-[#74B9FF] rounded-xl px-3 py-2.5 text-sm text-[#2D3436] font-bold outline-none shadow-[2px_2px_0px_0px_#000]"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-[#2D3436] uppercase mb-1 flex items-center gap-1">
                <School size={14} className="text-[#00B894]" />
                <span>학번</span>
              </label>
              <input
                id="input-student-num"
                type="text"
                value={studentNum}
                onChange={(e) => setStudentNum(e.target.value)}
                placeholder="예: 20101"
                className="w-full bg-white border-2 border-black focus:border-[#74B9FF] rounded-xl px-3 py-2.5 text-sm text-[#2D3436] font-mono font-bold outline-none shadow-[2px_2px_0px_0px_#000]"
              />
            </div>
          </div>

          {error && (
            <div className="bg-[#FFEAEA] border-2 border-[#FF7675] text-[#D63031] text-xs p-3 rounded-xl font-black shadow-[2px_2px_0px_0px_#000] flex items-start gap-1.5">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Demo Fillers */}
          <div className="pt-1">
            <span className="text-[11px] text-[#636E72] block mb-1.5 font-bold flex items-center gap-1">
              <Sparkles size={12} className="text-[#D63031]" />
              <span>빠른 테스트용 샘플 학생 선택:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { name: '김민준', num: '10101' },
                { name: '이지은', num: '10102' },
                { name: '박서준', num: '10103' },
              ].map((s) => (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => fillSampleStudent(s.name, s.num)}
                  className="text-xs px-2.5 py-1 rounded-xl bg-white hover:bg-[#F1F2F6] text-[#2D3436] border-2 border-black font-mono font-bold shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all cursor-pointer"
                >
                  {s.name} ({s.num})
                </button>
              ))}
            </div>
          </div>

          <PixelButton
            id="btn-student-login-submit"
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            disabled={loading}
          >
            <span className="flex items-center justify-center gap-2">
              <span>{loading ? '캠프 입장 중...' : '게임 캠프 입장하기'}</span>
              <ArrowRight size={18} />
            </span>
          </PixelButton>
        </form>

        <div className="mt-5 pt-3 border-t-2 border-black text-center text-xs text-[#636E72] font-bold">
          💡 입장 후 강사님의 퀴즈 출제 및 모의주식 라운드 진행에 맞춰 참여할 수 있습니다.
        </div>
      </PixelCard>
    </div>
  );
};
