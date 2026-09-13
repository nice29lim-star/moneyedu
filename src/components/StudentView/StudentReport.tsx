import React, { useState, useEffect } from 'react';
import { syncManager } from '../../utils/syncManager';
import { supabaseDb } from '../../utils/supabaseClient';
import {
  Trophy,
  Download,
  Award,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Briefcase,
  Layers,
  History,
  Share2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { FinalReport, Session, Student } from '../../types';
import { PixelBadge, PixelButton, PixelCard } from '../PixelUI';
import { exportReportToCanvasImage, generateReportCanvas } from '../../utils/canvasReportExporter';
import { playSuccessSound } from '../../utils/soundEffects';

interface StudentReportProps {
  student: Student;
  session: Session | null;
}

export const StudentReport: React.FC<StudentReportProps> = ({ student, session }) => {
  const [report, setReport] = useState<FinalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (report) {
      setTimeout(() => {
        try {
          const canvas = generateReportCanvas(report);
          if (canvas) setPreviewUrl(canvas.toDataURL('image/png'));
        } catch (e) {
          console.error('Preview generation failed', e);
        }
      }, 100);
    }
  }, [report]);

  useEffect(() => {
    if (!session?.sessionId) return;
    const fetchReport = async () => {
      try {
        const students = await syncManager.fetchStudents(session.sessionId, 'dummy');
        const calculated = students.map((st: any) => {
          const seed = st.initialInvestment ?? 0;
          const finalAsset = st.totalAsset || st.cash || seed;
          const diff = finalAsset - seed;
          const profitRate = seed > 0 ? (diff / seed) * 100 : 0;
          return { ...st, finalTotalAsset: finalAsset, profitRate, diff, seed };
        });
        calculated.sort((a, b) => b.finalTotalAsset - a.finalTotalAsset);
        const myRank = calculated.findIndex((s) => s.studentId === student.studentId) + 1;
        const myData = calculated.find((s) => s.studentId === student.studentId);
        
        if (myData) {
          const sbTrades = await supabaseDb.getTrades(session.sessionId, student.studentId);
          const reportObj: any = {
            studentId: myData.studentId,
            studentName: myData.name,
            name: myData.name,
            studentNum: myData.studentNum,
            jobTitle: myData.jobTitle || '참가자',
            quizBonus: myData.quizBonus || 0,
            initialInvestment: myData.seed,
            finalCash: myData.cash || 0,
            finalStockValuation: myData.stockValuation || 0,
            finalTotalAsset: myData.finalTotalAsset,
            totalProfit: myData.diff,
            profitRate: myData.profitRate,
            rank: myRank,
            totalStudents: students.length,
            holdings: myData.holdings || [],
            trades: sbTrades || [],
            investorType: {
              title: myData.profitRate >= 10 ? '스마트 성장형 투자자' : '안정 균형형 투자자',
              badge: myData.profitRate >= 10 ? '🚀 공격적 성장 추구' : '🛡️ 안정적 자산 배분',
              description: myData.profitRate >= 10
                  ? '시장의 기회를 적극적으로 포착하여 높은 성과를 이뤄냈습니다.'
                  : '위험을 관리하며 꾸준하고 건전한 투자를 지향했습니다.',
              tips: '앞으로도 분산투자와 복리의 힘을 활용하여 장기적인 금융 자산을 형성해 보세요.',
            },
            gradeLevel: myData.profitRate >= 15 ? 'A' : myData.profitRate >= 5 ? 'B' : myData.profitRate >= -5 ? 'C' : 'D',
            feedback: myData.profitRate >= 15
                ? '탁월한 통찰력과 분산 투자로 최고의 성과를 거두었습니다!'
                : myData.profitRate >= 0
                ? '안정적인 자산 배분으로 플러스 수익을 달성했습니다.'
                : '시장 변동성 속에서 귀중한 실전 경험을 쌓았습니다.',
          };
          
          setReport(reportObj);
          playSuccessSound();
          if (reportObj.profitRate >= 0) {
            try {
              confetti({
                particleCount: 100,
                spread: 80,
                origin: { y: 0.5 },
                colors: ['#F59E0B', '#38BDF8', '#10B981', '#F43F5E'],
              });
            } catch (e) {}
          }
        } else {
          setReport(generateFallbackReport());
        }
      } catch (err) {
        console.error(err);
        setReport(generateFallbackReport());
      } finally {
        setLoading(false);
      }
    };
    
    fetchReport();
  }, [session?.sessionId, student.studentId]);

  const generateFallbackReport = (): FinalReport => {
    const initSeed = student?.initialInvestment ?? 0;
    const finalCash = student?.cash || initSeed;
    const finalStockValuation = student?.stockValuation || 0;
    const finalAsset = student?.totalAsset || (finalCash + finalStockValuation);
    const diff = finalAsset - initSeed;
    const profitRate = initSeed > 0 ? (diff / initSeed) * 100 : 0;

    let trades: any[] = [];
    try {
      const cleanSession = session?.sessionId?.toUpperCase() || student?.sessionId?.toUpperCase() || '';
      const tradesStr = localStorage.getItem(`fc_trades_${cleanSession}`);
      if (tradesStr) {
        const allTrades = JSON.parse(tradesStr);
        trades = allTrades.filter((t: any) => t.studentId === student?.studentId);
      }
    } catch {}

    return {
      studentId: student?.studentId || '',
      studentName: student?.name || '',
      name: student?.name || '',
      studentNum: student?.studentNum || '',
      jobTitle: student?.selectedJob?.title || '소프트웨어 개발자',
      selectedJob: student?.selectedJob || {
        id: 1,
        title: '소프트웨어 개발자',
        category: 'IT/핀테크',
        monthlySalary: 3500000,
        description: '빅데이터 및 금융 플랫폼 개발',
        icon: '💻',
        color: '#3B82F6',
      },
      budget: student?.budget || {
        sessionId: student?.sessionId || session?.sessionId || '',
        studentId: student?.studentId || '',
        jobId: 1,
        jobTitle: '소프트웨어 개발자',
        grossSalary: 3500000,
        netSalary: 2800000,
        quizBonus: student?.quizBonus || 0,
        totalAvailable: 2800000 + (student?.quizBonus || 0),
        livingPercent: 40,
        savingsPercent: 30,
        investPercent: 30,
        livingAmount: 1100000,
        savingsAmount: 850000,
        investAmount: 850000,
        savedAt: Date.now(),
      },
      quizBonus: student?.quizBonus || 0,
      initialInvestment: initSeed,
      finalCash: finalCash,
      finalStockValuation: finalStockValuation,
      finalTotalAsset: finalAsset,
      totalProfit: diff,
      profitRate: profitRate,
      rank: 1,
      totalStudents: 1,
      holdings: [],
      trades: trades,
      investorType: {
        title: '스마트 밸류에이션 투자자',
        badge: '균형형',
        description: '철저한 정보 분석과 분산 투자를 통해 안정적인 자산 증식을 달성했습니다.',
        tips: '시장 변동성에 흔들리지 않고 원칙을 지키는 투자가 장기적인 복리 효과를 가져옵니다.',
      },
    };
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-[#636E72] space-y-3 font-bold">
        <div className="w-10 h-10 border-4 border-[#FFD32D] border-t-black rounded-full animate-spin mx-auto" />
        <p className="text-sm font-black text-[#2D3436]">최종 성적표를 집계하고 분석 중입니다...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-[#636E72] font-black">
        성적표 데이터를 불러올 수 없습니다.
      </div>
    );
  }

  const isProfit = report.profitRate >= 0;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner */}
      <div className="text-center space-y-2">
        <PixelBadge variant="gold">FINANCIAL EDUCATION CAMP CERTIFICATE</PixelBadge>
        <h2 className="text-2xl sm:text-3xl font-black text-[#2D3436]">
          🎉 금융교육 캠프 수료 & 개인 투자 성적표
        </h2>
        <p className="text-xs sm:text-sm text-[#636E72] font-bold">
          3단 활동(퀴즈, 통장배분, 6라운드 모의주식)을 훌륭하게 완주하셨습니다!
        </p>
      </div>

      {/* Hero Certificate Card */}
      <PixelCard className="bg-white border-4 border-black rounded-3xl p-6 sm:p-8 space-y-6 shadow-[8px_8px_0px_0px_#000] text-[#2D3436]">
        {/* Certificate Header */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b-2 border-black text-center sm:text-left">
          <div>
            <span className="text-xs text-[#D63031] font-mono font-black tracking-widest uppercase">
              상업고등학교 금융교육 캠프
            </span>
            <h3 className="text-2xl font-black text-[#2D3436] mt-1">
              {report.studentName}{' '}
              <span className="text-[#0984E3] font-mono text-base font-black">({report.studentNum})</span>
            </h3>
            <div className="text-xs text-[#636E72] font-bold mt-0.5">
              직업: <span className="text-[#2D3436] font-black">{report.jobTitle}</span>
            </div>
          </div>

          {/* Rank Badge */}
          <div className="bg-[#FFD32D] border-2 border-black rounded-2xl p-4 text-center min-w-[140px] shadow-[4px_4px_0px_0px_#000]">
            <span className="text-xs text-[#1A1A1A] font-black block">학급 최종 순위</span>
            <div className="text-3xl font-black text-[#1A1A1A] font-mono">
              {report.rank}위
              <span className="text-xs text-[#636E72] font-bold ml-1">
                / {report.totalStudents}명
              </span>
            </div>
          </div>
        </div>

        {/* Investor Type Persona Box */}
        <div className="bg-[#FFFBEB] p-5 rounded-2xl border-2 border-black space-y-2 shadow-[3px_3px_0px_0px_#000]">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🧬</span>
            <div>
              <span className="text-[11px] font-black text-[#636E72] uppercase tracking-wider">
                AI 투자 성향 분석 결과
              </span>
              <h4 className="text-lg font-black text-[#D63031]">
                [{report.investorType.badge}] {report.investorType.title}
              </h4>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-[#2D3436] font-bold leading-relaxed pt-1">
            {report.investorType.description}
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="bg-[#F8F9FA] p-3.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span className="text-[11px] text-[#636E72] block font-black">1단계 퀴즈 보너스</span>
            <div className="text-sm sm:text-base font-black font-mono text-[#00B894] mt-1">
              +{report.quizBonus.toLocaleString()}원
            </div>
          </div>

          <div className="bg-[#F8F9FA] p-3.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span className="text-[11px] text-[#636E72] block font-black">초기 투자 원금</span>
            <div className="text-sm sm:text-base font-black font-mono text-[#2D3436] mt-1">
              {report.initialInvestment.toLocaleString()}원
            </div>
          </div>

          <div className="bg-[#F8F9FA] p-3.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span className="text-[11px] text-[#636E72] block font-black">최종 자산 총액</span>
            <div className="text-sm sm:text-base font-black font-mono text-[#2D3436] mt-1">
              {report.finalTotalAsset.toLocaleString()}원
            </div>
          </div>

          <div className="bg-[#F8F9FA] p-3.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
            <span className="text-[11px] text-[#636E72] block font-black">최종 투자 수익률</span>
            <div
              className={`text-sm sm:text-base font-black font-mono mt-1 ${
                isProfit ? 'text-[#D63031]' : 'text-[#0984E3]'
              }`}
            >
              {isProfit ? '+' : ''}{report.profitRate.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* 6 Rounds Trade Timeline */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-black text-[#2D3436]">
            <History size={14} className="text-[#0984E3]" />
            <span>6라운드 모의투자 매매 여정 기록</span>
          </div>

          <div className="bg-[#F8F9FA] rounded-2xl p-3 border-2 border-black divide-y border-black/10 max-h-40 overflow-y-auto">
            {(!report.trades || report.trades.length === 0) && (!report.tradeHistory || report.tradeHistory.length === 0) ? (
              <div className="text-center py-4 text-xs text-[#636E72] font-bold">
                체결된 매매 기록이 없습니다. (보유 현금 유지)
              </div>
            ) : (
              (report.trades || report.tradeHistory || []).map((t, idx) => (
                <div
                  key={idx}
                  className="py-2 flex items-center justify-between text-xs font-mono"
                >
                  <div className="flex items-center gap-2 font-sans">
                    <span className="text-[#D63031] font-black font-mono">
                      R{t.round}
                    </span>
                    <span
                      className={`font-black px-1.5 py-0.5 rounded-lg border border-black text-[10px] ${
                        t.tradeType === 'BUY'
                          ? 'bg-[#FFF0F0] text-[#D63031]'
                          : 'bg-[#EBF7FF] text-[#0984E3]'
                      }`}
                    >
                      {t.tradeType === 'BUY' ? '매수' : '매도'}
                    </span>
                    <span className="font-black text-[#2D3436]">{t.companyName}</span>
                    <span className="text-[#636E72] font-bold">({t.quantity}주)</span>
                  </div>

                  <div className="text-right">
                    <span className="text-[#636E72] font-mono">
                      @{t.price.toLocaleString()}원
                    </span>
                    <span className="ml-2 font-black text-[#2D3436]">
                      = {t.totalAmount.toLocaleString()}원
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Report Preview */}
        {previewUrl && (
          <div className="mt-4 border-2 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_#000]">
            <div className="bg-[#1E293B] text-white text-center py-2 text-xs font-bold border-b-2 border-black">
              성적표 및 수료증 미리보기
            </div>
            <img src={previewUrl} alt="성적표 미리보기" className="w-full h-auto object-contain" />
          </div>
        )}

        {/* Final Download Button Action */}
        <div className="pt-4 border-t-2 border-black flex flex-col sm:flex-row gap-3">
          <PixelButton
            variant="gold"
            size="lg"
            className="flex-1"
            onClick={() => {
              playSuccessSound();
              exportReportToCanvasImage(report);
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <Download size={18} />
              <span>성적표 & 수료증 이미지로 저장 (PNG)</span>
            </span>
          </PixelButton>
        </div>
      </PixelCard>
    </div>
  );
};
