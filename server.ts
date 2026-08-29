import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { appStore } from './server/store';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Teacher password from env or default '0000'
  const TEACHER_PASSWORD = process.env.TEACHER_PASSWORD || '0000';

  // API Middleware for teacher token verification
  const requireTeacher = (req: Request, res: Response, next: () => void) => {
    const token = (req.headers['x-teacher-token'] as string) || (req.body?.token as string) || (req.query?.token as string);
    if (!token || !appStore.verifyTeacherToken(token)) {
      res.status(401).json({ ok: false, message: '강사 인증 토큰이 유효하지 않거나 만료되었습니다.' });
      return;
    }
    next();
  };

  // --- API Endpoints ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
  });

  // 1. Teacher Login
  app.post('/api/teacher/login', (req, res) => {
    const { password } = req.body;
    if (password === TEACHER_PASSWORD) {
      const token = `TKN_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      appStore.addTeacherToken(token);
      res.json({ ok: true, token, message: '로그인 성공!' });
    } else {
      res.status(401).json({ ok: false, message: '비밀번호가 일치하지 않습니다.' });
    }
  });

  // 1.1 Teacher Auth Validate
  app.get('/api/teacher/auth/validate', (req, res) => {
    const token = (req.query.token as string) || (req.headers['x-teacher-token'] as string);
    if (!token || !appStore.verifyTeacherToken(token)) {
      res.status(401).json({ ok: false, message: '인증되지 않은 교사 토큰입니다.' });
      return;
    }
    const activeSession = appStore.getActiveSession();
    res.json({ ok: true, activeSession });
  });

  // 2. Initialize Database (Reset Seed Data)
  app.post('/api/init-db', requireTeacher, (req, res) => {
    appStore.resetData();
    res.json({
      ok: true,
      message: '데이터베이스가 초기화되었습니다. (직업 6종, 퀴즈 20종, 기업 10종, 뉴스 50종 준비 완료)',
    });
  });

  // 3. Start Session
  app.post('/api/session/start', requireTeacher, (req, res) => {
    const { preferredCode } = req.body;
    const session = appStore.createSession(preferredCode);
    res.json({ ok: true, session, inviteCode: session.sessionId });
  });

  // 4. Polling endpoint for both student and teacher
  app.get('/api/session/poll', (req, res) => {
    const sessionId = (req.query.sessionId as string)?.toUpperCase();
    const studentId = req.query.studentId as string;

    if (!sessionId) {
      res.status(400).json({ ok: false, message: 'sessionId가 필요합니다.' });
      return;
    }

    const session = appStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ ok: false, message: '유효하지 않은 세션(초대코드)입니다.' });
      return;
    }

    const companies = appStore.getCompanies(sessionId);
    const revealedNews = appStore.newsPool.filter((n) => session.revealedNewsIds.includes(n.id));

    let studentData = undefined;
    let myAsset = undefined;

    if (studentId) {
      studentData = appStore.getStudent(sessionId, studentId);
      
      // Auto-recover student if Express server was restarted and memory wiped
      if (!studentData && studentId.includes('_')) {
        const [name, studentNum] = studentId.split('_');
        studentData = appStore.addStudent(sessionId, studentId, name);
        studentData.studentNum = studentNum;
      }
      
      myAsset = appStore.getStudentAsset(sessionId, studentId);
    }

    res.json({
      ok: true,
      session,
      companies,
      revealedNews,
      slots: session.activeNewsSlots,
      student: studentData,
      myStudent: studentData,
      myAsset,
    });
  });

  // 5. Student Login
  app.post('/api/student/login', (req, res) => {
    const { sessionId, name, studentNum } = req.body;
    if (!sessionId || !name || !studentNum) {
      res.status(400).json({ ok: false, message: '초대코드, 이름, 학번을 모두 입력해주세요.' });
      return;
    }

    const session = appStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ ok: false, message: '입력하신 초대코드의 세션을 찾을 수 없습니다.' });
      return;
    }

    const studentId = `${name.trim()}_${studentNum.trim()}`;
    let student = appStore.getStudent(sessionId, studentId);

    if (!student) {
      student = {
        sessionId: session.sessionId,
        studentId,
        name: name.trim(),
        studentNum: studentNum.trim(),
        loginTime: Date.now(),
        quizBonus: 0,
        cash: 0,
        initialInvestment: 0,
      };
      appStore.students.set(appStore.getStudentKey(session.sessionId, studentId), student);
    }

    const myAsset = appStore.getStudentAsset(session.sessionId, studentId);

    res.json({
      ok: true,
      student,
      session,
      myAsset,
      message: '로그인 완료되었습니다.',
    });
  });

  // 6. Teacher Dashboard Data
  app.get('/api/teacher/dashboard', requireTeacher, (req, res) => {
    const sessionId = (req.query.sessionId as string)?.toUpperCase();
    if (!sessionId) {
      res.status(400).json({ ok: false, message: 'sessionId가 필요합니다.' });
      return;
    }

    const session = appStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ ok: false, message: '세션을 찾을 수 없습니다.' });
      return;
    }

    const students = appStore.getStudentsInSession(sessionId);
    const companies = appStore.getCompanies(sessionId);
    const sessionTrades = appStore.trades.get(sessionId) || [];

    const studentSummaries = students.map((s) => {
      const asset = appStore.getStudentAsset(sessionId, s.studentId);
      return {
        studentId: s.studentId,
        name: s.name,
        studentNum: s.studentNum,
        loginTime: s.loginTime,
        quizBonus: s.quizBonus,
        jobTitle: s.selectedJob?.title || '미선택',
        budget: s.budget,
        cash: asset?.cash || 0,
        stockValuation: asset?.totalStockValuation || 0,
        totalAsset: asset?.totalAsset || 0,
        profitRate: asset?.profitRate || 0,
        tradedThisRound: asset?.tradedThisRound || false,
        lastTradeRound: s.lastTradeRound,
      };
    });

    res.json({
      ok: true,
      session,
      students: studentSummaries,
      companies,
      tradesCount: sessionTrades.length,
    });
  });

  // 7. Teacher Set Active Module
  app.post('/api/teacher/set-module', requireTeacher, (req, res) => {
    const { sessionId, moduleName } = req.body;
    const session = appStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ ok: false, message: '세션을 찾을 수 없습니다.' });
      return;
    }

    session.currentModule = moduleName;
    res.json({ ok: true, session, message: `모듈이 [${moduleName}]으로 변경되었습니다.` });
  });

  // 8. Quizzes
  app.get('/api/quiz/list', (req, res) => {
    res.json({ ok: true, quizzes: appStore.quizzes });
  });

  app.post('/api/teacher/quiz/set', requireTeacher, (req, res) => {
    const { sessionId, quizIndex } = req.body;
    const session = appStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ ok: false, message: '세션을 찾을 수 없습니다.' });
      return;
    }

    session.currentQuizIndex = quizIndex;
    res.json({ ok: true, session, currentQuizIndex: quizIndex });
  });

  // 9. Teacher Give Bonus
  app.post('/api/teacher/give-bonus', requireTeacher, (req, res) => {
    const { sessionId, studentId, amount } = req.body;
    const student = appStore.getStudent(sessionId, studentId);
    if (!student) {
      res.status(404).json({ ok: false, message: '학생을 찾을 수 없습니다.' });
      return;
    }

    const bonusAmount = Number(amount) || 0;
    student.quizBonus += bonusAmount;
    student.cash += bonusAmount; // Also increases student's trading cash immediately

    // If student already configured budget, update total available
    if (student.budget) {
      student.budget.quizBonus = student.quizBonus;
      student.budget.totalAvailable += bonusAmount;
      student.budget.investAmount += bonusAmount;
    }

    res.json({
      ok: true,
      student,
      message: `${student.name} 학생에게 보너스 ${bonusAmount.toLocaleString()}원이 즉시 지급되었습니다!`,
    });
  });

  // 10. Jobs and Payslip
  app.get('/api/jobs', (req, res) => {
    res.json({ ok: true, jobs: appStore.jobs });
  });

  app.post('/api/payslip', (req, res) => {
    const { jobId } = req.body;
    const slip = appStore.calculatePayslip(Number(jobId));
    res.json({ ok: true, payslip: slip });
  });

  // 11. Save Budget Allocation
  app.post('/api/budget/save', (req, res) => {
    const { sessionId, studentId, jobId, livingPercent, savingsPercent, investPercent } = req.body;
    if (!sessionId || !studentId || jobId === undefined) {
      res.status(400).json({ ok: false, message: '모든 배분 정보를 입력해주세요.' });
      return;
    }

    if (livingPercent + savingsPercent + investPercent !== 100) {
      res.status(400).json({ ok: false, message: '생활비, 저축, 투자의 합계는 반드시 100%여야 합니다.' });
      return;
    }

    const budget = appStore.saveStudentBudget(
      sessionId,
      studentId,
      Number(jobId),
      Number(livingPercent),
      Number(savingsPercent),
      Number(investPercent)
    );

    if (!budget) {
      res.status(404).json({ ok: false, message: '학생 정보를 찾을 수 없습니다.' });
      return;
    }

    const asset = appStore.getStudentAsset(sessionId, studentId);

    res.json({
      ok: true,
      budget,
      asset,
      message: '통장 배분이 성공적으로 저장되었습니다! 투자 금액이 모의주식 계좌로 이전되었습니다.',
    });
  });

  // 12. Stock Market Operations
  app.get('/api/stock/companies', (req, res) => {
    const sessionId = (req.query.sessionId as string)?.toUpperCase();
    const companies = appStore.getCompanies(sessionId || '');
    res.json({ ok: true, companies });
  });

  app.get('/api/stock/my-asset', (req, res) => {
    const sessionId = (req.query.sessionId as string)?.toUpperCase();
    const studentId = req.query.studentId as string;
    if (!sessionId || !studentId) {
      res.status(400).json({ ok: false, message: 'sessionId와 studentId가 필요합니다.' });
      return;
    }

    const asset = appStore.getStudentAsset(sessionId, studentId);
    if (!asset) {
      res.status(404).json({ ok: false, message: '학생 정보를 찾을 수 없습니다.' });
      return;
    }

    res.json({ ok: true, asset });
  });

  // Teacher: Prepare Candidate Slots for round
  app.post('/api/teacher/stock/prepare-slots', requireTeacher, (req, res) => {
    const { sessionId } = req.body;
    const session = appStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ ok: false, message: '세션을 찾을 수 없습니다.' });
      return;
    }
    const result = appStore.prepareRoundCandidates(sessionId);
    res.json({
      ok: true,
      session,
      slots: result.slots,
    });
  });

  // Teacher: Flip a specific slot (Teacher picks 1 of the 6 cards)
  app.post('/api/teacher/stock/flip-slot', requireTeacher, (req, res) => {
    const { sessionId, slotIndex } = req.body;
    const result = appStore.flipSlot(sessionId, Number(slotIndex));
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  // Teacher: Reset slots for this round
  app.post('/api/teacher/stock/reset-slots', requireTeacher, (req, res) => {
    const { sessionId } = req.body;
    const result = appStore.resetRoundSlots(sessionId);
    const session = appStore.getSession(sessionId);
    res.json({
      ok: true,
      session,
      slots: result.slots,
      message: '슬롯이 초기화되었습니다. 다시 2개의 기사를 선택해주세요.',
    });
  });

  // Teacher: Reveal News (Auto Random 2 slots)
  app.post('/api/teacher/stock/reveal-news', requireTeacher, (req, res) => {
    const { sessionId } = req.body;
    const session = appStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ ok: false, message: '세션을 찾을 수 없습니다.' });
      return;
    }

    const result = appStore.revealNewsForRound(sessionId);
    res.json({
      ok: true,
      session,
      revealedNews: result.revealedNews,
      slots: result.slots,
      message: `${session.stockRound}라운드 뉴스 2건이 랜덤으로 즉시 공개되었습니다!`,
    });
  });

  // Teacher: Send Chosen News to Students
  app.post('/api/teacher/stock/send-news', requireTeacher, (req, res) => {
    const { sessionId, revealedNewsIds, slots } = req.body;
    const result = appStore.sendNews(sessionId, revealedNewsIds || [], slots || []);
    if (!result.ok || !result.session) {
      res.status(404).json({ ok: false, message: '세션을 찾을 수 없습니다.' });
      return;
    }
    res.json({
      ok: true,
      session: result.session,
      message: `${result.session.stockRound}라운드 뉴스 ${revealedNewsIds?.length || 0}건이 학생 화면으로 전송되었습니다!`,
    });
  });

  // Teacher: Start Trading
  app.post('/api/teacher/stock/start-trading', requireTeacher, (req, res) => {
    const { sessionId } = req.body;
    const session = appStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ ok: false, message: '세션을 찾을 수 없습니다.' });
      return;
    }

    session.stockState = 'trading';
    const isInitial = (session.stockRound || 0) === 0;
    res.json({
      ok: true,
      session,
      message: isInitial
        ? '초기 상장(거래)이 시작되었습니다! 학생들이 자유롭게 매매할 수 있습니다.'
        : `${session.stockRound}라운드 상장(거래)이 시작되었습니다! 학생들은 자유롭게 매수/매도를 진행할 수 있습니다.`,
    });
  });

  // Student: Execute Trade (Buy or Sell, 1 per round)
  app.post('/api/student/stock/trade', (req, res) => {
    const { sessionId, studentId, companyName, tradeType, quantity } = req.body;
    const result = appStore.executeTrade(
      sessionId,
      studentId,
      companyName,
      tradeType,
      Number(quantity)
    );

    if (!result.ok) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  });

  // Teacher: Close Trading and Advance Round
  app.post('/api/teacher/stock/close-trading', requireTeacher, (req, res) => {
    const { sessionId } = req.body;
    const session = appStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ ok: false, message: '세션을 찾을 수 없습니다.' });
      return;
    }

    if (session.stockState !== 'trading') {
      res.status(400).json({ ok: false, message: '상장 거래(trading) 상태에서만 마감할 수 있습니다.' });
      return;
    }

    const result = appStore.closeTradingAndApplyPriceChanges(sessionId);
    res.json({
      ok: true,
      session,
      nextRound: result.nextRound,
      isCompleted: result.isCompleted,
      companies: result.companies,
      message: result.isCompleted
        ? '6라운드 모의주식이 모두 종료되었습니다! 최종 리포트 화면으로 이동합니다.'
        : `${session.stockRound}라운드가 시작되었습니다. 새로운 뉴스를 공개해주세요!`,
    });
  });

  // 13. Final Report
  app.get('/api/student/final-report', (req, res) => {
    const sessionId = (req.query.sessionId as string)?.toUpperCase();
    const studentId = req.query.studentId as string;
    if (!sessionId || !studentId) {
      res.status(400).json({ ok: false, message: 'sessionId와 studentId가 필요합니다.' });
      return;
    }

    const report = appStore.getFinalReport(sessionId, studentId);
    if (!report) {
      res.status(404).json({ ok: false, message: '최종 리포트 데이터를 생성할 수 없습니다.' });
      return;
    }

    res.json({ ok: true, report });
  });

  // 14. Class Leaderboard Rankings
  app.get('/api/teacher/rankings', requireTeacher, (req, res) => {
    const sessionId = (req.query.sessionId as string)?.toUpperCase();
    if (!sessionId) {
      res.status(400).json({ ok: false, message: 'sessionId가 필요합니다.' });
      return;
    }

    const session = appStore.getSession(sessionId);
    if (!session) {
      res.status(404).json({ ok: false, message: '세션을 찾을 수 없습니다.' });
      return;
    }

    const students = appStore.getStudentsInSession(sessionId);
    const reports = students
      .map((s) => appStore.getFinalReport(sessionId, s.studentId))
      .filter((r): r is NonNullable<typeof r> => r !== null);

    reports.sort((a, b) => b.profitRate - a.profitRate);

    res.json({
      ok: true,
      session,
      rankings: reports,
      totalStudents: students.length,
      averageProfitRate:
        reports.length > 0
          ? parseFloat(
              (reports.reduce((acc, r) => acc + r.profitRate, 0) / reports.length).toFixed(2)
            )
          : 0,
    });
  });

  // --- Google Sheets Web App Proxy & Direct Export Endpoints ---
  let configuredGasUrl = process.env.GAS_API_URL || '';

  // Get / Save GAS URL
  app.get('/api/gas/config', (req, res) => {
    res.json({ ok: true, gasUrl: configuredGasUrl });
  });

  app.post('/api/gas/config', (req, res) => {
    const { gasUrl } = req.body;
    if (typeof gasUrl === 'string') {
      configuredGasUrl = gasUrl.trim();
    }
    res.json({ ok: true, gasUrl: configuredGasUrl });
  });

  // Test GAS Connection (Server-side fetch avoids CORS and handles 302 redirects)
  app.post('/api/gas/test', async (req, res) => {
    const url = req.body.gasUrl || configuredGasUrl;
    if (!url || !url.startsWith('https://script.google.com/')) {
      res.status(400).json({
        ok: false,
        message: '올바른 Google Apps Script 웹 앱 URL(https://script.google.com/macros/s/.../exec)을 입력해주세요.',
      });
      return;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify({
          action: 'testConnection',
          sessionId: 'TEST',
          message: '연동 테스트 전송',
          timestamp: new Date().toISOString(),
        }),
      });

      const responseText = await response.text();
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {}

      if (response.ok && (responseJson?.ok || responseText.includes('success') || responseText.includes('성공'))) {
        res.json({
          ok: true,
          message: '✅ 구글 스프레드시트 연동 성공! Apps Script가 정상 응답했습니다.',
          raw: responseJson || responseText.substring(0, 200),
        });
      } else {
        res.json({
          ok: true,
          message: `구글 시트에 연결되었습니다 (응답 코드: ${response.status}).`,
          raw: responseText.substring(0, 200),
        });
      }
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        message: `구글 서버 연결 실패: ${err.message || '네트워크 오류'}. 배포 시 '액세스 권한: 모든 사용자'로 설정했는지 확인하세요.`,
      });
    }
  });

  // Bulk Sync Session Data to Google Sheets
  app.post('/api/gas/sync', async (req, res) => {
    const { sessionId, gasUrl } = req.body;
    const targetUrl = gasUrl || configuredGasUrl;

    if (!targetUrl || !targetUrl.startsWith('https://script.google.com/')) {
      res.status(400).json({
        ok: false,
        message: 'Google Apps Script 웹 앱 URL이 설정되지 않았습니다.',
      });
      return;
    }

    const sid = (sessionId as string)?.toUpperCase();
    const session = sid ? appStore.getSession(sid) : undefined;
    const rawStudents = sid ? appStore.getStudentsInSession(sid) : [];

    const studentsPayload = rawStudents.map((st) => {
      const asset = sid ? appStore.getStudentAsset(sid, st.studentId) : null;
      return {
        studentId: st.studentId,
        studentNum: st.studentNum,
        name: st.name,
        jobTitle: st.selectedJob?.title || '미선택',
        monthlySalary: st.selectedJob?.monthlySalary || 0,
        quizBonus: st.quizBonus || 0,
        initialInvestment: asset?.initialInvestment || st.initialInvestment || 0,
        cash: asset?.cash ?? st.cash ?? 0,
        stockValuation: asset?.totalStockValuation || 0,
        totalAsset: asset?.totalAsset || 0,
        profitRate: asset?.profitRate || 0,
      };
    });

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        redirect: 'follow',
        body: JSON.stringify({
          action: 'bulkSync',
          sessionId: sid || 'UNKNOWN',
          currentModule: session?.currentModule || 'lobby',
          stockRound: session?.stockRound || 1,
          students: studentsPayload,
          timestamp: new Date().toISOString(),
        }),
      });

      const text = await response.text();
      res.json({
        ok: true,
        message: `총 ${studentsPayload.length}명의 학생 데이터가 구글 스프레드시트에 정상 기록되었습니다!`,
        serverStatus: response.status,
        resultPreview: text.substring(0, 150),
      });
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        message: `구글 시트 전송 실패: ${err.message || '네트워크 오류'}`,
      });
    }
  });

  // 1-Click CSV Download (UTF-8 BOM supported for Excel & Google Sheets)
  app.get('/api/export/csv', (req, res) => {
    const sessionId = (req.query.sessionId as string)?.toUpperCase();
    if (!sessionId) {
      res.status(400).send('sessionId가 필요합니다.');
      return;
    }

    const students = appStore.getStudentsInSession(sessionId);
    const rows = [
      ['기록일시', '세션코드', '학번', '이름', '선택직업', '세전월급', '퀴즈보너스', '투자원금', '보유현금', '주식평가액', '총자산', '수익률(%)'],
    ];

    const nowStr = new Date().toLocaleString('ko-KR');
    students.forEach((st) => {
      const asset = appStore.getStudentAsset(sessionId, st.studentId);
      rows.push([
        nowStr,
        sessionId,
        `"${st.studentNum}"`,
        `"${st.name}"`,
        `"${st.selectedJob?.title || '미선택'}"`,
        (st.selectedJob?.monthlySalary || 0).toString(),
        (st.quizBonus || 0).toString(),
        (asset?.initialInvestment || st.initialInvestment || 0).toString(),
        (asset?.cash ?? st.cash ?? 0).toString(),
        (asset?.totalStockValuation || 0).toString(),
        (asset?.totalAsset || 0).toString(),
        (asset?.profitRate || 0).toString(),
      ]);
    });

    const csvContent = '\uFEFF' + rows.map((r) => r.join(',')).join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="FinancialCamp_${sessionId}_students.csv"`);
    res.send(csvContent);
  });

  // Vite Middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Financial Camp Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
