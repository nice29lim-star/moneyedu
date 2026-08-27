import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Newspaper,
  Play,
  CheckCircle,
  LayoutDashboard,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Activity,
  Award,
  X,
  Building2,
  Send,
  RotateCcw,
  Eye,
  Info,
} from 'lucide-react';
import { Company, NewsItem, Session } from '../../types';
import { PixelBadge, PixelButton, PixelCard } from '../PixelUI';
import {
  playCoinSound,
  playFlipSound,
  playSelectSound,
  playSuccessSound,
} from '../../utils/soundEffects';
import { syncManager } from '../../utils/syncManager';
import { INITIAL_NEWS_POOL } from '../../data/seedData';

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
  const [slots, setSlots] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedNewsDetail, setSelectedNewsDetail] = useState<NewsItem | null>(null);
  const [showInitialNewsModal, setShowInitialNewsModal] = useState(false);
  const [showSendNewsModal, setShowSendNewsModal] = useState(false);

  const currentRound = session?.stockRound ?? 0;
  const currentState = session?.stockState || 'waiting';

  const fetchStockData = async () => {
    if (!session?.sessionId) return;
    try {
      const pollRes = await fetch(`/api/session/poll?sessionId=${session.sessionId}`);
      const pollData = await pollRes.json();
      if (pollData.ok) {
        setCompanies(pollData.companies || syncManager.getCompanies(session.sessionId));
        setRevealedNews(pollData.revealedNews || []);
        if (pollData.slots && pollData.slots.length > 0) {
          setSlots(pollData.slots);
        } else if (session.activeNewsSlots && session.activeNewsSlots.length > 0) {
          setSlots(session.activeNewsSlots);
        }
      } else {
        setCompanies(syncManager.getCompanies(session.sessionId));
      }

      const studentList = await syncManager.fetchStudents(session.sessionId, token);
      if (Array.isArray(studentList)) {
        setStudents(studentList);
      }
    } catch (e) {
      console.error(e);
      setCompanies(syncManager.getCompanies(session.sessionId));
    }
  };

  useEffect(() => {
    fetchStockData();
    // Prepare candidate slots for round 1-5 if empty
    if (session?.sessionId && currentRound >= 1 && (!slots || slots.length !== 6 || !slots[0]?.news)) {
      syncManager.prepareCandidateSlots(session.sessionId, session, token).then((res) => {
        if (res?.slots) setSlots(res.slots);
      });
    }

    // Auto open initial overview news modal if round is 0 on mount
    if (currentRound === 0 && !session?.isCompleted) {
      setShowInitialNewsModal(true);
    }

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
  }, [session?.sessionId, token, currentRound]);

  // Handle Slot Flip (Pick up to 3 cards)
  const handleSlotFlip = async (slotIndex: number) => {
    if (!session?.sessionId) return;
    if (currentState === 'trading' || currentState === 'closed') {
      const slot = slots.find((s) => s.slotIndex === slotIndex);
      if (slot?.news) {
        playSelectSound();
        setSelectedNewsDetail(slot.news);
      }
      return;
    }

    setLoading(true);
    try {
      playFlipSound();
      const result = await syncManager.flipStockNewsSlot(session.sessionId, session, slotIndex, token, 3);
      if (result.ok) {
        setStatusMessage(result.message);
        setSlots(result.slots);
        setRevealedNews(result.revealedNews);
        onRefreshSession();
        fetchStockData();

        // If 3 cards are flipped, trigger sound and open send modal!
        if (result.revealedCount === 3) {
          playSuccessSound();
          setShowSendNewsModal(true);
        }
      } else {
        setStatusMessage(result.message);
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage(`오류 발생: ${e.message || '통신 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  // Action: Send the 3 selected news items to students
  const handleSendNewsToStudents = async () => {
    if (!session?.sessionId) return;
    const chosenNews = slots.filter((s) => s.isRevealed && s.news).map((s) => s.news);
    if (chosenNews.length !== 3) {
      setStatusMessage('신문 기사 3개를 모두 선택한 후 학생들에게 전송할 수 있습니다.');
      return;
    }

    setLoading(true);
    try {
      playSuccessSound();
      const result = await syncManager.sendNewsToStudents(session.sessionId, session, chosenNews, slots, token);
      if (result.ok) {
        setStatusMessage(result.message);
        setRevealedNews(result.revealedNews);
        setShowSendNewsModal(false);
        onRefreshSession();
        fetchStockData();
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage(`오류 발생: ${e.message || '통신 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  // Action: Reset slots to choose 3 cards again
  const handleResetSlots = async () => {
    if (!session?.sessionId) return;
    setLoading(true);
    try {
      playFlipSound();
      const result = await syncManager.resetStockNewsSlots(session.sessionId, session, token);
      if (result?.slots) {
        setSlots(result.slots);
        setRevealedNews([]);
        setStatusMessage('슬롯이 초기화되었습니다. 학생들과 함께 3개의 카드를 다시 클릭해 선택해주세요!');
        onRefreshSession();
        fetchStockData();
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Action: Auto Random 3 selection
  const handleRevealRandom3 = async () => {
    if (!session?.sessionId) return;
    setLoading(true);
    try {
      const result = await syncManager.revealStockNews(session.sessionId, session, token, 3);
      if (result.ok) {
        playSuccessSound();
        setStatusMessage(result.message);
        setRevealedNews(result.revealedNews);
        setSlots(result.slots);
        onRefreshSession();
        fetchStockData();
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage(`오류 발생: ${e.message || '통신 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  // Action: Start Trading (Open Buy / Sell for Students)
  const handleStartTrading = async () => {
    if (!session?.sessionId) return;
    setLoading(true);
    try {
      const result = await syncManager.startStockTrading(session.sessionId, session, token);
      if (result.ok) {
        playSuccessSound();
        setStatusMessage(result.message);
        onRefreshSession();
        fetchStockData();
      } else {
        setStatusMessage(result.message || '상장 시작에 실패했습니다.');
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage(`오류 발생: ${e.message || '통신 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  // Action: Close Trading & Advance Round
  const handleCloseTrading = async () => {
    if (!session?.sessionId) return;
    setLoading(true);
    try {
      const result = await syncManager.closeStockTrading(session.sessionId, session, token);
      if (result.ok) {
        playCoinSound();
        setStatusMessage(result.message);
        if (result.companies) setCompanies(result.companies);
        onRefreshSession();
        fetchStockData();
        if (result.isCompleted) {
          setTimeout(() => {
            onGoToReport();
          }, 1500);
        }
      } else {
        setStatusMessage(result.message || '상장 마감에 실패했습니다.');
      }
    } catch (e: any) {
      console.error(e);
      setStatusMessage(`오류 발생: ${e.message || '통신 오류'}`);
    } finally {
      setLoading(false);
    }
  };

  const tradedCountInCurrentRound = students.filter(
    (s) => s.lastTradeRound === currentRound
  ).length;

  const revealedSlotCount = slots.filter((s) => s.isRevealed).length;
  const initialOverviewNews = INITIAL_NEWS_POOL.slice(0, 6);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header & Round Progress Track */}
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
              <span>📈 3단계: 5라운드 모의주식 시뮬레이션</span>
              <PixelBadge variant={currentRound === 0 ? 'gold' : 'blue'}>
                {currentRound === 0 ? '초기 세팅 (R0)' : `ROUND ${currentRound} / 5`}
              </PixelBadge>
            </h2>
            <p className="text-xs text-[#636E72] font-bold">
              {currentRound === 0
                ? '6대 산업 기사 확인 ➔ 초기 상장 시작 ➔ 학생 첫 포트폴리오 매수 ➔ 초기 상장 마감'
                : '1. 신문기사 보기 (3장 선택) ➔ 2. 학생 전송 ➔ 3. 상장 시작 (매수/매도) ➔ 4. 상장 마감 (가격 등락 반영)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PixelButton
            variant="secondary"
            size="sm"
            onClick={() => setShowInitialNewsModal(true)}
          >
            <span className="flex items-center gap-1.5 text-xs font-bold">
              <Newspaper size={14} />
              <span>초기 6대 기사 보기</span>
            </span>
          </PixelButton>

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

      {/* Round Progress Track (R0 ~ R5) */}
      <PixelCard className="bg-white border-4 border-black rounded-3xl p-4 shadow-[6px_6px_0px_0px_#000]">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-2">
          {/* Round 0 */}
          <div
            className={`flex-1 min-w-[110px] p-2.5 rounded-2xl border-2 border-black text-center transition-all ${
              currentRound === 0
                ? 'bg-[#FFD32D] shadow-[3px_3px_0px_0px_#000] translate-x-[-1px] translate-y-[-1px]'
                : currentRound > 0
                ? 'bg-[#EBFBF7] text-[#2D3436]'
                : 'bg-[#F8F9FA] text-[#A4B0BE]'
            }`}
          >
            <div className="text-[11px] font-mono font-black">초기 세팅 (R0)</div>
            <div className="text-xs font-black mt-0.5">
              {currentRound === 0 ? (
                <span className="text-[#D63031]">
                  {currentState === 'trading' ? '초기 상장 진행중' : '기사 확인 / 상장 대기'}
                </span>
              ) : (
                <span className="text-[#00B894]">세팅 완료 ✓</span>
              )}
            </div>
          </div>

          {/* Rounds 1 to 5 */}
          {[1, 2, 3, 4, 5].map((r) => {
            const isPast = r < currentRound;
            const isCurrent = r === currentRound;
            return (
              <div
                key={r}
                className={`flex-1 min-w-[100px] p-2.5 rounded-2xl border-2 border-black text-center transition-all ${
                  isCurrent
                    ? 'bg-[#FFD32D] shadow-[3px_3px_0px_0px_#000] translate-x-[-1px] translate-y-[-1px]'
                    : isPast
                    ? 'bg-[#EBFBF7] text-[#2D3436]'
                    : 'bg-[#F8F9FA] text-[#A4B0BE]'
                }`}
              >
                <div className="text-[11px] font-mono font-black">ROUND {r}</div>
                <div className="text-xs font-black mt-0.5">
                  {isCurrent && (
                    <span className="text-[#D63031]">
                      {currentState === 'waiting' && '기사 선택 대기'}
                      {currentState === 'news' && '기사 전송됨'}
                      {currentState === 'trading' && '상장 거래중'}
                      {currentState === 'closed' && '마감'}
                    </span>
                  )}
                  {isPast && <span className="text-[#00B894]">완료 ✓</span>}
                  {!isCurrent && !isPast && <span>예정</span>}
                </div>
              </div>
            );
          })}
        </div>
      </PixelCard>

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
                {currentRound === 0 && currentState === 'waiting' && '초기 세팅 (기사 검토 및 상장 시작 대기)'}
                {currentRound === 0 && currentState === 'trading' && '초기 상장 중 (학생 첫 종목 매수 진행)'}
                {currentRound >= 1 && currentState === 'waiting' && `제 ${currentRound}R 기사 선택 대기 (${revealedSlotCount}/3개)`}
                {currentRound >= 1 && currentState === 'news' && `제 ${currentRound}R 기사 학생 전송 완료 (분석 중)`}
                {currentRound >= 1 && currentState === 'trading' && `제 ${currentRound}R 상장 거래 중 (학생 매수/매도 진행)`}
                {currentState === 'closed' && '라운드 마감 (결과 반영 완료)'}
              </span>
            </h3>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="text-[#636E72]">이번 라운드 매매 완료:</span>
            <span className="font-mono text-sm font-black text-[#2D3436] bg-[#FFD32D] px-3 py-1 rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
              {tradedCountInCurrentRound} / {students.length}명
            </span>
          </div>
        </div>

        {/* Action Controls for Round 0 vs Rounds 1~5 */}
        {currentRound === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-5">
            {/* Step 1: Open Initial Trading */}
            <div className="space-y-2">
              <PixelButton
                variant="gold"
                size="lg"
                className="w-full"
                disabled={currentState === 'trading' || loading}
                onClick={handleStartTrading}
              >
                <span className="flex items-center justify-center gap-2">
                  <Play size={18} />
                  <span>1. 초기 상장 시작 (학생 첫 포트폴리오 매수)</span>
                </span>
              </PixelButton>
              <p className="text-[11px] text-[#636E72] font-bold text-center">
                학생들이 1,000,000원의 시드머니로 첫 주식을 매수할 수 있습니다.
              </p>
            </div>

            {/* Step 2: Close Initial Trading & Start 1R */}
            <div className="space-y-2">
              <PixelButton
                variant="danger"
                size="lg"
                className="w-full"
                disabled={currentState !== 'trading' || loading}
                onClick={handleCloseTrading}
              >
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle size={18} />
                  <span>2. 초기 상장 마감 ➔ 1라운드 시작</span>
                </span>
              </PixelButton>
              <p className="text-[11px] text-[#636E72] font-bold text-center">
                초기 매수를 마감하고 본격적인 5라운드 시뮬레이션(1R)을 시작합니다.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
            {/* Step 1: Reveal / Send News */}
            <div className="space-y-2">
              {revealedSlotCount === 3 && currentState === 'waiting' ? (
                <PixelButton
                  variant="primary"
                  size="lg"
                  className="w-full animate-bounce"
                  disabled={loading}
                  onClick={() => setShowSendNewsModal(true)}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Send size={18} />
                    <span>1. 📢 3개 기사 학생들에게 전송하기!</span>
                  </span>
                </PixelButton>
              ) : (
                <PixelButton
                  variant="primary"
                  size="lg"
                  className="w-full"
                  disabled={currentState !== 'waiting' || loading}
                  onClick={handleRevealRandom3}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Newspaper size={18} />
                    <span>1. 기사 3건 자동 선택 & 전송</span>
                  </span>
                </PixelButton>
              )}
              <p className="text-[11px] text-[#636E72] font-bold text-center">
                아래 6장의 카드 중 3장을 클릭해 뒤집거나 자동 선택을 누르세요.
              </p>
            </div>

            {/* Step 2: Start Trading */}
            <div className="space-y-2">
              <PixelButton
                variant="gold"
                size="lg"
                className="w-full"
                disabled={currentState !== 'news' || loading}
                onClick={handleStartTrading}
              >
                <span className="flex items-center justify-center gap-2">
                  <Play size={18} />
                  <span>2. 상장 시작 (학생 매수/매도 오픈)</span>
                </span>
              </PixelButton>
              <p className="text-[11px] text-[#636E72] font-bold text-center">
                학생들의 화면에서 매수/매도 버튼이 활성화됩니다.
              </p>
            </div>

            {/* Step 3: Close Trading */}
            <div className="space-y-2">
              <PixelButton
                variant="danger"
                size="lg"
                className="w-full"
                disabled={currentState !== 'trading' || loading}
                onClick={handleCloseTrading}
              >
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle size={18} />
                  <span>3. 상장 마감 (가격 등락 반영)</span>
                </span>
              </PixelButton>
              <p className="text-[11px] text-[#636E72] font-bold text-center">
                거래를 마감하고 주가 변동 및 학생 손익 팝업을 전송합니다.
              </p>
            </div>
          </div>
        )}

        {statusMessage && (
          <div className="mt-4 p-3 rounded-2xl bg-[#EBF7FF] border-2 border-black text-[#0984E3] text-xs font-black text-center shadow-[2px_2px_0px_0px_#000]">
            🔔 {statusMessage}
          </div>
        )}
      </PixelCard>

      {/* 6-Slot News Interactive Selection Grid (For Round 1~5) */}
      {currentRound >= 1 && (
        <PixelCard className="bg-white border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_#000] text-[#2D3436]">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b-2 border-black">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#FFD32D] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
                <Newspaper className="text-[#1A1A1A]" size={18} />
              </div>
              <div>
                <h3 className="font-black text-lg text-[#2D3436] flex items-center gap-2">
                  <span>제 {currentRound}라운드 6칸 신문 기사 카드</span>
                  <span className="text-xs font-mono font-black px-2 py-0.5 rounded-lg bg-[#FFD32D] border border-black">
                    선택 현황: {revealedSlotCount} / 3개
                  </span>
                </h3>
                <p className="text-xs text-[#636E72] font-bold">
                  {currentState === 'waiting'
                    ? '👇 카드를 3개 클릭하여 뒤집은 후, [학생들에게 전송하기] 버튼을 누르세요!'
                    : '✅ 이번 라운드에 공개된 3개의 기사입니다. 카드를 클릭하면 전문을 볼 수 있습니다.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentState === 'waiting' && revealedSlotCount === 3 && (
                <PixelButton
                  variant="primary"
                  size="sm"
                  disabled={loading}
                  onClick={() => setShowSendNewsModal(true)}
                >
                  <span className="flex items-center gap-1.5 text-xs font-bold">
                    <Send size={14} />
                    <span>선택 기사 3건 전송하기</span>
                  </span>
                </PixelButton>
              )}

              <PixelButton
                variant="secondary"
                size="sm"
                disabled={loading}
                onClick={handleResetSlots}
              >
                <span className="flex items-center gap-1 text-xs">
                  <RotateCcw size={12} />
                  <span>↺ 슬롯 다시 섞기</span>
                </span>
              </PixelButton>
            </div>
          </div>

          {/* 6 Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {slots.map((slot, idx) => {
              const isRevealed = slot.isRevealed && slot.news;
              const news = slot.news as NewsItem | null;
              const isPositive = news?.impact === 'positive';

              return (
                <div
                  key={idx}
                  onClick={() => handleSlotFlip(slot.slotIndex ?? idx)}
                  className={`min-h-[160px] rounded-2xl border-2 border-black p-3 flex flex-col justify-between transition-all select-none cursor-pointer active:scale-95 ${
                    isRevealed && news
                      ? isPositive
                        ? 'bg-[#FFF0F0] hover:bg-[#FFE3E3] shadow-[4px_4px_0px_0px_#000] scale-[1.02]'
                        : 'bg-[#EBF7FF] hover:bg-[#DDF0FF] shadow-[4px_4px_0px_0px_#000] scale-[1.02]'
                      : 'border-dashed bg-[#FFFBEB] hover:bg-[#FFF4C2] text-[#636E72] shadow-[2px_2px_0px_0px_#000] hover:border-solid hover:scale-105'
                  }`}
                >
                  {isRevealed && news ? (
                    <>
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="text-[10px] font-mono font-black px-1.5 py-0.5 rounded bg-white/90 border border-black truncate">
                            {news.targetCompany}
                          </span>
                          <span
                            className={`text-xs font-mono font-black ${
                              isPositive ? 'text-[#D63031]' : 'text-[#0984E3]'
                            }`}
                          >
                            {isPositive ? '▲ +' : '▼ '}{Math.abs(news.impactRate)}%
                          </span>
                        </div>
                        <h4 className="font-black text-xs text-[#2D3436] line-clamp-3 leading-snug">
                          {news.title}
                        </h4>
                      </div>
                      <div className="pt-2 border-t border-black/10 flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#636E72]">
                          카드 #{idx + 1}
                        </span>
                        <span className="text-[10px] font-black text-[#D63031] underline">
                          상세보기 ➔
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center py-4 space-y-1.5">
                      <div className="w-10 h-10 rounded-xl bg-[#FFD32D] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000] animate-bounce">
                        <Newspaper size={20} className="text-[#1A1A1A]" />
                      </div>
                      <span className="text-xs font-mono font-black text-[#2D3436]">
                        뉴스 카드 #{idx + 1}
                      </span>
                      <span className="text-[10px] font-black text-[#0984E3] bg-white px-2 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_0px_#000]">
                        클릭하여 뒤집기
                      </span>
                    </div>
                  )}
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
              상장 10개 기업 실시간 시세 및 기업 정보
            </h3>
          </div>
          <span className="text-xs text-[#636E72] font-bold">
            참여 학생: {students.length}명
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b-2 border-black text-[#2D3436] font-mono uppercase bg-[#FFFBEB]">
                <th className="py-2.5 px-3 font-black">종목명 / 코드</th>
                <th className="py-2.5 px-3 font-black">업종</th>
                <th className="py-2.5 px-3 font-black">상장 기준가</th>
                <th className="py-2.5 px-3 font-black">현재가 ({currentRound === 0 ? '초기' : `R${currentRound}`})</th>
                <th className="py-2.5 px-3 font-black">직전 대비 등락률</th>
                <th className="py-2.5 px-3 font-black">기업 주요 사업</th>
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
                    <td className="py-3 px-3 font-sans text-[#636E72] font-bold">
                      {c.industry}
                    </td>
                    <td className="py-3 px-3 text-[#636E72] font-bold">
                      {c.initialPrice.toLocaleString()}원
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
                    <td className="py-3 px-3 font-sans text-[#636E72] text-xs max-w-xs truncate font-bold">
                      {c.description}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PixelCard>

      {/* Modal 1: 3-Card Summary & Broadcast Modal */}
      {showSendNewsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black rounded-3xl max-w-2xl w-full p-6 shadow-[10px_10px_0px_0px_#000] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <PixelBadge variant="red">속보 기사 3건 정리</PixelBadge>
                <span className="text-sm font-black text-[#2D3436]">
                  제 {currentRound}라운드 선택 완료
                </span>
              </div>
              <button
                onClick={() => setShowSendNewsModal(false)}
                className="p-1 rounded-lg hover:bg-[#F8F9FA] border border-black"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-[#636E72] font-bold">
                선택된 3개의 기사를 확인하고 <strong>[학생들에게 전송하기]</strong>를 클릭하세요. 학생 화면에 즉시 팝업과 함께 기사가 표시됩니다!
              </p>

              {slots
                .filter((s) => s.isRevealed && s.news)
                .map((slot, i) => {
                  const n = slot.news as NewsItem;
                  const isPos = n.impact === 'positive';
                  return (
                    <div
                      key={n.id}
                      className={`p-3.5 rounded-2xl border-2 border-black ${
                        isPos ? 'bg-[#FFF0F0]' : 'bg-[#EBF7FF]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-black mb-1">
                        <span className="text-[#2D3436] font-mono">
                          #{i + 1} 대상 기업: <strong>{n.targetCompany}</strong> ({n.targetIndustry})
                        </span>
                        <span className={isPos ? 'text-[#D63031]' : 'text-[#0984E3]'}>
                          영향도: {isPos ? '▲ +' : '▼ '}{Math.abs(n.impactRate)}%
                        </span>
                      </div>
                      <h4 className="font-black text-sm text-[#2D3436] mb-1">{n.title}</h4>
                      <p className="text-xs text-[#636E72] font-medium leading-relaxed">
                        {n.content}
                      </p>
                    </div>
                  );
                })}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <PixelButton
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={() => setShowSendNewsModal(false)}
              >
                닫기
              </PixelButton>
              <PixelButton
                variant="primary"
                size="md"
                className="flex-2"
                onClick={handleSendNewsToStudents}
              >
                <span className="flex items-center justify-center gap-2">
                  <Send size={16} />
                  <span>📢 학생들에게 전송하기</span>
                </span>
              </PixelButton>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Initial 6 Overview News Modal */}
      {showInitialNewsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black rounded-3xl max-w-3xl w-full p-6 shadow-[10px_10px_0px_0px_#000] space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <PixelBadge variant="gold">초기 시장 브리핑</PixelBadge>
                <h3 className="text-base font-black text-[#2D3436]">
                  📰 모의주식 시작 전 6대 핵심 산업 기사
                </h3>
              </div>
              <button
                onClick={() => setShowInitialNewsModal(false)}
                className="p-1 rounded-lg hover:bg-[#F8F9FA] border border-black"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#636E72] font-bold">
              모의주식 첫 시작 전, 시장의 흐름을 파악할 수 있는 6개의 주요 경제 기사입니다. 기사를 읽고 초기 상장을 시작해보세요!
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {initialOverviewNews.map((n, idx) => {
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
                기사 확인 완료 (창 닫기)
              </PixelButton>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Single News Detail View Modal */}
      {selectedNewsDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black rounded-3xl max-w-lg w-full p-6 shadow-[8px_8px_0px_0px_#000] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <PixelBadge
                  variant={selectedNewsDetail.impact === 'positive' ? 'red' : 'blue'}
                >
                  {selectedNewsDetail.impact === 'positive' ? '🔥 호재 뉴스' : '💧 악재 뉴스'}
                </PixelBadge>
                <span className="text-xs font-mono font-black text-[#636E72]">
                  {currentRound}라운드 속보
                </span>
              </div>
              <button
                onClick={() => setSelectedNewsDetail(null)}
                className="p-1 rounded-lg hover:bg-[#F8F9FA] border border-black"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 rounded-2xl bg-[#FFFBEB] border-2 border-black">
                <div className="flex items-center justify-between text-xs font-black mb-1">
                  <span className="text-[#2D3436] flex items-center gap-1">
                    <Building2 size={14} />
                    관련 기업: {selectedNewsDetail.targetCompany}
                  </span>
                  <span
                    className={
                      selectedNewsDetail.impact === 'positive'
                        ? 'text-[#D63031]'
                        : 'text-[#0984E3]'
                    }
                  >
                    영향도: {selectedNewsDetail.impact === 'positive' ? '+' : ''}
                    {selectedNewsDetail.impactRate}%
                  </span>
                </div>
                <h3 className="font-black text-base text-[#2D3436]">
                  {selectedNewsDetail.title}
                </h3>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8F9FA] border-2 border-black text-sm text-[#2D3436] leading-relaxed font-medium">
                {selectedNewsDetail.content}
              </div>
            </div>

            <PixelButton
              variant="primary"
              size="md"
              className="w-full"
              onClick={() => setSelectedNewsDetail(null)}
            >
              확인 닫기
            </PixelButton>
          </div>
        </div>
      )}
    </div>
  );
};
