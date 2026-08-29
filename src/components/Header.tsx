import React from 'react';
import { Volume2, VolumeX, Shield, User, Sparkles, LogOut, Home, Coins } from 'lucide-react';
import { AppRole, AppStateModule, AppView, Session, Student } from '../types';
import { isSoundEnabled, setSoundEnabled, playSelectSound } from '../utils/soundEffects';

interface HeaderProps {
  currentView?: AppView;
  session: Session | null;
  student?: Student | null;
  onNavigate?: (view: AppView) => void;
  onLogout?: () => void;
  currentRole?: AppRole;
  onRoleChange?: (role: AppRole) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView = 'landing',
  session,
  student,
  onNavigate,
  onLogout,
  currentRole,
  onRoleChange,
}) => {
  const [soundOn, setSoundOn] = React.useState(isSoundEnabled());

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
    if (next) playSelectSound();
  };

  const isLanding = currentView === 'landing';
  const isTeacherView = currentView.startsWith('teacher-');
  const isStudentView = currentView.startsWith('student-');
  const activeRole: AppRole = currentRole || (isTeacherView ? 'teacher' : isStudentView ? 'student' : 'student');
  const currentModule: AppStateModule = session?.currentModule || 'lobby';

  const moduleSteps: { key: AppStateModule; label: string; icon: string }[] = [
    { key: 'lobby', label: '대기실', icon: '⛺' },
    { key: 'quiz', label: '1단계 퀴즈', icon: '💡' },
    { key: 'budget', label: '2단계 통장배분', icon: '💰' },
    { key: 'stock', label: '3단계 모의주식', icon: '📈' },
    { key: 'report', label: '최종 리포트', icon: '🏆' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white border-b-4 border-black px-4 py-3 text-[#2D3436] shadow-[0_4px_0px_0px_#000]">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Brand & Session Code */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => {
              if (onNavigate) {
                playSelectSound();
                onNavigate('landing');
              }
            }}
            className="bg-[#FF7675] w-11 h-11 rounded-xl border-2 sm:border-4 border-black flex items-center justify-center text-white font-black text-xl shadow-[3px_3px_0px_0px_#000] shrink-0 cursor-pointer active:translate-x-[1px] active:translate-y-[1px] active:shadow-none"
            title="처음으로"
          >
            $
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1
                onClick={() => {
                  if (onNavigate) {
                    playSelectSound();
                    onNavigate('landing');
                  }
                }}
                className="text-base sm:text-lg font-black uppercase tracking-tight text-[#2D3436] leading-tight cursor-pointer hover:text-[#0984E3]"
              >
                금융교육 캠프 모의주식
              </h1>
            </div>
            <div className="text-xs font-bold text-[#636E72] flex items-center gap-1.5 flex-wrap">
              {isTeacherView ? (
                <span className="text-[#D63031] font-black bg-[#FFEAA7] px-2 py-0.5 rounded border border-black flex items-center gap-1">
                  <span>👨‍🏫</span>
                  <span>강사 관리자 모드</span>
                </span>
              ) : (student && !isLanding && currentView !== 'student-login') ? (
                <span>ID: <strong className="text-[#2D3436]">{student.name} ({student.studentNum})</strong></span>
              ) : (
                <span>상업계 고등학교 2D 레트로 금융교육 캠프</span>
              )}
              {session?.sessionId && !isLanding && currentView !== 'teacher-login' && currentView !== 'student-login' && (
                <>
                  <span className="text-slate-300">•</span>
                  <span>세션: <span className="text-[#D63031] font-black font-mono tracking-wide">#{session.sessionId}</span></span>
                </>
              )}
            </div>
          </div>

          {session?.stockRound && currentModule === 'stock' && !isLanding && (
            <div className="hidden sm:flex items-center gap-1.5 bg-[#1A1A1A] text-white px-3 py-1 rounded-full border-2 border-black text-xs font-black shadow-[2px_2px_0px_0px_#000]">
              <span className="w-2 h-2 rounded-full bg-[#55E6C1] animate-ping" />
              <span>ROUND 0{session.stockRound} / 05</span>
            </div>
          )}
        </div>

        {/* Center: Module Step Indicator (Only during active classroom modules) */}
        {!isLanding && currentView !== 'teacher-login' && currentView !== 'student-login' && (
          <div className="hidden md:flex items-center gap-1 bg-[#F1F2F6] p-1.5 rounded-2xl border-2 border-black text-xs shadow-[2px_2px_0px_0px_#000]">
            {moduleSteps.map((step) => {
              const isActive = currentModule === step.key;
              return (
                <div
                  key={step.key}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-black transition-all ${
                    isActive
                      ? 'bg-[#FFD32D] text-[#1A1A1A] border-2 border-black shadow-[2px_2px_0px_0px_#000] scale-105'
                      : 'text-[#636E72] hover:text-[#2D3436]'
                  }`}
                >
                  <span>{step.icon}</span>
                  <span>{step.label}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Right: Controls & Role Switcher */}
        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            id="btn-sound-toggle"
            type="button"
            onClick={toggleSound}
            className="p-2 rounded-xl border-2 border-black bg-white hover:bg-[#F1F2F6] text-[#2D3436] shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
            title={soundOn ? '효과음 끄기' : '효과음 켜기'}
          >
            {soundOn ? <Volume2 size={16} className="text-[#D63031]" /> : <VolumeX size={16} className="text-[#636E72]" />}
          </button>

          {/* Teacher Badge & Logout */}
          {isTeacherView && onLogout && (
            <div className="flex items-center gap-1.5 bg-[#FFD32D] border-2 border-black px-2.5 py-1 rounded-xl text-xs text-[#1A1A1A] font-black shadow-[2px_2px_0px_0px_#000]">
              <span>👨‍🏫 강사 관리자</span>
              <button
                type="button"
                onClick={() => {
                  playSelectSound();
                  onLogout();
                }}
                className="ml-1 text-[#2D3436] hover:text-[#D63031]"
                title="강사 로그아웃"
              >
                <LogOut size={12} />
              </button>
            </div>
          )}

          {/* Student Info / Logout & Balance Display */}
          {student && !isTeacherView && !isLanding && currentView !== 'student-login' && (
            <div className="flex items-center gap-1.5">
              {/* Cash Balance Display */}
              <div
                id="student-header-balance"
                className="hidden sm:flex items-center gap-1.5 bg-[#FFFBEB] border-2 border-black px-2.5 py-1 rounded-xl text-xs font-black text-[#2D3436] shadow-[2px_2px_0px_0px_#000]"
                title="현재 내 보유 잔액 (현금 / 투자 가용 잔액)"
              >
                <Coins size={13} className="text-[#F59E0B]" />
                <span className="text-[11px] text-[#636E72]">잔액:</span>
                <span className="text-[#D63031] font-mono font-black">
                  {(student.cash || 0).toLocaleString()}원
                </span>
                {(student?.quizBonus || 0) > 0 && (
                  <span className="text-[10px] text-[#00B894] font-mono font-black bg-[#EBFBF7] px-1 py-0.2 rounded border border-black">
                    (+{(student?.quizBonus || 0).toLocaleString()}원)
                  </span>
                )}
              </div>

              {/* Student Name Badge */}
              <div className="flex items-center gap-1.5 bg-[#55E6C1] border-2 border-black px-2.5 py-1 rounded-xl text-xs text-[#1A1A1A] font-black shadow-[2px_2px_0px_0px_#000]">
                <User size={13} />
                <span>{student.name}</span>
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      playSelectSound();
                      onLogout();
                    }}
                    className="ml-1 text-[#2D3436] hover:text-[#D63031]"
                    title="학생 로그아웃"
                  >
                    <LogOut size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Home / Role Switcher */}
          {currentView !== 'landing' && onNavigate && (
            <button
              type="button"
              onClick={() => {
                playSelectSound();
                onNavigate('landing');
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-[#F1F2F6] border-2 border-black rounded-xl text-xs font-black text-[#2D3436] shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none transition-all"
              title="메인으로 이동"
            >
              <Home size={13} />
              <span className="hidden sm:inline">메인</span>
            </button>
          )}

          {/* Role Switcher if onRoleChange provided */}
          {onRoleChange && (
            <div className="flex items-center p-1 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000] text-xs">
              <button
                id="role-btn-student"
                type="button"
                onClick={() => {
                  playSelectSound();
                  onRoleChange('student');
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg font-black transition-all ${
                  activeRole === 'student'
                    ? 'bg-[#74B9FF] text-[#1A1A1A] border-2 border-black shadow-[1px_1px_0px_0px_#000]'
                    : 'text-[#636E72] hover:text-[#2D3436]'
                }`}
              >
                <User size={12} />
                <span>학생</span>
              </button>
              <button
                id="role-btn-teacher"
                type="button"
                onClick={() => {
                  playSelectSound();
                  onRoleChange('teacher');
                }}
                className={`flex items-center gap-1 px-3 py-1 rounded-lg font-black transition-all ${
                  activeRole === 'teacher'
                    ? 'bg-[#FFD32D] text-[#1A1A1A] border-2 border-black shadow-[1px_1px_0px_0px_#000]'
                    : 'text-[#636E72] hover:text-[#2D3436]'
                }`}
              >
                <Shield size={12} />
                <span>강사</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
