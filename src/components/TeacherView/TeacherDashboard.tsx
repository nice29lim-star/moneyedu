import React, { useState, useEffect } from 'react';
import {
  Copy,
  Check,
  RefreshCw,
  PlusCircle,
  Play,
  Users,
  Award,
  DollarSign,
  TrendingUp,
  BookOpen,
  PieChart,
  BarChart3,
  ExternalLink,
  FileSpreadsheet,
  Send,
  Code2,
  Zap,
} from 'lucide-react';
import { AppStateModule, Session, Student } from '../../types';
import { PixelBadge, PixelButton, PixelCard } from '../PixelUI';
import { playCoinSound, playSelectSound, playSuccessSound } from '../../utils/soundEffects';
import { syncManager } from '../../utils/syncManager';

interface TeacherDashboardProps {
  session: Session | null;
  token: string;
  onSetModule?: (module: AppStateModule) => void;
  onStartModule?: (module: AppStateModule) => void;
  onStartNewSession?: () => void;
  onInitDb?: () => void;
  onSessionUpdated?: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  session,
  token,
  onSetModule,
  onStartModule,
  onStartNewSession,
  onInitDb,
  onSessionUpdated,
}) => {
  const handleModuleClick = (mod: AppStateModule) => {
    if (session?.sessionId) {
      syncManager.updateSessionModule(session.sessionId, mod, token);
    }
    if (onStartModule) onStartModule(mod);
    else if (onSetModule) onSetModule(mod);
  };
  const [students, setStudents] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  const [selectedStudentForBonus, setSelectedStudentForBonus] = useState<any | null>(null);
  const [bonusAmount, setBonusAmount] = useState('100000');
  const [isAwarding, setIsAwarding] = useState(false);
  const [bonusMessage, setBonusMessage] = useState('');
  const [loadingList, setLoadingList] = useState(false);

  // Google Sheets Sync States
  const [showGasModal, setShowGasModal] = useState(false);
  const [gasUrlInput, setGasUrlInput] = useState(syncManager.getGasUrl());
  const [isSyncingGas, setIsSyncingGas] = useState(false);
  const [gasSyncStatus, setGasSyncStatus] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState(false);

  const GAS_SCRIPT_CODE = `function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    var action = data.action || 'sync';
    var sessionId = data.sessionId || 'UNKNOWN';

    // 1. Session Log Sheet
    var sessionSheet = sheet.getSheetByName("세션_진행현황");
    if (!sessionSheet) {
      sessionSheet = sheet.insertSheet("세션_진행현황");
      sessionSheet.appendRow(["일시", "세션ID", "현재모듈", "주식라운드", "액션", "상세내용"]);
    }
    sessionSheet.appendRow([new Date(), sessionId, data.currentModule || '-', data.stockRound || '-', action, JSON.stringify(data)]);

    // 2. Student List Sheet
    var studentSheet = sheet.getSheetByName("참가학생_명단");
    if (!studentSheet) {
      studentSheet = sheet.insertSheet("참가학생_명단");
      studentSheet.appendRow(["일시", "세션ID", "학번", "이름", "선택직업", "퀴즈보너스", "투자원금", "보유현금", "주식평가액", "총자산", "수익률(%)"]);
    }

    if (action === 'studentLogin' && data.student) {
      var st = data.student;
      studentSheet.appendRow([new Date(), sessionId, st.studentNum, st.name, st.jobTitle || '미선택', st.quizBonus || 0, st.initialInvestment || 0, st.cash || 0, st.stockValuation || 0, st.totalAsset || 0, st.profitRate || 0]);
    } else if (action === 'bulkSync' && data.students && data.students.length > 0) {
      for (var i = 0; i < data.students.length; i++) {
        var s = data.students[i];
        studentSheet.appendRow([new Date(), sessionId, s.studentNum, s.name, s.jobTitle || '미선택', s.quizBonus || 0, s.initialInvestment || 0, s.cash || 0, s.stockValuation || 0, s.totalAsset || 0, s.profitRate || 0]);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true, message: "Sync successful" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const [isTestingGas, setIsTestingGas] = useState(false);
  const [gasTestResult, setGasTestResult] = useState<string | null>(null);
  const [copiedTsv, setCopiedTsv] = useState(false);

  const handleSaveGasUrl = async () => {
    syncManager.setGasUrl(gasUrlInput);
    try {
      await fetch('/api/gas/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gasUrl: gasUrlInput }),
      });
    } catch {}
    playSuccessSound();
    setGasSyncStatus('구글 Web App URL이 저장되었습니다.');
    setTimeout(() => setGasSyncStatus(null), 3000);
  };

  const handleTestConnection = async () => {
    if (!gasUrlInput.trim()) {
      setGasTestResult('⚠️ 먼저 Google Apps Script 웹 앱 URL을 입력해주세요.');
      return;
    }
    setIsTestingGas(true);
    setGasTestResult(null);
    try {
      const res = await syncManager.testGasConnection(gasUrlInput.trim());
      if (res.ok) {
        playSuccessSound();
        setGasTestResult(`✅ ${res.message}`);
      } else {
        setGasTestResult(`❌ ${res.message}`);
      }
    } catch (err: any) {
      setGasTestResult(`❌ 테스트 오류: ${err.message || '네트워크 오류'}`);
    } finally {
      setIsTestingGas(false);
    }
  };

  const handleDownloadCsv = () => {
    if (!session?.sessionId) return;
    playSuccessSound();
    window.open(`/api/export/csv?sessionId=${session.sessionId}`, '_blank');
  };

  const handleCopyTsv = () => {
    if (!students || students.length === 0) {
      alert('복사할 학생 데이터가 없습니다.');
      return;
    }

    const headers = ['학번', '이름', '선택직업', '월급', '퀴즈보너스', '투자원금', '보유현금', '주식평가액', '총자산', '수익률(%)'];
    const rows = students.map((s) => [
      s.studentNum || '',
      s.name || '',
      s.jobTitle || '미선택',
      s.selectedJob?.monthlySalary || 0,
      s.quizBonus || 0,
      s.initialInvestment || 0,
      s.cash || 0,
      s.stockValuation || 0,
      s.totalAsset || 0,
      (s.profitRate || 0) + '%',
    ]);

    const tsvString = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsvString);
    setCopiedTsv(true);
    playSuccessSound();
    setTimeout(() => setCopiedTsv(false), 2500);
  };

  const handleTriggerBulkSync = async () => {
    if (!session?.sessionId) return;
    setIsSyncingGas(true);
    setGasSyncStatus(null);
    try {
      const res = await syncManager.syncAllSessionDataToGAS(session.sessionId, token);
      if (res.ok) {
        playSuccessSound();
        setGasSyncStatus(`✅ ${res.message}`);
      } else {
        setGasSyncStatus(`⚠️ ${res.message}`);
      }
    } catch (e: any) {
      setGasSyncStatus(`❌ 전송 실패: ${e.message || '네트워크 오류'}`);
    } finally {
      setIsSyncingGas(false);
    }
  };

  const fetchDashboard = async () => {
    if (!session?.sessionId) return;
    try {
      const studentList = await syncManager.fetchStudents(session.sessionId, token);
      if (Array.isArray(studentList)) {
        setStudents(studentList);
      }
    } catch (e) {
      console.error('Failed to fetch dashboard data', e);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 3000);

    // Instant real-time listener: when a student logs in or changes state
    const unsubscribe = syncManager.subscribe((type, payload) => {
      if (type === 'STUDENT_JOINED' || type === 'BUDGET_SAVED' || type === 'TRADE_EXECUTED') {
        if (!payload || !payload.sessionId || payload.sessionId.toUpperCase() === session?.sessionId?.toUpperCase()) {
          fetchDashboard();
        }
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [session?.sessionId]);

  const copyInviteCode = () => {
    if (!session?.sessionId) return;
    navigator.clipboard.writeText(session.sessionId);
    setCopied(true);
    playSelectSound();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGiveBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentForBonus || !session?.sessionId) return;

    setIsAwarding(true);
    try {
      const res = await fetch('/api/teacher/give-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
        body: JSON.stringify({
          sessionId: session.sessionId,
          studentId: selectedStudentForBonus.studentId,
          amount: Number(bonusAmount),
          token,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        playCoinSound();
        setBonusMessage(data.message);
        fetchDashboard();
        setTimeout(() => {
          setSelectedStudentForBonus(null);
          setBonusMessage('');
        }, 1200);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAwarding(false);
    }
  };

  const moduleCards: {
    key: AppStateModule;
    step: string;
    title: string;
    desc: string;
    icon: any;
    color: string;
    borderVariant: 'gold' | 'cyan' | 'rose' | 'default';
  }[] = [
    {
      key: 'quiz',
      step: '1단계 모듈',
      title: '금융 기초 퀴즈',
      desc: '20개 상식 퀴즈 제시, 정답 학생 클릭하여 실시간 보너스 즉시 지급',
      icon: BookOpen,
      color: 'from-amber-500/20 to-orange-500/10',
      borderVariant: 'gold',
    },
    {
      key: 'budget',
      step: '2단계 모듈',
      title: '직업 & 통장배분',
      desc: '학생 6종 직업 선택, 월급명세서(세전/세후/공제) 확인 후 생활비·저축·투자 100% 배분',
      icon: PieChart,
      color: 'from-emerald-500/20 to-teal-500/10',
      borderVariant: 'cyan',
    },
    {
      key: 'stock',
      step: '3단계 모듈',
      title: '5라운드 모의주식',
      desc: '뉴스 카드 2건 공개 ➔ 상장 시작 ➔ 매수/매도 1회 ➔ 상장 마감 가격 갱신',
      icon: TrendingUp,
      color: 'from-sky-500/20 to-indigo-500/10',
      borderVariant: 'cyan',
    },
    {
      key: 'report',
      step: '최종 단계',
      title: '투자 리포트 & 순위',
      desc: '학급 최종 순위, 수익률 랭킹, 개인별 성향 리포트 확인 및 수료증 다운로드',
      icon: Award,
      color: 'from-purple-500/20 to-pink-500/10',
      borderVariant: 'rose',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Top Banner: Session Code & Controls */}
      <PixelCard className="bg-white border-4 border-black rounded-3xl p-6 shadow-[8px_8px_0px_0px_#000] text-[#2D3436]">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <PixelBadge variant="gold">강사 대시보드</PixelBadge>
              <span className="text-xs text-[#636E72] font-mono font-bold">
                세션 개설: {session?.createdAt ? new Date(session.createdAt).toLocaleTimeString('ko-KR') : '-'}
              </span>
            </div>
            <h2 className="text-2xl font-black text-[#2D3436] flex items-center gap-2">
              <span>초대 코드:</span>
              <span className="font-mono text-3xl text-[#1A1A1A] tracking-wider bg-[#FFD32D] px-3.5 py-1 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                {session?.sessionId || '발급중...'}
              </span>
              <button
                type="button"
                onClick={copyInviteCode}
                className="p-2.5 rounded-xl bg-white hover:bg-[#F8F9FA] text-[#2D3436] border-2 border-black shadow-[2px_2px_0px_0px_#000] transition-all active:translate-x-0.5 active:translate-y-0.5"
                title="초대코드 복사"
              >
                {copied ? <Check size={18} className="text-[#00B894]" /> : <Copy size={18} />}
              </button>
            </h2>
            <p className="text-xs text-[#636E72] font-bold">
              학생들에게 이 초대코드를 알려주세요. 학생은 초대코드 + 이름 + 학번으로 접속합니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PixelButton
              variant="secondary"
              size="sm"
              onClick={() => {
                playSelectSound();
                fetchDashboard();
              }}
              title="학생 목록을 새로고침합니다."
            >
              <span className="flex items-center gap-1.5">
                <RefreshCw size={14} className={loadingList ? 'animate-spin' : ''} />
                <span>명단 새로고침</span>
              </span>
            </PixelButton>

            <PixelButton
              variant="gold"
              size="sm"
              onClick={() => {
                playSuccessSound();
                onStartNewSession?.();
              }}
            >
              <span className="flex items-center gap-1">
                <PlusCircle size={14} />
                <span>새 세션 발급</span>
              </span>
            </PixelButton>
          </div>
        </div>
      </PixelCard>

      {/* 3 Step Modules Navigation Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-black text-[#2D3436] flex items-center gap-2">
            <div className="p-1.5 bg-[#FFD32D] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
              <BarChart3 size={18} className="text-[#1A1A1A]" />
            </div>
            <span>수업 진행 모듈 선택</span>
          </h3>
          <span className="text-xs text-[#636E72] font-bold">
            강사가 모듈을 클릭하면 모든 학생 화면이 실시간으로 전환됩니다.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {moduleCards.map((card) => {
            const isCurrent = session?.currentModule === card.key;
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                onClick={() => {
                  playSelectSound();
                  handleModuleClick(card.key);
                }}
                className={`relative group cursor-pointer rounded-2xl border-4 border-black p-4 transition-all duration-200 ${
                  isCurrent
                    ? 'bg-[#FFFBEB] shadow-[6px_6px_0px_0px_#000] translate-x-[-2px] translate-y-[-2px]'
                    : 'bg-white hover:bg-[#F8F9FA] shadow-[4px_4px_0px_0px_#000]'
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-3.5 right-3 bg-[#D63031] text-white text-[10px] font-black px-2.5 py-0.5 rounded-lg border border-black shadow-[2px_2px_0px_0px_#000]">
                    진행 중
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-[#D63031]">{card.step}</span>
                  <div className="p-2 rounded-xl bg-[#FFD32D] border-2 border-black text-[#1A1A1A] shadow-[2px_2px_0px_0px_#000] group-hover:scale-110 transition-transform">
                    <Icon size={18} />
                  </div>
                </div>
                <h4 className="font-black text-base text-[#2D3436] mb-1">{card.title}</h4>
                <p className="text-xs text-[#636E72] font-bold leading-relaxed min-h-[36px]">{card.desc}</p>
                <div className="mt-3 pt-3 border-t-2 border-black flex items-center justify-between text-xs font-black text-[#0984E3]">
                  <span>모듈 진입하기</span>
                  <Play size={12} className="fill-current" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time Student Roster */}
      <PixelCard className="bg-white border-4 border-black rounded-3xl p-5 shadow-[6px_6px_0px_0px_#000] text-[#2D3436]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4 pb-3 border-b-2 border-black">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#55E6C1] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
              <Users className="text-[#1A1A1A]" size={18} />
            </div>
            <h3 className="text-lg font-black text-[#2D3436]">
              접속 학생 명단 ({students.length}명)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 1-Click Excel CSV Download Button */}
            <button
              type="button"
              onClick={handleDownloadCsv}
              disabled={students.length === 0}
              className="px-3 py-1.5 rounded-xl border-2 border-black bg-[#EBFBF7] hover:bg-[#55E6C1] text-[#2D3436] text-xs font-black shadow-[2px_2px_0px_0px_#000] transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              title="엑셀(Excel) 및 스프레드시트 호환 CSV 파일 즉시 다운로드"
            >
              <FileSpreadsheet size={14} className="text-[#00B894]" />
              <span>📊 엑셀(CSV) 다운로드</span>
            </button>

            {/* 1-Click TSV Clipboard Copy Button */}
            <button
              type="button"
              onClick={handleCopyTsv}
              disabled={students.length === 0}
              className="px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-[#F8F9FA] text-[#2D3436] text-xs font-black shadow-[2px_2px_0px_0px_#000] transition-all disabled:opacity-40 flex items-center gap-1.5 cursor-pointer"
              title="구글 스프레드시트에 바로 붙여넣기(Ctrl+V)할 수 있는 표 복사"
            >
              {copiedTsv ? <Check size={14} className="text-[#00B894]" /> : <Copy size={14} />}
              <span>{copiedTsv ? '✓ 표 복사 완료!' : '📋 시트 복사용 복사'}</span>
            </button>

            <div className="flex items-center gap-1.5 text-xs text-[#636E72] font-bold pl-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#00B894] border border-black animate-pulse" />
              <span>실시간</span>
            </div>
          </div>
        </div>

        {students.length === 0 ? (
          <div className="text-center py-12 text-[#636E72] space-y-2">
            <p className="text-3xl">👥</p>
            <p className="font-black text-sm text-[#2D3436]">아직 접속한 학생이 없습니다.</p>
            <p className="text-xs font-bold">
              학생들에게 초대코드 <span className="text-[#D63031] font-mono font-black">[{session?.sessionId}]</span>를 공유해주세요!
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-black text-[#2D3436] font-mono uppercase bg-[#FFFBEB]">
                  <th className="py-2.5 px-3 font-black">이름 / 학번</th>
                  <th className="py-2.5 px-3 font-black">선택 직업</th>
                  <th className="py-2.5 px-3 font-black">퀴즈 보너스</th>
                  <th className="py-2.5 px-3 font-black">통장 배분 (생/저/투)</th>
                  <th className="py-2.5 px-3 font-black">현금 잔고</th>
                  <th className="py-2.5 px-3 font-black">주식 평가액</th>
                  <th className="py-2.5 px-3 font-black">총 자산 / 수익률</th>
                  <th className="py-2.5 px-3 text-center font-black">보너스 지급</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10">
                {students.map((s) => {
                  const profitRate = Number(s.profitRate ?? 0);
                  const isProfit = profitRate >= 0;
                  const quizBonus = Number(s.quizBonus ?? 0);
                  const cash = Number(s.cash ?? 0);
                  const stockValuation = Number(s.stockValuation ?? 0);
                  const totalAsset = Number(s.totalAsset ?? (cash + stockValuation));

                  return (
                    <tr key={s.studentId} className="hover:bg-[#FFFBEB]/50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-black text-[#2D3436] flex items-center gap-1.5">
                          <span>{s.name || '학생'}</span>
                          <span className="text-[10px] text-[#636E72] font-mono font-bold">({s.studentNum || '00'})</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-lg bg-white text-[#2D3436] font-mono text-[11px] border border-black font-bold">
                          {s.jobTitle || '미선택'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-mono font-black text-[#00B894]">
                          +{quizBonus.toLocaleString()}원
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        {s.budget ? (
                          <div className="font-mono text-[11px] text-[#2D3436] font-bold">
                            {s.budget.livingPercent}% / {s.budget.savingsPercent}% / {s.budget.investPercent}%
                          </div>
                        ) : (
                          <span className="text-[#A4B0BE] text-[11px] font-bold">미배분</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-mono text-[#2D3436] font-bold">
                        {cash.toLocaleString()}원
                      </td>
                      <td className="py-3 px-3 font-mono text-[#2D3436] font-bold">
                        {stockValuation.toLocaleString()}원
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono">
                          <div className="font-black text-[#2D3436]">{totalAsset.toLocaleString()}원</div>
                          <div className={`text-[11px] font-black ${isProfit ? 'text-[#D63031]' : 'text-[#0984E3]'}`}>
                            {isProfit ? '+' : ''}{profitRate.toFixed(2)}%
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            playSelectSound();
                            setSelectedStudentForBonus(s);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-[#FFD32D] hover:bg-[#FFC048] text-[#1A1A1A] border-2 border-black font-black text-xs shadow-[2px_2px_0px_0px_#000] transition-all active:translate-x-0.5 active:translate-y-0.5"
                        >
                          + 보너스
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PixelCard>

      {/* Bonus Award Modal */}
      {selectedStudentForBonus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <PixelCard className="w-full max-w-md bg-white border-4 border-black rounded-3xl shadow-[10px_10px_0px_0px_#000] p-6 text-[#2D3436]">
            <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-black">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#FFD32D] border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
                  <DollarSign className="text-[#1A1A1A]" size={18} />
                </div>
                <h3 className="font-black text-lg text-[#2D3436]">퀴즈 정답 보너스 지급</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudentForBonus(null)}
                className="text-[#636E72] hover:text-[#2D3436] text-lg font-black"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGiveBonus} className="space-y-4">
              <div className="bg-[#FFFBEB] p-3.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_0px_#000]">
                <div className="text-xs text-[#636E72] font-bold">지급 대상 학생</div>
                <div className="text-base font-black text-[#2D3436]">
                  {selectedStudentForBonus.name} ({selectedStudentForBonus.studentNum})
                </div>
                <div className="text-xs text-[#00B894] font-black mt-1">
                  현재 누적 보너스: +{selectedStudentForBonus.quizBonus.toLocaleString()}원
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-[#2D3436] mb-1.5">
                  보너스 지급 금액 (원)
                </label>
                <input
                  type="number"
                  step="10000"
                  value={bonusAmount}
                  onChange={(e) => setBonusAmount(e.target.value)}
                  className="w-full bg-white border-2 border-black rounded-xl px-3 py-2 text-[#2D3436] font-mono text-lg font-black outline-none focus:bg-[#FFFBEB]"
                />
              </div>

              {/* Presets */}
              <div className="grid grid-cols-4 gap-1.5">
                {[50000, 100000, 200000, 300000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      playSelectSound();
                      setBonusAmount(amt.toString());
                    }}
                    className={`py-1.5 rounded-xl border-2 border-black text-xs font-mono font-black transition-all ${
                      bonusAmount === amt.toString()
                        ? 'bg-[#FFD32D] text-[#1A1A1A] shadow-[2px_2px_0px_0px_#000]'
                        : 'bg-white text-[#636E72] hover:bg-[#F8F9FA]'
                    }`}
                  >
                    +{(amt / 10000).toFixed(0)}만
                  </button>
                ))}
              </div>

              {bonusMessage && (
                <div className="bg-[#EBFBF7] border-2 border-black text-[#00B894] text-xs p-2.5 rounded-xl text-center font-black shadow-[2px_2px_0px_0px_#000]">
                  {bonusMessage}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <PixelButton
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setSelectedStudentForBonus(null)}
                >
                  취소
                </PixelButton>
                <PixelButton
                  type="submit"
                  variant="gold"
                  className="flex-1"
                  disabled={isAwarding}
                >
                  {isAwarding ? '지급 중...' : '즉시 지급'}
                </PixelButton>
              </div>
            </form>
          </PixelCard>
        </div>
      )}

      {/* Google Sheets Sync & Web App Config Modal */}
      {showGasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
          <PixelCard className="w-full max-w-2xl bg-white border-4 border-black rounded-3xl shadow-[12px_12px_0px_0px_#000] p-6 text-[#2D3436] max-h-[90vh] overflow-y-auto space-y-5">
            <div className="flex items-center justify-between pb-3 border-b-2 border-black">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-[#00B894] text-white border-2 border-black rounded-xl shadow-[2px_2px_0px_0px_#000]">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h3 className="font-black text-lg text-[#2D3436]">구글 스프레드시트 실시간 연동</h3>
                  <p className="text-xs text-[#636E72] font-bold">가입한 학생 명단과 진행 세션 데이터를 구글 시트에 자동 기록합니다.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGasModal(false)}
                className="p-1.5 rounded-xl border-2 border-black bg-white hover:bg-[#F8F9FA] text-[#2D3436] font-black"
              >
                ✕
              </button>
            </div>

            {/* URL Input & Test Action */}
            <div className="space-y-2">
              <label className="block text-xs font-black text-[#2D3436]">
                구글 Apps Script 웹 앱 URL (Web App URL)
              </label>
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input
                  type="url"
                  placeholder="https://script.google.com/macros/s/.../exec"
                  value={gasUrlInput}
                  onChange={(e) => setGasUrlInput(e.target.value)}
                  className="flex-1 bg-white border-2 border-black rounded-xl px-3 py-2 text-xs font-mono text-[#2D3436] outline-none focus:bg-[#FFFBEB]"
                />
                <PixelButton
                  variant="gold"
                  size="sm"
                  onClick={handleSaveGasUrl}
                >
                  URL 저장
                </PixelButton>
                <PixelButton
                  variant="secondary"
                  size="sm"
                  disabled={isTestingGas || !gasUrlInput}
                  onClick={handleTestConnection}
                >
                  {isTestingGas ? '테스트 중...' : '🔗 연결 테스트'}
                </PixelButton>
              </div>

              {gasTestResult && (
                <div className="text-xs font-black p-2.5 rounded-xl border border-black bg-[#F8F9FA] shadow-[1px_1px_0px_0px_#000]">
                  {gasTestResult}
                </div>
              )}
            </div>

            {/* Instant Bulk Sync & Direct Export Options */}
            <div className="bg-[#FFFBEB] p-4 rounded-2xl border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-[#2D3436] flex items-center gap-1.5">
                    <Send size={15} className="text-[#D63031]" />
                    <span>현재 세션 전체 학생 데이터 즉시 전송</span>
                  </h4>
                  <p className="text-xs text-[#636E72] font-bold mt-0.5">
                    현재 세션 ({session?.sessionId})의 모든 학생 {students.length}명 정보와 자산/수익률을 즉시 기록합니다.
                  </p>
                </div>
                <PixelButton
                  variant="success"
                  size="sm"
                  disabled={isSyncingGas || !gasUrlInput}
                  onClick={handleTriggerBulkSync}
                >
                  {isSyncingGas ? '전송 중...' : '⚡ 지금 즉시 전송'}
                </PixelButton>
              </div>

              {gasSyncStatus && (
                <div className="text-xs font-black p-2.5 rounded-xl border border-black bg-white shadow-[1px_1px_0px_0px_#000]">
                  {gasSyncStatus}
                </div>
              )}

              {/* No-Setup Direct Alternatives */}
              <div className="pt-3 border-t border-black/10 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-[#636E72] font-bold">
                  💡 Apps Script 설정이 번거로우신가요? 1초 대안 기능:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadCsv}
                    className="px-2.5 py-1 bg-white hover:bg-[#F8F9FA] border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#000] flex items-center gap-1"
                  >
                    <FileSpreadsheet size={13} className="text-[#00B894]" />
                    <span>엑셀(CSV) 즉시 다운로드</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyTsv}
                    className="px-2.5 py-1 bg-white hover:bg-[#F8F9FA] border border-black rounded-lg text-xs font-black shadow-[1px_1px_0px_0px_#000] flex items-center gap-1"
                  >
                    <Copy size={13} />
                    <span>시트 붙여넣기용 복사</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Apps Script Guide & Code */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#2D3436] flex items-center gap-1">
                  <Code2 size={14} />
                  <span>Google Apps Script 복사용 코드 (확장 프로그램 &gt; Apps Script에 붙여넣기)</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(GAS_SCRIPT_CODE);
                    setCopiedScript(true);
                    playSelectSound();
                    setTimeout(() => setCopiedScript(false), 2000);
                  }}
                  className="text-xs font-black px-2.5 py-1 bg-white hover:bg-[#F8F9FA] rounded-lg border border-black shadow-[1px_1px_0px_0px_#000]"
                >
                  {copiedScript ? '✓ 코드 복사됨' : '📋 코드 복사'}
                </button>
              </div>

              <pre className="bg-[#2D3436] text-[#55E6C1] p-3.5 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border-2 border-black">
                {GAS_SCRIPT_CODE}
              </pre>
              <p className="text-[11px] text-[#636E72] font-bold">
                ※ 배포 방법: 구글 시트 상단 [확장 프로그램] ➔ [Apps Script] ➔ 코드 붙여넣기 후 [배포] ➔ [새 배포] ➔ 유형: 웹 앱 (액세스 권한: 모든 사용자)으로 배포한 URL을 위 입력창에 등록하세요.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <PixelButton
                variant="secondary"
                size="sm"
                onClick={() => setShowGasModal(false)}
              >
                닫기
              </PixelButton>
            </div>
          </PixelCard>
        </div>
      )}
    </div>
  );
};
