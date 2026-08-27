import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RefreshCw,
  Zap,
  ExternalLink,
  PlusCircle,
  Play,
  ShieldCheck,
  HelpCircle,
  X,
} from 'lucide-react';
import { PixelBadge, PixelButton, PixelCard } from '../PixelUI';
import { playSelectSound, playSuccessSound, playBuzzerSound } from '../../utils/soundEffects';
import {
  getSupabaseConfig,
  setCustomSupabaseConfig,
  sanitizeSupabaseUrl,
  sanitizeSupabaseAnonKey,
  isSupabaseReady,
  supabaseDb,
  SUPABASE_SQL_SCHEMA,
} from '../../utils/supabaseClient';
import { Session } from '../../types';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionSelect?: (session: Session) => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  onSessionSelect,
}) => {
  const [url, setUrl] = useState(() => getSupabaseConfig().url);
  const [anonKey, setAnonKey] = useState(() => getSupabaseConfig().anonKey);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: {
      urlValid: boolean;
      authValid: boolean;
      tablesFound: string[];
      missingTables: string[];
    };
  } | null>(null);

  const [copiedSql, setCopiedSql] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'sql' | 'sessions'>('config');

  // Supabase Sessions list
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [newSessionCode, setNewSessionCode] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);
  const [sessionActionMsg, setSessionActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setUrl(cfg.url);
      setAnonKey(cfg.anonKey);
      if (isSupabaseReady()) {
        fetchSessions();
      }
    }
  }, [isOpen]);

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const list = await supabaseDb.getAllSessions();
      setSessions(list);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleSaveAndTest = async () => {
    if (!url.trim() || !anonKey.trim()) {
      playBuzzerSound();
      setTestResult({
        success: false,
        message: 'Supabase Project URL과 Anon Key를 모두 입력해주세요.',
      });
      return;
    }

    const cleanUrl = sanitizeSupabaseUrl(url);
    const cleanKey = sanitizeSupabaseAnonKey(anonKey);
    setUrl(cleanUrl);
    setAnonKey(cleanKey);

    setCustomSupabaseConfig(cleanUrl, cleanKey);
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await supabaseDb.testConnection();
      setTestResult(res);
      if (res.success) {
        playSuccessSound();
        fetchSessions();
      } else {
        playBuzzerSound();
      }
    } catch (e: any) {
      playBuzzerSound();
      setTestResult({
        success: false,
        message: `연결 테스트 중 오류 발생: ${e?.message || '알 수 없는 오류'}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    playSuccessSound();
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleCreateSessionInSb = async () => {
    const clean = (newSessionCode || '').trim().toUpperCase();
    if (!clean) {
      setSessionActionMsg({ type: 'error', text: '세션 코드를 입력해주세요. (예: 1001, CAMP01)' });
      return;
    }

    setCreatingSession(true);
    setSessionActionMsg(null);

    const newSess: Session = {
      sessionId: clean,
      currentModule: 'lobby',
      stockRound: 1,
      stockState: 'waiting',
      currentQuizIndex: 0,
      isCompleted: false,
      activeNewsSlots: [],
      revealedNewsIds: [1, 2, 3],
      createdAt: Date.now(),
    };

    const res = await supabaseDb.upsertSession(newSess);
    setCreatingSession(false);

    if (res.success) {
      playSuccessSound();
      setSessionActionMsg({ type: 'success', text: `✅ 세션 [${clean}]이 Supabase에 성공적으로 생성/초기화되었습니다!` });
      setNewSessionCode('');
      fetchSessions();
    } else {
      playBuzzerSound();
      setSessionActionMsg({ type: 'error', text: `❌ 세션 생성 실패: ${res.error}` });
    }
  };

  if (!isOpen) return null;

  const isConnected = isSupabaseReady();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <PixelCard className="w-full max-w-2xl bg-white border-4 border-black rounded-3xl shadow-[10px_10px_0px_0px_#000] text-[#2D3436] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b-2 border-black bg-[#F8F9FA]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00B894] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
              <Database className="text-white w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-[#2D3436]">
                  Supabase 클라우드 데이터베이스 설정
                </h3>
                {isConnected ? (
                  <PixelBadge variant="green">🟢 연결됨</PixelBadge>
                ) : (
                  <PixelBadge variant="red">🔴 미연결</PixelBadge>
                )}
              </div>
              <p className="text-xs text-[#636E72] font-bold">
                실시간 세션 진행, 학생 명단, 통장배분 및 모의주식 자산 실시간 동기화
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border-2 border-black hover:bg-gray-100 font-black transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b-2 border-black bg-white px-5 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 border-black transition-all ${
              activeTab === 'config'
                ? 'bg-white text-[#2D3436] translate-y-[2px] shadow-none'
                : 'bg-gray-100 text-[#636E72] hover:bg-gray-200'
            }`}
          >
            1. URL & Key 설정 & 테스트
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 border-black transition-all ${
              activeTab === 'sql'
                ? 'bg-white text-[#2D3436] translate-y-[2px] shadow-none'
                : 'bg-gray-100 text-[#636E72] hover:bg-gray-200'
            }`}
          >
            2. 1클릭 SQL 스키마 (테이블 생성)
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('sessions');
              fetchSessions();
            }}
            className={`px-4 py-2 text-xs font-black rounded-t-xl border-t-2 border-x-2 border-black transition-all ${
              activeTab === 'sessions'
                ? 'bg-white text-[#2D3436] translate-y-[2px] shadow-none'
                : 'bg-gray-100 text-[#636E72] hover:bg-gray-200'
            }`}
          >
            3. Supabase 세션 관리 ({sessions.length})
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'config' && (
            <div className="space-y-4">
              <div className="bg-[#E8F8F5] p-3.5 rounded-2xl border-2 border-[#00B894] text-xs font-bold text-[#006241] flex items-start gap-2">
                <ShieldCheck size={18} className="text-[#00B894] shrink-0 mt-0.5" />
                <div>
                  <strong>Supabase 프로젝트 정보 입력 안내:</strong>
                  <p className="mt-0.5 font-normal text-[11px] leading-relaxed">
                    Supabase 대시보드 (<strong>Project Settings &gt; API</strong>)에서 <strong>Project URL</strong>과 <strong>anon public key</strong>를 복사하여 입력하세요. 저장 시 브라우저 및 클라우드 동기화에 즉시 적용됩니다.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-[#2D3436] mb-1">
                  1. Supabase Project URL (https://xyz.supabase.co)
                </label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-project-id.supabase.co"
                  className="w-full bg-white border-2 border-black rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#2D3436] outline-none shadow-[2px_2px_0px_0px_#000] focus:border-[#00B894]"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-[#2D3436] mb-1">
                  2. Supabase Project Anon Public Key (eyJhbGciOi...)
                </label>
                <textarea
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  rows={3}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-white border-2 border-black rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#2D3436] outline-none shadow-[2px_2px_0px_0px_#000] focus:border-[#00B894] resize-none"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <PixelButton
                  variant="primary"
                  className="flex-1 py-3 text-xs"
                  onClick={handleSaveAndTest}
                  disabled={isTesting}
                >
                  <RefreshCw size={14} className={isTesting ? 'animate-spin' : ''} />
                  <span>{isTesting ? '연결 및 4개 테이블 진단 중...' : '저장 및 연결 테스트'}</span>
                </PixelButton>
              </div>

              {/* Test Diagnostics Result Box */}
              {testResult && (
                <div
                  className={`p-4 rounded-2xl border-3 border-black shadow-[3px_3px_0px_0px_#000] text-xs space-y-2 ${
                    testResult.success ? 'bg-[#D4EDDA] text-[#155724]' : 'bg-[#FFF3CD] text-[#856404]'
                  }`}
                >
                  <div className="flex items-center gap-2 font-black">
                    {testResult.success ? (
                      <CheckCircle2 size={18} className="text-[#00B894]" />
                    ) : (
                      <AlertTriangle size={18} className="text-[#F59E0B]" />
                    )}
                    <span>{testResult.message}</span>
                  </div>

                  {testResult.details && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/15 text-[11px] font-mono">
                      <div>
                        <strong>확인된 테이블:</strong>
                        <div className="text-[#00B894] font-bold">
                          {testResult.details.tablesFound.length > 0
                            ? testResult.details.tablesFound.join(', ')
                            : '없음'}
                        </div>
                      </div>
                      <div>
                        <strong>미생성 테이블:</strong>
                        <div className="text-[#D63031] font-bold">
                          {testResult.details.missingTables.length > 0
                            ? testResult.details.missingTables.join(', ') + ' (SQL 탭에서 생성 필요)'
                            : '없음 (모두 정상)'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#2D3436]">
                  Supabase SQL Editor 실행용 스크립트 (1클릭 복사)
                </span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="text-xs font-black bg-[#FFD32D] hover:bg-[#ffe066] text-[#1A1A1A] border-2 border-black rounded-xl px-3 py-1.5 shadow-[2px_2px_0px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedSql ? <Check size={14} className="text-emerald-700" /> : <Copy size={14} />}
                  <span>{copiedSql ? '복사 완료!' : 'SQL 전체 복사'}</span>
                </button>
              </div>

              <div className="bg-[#2D3436] p-3.5 rounded-2xl border-2 border-black max-h-[300px] overflow-y-auto">
                <pre className="text-[11px] text-[#55E6C1] font-mono whitespace-pre-wrap leading-relaxed">
                  {SUPABASE_SQL_SCHEMA}
                </pre>
              </div>

              <p className="text-[11px] text-[#636E72] font-bold">
                💡 복사 후 Supabase 웹사이트의 <strong>SQL Editor</strong> 메뉴에서 새 쿼리를 열고 붙여넣은 뒤 <strong>[Run]</strong> 버튼을 누르면 `sessions`, `students`, `student_assets`, `stock_trades` 테이블 및 실시간 구독이 즉시 활성화됩니다.
              </p>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="space-y-4">
              {/* Create new preset session code */}
              <div className="bg-[#F8F9FA] p-4 rounded-2xl border-2 border-black shadow-[3px_3px_0px_0px_#000] space-y-2">
                <label className="block text-xs font-black text-[#2D3436] flex items-center gap-1.5">
                  <PlusCircle size={15} className="text-[#00B894]" />
                  <span>Supabase에 새 세션 코드 미리 생성하기</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSessionCode}
                    onChange={(e) => setNewSessionCode(e.target.value.toUpperCase())}
                    placeholder="세션 코드 입력 (예: 1001, 7777, CAMP2026)"
                    className="flex-1 bg-white border-2 border-black rounded-xl px-3.5 py-2 text-xs font-mono font-black uppercase outline-none shadow-[2px_2px_0px_0px_#000]"
                  />
                  <PixelButton
                    variant="gold"
                    size="sm"
                    disabled={creatingSession || !isConnected}
                    onClick={handleCreateSessionInSb}
                  >
                    {creatingSession ? '생성 중...' : '세션 생성'}
                  </PixelButton>
                </div>

                {sessionActionMsg && (
                  <div
                    className={`text-xs font-black p-2 rounded-xl border border-black ${
                      sessionActionMsg.type === 'success'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {sessionActionMsg.text}
                  </div>
                )}
              </div>

              {/* Existing Supabase sessions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black text-[#2D3436]">
                    Supabase에 등록된 세션 목록 ({sessions.length}개)
                  </span>
                  <button
                    type="button"
                    onClick={fetchSessions}
                    disabled={loadingSessions}
                    className="text-[11px] font-black text-[#0984E3] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw size={12} className={loadingSessions ? 'animate-spin' : ''} />
                    <span>새로고침</span>
                  </button>
                </div>

                {sessions.length === 0 ? (
                  <div className="p-6 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 text-xs text-[#636E72] font-bold">
                    {isConnected
                      ? '등록된 세션이 없습니다. 위에서 세션 코드를 입력하여 생성해보세요.'
                      : 'Supabase가 아직 연결되지 않았습니다. [1. URL & Key 설정] 탭에서 설정을 완료해주세요.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {sessions.map((s) => (
                      <div
                        key={s.sessionId}
                        className="flex items-center justify-between p-3 bg-white hover:bg-[#FFFBEB] rounded-xl border-2 border-black shadow-[2px_2px_0px_0px_#000] transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black font-mono text-[#2D3436]">
                              {s.sessionId}
                            </span>
                            <PixelBadge variant={s.isCompleted ? 'slate' : 'gold'}>
                              {s.currentModule} • R{s.stockRound}
                            </PixelBadge>
                          </div>
                          <span className="text-[10px] text-[#636E72]">
                            생성일: {new Date(s.createdAt).toLocaleDateString()} {new Date(s.createdAt).toLocaleTimeString()}
                          </span>
                        </div>

                        {onSessionSelect && (
                          <PixelButton
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              onSessionSelect(s);
                              onClose();
                            }}
                          >
                            선택 &amp; 입장
                          </PixelButton>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t-2 border-black bg-[#F8F9FA] flex justify-end">
          <PixelButton variant="secondary" size="sm" onClick={onClose}>
            닫기
          </PixelButton>
        </div>
      </PixelCard>
    </div>
  );
};
