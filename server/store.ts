import {
  BudgetAllocation,
  Company,
  FinalReport,
  Job,
  NewsItem,
  QuizItem,
  Session,
  StockHolding,
  StockTrade,
  Student,
  StudentAsset,
} from '../src/types';
import {
  INITIAL_COMPANIES,
  INITIAL_JOBS,
  INITIAL_NEWS_POOL,
  INITIAL_QUIZZES,
} from '../src/data/seedData';

export class AppStore {
  public sessions: Map<string, Session> = new Map();
  public students: Map<string, Student> = new Map(); // key: `${sessionId}:${studentId}`
  public jobs: Job[] = [...INITIAL_JOBS];
  public quizzes: QuizItem[] = [...INITIAL_QUIZZES];
  public sessionCompanies: Map<string, Company[]> = new Map(); // sessionId -> companies
  public newsPool: NewsItem[] = [...INITIAL_NEWS_POOL];
  public usedNewsIds: Map<string, Set<number>> = new Map(); // sessionId -> Set of used news ids
  public trades: Map<string, StockTrade[]> = new Map(); // sessionId -> trades
  public teacherTokens: Set<string> = new Set();
  public holdings: Map<string, Map<string, StockHolding>> = new Map(); // key: `${sessionId}:${studentId}` -> companyName -> holding

  constructor() {
    this.resetData();
  }

  public resetData() {
    this.sessions.clear();
    this.students.clear();
    this.sessionCompanies.clear();
    this.usedNewsIds.clear();
    this.trades.clear();
    this.holdings.clear();
    this.teacherTokens.clear();
  }

  public verifyTeacherToken(token?: string): boolean {
    if (!token) return false;
    return this.teacherTokens.has(token);
  }

  public addTeacherToken(token: string) {
    this.teacherTokens.add(token);
  }

  public createSession(preferredId?: string): Session {
    let code = preferredId?.toUpperCase() || '';
    if (!code) {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      code = 'FC' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }

    const session: Session = {
      sessionId: code,
      createdAt: Date.now(),
      currentModule: 'lobby',
      stockRound: 0,
      stockState: 'waiting',
      currentQuizIndex: 0,
      revealedNewsIds: [],
      activeNewsSlots: Array.from({ length: 6 }, (_, i) => ({
        slotIndex: i,
        news: null,
        isRevealed: false,
      })),
      isCompleted: false,
    };

    this.sessions.set(code, session);
    // Deep clone companies for this session
    this.sessionCompanies.set(
      code,
      INITIAL_COMPANIES.map((c) => ({
        ...c,
        priceHistory: [c.initialPrice],
        currentPrice: c.initialPrice,
        changeRate: 0,
      }))
    );
    this.usedNewsIds.set(code, new Set());
    this.trades.set(code, []);

    return session;
  }

