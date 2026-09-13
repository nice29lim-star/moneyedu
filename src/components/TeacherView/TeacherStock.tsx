import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Award,
  X,
  Activity,
  Newspaper,
  Send,
  CheckCircle,
  Gift
} from 'lucide-react';
import { Company, NewsItem, Session, Student } from '../../types';
import { PixelBadge, PixelButton, PixelCard } from '../PixelUI';
import {
  playCoinSound,
  playFlipSound,
  playSelectSound,
  playSuccessSound,
} from '../../utils/soundEffects';
import { CompanyChart } from '../CompanyChart';
import { syncManager } from '../../utils/syncManager';

interface TeacherStockProps {
  session: Session | null;
  token: string;
  onBackToDashboard: () => void;
  onGoToReport: () => void;
  onRefreshSession: () => void;
}

export const TeacherStock: React.FC<TeacherStockProps> = ({
  session,
  token,
  onBackToDashboard,
  onGoToReport,
  onRefreshSession,
}) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [revealedNews, setRevealedNews] = useState<NewsItem[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedNewsDetail, setSelectedNewsDetail] = useState<NewsItem | null>(null);

  const currentRound = session?.stockRound || 0;

  const fetchStockData = async () => {
    if (!session?.sessionId) return;
    try {
      const pollRes = await fetch(`/api/session/poll?sessionId=${session.sessionId}`);
      const pollData = await pollRes.json();
      if (pollData.ok) {
        setCompanies(pollData.companies || syncManager.getCompanies(session.sessionId));
        setRevealedNews(pollData.revealedNews || []);
      } else {
        setCompanies(syncManager.getCompanies(session.sessionId));
      }

      const studentList = await syncManager.fetchStudents(session.sessionId, token);
      if (Array.isArray(studentList)) {
        setStudents(studentList);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStockData();

    const interval = setInterval(fetchStockData, 2500);

    const unsubscribe = syncManager.subscribe((type, payload) => {
      if (!payload?.sessionId || payload.sessionId.toUpperCase() === session?.sessionId?.toUpperCase()) {
        if (
          type === 'STOCK_STATE_CHANGED' ||
          type === 'SESSION_UPDATED' ||
          type === 'TRADE_EXECUTED' ||
          type === 'STUDENT_JOINED'
        ) {
          fetchStockData();
          onRefreshSession();
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [session?.sessionId, token]);

  const handleNextNews = async () => {
    if (!session?.sessionId) return;
    setLoading(true);
    try {
      playSuccessSound();
      const res = await fetch('/api/teacher/stock/next-news', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      const result = await res.json();
      if (result.ok) {
        setStatusMessage(result.message);
        onRefreshSession();
        fetchStockData();
      } else {
        setStatusMessage(result.message || '뉴스 갱신에 실패했습니다.');
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage(`오류 발생: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleEndStock = async () => {
    if (!session?.sessionId) return;
    if (!confirm('정말 모의주식을 종료하시겠습니까? 학생들의 거래가 중지되고 리포트로 이동합니다.')) return;
    setLoading(true);
    try {
      playCoinSound();
      const res = await fetch('/api/teacher/stock/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: session.sessionId }),
      });
      const result = await res.json();
      if (result.ok) {
        setStatusMessage(result.message);
        onRefreshSession();
        fetchStockData();
        setTimeout(() => {
          onGoToReport();
        }, 1500);
      } else {
        setStatusMessage(result.message || '종료에 실패했습니다.');
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage(`오류 발생: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGiveBonus = async (studentId: string, name: string) => {
    if (!session?.sessionId) return;
    const amountStr = prompt(`${name} 학생에게 지급할 보너스(투자금) 금액을 입력하세요. (단위: 원)`);
    if (!amountStr) return;
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount <= 0) {
      alert('올바른 금액을 입력해주세요.');
      return;
    }

    try {
      playCoinSound();
      const res = await fetch('/api/teacher/give-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
        body: JSON.stringify({ sessionId: session.sessionId, studentId, amount, token }),
      });
      const data = await res.json();
      if (data.ok) {
        setStatusMessage(`${name} 학생에게 ${amount.toLocaleString()}원의 투자금이 지급되었습니다.`);
        fetchStockData();
      } else {
        alert(data.message || '보너스 지급 실패');
      }
    } catch (e: any) {
      console.error(e);
      alert('오류가 발생했습니다.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
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
              <span>📈 3단계: 모의주식 시뮬레이션</span>
              <PixelBadge variant={currentRound === 0 ? 'gold' : 'blue'}>
                {currentRound === 0 ? '준비 중' : `${currentRound} / 10회차 뉴스`}
              </PixelBadge>
            </h2>
            <p className="text-xs text-[#636E72] font-bold">
              학생들은 현재 자유롭게 거래소에서 매매를 진행 중입니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {session?.isCompleted && (
            <PixelButton variant="gold" size="sm" onClick={onGoToReport}>
              <span className="flex items-center gap-1.5">
                <span>최종 리포트 이동</span>
                <Award size={14} />
              </span>
            </PixelButton>
          )}
        </div>
      </div>

      {/* Main Action Controller */}
      <PixelCard className="bg-white border-4 border-black rounded-3xl p-6 shadow-[8px_8px_0px_0px_#000] text-[#2D3436]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pb-4 border-b-2 border-black">
          <div>
            <span className="text-xs font-black text-[#D63031] uppercase tracking-widest">
              강사 라운드 컨트롤 패널
            </span>
            <h3 className="text-lg font-black text-[#2D3436] mt-0.5">
              현재 상태:{' '}
              <span className="text-[#0984E3] font-mono font-bold">
                {currentRound === 0 ? '상장 전 (다음 뉴스를 공개하여 상장을 시작하세요)' : `제 ${currentRound}회차 거래 진행 중`}
              </span>
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5">
          <div className="space-y-2">
            <PixelButton
              variant="primary"
              size="lg"
              className="w-full animate-bounce"
              disabled={loading || currentRound >= 10}
              onClick={handleNextNews}
            >
              <span className="flex items-center justify-center gap-2">
                <Send size={18} />
                <span>{currentRound === 0 ? '🚀 모의주식 시작 및 첫 뉴스 공개' : '📰 다음 뉴스 공개 및 주가 변동'}</span>
              </span>
            </PixelButton>
            <p className="text-[11px] text-[#636E72] font-bold text-center">
              클릭 시 전체 주식의 가격이 변동되고, 화면에 새로운 속보 기사 3개가 나타납니다.
            </p>
          </div>

          <div className="space-y-2">
            <PixelButton
              variant="danger"
              size="lg"
              className="w-full"
              disabled={loading || currentRound === 0}
              onClick={handleEndStock}
            >
              <span className="flex items-center justify-center gap-2">
                <CheckCircle size={18} />
                <span>🛑 모의주식 전체 종료하기</span>
              </span>
            </PixelButton>
            <p className="text-[11px] text-[#636E72] font-bold text-center">
              학생들의 주식 거래를 마감시키고 최종 리포트 단계로 일괄 이동시킵니다.
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 p-3 rounded-2xl bg-[#EBF7FF] border-2 border-black text-[#0984E3] text-xs font-black text-center shadow-[2px_2px_0px_0px_#000]">
            🔔 {statusMessage}
          </div>
        )}
      </PixelCard>

      {/* Revealed News Grid */}
      {currentRound > 0 && revealedNews.length > 0 && (
        <PixelCard className="bg-white border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_#000] text-[#2D3436]">
          <div className="flex items-center gap-2 pb-3 mb-4 border-b-2 border-black">
            <div className="p-1.5 bg-[#FFD32D] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
              <Newspaper className="text-[#1A1A1A]" size={18} />
            </div>
            <div>
              <h3 className="font-black text-lg text-[#2D3436]">이번 회차 속보 기사 ({revealedNews.length}건)</h3>
              <p className="text-xs text-[#636E72] font-bold">학생들과 기사를 읽고 투자를 유도해보세요. 카드를 클릭하면 확대됩니다.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {revealedNews.map((news) => {
              const isPos = news.impact === 'positive';
              return (
                <div
                  key={news.id}
                  onClick={() => {
                    playSelectSound();
                    setSelectedNewsDetail(news);
                  }}
                  className={`p-4 rounded-xl border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer hover:-translate-y-1 transition-transform ${
                    isPos ? 'bg-[#FFF0F0]' : 'bg-[#EBF7FF]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-black mb-2 border-b border-black pb-2">
                    <span className="text-[#2D3436] font-mono bg-white px-2 py-0.5 rounded border border-black">
                      {news.targetCompany}
                    </span>
                    <span className={isPos ? 'text-[#D63031]' : 'text-[#0984E3]'}>
                      {isPos ? '▲ 호재' : '▼ 악재'}
                    </span>
                  </div>
                  <h4 className="font-black text-sm text-[#2D3436] mt-2 mb-2 leading-snug">
                    {news.title}
                  </h4>
                  <p className="text-[11px] text-[#636E72] line-clamp-3 font-medium">
                    {news.content}
                  </p>
                </div>
              );
            })}
          </div>
        </PixelCard>
      )}

      {/* 10 Listed Companies Live Ticker */}
      <PixelCard className="bg-white border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_#000] text-[#2D3436]">
        <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#55E6C1] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
              <Activity className="text-[#1A1A1A]" size={18} />
            </div>
            <h3 className="font-black text-lg text-[#2D3436]">
              상장 10개 기업 실시간 시세
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-black text-[#2D3436] font-mono uppercase bg-[#FFFBEB]">
                <th className="py-2.5 px-3 font-black">종목명 / 코드</th>
                <th className="py-2.5 px-3 font-black">현재가</th>
                <th className="py-2.5 px-3 font-black">직전 대비 등락률</th>
                <th className="py-2.5 px-3 font-black w-[200px]">주가 변동 추이</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black/10 font-mono">
              {companies.map((c) => {
                const isPositive = c.changeRate > 0;
                const isNegative = c.changeRate < 0;
                return (
                  <tr key={c.id} className="hover:bg-[#FFFBEB]/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2 font-sans font-black text-[#2D3436]">
                        <span className="text-lg">{c.icon}</span>
                        <div>
                          <span>{c.name}</span>
                          <span className="text-[10px] text-[#636E72] block font-mono font-bold">
                            {c.code}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-sm font-black text-[#2D3436]">
                      {c.currentPrice.toLocaleString()}원
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`font-black px-2 py-0.5 rounded-lg text-xs border border-black ${
                          isPositive
                            ? 'bg-[#FFF0F0] text-[#D63031]'
                            : isNegative
                            ? 'bg-[#EBF7FF] text-[#0984E3]'
                            : 'bg-[#F8F9FA] text-[#636E72]'
                        }`}
                      >
                        {isPositive ? '▲ +' : isNegative ? '▼ ' : ''}
                        {c.changeRate.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="w-[180px]">
                        <CompanyChart company={c} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PixelCard>

      {/* Student List & Bonus Point Provision */}
      <PixelCard className="bg-white border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_#000] text-[#2D3436]">
        <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#0984E3] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
              <Gift className="text-white" size={18} />
            </div>
            <h3 className="font-black text-lg text-[#2D3436]">학생 자산 현황 & 포인트(투자금) 지급</h3>
          </div>
          <span className="text-xs text-[#636E72] font-bold">참여 학생: {students.length}명</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {students.map((student) => (
            <div key={student.studentId} className="border-2 border-black rounded-xl p-3 bg-[#F8F9FA] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="font-black text-sm">{student.name}</span>
                <PixelBadge variant={student.cash > 0 ? 'green' : 'slate'}>
                  {student.cash > 0 ? '투자가능' : '현금부족'}
                </PixelBadge>
              </div>
              <div className="text-xs font-mono font-bold text-[#636E72] mb-3">
                보유 현금: <span className="text-[#0984E3] font-black">{student.cash.toLocaleString()}원</span>
              </div>
              <PixelButton
                variant="gold"
                size="sm"
                className="w-full"
                onClick={() => handleGiveBonus(student.studentId, student.name)}
              >
                <span className="flex items-center justify-center gap-1 text-[11px]">
                  <Gift size={12} />
                  <span>투자금 지원</span>
                </span>
              </PixelButton>
            </div>
          ))}
        </div>
      </PixelCard>

      {/* Newspaper Detail Modal */}
      {selectedNewsDetail && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#Fdfbf7] border-[6px] border-[#2D3436] rounded-sm max-w-2xl w-full p-8 md:p-12 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] space-y-6 animate-in zoom-in-95 cursor-pointer" onClick={() => setSelectedNewsDetail(null)}>
            <div className="flex flex-col items-center justify-center pb-6 border-b-[6px] border-double border-[#2D3436] space-y-2">
              <span className="text-4xl md:text-5xl font-black text-[#1A1A1A] tracking-tighter" style={{ fontFamily: 'serif' }}>THE MONEY EDU TIMES</span>
              <div className="w-full flex items-center justify-between text-[11px] font-bold text-[#636E72] uppercase tracking-widest border-t-2 border-b-2 border-[#1A1A1A] py-1 mt-4">
                <span>ROUND {currentRound} ISSUE</span>
                <span>FINANCIAL CAMP NEWS</span>
                <span>Click to Close</span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col items-center text-center space-y-3 pb-6 border-b-[3px] border-[#2D3436]/20">
                <div className="flex items-center gap-3">
                  <span className="bg-[#1A1A1A] text-white px-3 py-1 font-mono font-black text-sm rounded-sm">
                    {selectedNewsDetail.targetCompany}
                  </span>
                  <span className={`font-black text-sm px-2 py-1 rounded-sm border-2 ${selectedNewsDetail.impact === 'positive' ? 'text-[#D63031] border-[#D63031]' : 'text-[#0984E3] border-[#0984E3]'}`}>
                    {selectedNewsDetail.impact === 'positive' ? '▲ 호재' : '▼ 악재'} ({selectedNewsDetail.impact === 'positive' ? '+' : ''}{selectedNewsDetail.impactRate}%)
                  </span>
                </div>
                <h3 className="font-black text-3xl md:text-4xl text-[#1A1A1A] leading-tight break-keep" style={{ fontFamily: 'serif' }}>
                  {selectedNewsDetail.title}
                </h3>
              </div>

              <div className="pt-2 text-lg md:text-xl text-[#2D3436] leading-[1.8] font-medium text-justify drop-cap" style={{ fontFamily: 'serif' }}>
                <span className="float-left text-5xl font-black mr-2 mt-1" style={{ fontFamily: 'serif' }}>{selectedNewsDetail.content.charAt(0)}</span>
                {selectedNewsDetail.content.slice(1)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
