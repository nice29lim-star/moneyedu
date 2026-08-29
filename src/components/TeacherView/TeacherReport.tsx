import React, { useState, useEffect } from 'react';
import {
  Award,
  Trophy,
  Medal,
  Download,
  LayoutDashboard,
  TrendingUp,
  Users,
  Sparkles,
  DollarSign,
} from 'lucide-react';
import { FinalReport, Session } from '../../types';
import { PixelBadge, PixelButton, PixelCard } from '../PixelUI';
import { exportReportToCanvasImage } from '../../utils/canvasReportExporter';
import { playSuccessSound } from '../../utils/soundEffects';
import { syncManager } from '../../utils/syncManager';

interface TeacherReportProps {
  session: Session | null;
  token: string;
  onBackToDashboard: () => void;
}

export const TeacherReport: React.FC<TeacherReportProps> = ({
  session,
  token,
  onBackToDashboard,
}) => {
  const [rankings, setRankings] = useState<FinalReport[]>([]);
  const [avgProfit, setAvgProfit] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.sessionId) return;

    const fetchRankings = async () => {
      try {
        const res = await fetch(`/api/teacher/rankings?sessionId=${session.sessionId}&token=${token}`, {
          headers: { 'x-teacher-token': token },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok && Array.isArray(data.rankings) && data.rankings.length > 0) {
            setRankings(data.rankings);
            setAvgProfit(data.averageProfitRate || 0);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }

      // Fallback: build rankings from student list
      try {
        const students = await syncManager.fetchStudents(session.sessionId, token);
        if (Array.isArray(students) && students.length > 0) {
          const calculated: FinalReport[] = students.map((st, idx) => {
            const seed = st.initialInvestment ?? 0;
            const finalAsset = st.totalAsset || st.cash || seed;
            const diff = finalAsset - seed;
            const profitRate = seed > 0 ? (diff / seed) * 100 : 0;
            return {
              studentId: st.studentId,
              studentName: st.name,
              name: st.name,
              studentNum: st.studentNum,
              jobTitle: st.jobTitle || '참가자',
              quizBonus: st.quizBonus || 0,
              initialInvestment: seed,
              finalCash: st.cash || 0,
              finalStockValuation: st.stockValuation || 0,
              finalTotalAsset: finalAsset,
              totalProfit: diff,
              profitRate,
              rank: idx + 1,
              totalStudents: students.length,
              holdings: [],
              trades: [],
              investorType: {
                title: profitRate >= 10 ? '스마트 성장형 투자자' : '안정 균형형 투자자',
                badge: profitRate >= 10 ? '🚀 공격적 성장 추구' : '🛡️ 안정적 자산 배분',
                description:
                  profitRate >= 10
                    ? '시장의 기회를 적극적으로 포착하여 높은 성과를 이뤄냈습니다.'
                    : '위험을 관리하며 꾸준하고 건전한 투자를 지향했습니다.',
                tips: '앞으로도 분산투자와 복리의 힘을 활용하여 장기적인 금융 자산을 형성해 보세요.',
              },
              gradeLevel: profitRate >= 15 ? 'A' : profitRate >= 5 ? 'B' : profitRate >= -5 ? 'C' : 'D',
              feedback:
                profitRate >= 15
                  ? '탁월한 통찰력과 분산 투자로 최고의 성과를 거두었습니다!'
                  : profitRate >= 0
                  ? '안정적인 자산 배분으로 플러스 수익을 달성했습니다.'
                  : '시장 변동성 속에서 귀중한 실전 경험을 쌓았습니다.',
            };
          });

          calculated.sort((a, b) => b.finalTotalAsset - a.finalTotalAsset);
          calculated.forEach((c, idx) => {
            c.rank = idx + 1;
          });

          const avg = calculated.reduce((sum, r) => sum + r.profitRate, 0) / calculated.length;
          setRankings(calculated);
          setAvgProfit(avg);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchRankings();
  }, [session?.sessionId]);

  const top1 = rankings[0];
  const top2 = rankings[1];
  const top3 = rankings[2];

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
              <span>🏆 최종 결과 리포트 & 투자 랭킹</span>
              <PixelBadge variant="gold">캠프 종료</PixelBadge>
            </h2>
            <p className="text-xs text-[#636E72] font-bold">
              금융 캠프 3단 활동(퀴즈, 통장배분, 6라운드 모의주식) 종합 성적과 투자 리포트입니다.
            </p>
          </div>
        </div>
      </div>

      {/* Class Statistics Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <PixelCard className="bg-white border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_#000] text-center">
          <span className="text-xs font-black text-[#636E72]">학급 평균 수익률</span>
          <div
            className={`text-3xl font-black font-mono mt-1 ${
              avgProfit >= 0 ? 'text-[#D63031]' : 'text-[#0984E3]'
            }`}
          >
            {avgProfit >= 0 ? '+' : ''}{avgProfit.toFixed(2)}%
          </div>
          <span className="text-[11px] text-[#636E72] font-bold">
            총 {rankings.length}명 학생 참여
          </span>
        </PixelCard>

        <PixelCard className="bg-[#FFF0F0] border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_#000] text-center">
          <span className="text-xs font-black text-[#D63031]">1위 최고 수익률</span>
          <div className="text-3xl font-black font-mono text-[#D63031] mt-1">
            {top1 ? `${top1.profitRate >= 0 ? '+' : ''}${top1.profitRate.toFixed(2)}%` : '-'}
          </div>
          <span className="text-[11px] text-[#2D3436] font-black">
            {top1 ? `${top1.studentName} (${top1.studentNum})` : '집계중'}
          </span>
        </PixelCard>

        <PixelCard className="bg-[#EBF7FF] border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_#000] text-center">
          <span className="text-xs font-black text-[#0984E3]">개인별 성적표 발급</span>
          <div className="text-3xl font-black text-[#2D3436] mt-1">
            {rankings.length}건
          </div>
          <span className="text-[11px] text-[#636E72] font-bold">
            수료증 및 이미지 저장 지원
          </span>
        </PixelCard>
      </div>

      {/* Top 3 Podium Cards */}
      {rankings.length > 0 && (
        <PixelCard className="bg-white border-4 border-black rounded-3xl p-6 shadow-[8px_8px_0px_0px_#000] text-[#2D3436]">
          <div className="text-center mb-6">
            <PixelBadge variant="gold">HONOR OF HALL</PixelBadge>
            <h3 className="text-2xl font-black text-[#2D3436] mt-1 flex items-center justify-center gap-2">
              <Trophy size={24} className="text-[#FFD32D]" />
              <span>금융 캠프 명예의 전당 (Top 3)</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            {/* 2nd Place */}
            {top2 && (
              <div className="order-2 md:order-1 p-4 rounded-2xl border-2 border-black bg-[#F8F9FA] text-center space-y-2 shadow-[4px_4px_0px_0px_#000]">
                <div className="w-10 h-10 mx-auto rounded-full bg-[#DFE6E9] text-[#2D3436] font-black flex items-center justify-center text-lg border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                  🥈 2
                </div>
                <h4 className="font-black text-base text-[#2D3436]">
                  {top2.studentName}
                </h4>
                <div className="text-xs text-[#636E72] font-mono font-bold">
                  {top2.jobTitle} ({top2.studentNum})
                </div>
                <div
                  className={`text-xl font-black font-mono ${
                    top2.profitRate >= 0 ? 'text-[#D63031]' : 'text-[#0984E3]'
                  }`}
                >
                  {top2.profitRate >= 0 ? '+' : ''}{top2.profitRate.toFixed(2)}%
                </div>
                <div className="text-xs text-[#636E72] font-black">
                  [{top2.investorType.badge}]
                </div>
              </div>
            )}

            {/* 1st Place Champion */}
            {top1 && (
              <div className="order-1 md:order-2 p-6 rounded-3xl border-4 border-black bg-[#FFD32D] text-center space-y-2.5 shadow-[6px_6px_0px_0px_#000]">
                <div className="w-14 h-14 mx-auto rounded-full bg-white text-[#1A1A1A] font-black flex items-center justify-center text-2xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                  👑 1
                </div>
                <h4 className="font-black text-xl text-[#2D3436]">
                  {top1.studentName}
                </h4>
                <div className="text-xs text-[#2D3436] font-mono font-black">
                  {top1.jobTitle} ({top1.studentNum})
                </div>
                <div
                  className={`text-3xl font-black font-mono ${
                    top1.profitRate >= 0 ? 'text-[#D63031]' : 'text-[#0984E3]'
                  }`}
                >
                  {top1.profitRate >= 0 ? '+' : ''}{top1.profitRate.toFixed(2)}%
                </div>
                <div className="text-sm font-black text-[#2D3436]">
                  [{top1.investorType.badge}] {top1.investorType.title}
                </div>
                <PixelButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    playSuccessSound();
                    exportReportToCanvasImage(top1);
                  }}
                >
                  <span className="flex items-center gap-1">
                    <Download size={13} />
                    <span>1위 성적표 저장</span>
                  </span>
                </PixelButton>
              </div>
            )}

            {/* 3rd Place */}
            {top3 && (
              <div className="order-3 p-4 rounded-2xl border-2 border-black bg-[#FFFBEB] text-center space-y-2 shadow-[4px_4px_0px_0px_#000]">
                <div className="w-10 h-10 mx-auto rounded-full bg-[#FFEAA7] text-[#2D3436] font-black flex items-center justify-center text-lg border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                  🥉 3
                </div>
                <h4 className="font-black text-base text-[#2D3436]">
                  {top3.studentName}
                </h4>
                <div className="text-xs text-[#636E72] font-mono font-bold">
                  {top3.jobTitle} ({top3.studentNum})
                </div>
                <div
                  className={`text-xl font-black font-mono ${
                    top3.profitRate >= 0 ? 'text-[#D63031]' : 'text-[#0984E3]'
                  }`}
                >
                  {top3.profitRate >= 0 ? '+' : ''}{top3.profitRate.toFixed(2)}%
                </div>
                <div className="text-xs text-[#636E72] font-black">
                  [{top3.investorType.badge}]
                </div>
              </div>
            )}
          </div>
        </PixelCard>
      )}

      {/* Complete Student Rankings Table */}
      <PixelCard className="bg-white border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_#000] text-[#2D3436]">
        <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
          <h3 className="font-black text-lg text-[#2D3436] flex items-center gap-2">
            <div className="p-1.5 bg-[#FF6B6B] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
              <Users className="text-white" size={18} />
            </div>
            <span>전체 학생 최종 순위표</span>
          </h3>
          <span className="text-xs text-[#636E72] font-bold">
            총 {rankings.length}명
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-black text-[#2D3436] font-mono uppercase bg-[#FFFBEB]">
                <th className="py-2.5 px-3 font-black">순위</th>
                <th className="py-2.5 px-3 font-black">이름 / 학번</th>
                <th className="py-2.5 px-3 font-black">직업</th>
                <th className="py-2.5 px-3 font-black">초기 투자금</th>
                <th className="py-2.5 px-3 font-black">최종 자산</th>
                <th className="py-2.5 px-3 font-black">수익률 (ROI)</th>
                <th className="py-2.5 px-3 font-black">투자 성향 유형</th>
                <th className="py-2.5 px-3 text-center font-black">성적표 다운로드</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black/10 font-mono">
              {rankings.map((r, idx) => {
                const isPositive = r.profitRate >= 0;
                return (
                  <tr key={r.studentId} className="hover:bg-[#FFFBEB]/50 transition-colors">
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-black text-xs border border-black shadow-[1px_1px_0px_0px_#000] ${
                          idx === 0
                            ? 'bg-[#FFD32D] text-[#1A1A1A]'
                            : idx === 1
                            ? 'bg-[#DFE6E9] text-[#2D3436]'
                            : idx === 2
                            ? 'bg-[#FFEAA7] text-[#2D3436]'
                            : 'bg-[#F8F9FA] text-[#636E72]'
                        }`}
                      >
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <div className="font-black text-[#2D3436]">
                        {r.studentName}
                        <span className="text-[#636E72] text-xs ml-1 font-mono font-bold">
                          ({r.studentNum})
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-sans text-[#636E72] font-bold">
                      {r.jobTitle}
                    </td>
                    <td className="py-3 px-3 text-[#636E72] font-bold">
                      {r.initialInvestment.toLocaleString()}원
                    </td>
                    <td className="py-3 px-3 text-[#2D3436] font-black">
                      {r.finalTotalAsset.toLocaleString()}원
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-black px-2 py-0.5 rounded-lg text-xs border border-black ${
                          isPositive
                            ? 'bg-[#FFF0F0] text-[#D63031]'
                            : 'bg-[#EBF7FF] text-[#0984E3]'
                        }`}
                      >
                        {isPositive ? '+' : ''}{r.profitRate.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-3 font-sans">
                      <span className="text-[#2D3436] text-xs font-black">
                        {r.investorType.badge}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          playSuccessSound();
                          exportReportToCanvasImage(r);
                        }}
                        className="p-1.5 rounded-xl bg-white hover:bg-[#FFFBEB] text-[#2D3436] border-2 border-black text-xs font-black inline-flex items-center gap-1 shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                        title="수료증 / 성적표 이미지 다운로드"
                      >
                        <Download size={13} />
                        <span>PNG 저장</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PixelCard>
    </div>
  );
};