  public getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId.toUpperCase());
  }

  public getActiveSession(): Session | null {
    const allSessions = Array.from(this.sessions.values());
    if (allSessions.length === 0) return null;
    // Return most recent session
    return allSessions[allSessions.length - 1];
  }

  public getCompanies(sessionId: string): Company[] {
    const companies = this.sessionCompanies.get(sessionId.toUpperCase());
    if (companies) return companies;
    return INITIAL_COMPANIES;
  }

  public getStudentKey(sessionId: string, studentId: string): string {
    return `${sessionId.toUpperCase()}:${studentId}`;
  }

  public getStudent(sessionId: string, studentId: string): Student | undefined {
    return this.students.get(this.getStudentKey(sessionId, studentId));
  }

  public addStudent(sessionId: string, studentId: string, name: string): Student {
    const key = this.getStudentKey(sessionId, studentId);
    const existing = this.students.get(key);
    if (existing) return existing;

    const student: Student = {
      sessionId: sessionId.toUpperCase(),
      studentId,
      name,
      studentNum: '01',
      loginTime: Date.now(),
      quizBonus: 0,
      cash: 0,
      initialInvestment: 0,
      lastTradeRound: -1,
    };
    this.students.set(key, student);
    return student;
  }

  public getStudentsInSession(sessionId: string): Student[] {
    const code = sessionId.toUpperCase();
    const list: Student[] = [];
    for (const [key, student] of this.students.entries()) {
      if (key.startsWith(`${code}:`)) {
        list.push(student);
      }
    }
    return list;
  }

  public getStudentHoldings(sessionId: string, studentId: string): Record<string, StockHolding> {
    const key = this.getStudentKey(sessionId, studentId);
    let map = this.holdings.get(key);
    if (!map) {
      map = new Map();
      this.holdings.set(key, map);
    }
    const result: Record<string, StockHolding> = {};
    for (const [companyName, holding] of map.entries()) {
      result[companyName] = { ...holding };
    }
    return result;
  }

  public calculatePayslip(jobId: number): {
    grossSalary: number;
    nationalPension: number;
    healthInsurance: number;
    careInsurance: number;
    employmentInsurance: number;
    incomeTax: number;
    totalDeductions: number;
    netSalary: number;
  } {
    const job = this.jobs.find((j) => j.id === jobId) || this.jobs[0];
    const gross = job.monthlySalary;
    const nationalPension = Math.floor(gross * 0.045);
    const healthInsurance = Math.floor(gross * 0.0354);
    const careInsurance = Math.floor(healthInsurance * 0.1281); // ~0.45%
    const employmentInsurance = Math.floor(gross * 0.009);
    const incomeTax = Math.floor(gross * 0.032);
    const totalDeductions =
      nationalPension + healthInsurance + careInsurance + employmentInsurance + incomeTax;
    const netSalary = gross - totalDeductions;

    return {
      grossSalary: gross,
      nationalPension,
      healthInsurance,
      careInsurance,
      employmentInsurance,
      incomeTax,
      totalDeductions,
      netSalary,
    };
  }

  public saveStudentBudget(
    sessionId: string,
    studentId: string,
    jobId: number,
    livingPercent: number,
    savingsPercent: number,
    investPercent: number
  ): BudgetAllocation | null {
    const student = this.getStudent(sessionId, studentId);
    if (!student) return null;

    const job = this.jobs.find((j) => j.id === jobId) || this.jobs[0];
    student.selectedJob = job;

    const slip = this.calculatePayslip(jobId);
    const totalAvailable = slip.netSalary + student.quizBonus;

    const livingAmount = Math.floor((totalAvailable * livingPercent) / 100);
    const savingsAmount = Math.floor((totalAvailable * savingsPercent) / 100);
    const investAmount = totalAvailable - livingAmount - savingsAmount; // Exact rounding balance

    const budget: BudgetAllocation = {
      sessionId: sessionId.toUpperCase(),
      studentId,
      jobId,
      jobTitle: job.title,
      grossSalary: slip.grossSalary,
      netSalary: slip.netSalary,
      quizBonus: student.quizBonus,
      totalAvailable,
      livingPercent,
      savingsPercent,
      investPercent,
      livingAmount,
      savingsAmount,
      investAmount,
      savedAt: Date.now(),
    };

    student.budget = budget;
    // Investment money becomes the student's mock stock trading cash
    student.cash = investAmount;
    student.initialInvestment = investAmount;

    return budget;
  }

  public getStudentAsset(sessionId: string, studentId: string): StudentAsset | null {
    const student = this.getStudent(sessionId, studentId);
    if (!student) return null;

    const session = this.getSession(sessionId);
    const companies = this.getCompanies(sessionId);
    const companyPriceMap = new Map(companies.map((c) => [c.name, c.currentPrice]));

    const holdings = this.getStudentHoldings(sessionId, studentId);
    let totalStockValuation = 0;

    for (const [companyName, holding] of Object.entries(holdings)) {
      if (holding.quantity > 0) {
        const curPrice = companyPriceMap.get(companyName) || holding.avgBuyPrice;
        totalStockValuation += holding.quantity * curPrice;
      }
    }

    const totalAsset = (student.cash || 0) + totalStockValuation;
    const initial = student.initialInvestment > 0 ? student.initialInvestment : (student.budget ? student.budget.investAmount : 0);
    const profitAmount = initial > 0 ? totalAsset - initial : 0;
    const profitRate = initial > 0 ? parseFloat(((profitAmount / initial) * 100).toFixed(2)) : 0;
    const tradedThisRound =
      session ? student.lastTradeRound === session.stockRound : false;

    return {
      studentId,
      studentName: student.name,
      cash: student.cash || 0,
      initialInvestment: initial,
      holdings,
      totalStockValuation,
      totalAsset,
      profitAmount,
      profitRate,
      tradedThisRound,
      lastTradeRound: student.lastTradeRound ?? -1,
    };
  }

  // Prepare 6 candidates for the round
  public prepareRoundCandidates(sessionId: string): {
    slots: { slotIndex: number; news: NewsItem | null; isRevealed: boolean }[];
  } {
    const session = this.getSession(sessionId);
    if (!session) return { slots: [] };

    // If slots already exist for this round, return them
    if (session.activeNewsSlots && session.activeNewsSlots.length === 6 && session.activeNewsSlots.some((s) => s.news !== null)) {
      return { slots: session.activeNewsSlots };
    }

    const usedSet = this.usedNewsIds.get(sessionId.toUpperCase()) || new Set<number>();
    const availableNews = this.newsPool.filter((n) => !usedSet.has(n.id));

    // Pick 6 news candidates
    const shuffled = [...availableNews].sort(() => Math.random() - 0.5);
    const candidates = shuffled.slice(0, 6);

    // If available pool exhausted, fallback to any news not already picked in this round
    if (candidates.length < 6) {
      const pickedIds = new Set(candidates.map((c) => c.id));
      const remainingPool = [...this.newsPool]
        .filter((n) => !pickedIds.has(n.id))
        .sort(() => Math.random() - 0.5);
      candidates.push(...remainingPool.slice(0, 6 - candidates.length));
    }

    session.activeNewsSlots = candidates.map((news, idx) => ({
      slotIndex: idx,
      news: { ...news, roundAppeared: session.stockRound },
      isRevealed: false,
    }));
    session.revealedNewsIds = [];

    return { slots: session.activeNewsSlots };
  }

  // Flip a slot (Teacher clicks 1 of the 6 cards)
  public flipSlot(sessionId: string, slotIndex: number): {
    ok: boolean;
    session: Session;
    slots: { slotIndex: number; news: NewsItem | null; isRevealed: boolean }[];
    revealedNews: NewsItem[];
    revealedCount: number;
    message: string;
  } {
    const session = this.getSession(sessionId);
    if (!session) {
      return { ok: false, session: null as any, slots: [], revealedNews: [], revealedCount: 0, message: '세션이 없습니다.' };
    }

    if (!session.activeNewsSlots || session.activeNewsSlots.length !== 6 || !session.activeNewsSlots[0]?.news) {
      this.prepareRoundCandidates(sessionId);
    }

    const targetSlot = session.activeNewsSlots.find((s) => s.slotIndex === slotIndex);
    if (!targetSlot || !targetSlot.news) {
      return { ok: false, session, slots: session.activeNewsSlots, revealedNews: [], revealedCount: 0, message: '슬롯을 찾을 수 없습니다.' };
    }

    const currentlyRevealed = session.activeNewsSlots.filter((s) => s.isRevealed);

    if (targetSlot.isRevealed) {
      targetSlot.isRevealed = false;
    } else {
      if (currentlyRevealed.length >= 3) {
        return {
          ok: false,
          session,
          slots: session.activeNewsSlots,
          revealedNews: session.activeNewsSlots.filter((s) => s.isRevealed).map((s) => s.news!),
          revealedCount: currentlyRevealed.length,
          message: '이미 3개의 뉴스가 선택되었습니다. 다른 카드를 선택하려면 기존 카드를 다시 클릭하여 닫으세요.',
        };
      }
      targetSlot.isRevealed = true;
    }

    const newRevealedSlots = session.activeNewsSlots.filter((s) => s.isRevealed);
    const newRevealedNews = newRevealedSlots.map((s) => s.news!).filter(Boolean);
    session.revealedNewsIds = newRevealedNews.map((n) => n.id);

    return {
      ok: true,
      session,
      slots: session.activeNewsSlots,
      revealedNews: newRevealedNews,
      revealedCount: newRevealedSlots.length,
      message: `${newRevealedSlots.length}/3개 선택됨.`,
    };
  }

  // Teacher sends chosen news to students
  public sendNews(
    sessionId: string,
    revealedNewsIds: number[],
    slots: { slotIndex: number; news: NewsItem | null; isRevealed: boolean }[]
  ): { ok: boolean; session: Session | null } {
    const session = this.getSession(sessionId);
    if (!session) return { ok: false, session: null };

    session.stockState = 'news';
    session.revealedNewsIds = revealedNewsIds;
    session.activeNewsSlots = slots;

    // Track used news IDs to avoid repeating in future rounds
    const usedSet = this.usedNewsIds.get(sessionId.toUpperCase()) || new Set<number>();
    revealedNewsIds.forEach((id) => usedSet.add(id));
    this.usedNewsIds.set(sessionId.toUpperCase(), usedSet);

    return { ok: true, session };
  }

  // Reset candidates
  public resetRoundSlots(sessionId: string): {
    slots: { slotIndex: number; news: NewsItem | null; isRevealed: boolean }[];
  } {
    const session = this.getSession(sessionId);
    if (!session) return { slots: [] };

    session.activeNewsSlots = [];
    session.revealedNewsIds = [];
    session.stockState = 'waiting';
    return this.prepareRoundCandidates(sessionId);
  }

  public revealNewsForRound(sessionId: string, count: number = 3): {
    revealedNews: NewsItem[];
    slots: { slotIndex: number; news: NewsItem | null; isRevealed: boolean }[];
  } {
    const session = this.getSession(sessionId);
    if (!session) return { revealedNews: [], slots: [] };

    if (!session.activeNewsSlots || session.activeNewsSlots.length !== 6 || !session.activeNewsSlots[0]?.news) {
      this.prepareRoundCandidates(sessionId);
    }

    // Pick 3 random slots among 0..5
    const slotIndices = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
    const pickedSlots = slotIndices.slice(0, count);

    session.activeNewsSlots.forEach((slot, idx) => {
      slot.isRevealed = pickedSlots.includes(idx);
    });

    const revealed = session.activeNewsSlots.filter((s) => s.isRevealed).map((s) => s.news!).filter(Boolean);
    session.revealedNewsIds = revealed.map((p) => p.id);

    const usedSet = this.usedNewsIds.get(sessionId.toUpperCase()) || new Set<number>();
    revealed.forEach((item) => {
      usedSet.add(item.id);
    });
    this.usedNewsIds.set(sessionId.toUpperCase(), usedSet);

    session.stockState = 'news';

    return {
      revealedNews: revealed,
      slots: session.activeNewsSlots,
    };
  }

  public executeTrade(
    sessionId: string,
    studentId: string,
    companyName: string,
    tradeType: 'BUY' | 'SELL',
    quantity: number
  ): { ok: boolean; message: string; asset?: StudentAsset } {
    let session = this.getSession(sessionId);
    if (!session) {
      session = this.createSession(sessionId);
      session.stockState = 'trading';
    }

    let student = this.getStudent(sessionId, studentId);
    if (!student) {
      student = this.addStudent(sessionId, studentId, `학생_${studentId.substring(0, 4)}`);
    }

    if (quantity <= 0 || !Number.isInteger(quantity)) {
      return { ok: false, message: '수량은 1주 이상 정수여야 합니다.' };
    }

    const companies = this.getCompanies(sessionId);
    const company = companies.find((c) => c.name === companyName);
    if (!company) return { ok: false, message: '기업 정보를 찾을 수 없습니다.' };

    const totalAmount = company.currentPrice * quantity;
    const key = this.getStudentKey(sessionId, studentId);
    let holdingMap = this.holdings.get(key);
    if (!holdingMap) {
      holdingMap = new Map();
      this.holdings.set(key, holdingMap);
    }

    const currentHolding = holdingMap.get(companyName) || {
      companyName,
      quantity: 0,
      avgBuyPrice: 0,
    };

    if (tradeType === 'BUY') {
      if (student.cash < totalAmount) {
        return {
          ok: false,
          message: `현금 잔고가 부족합니다. (필요: ${totalAmount.toLocaleString()}원, 보유: ${student.cash.toLocaleString()}원)`,
        };
      }
      student.cash -= totalAmount;
      const newQty = currentHolding.quantity + quantity;
      const newTotalCost =
        currentHolding.quantity * currentHolding.avgBuyPrice + totalAmount;
      currentHolding.avgBuyPrice = Math.round(newTotalCost / newQty);
      currentHolding.quantity = newQty;
      holdingMap.set(companyName, currentHolding);
    } else {
      // SELL
      if (currentHolding.quantity < quantity) {
        return {
          ok: false,
          message: `보유 주식이 부족합니다. (보유: ${currentHolding.quantity}주, 매도요청: ${quantity}주)`,
        };
      }
      student.cash += totalAmount;
      currentHolding.quantity -= quantity;
      if (currentHolding.quantity === 0) {
        currentHolding.avgBuyPrice = 0;
      }
      holdingMap.set(companyName, currentHolding);
    }

    student.lastTradeRound = session.stockRound;

    // Record trade
    const tradeLog: StockTrade = {
      id: `TR_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      sessionId: session.sessionId,
      studentId: student.studentId,
      studentName: student.name,
      round: session.stockRound,
      companyName,
      tradeType,
      quantity,
      price: company.currentPrice,
      totalAmount,
    };

    const sessionTrades = this.trades.get(session.sessionId) || [];
    sessionTrades.push(tradeLog);
    this.trades.set(session.sessionId, sessionTrades);

    const asset = this.getStudentAsset(sessionId, studentId);
    return { ok: true, message: `${companyName} ${quantity}주 ${tradeType === 'BUY' ? '매수' : '매도'} 완료!`, asset: asset || undefined };
  }

  public closeTradingAndApplyPriceChanges(sessionId: string): {
    nextRound: number;
    isCompleted: boolean;
    companies: Company[];
  } {
    const session = this.getSession(sessionId);
    if (!session) return { nextRound: 1, isCompleted: false, companies: [] };

    const companies = this.getCompanies(sessionId);
    const revealedNews = this.newsPool.filter((n) => session.revealedNewsIds.includes(n.id));

    // Calculate price changes for each company (if round >= 1)
    if (session.stockRound >= 1 && revealedNews.length > 0) {
      for (const company of companies) {
        let impactPercent = 0;
        const matchingNews = revealedNews.filter(
          (n) =>
            n.targetCompany === company.name ||
            (n.targetIndustry && company.industry.includes(n.targetIndustry))
        );

        if (matchingNews.length > 0) {
          impactPercent = matchingNews.reduce((acc, curr) => acc + curr.impactRate, 0);
        } else {
          // Minor market fluctuation (-3% ~ +3%)
          impactPercent = Math.floor(Math.random() * 7) - 3;
        }

        // Max fluctuation bounds (-30% ~ +35%)
        impactPercent = Math.max(-30, Math.min(35, impactPercent));

        const oldPrice = company.currentPrice;
        const changeAmount = Math.round((oldPrice * impactPercent) / 100);
        // Round to nearest 100 KRW
        let newPrice = Math.max(1000, Math.round((oldPrice + changeAmount) / 100) * 100);

        company.currentPrice = newPrice;
        company.changeRate = parseFloat((((newPrice - oldPrice) / oldPrice) * 100).toFixed(2));
        company.priceHistory.push(newPrice);
      }
    }

    if (session.stockRound === 0) {
      session.stockRound = 1;
      session.stockState = 'waiting';
      session.revealedNewsIds = [];
      session.activeNewsSlots = [];
      return {
        nextRound: 1,
        isCompleted: false,
        companies,
      };
    } else if (session.stockRound < 5) {
      session.stockRound += 1;
      session.stockState = 'waiting';
      session.revealedNewsIds = [];
      session.activeNewsSlots = [];
      return {
        nextRound: session.stockRound,
        isCompleted: false,
        companies,
      };
    } else {
      session.stockState = 'closed';
      session.isCompleted = true;
      session.currentModule = 'report';
      return {
        nextRound: 5,
        isCompleted: true,
        companies,
      };
    }
  }

  public getFinalReport(sessionId: string, studentId: string): FinalReport | null {
    const student = this.getStudent(sessionId, studentId);
    if (!student) return null;

    const asset = this.getStudentAsset(sessionId, studentId);
    if (!asset) return null;

    const companies = this.getCompanies(sessionId);
    const companyPriceMap = new Map(companies.map((c) => [c.name, c.currentPrice]));

    const holdingsList: FinalReport['holdings'] = [];
    for (const [companyName, holding] of Object.entries(asset.holdings)) {
      if (holding.quantity > 0) {
        const curPrice = companyPriceMap.get(companyName) || holding.avgBuyPrice;
        const valuation = holding.quantity * curPrice;
        const profitRate =
          holding.avgBuyPrice > 0
            ? parseFloat((((curPrice - holding.avgBuyPrice) / holding.avgBuyPrice) * 100).toFixed(2))
            : 0;
        holdingsList.push({
          companyName,
          quantity: holding.quantity,
          avgBuyPrice: holding.avgBuyPrice,
          currentPrice: curPrice,
          valuation,
          profitRate,
        });
      }
    }

    const sessionTrades = (this.trades.get(sessionId.toUpperCase()) || []).filter(
      (t) => t.studentId === studentId
    );

    // Calculate class ranking
    const allStudents = this.getStudentsInSession(sessionId);
    const studentAssets = allStudents.map((s) => {
      const a = this.getStudentAsset(sessionId, s.studentId);
      return { studentId: s.studentId, totalAsset: a?.totalAsset || 0, profitRate: a?.profitRate || 0 };
    });
    studentAssets.sort((a, b) => b.profitRate - a.profitRate);
    const rankIndex = studentAssets.findIndex((s) => s.studentId === studentId);
    const rank = rankIndex >= 0 ? rankIndex + 1 : 1;

    // Determine investor type and personalized analysis
    let investorType = {
      title: '균형 잡힌 스마트 자산가',
      badge: '⚖️ 밸런스 마스터',
      description: '시장 상황을 냉철하게 관찰하며 적절한 시점에 분산 투자를 집행한 합리적 투자자입니다.',
      tips: '시장의 호재와 악재 뉴스를 꼼꼼히 대조하며 다음 라운드 가격 변동을 잘 예측했습니다.',
    };

    if (asset.profitRate >= 20) {
      investorType = {
        title: '월가의 차세대 워런 버핏',
        badge: '🏆 슈퍼 알파 투자왕',
        description: '탁월한 호재 포착 능력과 결단력 있는 투자로 시장을 압도하는 높은 수익률을 기록했습니다!',
        tips: '뉴스 속 숨겨진 실적 시그널을 민첩하게 읽어내어 높은 위험 대비 초과 수익을 달성했습니다.',
      };
    } else if (asset.profitRate > 0) {
      investorType = {
        title: '냉철한 데이터 기반 가치투자자',
        badge: '💎 가치 수호자',
        description: '급등락의 유혹에 휩쓸리지 않고 안정적인 이익을 꾸준히 지켜낸 모범적인 투자 전략입니다.',
        tips: '원금을 잃지 않는 투자가 장기 복리의 마법을 부릅니다. 아주 훌륭한 리스크 관리입니다.',
      };
    } else if (asset.profitRate <= -15) {
      investorType = {
        title: '경험을 통해 성장하는 용감한 모험가',
        badge: '🔥 턴어라운드 도전자',
        description: '과감한 승부수를 던졌으나 단기 악재 뉴스의 역풍을 맞았습니다. 실패는 성공의 가장 훌륭한 밑거름입니다.',
        tips: '단일 종목 몰빵 대신 상관관계가 낮은 여러 섹터로 분산 투자하면 하락장에서도 손실을 방어할 수 있습니다.',
      };
    } else {
      investorType = {
        title: '신중한 자본 보존가',
        badge: '🛡️ 철벽 방어왕',
        description: '자본의 안전성을 최우선으로 생각하여 변동성이 큰 시장에서도 침착하게 자산을 지켜냈습니다.',
        tips: '현금 보유 전략은 큰 하락장에서 빛을 발합니다. 앞으로는 확신이 드는 호재 종목에 분할 매수해보세요.',
      };
    }

    return {
      studentId: student.studentId,
      studentName: student.name,
      studentNum: student.studentNum,
      jobTitle: student.selectedJob?.title || '금융 꿈나무',
      initialInvestment: asset.initialInvestment,
      finalCash: asset.cash,
      finalStockValuation: asset.totalStockValuation,
      finalTotalAsset: asset.totalAsset,
      totalProfit: asset.profitAmount,
      profitRate: asset.profitRate,
      rank,
      totalStudents: allStudents.length,
      holdings: holdingsList,
      trades: sessionTrades,
      investorType,
    };
  }
}

export const appStore = new AppStore();
