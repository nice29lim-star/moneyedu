import React, { useState, useEffect } from 'react';
import {
  PieChart,
  LayoutDashboard,
  ArrowRight,
  CheckCircle2,
  Clock,
  Briefcase,
  TrendingUp,
  DollarSign,
} from 'lucide-react';
import { Session } from '../../types';
import { PixelBadge, PixelButton, PixelCard } from '../PixelUI';
import { playSelectSound } from '../../utils/soundEffects';
import { syncManager } from '../../utils/syncManager';

interface TeacherBudgetProps {
  session: Session | null;
  token: string;
  onBackToDashboard: () => void;
  onGoToNextModule: () => void;
}

export const TeacherBudget: React.FC<TeacherBudgetProps> = ({
  session,
  token,
  onBackToDashboard,
  onGoToNextModule,
}) => {
  const [students, setStudents] = useState<any[]>([]);

  const fetchStudents = async () => {
    if (!session?.sessionId) return;
    try {
      const list = await syncManager.fetchStudents(session.sessionId, token);
      if (Array.isArray(list)) {
        setStudents(list);
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
        (type === 'STUDENT_JOINED' || type === 'BUDGET_SAVED' || type === 'BONUS_AWARDED') &&
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

  const completedCount = students.filter((s) => !!s.budget).length;

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
              <span>💰 2단계: 직업 선택 & 통장 배분 현황</span>
              <PixelBadge variant="green">
                배분 완료 {completedCount} / {students.length}명
              </PixelBadge>
            </h2>
            <p className="text-xs text-[#636E72] font-bold">
              학생들이 개별 스마트폰/PC 화면에서 직업(6종)을 고르고 월급명세서 확인 후 통장을 100% 배분하고 있습니다.
            </p>
          </div>
        </div>

        <PixelButton
          variant="gold"
          size="sm"
          onClick={() => {
            playSelectSound();
            onGoToNextModule();
          }}
        >
          <span className="flex items-center gap-1.5">
            <span>3단계 모의주식으로 이동</span>
            <ArrowRight size={14} />
          </span>
        </PixelButton>
      </div>

      {/* Guidance Info Card */}
      <PixelCard className="bg-[#FFFBEB] border-4 border-black rounded-3xl p-5 text-xs text-[#2D3436] font-bold shadow-[6px_6px_0px_0px_#000]">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-2xl bg-[#FFD32D] border-2 border-black text-[#1A1A1A] shadow-[2px_2px_0px_0px_#000] shrink-0">
            <PieChart size={20} />
          </div>
          <div className="space-y-1.5">
            <h4 className="font-black text-sm text-[#2D3436]">
              통장 배분(4개의 통장 원리) 교육 안내
            </h4>
            <p className="text-[#636E72] font-bold leading-relaxed">
              1. 직업별 기본급에서 4대 보험(국민연금, 건강보험, 장기요양, 고용보험) 및 소득세가 자동 공제되어 실수령액이 계산됩니다.
            </p>
            <p className="text-[#636E72] font-bold leading-relaxed">
              2. 1단계 퀴즈에서 획득한 보너스가 실수령액에 가산되어 총 가용자산이 됩니다.
            </p>
            <p className="text-[#636E72] font-bold leading-relaxed">
              3. 학생이 설정한 <span className="text-[#D63031] font-black">[투자 비율 %]</span>에 해당하는 금액이 3단계 모의주식의 초기 투자 시드머니로 자동 이전됩니다.
            </p>
          </div>
        </div>
      </PixelCard>

      {/* Student Allocation Real-time Board */}
      <PixelCard className="bg-white border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_#000] text-[#2D3436]">
        <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
          <h3 className="font-black text-lg text-[#2D3436] flex items-center gap-2">
            <div className="p-1.5 bg-[#55E6C1] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
              <Briefcase className="text-[#1A1A1A]" size={18} />
            </div>
            <span>학생별 배분 현황 실시간 모니터링</span>
          </h3>
          <div className="flex items-center gap-2 text-xs text-[#636E72] font-mono font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00B894] border border-black animate-pulse" />
            <span>실시간 자동 수신</span>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-12 text-[#636E72] font-bold">접속한 학생이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {students.map((st) => {
              const b = st.budget;
              const isDone = !!b;
              return (
                <div
                  key={st.studentId}
                  className={`p-4 rounded-2xl border-2 border-black transition-all shadow-[3px_3px_0px_0px_#000] ${
                    isDone
                      ? 'bg-[#EBFBF7]'
                      : 'bg-[#F8F9FA]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-black text-sm text-[#2D3436] flex items-center gap-1.5">
                      <span>{st.name}</span>
                      <span className="text-xs text-[#636E72] font-mono font-bold">({st.studentNum})</span>
                    </div>
                    {isDone ? (
                      <span className="flex items-center gap-1 text-[11px] font-black text-[#00B894] bg-white px-2 py-0.5 rounded-lg border border-black shadow-[1px_1px_0px_0px_#000]">
                        <CheckCircle2 size={12} />
                        <span>배분 완료</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] font-black text-[#D63031] bg-white px-2 py-0.5 rounded-lg border border-black shadow-[1px_1px_0px_0px_#000] animate-pulse">
                        <Clock size={12} />
                        <span>선택 진행 중</span>
                      </span>
                    )}
                  </div>

                  <div className="text-xs space-y-1.5 pt-1 font-mono text-[#2D3436]">
                    <div className="flex justify-between">
                      <span className="text-[#636E72] font-sans font-bold">선택 직업:</span>
                      <span className="font-black text-[#2D3436]">{st.jobTitle || '미선택'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#636E72] font-sans font-bold">퀴즈 보너스:</span>
                      <span className="text-[#00B894] font-black">+{(st.quizBonus || 0).toLocaleString()}원</span>
                    </div>

                    {b ? (
                      <>
                        <div className="flex justify-between text-[#2D3436] pt-1.5 border-t-2 border-black font-black">
                          <span className="text-[#636E72] font-sans font-bold">총 가용자금:</span>
                          <span>{(b.totalAvailable || 0).toLocaleString()}원</span>
                        </div>
                        <div className="pt-2 space-y-1">
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-[#D63031]">생활비 ({b.livingPercent || 0}%):</span>
                            <span>{(b.livingAmount || 0).toLocaleString()}원</span>
                          </div>
                          <div className="flex justify-between text-[11px] font-bold">
                            <span className="text-[#0984E3]">저축 ({b.savingsPercent || 0}%):</span>
                            <span>{(b.savingsAmount || 0).toLocaleString()}원</span>
                          </div>
                          <div className="flex justify-between text-[11px] font-black text-[#00B894]">
                            <span>모의주식 투자 ({b.investPercent || 0}%):</span>
                            <span>{(b.investAmount || 0).toLocaleString()}원</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4 text-xs text-[#636E72] font-sans font-bold">
                        학생이 슬라이더를 조정하고 있습니다...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PixelCard>
    </div>
  );
};
