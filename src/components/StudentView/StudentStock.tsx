import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Newspaper,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  Layers,
  Save
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
import { INITIAL_COMPANIES } from '../../data/seedData';
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
    lastTradeRound: -1
  }));

  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [tradeQuantity, setTradeQuantity] = useState<number>(1);
  const [tradeMessage, setTradeMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [trading, setTrading] = useState(false);
  const [selectedNewsDetail, setSelectedNewsDetail] = useState<NewsItem | null>(null);
  const [saving, setSaving] = useState(false);

  const currentRound = session?.stockRound ?? 0;

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
        }
        setRevealedNews(pollData.revealedNews || []);
        if (pollData.myAsset) {
          setMyAsset(pollData.myAsset);
        }
      }
    } catch (e) {
      console.error(e);
      // Fallback
      setCompanies(syncManager.getCompanies(session.sessionId));
    }
  };

  useEffect(() => {
    // Attempt to restore checkpoint if exists and asset is 0
    const checkpoint = localStorage.getItem(`fc_checkpoint_${session?.sessionId}_${student.studentId}`);
    if (checkpoint && (!myAsset || myAsset.totalAsset === 0)) {
      try {
        const parsed = JSON.parse(checkpoint);
        setMyAsset(parsed);
      } catch(e) {}
    }

    fetchAssetAndMarket();
    const interval = setInterval(fetchAssetAndMarket, 2000);

    const unsubscribe = syncManager.subscribe((type, payload) => {
      if (!payload?.sessionId || payload.sessionId.toUpperCase() === session?.sessionId?.toUpperCase()) {
        if (type === 'STOCK_STATE_CHANGED' || type === 'SESSION_UPDATED' || type === 'TRADE_EXECUTED') {
          fetchAssetAndMarket();
          onRefreshSession();
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [session?.sessionId, student?.studentId]);

  const handleTrade = async (c: Company, type: 'BUY' | 'SELL', qty: number) => {
    if (!session?.sessionId) return;
    if (session.stockState === 'closed') {
      setTradeMessage({ type: 'error', text: '모의주식이 종료되어 매매할 수 없습니다.' });
      return;
    }

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
          // auto save checkpoint on trade success
          localStorage.setItem(`fc_checkpoint_${session.sessionId}_${student.studentId}`, JSON.stringify(result.asset));
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

  const handleSaveCheckpoint = async () => {
    if (!session?.sessionId) return;
    setSaving(true);
    try {
      playSuccessSound();
      if (myAsset) {
        localStorage.setItem(`fc_checkpoint_${session.sessionId}_${student.studentId}`, JSON.stringify(myAsset));
      }
      
      const res = await fetch('/api/student/stock/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId, studentId: student.studentId }),
      });
      const result = await res.json();
      
      setTradeMessage({ type: 'success', text: result.message || '저장 완료!' });
    } catch (e) {
      console.error(e);
      setTradeMessage({ type: 'success', text: '브라우저 안전 저장 완료!' });
    } finally {
      setSaving(false);
    }
  };

  const isProfit = (myAsset?.profitRate ?? 0) >= 0;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* 1. Header & Quick Action Bar */}
      <PixelCard className="bg-white border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_#000] text-[#2D3436]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📈</span>
            <div>
              <h3 className="font-black text-base text-[#2D3436] flex items-center gap-2">
                <span>모의주식 시뮬레이션</span>
                <PixelBadge variant={currentRound === 0 ? 'gold' : 'blue'}>
                  {currentRound === 0 ? '초기 매매 대기 중' : `제 ${currentRound}회차 거래 진행 중`}
                </PixelBadge>
              </h3>
              <span className="text-xs text-[#636E72] font-bold">
                선생님이 프로젝터에 띄워주시는 기사를 보고 자율적으로 매수/매도를 진행하세요.
              </span>
            </div>
          </div>
          
          <PixelButton variant="gold" size="md" onClick={handleSaveCheckpoint} disabled={saving}>
            <span className="flex items-center gap-2">
              <Save size={16} />
              <span>상장 마감 (안전 저장)</span>
            </span>
          </PixelButton>
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
        
        {/* Holdings Summary */}
        {myAsset?.holdings && Object.keys(myAsset.holdings).length > 0 && (
          <div className="mt-4 pt-4 border-t-2 border-dashed border-[#DFE6E9]">
            <h4 className="text-xs font-bold text-[#636E72] mb-2 flex items-center gap-1">
              <Briefcase size={14} />
              나의 주식 포트폴리오
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(myAsset.holdings).map(([companyName, data]) => {
                if (data.quantity <= 0) return null;
                const company = companies.find(c => c.name === companyName);
                if (!company) return null;
                const profitRate = data.avgBuyPrice > 0 ? ((company.currentPrice - data.avgBuyPrice) / data.avgBuyPrice) * 100 : 0;
                
                return (
                  <div key={companyName} className="bg-white px-3 py-2 rounded-xl border border-black shadow-[2px_2px_0px_0px_#000] text-[11px] font-mono font-black flex items-center gap-2">
                    <span className="text-[#2D3436]">{companyName}</span>
                    <span className="text-[#636E72]">{data.quantity}주</span>
                    <span className={profitRate >= 0 ? 'text-[#D63031]' : 'text-[#0984E3]'}>
                      {profitRate >= 0 ? '▲' : '▼'}{Math.abs(profitRate).toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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

                    <div className="text-xs text-[#636E72] flex justify-between font-mono font-bold mt-1">
                      <span>예상 결제 금액:</span>
                      <span className="text-[#D63031] font-black">
                        {(c.currentPrice * tradeQuantity).toLocaleString()}원
                      </span>
                    </div>

                    <div className="text-xs text-[#636E72] flex justify-between font-mono font-bold mt-1">
                      <span>보유 현금:</span>
                      <span className="font-black text-[#0984E3]">
                        {(myAsset?.cash ?? student.cash ?? 0).toLocaleString()}원
                      </span>
                    </div>
                    
                    {((myAsset?.cash ?? student.cash ?? 0) - c.currentPrice * tradeQuantity) >= 0 && (
                      <div className="text-xs text-[#636E72] flex justify-between font-mono font-bold mt-1 pt-1 border-t border-dashed border-[#B2BEC3]">
                        <span>매수 후 예상 잔액:</span>
                        <span className="font-black text-[#2D3436]">
                          {((myAsset?.cash ?? student.cash ?? 0) - c.currentPrice * tradeQuantity).toLocaleString()}원
                        </span>
                      </div>
                    )}

                    {/* Buy & Sell Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <PixelButton
                        variant="danger"
                        size="sm"
                        disabled={
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
    </div>
  );
};
