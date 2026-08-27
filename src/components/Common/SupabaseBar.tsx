import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, AlertTriangle, Settings, RefreshCw } from 'lucide-react';
import { isSupabaseReady, getSupabaseConfig } from '../../utils/supabaseClient';
import { SupabaseModal } from './SupabaseModal';
import { Session } from '../../types';

interface SupabaseBarProps {
  onSessionSelect?: (session: Session) => void;
  compact?: boolean;
}

export const SupabaseBar: React.FC<SupabaseBarProps> = ({ onSessionSelect, compact = false }) => {
  const [showModal, setShowModal] = useState(false);
  const [ready, setReady] = useState(isSupabaseReady());
  const [url, setUrl] = useState(() => getSupabaseConfig().url);

  useEffect(() => {
    const update = () => {
      setReady(isSupabaseReady());
      setUrl(getSupabaseConfig().url);
    };
    update();
    const interval = setInterval(update, 3000);
    return () => clearInterval(interval);
  }, []);

  const maskedUrl = url
    ? url.replace(/https:\/\/(.*?)\.supabase\.co.*/, '$1.supabase.co')
    : '';

  if (compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black shadow-[2px_2px_0px_0px_#000] transition-all cursor-pointer ${
            ready
              ? 'bg-[#E8F8F5] text-[#006241] hover:bg-[#d1f2eb]'
              : 'bg-[#FFF3CD] text-[#856404] hover:bg-[#ffeaa7]'
          }`}
        >
          <Database size={13} className={ready ? 'text-[#00B894]' : 'text-[#F59E0B]'} />
          <span>{ready ? `DB 연동됨 (${maskedUrl})` : 'DB 미연결 (설정)'}</span>
          <Settings size={12} className="opacity-70" />
        </button>

        <SupabaseModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setReady(isSupabaseReady());
            setUrl(getSupabaseConfig().url);
          }}
          onSessionSelect={onSessionSelect}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={`w-full py-2 px-4 border-b-2 border-black flex items-center justify-between text-xs font-black transition-all ${
          ready
            ? 'bg-[#E8F8F5] text-[#006241]'
            : 'bg-[#FFF3CD] text-[#856404]'
        }`}
      >
        <div className="flex items-center gap-2">
          <Database size={15} className={ready ? 'text-[#00B894]' : 'text-[#F59E0B]'} />
          <span>
            {ready
              ? `🟢 Supabase 클라우드 데이터베이스 정상 연동됨 [${maskedUrl}]`
              : '⚠️ Supabase 클라우드 데이터베이스가 아직 연결되지 않았습니다 (현재 로컬 브라우저 모드)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1 bg-white hover:bg-gray-100 text-[#2D3436] px-2.5 py-1 rounded-lg border border-black shadow-[1px_1px_0px_0px_#000] cursor-pointer text-[11px]"
          >
            <Settings size={12} />
            <span>{ready ? 'DB 설정 / 세션 관리' : 'Supabase 연결 설정하기'}</span>
          </button>
        </div>
      </div>

      <SupabaseModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setReady(isSupabaseReady());
          setUrl(getSupabaseConfig().url);
        }}
        onSessionSelect={onSessionSelect}
      />
    </>
  );
};
