export type AppRole = 'teacher' | 'student';
export type AppStateModule = 'lobby' | 'quiz' | 'budget' | 'stock' | 'report';
export type StockRoundState = 'waiting' | 'news' | 'trading' | 'closed';
export type AppView =
  | 'landing'
  | 'teacher-login'
  | 'teacher-dashboard'
  | 'teacher-quiz'
  | 'teacher-budget'
  | 'teacher-stock'
  | 'teacher-report'
  | 'student-login'
  | 'student-lobby'
  | 'student-quiz'
  | 'student-budget'
  | 'student-stock'
  | 'student-report';

export interface Student {
  sessionId: string;
  studentId: string; // name_studentNum
  name: string;
  studentNum: string;
  loginTime: number;
  quizBonus: number;
  selectedJob?: Job;
  budget?: BudgetAllocation;
  cash: number;
  initialInvestment: number;
  lastTradeRound?: number;
  holdings?: any;
  stockValuation?: number;
  totalAsset?: number;
  profitRate?: number;
  profitAmount?: number;
}

export interface Session {
  sessionId: string; // Invite code (e.g. FIN2026)
  createdAt: number;
  currentModule: AppStateModule;
  stockRound: number; // 1 to 6
  stockState: StockRoundState; // waiting | news | trading | closed
  currentQuizIndex: number;
  revealedNewsIds: number[]; // news ids revealed in current round
  activeNewsSlots: { slotIndex: number; news: NewsItem | null; isRevealed: boolean }[];
  isCompleted: boolean;
}

export interface Job {
  id: number;
  title: string;
  category: string;
  monthlySalary: number; // 세전 기본급 (원)
  description: string;
  icon: string;
  color: string;
}

export interface Payslip {
  jobId: number;
  jobTitle: string;
  grossSalary: number; // 세전급여
  nationalPension: number; // 국민연금 (4.5%)
  healthInsurance: number; // 건강보험 (3.54%)
  careInsurance: number; // 장기요양보험 (0.45%)
  employmentInsurance: number; // 고용보험 (0.9%)
  incomeTax: number; // 소득세 (~3.2%)
  localIncomeTax?: number; // 지방소득세
  totalDeductions: number; // 공제 합계
  netSalary: number; // 실수령액
  quizBonus: number; // 퀴즈 보너스
  totalAvailable: number; // 총 가용자금 (실수령액 + 퀴즈보너스)
}

export interface BudgetAllocation {
  sessionId: string;
  studentId: string;
  jobId: number;
  jobTitle: string;
  grossSalary: number;
  netSalary: number;
  quizBonus: number;
  totalAvailable: number;
  livingPercent: number; // 생활비 %
  savingsPercent: number; // 저축 %
  investPercent: number; // 투자 %
  livingAmount: number;
  savingsAmount: number;
  investAmount: number;
  savedAt: number;
}

export interface QuizItem {
  id: number;
  question: string;
  options: string[];
  answerIndex: number; // 0 to 3
  explanation: string;
  category: string;
}

export interface Company {
  id: number;
  name: string;
  code: string;
  industry: string;
  initialPrice: number;
  currentPrice: number;
  priceHistory: number[]; // Initial + R1 + R2 + ...
  changeRate: number; // compared to previous round
  description: string;
  icon: string;
  color: string;
}

export interface NewsItem {
  id: number;
  targetCompany: string; // "삼송전자" or "전체" or "IT업계"
  targetIndustry?: string;
  title: string;
  content: string;
  impact: 'positive' | 'negative' | 'neutral';
  impactRate: number; // e.g. +15 for +15%, -20 for -20%
  roundAppeared?: number;
  usedInSession?: string;
}

export interface StockHolding {
  companyName: string;
  quantity: number;
  avgBuyPrice: number;
}

export interface StockTrade {
  id: string;
  timestamp: number;
  sessionId: string;
  studentId: string;
  studentName: string;
  round: number;
  companyName: string;
  tradeType: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  totalAmount: number;
}

export interface StudentAsset {
  studentId: string;
  studentName: string;
  cash: number;
  initialInvestment: number;
  holdings: Record<string, StockHolding>; // companyName -> holding
  totalStockValuation: number;
  totalAsset: number;
  profitAmount: number;
  profitRate: number; // %
  tradedThisRound: boolean;
  lastTradeType?: 'BUY' | 'SELL';
}

export interface FinalReport {
  studentId: string;
  studentName: string;
  name?: string;
  studentNum: string;
  jobTitle: string;
  selectedJob?: Job;
  budget?: BudgetAllocation;
  quizBonus?: number;
  initialInvestment: number;
  finalCash: number;
  finalStockValuation: number;
  finalTotalAsset: number;
  totalProfit: number;
  profitRate: number; // %
  rank?: number;
  totalStudents?: number;
  holdings: {
    companyName: string;
    quantity: number;
    avgBuyPrice: number;
    currentPrice: number;
    valuation: number;
    profitRate: number;
  }[];
  trades: StockTrade[];
  tradeHistory?: StockTrade[];
  investorType: {
    title: string;
    badge: string;
    description: string;
    tips: string;
  };
}
