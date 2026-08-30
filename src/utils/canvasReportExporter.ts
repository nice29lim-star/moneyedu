import { FinalReport } from '../types';

export function generateReportCanvas(report: FinalReport): HTMLCanvasElement | null {

  const width = 800;
  const height = 1050;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background - Dark Navy Arcade Canvas
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, width, height);

  // Outer Golden Pixel Border
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 6;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  // Inner Accent Border
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 26, width - 52, height - 52);

  // Top Badge / Header
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(40, 45, width - 80, 80);
  ctx.strokeStyle = '#64748B';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 45, width - 80, 80);

  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 22px "Pretendard", "Apple SD Gothic Neo", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🎮 상업고등학교 금융교육 캠프 📈', width / 2, 78);

  ctx.fillStyle = '#38BDF8';
  ctx.font = 'bold 28px "Pretendard", "Apple SD Gothic Neo", sans-serif';
  ctx.fillText('모의주식 투자 종합 성적표 & 수료증', width / 2, 112);

  // Student Profile Card
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(40, 145, width - 80, 110);
  ctx.strokeStyle = '#475569';
  ctx.strokeRect(40, 145, width - 80, 110);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '16px sans-serif';
  ctx.fillText('학생 이름 / 학번', 60, 175);
  ctx.fillText('선택 직업 / 포지션', 340, 175);
  ctx.fillText('학급 내 최종 순위', 600, 175);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`${report.studentName} (${report.studentNum})`, 60, 210);
  ctx.fillText(`${report.jobTitle}`, 340, 210);

  ctx.fillStyle = '#FBBF24';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`${report.rank || 1}위 / ${report.totalStudents || 1}명`, 600, 210);

  // Investment Result Big Hero Box
  ctx.fillStyle = '#090D16';
  ctx.fillRect(40, 275, width - 80, 170);
  ctx.strokeStyle = report.profitRate >= 0 ? '#EF4444' : '#3B82F6';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 275, width - 80, 170);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('최종 누적 수익률 (ROI)', width / 2, 305);

  const isPositive = report.profitRate >= 0;
  ctx.fillStyle = isPositive ? '#EF4444' : '#3B82F6';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(`${isPositive ? '+' : ''}${report.profitRate.toFixed(2)}%`, width / 2, 355);

  // Asset Mini Boxes
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(
    `초기 투자원금: ${report.initialInvestment.toLocaleString()}원   ➔   최종 평가자산: ${report.finalTotalAsset.toLocaleString()}원`,
    width / 2,
    395
  );
  ctx.fillStyle = isPositive ? '#FCA5A5' : '#93C5FD';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(
    `순손익: ${isPositive ? '+' : ''}${report.totalProfit.toLocaleString()}원 (현금 ${report.finalCash.toLocaleString()}원 + 주식 ${report.finalStockValuation.toLocaleString()}원)`,
    width / 2,
    425
  );

  // Investor Type Badge & Analysis
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(40, 465, width - 80, 160);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 465, width - 80, 160);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText(`투자 성향 분석: [ ${report.investorType.badge} ] ${report.investorType.title}`, 60, 500);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '15px sans-serif';
  ctx.fillText(`“${report.investorType.description}”`, 60, 535);

  ctx.fillStyle = '#38BDF8';
  ctx.font = '14px sans-serif';
  ctx.fillText(`💡 마스터 피드백: ${report.investorType.tips}`, 60, 575);
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(`총 체결 거래: ${report.trades.length}건 / 보유 종목 수: ${report.holdings.length}개`, 60, 605);

  // Holdings & Trades Table Header
  ctx.fillStyle = '#334155';
  ctx.fillRect(40, 645, width - 80, 35);
  ctx.fillStyle = '#F1F5F9';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('최종 보유 종목 및 평가', 60, 668);
  ctx.fillText('수량', 380, 668);
  ctx.fillText('현재가', 500, 668);
  ctx.fillText('수익률', 660, 668);

  // Holdings list
  let y = 705;
  if (report.holdings.length === 0) {
    ctx.fillStyle = '#64748B';
    ctx.font = '15px sans-serif';
    ctx.fillText('보유 중인 주식이 없으며 전액 현금으로 마감했습니다.', 60, y);
    y += 40;
  } else {
    report.holdings.slice(0, 4).forEach((h) => {
      ctx.fillStyle = '#E2E8F0';
      ctx.font = '15px sans-serif';
      ctx.fillText(h.companyName, 60, y);
      ctx.fillText(`${h.quantity}주`, 380, y);
      ctx.fillText(`${h.currentPrice.toLocaleString()}원`, 500, y);

      const hPositive = h.profitRate >= 0;
      ctx.fillStyle = hPositive ? '#EF4444' : '#3B82F6';
      ctx.fillText(`${hPositive ? '+' : ''}${h.profitRate.toFixed(1)}%`, 660, y);
      y += 30;
    });
  }

  // Recent Trades
  ctx.fillStyle = '#334155';
  ctx.fillRect(40, y + 10, width - 80, 32);
  ctx.fillStyle = '#F1F5F9';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('최근 라운드 매매 이력', 60, y + 32);

  y += 65;
  if (report.trades.length === 0) {
    ctx.fillStyle = '#64748B';
    ctx.font = '14px sans-serif';
    ctx.fillText('기록된 매매 내역이 없습니다.', 60, y);
  } else {
    report.trades.slice(-3).forEach((t) => {
      ctx.fillStyle = '#94A3B8';
      ctx.font = '13px sans-serif';
      const actionColor = t.tradeType === 'BUY' ? '#EF4444' : '#3B82F6';
      ctx.fillStyle = actionColor;
      ctx.fillText(`[R${t.round} ${t.tradeType === 'BUY' ? '매수' : '매도'}]`, 60, y);
      ctx.fillStyle = '#E2E8F0';
      ctx.fillText(`${t.companyName} ${t.quantity}주 @ ${t.price.toLocaleString()}원 (총 ${t.totalAmount.toLocaleString()}원)`, 150, y);
      y += 24;
    });
  }

  // Stamp & Certification Bottom
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(40, height - 120, width - 80, 65);
  ctx.strokeStyle = '#F59E0B';
  ctx.strokeRect(40, height - 120, width - 80, 65);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`발급일자: ${new Date().toLocaleDateString('ko-KR')} | 검증코드: ${report.studentId}`, 60, height - 85);
  ctx.fillText('본 학생은 2D 게임풍 금융교육 캠프 3단 모듈(퀴즈/배분/모의주식)을 성실히 이수하였음을 증명합니다.', 60, height - 65);

  // Red Official Stamp Circle
  ctx.save();
  ctx.translate(width - 120, height - 85);
  ctx.rotate(-0.1);
  ctx.strokeStyle = '#DC2626';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 32, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#DC2626';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('금융교육', 0, -6);
  ctx.fillText('캠프인증', 0, 12);
  ctx.restore();

  // Download Trigger
  return canvas;
}

export function exportReportToCanvasImage(report: FinalReport) {
  const canvas = generateReportCanvas(report);
  if (!canvas) return;
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = 금융캠프_성적표__.png;
  link.href = dataUrl;
  link.click();
}
