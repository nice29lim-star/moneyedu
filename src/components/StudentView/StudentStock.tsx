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
    cash: student?.cash || 1000000,
    initialInvestment: student?.initialInvestment || student?.cash || 1000000,
    holdings: {},
    totalStockValuation: 0,
    totalAsset: student?.cash || 1000000,
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
          setShowBreakingNewsModal(true);
          playFlipSound();
        }
      } else {
        const localAsset = syncManager.getStudentAssetSync(session.sessionId, student.studentId, student);
        if (localAsset) setMyAsset(localAsset);
        setCompanies(syncManager.getCompanies(session.sessionId));
      }
    } catch (e) {
      console.error(e);
      const localAsset = syncManager.getStudentAssetSync(session.sessionId, student.studentId, student);
      if (localAsset) setMyAsset(localAsset);
      setCompanies(syncManager.getCompanies(session.sessionId));
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
              curRound >= 1 &&
              (curState === 'news' || curState === 'trading') &&
              newsList.length > 0 &&
              lastAutoOpenedRoundRef.current !== curRound
            ) {
              lastAutoOpenedRoundRef.current = curRound;
              setShowBreakingNewsModal(true);
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
                  {currentRound === 0 ? '초기 세팅 (R0)' : `ROUND ${currentRound} / 5`}
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
            {/* Initial Market Overview News Button */}
            <PixelButton
              variant="secondary"
              size="sm"
              onClick={() => {
                playSelectSound();
                setShowInitialNewsModal(true);
              }}
            >
              <span className="flex items-center gap-1.5 text-xs font-bold">
                <Newspaper size={14} />
                <span>🌐 초기 6대 기사</span>
              </span>
            </PixelButton>

            {/* Breaking News Popup Button for Current Round */}
            {revealedNews.length > 0 && (
              <PixelButton
                variant="gold"
                size="sm"
                onClick={() => {
                  playSelectSound();
                  setShowBreakingNewsModal(true);
                }}
              >
                <span className="flex items-center gap-1.5 text-xs font-black animate-pulse">
                  <Newspaper size={14} />
                  <span>📰 이번 라운드 뉴스 ({revealedNews.length}건)</span>
                </span>
              </PixelButton>
            )}

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
              {(myAsset?.totalAsset || student.cash || 1000000).toLocaleString()}
              <span className="text-xl text-[#D63031] ml-1">원</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-[#636E72] font-bold">초기 투자원금:</span>
              <span className="text-xs font-mono font-black text-[#2D3436]">
                {(myAsset?.initialInvestment || student.initialInvestment || 1000000).toLocaleString()}원
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
                {(myAsset?.cash ?? student.cash ?? 1000000).toLocaleString()}원
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-[#636E72] font-bold">주식 평가액:</span>
              <span className="font-mono font-black text-[#0984E3]">
                {(myAsset?.totalStockValuation ?? 0).toLocaleString()}원
              </span>
            </div>
            <div className="flex justify-between items-center text-xs pt-1 border-t-2 border-black">
              <span className="text-[#636E72] font-bold">이번 라운드 매매:</span>
              <span
                className={`font-black ${
                  hasTradedThisRound ? 'text-[#00B894]' : 'text-[#D63031]'
                }`}
              >
                {hasTradedThisRound ? '1회 완료 ✓' : '가능 (1회 남음)'}
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

      {/* 3. 6-Slot Mystery News Cards Grid */}
      {currentRound >= 1 && (
        <PixelCard className="bg-white border-4 border-black rounded-3xl p-5 space-y-3 shadow-[6px_6px_0px_0px_#000] text-[#2D3436]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#74B9FF] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
                <Newspaper className="text-[#1A1A1A]" size={18} />
              </div>
              <h3 className="font-black text-base text-[#2D3436]">
                R{currentRound} 뉴스 속보 카드 (6칸 중 3건 공개)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {revealedNews.length > 0 && (
                <PixelButton
                  variant="gold"
                  size="sm"
                  onClick={() => {
                    playSelectSound();
                    setShowBreakingNewsModal(true);
                  }}
                >
                  <span className="text-xs font-black flex items-center gap-1">
                    <Newspaper size={14} />
                    <span>📰 공개 기사 팝업 보기 ({revealedNews.length}건)</span>
                  </span>
                </PixelButton>
              )}
              <span className="text-xs text-[#636E72] font-bold">
                {currentState === 'waiting'
                  ? '강사님이 뉴스를 공개할 때까지 대기하세요'
                  : '카드를 클릭하면 기사 전문을 확인할 수 있습니다!'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {displaySlots.map((slot, idx) => {
              const isRevealed = slot.isRevealed && slot.news;
              const news = slot.news as NewsItem | null;
              const isPositive = news?.impact === 'positive';

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (isRevealed && news) {
                      playSelectSound();
                      setSelectedNewsDetail(news);
                    } else {
                      playFlipSound();
                      setUnrevealedAlert(idx + 1);
                      setTimeout(() => setUnrevealedAlert(null), 3000);
                    }
                  }}
                  className={`min-h-[140px] rounded-2xl border-2 border-black p-3 flex flex-col justify-between transition-all select-none cursor-pointer shadow-[3px_3px_0px_0px_#000] active:scale-95 ${
                    isRevealed
                      ? isPositive
                        ? 'bg-[#FFF0F0] hover:bg-[#FFE3E3] hover:scale-105'
                        : 'bg-[#EBF7FF] hover:bg-[#DDF0FF] hover:scale-105'
                      : 'bg-[#FFFBEB] hover:bg-[#FFF4C2] border-dashed text-[#636E72]'
                  }`}
                >
                  {isRevealed && news ? (
                    <>
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

                        <p className="text-xs font-black text-[#2D3436] leading-snug line-clamp-3 my-1">
                          {news.title}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-black/10 text-[10px] text-[#D63031] font-mono font-black text-right flex items-center justify-between">
                        <span className="text-[#636E72]">카드 #{idx + 1}</span>
                        <span className="flex items-center gap-0.5">상세보기 ➔</span>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-[#636E72] space-y-1.5 py-4 text-center">
                      <div className="w-9 h-9 rounded-xl bg-[#FFD32D] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] animate-bounce">
                        <Newspaper size={18} className="text-[#1A1A1A]" />
                      </div>
                      <span className="text-[11px] font-mono font-black text-[#2D3436]">
                        뉴스 카드 #{idx + 1}
                      </span>
                      <span className="text-[9px] text-[#A4B0BE] font-bold">
                        {currentState === 'waiting' ? '뉴스 대기중' : '미공개 카드'}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {unrevealedAlert && (
            <div className="p-3 rounded-2xl bg-[#FFFBEB] border-2 border-black text-xs font-black text-center text-[#2D3436] shadow-[2px_2px_0px_0px_#000] animate-in fade-in">
              ℹ️ <strong>카드 #{unrevealedAlert}</strong>: {currentState === 'waiting' ? '강사님이 기사를 선택해 전송할 때까지 잠시만 기다려주세요!' : '이번 라운드에 공개되지 않은 카드입니다. 공개된 3개의 기사를 확인하세요!'}
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
                <div className="h-10 bg-[#FFFBEB] rounded-xl p-1.5 flex items-end justify-between gap-1 border-2 border-black">
                  {c.priceHistory.map((p, pIdx) => {
                    const min = Math.min(...c.priceHistory) * 0.9;
                    const max = Math.max(...c.priceHistory) * 1.1;
                    const heightPercent = Math.max(15, Math.min(100, ((p - min) / (max - min)) * 100));
                    return (
                      <div
                        key={pIdx}
                        style={{ height: `${heightPercent}%` }}
                        className={`flex-1 rounded-t transition-all ${
                          pIdx === c.priceHistory.length - 1
                            ? 'bg-[#FFD32D] border-t border-black'
                            : 'bg-[#A4B0BE]'
                        }`}
                        title={`R${pIdx}: ${p.toLocaleString()}원`}
                      />
                    );
                  })}
                </div>

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
                          hasTradedThisRound ||
                          (myAsset?.cash ?? student.cash ?? 1000000) < c.currentPrice * tradeQuantity ||
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
                          hasTradedThisRound ||
                          holding.quantity < tradeQuantity ||
                          trading
                        }
                        onClick={() => handleTrade(c, 'SELL', tradeQuantity)}
                      >
                        매도 (팔기)
                      </PixelButton>
                    </div>

                    {hasTradedThisRound && (
                      <p className="text-[10px] text-[#D63031] text-center font-black">
                        ⚠️ 이번 라운드 거래가 완료되었습니다. 다음 라운드에 다시 거래할 수 있습니다.
                      </p>
                    )}
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

      {/* Modal 1: Breaking News Popup Modal (3 Articles) */}
      {showBreakingNewsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <PixelCard className="bg-white border-4 border-black p-5 sm:p-7 max-w-4xl w-full space-y-5 rounded-3xl shadow-[12px_12px_0px_0px_#000] text-[#2D3436] my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b-2 border-black">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#FFD32D] border-2 border-black rounded-2xl shadow-[2px_2px_0px_0px_#000]">
                  <Newspaper className="text-[#1A1A1A]" size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-black px-2 py-0.5 rounded bg-[#D63031] text-white">
                      긴급 속보
                    </span>
                    <span className="text-xs font-mono font-black text-[#636E72]">
                      ROUND {currentRound}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-[#2D3436] mt-0.5">
                    📰 제 {currentRound}라운드 경제 속보 ({revealedNews.length}건)
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  playSelectSound();
                  setShowBreakingNewsModal(false);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#F8F9FA] hover:bg-[#FFE3E3] border-2 border-black font-black text-base shadow-[2px_2px_0px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all"
              >
                ✕
              </button>
            </div>

            {/* News Cards Grid (3 Articles) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {revealedNews.map((news, idx) => {
                const isPositive = news.impact === 'positive';
                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border-2 border-black p-4 flex flex-col justify-between space-y-3 shadow-[4px_4px_0px_0px_#000] ${
                      isPositive ? 'bg-[#FFF0F0]' : 'bg-[#EBF7FF]'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-black px-2.5 py-1 rounded-lg bg-white border-2 border-black shadow-[1px_1px_0px_0px_#000]">
                          🏢 {news.targetCompany}
                        </span>
                        <span
                          className={`text-sm font-mono font-black px-2 py-0.5 rounded-lg bg-white border-2 border-black shadow-[1px_1px_0px_0px_#000] ${
                            isPositive ? 'text-[#D63031]' : 'text-[#0984E3]'
                          }`}
                        >
                          {isPositive ? '▲ 호재 +' : '▼ 악재 '}{Math.abs(news.impactRate)}%
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-[#2D3436] leading-snug">
                        {news.title}
                      </h4>

                      <p className="text-xs font-bold text-[#2D3436] leading-relaxed bg-white/90 p-3 rounded-xl border border-black/20">
                        {news.content}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[11px] font-bold text-[#636E72]">
                      <span>💡 관련 기업: <strong>{news.targetCompany}</strong></span>
                      <span className="font-mono font-black text-[#D63031]">기사 #{idx + 1}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Investment Guide Tip */}
            <div className="p-3.5 bg-[#FFFBEB] border-2 border-black rounded-2xl text-xs text-[#2D3436] space-y-1">
              <div className="font-black flex items-center gap-1.5 text-[#D63031]">
                <span>📈 투자 전략 팁:</span>
              </div>
              <p className="font-bold leading-relaxed">
                호재 기사(▲)는 다음 라운드 주가 상승에 긍정적인 영향을 주고, 악재 기사(▼)는 주가 하락 요인이 됩니다. 이번 라운드에 현명하게 매수/매도해보세요!
              </p>
            </div>

            {/* Close Button */}
            <div className="space-y-2 pt-2">
              <PixelButton
                variant="gold"
                size="lg"
                className="w-full shadow-[4px_4px_0px_0px_#000]"
                onClick={() => {
                  playSelectSound();
                  setShowBreakingNewsModal(false);
                }}
              >
                <span className="flex items-center justify-center gap-2 text-sm font-black">
                  <span>✕ 기사 닫고 주식 매수/매도하기</span>
                </span>
              </PixelButton>

              <p className="text-[11px] text-[#636E72] font-bold text-center">
                💡 창을 닫은 후에도 상단의 <strong>[📰 이번 라운드 뉴스 보기]</strong> 버튼을 누르면 언제든지 다시 열어볼 수 있습니다.
              </p>
            </div>
          </PixelCard>
        </div>
      )}

      {/* Modal 2: Initial 6 Overview Market News Modal */}
      {showInitialNewsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200">
          <PixelCard className="bg-white border-4 border-black p-5 sm:p-7 max-w-3xl w-full space-y-5 rounded-3xl shadow-[12px_12px_0px_0px_#000] text-[#2D3436] my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <PixelBadge variant="gold">초기 시장 브리핑</PixelBadge>
                <h3 className="text-base font-black text-[#2D3436]">
                  📰 모의주식 시작 전 6대 핵심 산업 기사
                </h3>
              </div>
              <button
                onClick={() => setShowInitialNewsModal(false)}
                className="p-1 rounded-lg hover:bg-[#F8F9FA] border border-black font-black"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#636E72] font-bold">
              모의주식 시작 전 시장의 전반적인 동향을 파악할 수 있는 6대 주요 기사입니다.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {initialOverviewNews.map((n) => {
                const isPos = n.impact === 'positive';
                return (
                  <div
                    key={n.id}
                    className={`p-3.5 rounded-2xl border-2 border-black flex flex-col justify-between ${
                      isPos ? 'bg-[#FFF8F8]' : 'bg-[#F0F8FF]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] font-black mb-1">
                        <span className="text-[#2D3436] font-mono bg-white px-2 py-0.5 rounded border border-black">
                          {n.targetCompany}
                        </span>
                        <span className={isPos ? 'text-[#D63031]' : 'text-[#0984E3]'}>
                          {isPos ? '▲ 호재' : '▼ 악재'} ({n.impactRate}%)
                        </span>
                      </div>
                      <h4 className="font-black text-xs text-[#2D3436] mt-1 mb-1 leading-snug">
                        {n.title}
                      </h4>
                      <p className="text-[11px] text-[#636E72] line-clamp-3 leading-relaxed font-medium">
                        {n.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2">
              <PixelButton
                variant="primary"
                size="md"
                className="w-full"
                onClick={() => setShowInitialNewsModal(false)}
              >
                확인 완료 (창 닫기)
              </PixelButton>
            </div>
          </PixelCard>
        </div>
      )}

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
                  {(myAsset?.totalAsset ?? 1000000).toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#636E72] font-bold">누적 순수익:</span>
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

            <p className="text-xs text-[#636E72] font-bold">
              강사님이 다음 라운드 뉴스를 전송할 때까지 잠시 대기해주세요!
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <PixelCard className="bg-white border-4 border-black p-6 max-w-lg w-full space-y-4 rounded-3xl shadow-[10px_10px_0px_0px_#000] text-[#2D3436]">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <PixelBadge variant={selectedNewsDetail.impact === 'positive' ? 'red' : 'blue'}>
                {selectedNewsDetail.targetCompany} 속보
              </PixelBadge>
              <button
                type="button"
                onClick={() => setSelectedNewsDetail(null)}
                className="text-[#636E72] hover:text-[#2D3436] font-black text-lg"
              >
                ✕
              </button>
            </div>

            <h3 className="text-lg font-black text-[#2D3436] leading-snug">
              {selectedNewsDetail.title}
            </h3>

            <p className="text-sm text-[#2D3436] font-bold leading-relaxed bg-[#FFFBEB] p-4 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              {selectedNewsDetail.content}
            </p>

            <div className="flex items-center justify-between text-xs pt-2">
              <span className="text-[#636E72] font-bold">예상 주가 변동 영향:</span>
              <span
                className={`font-mono font-black text-base ${
                  selectedNewsDetail.impact === 'positive' ? 'text-[#D63031]' : 'text-[#0984E3]'
                }`}
              >
                {selectedNewsDetail.impact === 'positive' ? '+' : ''}
                {selectedNewsDetail.impactRate}%
              </span>
            </div>

            <PixelButton
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={() => setSelectedNewsDetail(null)}
            >
              확인 닫기
            </PixelButton>
          </PixelCard>
        </div>
      )}
    </div>
  );
};
