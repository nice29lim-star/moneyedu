import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Newspaper,
  Coins,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  Award,
  X,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { Company, NewsItem, Session, Student, StudentAsset } from '../../types';
import { PixelBadge, PixelButton, PixelCard } from '../PixelUI';
import { CompanyChart } from '../CompanyChart';
import {
  playCoinSound,
  playFlipSound,
  playSelectSound,
  playTradeSound,
  playSuccessSound,
} from '../../utils/soundEffects';
import { INITIAL_COMPANIES, INITIAL_NEWS_POOL } from '../../data/seedData';
import { isSupabaseReady, supabaseDb } from '../../utils/supabaseClient';
import { syncManager } from '../../utils/syncManager';

interface StudentStockProps {
  student: Student;
  session: Session | null;
  onRefreshSession: () => void;
}

export const StudentStock: React.FC<StudentStockProps> = ({
  student,
  session,
  onRefreshSession,
}) => {
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES);
  const [revealedNews, setRevealedNews] = useState<NewsItem[]>([]);
  const [slots, setSlots] = useState<any[]>([]);
  const [myAsset, setMyAsset] = useState<StudentAsset | null>(() => ({
    studentId: student?.studentId || '',
    studentName: student?.name || '',
    cash: student?.cash ?? 0,
    initialInvestment: student?.initialInvestment ?? student?.cash ?? 0,
    holdings: {},
    totalStockValuation: 0,
    totalAsset: student?.cash ?? 0,
    profitAmount: 0,
    profitRate: 0,
    tradedThisRound: false,
  }));

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [tradeQuantity, setTradeQuantity] = useState<number>(1);
  const [tradeMessage, setTradeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [trading, setTrading] = useState(false);
  const [selectedNewsDetail, setSelectedNewsDetail] = useState<NewsItem | null>(null);
  const [showBreakingNewsModal, setShowBreakingNewsModal] = useState<boolean>(false);
  const [showInitialNewsModal, setShowInitialNewsModal] = useState<boolean>(false);
  const [showRoundResultModal, setShowRoundResultModal] = useState<boolean>(false);
  const [roundResultData, setRoundResultData] = useState<{ round: number; profit: number; profitRate: number } | null>(null);

  const lastAutoOpenedRoundRef = useRef<number>(-1);
  const prevRoundRef = useRef<number>(session?.stockRound ?? 0);
  const [unrevealedAlert, setUnrevealedAlert] = useState<number | null>(null);

  const currentRound = session?.stockRound ?? 0;
  const currentState = session?.stockState || 'waiting';

  const fetchAssetAndMarket = async () => {
    if (!session?.sessionId) return;
    try {
      const pollRes = await fetch(
        `/api/session/poll?sessionId=${session.sessionId}&studentId=${student.studentId}`
      );
      const pollData = await pollRes.json();
      if (pollData.ok) {
        if (pollData.companies && pollData.companies.length > 0) {
          syncManager.saveCompanies(session.sessionId, pollData.companies);
          setCompanies(pollData.companies);
        } else {
          setCompanies(syncManager.getCompanies(session.sessionId));
        }
        const newsList = pollData.revealedNews || [];
        setRevealedNews(newsList);
        setSlots(pollData.slots || session.activeNewsSlots || []);
        if (pollData.myAsset) {
          setMyAsset(pollData.myAsset);
        }

        const curRound = pollData.session?.stockRound ?? session.stockRound ?? 0;
        const curState = pollData.session?.stockState ?? session.stockState ?? 'waiting';

        // Auto open breaking news modal when news is pushed for round 1-5
        if (
          curRound >= 1 &&
          (curState === 'news' || curState === 'trading') &&
          newsList.length > 0 &&
          lastAutoOpenedRoundRef.current !== curRound
        ) {
          lastAutoOpenedRoundRef.current = curRound;
          
          playFlipSound();
        }
      } else {
        const localAsset = syncManager.getStudentAssetSync(session.sessionId, student.studentId, student);
        if (localAsset) setMyAsset(localAsset);
        setCompanies(syncManager.getCompanies(session.sessionId));
        const localSession = syncManager.getSession(session.sessionId);
        if (localSession) {
          const localSlots = localSession.activeNewsSlots || [];
          setSlots(localSlots);
          const localNews = localSlots.filter((s: any) => s.isRevealed && s.news).map((s: any) => s.news);
          // If Round 0 and no slots, maybe fallback to INITIAL_NEWS_POOL? Wait, Teacher pushes it now.
          setRevealedNews(localNews);
        }
      }
    } catch (e) {
      console.error(e);
      const localAsset = syncManager.getStudentAssetSync(session.sessionId, student.studentId, student);
      if (localAsset) setMyAsset(localAsset);
      setCompanies(syncManager.getCompanies(session.sessionId));
      const localSession = syncManager.getSession(session.sessionId);
      if (localSession) {
        const localSlots = localSession.activeNewsSlots || [];
        setSlots(localSlots);
        const localNews = localSlots.filter((s: any) => s.isRevealed && s.news).map((s: any) => s.news);
        setRevealedNews(localNews);
      }
    }
  };

  useEffect(() => {
    fetchAssetAndMarket();
    const interval = setInterval(fetchAssetAndMarket, 2000);

    const unsubscribe = syncManager.subscribe((type, payload) => {
      if (
        !payload?.sessionId ||
        payload.sessionId.toUpperCase() === session?.sessionId?.toUpperCase()
      ) {
        if (
          type === 'STOCK_STATE_CHANGED' ||
          type === 'SESSION_UPDATED' ||
          type === 'TRADE_EXECUTED' ||
          type === 'BUDGET_SAVED'
        ) {
          if (type === 'STOCK_STATE_CHANGED') {
            const curRound = payload.stockRound ?? session?.stockRound ?? 0;
            const curState = payload.stockState || 'waiting';
            const newsList = payload.revealedNews || [];

            // Detect round completion to trigger Round Result Modal
            if (prevRoundRef.current !== curRound && curRound > 0) {
              const finishedRound = prevRoundRef.current;
              prevRoundRef.current = curRound;
              const currentAsset = syncManager.getStudentAssetSync(session?.sessionId || '', student.studentId, student);
              setRoundResultData({
                round: finishedRound,
                profit: currentAsset?.profitAmount || 0,
                profitRate: currentAsset?.profitRate || 0,
              });
              setShowRoundResultModal(true);
              playSuccessSound();
            }

            if (
              curRound >= 0 &&
              (curState === 'news' || curState === 'trading') &&
              newsList.length > 0 &&
              lastAutoOpenedRoundRef.current !== curRound
            ) {
              lastAutoOpenedRoundRef.current = curRound;
              
              playFlipSound();
            }
          }
          fetchAssetAndMarket();
          onRefreshSession();
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [session?.sessionId, student?.studentId, currentRound]);

  const isTradingOpen = currentState === 'trading';
  const hasTradedThisRound = myAsset?.tradedThisRound || false;

  // Normalized 6 slots for display - completely bulletproof and non-duplicating
  const displaySlots = useMemo(() => {
    // If slots array exists from session/server and has 6 slots
    if (Array.isArray(slots) && slots.length === 6 && slots[0]?.news) {
      return slots.map((s, idx) => {
        const isRevealed = Boolean(
          s.isRevealed || (s.news && revealedNews.some((rn) => rn.id === s.news?.id))
        );
        return {
          slotIndex: s.slotIndex ?? idx,
          isRevealed,
          news: s.news,
        };
      });
    }

    // Fallback if slots array is not fully initialized: map revealedNews into slots deterministically
    return Array.from({ length: 6 }, (_, idx) => {
      const matchingNews = revealedNews && revealedNews[idx] ? revealedNews[idx] : null;
      return {
        slotIndex: idx,
        isRevealed: Boolean(matchingNews),
        news: matchingNews,
      };
    });
  }, [slots, revealedNews]);

  const handleTrade = async (c: Company, type: 'BUY' | 'SELL', qty: number) => {
    if (!session?.sessionId) return;
    setTrading(true);
    setTradeMessage(null);

    try {
      const result = await syncManager.executeStudentTrade(
        session.sessionId,
        student,
        c,
        type,
        qty,
        currentRound
      );

      if (result.ok) {
        playTradeSound();
        setTradeMessage({ type: 'success', text: result.message });
        if (result.asset) {
          setMyAsset(result.asset);
        }
        setSelectedCompany(null);
        fetchAssetAndMarket();
        onRefreshSession();
      } else {
        setTradeMessage({ type: 'error', text: result.message });
      }
    } catch (e: any) {
      setTradeMessage({ type: 'error', text: e.message || '거래 처리 중 오류가 발생했습니다.' });
    } finally {
      setTrading(false);
    }
  };

  const isProfit = (myAsset?.profitRate ?? 0) >= 0;
  const initialOverviewNews = INITIAL_NEWS_POOL.slice(0, 6);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* 1. Round Progress & Quick Action Bar */}
      <PixelCard className="bg-white border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_#000] text-[#2D3436]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📈</span>
            <div>
              <h3 className="font-black text-base text-[#2D3436] flex items-center gap-2">
                <span>5라운드 모의주식 시뮬레이션</span>
                <PixelBadge variant={currentRound === 0 ? 'gold' : 'blue'}>
                  {currentRound === 0 ? '0라운드(초기 상장 준비 단계)' : `ROUND ${currentRound} / 5`}
                </PixelBadge>
              </h3>
              <span className="text-xs text-[#636E72] font-bold">
                {currentRound === 0
                  ? '초기 6대 기사를 읽고 첫 종목을 매수해보세요!'
                  : `제 ${currentRound}라운드: 뉴스 3건 분석 ➔ 1회 매수 또는 매도 진행`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">


            

            {/* View Investment Report Button */}
            <PixelButton
              variant="secondary"
              size="sm"
              onClick={() => {
                playSelectSound();
                setRoundResultData({ round: currentRound, profit: myAsset?.profitAmount || 0, profitRate: myAsset?.profitRate || 0 });
                setShowRoundResultModal(true);
              }}
            >
              <span className="flex items-center gap-1.5 text-xs font-black">
                <TrendingUp size={14} />
                <span>📊 투자리포트 보기</span>
              </span>
            </PixelButton>

            <PixelBadge
              variant={
                currentState === 'waiting'
                  ? 'slate'
                  : currentState === 'news'
                  ? 'purple'
                  : currentState === 'trading'
                  ? 'green'
                  : 'red'
              }
            >
              {currentState === 'waiting' && '⏳ 뉴스 대기 중'}
              {currentState === 'news' && '📰 뉴스 공개됨 (분석중)'}
              {currentState === 'trading' && '🟢 상장 거래 중 (1회 매매 가능)'}
              {currentState === 'closed' && '🔒 라운드 마감'}
            </PixelBadge>
          </div>
        </div>

        {/* 5-Round Progress Tracker */}
        <div className="grid grid-cols-6 gap-2">
          <div
            className={`py-2 px-1 text-center rounded-xl border-2 border-black text-xs font-mono font-black transition-all ${
              currentRound === 0
                ? 'bg-[#FFD32D] text-[#1A1A1A] shadow-[3px_3px_0px_0px_#000]'
                : 'bg-[#55E6C1] text-[#1A1A1A]'
            }`}
          >
            <div>R0</div>
            <div className="text-[10px] font-sans font-bold mt-0.5">
              {currentRound === 0 ? '초기 세팅' : '완료 ✓'}
            </div>
          </div>

          {[1, 2, 3, 4, 5].map((r) => {
            const isPast = r < currentRound;
            const isCurrent = r === currentRound;
            return (
              <div
                key={r}
                className={`py-2 px-1 text-center rounded-xl border-2 border-black text-xs font-mono font-black transition-all ${
                  isCurrent
                    ? 'bg-[#FFD32D] text-[#1A1A1A] shadow-[3px_3px_0px_0px_#000] scale-105'
                    : isPast
                    ? 'bg-[#55E6C1] text-[#1A1A1A]'
                    : 'bg-[#F1F2F6] text-[#A4B0BE]'
                }`}
              >
                <div>R{r}</div>
                <div className="text-[10px] font-sans font-bold mt-0.5">
                  {isCurrent ? '진행중' : isPast ? '완료 ✓' : '대기'}
                </div>
              </div>
            );
          })}
        </div>
      </PixelCard>

      {/* 2. Hero Asset Card */}
      <PixelCard className="bg-[#FFFBEB] border-4 border-black rounded-3xl p-6 shadow-[8px_8px_0px_0px_#000] text-[#2D3436]">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Total Asset Box */}
          <div className="md:col-span-2 space-y-1">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-[#FFD32D] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
                <Wallet className="text-[#1A1A1A]" size={20} />
              </div>
              <span className="text-xs font-black text-[#636E72] uppercase tracking-wider">
                내 총 평가 자산 (현금 + 주식)
              </span>
            </div>
            <div className="text-3xl sm:text-4xl font-black font-mono text-[#2D3436] tracking-tight">
              {(myAsset?.totalAsset ?? student.cash ?? 0).toLocaleString()}
              <span className="text-xl text-[#D63031] ml-1">원</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-[#636E72] font-bold">초기 투자원금:</span>
              <span className="text-xs font-mono font-black text-[#2D3436]">
                {(myAsset?.initialInvestment ?? student.initialInvestment ?? 0).toLocaleString()}원
              </span>
            </div>
          </div>

          {/* Profit Rate % */}
          <div className="bg-white p-4 rounded-2xl border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-1">
            <span className="text-xs text-[#636E72] block font-black">누적 수익률 (ROI)</span>
            <div
              className={`text-2xl font-black font-mono flex items-center gap-1 ${
                isProfit ? 'text-[#D63031]' : 'text-[#0984E3]'
              }`}
            >
              {isProfit ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
              <span>
                {isProfit ? '+' : ''}
                {(myAsset?.profitRate ?? 0).toFixed(2)}%
              </span>
            </div>
            <span className="text-[11px] text-[#636E72] font-bold">
              순손익: {isProfit ? '+' : ''}
              {(myAsset?.profitAmount ?? 0).toLocaleString()}원
            </span>
          </div>

          {/* Cash & Holdings Count */}
          <div className="bg-white p-4 rounded-2xl border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#636E72] font-bold">보유 현금:</span>
              <span className="font-mono font-black text-[#D63031]">
                {(myAsset?.cash ?? student.cash ?? 0).toLocaleString()}원
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#636E72] font-bold">주식 평가액:</span>
              <span className="font-mono font-black text-[#0984E3]">
                {(myAsset?.totalStockValuation ?? 0).toLocaleString()}원
              </span>
            </div>

          </div>
        </div>
      </PixelCard>

      {/* Trade status message banner */}
      {tradeMessage && (
        <div
          className={`p-3.5 rounded-2xl border-2 border-black text-xs font-black text-center flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_#000] animate-in fade-in duration-200 ${
            tradeMessage.type === 'success'
              ? 'bg-[#EBFBF7] text-[#00B894]'
              : 'bg-[#FFF0F0] text-[#D63031]'
          }`}
        >
          {tradeMessage.type === 'success' ? (
            <CheckCircle2 size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{tradeMessage.text}</span>
        </div>
      )}

      {/* 3. 뉴스 속보 카드 */}
      {currentRound >= 0 && (
        <PixelCard className="bg-white border-4 border-black rounded-3xl p-5 space-y-3 shadow-[6px_6px_0px_0px_#000] text-[#2D3436]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#74B9FF] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
                <Newspaper className="text-[#1A1A1A]" size={18} />
              </div>
              <h3 className="font-black text-base text-[#2D3436]">
                뉴스 속보 카드
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#636E72] font-bold">
                {revealedNews.length === 0
                  ? '강사님이 뉴스를 전송할 때까지 대기하세요'
                  : '카드를 클릭하면 기사 전문을 확인할 수 있습니다!'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3">
            {revealedNews.filter(n => n.roundAppeared === currentRound).length === 0 ? (
              <div className="col-span-full py-8 text-center text-[#636E72] font-bold border-2 border-dashed border-[#DFE6E9] rounded-2xl">
                뉴스 대기 중입니다...
              </div>
            ) : (
              revealedNews
                .filter(n => n.roundAppeared === currentRound)
                .map((news, idx) => {
                  const isPositive = news.impact === 'positive';

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        playSelectSound();
                        setSelectedNewsDetail(news);
                      }}
                      className={`min-h-[140px] rounded-2xl border-2 border-black p-3 flex flex-col justify-between transition-all select-none cursor-pointer shadow-[3px_3px_0px_0px_#000] active:scale-95 ${
                        isPositive
                          ? 'bg-[#FFF0F0] hover:bg-[#FFE3E3] hover:scale-105'
                          : 'bg-[#EBF7FF] hover:bg-[#DDF0FF] hover:scale-105'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-white/90 border border-black truncate">
                            {news.targetCompany}
                          </span>
                          <span
                            className={`text-xs font-black font-mono ${
                              isPositive ? 'text-[#D63031]' : 'text-[#0984E3]'
                            }`}
                          >
                            {isPositive ? '▲ +' : '▼ '}{Math.abs(news.impactRate)}%
                          </span>
                        </div>

                        <p className="text-xs font-black text-[#2D3436] leading-snug line-clamp-3 my-1" style={{ fontFamily: 'serif' }}>
                          {news.title}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-black/10 text-[10px] text-[#D63031] font-mono font-black text-right flex items-center justify-between">
                        <span className="text-[#636E72]">{currentRound === 0 ? '초기 속보' : `${currentRound}라운드 속보`}</span>
                        <span className="flex items-center gap-0.5">상세보기 ➔</span>
                      </div>
                    </div>
                  );
                })
            )}
          </div>

          {/* Past Round News */}
          {revealedNews.filter(n => n.roundAppeared < currentRound).length > 0 && (
            <div className="mt-4 pt-4 border-t-2 border-dashed border-[#DFE6E9]">
              <h4 className="text-xs font-bold text-[#636E72] mb-2 flex items-center gap-1">
                <RefreshCw size={12} />
                지난 라운드 기사
              </h4>
              <div className="flex flex-col gap-2">
                {revealedNews
                  .filter(n => n.roundAppeared < currentRound)
                  .sort((a, b) => b.roundAppeared - a.roundAppeared)
                  .map((news, idx) => (
                    <div
                      key={`past-${idx}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 rounded-xl border-2 border-[#DFE6E9] bg-[#F8F9FA] hover:border-black hover:bg-white transition-colors cursor-pointer"
                      onClick={() => {
                        playSelectSound();
                        setSelectedNewsDetail(news);
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2 sm:mb-0">
                        <span className="text-[10px] font-mono font-black bg-white px-1.5 py-0.5 rounded border border-[#B2BEC3] text-[#636E72]">
                          R{news.roundAppeared}
                        </span>
                        <span className="text-[11px] font-bold text-[#2D3436] truncate max-w-[200px]">
                          {news.title}
                        </span>
                      </div>
                      <PixelButton variant="secondary" size="sm" className="shrink-0 text-[10px] py-1 px-2">
                        뉴스보기
                      </PixelButton>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </PixelCard>
      )}

      {/* 4. 10 Listed Company Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#FFD32D] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
              <Layers className="text-[#1A1A1A]" size={18} />
            </div>
            <h3 className="text-lg font-black text-[#2D3436]">
              상장 10개 기업 실시간 거래소
            </h3>
          </div>
          <span className="text-xs text-[#636E72] font-bold">
            {isTradingOpen
              ? hasTradedThisRound
                ? '이번 라운드 매매 완료 (다음 라운드 대기)'
                : '🟢 거래 진행 중 (종목을 선택하여 매수/매도)'
              : '🔒 현재는 거래 오픈 대기 상태입니다.'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((c) => {
            const holding = myAsset?.holdings?.[c.name] || { quantity: 0, avgBuyPrice: 0 };
            const isChangePositive = c.changeRate > 0;
            const isChangeNegative = c.changeRate < 0;
            const holdingValuation = holding.quantity * c.currentPrice;
            const holdingProfitRate =
              holding.avgBuyPrice > 0
                ? ((c.currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice) * 100
                : 0;

            const isSelected = selectedCompany?.id === c.id;

            return (
              <div
                key={c.id}
                className={`p-4 rounded-2xl border-4 border-black transition-all space-y-3 ${
                  isSelected
                    ? 'bg-[#FFFBEB] shadow-[6px_6px_0px_0px_#000] scale-[1.01]'
                    : 'bg-white hover:bg-[#F8F9FA] shadow-[4px_4px_0px_0px_#000]'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{c.icon}</span>
                    <div>
                      <h4 className="font-black text-base text-[#2D3436]">{c.name}</h4>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#636E72] font-mono font-bold">
                        <span className="text-[#D63031] font-black">{c.code}</span>
                        <span>•</span>
                        <span>{c.industry}</span>
                      </div>
                    </div>
                  </div>

                  {/* Price Tag */}
                  <div className="text-right">
                    <div className="font-mono font-black text-lg text-[#2D3436]">
                      {c.currentPrice.toLocaleString()}원
                    </div>
                    <span
                      className={`inline-flex items-center gap-0.5 text-xs font-mono font-black px-1.5 py-0.2 rounded-lg border border-black ${
                        isChangePositive
                          ? 'text-[#D63031] bg-[#FFF0F0]'
                          : isChangeNegative
                          ? 'text-[#0984E3] bg-[#EBF7FF]'
                          : 'text-[#636E72] bg-white'
                      }`}
                    >
                      {isChangePositive ? '▲ +' : isChangeNegative ? '▼ ' : ''}
                      {c.changeRate.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Price History Sparkline */}
                <CompanyChart company={c} />

                {/* My Holdings in this Company */}
                <div className="bg-[#F8F9FA] p-2.5 rounded-xl border-2 border-black text-xs font-mono flex justify-between items-center text-[#2D3436]">
                  <div>
                    <span className="text-[#636E72] font-sans font-bold">내 보유: </span>
                    <span className="font-black text-[#2D3436]">{holding.quantity}주</span>
                  </div>
                  {holding.quantity > 0 && (
                    <div className="text-right">
                      <span className="text-[11px] text-[#636E72] font-sans font-bold">평가액 </span>
                      <span className="font-black">{holdingValuation.toLocaleString()}원</span>
                      <span
                        className={`ml-1 text-[10px] font-black ${
                          holdingProfitRate >= 0 ? 'text-[#D63031]' : 'text-[#0984E3]'
                        }`}
                      >
                        ({holdingProfitRate >= 0 ? '+' : ''}{holdingProfitRate.toFixed(1)}%)
                      </span>
                    </div>
                  )}
                </div>

                {/* Trade Action Form or Toggle */}
                {isSelected ? (
                  <div className="pt-2 border-t-2 border-black space-y-3 bg-white p-3.5 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-[#2D3436]">{c.name} 매매 주문</span>
                      <button
                        type="button"
                        onClick={() => setSelectedCompany(null)}
                        className="text-[#636E72] hover:text-[#2D3436] font-black"
                      >
                        닫기 ✕
                      </button>
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[#636E72] font-bold">주문 수량:</span>
                      <div className="flex items-center gap-1">
                        {[1, 5, 10].map((q) => (
                          <button
                            key={q}
                            type="button"
                            onClick={() => {
                              playSelectSound();
                              setTradeQuantity(q);
                            }}
                            className={`px-2 py-0.5 rounded-lg text-xs font-mono font-black border-2 border-black transition-all ${
                              tradeQuantity === q
                                ? 'bg-[#FFD32D] text-[#1A1A1A] shadow-[1px_1px_0px_0px_#000]'
                                : 'bg-white text-[#636E72]'
                            }`}
                          >
                            {q}주
                          </button>
                        ))}
                        <input
                          type="number"
                          min="1"
                          max="999"
                          value={tradeQuantity}
                          onChange={(e) => setTradeQuantity(Math.max(1, Number(e.target.value)))}
                          className="w-16 bg-white border-2 border-black rounded-lg px-2 py-0.5 text-xs text-[#2D3436] font-mono font-black text-center outline-none"
                        />
                      </div>
                    </div>

                    <div className="text-xs text-[#636E72] flex justify-between font-mono font-bold">
                      <span>예상 결제 금액:</span>
                      <span className="text-[#D63031] font-black">
                        {(c.currentPrice * tradeQuantity).toLocaleString()}원
                      </span>
                    </div>

                    {/* Buy & Sell Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <PixelButton
                        variant="danger"
                        size="sm"
                        disabled={
                          !isTradingOpen ||
                          (myAsset?.cash ?? student.cash ?? 0) < c.currentPrice * tradeQuantity ||
                          trading
                        }
                        onClick={() => handleTrade(c, 'BUY', tradeQuantity)}
                      >
                        매수 (사기)
                      </PixelButton>

                      <PixelButton
                        variant="primary"
                        size="sm"
                        disabled={
                          !isTradingOpen ||
                          holding.quantity < tradeQuantity ||
                          trading
                        }
                        onClick={() => handleTrade(c, 'SELL', tradeQuantity)}
                      >
                        매도 (팔기)
                      </PixelButton>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      playSelectSound();
                      setSelectedCompany(c);
                    }}
                    className="w-full py-2.5 rounded-xl bg-white hover:bg-[#F8F9FA] text-[#2D3436] font-black text-xs border-2 border-black shadow-[2px_2px_0px_0px_#000] transition-all flex items-center justify-center gap-1.5 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
                  >
                    <span>매수 / 매도 주문하기</span>
                    <span>➔</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal 3: Round End Results & Performance Popup */}
      {showRoundResultModal && roundResultData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <PixelCard className="bg-white border-4 border-black p-6 max-w-md w-full space-y-4 rounded-3xl shadow-[12px_12px_0px_0px_#000] text-[#2D3436] text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl animate-bounce">🎉</span>
              <PixelBadge variant="gold">
                {roundResultData.round === 0 ? '초기 세팅 완료' : `제 ${roundResultData.round}라운드 마감`}
              </PixelBadge>
              <h3 className="text-xl font-black text-[#2D3436]">
                주가 변동 및 정산 완료!
              </h3>
            </div>

            <div className="p-4 rounded-2xl bg-[#FFFBEB] border-2 border-black space-y-2 text-left">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#636E72] font-bold">내 총 평가 자산:</span>
                <span className="font-mono font-black text-base text-[#2D3436]">
                  {(myAsset?.totalAsset ?? 0).toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#636E72] font-bold">초기 투자금 대비 누적 수익:</span>
                <span
                  className={`font-mono font-black text-sm ${
                    (myAsset?.profitAmount ?? 0) >= 0 ? 'text-[#D63031]' : 'text-[#0984E3]'
                  }`}
                >
                  {(myAsset?.profitAmount ?? 0) >= 0 ? '+' : ''}
                  {(myAsset?.profitAmount ?? 0).toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#636E72] font-bold">누적 수익률 (ROI):</span>
                <span
                  className={`font-mono font-black text-sm ${
                    (myAsset?.profitRate ?? 0) >= 0 ? 'text-[#D63031]' : 'text-[#0984E3]'
                  }`}
                >
                  {(myAsset?.profitRate ?? 0) >= 0 ? '+' : ''}
                  {(myAsset?.profitRate ?? 0).toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="p-3 bg-[#F8F9FA] rounded-xl border border-[#DFE6E9] text-xs text-left leading-relaxed text-[#2D3436] font-medium">
              {(myAsset?.profitAmount ?? 0) > 0 ? (
                <span>🎉 <strong>축하합니다!</strong> 초기 자산 대비 <span className="text-[#D63031]">{(myAsset?.profitAmount ?? 0).toLocaleString()}원</span>의 이익을 얻었습니다. 어떤 뉴스가 호재로 작용했는지 분석해보세요.</span>
              ) : (myAsset?.profitAmount ?? 0) < 0 ? (
                <span>📉 <strong>아쉽습니다.</strong> 초기 자산 대비 <span className="text-[#0984E3]">{Math.abs((myAsset?.profitAmount ?? 0)).toLocaleString()}원</span>의 손실이 발생했습니다. 투자 종목의 관련 악재 뉴스를 다시 한 번 꼼꼼히 확인해보세요!</span>
              ) : (
                <span>⚖️ <strong>자산 유지 중!</strong> 아직 이익도 손실도 발생하지 않았습니다. 이번 라운드에 과감하게 투자해보는 것은 어떨까요?</span>
              )}
            </div>

            <p className="text-[11px] text-[#636E72] font-bold">
              💡 창을 닫은 후에도 언제든 <strong>[투자리포트 보기]</strong> 메뉴에서 다시 확인할 수 있습니다.
            </p>

            <PixelButton
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => setShowRoundResultModal(false)}
            >
              다음 라운드 준비하기
            </PixelButton>
          </PixelCard>
        </div>
      )}

      {/* Modal 4: Single News Detail View Modal */}
      {selectedNewsDetail && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#F4F1EA] border-4 border-black rounded-xl max-w-2xl w-full p-8 shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] space-y-6 animate-in zoom-in-95 cursor-pointer" onClick={() => setSelectedNewsDetail(null)}>
            <div className="flex items-center justify-between pb-4 border-b-4 border-black">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono font-black text-[#636E72] bg-white px-2 py-1 rounded border-2 border-black">
                  {selectedNewsDetail.roundAppeared === 0 ? '초기 속보' : `${selectedNewsDetail.roundAppeared}라운드 속보`}
                </span>
              </div>
              <div className="text-right flex flex-col">
                <span className="text-xl font-black text-[#2D3436]" style={{ fontFamily: 'serif' }}>THE MONEY EDU TIMES</span>
                <span className="text-[10px] font-bold text-[#636E72]">Click anywhere to close</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm font-black border-b-2 border-dashed border-[#D1CCC0] pb-2">
                <span className="text-[#2D3436] font-mono flex items-center gap-1">
                  <Building2 size={16} />
                  기업명: {selectedNewsDetail.targetCompany}
                </span>
                <span
                  className={
                    selectedNewsDetail.impact === 'positive'
                      ? 'text-[#D63031]'
                      : 'text-[#0984E3]'
                  }
                >
                  {selectedNewsDetail.impact === 'positive' ? '▲ 호재' : '▼ 악재'} ({selectedNewsDetail.impact === 'positive' ? '+' : ''}{selectedNewsDetail.impactRate}%)
                </span>
              </div>
              <h3 className="font-black text-2xl text-[#2D3436] leading-snug" style={{ fontFamily: 'serif' }}>
                {selectedNewsDetail.title}
              </h3>

              <div className="pt-2 text-base text-[#2D3436] leading-loose font-medium text-justify" style={{ fontFamily: 'serif' }}>
                {selectedNewsDetail.content}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
