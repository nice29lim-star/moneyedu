/**
 * =========================================================================
 * 금융교육 캠프 모의주식 웹애플리케이션 - Google Apps Script 백엔드 (Code.gs)
 * 스프레드시트 ID: 1YKUDdIE3_IYfopboAK_Diph9W6Yntc_V5Xyl649UE1w
 * =========================================================================
 */

const SPREADSHEET_ID = "1YKUDdIE3_IYfopboAK_Diph9W6Yntc_V5Xyl649UE1w";

// 스프레드시트 객체 반환
function getSS() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
}

// 탭 이름 또는 유사 이름으로 시트 탭 찾기
function getSheet(name) {
  const ss = getSS();
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;

  const sheets = ss.getSheets();
  for (let s of sheets) {
    if (s.getName().indexOf(name) !== -1) return s;
  }
  return null;
}

// 시트 데이터를 JSON 객체 배열로 변환
function sheetToObjects(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(function (h) { return String(h).trim(); });
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    let hasData = false;
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
      if (data[i][j] !== "") hasData = true;
    }
    if (hasData) rows.push(row);
  }
  return rows;
}

/**
 * 웹 앱 진입점: Index.html을 렌더링
 */
function doGet(e) {
  // 만약 API JSON 요청(action 파라미터 포함)인 경우 JSON 응답 처리
  if (e && e.parameter && e.parameter.action) {
    return handleApiGet(e.parameter);
  }

  const template = HtmlService.createTemplateFromFile("Index");
  return template
    .evaluate()
    .setTitle("🎮 상업고 금융교육 캠프 - 2D 모의주식 웹앱")
    .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * REST API GET 요청 핸들러 (CORS 대응)
 */
function handleApiGet(params) {
  const action = params.action;
  const sessionId = (params.sessionId || "").toUpperCase();
  const studentId = params.studentId || "";

  if (action === "getMasterData") {
    return createJsonResponse(apiGetMasterData());
  }
  if (action === "pollSession") {
    return createJsonResponse(apiPollSession(sessionId, studentId));
  }
  return createJsonResponse({ ok: false, message: "Unknown action: " + action });
}

function doPost(e) {
  try {
    const rawData = e.postData ? e.postData.contents : "{}";
    const body = JSON.parse(rawData);
    const action = body.action;

    if (action === "createSession") return createJsonResponse(apiCreateSession(body.teacherName));
    if (action === "teacherLogin") return createJsonResponse(apiTeacherLogin(body.sessionId, body.password));
    if (action === "updateSessionState") return createJsonResponse(apiUpdateSessionState(body.sessionId, body.module, body.round, body.stockState, body.quizIndex));
    if (action === "studentLogin") return createJsonResponse(apiStudentLogin(body.sessionId, body.name, body.studentNum));
    if (action === "saveBudget") return createJsonResponse(apiSaveBudget(body));
    if (action === "trade") return createJsonResponse(apiTradeStock(body));
    if (action === "giveQuizBonus") return createJsonResponse(apiGiveQuizBonus(body.sessionId, body.studentId, body.bonusAmount));
    if (action === "getRankings") return createJsonResponse(apiGetRankings(body.sessionId));

    return createJsonResponse({ ok: false, message: "Invalid action" });
  } catch (err) {
    return createJsonResponse({ ok: false, error: err.toString() });
  }
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// =========================================================================
// 클라이언트(google.script.run) 직접 호출용 RPC API 함수들
// =========================================================================

/**
 * 1. 기초 마스터 데이터 (직업, 퀴즈, 기업, 뉴스) 일괄 로드
 */
function apiGetMasterData() {
  try {
    const jobSheet = getSheet("직업") || getSheet("직업마스터") || getSS().getSheets()[6];
    const quizSheet = getSheet("퀴즈") || getSheet("퀴즈마스터") || getSS().getSheets()[7];
    const compSheet = getSheet("기업") || getSheet("기업마스터") || getSS().getSheets()[8];
    const newsSheet = getSheet("뉴스") || getSheet("뉴스마스터") || getSS().getSheets()[9];

    return {
      ok: true,
      jobs: sheetToObjects(jobSheet),
      quizzes: sheetToObjects(quizSheet),
      companies: sheetToObjects(compSheet),
      news: sheetToObjects(newsSheet),
    };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/**
 * 2. 강사: 신규 세션 개설
 */
function apiCreateSession(teacherName) {
  try {
    const sessionSheet = getSheet("세션") || getSS().getSheets()[0];
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "FC";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const nowStr = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");

    sessionSheet.appendRow([
      code,
      nowStr,
      "lobby",    // 현재모듈: lobby, quiz, budget, stock, report
      0,          // 주식_현재라운드 (0 ~ 6)
      "waiting",  // 주식_상태 (waiting, news, trading, closed)
      0,          // 현재퀴즈번호 (0 ~ 19)
      teacherName || "선생님"
    ]);

    return { ok: true, sessionId: code, token: "TKN_" + code };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/**
 * 3. 강사: 기존 세션 접속
 */
function apiTeacherLogin(sessionId, password) {
  try {
    const sessionSheet = getSheet("세션") || getSS().getSheets()[0];
    const sessions = sheetToObjects(sessionSheet);
    const target = sessions.find(function (s) {
      return String(s["세션ID"]).toUpperCase() === String(sessionId).toUpperCase();
    });

    if (!target) {
      return { ok: false, message: "존재하지 않는 세션 코드입니다." };
    }

    return {
      ok: true,
      sessionId: String(target["세션ID"]).toUpperCase(),
      session: target,
      token: "TKN_" + String(target["세션ID"]).toUpperCase(),
    };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/**
 * 4. 강사: 세션 상태 및 라운드 변경
 */
function apiUpdateSessionState(sessionId, currentModule, stockRound, stockState, currentQuizIndex) {
  try {
    const sessionSheet = getSheet("세션") || getSS().getSheets()[0];
    const data = sessionSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toUpperCase() === String(sessionId).toUpperCase()) {
        if (currentModule !== undefined && currentModule !== null) sessionSheet.getRange(i + 1, 3).setValue(currentModule);
        if (stockRound !== undefined && stockRound !== null) sessionSheet.getRange(i + 1, 4).setValue(stockRound);
        if (stockState !== undefined && stockState !== null) sessionSheet.getRange(i + 1, 5).setValue(stockState);
        if (currentQuizIndex !== undefined && currentQuizIndex !== null) sessionSheet.getRange(i + 1, 6).setValue(currentQuizIndex);
        break;
      }
    }

    return { ok: true, message: "세션 상태가 업데이트되었습니다." };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/**
 * 5. 학생: 로그인 & 참가자 등록
 */
function apiStudentLogin(sessionId, name, studentNum) {
  try {
    const sId = String(sessionId || "").toUpperCase().trim();
    const cleanName = String(name || "").trim();
    const cleanNum = String(studentNum || "").trim();
    const studentId = cleanName + "_" + cleanNum;

    // 세션 존재 확인
    const sessionSheet = getSheet("세션") || getSS().getSheets()[0];
    const sessions = sheetToObjects(sessionSheet);
    const session = sessions.find(function (s) { return String(s["세션ID"]).toUpperCase() === sId; });

    if (!session) {
      return { ok: false, message: "세션 코드가 올바르지 않습니다." };
    }

    // 학생 등록 여부 확인
    const studentSheet = getSheet("학생") || getSS().getSheets()[1];
    const students = sheetToObjects(studentSheet);
    let existing = students.find(function (st) {
      return String(st["세션ID"]).toUpperCase() === sId && String(st["학생ID"]) === studentId;
    });

    if (!existing) {
      const nowStr = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");
      studentSheet.appendRow([
        sId,
        studentId,
        cleanName,
        cleanNum,
        nowStr,
        0 // 초기 퀴즈보너스
      ]);
    }

    return {
      ok: true,
      student: {
        sessionId: sId,
        studentId: studentId,
        name: cleanName,
        studentNum: cleanNum,
        quizBonus: existing ? Number(existing["퀴즈보너스"] || 0) : 0,
      },
    };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/**
 * 6. 강사: 퀴즈 보너스 지급
 */
function apiGiveQuizBonus(sessionId, studentId, bonusAmount) {
  try {
    const studentSheet = getSheet("학생") || getSS().getSheets()[1];
    const data = studentSheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).toUpperCase() === String(sessionId).toUpperCase() && String(data[i][1]) === studentId) {
        const cur = Number(data[i][5]) || 0;
        studentSheet.getRange(i + 1, 6).setValue(cur + Number(bonusAmount));
        break;
      }
    }
    return { ok: true, message: "보너스가 성공적으로 지급되었습니다." };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/**
 * 7. 학생: 2단계 통장 배분 저장 및 모의주식 투자원금 초기화
 */
function apiSaveBudget(payload) {
  try {
    const { sessionId, studentId, jobTitle, preTax, postTax, quizBonus, totalAvailable, living, savings, invest } = payload;
    const sId = String(sessionId).toUpperCase();
    const budgetSheet = getSheet("예산") || getSheet("예산배분") || getSS().getSheets()[2];
    const assetSheet = getSheet("모의주식_학생자산") || getSheet("학생자산") || getSS().getSheets()[5];
    const nowStr = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");

    budgetSheet.appendRow([
      sId,
      studentId,
      jobTitle,
      preTax,
      postTax,
      quizBonus,
      totalAvailable,
      living,
      savings,
      invest,
      nowStr
    ]);

    // 자산 시트에 초기 투자원금 및 현금 등록
    const assetData = assetSheet.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < assetData.length; i++) {
      if (String(assetData[i][0]).toUpperCase() === sId && String(assetData[i][1]) === studentId) {
        assetSheet.getRange(i + 1, 3).setValue(invest);
        assetSheet.getRange(i + 1, 4).setValue(nowStr);
        assetSheet.getRange(i + 1, 5).setValue(0);
        found = true;
        break;
      }
    }
    if (!found) {
      assetSheet.appendRow([
        sId,
        studentId,
        invest, // 현금잔고
        nowStr,
        0       // 마지막 거래 라운드
      ]);
    }

    return { ok: true, message: "예산 배분이 안전하게 구글 시트에 저장되었습니다!" };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/**
 * 8. 학생: 3단계 모의주식 1회 매수 / 매도 체결
 */
function apiTradeStock(payload) {
  try {
    const { sessionId, studentId, studentName, round, companyName, tradeType, quantity, unitPrice } = payload;
    const sId = String(sessionId).toUpperCase();
    const qty = Number(quantity);
    const price = Number(unitPrice);
    const totalAmount = qty * price;
    const isBuy = tradeType === "BUY" || tradeType === "매수";
    const nowStr = Utilities.formatDate(new Date(), "GMT+9", "yyyy-MM-dd HH:mm:ss");

    const tradeSheet = getSheet("거래내역") || getSS().getSheets()[3];
    const holdSheet = getSheet("보유주식") || getSS().getSheets()[4];
    const assetSheet = getSheet("모의주식_학생자산") || getSheet("학생자산") || getSS().getSheets()[5];

    // 8-1. 거래내역 행 추가
    tradeSheet.appendRow([
      nowStr,
      sId,
      studentId,
      round,
      companyName,
      isBuy ? "매수" : "매도",
      qty,
      price
    ]);

    // 8-2. 현금 잔고 갱신
    const assetData = assetSheet.getDataRange().getValues();
    let currentCash = 0;
    for (let i = 1; i < assetData.length; i++) {
      if (String(assetData[i][0]).toUpperCase() === sId && String(assetData[i][1]) === studentId) {
        currentCash = Number(assetData[i][2]) || 0;
        currentCash = isBuy ? (currentCash - totalAmount) : (currentCash + totalAmount);
        assetSheet.getRange(i + 1, 3).setValue(currentCash);
        assetSheet.getRange(i + 1, 4).setValue(nowStr);
        assetSheet.getRange(i + 1, 5).setValue(round);
        break;
      }
    }

    // 8-3. 보유 주식 갱신
    const holdData = holdSheet.getDataRange().getValues();
    let foundHold = false;
    for (let i = 1; i < holdData.length; i++) {
      if (String(holdData[i][0]).toUpperCase() === sId && String(holdData[i][1]) === studentId && String(holdData[i][2]) === companyName) {
        foundHold = true;
        let oldQty = Number(holdData[i][3]) || 0;
        let oldAvg = Number(holdData[i][4]) || 0;

        if (isBuy) {
          let newQty = oldQty + qty;
          let newAvg = Math.round(((oldQty * oldAvg) + totalAmount) / newQty);
          holdSheet.getRange(i + 1, 4).setValue(newQty);
          holdSheet.getRange(i + 1, 5).setValue(newAvg);
        } else {
          let newQty = Math.max(0, oldQty - qty);
          holdSheet.getRange(i + 1, 4).setValue(newQty);
        }
        break;
      }
    }

    if (!foundHold && isBuy) {
      holdSheet.appendRow([
        sId,
        studentId,
        companyName,
        qty,
        price
      ]);
    }

    return {
      ok: true,
      message: companyName + " " + qty + "주 " + (isBuy ? "매수" : "매도") + "가 체결되었습니다!",
      cash: currentCash,
    };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/**
 * 9. 실시간 세션 상태 폴링 (학생/강사 공통)
 */
function apiPollSession(sessionId, studentId) {
  try {
    const sId = String(sessionId || "").toUpperCase();
    const sessionSheet = getSheet("세션") || getSS().getSheets()[0];
    const studentSheet = getSheet("학생") || getSS().getSheets()[1];
    const budgetSheet = getSheet("예산") || getSheet("예산배분") || getSS().getSheets()[2];
    const holdSheet = getSheet("보유주식") || getSS().getSheets()[4];
    const assetSheet = getSheet("모의주식_학생자산") || getSheet("학생자산") || getSS().getSheets()[5];
    const compSheet = getSheet("기업") || getSheet("기업마스터") || getSS().getSheets()[8];
    const newsSheet = getSheet("뉴스") || getSheet("뉴스마스터") || getSS().getSheets()[9];

    const sessions = sheetToObjects(sessionSheet);
    const session = sessions.find(function (s) { return String(s["세션ID"]).toUpperCase() === sId; });

    if (!session) {
      return { ok: false, message: "세션을 찾을 수 없습니다." };
    }

    const students = sheetToObjects(studentSheet).filter(function (st) { return String(st["세션ID"]).toUpperCase() === sId; });
    const budgets = sheetToObjects(budgetSheet).filter(function (b) { return String(b["세션ID"]).toUpperCase() === sId; });
    const holdings = sheetToObjects(holdSheet).filter(function (h) { return String(h["세션ID"]).toUpperCase() === sId; });
    const assets = sheetToObjects(assetSheet).filter(function (a) { return String(a["세션ID"]).toUpperCase() === sId; });
    const companies = sheetToObjects(compSheet);
    const allNews = sheetToObjects(newsSheet);

    let myStudent = null;
    let myBudget = null;
    let myAsset = null;
    let myHoldings = [];

    if (studentId) {
      myStudent = students.find(function (s) { return String(s["학생ID"]) === studentId; }) || null;
      myBudget = budgets.find(function (b) { return String(b["학생ID"]) === studentId; }) || null;
      myAsset = assets.find(function (a) { return String(a["학생ID"]) === studentId; }) || null;
      myHoldings = holdings.filter(function (h) { return String(h["학생ID"]) === studentId; });
    }

    return {
      ok: true,
      session: session,
      students: students,
      budgets: budgets,
      companies: companies,
      allNews: allNews,
      myStudent: myStudent,
      myBudget: myBudget,
      myAsset: myAsset,
      myHoldings: myHoldings,
    };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

/**
 * 10. 종합 순위 및 리포트 집계
 */
function apiGetRankings(sessionId) {
  try {
    const sId = String(sessionId || "").toUpperCase();
    const poll = apiPollSession(sId, "");
    if (!poll.ok) return poll;

    const students = poll.students || [];
    const budgets = poll.budgets || [];
    const assets = poll.myAsset ? [poll.myAsset] : (sheetToObjects(getSheet("모의주식_학생자산") || getSS().getSheets()[5])).filter(function (a) { return String(a["세션ID"]).toUpperCase() === sId; });
    const holdings = (sheetToObjects(getSheet("보유주식") || getSS().getSheets()[4])).filter(function (h) { return String(h["세션ID"]).toUpperCase() === sId; });
    const companies = poll.companies || [];

    // 기업 현재가 맵 생성
    const priceMap = {};
    companies.forEach(function (c) {
      priceMap[c["기업명"]] = Number(c["현재가"] || c["초기가"] || 5000);
    });

    const rankings = students.map(function (st) {
      const stId = st["학생ID"];
      const bg = budgets.find(function (b) { return String(b["학생ID"]) === stId; });
      const as = assets.find(function (a) { return String(a["학생ID"]) === stId; });
      const myHolds = holdings.filter(function (h) { return String(h["학생ID"]) === stId; });

      const initialInvest = bg ? Number(bg["투자"] || 0) : 500000;
      const cash = as ? Number(as["현금잔고"] || 0) : initialInvest;

      let stockVal = 0;
      myHolds.forEach(function (h) {
        const p = priceMap[h["기업명"]] || 5000;
        stockVal += Number(h["보유수량"] || 0) * p;
      });

      const totalAsset = cash + stockVal;
      const profit = totalAsset - initialInvest;
      const profitRate = initialInvest > 0 ? (profit / initialInvest) * 100 : 0;

      return {
        studentId: stId,
        studentName: st["이름"] || stId,
        studentNum: st["학번"] || "",
        jobTitle: bg ? bg["직업명"] : "금융 참가자",
        initialInvestment: initialInvest,
        finalCash: cash,
        finalStockValuation: stockVal,
        finalTotalAsset: totalAsset,
        totalProfit: profit,
        profitRate: profitRate,
        holdings: myHolds,
        investorType: getInvestorPersona(profitRate, myHolds.length),
      };
    });

    // 수익률 기준 내림차순 정렬
    rankings.sort(function (a, b) { return b.profitRate - a.profitRate; });
    rankings.forEach(function (r, idx) {
      r.rank = idx + 1;
      r.totalStudents = rankings.length;
    });

    let avgProfit = 0;
    if (rankings.length > 0) {
      const sum = rankings.reduce(function (acc, cur) { return acc + cur.profitRate; }, 0);
      avgProfit = sum / rankings.length;
    }

    return {
      ok: true,
      rankings: rankings,
      averageProfitRate: avgProfit,
    };
  } catch (e) {
    return { ok: false, error: e.toString() };
  }
}

// 투자 성향 페르소나 산출 헬퍼
function getInvestorPersona(profitRate, holdingsCount) {
  if (profitRate >= 30) {
    return {
      badge: "슈퍼 버핏형",
      title: "탁월한 시장 통찰가",
      description: "뉴스와 시장 흐름을 완벽히 읽고 과감하고 정밀한 결단력으로 최고의 수익률을 창출했습니다.",
      tips: "시장 변동성이 커질 때 리스크 분산(포트폴리오) 전략을 병행하면 더욱 안정적인 자산 증식이 가능합니다."
    };
  } else if (profitRate >= 10) {
    return {
      badge: "스마트 성장형",
      title: "균형 잡힌 트레이더",
      description: "안정적인 기업 분석을 기반으로 시장 평균을 뛰어넘는 우수한 성과를 달성했습니다.",
      tips: "수익이 난 종목의 분할 매도 타이밍을 익히면 자산 보호력이 극대화됩니다."
    };
  } else if (profitRate >= 0) {
    return {
      badge: "든든 방어형",
      title: "원금 수호 안정가",
      description: "변동성이 큰 시장 속에서도 신중한 의사결정으로 소중한 자산을 안전하게 지켜냈습니다.",
      tips: "확신이 있는 유망 업종에는 조금 더 과감한 분할 매수를 시도해보는 것도 좋습니다."
    };
  } else {
    return {
      badge: "도전 모험형",
      title: "열정적 성장 탐험가",
      description: "시장의 거센 파도를 직접 경험하며 값진 실전 교훈을 얻었습니다. 실패는 성공의 가장 큰 밑거름입니다.",
      tips: "단기 급등락 뉴스에 휩쓸리기보다 기업의 본질적 가치와 분산 투자의 중요성을 기억하세요."
    };
  }
}
