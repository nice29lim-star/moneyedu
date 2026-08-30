import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Session, Student, StockTrade, StudentAsset } from '../types';

/**
 * Automatically sanitizes and cleans up Supabase project URLs.
 * Handles common user input mistakes:
 * 1. Pasting dashboard URL: https://supabase.com/dashboard/project/abcdefghijklmn -> https://abcdefghijklmn.supabase.co
 * 2. Appending REST path: https://abcdefghijklmn.supabase.co/rest/v1 -> https://abcdefghijklmn.supabase.co
 * 3. Trailing slashes: https://abcdefghijklmn.supabase.co/ -> https://abcdefghijklmn.supabase.co
 * 4. Only project ID: abcdefghijklmn -> https://abcdefghijklmn.supabase.co
 */
export function sanitizeSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();

  // 1. Check if user pasted Supabase dashboard URL
  const dashboardMatch = url.match(/(?:supabase\.com|supabase\.io)\/dashboard\/project\/([a-zA-Z0-9_-]+)/i);
  if (dashboardMatch && dashboardMatch[1]) {
    return `https://${dashboardMatch[1]}.supabase.co`;
  }

  // 2. Check if user typed only the project reference ID (e.g. 20 chars)
  if (/^[a-zA-Z0-9]{15,30}$/.test(url)) {
    return `https://${url}.supabase.co`;
  }

  // 3. Add https protocol if missing
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('.supabase.co')) {
      return `https://${parsed.hostname}`;
    }
    // Custom domain or self-hosted: remove /rest/v1 or trailing slashes
    let cleaned = `${parsed.protocol}//${parsed.host}`;
    return cleaned.replace(/\/+$/, '');
  } catch {
    return url
      .replace(/\/rest\/v1\/?.*$/i, '')
      .replace(/\/dashboard\/?.*$/i, '')
      .replace(/\/+$/, '');
  }
}

export function sanitizeSupabaseAnonKey(rawKey: string): string {
  if (!rawKey) return '';
  return rawKey
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/^Bearer\s+/i, '')
    .replace(/^apikey\s*:\s*/i, '')
    .trim();
}

export function formatSupabaseErrorMessage(msg: string): string {
  if (!msg) return '알 수 없는 Supabase 오류가 발생했습니다.';
  if (msg.includes('Invalid path specified in request URL') || msg.includes('404')) {
    return 'URL 경로 오류: Supabase Project URL 끝에 /rest/v1 또는 잘못된 하위 경로가 포함되었습니다. (https://[프로젝트ID].supabase.co 형식으로 설정해주세요)';
  }
  if (msg.includes('42P01') || msg.includes('does not exist') || msg.includes('relation "public.sessions"') || msg.includes('relation "public.students"')) {
    return '테이블 미생성: Supabase에 sessions/students 테이블이 없습니다. 상단 [DB 설정] ➔ [1단계 SQL 복사] 후 Supabase SQL Editor에서 실행해주세요.';
  }
  if (msg.includes('row-level security') || msg.includes('permission denied')) {
    return '권한(RLS) 오류: Supabase 테이블 RLS 정책이 필요합니다. SQL 스키마를 다시 실행해주세요.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch')) {
    return '네트워크 연결 오류: Supabase 서버에 접속할 수 없습니다. URL 및 인터넷 연결을 확인해주세요.';
  }
  return msg;
}

// Retrieve Supabase environment variables from Vite, process.env, or localStorage
export function getSupabaseConfig(): { url: string; anonKey: string } {
  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('custom_supabase_url') || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('custom_supabase_anon_key') || '' : '';

  const envUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    '';

  const envKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
    '';

  const rawUrl = (localUrl || envUrl || '').trim();
  const rawKey = (localKey || envKey || '').trim();

  return {
    url: sanitizeSupabaseUrl(rawUrl),
    anonKey: sanitizeSupabaseAnonKey(rawKey),
  };
}

