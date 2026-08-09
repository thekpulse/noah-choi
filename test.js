/* ===================================================================
   영끌계산기 — 회귀 테스트 (v22.5용)
   실행:  node test.js
          node test.js /경로/yeongkkeul-calculator.html

   ⚠ 구 test.js(888개)는 DOM id에 묶여 있어 새 본체에 붙지 않습니다.
     이 파일은 **계산 엔진만** 봅니다(지침 v4 9장의 1단계).
     화면 규칙은 브라우저 콘솔의 __selfcheck() 13항목이 봅니다. 역할이 다릅니다.

   ⚠ 엔진 함수는 HTML에서 직접 뜯어옵니다. 복사본을 두면 반드시 어긋납니다(원칙 58).
   =================================================================== */

const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || path.join(__dirname, 'yeongkkeul-calculator.html');

/* ── 엔진 적재 ────────────────────────────────────────────────── */
let UI = '';   /* 화면 코드 — 단위 경계 검사(19장)에 씁니다 */
function loadEngine(file){
  const html = fs.readFileSync(file, 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  let src = blocks[blocks.length - 1];
  /* 엔진과 화면 코드는 BUILD 로그 줄로 갈립니다. 화면 코드를 실행하면 DOM이 없어 죽습니다. */
  const cut = src.indexOf("console.info('영끌계산기 BUILD");
  if (cut > 0) { UI = src.slice(cut); src = src.slice(0, cut); }
  const NEED = ['formatWon','POLICY','POLICY_DEFS','STRESS','computeStressBp','getLTV',
                'repaymentCapLimit','acquisitionTaxRate','calcCosts','solveMaxPrice',
                'monthlyPaymentCalc','zoneFromSgg','roomDeductFromSgg','LAWD','isGunArea'];
  const stub = `
    const window = {}, document = { getElementById:()=>null, querySelector:()=>null,
      querySelectorAll:()=>[], createElement:()=>({style:{},classList:{add(){},remove(){},toggle(){}}}) };
    const console = { info(){}, error(){}, warn(){}, log(){} };
    const navigator = {}, performance = { now:()=>0 };
    const requestAnimationFrame = null, getComputedStyle = ()=>({getPropertyValue:()=>''});
  `;
  const fn = new Function(stub + '\n' + src + '\nreturn {' + NEED.join(',') + '};');
  return fn();
}

let E;
try { E = loadEngine(FILE); }
catch (e) { console.error('🔴 엔진을 읽지 못했습니다:', FILE, '\n', e.message); process.exit(1); }

const { formatWon, POLICY, getLTV, acquisitionTaxRate, calcCosts, solveMaxPrice,
        monthlyPaymentCalc, computeStressBp, zoneFromSgg, roomDeductFromSgg, LAWD } = E;

/* ── 러너 ─────────────────────────────────────────────────────── */
let pass = 0; const fails = [];
function t(name, actual, expected){
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  ok ? pass++ : fails.push({ name, expected, actual });
}
function tt(name, cond, detail){
  cond ? pass++ : fails.push({ name, expected:'true', actual: detail === undefined ? 'false' : detail });
}
function near(name, actual, expected, tol){
  const ok = Math.abs(actual - expected) <= (tol || 1);
  ok ? pass++ : fails.push({ name, expected, actual });
}

/* ── 표준 컨텍스트 ────────────────────────────────────────────── */
const 만 = v => v * 10000;
function ctx(over){
  return Object.assign({
    price: 0, houseStatus: 'none', regulated: false, metro: true,
    income: 만(8000), incomeEntered: true,
    rate: 5.4, years: 30, stressBp: computeStressBp(true, 'variable', 0, 30),
    creditLoan: 0, otherDebtMonthly: 0, noLoan: false, loanChoice: 'bank',
    mciCovered: false, roomDeductAmt: 만(5500),
    manualLoanCap: 0, bankSelfCap: 0, extraFunding: 0,
    pyeong: 0, pyeongEntered: false, interiorPerPyeong: 0, etc: 0,
    over85: false, firstTimeTaxCut: false, seominCheck: false
  }, over || {});
}

/* ═══ 1. 정책 상수가 살아 있는가 (원칙 33) ═══════════════════ */
tt('POLICY.ltv 존재', !!POLICY.ltv);
tt('POLICY.ratio.dsr = 0.4', POLICY.ratio.dsr === 0.4);
tt('POLICY.ratio.dti = 0.6', POLICY.ratio.dti === 0.6);
tt('POLICY.acqTax 존재', !!POLICY.acqTax);
tt('POLICY.broker 존재', !!POLICY.broker);
tt('POLICY.roomDeduct 존재', !!POLICY.roomDeduct);

/* ═══ 2. LTV — 지역 × 보유 (원칙 26: 수도권 ≠ 규제지역) ═════ */
const LTV_CASES = [
  ['다주택·규제',       { houseStatus:'multi', regulated:true,  metro:true  }, 0],
  ['다주택·비규제',     { houseStatus:'multi', regulated:false, metro:true  }, 0.6],
  ['무주택·규제',       { houseStatus:'none',  regulated:true,  metro:true  }, 0.4],
  ['무주택·비규제',     { houseStatus:'none',  regulated:false, metro:true  }, 0.7],
  ['생애최초·수도권',   { houseStatus:'first', regulated:false, metro:true  }, 0.7],
  ['생애최초·수도권밖', { houseStatus:'first', regulated:false, metro:false }, 0.8],
];
const ltvOf = o => getLTV(o.houseStatus, o.regulated, o.metro);
LTV_CASES.forEach(([name, over, want]) => t('LTV ' + name, ltvOf(over), want));

tt('LTV는 0~1 범위', LTV_CASES.every(([,o]) => { const v = ltvOf(o); return v >= 0 && v <= 1; }));

/* ═══ 3. 지역 판정 — LAWD 실데이터 대조 (원칙 32) ═══════════ */
t('서울 강남구 = 규제',   zoneFromSgg('11680'), 'reg');
t('서울 종로구 = 규제',   zoneFromSgg('11110'), 'reg');
t('경기 성남분당 = 규제', zoneFromSgg('41135'), 'reg');
t('경기 이천 = 수도권',   zoneFromSgg('41500'), 'metro');
t('부산 해운대 = 그 외',  zoneFromSgg('26350'), 'other');

t('강남 방공제 5,500만', roomDeductFromSgg('11680'), 5500);
t('분당 방공제 4,800만', roomDeductFromSgg('41135'), 4800);

tt('LAWD 시도 16개', Object.keys(LAWD).length === 16, Object.keys(LAWD).length);
tt('시군구 코드 중복 없음', (() => {
  const all = Object.values(LAWD).flat().map(x => x[0]);
  return new Set(all).size === all.length;
})());
tt('모든 시군구가 지역 판정을 받는다', Object.values(LAWD).flat()
  .every(([code]) => ['reg','metro','other'].includes(zoneFromSgg(code))));
tt('모든 시군구가 방공제 값을 갖는다', Object.values(LAWD).flat()
  .every(([code]) => roomDeductFromSgg(code) > 0));

/* ═══ 4. 취득세 — 원칙 70 (대출 여부와 무관하게 항상) ═══════ */
tt('6억 이하 1주택 취득세율 1%대',
   acquisitionTaxRate(만(50000), 'none', false) < 0.02);
tt('9억 초과 1주택 취득세율 3%대',
   acquisitionTaxRate(만(120000), 'none', false) >= 0.03);
tt('다주택·규제 취득세가 무주택보다 높다',
   acquisitionTaxRate(만(80000), 'multi', true) > acquisitionTaxRate(만(80000), 'none', true));
tt('다주택·비규제도 무주택보다 높다',
   acquisitionTaxRate(만(80000), 'multi', false) > acquisitionTaxRate(만(80000), 'none', false));
tt('취득세는 대출 없어도 계산된다 (원칙 70)',
   calcCosts(ctx({ price: 만(80000), noLoan: true })).tax > 0);

/* ═══ 5. 영수증 합계 (G-11 · 원칙 93 단위 정합) ═════════════ */
function receiptBalances(over){
  const cx = ctx(Object.assign({ price: 만(80000) }, over));
  const c  = calcCosts(cx);
  const left  = cx.price + c.tax + c.brokerFee + c.interiorCost + c.etcCost;
  const right = c.mortgageLoan + c.cashNeeded;
  return Math.max(Math.abs(left - right), Math.abs(left - c.totalNeeded));
}
[
  ['기본',            {}],
  ['대출 없이',       { noLoan:true }],
  ['부대비용 포함',   { etc: 740 }],
  ['인테리어 포함',   { pyeong:34, pyeongEntered:true, interiorPerPyeong:150 }],
  ['다주택·규제',     { houseStatus:'multi', regulated:true }],
  ['소득 미입력',     { income:0, incomeEntered:false }],
].forEach(([name, over]) => near('영수증 합계 ' + name, receiptBalances(over), 0, 10));

/* ═══ 6. solveMaxPrice 왕복 (원칙 93) ═══════════════════════ */
[3000, 10000, 30000, 80000, 200000].forEach(cashMan => {
  const base = ctx();
  const price = solveMaxPrice(만(cashMan), base);
  const c = calcCosts(Object.assign({}, base, { price }));
  near(`왕복 현금 ${cashMan}만 → 필요현금 일치`, c.cashNeeded, 만(cashMan), 만(1));
  tt(`왕복 현금 ${cashMan}만 → 집값 > 0`, price > 0, price);
  tt(`왕복 현금 ${cashMan}만 → 대출 ≤ 집값`, c.mortgageLoan <= price, c.mortgageLoan + ' / ' + price);
});

/* 🔴 단위 혼동 감시 — 만원을 원으로 착각하면 여기서 걸립니다 */
tt('7억 집값이 7만원으로 계산되지 않는다',
   calcCosts(ctx({ price: 만(70000) })).cashNeeded > 만(10000),
   formatWon(calcCosts(ctx({ price: 만(70000) })).cashNeeded));
tt('집값 10배면 세금도 늘어난다',
   calcCosts(ctx({ price: 만(100000) })).tax > calcCosts(ctx({ price: 만(10000) })).tax);

/* ═══ 7. 병목(binding) 판정 ═════════════════════════════════ */
tt('소득이 낮으면 소득이 병목',
   ['DSR','DTI'].includes(calcCosts(ctx({ price: 만(150000), income: 만(3000) })).binding));
tt('규제지역 다주택은 대출 0',
   calcCosts(ctx({ price: 만(150000), houseStatus:'multi', regulated:true })).mortgageLoan === 0);
tt('대출 없이면 limits가 비어 있다',
   Object.keys(calcCosts(ctx({ price: 만(80000), noLoan:true })).limits || {}).length === 0);
tt('binding은 항상 문자열',
   typeof calcCosts(ctx({ price: 만(80000) })).binding === 'string');

/* ═══ 8. 원칙 28 — 유리한 오차 감시 ═════════════════════════ */
tt('소득이 오르면 여력이 줄지 않는다', (() => {
  const lo = solveMaxPrice(만(30000), ctx({ income: 만(5000) }));
  const hi = solveMaxPrice(만(30000), ctx({ income: 만(15000) }));
  return hi >= lo;
})());
tt('규제지역이 비규제보다 여력이 크지 않다', (() => {
  const reg   = solveMaxPrice(만(30000), ctx({ regulated:true }));
  const other = solveMaxPrice(만(30000), ctx({ regulated:false }));
  return reg <= other;
})());
tt('다주택이 무주택보다 여력이 크지 않다', (() => {
  const multi = solveMaxPrice(만(30000), ctx({ houseStatus:'multi' }));
  const none  = solveMaxPrice(만(30000), ctx({ houseStatus:'none' }));
  return multi <= none;
})());
tt('부대비용을 켜면 여력이 늘지 않는다', (() => {
  const off = solveMaxPrice(만(30000), ctx({ etc: 0 }));
  const on  = solveMaxPrice(만(30000), ctx({ etc: 740 }));
  return on <= off;
})());
tt('인테리어를 켜면 여력이 늘지 않는다', (() => {
  const off = solveMaxPrice(만(30000), ctx());
  const on  = solveMaxPrice(만(30000), ctx({ pyeong:34, pyeongEntered:true, interiorPerPyeong:150 }));
  return on <= off;
})());

/* ═══ 9. 스트레스 금리 (지침 3-1) ═══════════════════════════ */
tt('스트레스 가산금리 ≥ 0', computeStressBp(true, 'variable', 0, 30) >= 0);
tt('수도권 변동금리 가산 > 0', computeStressBp(true, 'variable', 0, 30) > 0);
tt('스트레스가 붙으면 한도가 줄어든다', (() => {
  const a = calcCosts(ctx({ price: 만(100000), stressBp: 0 })).mortgageLoan;
  const b = calcCosts(ctx({ price: 만(100000), stressBp: 1.5 })).mortgageLoan;
  return b <= a;
})());

/* ═══ 10. 월 상환액 ═════════════════════════════════════════ */
tt('대출 0이면 월 상환 0', monthlyPaymentCalc(0, 5.4, 30) === 0);
tt('원금이 크면 월 상환도 크다',
   monthlyPaymentCalc(만(50000), 5.4, 30) > monthlyPaymentCalc(만(10000), 5.4, 30));
tt('기간이 길면 월 상환이 준다',
   monthlyPaymentCalc(만(30000), 5.4, 40) < monthlyPaymentCalc(만(30000), 5.4, 10));
near('3억 5.4% 30년 ≈ 168만원', monthlyPaymentCalc(만(30000), 5.4, 30), 1680000, 60000);

/* ═══ 11. formatWon 표기 ════════════════════════════════════ */
t('formatWon 0',        formatWon(0), '0만원');
t('formatWon 1억',      formatWon(만(10000)), '1억원');
t('formatWon 1억5천',   formatWon(만(15000)), '1억 5,000만원');
tt('formatWon은 항상 문자열', typeof formatWon(만(12345)) === 'string');
tt('formatWon에 NaN 없음', !/NaN|undefined/.test(
   [0, 1, 만(1), 만(99999), 만(1234567)].map(formatWon).join(' ')));

/* ═══ 12. 중개보수 — 구간이 오르면 요율도 오른다 ═══════════ */
tt('중개보수는 집값에 비례해 증가', (() => {
  const a = calcCosts(ctx({ price: 만(20000) })).brokerFee;
  const b = calcCosts(ctx({ price: 만(150000) })).brokerFee;
  return b > a;
})());
tt('중개보수 > 0', calcCosts(ctx({ price: 만(80000) })).brokerFee > 0);

/* ═══ 13. 방공제 (원칙 D — 승인 한도에서 차감) ═════════════ */
tt('방공제가 크면 실행 대출이 줄어든다', (() => {
  const a = calcCosts(ctx({ price: 만(100000), roomDeductAmt: 만(2500) })).mortgageLoan;
  const b = calcCosts(ctx({ price: 만(100000), roomDeductAmt: 만(5500) })).mortgageLoan;
  return b <= a;
})());
tt('대출 없이면 방공제도 0',
   (calcCosts(ctx({ price: 만(80000), noLoan:true })).roomCut || 0) === 0);

/* ═══ 14. 값 위생 — NaN·음수·Infinity 금지 ═════════════════ */
const HYGIENE = [
  ['기본',        {}],
  ['0원',         { price: 0 }],
  ['1천만',       { price: 만(1000) }],
  ['200억',       { price: 만(2000000) }],
  ['소득 0',      { income: 0, incomeEntered: false }],
  ['대출 없이',   { noLoan: true }],
  ['다주택 규제', { houseStatus:'multi', regulated:true }],
];
HYGIENE.forEach(([name, over]) => {
  const c = calcCosts(ctx(Object.assign({ price: 만(80000) }, over)));
  ['tax','brokerFee','mortgageLoan','cashNeeded','totalNeeded','interiorCost','etcCost']
    .forEach(k => {
      const v = c[k];
      tt(`위생 ${name}.${k}`, Number.isFinite(v) && v >= 0, k + '=' + v);
    });
});

/* ═══ 15. 정책 수치 신선도 (원칙 31) ═══════════════════════ */
(() => {
  const html = fs.readFileSync(FILE, 'utf8');
  /* v23.15: 화면에서 날짜를 뻐습니다(관리 지옥).
     대신 HTML 주석·POLICY 주석의 확인일로 신선도를 봅니다. */
  const m = html.match(/(\d{4})[.\-](\d{2})[.\-](\d{2})\s*(?:확인\s*)?(?:기준|$)/m)
         || html.match(/확인일[:\s]*(\d{4})[.\-](\d{2})[.\-](\d{2})/)
         || html.match(/BUILD[^>]*?(\d{4})\.(\d{2})\.(\d{2})/);
  tt('정책 확인일 표기 존재', !!m, m ? m[0] : '없음');
  if (m) {
    const days = (Date.now() - new Date(+m[1], +m[2]-1, +m[3])) / 864e5;
    tt(`정책 확인일이 180일 이내 (${Math.round(days)}일 경과)`, days <= 180, Math.round(days) + '일');
  }
})();

/* ═══ 16. 개인정보 (원칙 36·56) ════════════════════════════ */
(() => {
  const html = fs.readFileSync(FILE, 'utf8');
  const noComment = html.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  tt('금액·소득을 외부로 보내지 않는다',
     !/gtag\([^)]*(?:cash|income|price|amount)/i.test(noComment));
  tt('localStorage·sessionStorage 미사용',
     !/localStorage|sessionStorage/.test(noComment));
  tt('입력값을 URL에 싣지 않는다',
     !/location\.(search|href)\s*=[^=]/.test(noComment));
})();

/* ═══ 17. 화면 검사기가 살아 있는가 (지침 v4 2층) ══════════ */
(() => {
  const html = fs.readFileSync(FILE, 'utf8');
  tt('__selfcheck 존재', /window\.__selfcheck\s*=/.test(html));
  ['디자인 락','G-6','G-1','G-3','G-7','넘침','영수증 합계','대출 ≤ 집값','다크 카드','결과 블록']
    .forEach(k => tt('__selfcheck 항목: ' + k, html.includes(k)));
})();

/* ═══ 18. G-6 색 값 (정적으로도 한 번 더) ══════════════════ */
(() => {
  const html = fs.readFileSync(FILE, 'utf8');
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'))
                  .replace(/\/\*[\s\S]*?\*\//g, '');
  const hex  = new Set((css.match(/#[0-9a-fA-F]{3,8}\b/g) || []).map(s => s.toLowerCase()));
  const rgba = new Set(css.match(/rgba?\([^)]*\)/g) || []);
  tt(`G-6 색 값 ≤ 26 (현재 ${hex.size + rgba.size})`, hex.size + rgba.size <= 26, hex.size + rgba.size);
  /* 퇴출 대상은 「원색」만입니다. 네이비·베이지 계열은 v22.6부터 우리 팔레트입니다. */
  const BANNED = ['#2563eb','#3182f6','#0071e3','#0091ff','#1e3a8a',
                  '#f59e0b','#ffc342','#dc2626','#f04452','#ff0000','#059669','#15c47e','#248a3d'];
  const revived = BANNED.filter(b => hex.has(b));
  tt('퇴출 색 미사용', revived.length === 0, revived.join(', '));
  const inline = (html.match(/style="[^"]*"/g) || []).filter(x => /#[0-9a-fA-F]{3}|rgba?\(/.test(x));
  tt('인라인 style 안의 색 리터럴 0', inline.length === 0, inline.slice(0,3).join(' | '));

  /* 🔒 디자인 락 — :root가 __selfcheck의 LOCK 표와 일치하는가.
     LOCK 표는 HTML 안에만 있습니다. 여기서 베껴 적으면 둘이 어긋납니다(원칙 58).
     __selfcheck()는 브라우저에서만 도니까, 정적으로도 한 번 봅니다. */
  const lockSrc = (UI.match(/const LOCK\s*=\s*\{([\s\S]*?)\};/) || [])[1];
  tt('LOCK 표가 코드 안에 있다', !!lockSrc);
  if (lockSrc) {
    const want = {};
    [...lockSrc.matchAll(/'(--[a-z0-9-]+)'\s*:\s*'(#[0-9a-fA-F]{3,8})'/g)]
      .forEach(m => want[m[1]] = m[2].toUpperCase());
    const root = css.slice(css.indexOf(':root{'), css.indexOf('}', css.indexOf(':root{')));
    const drift = Object.keys(want).filter(k => {
      const m = root.match(new RegExp(k + '\\s*:\\s*(#[0-9a-fA-F]{3,8})'));
      return !m || m[1].toUpperCase() !== want[k];
    });
    tt(`디자인 락 유지 (토큰 ${Object.keys(want).length}개)`, drift.length === 0, drift.join(', '));
  }
})();

/* ═══ 19. 🔴 화면 ↔ 엔진 단위 경계 (원칙 93) ═══════════════
   오늘 실제로 난 사고입니다. 「집값 7억 → 준비 현금 8,740만원」.
   화면 상태(S.cash·S.income·S.priceOverride)는 **만원 단위**,
   엔진은 **원 단위**입니다. 그 사이를 man() 하나가 지킵니다.
   엔진 테스트만으로는 이 경계를 못 봅니다 — 여기서 봅니다. */
(() => {
  tt('man() 정의가 만원→원(×10000)',
     /const\s+man\s*=\s*v\s*=>\s*\(\s*v\s*\|\|\s*0\s*\)\s*\*\s*10000/.test(UI));
  tt('현금이 man()을 거쳐 엔진으로 간다',  /solveMaxPrice\(\s*man\(/.test(UI));
  tt('소득이 man()을 거쳐 엔진으로 간다',  /income\s*:\s*man\(/.test(UI));
  tt('집값 직접입력이 man()을 거친다',     /priceOverride\s*!=\s*null\s*\?\s*man\(/.test(UI));
  tt('방공제가 man()을 거친다',            /roomDeductAmt\s*:\s*man\(/.test(UI));

  /* 원 단위 값에 man()을 두 번 씌우면 1만 배가 됩니다 — 반대 방향 감시 */
  tt('man()을 이중으로 씌운 곳 없음', !/man\(\s*man\(/.test(UI));

  /* 재계산이 스크롤을 옮기지 않는가 (원칙 92) */
  tt('showResult에 keepScroll 인자가 있다', /function\s+showResult\s*\(\s*keepScroll/.test(UI));
  tt('결과 안 조작은 showResult(true)로 부른다', (UI.match(/showResult\(true\)/g) || []).length >= 4,
     (UI.match(/showResult\(true\)/g) || []).length + '곳');

  /* 선택 비용은 꺼진 채로 시작하는가 (원칙 95) */
  tt('이사·청소 기본 꺼짐',  /move\s*:\s*\{\s*on\s*:\s*false/.test(UI));
  tt('가전·가구 기본 꺼짐',  /appl\s*:\s*\{\s*on\s*:\s*false/.test(UI));
  /* ⚠ refreshPkg에도 같은 조건이 있어서 느슨하게 잡으면 사보타주를 놓칩니다.
        엔진으로 넘어가는 자리(interiorPerPyeong)를 콕 집어 봅니다. */
  tt('인테리어는 만졌을 때만 엔진으로 넘어간다',
     /interiorPerPyeong\s*:\s*\(\s*S\.itTouched\s*&&\s*S\.pyeong\s*>\s*0\s*\)\s*\?/.test(UI));

  /* 대출 항목의 이름이 하나인가 (원칙 91 · G-8) */
  tt('대출 이름이 「주택담보대출」로 통일',
     !/은행에서 빌리는 돈/.test(UI), (UI.match(/은행에서 빌리는 돈/g)||[]).length + '곳 남음');
  tt('영수증에 주택담보대출 줄이 있다', /row\('주택담보대출'/.test(UI));
  tt('진단서에도 같은 이름', /report-line[\s\S]{0,80}주택담보대출/.test(UI));

  /* 면책 — 미반영 항목은 채권 매입비만 남긴다 */
  tt('면책에서 화재보험료 문구 삭제', !/화재보험료/.test(UI));
  tt('면책에 국민주택채권 매입비 명시', /국민주택채권 매입비/.test(UI));

  /* 기존 부채 입력 — 빠지면 여력이 실제보다 크게 나옵니다(원칙 28).
     v22를 대표 화면으로 올리는 필수 조건이었습니다. */
  /* v23.3: 기존 부채 입력을 없애고 소득만으로 DSR을 봅니다.
     그만큼 한도가 과대해지므로 면책 문구가 반드시 살아 있어야 합니다. */
  /* v23.11: 기존 부채 입력을 다시 넣었습니다(과대 오차 최대 1억 2,927만원). */
  tt('기존 부채 입력칸이 있다', /id="inDebt"/.test(fs.readFileSync(FILE,'utf8')));
  tt('기존 부채가 엔진으로 간다',
     /otherDebtMonthly:\(S\.debtMonthly\|\|0\)\*10000/.test(UI));
  tt('기본은 접혀 있다 (피로도 관리)', /debtOpen:false/.test(UI));
  tt('조건 칩에 갚는 대출이 노출', /갚는 대출<\/u>/.test(UI));
  tt('소득은 여전히 필수다', /id==='income'\)\s*return\s*!!S\.income/.test(UI));
  tt('DSR 면책 문구가 있다', /본 DSR 한도는 입력하신 소득과 기존 대출만을 기준/.test(UI));
  tt('한도 안내가 부채 입력 여부를 반영', /갚는 대출을 반영한 값이에요/.test(UI));
  tt('정책대출 미반영을 면책에 밝힌다', /정책대출을 받을 수 있다면/.test(UI));

  /* 전월세는 본체에서 완전히 빠졌다 (2026.08.08 결정) */
  tt('본체에 전월세 노출 없음',
     !/href="\/rent"|id="outRent"/.test(fs.readFileSync(FILE,'utf8')));

  /* 하단 여백 안정화 — 빈 공간을 바닥에 몰지 않는다 */
  const css2 = fs.readFileSync(FILE,'utf8'), html2 = css2;
  tt('퍼널이 화면 높이를 채운다', /\.funnel\{[^}]*min-height:calc\(100dvh/.test(css2));
  tt('퍼널이 세로 flex다', /\.funnel\{[^}]*flex-direction:column/.test(css2));
  tt('「답한 것」이 바닥으로 밀린다', /\.answered\{[^}]*margin-top:auto/.test(css2));

  /* 숫자/단위 리듬 — 단위가 인접해 두 번 쪼개지지 않는가 */
  tt('richWon이 정의돼 있다', /const\s+richWon\s*=/.test(UI));
  tt('긴 단위를 먼저 잡는다 (억원이 억+원으로 안 쪼개짐)',
     /\(억원\|만원\|억\|원\)/.test(UI));
  tt('단위 span을 인접해 두 번 열지 않는다',
     !/<\/i><i class="u">/.test(UI), (UI.match(/<\/i><i class="u">/g)||[]).join(' '));

  /* 비율 막대 두 조각이 다른 색인가 (원칙 94) */
  const css = fs.readFileSync(FILE,'utf8');
  const f1 = (css.match(/\.stack i\.f1\{background:var\((--[a-z0-9-]+)\)/) || [])[1];
  const f2 = (css.match(/\.stack i\.f2\{background:var\((--[a-z0-9-]+)\)/) || [])[1];
  const val = tok => (css.match(new RegExp(tok + ':\\s*(#[0-9a-fA-F]{3,8})')) || [])[1];
  const lum = h => { h=(h||'').replace('#',''); if(h.length!==6) return null;
    const c=[0,2,4].map(i=>{ let v=parseInt(h.substr(i,2),16)/255;
      return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; };
  const A=val(f1), B=val(f2);
  const la=lum(A), lb=lum(B);
  const cr=(la!==null&&lb!==null) ? (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05) : 0;
  tt('영문 킥 문구 삭제', !/PREMIUM ASSET SIMULATION|brandmark/.test(fs.readFileSync(FILE,'utf8')));
  tt('타이틀 세로선이 있다', /\.headline::before\{[^}]*width:4px/.test(fs.readFileSync(FILE,'utf8')));
  tt('CTA가 「결과 확인하기」', /'결과 확인하기'/.test(UI));
  tt('단위가 값에 붙어 있다', /\.mfield\{[^}]*gap:0/.test(fs.readFileSync(FILE,'utf8')));

  /* 게이지 어댑티브 컬러 — 임계값을 40/60으로 되돌리면 세 색 중 하나만 나타납니다 */
  tt('게이지 임계가 40 / 60이다',
     /ratio<0\.40\s*\?\s*'ok'\s*:\s*ratio<0\.60\s*\?\s*'mid'/.test(UI));
  tt('게이지가 DSR 상한 40%를 만석으로 봐다', /ratio\/0\.40\*100/.test(UI));
  tt('퍼센트 글자도 단계색을 따른다', /tileBurden'\)\.className='tile-v '\+band/.test(UI));

  /* 「부담」은 클수록 무거운 지표라 초록으로 시작하면 의미가 어긋납니다.
     레드 계열 안에서 옆고 → 진함으로 가야 합니다. */
  const RED = /^#(?:[89ABCDEF][0-9A-F]|7F)/i;
  const okv = (css2.match(/--ok:\s*(#[0-9A-Fa-f]{6})/)||[])[1] || '';
  tt('부담 낮음이 레드 계열이다 (초록 금지)',
     !!okv && parseInt(okv.slice(1,3),16) > parseInt(okv.slice(3,5),16), okv);
  tt('단계가 옆고 → 진함 순서다', (()=>{
     const g=n=>((css2.match(new RegExp('--'+n+':\\s*(#[0-9A-Fa-f]{6})'))||[])[1]||'#000');
     const L=h=>{h=h.slice(1);const c=[0,2,4].map(i=>{let v=parseInt(h.substr(i,2),16)/255;
       return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2];};
     return L(g('ok')) > L(g('warn')) && L(g('warn')) > L(g('bad'));
  })());
  tt('영수증 아래 안내 박스가 없다', !/receiptTip/.test(css2));

  /* v23.5 문구·구조 락 */
  tt('「여력」이 어디에도 없다', !/여력/.test(fs.readFileSync(FILE,'utf8')));
  tt('방공제 안내가 한도 아코디언 안으로 이동', /id="roomTip"/.test(fs.readFileSync(FILE,'utf8')));
  tt('아코디언은 2종 (부대비용 · 한도)',
     (fs.readFileSync(FILE,'utf8').match(/class="disc"/g)||[]).length === 2);
  tt('「다른 집값으로 계산하기」가 없다',
     !/priceToggle|다른 집값으로 계산/.test(fs.readFileSync(FILE,'utf8')));
  tt('안내 박스와 접기 버튼이 가리된다',
     /\.tip\{[^}]*background:transparent/.test(css2) && /\.disc\{[^}]*background:var\(--fill\)/.test(css2));
  /* 🔴 아코디언을 지우다 고아 </div>가 남아 #result가 일찍 닫혔고,
     인테리어·다음걸음 카드가 첫 화면으로 새어 나왔습니다. 구조를 센다. */
  const RES = html2.slice(html2.indexOf('<section class="result"'), html2.indexOf('</section>'));
  tt('result 안 div 개횡수 균형',
     (RES.match(/<div/g)||[]).length === (RES.match(/<\/div>/g)||[]).length,
     (RES.match(/<div/g)||[]).length + ' / ' + (RES.match(/<\/div>/g)||[]).length);
  tt('인테리어·다음걸음이 result 안에 있다',
     RES.includes('id="outInterior"') && RES.includes('id="outSave"'));
  tt('result 안 카드가 3개', (RES.match(/<div class="card[ "]/g)||[]).length === 3,
     (RES.match(/<div class="card[ "]/g)||[]).length + '개');

  tt('첫 화면 오버랩이 없다 (밴드 끝선이 깔끔하게)',
     /\.app\.hero-on \.funnel > \.q\{[^}]*margin-top:20px/.test(fs.readFileSync(FILE,'utf8')));
  tt('보유 라벨이 명사형', /생애 최초[\s\S]{0,400}1주택 이상/.test(UI));
  tt('규제 도달 문구가 전문형', /비율\(LTV\) 최대 한도에 도달/.test(UI)
     && /규제\(DSR\) 최대 한도에 도달/.test(UI));
  tt('실거래가 링크가 국토부', /rt\.molit\.go\.kr/.test(UI) && !/hogangnono/.test(UI));
  tt('임시 도메인 표기', /출시-후-도메인-연결-예정/.test(UI));
  tt('헤더 밴드가 퍼널 높이를 푸는다',
     /\.app\.hero-on \.funnel\{[^}]*min-height:0/.test(fs.readFileSync(FILE,'utf8')));

  /* 🔴 v23.9 — 부대비용이 집값을 흔들던 버그.
     집값을 한 번만 정하고(lockedPrice) 이후 비용은 더하기만 합니다. */
  tt('집값이 잠긴다 (lockedPrice)', /if\(S\.lockedPrice==null\)\s*S\.lockedPrice\s*=\s*solveMaxPrice/.test(UI));
  tt('결과에서는 solveMaxPrice를 다시 부르지 않는다',
     (UI.match(/solveMaxPrice/g)||[]).length === 1, (UI.match(/solveMaxPrice/g)||[]).length + '곳');
  tt('퍼널을 다시 통과하면 재산정', /S\.lockedPrice=null/.test(UI));
  tt('가진 돈 초과 안내가 있다', /class="overnote"/.test(UI));

  /* v23.13 — 결과에서 플로팅 바 숨김 · 2-Track · 면책 한 줄 */
  tt('결과에서 플로팅 바를 숨긴다', /\$\('dock'\)\.hidden=true/.test(UI));
  tt('2-Track — 조건 수정 버튼이 있다', /id="reeditBtn"/.test(UI));
  tt('조건 수정은 03단계로 간다', /S\.step = STEPS\.length - 1/.test(UI));
  tt('조건 칩에 ▾ 아이콘', /<b class="cc">\u25be<\/b>|class="cc">▾/.test(UI));
  tt('면책은 한 줄만', (UI.match(/class=\\"legal\\"|class="legal"/g)||[]).length === 1,
     (UI.match(/class="legal"/g)||[]).length + '줄');
  tt('DSR·정책대출 안내는 한도 아코디언으로', /limitTip'\)\.innerHTML = bindingTip[\s\S]{0,300}본 DSR 한도/.test(UI));

  /* v23.10 — 마커가 오른쪽 텍스트를 덮던 버그 · 플로팅 독 · 칩 틴트 */
  tt('형광펜 마커가 없다 (v23.15)',
     !/rhead-amount::after/.test(css2) && !/\.rhead-amount > span\{[^}]*linear-gradient/.test(css2));
  tt('플로팅 독', /\.dockrow\{[^}]*border-radius:999px/.test(css2));
  tt('재계산 CTA가 솔리드', /\.restart-cta\{[^}]*background:var\(--espresso\)/.test(css2));

  tt('카드 테두리 대신 그림자', !/\.card\{[^}]*border:var\(--hair\)/.test(css2));

  /* v23.9 — 자동 포커스 금지 · 네비 분리 · 재계산 CTA · 다크모드 차단 */
  tt('진입 시 자동 포커스 없음', !/setTimeout\(\(\)=>\s*\w*El?\.focus/.test(UI));
  tt('상단은 홈, 하단은 이전/다음',
     /id="homeBtn"/.test(css2) && /id="prevBtn"/.test(css2) && !/id="backBtn"/.test(css2));
  tt('재계산이 풀폭 CTA', /class="restart-cta"/.test(UI));
  tt('다크모드 차단', /name="color-scheme" content="light"/.test(css2)
     && /:root\{[\s\S]{0,80}color-scheme:light/.test(css2));
  /* v23.14: 넓은 어두운 면을 걷어내고 라임을 액센트 면으로 씁니다. */
  /* v23.17 — 마이크로 컴포넌트 네이티브화 */
  tt('세그먼트에 테두리 없음 · 그림자로 띄운다',
     !/\.seg button\.is-on\{[^}]*inset 0 0 0 2px/.test(css2)
     && /\.seg button\.is-on\{[^}]*box-shadow:0 2px 8px/.test(css2));
  tt('체크박스가 직접 그려졌다 (appearance:none)',
     /\.subtoggle input\{[^}]*appearance:none/.test(css2)
     && /\.subtoggle input:checked::after/.test(css2));
  tt('accent-color 의존 없음', !/accent-color\s*:/.test(css2));
  /* ⚠ [\s\S]*? 는 규칙 밖까지 넘어갑니다. 규칙 안([^}]*)으로 가둡니다. */
  tt('스위치 손잡이가 전용 그림자',
     /\.sw::after\{[^}]*box-shadow:0 3px 8px/.test(css2)
     && !/\.sw::after\{[^}]*box-shadow:var\(--sh\)/.test(css2));

  /* v23.16 — 그린 브랜드 · 카드 분리 · 슬라이더 커스텀 */
  tt('세로선이 그린', /\.brand \.headline::before\{background:var\(--green\)/.test(css2));
  tt('CTA가 그린 배경 + 흰 글자',
     /\.cta\{[^}]*background:var\(--green-ink\);color:var\(--card\)/.test(css2));
  tt('금액 글자가 그린', /\.rhead-amount > span\{color:var\(--green-ink\)/.test(css2));
  tt('배경과 카드가 분리된다 (배경 연그레이)', /--bg:#F2F4F6/.test(css2));
  tt('카드에 테두리가 없다', !/\.card\{[^}]*border:/.test(css2));
  tt('슬라이더가 커스텀되었다', /--fill-pct/.test(css2)
     && /::-webkit-slider-thumb\{[^}]*background:var\(--green\)/.test(css2));
  tt('02 링크 밑줄 없음', !/\.debtlink\{[^}]*text-decoration/.test(css2));
  tt('영수증 대출액이 블랙', /\.line\.minus \.v\{color:var\(--ink\)/.test(css2));
  tt('하단 회색 박스 제거 · 중앙 정렬',
     /\.trust\{[^}]*background:none[^}]*text-align:center/.test(css2));

  /* v23.15: 라임 → 핀테크 그린. 면·테두리와 글자 색을 나눕니다. */
  tt('그린 포인트 도입', /--green:#00CA71/.test(css2));
  tt('글자용 그린이 따로 있다 (대비 5.48:1)', /--green-ink:#00794A/.test(css2));
  tt('라임 잔재 없음', !/--lime/.test(css2));
  tt('형광펜 하이라이트 삭제', !/linear-gradient\(to top, var\(--/.test(css2));
  tt('칩 선택이 흰 바탕+그린 테두리+그린 글자',
     /\.chip\.is-on\{background:var\(--card\);color:var\(--green-ink\);border:2px solid var\(--green\)/.test(css2));
  tt('날짜 하드코딩이 화면 문구에 없다',
     !/textContent\s*=\s*'[^']*2026\.08\.05/.test(UI) && !/innerHTML\s*=\s*`[^`]*2026\.08\.05/.test(UI));
  tt('정책 확인일은 주석에 남아 있다', /<!-- BUILD[^>]*2026\.08\.05/.test(css2));

  /* 입력 첫 화면 네이비 밴드 */
  tt('입력 01에 넓은 어두운 면이 없다',
     /\.brand\{background:var\(--bg\)/.test(css2));
  tt('상단바도 밝다', /\.app\.hero-on \.appbar\{background:var\(--bg\)/.test(css2));
  tt('밴드는 01에서만 켜진다', /classList\.toggle\('hero-on',\s*S\.step===0\)/.test(UI));
  tt('결과에서는 밴드가 꺼진다', /classList\.remove\('hero-on'\)/.test(UI));
  tt('단정적 문구 제거', !/가장 완벽한 집/.test(fs.readFileSync(FILE,'utf8')));
  tt('자금 구성 막대 두 조각이 다른 색 (원칙 94)',
     !!A && !!B && A.toLowerCase() !== B.toLowerCase(), f1+'='+A+' / '+f2+'='+B);
  /* 🔴 「다르기만」 하면 부족합니다. #1D1D1F와 #112A46은 다르지만 대비가 1.16:1이라
        나란히 놓으면 한 덩어리로 읽힙니다. 명암 대비까지 봅니다. */
  tt('막대 두 조각 대비 ≥ 3:1', cr >= 3, cr.toFixed(2) + ' : 1');
})();

/* ── 결과 ─────────────────────────────────────────────────────── */
const total = pass + fails.length;
console.log('\n영끌계산기 회귀 테스트 — ' + path.basename(FILE));
console.log('─'.repeat(56));
if (fails.length) {
  fails.forEach(f => {
    console.log('🔴 ' + f.name);
    console.log('     기대: ' + JSON.stringify(f.expected));
    console.log('     실제: ' + JSON.stringify(f.actual));
  });
  console.log('─'.repeat(56));
}
console.log(`${pass} / ${total} 통과` + (fails.length ? `  🔴 ${fails.length}개 실패` : '  ✅'));
process.exit(fails.length ? 1 : 0);
