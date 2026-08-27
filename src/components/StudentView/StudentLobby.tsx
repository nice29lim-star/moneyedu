import React from 'react';
import { Gamepad2, Sparkles, Clock, ShieldCheck, Coins, BookOpen } from 'lucide-react';
import { Student, Session } from '../../types';
import { PixelBadge, PixelCard } from '../PixelUI';

interface StudentLobbyProps {
  student: Student;
  session: Session | null;
}

export const StudentLobby: React.FC<StudentLobbyProps> = ({ student, session }) => {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Player Status Card */}
      <PixelCard className="bg-white border-4 border-black p-6 rounded-3xl shadow-[8px_8px_0px_0px_#000] text-[#2D3436]">
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="w-20 h-20 rounded-2xl bg-[#74B9FF] border-4 border-black flex items-center justify-center text-4xl shadow-[3px_3px_0px_0px_#000]">
            🕹️
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <PixelBadge variant="blue">플레이어 로그인</PixelBadge>
              <span className="text-xs text-[#636E72] font-mono font-bold">
                세션 코드: {session?.sessionId}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#2D3436]">
              {student.name} <span className="text-[#0984E3] text-lg font-mono">({student.studentNum})</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#636E72] font-bold">
              상업고등학교 금융교육 캠프에 오신 것을 환영합니다!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <div className="bg-[#FFFBEB] p-3.5 rounded-2xl border-2 border-black text-center sm:text-right shadow-[2px_2px_0px_0px_#000]">
              <span className="text-[11px] text-[#636E72] block font-black">현재 보유 잔액</span>
              <span className="text-lg font-black text-[#D63031] font-mono">
                {(student.cash || 0).toLocaleString()}원
              </span>
            </div>

            <div className="bg-[#EBFBF7] p-3.5 rounded-2xl border-2 border-black text-center sm:text-right shadow-[2px_2px_0px_0px_#000]">
              <span className="text-[11px] text-[#636E72] block font-black">누적 퀴즈 보너스</span>
              <span className="text-lg font-black text-[#00B894] font-mono">
                +{(student.quizBonus || 0).toLocaleString()}원
              </span>
            </div>
          </div>
        </div>
      </PixelCard>

      {/* Waiting Indicator Card */}
      <PixelCard className="bg-white border-4 border-black text-center py-10 px-4 space-y-4 rounded-3xl shadow-[8px_8px_0px_0px_#000] text-[#2D3436]">
        <div className="inline-flex p-4 rounded-2xl bg-[#FFD32D] border-4 border-black text-[#1A1A1A] animate-bounce shadow-[3px_3px_0px_0px_#000]">
          <Clock size={36} />
        </div>
        <div>
          <h3 className="text-xl font-black text-[#2D3436]">
            강사님의 다음 모듈 시작을 기다리는 중입니다...
          </h3>
          <p className="text-sm text-[#636E72] mt-1 max-w-md mx-auto font-bold">
            선생님이 1단계 퀴즈 모듈 또는 통장배분을 시작하면 화면이 자동으로 전환됩니다. 앞 화면에 집중해주세요!
          </p>
        </div>
        <div className="inline-flex items-center gap-2 bg-[#1A1A1A] text-[#55E6C1] px-4 py-2 rounded-full border-2 border-black text-xs font-mono font-black shadow-[2px_2px_0px_0px_#000]">
          <span className="w-2 h-2 rounded-full bg-[#55E6C1] animate-ping" />
          <span>실시간 세션 연결 정상 동기화 중</span>
        </div>
      </PixelCard>

      {/* 3 Step Guide Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <PixelCard borderVariant="vibrantYellow" className="bg-[#FFFBEB] p-5 space-y-2">
          <div className="flex items-center gap-2 text-[#1A1A1A] font-black text-sm">
            <span>💡 1단계 퀴즈</span>
          </div>
          <p className="text-xs text-[#2D3436] font-bold leading-relaxed">
            금융 상식 퀴즈를 풀고 정답을 맞추면 모의주식 투자에 쓰일 시드머니 보너스를 즉시 획득합니다!
          </p>
        </PixelCard>

        <PixelCard borderVariant="vibrantGreen" className="bg-[#EBFBF7] p-5 space-y-2">
          <div className="flex items-center gap-2 text-[#1A1A1A] font-black text-sm">
            <span>💰 2단계 통장배분</span>
          </div>
          <p className="text-xs text-[#2D3436] font-bold leading-relaxed">
            원하는 직업을 선택하고 월급명세서(4대보험 공제)를 확인한 뒤, 생활비/저축/투자 비율을 스마트하게 배분하세요.
          </p>
        </PixelCard>

        <PixelCard borderVariant="vibrantPink" className="bg-[#FFF0F0] p-5 space-y-2">
          <div className="flex items-center gap-2 text-[#1A1A1A] font-black text-sm">
            <span>📈 3단계 모의주식</span>
          </div>
          <p className="text-xs text-[#2D3436] font-bold leading-relaxed">
            총 5라운드 동안 뉴스를 분석하고 라운드당 1회 신중하게 매수/매도하여 최고의 수익률에 도전하세요!
          </p>
        </PixelCard>
      </div>
    </div>
  );
};