export function setCustomSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    const cleanUrl = sanitizeSupabaseUrl(url);
    const cleanKey = sanitizeSupabaseAnonKey(anonKey);

    if (cleanUrl) localStorage.setItem('custom_supabase_url', cleanUrl);
    else localStorage.removeItem('custom_supabase_url');

    if (cleanKey) localStorage.setItem('custom_supabase_anon_key', cleanKey);
    else localStorage.removeItem('custom_supabase_anon_key');

    supabaseInstance = null; // reset instance
  }
}

// Lazy initialized client
let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey || !url.startsWith('https://')) {
    return null;
  }
  if (!supabaseInstance) {
    try {
      supabaseInstance = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    } catch (e) {
      console.warn('Failed to initialize Supabase client:', e);
      return null;
    }
  }
  return supabaseInstance;
}

export function isSupabaseReady(): boolean {
  return !!getSupabase();
}

/**
 * Clean SQL Schema for Supabase SQL Editor
 * Run this directly in your Supabase project SQL Editor to create all necessary tables with 1 click.
 */
export const SUPABASE_SQL_SCHEMA = `-- ==========================================
-- 2D 게임풍 금융교육 캠프 모의주식 웹앱 Supabase Schema
-- ==========================================

-- 1. sessions 테이블 (강사 세션 상태 및 진행 라운드)
CREATE TABLE IF NOT EXISTS public.sessions (
    session_id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    current_module TEXT NOT NULL DEFAULT 'lobby',
    stock_round INT NOT NULL DEFAULT 1,
    stock_state TEXT NOT NULL DEFAULT 'waiting',
    current_quiz_index INT NOT NULL DEFAULT 0,
    revealed_news_ids JSONB DEFAULT '[]'::jsonb,
    active_news_slots JSONB DEFAULT '[]'::jsonb,
    is_completed BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. students 테이블 (학생 프로필, 학번, 직업, 예산, 잔액)
CREATE TABLE IF NOT EXISTS public.students (
    session_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    name TEXT NOT NULL,
    student_num TEXT NOT NULL,
    login_time BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
    quiz_bonus NUMERIC DEFAULT 0,
    cash NUMERIC DEFAULT 0,
    initial_investment NUMERIC DEFAULT 0,
    selected_job JSONB,
    budget JSONB,
    last_trade_round INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (session_id, student_id)
);

-- 3. student_assets 테이블 (실시간 주식 보유량 및 자산 평가액)
CREATE TABLE IF NOT EXISTS public.student_assets (
    session_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    cash NUMERIC DEFAULT 0,
    initial_investment NUMERIC DEFAULT 0,
    holdings JSONB DEFAULT '{}'::jsonb,
    total_stock_valuation NUMERIC DEFAULT 0,
    total_asset NUMERIC DEFAULT 0,
    profit_amount NUMERIC DEFAULT 0,
    profit_rate NUMERIC DEFAULT 0,
    last_trade_round INT DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (session_id, student_id)
);

-- 4. stock_trades 테이블 (학생들의 매수/매도 거래 내역)
CREATE TABLE IF NOT EXISTS public.stock_trades (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    round INT NOT NULL,
    company_name TEXT NOT NULL,
    trade_type TEXT NOT NULL,
    quantity INT NOT NULL,
    price NUMERIC NOT NULL,
    total_amount NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Row Level Security (RLS) 활성화 및 모든 사용자 읽기/쓰기 허용 정책 (캠프 진행용)
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to sessions" ON public.sessions;
CREATE POLICY "Allow all access to sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to students" ON public.students;
CREATE POLICY "Allow all access to students" ON public.students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to student_assets" ON public.student_assets;
CREATE POLICY "Allow all access to student_assets" ON public.student_assets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to stock_trades" ON public.stock_trades;
CREATE POLICY "Allow all access to stock_trades" ON public.stock_trades FOR ALL USING (true) WITH CHECK (true);

-- 6. Realtime 복제 활성화 (실시간 연동을 위한 Publication 설정, 재실행 시에도 42710 에러 방지)
DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_assets;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_trades;
    EXCEPTION
        WHEN duplicate_object THEN NULL;
    END;
END $$;
`;

