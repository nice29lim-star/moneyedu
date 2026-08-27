// src/utils/syncManager.ts
import { Session, Student, AppStateModule, Company, NewsItem, StudentAsset, StockTrade, StockHolding } from '../types';
import { supabaseDb } from './supabaseClient';
import { INITIAL_COMPANIES, INITIAL_NEWS_POOL } from '../data/seedData';

const CHANNEL_NAME = 'fc_camp_sync_channel';
let broadcastChannel: BroadcastChannel | null = null;

try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    broadcastChannel = new BroadcastChannel(CHANNEL_NAME);
  }
} catch {
  // BroadcastChannel not supported in some private browsing contexts
}

const getGasUrl = (): string => {
  try {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('fc_gas_url');
      if (stored && stored.trim()) return stored.trim();
    }
  } catch {}
  return import.meta.env.VITE_GAS_API_URL || '';
};

export const syncManager = {
  getGasUrl,
  setGasUrl: (url: string) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('fc_gas_url', url.trim());
      }
      syncManager.broadcast('GAS_URL_UPDATED', { url: url.trim() });
    } catch {}
  },

  // Send real-time event to Google Apps Script / Sheet (Server proxy + direct fallback)
  sendToGoogleSheets: async (action: string, payload: any) => {
    const gasUrl = getGasUrl();
    if (!gasUrl || !gasUrl.includes('script.google.com')) return false;

    try {
      // 1. Try server backend proxy
      fetch('/api/gas/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          sessionId: payload?.sessionId || '',
          gasUrl,
          payload,
        }),
      }).catch(() => {});

      // 2. Direct best effort fallback
      const bodyData = {
        action,
        sessionId: payload?.sessionId || '',
        timestamp: new Date().toISOString(),
        ...payload,
      };

      fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(bodyData),
      }).catch(() => {});
      return true;
    } catch (e) {
      console.warn('Google Sheets sync error:', e);
      return false;
    }
  },

  // Test GAS connection via Server Proxy with detailed response
  testGasConnection: async (gasUrl: string) => {
    try {
      const res = await fetch('/api/gas/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gasUrl }),
      });
      const data = await res.json();
      return data;
    } catch (e: any) {
      return { ok: false, message: `테스트 실패: ${e.message || '서버 통신 오류'}` };
    }
  },

  // Bulk sync all students and current session progress to Google Sheets
  syncAllSessionDataToGAS: async (sessionId: string, token: string) => {
    const cleanSession = sessionId.toUpperCase();
    const gasUrl = getGasUrl();

    // 1. Try reliable server-side sync first (handles CORS, redirects, and accurate response)
    try {
      const res = await fetch('/api/gas/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: cleanSession,
          gasUrl,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok) return data;
      }
    } catch {
      // fallback to client-side
    }

    // 2. Client-side fallback
    const students = await syncManager.fetchStudents(cleanSession, token);
    if (!gasUrl) {
      return { ok: false, message: '구글 스프레드시트 Web App URL이 설정되어 있지 않습니다.' };
    }

    try {
      await fetch(gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'bulkSync',
          sessionId: cleanSession,
          timestamp: new Date().toISOString(),
          students,
        }),
      });
      return { ok: true, message: `${students.length}명의 학생 데이터가 구글 스프레드시트로 전송되었습니다.` };
    } catch (err: any) {
      return { ok: false, message: `전송 실패: ${err.message || '네트워크 오류'}` };
    }
  },

  // Broadcast an event to all tabs
  broadcast: (type: string, payload: any) => {
    try {
      if (broadcastChannel) {
        broadcastChannel.postMessage({ type, payload, timestamp: Date.now() });
      }
      localStorage.setItem('fc_sync_pulse', JSON.stringify({ type, payload, t: Date.now() }));
    } catch {
      // Ignore
    }
  },

  // Subscribe to sync events
  subscribe: (handler: (type: string, payload: any) => void) => {
    if (typeof window === 'undefined') return () => {};

    const handleBroadcast = (e: MessageEvent) => {
      if (e.data && e.data.type) {
        handler(e.data.type, e.data.payload);
      }
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'fc_sync_pulse' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && parsed.type) {
            handler(parsed.type, parsed.payload);
          }
        } catch {}
      }
    };

    if (broadcastChannel) {
      broadcastChannel.addEventListener('message', handleBroadcast);
    }
    window.addEventListener('storage', handleStorage);

    return () => {
      if (broadcastChannel) {
        broadcastChannel.removeEventListener('message', handleBroadcast);
      }
      window.removeEventListener('storage', handleStorage);
    };
  },

  // Format student safely with default fallbacks to prevent any render crashes
  normalizeStudent: (st: any) => {
    const cash = Number(st.cash ?? 0);
    const initialInvestment = Number(st.initialInvestment ?? cash);
    const stockValuation = Number(st.stockValuation ?? st.totalStockValuation ?? 0);
    const totalAsset = Number(st.totalAsset ?? (cash + stockValuation));
    const profitAmount = totalAsset - initialInvestment;
    const profitRate = initialInvestment > 0 ? (profitAmount / initialInvestment) * 100 : Number(st.profitRate ?? 0);

    return {
      studentId: String(st.studentId || `${st.name || '학생'}_${st.studentNum || '00'}`),
      name: String(st.name || '학생'),
      studentNum: String(st.studentNum || '00'),
      jobTitle: String(st.jobTitle || (st.selectedJob ? st.selectedJob.title : '미선택')),
      selectedJob: st.selectedJob || null,
      budget: st.budget || null,
      quizBonus: Number(st.quizBonus ?? 0),
      cash,
      initialInvestment,
      stockValuation,
      totalAsset,
      profitRate: isNaN(profitRate) ? 0 : profitRate,
      profitAmount,
      holdings: Array.isArray(st.holdings) ? st.holdings : [],
      loginTime: st.loginTime || Date.now(),
    };
  },

  // Save student locally and notify
  saveStudentLocally: (sessionId: string, student: Student) => {
    try {
      const cleanSession = sessionId.toUpperCase();
      const key = `fc_students_${cleanSession}`;
      const existingStr = localStorage.getItem(key);
      const list: any[] = existingStr ? JSON.parse(existingStr) : [];
      const normalized = syncManager.normalizeStudent(student);
      const idx = list.findIndex(
        (s) => s.studentId === normalized.studentId || (s.name === normalized.name && s.studentNum === normalized.studentNum)
      );
      if (idx >= 0) {
        list[idx] = { ...list[idx], ...normalized };
      } else {
        list.push(normalized);
      }
      localStorage.setItem(key, JSON.stringify(list));
      syncManager.broadcast('STUDENT_JOINED', { sessionId: cleanSession, student: normalized });

      // Automatically sync to Supabase (Cloud Database)
      supabaseDb.upsertStudent({
        ...normalized,
        sessionId: cleanSession,
      }).catch(() => {});

      // Automatically sync portfolio asset to Supabase
      supabaseDb.upsertStudentAsset({
        sessionId: cleanSession,
        studentId: normalized.studentId,
        studentName: normalized.name,
        cash: normalized.cash,
        initialInvestment: normalized.initialInvestment,
        holdings: Array.isArray(normalized.holdings)
          ? normalized.holdings.reduce((acc: any, h: any) => {
              if (h && h.companyName) acc[h.companyName] = h;
              return acc;
            }, {})
          : (normalized.holdings || {}),
        totalStockValuation: normalized.stockValuation,
        totalAsset: normalized.totalAsset,
        profitAmount: normalized.profitAmount,
        profitRate: normalized.profitRate,
        tradedThisRound: false,
      }).catch(() => {});

      // Automatically sync to Google Sheets (if configured)
      syncManager.sendToGoogleSheets('studentLogin', {
        sessionId: cleanSession,
        student: normalized,
      });
    } catch {}
  },

  // Get local students for session
  getLocalStudents: (sessionId: string): any[] => {
    try {
      const key = `fc_students_${sessionId.toUpperCase()}`;
      const str = localStorage.getItem(key);
      const raw: any[] = str ? JSON.parse(str) : [];
      return raw.map(syncManager.normalizeStudent);
    } catch {
      return [];
    }
  },

  // Fetch all students for teacher (tries Supabase -> Express -> GAS -> LocalStorage)
  fetchStudents: async (sessionId: string, token: string): Promise<any[]> => {
    if (!sessionId) return [];
    const cleanSession = sessionId.toUpperCase();

    // 1. Try Supabase Cloud Database First (Fastest & Authoritative)
    if (supabaseDb.isReady()) {
      try {
        const sbStudents = await supabaseDb.getStudentsInSession(cleanSession);
        if (Array.isArray(sbStudents)) {
          return sbStudents.map(syncManager.normalizeStudent);
        }
      } catch {}
    }

    // 2. Try Express API
    try {
      const res = await fetch(`/api/teacher/dashboard?sessionId=${cleanSession}&token=${token}`, {
        headers: { 'x-teacher-token': token },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && Array.isArray(data.students)) {
          return data.students.map(syncManager.normalizeStudent);
        }
      }
    } catch {}

    // 3. Try Google Apps Script API
    const gasUrl = getGasUrl();
    if (gasUrl && gasUrl.includes('script.google.com')) {
      try {
        const gasRes = await fetch(`${gasUrl}?action=pollSession&sessionId=${cleanSession}`);
        if (gasRes.ok) {
          const gasData = await gasRes.json();
          if (gasData && gasData.ok && Array.isArray(gasData.students)) {
            const mapped = gasData.students.map((st: any) =>
              syncManager.normalizeStudent({
                studentId: st['학생ID'] || st.studentId || `${st['이름']}_${st['학번']}`,
                name: st['이름'] || st.name,
                studentNum: st['학번'] || st.studentNum,
                jobTitle: st['직업명'] || st.jobTitle,
                loginTime: st['접속시간'] || Date.now(),
                quizBonus: Number(st['퀴즈보너스'] || st.quizBonus || 0),
                cash: Number(st['현금'] || st.cash || 0),
                initialInvestment: Number(st['투자원금'] || st.initialInvestment || 0),
              })
            );

            // Merge with local students
            const local = syncManager.getLocalStudents(cleanSession);
            const combined = [...mapped];
            local.forEach((loc) => {
              if (!combined.some((c) => c.studentId === loc.studentId)) {
                combined.push(loc);
              }
            });
            return combined;
          }
        }
      } catch {}
    }

    // 4. Fallback: LocalStorage students
    return syncManager.getLocalStudents(cleanSession);
  },

  // Give bonus to student (tries Supabase -> Express -> GAS -> LocalStorage)
  giveBonus: async (sessionId: string, studentId: string, amount: number, token: string): Promise<boolean> => {
    if (!sessionId || !studentId) return false;
    const cleanSession = sessionId.toUpperCase();

    // Fire Supabase Bonus Update
    if (supabaseDb.isReady()) {
      supabaseDb.awardQuizBonus(cleanSession, studentId, amount).catch(() => {});
    }

    // 1. Try Express API
    try {
      const res = await fetch('/api/teacher/give-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
        body: JSON.stringify({ sessionId: cleanSession, studentId, amount, token }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok) {
          // Sync locally as well
          const localList = syncManager.getLocalStudents(cleanSession);
          const st = localList.find((s) => s.studentId === studentId);
          if (st) {
            st.quizBonus = (st.quizBonus || 0) + amount;
            st.cash = (st.cash || 0) + amount;
            syncManager.saveStudentLocally(cleanSession, st);
          }
          syncManager.broadcast('BONUS_AWARDED', { sessionId: cleanSession, studentId, amount, name: st?.name });
          syncManager.sendToGoogleSheets('giveBonus', {
            sessionId: cleanSession,
            studentId,
            amount,
            student: st,
          });
          return true;
        }
      }
    } catch {}

    // 2. Guaranteed LocalStorage Update & Broadcast
    try {
      const localList = syncManager.getLocalStudents(cleanSession);
      const st = localList.find((s) => s.studentId === studentId);
      if (st) {
        st.quizBonus = (st.quizBonus || 0) + amount;
        st.cash = (st.cash || 0) + amount;
        syncManager.saveStudentLocally(cleanSession, st);
      }
      syncManager.broadcast('BONUS_AWARDED', { sessionId: cleanSession, studentId, amount, name: st?.name });
      syncManager.sendToGoogleSheets('giveBonus', {
        sessionId: cleanSession,
        studentId,
        amount,
        student: st,
      });
      return true;
    } catch {
      return false;
    }
  },

  // Poll active session from Supabase -> Express -> GAS -> LocalStorage
  pollSessionState: async (sessionId: string, studentId?: string) => {
    if (!sessionId) return null;
    const cleanSession = sessionId.toUpperCase();

    // 1. Supabase Cloud Database (Fastest & Authoritative across all devices)
    if (supabaseDb.isReady()) {
      try {
        const sbSession = await supabaseDb.getSession(cleanSession);
        if (sbSession) {
          let myStudent = undefined;
          let myAsset = undefined;
          if (studentId) {
            myStudent = (await supabaseDb.getStudent(cleanSession, studentId)) || undefined;
            myAsset = (await supabaseDb.getStudentAsset(cleanSession, studentId)) || undefined;
          }
          return {
            ok: true,
            session: sbSession,
            myStudent,
            student: myStudent,
            myAsset,
          };
        }
      } catch {}
    }

    // 2. Express API
    try {
      const studentParam = studentId ? `&studentId=${studentId}` : '';
      const res = await fetch(`/api/session/poll?sessionId=${cleanSession}${studentParam}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.ok && data.session) {
          return data;
        }
      }
    } catch {}

    // 3. GAS API
    const gasUrl = getGasUrl();
    if (gasUrl && gasUrl.includes('script.google.com')) {
      try {
        const gasRes = await fetch(`${gasUrl}?action=pollSession&sessionId=${cleanSession}&studentId=${studentId || ''}`);
        if (gasRes.ok) {
          const gasData = await gasRes.json();
          if (gasData && gasData.ok && gasData.session) {
            const gasSess = gasData.session;
            const mappedSession: Session = {
              sessionId: cleanSession,
              currentModule: gasSess['현재모듈'] || gasSess.currentModule || 'lobby',
              stockRound: Number(gasSess['주식_현재라운드'] || gasSess.stockRound || 1),
              stockState: gasSess['주식_상태'] || gasSess.stockState || 'waiting',
              currentQuizIndex: Number(gasSess['현재퀴즈번호'] || gasSess.currentQuizIndex || 0),
              isCompleted: gasSess['현재모듈'] === 'report' || gasSess.isCompleted === true,
              activeNewsSlots: [],
              revealedNewsIds: [1, 2, 3],
              createdAt: Date.now(),
            };
            return {
              ok: true,
              session: mappedSession,
              myStudent: gasData.myStudent,
            };
          }
        }
      } catch {}
    }

    // 4. LocalStorage Session
    try {
      const localStr = localStorage.getItem(`fc_session_${cleanSession}`);
      if (localStr) {
        const localSess = JSON.parse(localStr);
        return {
          ok: true,
          session: localSess,
        };
      }
    } catch {}

    return null;
  },

  // Get local session by ID or active ID
  getSession: (sessionId?: string): Session | null => {
    try {
      const cleanSession = (sessionId || localStorage.getItem('fc_session_id') || '').toUpperCase();
      if (!cleanSession) return null;
      const str = localStorage.getItem(`fc_session_${cleanSession}`);
      if (str) return JSON.parse(str);
    } catch {}
    return null;
  },

  // Save session across all platforms (Supabase + LocalStorage + Broadcast)
  saveSession: async (session: Session) => {
    if (!session || !session.sessionId) return;
    const cleanSession = session.sessionId.toUpperCase();

    // 1. Supabase Cloud DB
    if (supabaseDb.isReady()) {
      supabaseDb.upsertSession(session).catch(() => {});
    }

    // 2. LocalStorage
    try {
      localStorage.setItem(`fc_session_${cleanSession}`, JSON.stringify(session));
    } catch {}

    // 3. Local Broadcast
    syncManager.broadcast('SESSION_UPDATED', { sessionId: cleanSession, session });
  },

  // Update session state across platforms
  updateSessionModule: async (sessionId: string, currentModule: AppStateModule, token: string) => {
    const cleanSession = sessionId.toUpperCase();

    // 1. Prepare updated session object
    const sessKey = `fc_session_${cleanSession}`;
    const sessStr = typeof window !== 'undefined' ? localStorage.getItem(sessKey) : null;
    let sessObj: Session = {
      sessionId: cleanSession,
      currentModule,
      stockRound: 1,
      stockState: 'waiting',
      currentQuizIndex: 0,
      isCompleted: currentModule === 'report',
      activeNewsSlots: [],
      revealedNewsIds: [1, 2, 3],
      createdAt: Date.now(),
    };
    if (sessStr) {
      try {
        sessObj = { ...JSON.parse(sessStr), currentModule, isCompleted: currentModule === 'report' };
      } catch {}
    }

    // 2. Save locally
    try {
      localStorage.setItem(sessKey, JSON.stringify(sessObj));
    } catch {}

    // 3. Save to Supabase Cloud Database
    if (supabaseDb.isReady()) {
      supabaseDb.upsertSession(sessObj).catch(() => {});
    }

    // 4. Broadcast locally to all student tabs
    syncManager.broadcast('MODULE_CHANGED', { sessionId: cleanSession, currentModule });

    // 5. Express backend update
    try {
      fetch('/api/teacher/session/module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
        body: JSON.stringify({ sessionId: cleanSession, currentModule, module: currentModule, token }),
      }).catch(() => {});
      fetch('/api/teacher/set-module', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
        body: JSON.stringify({ sessionId: cleanSession, moduleName: currentModule, token }),
      }).catch(() => {});
    } catch {}

    // 6. GAS update
    syncManager.sendToGoogleSheets('updateSessionState', {
      sessionId: cleanSession,
      currentModule,
    });
  },

  // Get session companies
  getCompanies: (sessionId: string): Company[] => {
    try {
      const cleanSession = sessionId.toUpperCase();
      const str = localStorage.getItem(`fc_companies_${cleanSession}`);
      if (str) return JSON.parse(str);
    } catch {}
    return INITIAL_COMPANIES;
  },

  // Save session companies
  saveCompanies: (sessionId: string, companies: Company[]) => {
    try {
      const cleanSession = sessionId.toUpperCase();
      localStorage.setItem(`fc_companies_${cleanSession}`, JSON.stringify(companies));
    } catch {}
  },

  // Prepare 6 Candidate News Slots for the round
  prepareCandidateSlots: async (sessionId: string, currentSession: Session | null, token: string) => {
    const cleanSession = sessionId.toUpperCase();
    let updatedSession: Session = currentSession
      ? { ...currentSession }
      : {
          sessionId: cleanSession,
          currentModule: 'stock',
          stockRound: 1,
          stockState: 'waiting',
          currentQuizIndex: 0,
          isCompleted: false,
          activeNewsSlots: [],
          revealedNewsIds: [],
          createdAt: Date.now(),
        };

    let slots = updatedSession.activeNewsSlots || [];

    // Try Express Server
    try {
      const res = await fetch('/api/teacher/stock/prepare-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
        body: JSON.stringify({ sessionId: cleanSession, token }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.slots) {
          slots = data.slots;
          updatedSession = data.session || updatedSession;
          updatedSession.activeNewsSlots = slots;
        }
      }
    } catch {}

    // Local fallback if no slots or less than 6
    if (!slots || slots.length !== 6 || !slots[0]?.news) {
      const currentRound = updatedSession.stockRound || 1;
      const shuffled = [...INITIAL_NEWS_POOL].sort(() => Math.random() - 0.5);
      const candidates = shuffled.slice(0, 6).map((n) => ({ ...n, roundAppeared: currentRound }));

      slots = candidates.map((news, idx) => ({
        slotIndex: idx,
        news,
        isRevealed: false,
      }));

      updatedSession.activeNewsSlots = slots;
      updatedSession.revealedNewsIds = [];
    }

    await syncManager.saveSession(updatedSession);
    syncManager.broadcast('STOCK_STATE_CHANGED', {
      sessionId: cleanSession,
      session: updatedSession,
      slots,
      revealedNews: [],
      stockState: updatedSession.stockState,
      stockRound: updatedSession.stockRound,
    });

    return { ok: true, session: updatedSession, slots };
  },

  // Flip a specific slot by slotIndex (Teacher clicks 1 of 6 cards, up to 3)
  flipStockNewsSlot: async (
    sessionId: string,
    currentSession: Session | null,
    slotIndex: number,
    token: string,
    maxSelect: number = 3
  ) => {
    const cleanSession = sessionId.toUpperCase();
    let updatedSession: Session = currentSession
      ? { ...currentSession }
      : {
          sessionId: cleanSession,
          currentModule: 'stock',
          stockRound: 1,
          stockState: 'waiting',
          currentQuizIndex: 0,
          isCompleted: false,
          activeNewsSlots: [],
          revealedNewsIds: [],
          createdAt: Date.now(),
        };

    let slots: any[] = updatedSession.activeNewsSlots || [];
    let revealedNews: NewsItem[] = [];
    let revealedCount = 0;
    let message = '';

    if (!slots || slots.length !== 6 || !slots[0]?.news) {
      const prep = await syncManager.prepareCandidateSlots(cleanSession, updatedSession, token);
      slots = prep.slots;
      updatedSession = prep.session;
    }

    const target = slots.find((s) => s.slotIndex === slotIndex);
    if (!target || !target.news) {
      return { ok: false, message: '슬롯을 찾을 수 없습니다.', session: updatedSession, slots, revealedNews: [], revealedCount: 0 };
    }

    const currentRevealed = slots.filter((s) => s.isRevealed);
    if (target.isRevealed) {
      target.isRevealed = false;
    } else {
      if (currentRevealed.length >= maxSelect) {
        return {
          ok: false,
          message: `이미 ${maxSelect}개의 뉴스가 선택되었습니다. 다른 카드를 고르려면 기존 카드를 닫으세요.`,
          session: updatedSession,
          slots,
          revealedNews: currentRevealed.map((s) => s.news!),
          revealedCount: currentRevealed.length,
        };
      }
      target.isRevealed = true;
    }

    const newRevealed = slots.filter((s) => s.isRevealed);
    revealedNews = newRevealed.map((s) => s.news!).filter(Boolean);
    revealedCount = newRevealed.length;

    updatedSession.activeNewsSlots = slots;
    message = `${revealedCount}/${maxSelect}개 선택됨.`;

    // Save session in teacher view
    await syncManager.saveSession(updatedSession);

    return { ok: true, session: updatedSession, slots, revealedNews, revealedCount, message };
  },

  // Reset Candidate Slots
  resetStockNewsSlots: async (sessionId: string, currentSession: Session | null, token: string) => {
    const cleanSession = sessionId.toUpperCase();
    let updatedSession: Session = currentSession
      ? { ...currentSession, stockState: 'waiting', revealedNewsIds: [], activeNewsSlots: [] }
      : {
          sessionId: cleanSession,
          currentModule: 'stock',
          stockRound: 1,
          stockState: 'waiting',
          currentQuizIndex: 0,
          isCompleted: false,
          activeNewsSlots: [],
          revealedNewsIds: [],
          createdAt: Date.now(),
        };

    try {
      await fetch('/api/teacher/stock/reset-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
        body: JSON.stringify({ sessionId: cleanSession, token }),
      });
    } catch {}

    const prep = await syncManager.prepareCandidateSlots(cleanSession, updatedSession, token);
    return prep;
  },

  // Send selected 3 news articles to students (Teacher clicks [학생들에게 전송하기])
  sendNewsToStudents: async (
    sessionId: string,
    currentSession: Session | null,
    newsList: NewsItem[],
    slots: any[],
    token: string
  ) => {
    const cleanSession = sessionId.toUpperCase();
    let updatedSession: Session = currentSession
      ? { ...currentSession }
      : {
          sessionId: cleanSession,
          currentModule: 'stock',
          stockRound: 1,
          stockState: 'waiting',
          currentQuizIndex: 0,
          isCompleted: false,
          activeNewsSlots: [],
          revealedNewsIds: [],
          createdAt: Date.now(),
        };

    updatedSession.stockState = 'news';
    updatedSession.revealedNewsIds = newsList.map((n) => n.id);
    updatedSession.activeNewsSlots = slots;

    // 1. Try Express API
    try {
      await fetch('/api/teacher/stock/send-news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
        body: JSON.stringify({
          sessionId: cleanSession,
          revealedNewsIds: updatedSession.revealedNewsIds,
          slots,
          token,
        }),
      });
    } catch {}

    // 2. Save & Broadcast to all students
    await syncManager.saveSession(updatedSession);
    syncManager.broadcast('STOCK_STATE_CHANGED', {
      sessionId: cleanSession,
      session: updatedSession,
      stockState: 'news',
      stockRound: updatedSession.stockRound,
      revealedNews: newsList,
      slots,
    });

    return {
      ok: true,
      session: updatedSession,
      revealedNews: newsList,
      slots,
      message: `제 ${updatedSession.stockRound}라운드 뉴스 ${newsList.length}건이 학생 화면으로 전송되었습니다!`,
    };
  },

  // Reveal News (Auto pick 3 random items for fast track)
  revealStockNews: async (sessionId: string, currentSession: Session | null, token: string, count: number = 3) => {
    const cleanSession = sessionId.toUpperCase();
    let updatedSession: Session = currentSession
      ? { ...currentSession }
      : {
          sessionId: cleanSession,
          currentModule: 'stock',
          stockRound: 1,
          stockState: 'waiting',
          currentQuizIndex: 0,
          isCompleted: false,
          activeNewsSlots: [],
          revealedNewsIds: [],
          createdAt: Date.now(),
        };

    const currentRound = updatedSession.stockRound || 1;
    const allNews = [...INITIAL_NEWS_POOL];
    const shuffled = allNews.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, count).map((n) => ({ ...n, roundAppeared: currentRound }));

    const slotIndices = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5);
    const pickedIndices = slotIndices.slice(0, count);

    const slots = Array.from({ length: 6 }, (_, i) => {
      const pIdx = pickedIndices.indexOf(i);
      if (pIdx !== -1) {
        return { slotIndex: i, news: picked[pIdx], isRevealed: true };
      }
      return { slotIndex: i, news: shuffled[count + i] || null, isRevealed: false };
    });

    return syncManager.sendNewsToStudents(cleanSession, updatedSession, picked, slots, token);
  },

  // 2. Start Trading (Open Buy / Sell for Students)
  startStockTrading: async (sessionId: string, currentSession: Session | null, token: string) => {
    const cleanSession = sessionId.toUpperCase();
    let updatedSession: Session = currentSession
      ? { ...currentSession, stockState: 'trading' }
      : {
          sessionId: cleanSession,
          currentModule: 'stock',
          stockRound: 1,
          stockState: 'trading',
          currentQuizIndex: 0,
          isCompleted: false,
          activeNewsSlots: [],
          revealedNewsIds: [],
          createdAt: Date.now(),
        };

    // 1. Try Express Server
    try {
      const res = await fetch('/api/teacher/stock/start-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
        body: JSON.stringify({ sessionId: cleanSession, token }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.session) {
          updatedSession = data.session;
        }
      }
    } catch {}

    updatedSession.stockState = 'trading';

    // 2. Save & Broadcast
    await syncManager.saveSession(updatedSession);
    syncManager.broadcast('STOCK_STATE_CHANGED', {
      sessionId: cleanSession,
      session: updatedSession,
      stockState: 'trading',
      stockRound: updatedSession.stockRound,
    });

    const isInitial = (updatedSession.stockRound || 0) === 0;
    return {
      ok: true,
      session: updatedSession,
      message: isInitial
        ? '초기 상장(거래)이 시작되었습니다! 학생들이 첫 종목을 매수할 수 있습니다.'
        : `${updatedSession.stockRound}라운드 상장이 시작되었습니다! (학생 매수/매도 활성화)`,
    };
  },

  // 3. Close Trading (Apply Price Fluctuations & Next Round)
  closeStockTrading: async (sessionId: string, currentSession: Session | null, token: string) => {
    const cleanSession = sessionId.toUpperCase();
    let updatedSession: Session = currentSession
      ? { ...currentSession }
      : {
          sessionId: cleanSession,
          currentModule: 'stock',
          stockRound: 1,
          stockState: 'trading',
          currentQuizIndex: 0,
          isCompleted: false,
          activeNewsSlots: [],
          revealedNewsIds: [],
          createdAt: Date.now(),
        };

    let companies = syncManager.getCompanies(cleanSession);
    let isCompleted = false;
    const prevCompanies = [...companies];
    let serverHandled = false;

    // 1. Try Express Server
    try {
      const res = await fetch('/api/teacher/stock/close-trading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-teacher-token': token },
        body: JSON.stringify({ sessionId: cleanSession, token }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.session) {
          updatedSession = data.session;
          if (Array.isArray(data.companies)) {
            companies = data.companies;
            syncManager.saveCompanies(cleanSession, companies);
          }
          isCompleted = Boolean(data.isCompleted);
          serverHandled = true;
        }
      }
    } catch {}

    // 2. Local Fallback Price Updates ONLY if server didn't handle it
    if (!serverHandled) {
      const curRound = updatedSession.stockRound || 0;
      const revealedIds = updatedSession.revealedNewsIds || [];
      const revealedNewsList = INITIAL_NEWS_POOL.filter((n) => revealedIds.includes(n.id));

      // In Round 0 (initial setup), stock prices don't change yet; prices change from 1R to 5R
      if (curRound >= 1 && revealedNewsList.length > 0) {
        companies = companies.map((c) => {
          const matchingNews = revealedNewsList.filter(
            (n) => n.targetCompany === c.name || (n.targetIndustry && c.industry.includes(n.targetIndustry))
          );
          let impact = matchingNews.length > 0
            ? matchingNews.reduce((acc, curr) => acc + curr.impactRate, 0)
            : Math.floor(Math.random() * 7) - 3;

          impact = Math.max(-30, Math.min(35, impact));
          const oldPrice = c.currentPrice;
          const changeAmount = Math.round((oldPrice * impact) / 100);
          const newPrice = Math.max(1000, Math.round((oldPrice + changeAmount) / 100) * 100);
          const changeRate = parseFloat((((newPrice - oldPrice) / oldPrice) * 100).toFixed(2));
          const priceHistory = [...c.priceHistory, newPrice];

          return {
            ...c,
            currentPrice: newPrice,
            changeRate,
            priceHistory,
          };
        });

        syncManager.saveCompanies(cleanSession, companies);
      }

      if (curRound === 0) {
        // 0단계 마감 -> 1라운드로 전환
        updatedSession.stockRound = 1;
        updatedSession.stockState = 'waiting';
        updatedSession.revealedNewsIds = [];
        updatedSession.activeNewsSlots = [];
      } else if (curRound < 5) {
        // 1R~4R 마감 -> 다음 라운드로 전환
        updatedSession.stockRound = curRound + 1;
        updatedSession.stockState = 'waiting';
        updatedSession.revealedNewsIds = [];
        updatedSession.activeNewsSlots = [];
      } else {
        // 5R 마감 -> 완료 및 리포트 이동
        updatedSession.stockRound = 5;
        updatedSession.stockState = 'closed';
        updatedSession.isCompleted = true;
        updatedSession.currentModule = 'report';
        isCompleted = true;
      }
    }

    // Automatically prepare candidate slots for the new round if moving to 1~5
    if (updatedSession.stockRound >= 1 && !updatedSession.isCompleted) {
      try {
        const prep = await syncManager.prepareCandidateSlots(cleanSession, updatedSession, token);
        if (prep?.slots) {
          updatedSession.activeNewsSlots = prep.slots;
        }
      } catch {}
    }

    // 3. Save & Broadcast
    await syncManager.saveSession(updatedSession);
    syncManager.broadcast('STOCK_STATE_CHANGED', {
      sessionId: cleanSession,
      session: updatedSession,
      stockState: updatedSession.stockState,
      stockRound: updatedSession.stockRound,
      isCompleted,
      companies,
      prevCompanies,
      closedRound: updatedSession.stockRound,
      slots: updatedSession.activeNewsSlots,
      revealedNews: [],
    });

    const finalRound = updatedSession.stockRound;
    return {
      ok: true,
      session: updatedSession,
      companies,
      isCompleted,
      message: isCompleted
        ? '5라운드 모의주식이 모두 마감되었습니다! 최종 리포트로 이동합니다.'
        : `제 ${finalRound}라운드가 준비되었습니다. 새로운 뉴스를 확인하고 학생들에게 공개해주세요!`,
    };
  },

  // Student: Execute Trade with 100% Robust Local + Cloud DB (Supabase) Execution
  executeStudentTrade: async (
    sessionId: string,
    studentOrId: Student | string,
    companyOrName: Company | string,
    tradeType: 'BUY' | 'SELL',
    quantity: number,
    studentNameOrRound?: string | number,
    currentRoundParam?: number
  ): Promise<{ ok: boolean; message: string; asset?: StudentAsset }> => {
    if (!sessionId || !studentOrId) {
      return { ok: false, message: '세션 또는 학생 정보가 유효하지 않습니다.' };
    }

    const cleanSession = sessionId.toUpperCase();
    const studentId = typeof studentOrId === 'string' ? studentOrId : studentOrId.studentId;
    const studentName = typeof studentOrId === 'object' ? studentOrId.name : (typeof studentNameOrRound === 'string' ? studentNameOrRound : '학생');
    const studentObj: Student = typeof studentOrId === 'object' ? studentOrId : {
      sessionId: cleanSession,
      studentId,
      name: studentName,
      studentNum: '01',
      loginTime: Date.now(),
      quizBonus: 0,
      cash: 1000000,
      initialInvestment: 1000000,
    };

    const companies = syncManager.getCompanies(cleanSession);
    const companyName = typeof companyOrName === 'string' ? companyOrName : companyOrName.name;
    
    // UI에서 전달된 최신 회사 객체가 있으면 우선 사용, 없으면 캐시 참조
    let company: Company;
    if (typeof companyOrName === 'object' && 'currentPrice' in companyOrName) {
      company = companyOrName as Company;
    } else {
      company = companies.find(c => c.name === companyName) || {
        id: 1,
        name: companyName,
        code: 'KRX',
        industry: '일반',
        currentPrice: 50000,
        initialPrice: 50000,
        changeRate: 0,
        priceHistory: [50000],
        icon: '🏢',
      };
    }

    const currentRound = typeof currentRoundParam === 'number' ? currentRoundParam : (typeof studentNameOrRound === 'number' ? studentNameOrRound : (syncManager.getSession(cleanSession)?.stockRound ?? 1));

    const qty = Math.max(1, Math.floor(quantity));
    const totalAmount = company.currentPrice * qty;

    // 1. Get current asset state
    let asset = syncManager.getStudentAssetSync(cleanSession, studentId, studentObj);
    const holdings: Record<string, StockHolding> = { ...(asset?.holdings || {}) };
    const currentHolding: StockHolding = holdings[company.name] || {
      companyName: company.name,
      quantity: 0,
      avgBuyPrice: 0,
    };

    let newCash = asset.cash;
    if (tradeType === 'BUY') {
      if (newCash < totalAmount) {
        return {
          ok: false,
          message: `현금 잔액이 부족합니다! (필요: ${totalAmount.toLocaleString()}원, 보유: ${newCash.toLocaleString()}원)`,
        };
      }
      newCash -= totalAmount;
      const newQty = currentHolding.quantity + qty;
      const newTotalCost = currentHolding.quantity * currentHolding.avgBuyPrice + totalAmount;
      currentHolding.quantity = newQty;
      currentHolding.avgBuyPrice = Math.round(newTotalCost / newQty);
      holdings[company.name] = currentHolding;
    } else {
      // SELL
      if (currentHolding.quantity < qty) {
        return {
          ok: false,
          message: `보유 주식이 부족합니다! (보유: ${currentHolding.quantity}주, 매도 요청: ${qty}주)`,
        };
      }
      newCash += totalAmount;
      currentHolding.quantity -= qty;
      if (currentHolding.quantity === 0) {
        currentHolding.avgBuyPrice = 0;
      }
      holdings[company.name] = currentHolding;
    }

    // Calculate total valuation
    const priceMap = new Map(companies.map((c) => [c.name, c.currentPrice]));

    let totalStockValuation = 0;
    for (const h of Object.values(holdings) as StockHolding[]) {
      if (h.quantity > 0) {
        const curP = priceMap.get(h.companyName) || h.avgBuyPrice;
        totalStockValuation += h.quantity * curP;
      }
    }

    const initialInvestment = asset.initialInvestment || studentObj.initialInvestment || studentObj.cash || 1000000;
    const totalAsset = newCash + totalStockValuation;
    const profitAmount = totalAsset - initialInvestment;
    const profitRate = initialInvestment > 0 ? parseFloat(((profitAmount / initialInvestment) * 100).toFixed(2)) : 0;

    const updatedAsset: StudentAsset = {
      studentId: studentId,
      studentName: studentName,
      cash: newCash,
      initialInvestment,
      holdings,
      totalStockValuation,
      totalAsset,
      profitAmount,
      profitRate,
      tradedThisRound: true,
      lastTradeType: tradeType,
    };

    // 2. Save Trade Log
    const tradeLog: StockTrade = {
      id: `TR_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      sessionId: cleanSession,
      studentId: studentId,
      studentName: studentName,
      round: currentRound,
      companyName: company.name,
      tradeType,
      quantity: qty,
      price: company.currentPrice,
      totalAmount,
    };

    // 3. Save to LocalStorage
    try {
      localStorage.setItem(`fc_asset_${cleanSession}_${studentId}`, JSON.stringify(updatedAsset));
      const tradesKey = `fc_trades_${cleanSession}`;
      const existingTradesStr = localStorage.getItem(tradesKey);
      const existingTrades: StockTrade[] = existingTradesStr ? JSON.parse(existingTradesStr) : [];
      existingTrades.unshift(tradeLog);
      localStorage.setItem(tradesKey, JSON.stringify(existingTrades));
    } catch {}

    // 4. Save to Supabase Cloud DB
    if (supabaseDb.isReady()) {
      supabaseDb.recordTrade(tradeLog).catch((e) => console.warn('Supabase recordTrade fail:', e));
      supabaseDb.upsertStudentAsset({ ...updatedAsset, sessionId: cleanSession }).catch((e) => console.warn('Supabase upsertAsset fail:', e));
      supabaseDb.upsertStudent({
        ...studentObj,
        cash: newCash,
        lastTradeRound: currentRound,
      }).catch((e) => console.warn('Supabase updateStudent fail:', e));
    }

    // 5. Try Express Server in background
    try {
      fetch('/api/student/stock/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: cleanSession,
          studentId: studentId,
          companyName: company.name,
          tradeType,
          quantity: qty,
        }),
      }).catch(() => {});
    } catch {}

    // 6. Broadcast Real-time event
    syncManager.broadcast('TRADE_EXECUTED', {
      sessionId: cleanSession,
      studentId: studentId,
      round: currentRound,
      asset: updatedAsset,
      trade: tradeLog,
    });

    return {
      ok: true,
      message: `${company.name} ${qty}주 ${tradeType === 'BUY' ? '매수' : '매도'}가 성공적으로 체결되었습니다! (잔여금: ${newCash.toLocaleString()}원)`,
      asset: updatedAsset,
    };
  },

  // Synchronous asset getter from local storage with fallback
  getStudentAssetSync: (sessionId: string, studentId: string, fallbackStudent?: Student | { name: string; cash?: number; initialInvestment?: number } | null): StudentAsset => {
    const cleanSession = sessionId.toUpperCase();
    try {
      const localStr = localStorage.getItem(`fc_asset_${cleanSession}_${studentId}`);
      if (localStr) return JSON.parse(localStr);
    } catch {}

    const startCash = fallbackStudent?.cash || 1000000;
    return {
      studentId,
      studentName: fallbackStudent?.name || '학생',
      cash: startCash,
      initialInvestment: fallbackStudent?.initialInvestment || startCash,
      holdings: {},
      totalStockValuation: 0,
      totalAsset: startCash,
      profitAmount: 0,
      profitRate: 0,
      tradedThisRound: false,
    };
  },

  // Get Student Asset (Fallback safe, async)
  getStudentAsset: async (sessionId: string, studentId: string, fallbackStudent?: Student | { name: string; cash?: number; initialInvestment?: number } | null): Promise<StudentAsset> => {
    const cleanSession = sessionId.toUpperCase();
    // 1. Try Supabase
    if (supabaseDb.isReady()) {
      try {
        const sbAsset = await supabaseDb.getStudentAsset(cleanSession, studentId);
        if (sbAsset) return sbAsset;
      } catch {}
    }

    return syncManager.getStudentAssetSync(cleanSession, studentId, fallbackStudent);
  },
};

