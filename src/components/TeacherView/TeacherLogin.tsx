import React, { useState } from 'react';
import { Shield, KeyRound, ArrowRight, Hash } from 'lucide-react';
import { PixelBadge, PixelButton, PixelCard } from '../PixelUI';
import { playSuccessSound, playBuzzerSound } from '../../utils/soundEffects';
import { isSupabaseReady, supabaseDb } from '../../utils/supabaseClient';
import { Session } from '../../types';

interface TeacherLoginProps {
  onLoginSuccess: (token: string, session?: Session | null) => void;
}

export const TeacherLogin: React.FC<TeacherLoginProps> = ({ onLoginSuccess }) => {
  const [password, setPassword] = useState('0000');
  const [sessionCode, setSessionCode] = useState(() => {
    const saved = localStorage.getItem('fc_session_id');
    return saved || '1001';
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedPw = (password || '').trim();
    const cleanSession = (sessionCode || '').trim().toUpperCase() || '1001';

    if (!trimmedPw) {
      setError('비밀번호를 입력해주세요. (기본 비밀번호: 0000)');
      return;
    }

    if (!cleanSession) {
      setError('세션 코드를 입력해주세요. (예: 1001, 7777)');
      return;
    }

    setLoading(true);
    setError('');

    // 1. Check Password
    if (trimmedPw !== '0000') {
      try {
        const res = await fetch('/api/teacher/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: trimmedPw }),
        });
        const data = await res.json();
        if (!data?.ok) {
          playBuzzerSound();
          setError('비밀번호가 일치하지 않습니다. (기본 비밀번호: 0000)');
          setLoading(false);
          return;
        }
      } catch {
        playBuzzerSound();
        setError('비밀번호가 일치하지 않습니다. (기본 비밀번호: 0000)');
        setLoading(false);
        return;
      }
    }

    const teacherToken = `TKN_${Date.now()}_admin`;
    sessionStorage.setItem('teacherToken', teacherToken);
    localStorage.setItem('fc_teacher_token', teacherToken);

    // 2. Initialize Session
    let targetSession: Session | null = null;

    if (isSupabaseReady()) {
      try {
        const existing = await supabaseDb.getSession(cleanSession);
        if (existing) {
          targetSession = existing;
        } else {
          const newSess: Session = {
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
          await supabaseDb.upsertSession(newSess);
          targetSession = newSess;
        }
      } catch (err: any) {
        console.error('Supabase error:', err);
      }
    }

    if (!targetSession) {
      targetSession = {
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
    }

    // Save session locally
    localStorage.setItem('fc_session_id', cleanSession);
    localStorage.setItem(`fc_session_${cleanSession}`, JSON.stringify(targetSession));

    // Notify backend
    try {
      await fetch('/api/session/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-teacher-token': teacherToken },
        body: JSON.stringify({ sessionId: cleanSession, token: teacherToken }),
      });
    } catch {}

    playSuccessSound();
    setTimeout(() => {
      onLoginSuccess(teacherToken, targetSession);
    }, 300);
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <PixelCard className="w-full max-w-md p-6 sm:p-8 bg-white border-4 border-black rounded-3xl shadow-[8px_8px_0px_0px_#000] text-[#2D3436]">
        {/* Top Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 bg-[#FFD32D] border-4 border-black rounded-2xl flex items-center justify-center text-3xl shadow-[3px_3px_0px_0px_#000]">
            <Shield className="text-[#1A1A1A] w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-[#2D3436] tracking-wider">
            강사 관리자 세션 개설
          </h2>
          <p className="text-xs text-[#636E72] mt-1 font-bold">
            수업에 사용할 세션 코드를 입력하고 캠프를 시작하세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Session Code Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black text-[#2D3436] uppercase flex items-center gap-1">
                <Hash size={14} className="text-[#0984E3]" />
                <span>세션 코드 지정 (예: 1001, 7777)</span>
              </label>
              <span className="text-[10px] text-[#636E72] font-bold">
                학생들이 입력할 번호
              </span>
            </div>

            <input
              id="input-teacher-session-code"
              type="text"
              value={sessionCode}
              onChange={(e) => setSessionCode(e.target.value.toUpperCase())}
              placeholder="세션 코드 입력 (예: 1001)..."
              className="w-full bg-white border-3 border-black focus:border-[#0984E3] rounded-xl px-4 py-3 text-lg font-mono font-black text-[#2D3436] tracking-wider outline-none shadow-[2px_2px_0px_0px_#000] transition-all uppercase"
            />
          </div>

          {/* Teacher Password */}
          <div>
            <label className="block text-xs font-black text-[#2D3436] uppercase mb-1.5 flex items-center gap-1">
              <KeyRound size={14} className="text-[#D63031]" />
              <span>강사 비밀번호 (기본값: 0000)</span>
            </label>
            <input
              id="input-teacher-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호 입력..."
              className="w-full bg-white border-2 border-black focus:border-[#FFD32D] rounded-xl px-4 py-2.5 text-base text-[#2D3436] font-mono tracking-widest outline-none shadow-[2px_2px_0px_0px_#000] transition-all"
            />
          </div>

          {error && (
            <div className="bg-[#FFEAEA] border-2 border-[#FF7675] text-[#D63031] text-xs p-3 rounded-xl font-bold shadow-[2px_2px_0px_0px_#000]">
              <span className="font-black">{error}</span>
            </div>
          )}

          <PixelButton
            id="btn-teacher-login-submit"
            type="submit"
            variant="gold"
            size="lg"
            className="w-full mt-3"
            disabled={loading}
          >
            <span className="flex items-center justify-center gap-2">
              <span>{loading ? '세션 준비 중...' : `세션 [${sessionCode || '1001'}] 시작하기`}</span>
              <ArrowRight size={18} />
            </span>
          </PixelButton>
        </form>

        <div className="mt-5 pt-3 border-t-2 border-black text-center text-xs text-[#636E72] font-bold">
          💡 개설된 세션 코드를 학생들에게 공유하여 같은 공간에서 실시간 참여를 진행합니다.
        </div>
      </PixelCard>
    </div>
  );
};