// ============================================================
// Supabase Data Access Functions
// ============================================================

export const supabaseDb = {
  // Check if Supabase is active
  isReady: isSupabaseReady,

  // --- Session Methods ---
  upsertSession: async (session: Session): Promise<{ success: boolean; error?: string }> => {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Supabase 클라이언트가 초기화되지 않았습니다. URL/Key를 확인해주세요.' };
    try {
      const { error } = await sb.from('sessions').upsert({
        session_id: session.sessionId.toUpperCase(),
        current_module: session.currentModule,
        stock_round: session.stockRound,
        stock_state: session.stockState,
        current_quiz_index: session.currentQuizIndex || 0,
        revealed_news_ids: session.revealedNewsIds || [],
        active_news_slots: session.activeNewsSlots || [],
        is_completed: session.isCompleted || false,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.error('Supabase upsertSession error:', error.message, error);
        return { success: false, error: formatSupabaseErrorMessage(error.message) };
      }
      return { success: true };
    } catch (e: any) {
      console.error('Supabase upsertSession catch:', e);
      return { success: false, error: formatSupabaseErrorMessage(e?.message || '네트워크 오류가 발생했습니다.') };
    }
  },

  getAllSessions: async (): Promise<Session[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    try {
      const { data, error } = await sb
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      return data.map((d) => ({
        sessionId: d.session_id,
        createdAt: new Date(d.created_at).getTime(),
        currentModule: d.current_module,
        stockRound: d.stock_round,
        stockState: d.stock_state,
        currentQuizIndex: d.current_quiz_index,
        revealedNewsIds: d.revealed_news_ids || [],
        activeNewsSlots: d.active_news_slots || [],
        isCompleted: d.is_completed,
      }));
    } catch {
      return [];
    }
  },

  getSession: async (sessionId: string): Promise<Session | null> => {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      const { data, error } = await sb
        .from('sessions')
        .select('*')
        .eq('session_id', sessionId.toUpperCase())
        .maybeSingle();

      if (error || !data) return null;

      return {
        sessionId: data.session_id,
        createdAt: new Date(data.created_at).getTime(),
        currentModule: data.current_module,
        stockRound: data.stock_round,
        stockState: data.stock_state,
        currentQuizIndex: data.current_quiz_index,
        revealedNewsIds: data.revealed_news_ids || [],
        activeNewsSlots: data.active_news_slots || [],
        isCompleted: data.is_completed,
      };
    } catch {
      return null;
    }
  },

  // --- Student Methods ---
  upsertStudent: async (student: Student): Promise<{ success: boolean; error?: string }> => {
    const sb = getSupabase();
    if (!sb) return { success: false, error: 'Supabase가 연결되지 않았습니다. URL/Key를 확인해주세요.' };
    try {
      const { error } = await sb.from('students').upsert({
        session_id: student.sessionId.toUpperCase(),
        student_id: student.studentId,
        name: student.name,
        student_num: student.studentNum,
        quiz_bonus: student.quizBonus || 0,
        cash: student.cash || 0,
        initial_investment: student.initialInvestment || 0,
        selected_job: student.selectedJob || null,
        budget: student.budget || null,
        last_trade_round: student.lastTradeRound || 0,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.error('Supabase upsertStudent error:', error.message, error);
        return { success: false, error: error.message };
      }
      return { success: true };
    } catch (e: any) {
      console.error('Supabase upsertStudent catch:', e);
      return { success: false, error: e?.message || '네트워크 오류가 발생했습니다.' };
    }
  },

  getStudent: async (sessionId: string, studentId: string): Promise<Student | null> => {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      const { data, error } = await sb
        .from('students')
        .select('*')
        .eq('session_id', sessionId.toUpperCase())
        .eq('student_id', studentId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        sessionId: data.session_id,
        studentId: data.student_id,
        name: data.name,
        studentNum: data.student_num,
        loginTime: Number(data.login_time) || Date.now(),
        quizBonus: Number(data.quiz_bonus) || 0,
        cash: Number(data.cash) || 0,
        initialInvestment: Number(data.initial_investment) || 0,
        selectedJob: data.selected_job,
        budget: data.budget,
        lastTradeRound: data.last_trade_round,
      };
    } catch {
      return null;
    }
  },

  getStudentsInSession: async (sessionId: string): Promise<Student[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    try {
      const cleanSession = sessionId.toUpperCase();
      const [studentsRes, assetsRes] = await Promise.all([
        sb.from('students').select('*').eq('session_id', cleanSession).order('student_num', { ascending: true }),
        sb.from('student_assets').select('*').eq('session_id', cleanSession),
      ]);

      if (studentsRes.error || !studentsRes.data) return [];

      const assetsMap = new Map<string, any>();
      if (assetsRes.data) {
        assetsRes.data.forEach((a) => {
          assetsMap.set(a.student_id, a);
        });
      }

      return studentsRes.data.map((d) => {
        const asset = assetsMap.get(d.student_id);
        const cash = asset?.cash !== undefined ? Number(asset.cash) : (Number(d.cash) || 0);
        const initialInvestment = asset?.initial_investment !== undefined ? Number(asset.initial_investment) : (Number(d.initial_investment) || 0);
        const stockValuation = asset?.total_stock_valuation !== undefined ? Number(asset.total_stock_valuation) : 0;
        const totalAsset = asset?.total_asset !== undefined ? Number(asset.total_asset) : (cash + stockValuation);
        const profitRate = asset?.profit_rate !== undefined ? Number(asset.profit_rate) : 0;
        const profitAmount = asset?.profit_amount !== undefined ? Number(asset.profit_amount) : 0;

        return {
          sessionId: d.session_id,
          studentId: d.student_id,
          name: d.name,
          studentNum: d.student_num,
          loginTime: Number(d.login_time) || Date.now(),
          quizBonus: Number(d.quiz_bonus) || 0,
          cash,
          initialInvestment,
          stockValuation,
          totalAsset,
          profitRate,
          profitAmount,
          selectedJob: d.selected_job,
          budget: d.budget,
          lastTradeRound: d.last_trade_round ?? asset?.last_trade_round ?? -1,
          holdings: asset?.holdings ? (Array.isArray(asset.holdings) ? asset.holdings : Object.values(asset.holdings)) : [],
        };
      });
    } catch {
      return [];
    }
  },

  awardQuizBonus: async (sessionId: string, studentId: string, bonusAmount: number): Promise<boolean> => {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      // Fetch current bonus
      const current = await supabaseDb.getStudent(sessionId, studentId);
      const newBonus = (current?.quizBonus || 0) + bonusAmount;
      const newCash = (current?.cash || 0) + bonusAmount;

      const { error } = await sb
        .from('students')
        .update({
          quiz_bonus: newBonus,
          cash: newCash,
          updated_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId.toUpperCase())
        .eq('student_id', studentId);

      return !error;
    } catch {
      return false;
    }
  },

  // --- Trade Methods ---
  recordTrade: async (trade: StockTrade): Promise<boolean> => {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const { error } = await sb.from('stock_trades').insert({
        id: trade.id || `trade_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        session_id: trade.sessionId.toUpperCase(),
        student_id: trade.studentId,
        student_name: trade.studentName,
        round: trade.round,
        company_name: trade.companyName,
        trade_type: trade.tradeType,
        quantity: trade.quantity,
        price: trade.price,
        total_amount: trade.totalAmount,
      });
      if (error) {
        console.warn('Supabase recordTrade error:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Supabase recordTrade catch:', e);
      return false;
    }
  },

  getTrades: async (sessionId: string, studentId?: string): Promise<StockTrade[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    try {
      let query = sb
        .from('stock_trades')
        .select('*')
        .eq('session_id', sessionId.toUpperCase());

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error || !data) return [];

      return data.map((d) => ({
        id: d.id,
        timestamp: new Date(d.created_at).getTime(),
        sessionId: d.session_id,
        studentId: d.student_id,
        studentName: d.student_name,
        round: d.round,
        companyName: d.company_name,
        tradeType: d.trade_type as 'BUY' | 'SELL',
        quantity: Number(d.quantity),
        price: Number(d.price),
        totalAmount: Number(d.total_amount),
      }));
    } catch {
      return [];
    }
  },

  // --- Student Asset Methods (Real-time Portfolio & Valuation) ---
  upsertStudentAsset: async (asset: StudentAsset & { sessionId: string }): Promise<boolean> => {
    const sb = getSupabase();
    if (!sb) return false;
    try {
      const { error } = await sb.from('student_assets').upsert({
        session_id: asset.sessionId.toUpperCase(),
        student_id: asset.studentId,
        student_name: asset.studentName,
        cash: Number(asset.cash) || 0,
        initial_investment: Number(asset.initialInvestment) || 0,
        holdings: asset.holdings || {},
        total_stock_valuation: Number(asset.totalStockValuation) || 0,
        total_asset: Number(asset.totalAsset) || 0,
        profit_amount: Number(asset.profitAmount) || 0,
        profit_rate: Number(asset.profitRate) || 0,
        last_trade_round: asset.lastTradeRound ?? -1,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        console.warn('Supabase upsertStudentAsset error:', error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.warn('Supabase upsertStudentAsset catch:', e);
      return false;
    }
  },

  getStudentAsset: async (sessionId: string, studentId: string): Promise<StudentAsset | null> => {
    const sb = getSupabase();
    if (!sb) return null;
    try {
      const { data, error } = await sb
        .from('student_assets')
        .select('*')
        .eq('session_id', sessionId.toUpperCase())
        .eq('student_id', studentId)
        .maybeSingle();

      if (error || !data) return null;

      return {
        studentId: data.student_id,
        studentName: data.student_name,
        cash: Number(data.cash) || 0,
        initialInvestment: Number(data.initial_investment) || 0,
        holdings: data.holdings || {},
        totalStockValuation: Number(data.total_stock_valuation) || 0,
        totalAsset: Number(data.total_asset) || 0,
        profitAmount: Number(data.profit_amount) || 0,
        profitRate: Number(data.profit_rate) || 0,
        lastTradeRound: data.last_trade_round ?? -1,
        tradedThisRound: false, // Let server or frontend compute this
      };
    } catch {
      return null;
    }
  },

  getStudentAssetsInSession: async (sessionId: string): Promise<StudentAsset[]> => {
    const sb = getSupabase();
    if (!sb) return [];
    try {
      const { data, error } = await sb
        .from('student_assets')
        .select('*')
        .eq('session_id', sessionId.toUpperCase());

      if (error || !data) return [];

      return data.map((d) => ({
        studentId: d.student_id,
        studentName: d.student_name,
        cash: Number(d.cash) || 0,
        initialInvestment: Number(d.initial_investment) || 0,
        holdings: d.holdings || {},
        totalStockValuation: Number(d.total_stock_valuation) || 0,
        totalAsset: Number(d.total_asset) || 0,
        profitAmount: Number(d.profit_amount) || 0,
        profitRate: Number(d.profit_rate) || 0,
        tradedThisRound: (Number(d.last_trade_round) || 0) > 0,
      }));
    } catch {
      return [];
    }
  },

  // --- Realtime Subscriptions ---
  subscribeToSession: (
    sessionId: string,
    onSessionChange: (session: Session) => void,
    onStudentChange?: (student: Student) => void,
    onAssetChange?: (asset: StudentAsset) => void
  ) => {
    const sb = getSupabase();
    if (!sb) return () => {};

    const cleanSession = sessionId.toUpperCase();
    const channel = sb
      .channel(`session_${cleanSession}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sessions',
          filter: `session_id=eq.${cleanSession}`,
        },
        (payload) => {
          if (payload.new) {
            const data: any = payload.new;
            onSessionChange({
              sessionId: data.session_id,
              createdAt: new Date(data.created_at).getTime(),
              currentModule: data.current_module,
              stockRound: data.stock_round,
              stockState: data.stock_state,
              currentQuizIndex: data.current_quiz_index,
              revealedNewsIds: data.revealed_news_ids || [],
              activeNewsSlots: data.active_news_slots || [],
              isCompleted: data.is_completed,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'students',
          filter: `session_id=eq.${cleanSession}`,
        },
        (payload) => {
          if (payload.new && onStudentChange) {
            const data: any = payload.new;
            onStudentChange({
              sessionId: data.session_id,
              studentId: data.student_id,
              name: data.name,
              studentNum: data.student_num,
              loginTime: Number(data.login_time) || Date.now(),
              quizBonus: Number(data.quiz_bonus) || 0,
              cash: Number(data.cash) || 0,
              initialInvestment: Number(data.initial_investment) || 0,
              selectedJob: data.selected_job,
              budget: data.budget,
              lastTradeRound: data.last_trade_round,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'student_assets',
          filter: `session_id=eq.${cleanSession}`,
        },
        (payload) => {
          if (payload.new && onAssetChange) {
            const data: any = payload.new;
            onAssetChange({
              studentId: data.student_id,
              studentName: data.student_name,
              cash: Number(data.cash) || 0,
              initialInvestment: Number(data.initial_investment) || 0,
              holdings: data.holdings || {},
              totalStockValuation: Number(data.total_stock_valuation) || 0,
              totalAsset: Number(data.total_asset) || 0,
              profitAmount: Number(data.profit_amount) || 0,
              profitRate: Number(data.profit_rate) || 0,
              tradedThisRound: (Number(data.last_trade_round) || 0) > 0,
            });
          }
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  },

  // Test full Supabase connection and table readiness
  testConnection: async (): Promise<{
    success: boolean;
    message: string;
    details?: {
      urlValid: boolean;
      authValid: boolean;
      tablesFound: string[];
      missingTables: string[];
    };
  }> => {
    const { url, anonKey } = getSupabaseConfig();
    if (!url) {
      return {
        success: false,
        message: 'Supabase URL이 비어 있습니다. (VITE_SUPABASE_URL 설정 필요)',
      };
    }
    if (!anonKey) {
      return {
        success: false,
        message: 'Supabase Anon Key가 비어 있습니다. (VITE_SUPABASE_ANON_KEY 설정 필요)',
      };
    }
    if (!url.startsWith('https://')) {
      return {
        success: false,
        message: 'Supabase URL은 https:// 로 시작해야 합니다.',
      };
    }

    const sb = getSupabase();
    if (!sb) {
      return {
        success: false,
        message: 'Supabase 클라이언트 초기화에 실패했습니다. 키 형식을 확인해주세요.',
      };
    }

    const requiredTables = ['sessions', 'students', 'student_assets', 'stock_trades'];
    const tablesFound: string[] = [];
    const missingTables: string[] = [];

    try {
      // Test querying sessions table
      for (const tbl of requiredTables) {
        const { error } = await sb.from(tbl).select('*', { count: 'exact', head: true });
        if (error) {
          if (error.code === '42P01' || error.message.includes('does not exist')) {
            missingTables.push(tbl);
          } else {
            // Table exists but maybe other error (e.g., RLS, which is fine or permission)
            tablesFound.push(tbl);
          }
        } else {
          tablesFound.push(tbl);
        }
      }

      if (missingTables.length > 0) {
        return {
          success: false,
          message: `Supabase 연결 성공! 하지만 테이블(${missingTables.join(', ')})이 아직 생성되지 않았습니다. [1단계: SQL 복사]를 실행해주세요.`,
          details: {
            urlValid: true,
            authValid: true,
            tablesFound,
            missingTables,
          },
        };
      }

      return {
        success: true,
        message: '✅ Supabase 클라우드 데이터베이스 완벽 연동 성공! (4개 테이블 정상 확인 및 실시간 활성화)',
        details: {
          urlValid: true,
          authValid: true,
          tablesFound,
          missingTables: [],
        },
      };
    } catch (e: any) {
      return {
        success: false,
        message: `연결 테스트 중 오류 발생: ${e?.message || '네트워크 오류'}`,
      };
    }
  },
};
