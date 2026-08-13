/* ===================================================================
   영끌계산기 — 회귀 테스트 (v22.5용)
   실행:  node test.js
          node test.js /경로/index.html

   🔴 v24.15 — 본체 파일명이 index.html로 바뀌었습니다.
     기본 경로도 같이 바꿨습니다. 인자 없이 돌아갑니다.

   ⚠ 구 test.js(888개)는 DOM id에 묶여 있어 새 본체에 붙지 않습니다.
     이 파일은 **계산 엔진만** 봅니다(지침 v4 9장의 1단계).
     화면 규칙은 브라우저 콘솔의 __selfcheck() 13항목이 봅니다. 역할이 다릅니다.

   ⚠ 엔진 함수는 HTML에서 직접 뜯어옵니다. 복사본을 두면 반드시 어긋납니다(원칙 58).
   =================================================================== */

const fs = require('fs');
const path = require('path');

const FILE = process.argv[2] || path.join(__dirname, 'index.html');

/* ── 엔진 적재 ────────────────────────────────────────────────── */
/* 🔴 v24.24 — 엔진/화면 경계 표식. **한 곳에서만 정의합니다**(원칙 58).
   index.html의 같은 문자열과 짝입니다. 한쪽만 고치면 검사가 전부 헛돕니다 —
   그래서 아래 「경계 표식이 정확히 한 번 있다」 검사가 따로 있습니다. */
/* ⚠ 표식은 **주석 여는 기호까지** 포함합니다. `/*` 뒤에서 자르면 엔진 쪽이
   열린 주석으로 끝나 파싱이 죽습니다 — 실제로 그렇게 한 번 죽였습니다. */
const ENGINE_MARK = '/* ══════════ ENGINE END ══════════';

let UI = '';   /* 화면 코드 — 단위 경계 검사(19장)에 씁니다 */
function loadEngine(file){
  const html = fs.readFileSync(file, 'utf8');
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  let src = blocks[blocks.length - 1];
  /* 🔴 v24.24 — 엔진과 화면 코드는 **전용 표식**으로 갈립니다(index.html의 `ENGINE END`).
     ⏹ 전에는 `console.info('영끌계산기 BUILD` **로그 한 줄**을 경계로 썼습니다.
       로그를 지우거나 문구만 바꿔도 검사 570개가 조용히 엉뚱한 코드를 읽는 구조였고,
       그 의존이 어디에도 안 적혀 있었습니다. 로그는 로그의 일입니다. */
  const cut = src.indexOf(ENGINE_MARK);
  /* 🔴 표식이 없으면 **여기서 멈춥니다.** 없는 채로 진행하면 화면 코드까지 실행해
     「onclick of null」 같은 엉뚱한 에러로 죽고, 진짜 원인(표식 소실)이 안 보입니다. */
  if(cut <= 0) throw new Error('엔진 경계 표식을 못 찾았습니다 — index.html의 ENGINE END 줄을 확인하세요');
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


/* v24.21 — summaryText()의 **몸통만** 떼어 봅니다.
   ⚠ 주석을 걷어낸 뒤 자릅니다. 안 그러면 「왜 뺐는지」를 적어 둔 주석이 검사를 통과시킵니다
     (v24.20에서 실제로 걸린 함정 — 1-6장). */
function sumBody(){
  const bare = UI.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const m = bare.match(/function summaryText\(\)[\s\S]*?\n\}/);
  return m ? m[0] : '';
}
/* v24.21 — renderReport()의 몸통. 공유 이미지 카드가 무엇을 찍는지 보는 자리입니다. */
function repBody(){
  const bare = UI.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const m = bare.match(/function renderReport\(v\)[\s\S]*?\n\}/);
  return m ? m[0] : '';
}

/* v24.20 — 마크업(<script> 밖)까지 봐야 하는 검사용. 주석은 걷어냅니다. */
let _ui0 = null;
function UI0(){ if(_ui0===null) _ui0 = fs.readFileSync(FILE,'utf8').replace(/<!--[\s\S]*?-->/g,''); return _ui0; }

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
/* 🔴 v24.7 — 지침: 정책 수치는 ①기준 ②출처 ③확인일 셋을 주석에 함께 적습니다.
   그런데 **그걸 보는 검사가 없었습니다.** 실제로 `area` 키가 둘 다 빠진 채로 있었습니다.
   99-b: 이 검사가 🔴가 되려면? POLICY에 출처나 확인일 없는 키가 새로 들어오면. */
tt('POLICY의 모든 키에 출처·확인일이 있다', (()=>{
  const src = fs.readFileSync(FILE,'utf8');
  const a = src.indexOf('const POLICY'), b = src.indexOf('const POLICY_DEFS');
  if(!(a >= 0 && b > a)) return false;
  /* POLICY 객체의 닫는 `};`에서 끊습니다. 안 끊으면 그 아래 주석까지 읽습니다. */
  const polAll = src.slice(a, b);
  const closeAt = polAll.indexOf('\n};');
  const pol = closeAt > 0 ? polAll.slice(0, closeAt) : polAll;
  const keys = [...pol.matchAll(/\n  ([a-zA-Z]+):/g)];
  if(keys.length < 5) return false;                    /* 키를 못 찾으면 🔴 */
  /* ⚠ 되돌아보는 창을 고정 길이로 잡으면 **앞 키의 주석**까지 읽습니다.
     처음에 900자로 잡았다가, area의 출처를 지운 사보타주가 앞 키(policyLoan)의
     주석에 걸려 통과했습니다. 구간은 **앞 키 끝 ~ 이 키 끝**으로 잘라야 합니다. */
  return keys.every((m, n) => {
    const from = n === 0 ? 0 : keys[n-1].index + keys[n-1][0].length;
    const to   = n+1 < keys.length ? keys[n+1].index : pol.length;
    const seg  = pol.slice(from, to);
    /* 「출처」가 산문에 섞여도 통과하던 자리 — **`출처:` 표기**만 인정합니다(원칙 111). */
    return /출처\s*[:：]/.test(seg) && /(확인일\s*[:：]?\s*20\d\d|미확인)/.test(seg);
  });
})(), (()=>{ const src=fs.readFileSync(FILE,'utf8');
  const _all=src.slice(src.indexOf('const POLICY'), src.indexOf('const POLICY_DEFS'));
  const _c=_all.indexOf('\n};'); const pol=_c>0?_all.slice(0,_c):_all;
  const keys=[...pol.matchAll(/\n  ([a-zA-Z]+):/g)];
  const bad=keys.filter((m,n)=>{
    const from=n===0?0:keys[n-1].index+keys[n-1][0].length;
    const to=n+1<keys.length?keys[n+1].index:pol.length;
    const seg=pol.slice(from,to);
    return !(/출처\s*[:：]/.test(seg) && /(확인일\s*[:：]?\s*20\d\d|미확인)/.test(seg)); }).map(m=>m[1]);
  return bad.length? bad.join(', ')+' 누락' : keys.length+'개 키 전부 있음'; })());
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
  /* 🔴 v23.25 — 이 락을 **반쪽만** 풉니다(지침 5층 3번).
     원칙 36의 취지는 「금액·소득을 기기에 남기지 않는다」였습니다.
     sessionStorage는 **탭을 닫으면 사라지므로 기기에 남지 않습니다** — 취지가 유지됩니다.
     localStorage는 남습니다. 그래서 그쪽만 그대로 막습니다. */
  tt('localStorage 미사용 (기기에 남기지 않는다)', !/localStorage/.test(noComment));
  tt('임시 저장은 sessionStorage 한 키뿐이다', (()=>{
     const keys = [...noComment.matchAll(/sessionStorage\.\w+\(\s*([A-Za-z_$][\w$]*|'[^']*')/g)]
       .map(m => m[1]);
     return keys.length > 0 && new Set(keys).size === 1 && keys[0] === 'DRAFT_KEY';
  })());
  /* 되살린 값은 손으로 고칠 수 있습니다. 그대로 믿으면 엔진에 쓰레기가 들어갑니다. */
  tt('되살린 값을 다시 검사한다',
     /if\(!HOUSE\[S\.houseStatus\]\) S\.houseStatus = 'none';/.test(UI)
     && /if\(S\.sgg && !sggName\(S\.sgg\)\)/.test(UI)
     && /S\.step = Math\.max\(0, Math\.min\(parseInt\(S\.step,10\) \|\| 0, STEPS\.length - 1\)\)/.test(UI));
  /* 🔴 v23.27 — 「결과는 복구하지 않는다」를 **뒤집었습니다**(지침 5층 3번).
     밖으로 나갔다 돌아온 사람이 결과를 잃는 것이 실제 사고였습니다.
     `lockedPrice`는 「이미 한 번 정한 값」이고, 같은 탭에서 그대로 돌려주는 것은
     역산을 **다시 부르는 것이 아닙니다.** 되살리지 않고 재계산하면 그때 원칙 5가 깨집니다.
     대신 **숫자가 성립할 때만** 되살리도록 잠급니다. */
  tt('결과를 복구한다', (()=>{
     const m = UI.match(/const DRAFT_KEYS = \[([\s\S]*?)\];/);
     return !!m && /'onResult'/.test(m[1]) && /'lockedPrice'/.test(m[1]);
  })());
  tt('결과 복구는 숫자가 성립할 때만',
     /const lp = Number\(S\.lockedPrice\);/.test(UI)
     && /if\(!\(Number\.isFinite\(lp\) && lp > 0\)\) \{ S\.lockedPrice = null; S\.onResult = false; \}/.test(UI)
     && /const RESUME_RESULT = S\.onResult && S\.lockedPrice > 0 && ready\(\);/.test(UI));
  /* ⚠ priceOverride는 저장하지 않습니다 — 「다른 집값으로 보기」는 그 자리에서만 유효한 값입니다. */
  tt('저장 키에 priceOverride가 없다', (()=>{
     const m = UI.match(/const DRAFT_KEYS = \[([\s\S]*?)\];/);
     return !!m && !/priceOverride/.test(m[1]) && /S\.priceOverride = null;/.test(UI);
  })());
  /* 되살린 파생값도 전부 범위 검사를 거칩니다(원칙 122). */
  /* 🔴 v24.7 — 이 락이 **틀린 값을 잠그고 있었습니다.**
     `[0,100,150,220]`은 INTERIOR의 실제 값 `[0,80,150,250]`과 다른 **두 번째 정의**였고,
     검사가 그 오타를 그대로 고정해 주고 있었습니다. 새로고침하면 고급(250)이 일반(150)이 되어
     25평 기준 필요현금이 2,500만원 줄었습니다 — **유리한 쪽 오차**(원칙 28).
     지금은 목록을 손으로 적지 않고 INTERIOR에서 끌어오는지를 봅니다. */
  /* 🔴 v24.22 — 상한을 **숫자 50으로** 잠그고 있었습니다. 상한을 올리는 정당한 변경을
     검사가 막았습니다(원칙 48). 잠글 사실은 「50인가」가 아니라 **「클램프가 있는가」**입니다.
     실제 값이 슬라이더와 같은지는 바로 아래 검사가 따로 봅니다. */
  tt('되살린 파생값도 검사한다',
     /S\.pyeong = Math\.max\(0, Math\.min\(parseInt\(S\.pyeong,10\) \|\| 0, PYEONG_MAX\)\);/.test(UI)
     && /const IT_OK = INTERIOR\.map\(o => o\.v\);/.test(UI)
     && /S\.interior = IT_OK\.indexOf\(\+S\.interior\) >= 0/.test(UI));
  /* 🔴 v24.7 — 손으로 적은 목록이 다시 들어오는 것을 막습니다.
     99-b: 이 검사가 🔴가 되려면? 복원 코드에 INTERIOR가 아닌 숫자 배열이 다시 박히면. */
  tt('인테리어 복원 목록이 INTERIOR 하나에서만 온다', (()=>{
     /* ⚠ saveDraft가 loadDraft보다 **앞**에 있습니다. 순서를 가정하면 구간이 음수가 되어
        빈 문자열이 되고, 그러면 이 검사는 아무것도 안 보게 됩니다. 다음 함수까지로 자릅니다. */
     /* ⚠⚠ 원칙 111 — **주석을 먼저 걷어냅니다.** 이 검사를 처음 쓸 때
        「무엇을 고쳤는지」 적은 주석 안의 옛 배열에 제가 그대로 걸렸습니다.
        오늘 같은 함정에 세 번 걸렸습니다. 문자열을 보는 검사는 주석을 걷고 봅니다. */
     const bare = UI.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
     const i = bare.indexOf('function loadDraft');
     if(i < 0) return false;
     const j = bare.indexOf('\nfunction ', i + 10);
     const draft = j > i ? bare.slice(i, j) : '';
     if(draft.length < 100) return false;                    /* 구간을 못 자르면 🔴 */
     return !/\[\s*0\s*,\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\]/.test(draft);
  })());
  /* 🔴 v24.22 — 상한이 **마크업과 JS 두 곳**에 있었습니다. 둘이 갈리면 화면은 「100평」이라
     해 놓고 계산은 50평으로 도는, 가장 찾기 어려운 어긋남이 납니다.
     이제 `PYEONG_MAX` 하나에서 나오고 `renderPkg()`가 슬라이더 `max`를 덮어씁니다.
     → 잠글 사실은 **「덮어쓰는 코드가 있는가」**와 **「클램프가 같은 상수를 쓰는가」**입니다. */
  tt('평형 상한이 한 곳에서만 나온다', (()=>{
     const n = UI.match(/const PYEONG_MAX = (\d+);/);
     if(!n) return false;
     return +n[1] >= 100                                  /* 대형 평형을 자르지 않습니다 */
         && /r\.max = PYEONG_MAX;/.test(UI)                /* 슬라이더를 덮어씁니다 */
         && /\|\| 0, PYEONG_MAX\)/.test(UI)                /* 복원 클램프도 같은 상수 */
         && (UI.match(/Math\.min\(parseInt\(S\.pyeong,10\) \|\| 0, \d+\)/g)||[]).length === 0;
  })(), (()=>{ const n=UI.match(/const PYEONG_MAX = (\d+);/); return 'PYEONG_MAX '+(n?n[1]:'없음'); })());
  /* render()가 퍼널을 그릴 때마다 결과 플래그를 내려야 합니다. 안 내리면 영영 결과로 돌아갑니다. */
  tt('퍼널로 가면 결과 플래그가 내려간다',
     /function render\(\)\{\s*S\.onResult = false;/.test(UI)
     && /S\.onResult = true; saveDraft\(\);/.test(UI));
  /* 처음부터 다시 = 남은 값도 지웁니다. 안 지우면 다음 사람이 이어받습니다. */
  tt('처음부터 다시 계산하면 저장분을 지운다',
     /function restart\(\)\{\s*clearDraft\(\);/.test(UI));
  /* 빈 초안을 남기면 「지웠는데 흔적이 있는」 상태가 됩니다 — 넣은 게 없으면 키도 만들지 않습니다. */
  tt('빈 상태에서는 키를 만들지 않는다',
     /if\(!S\.cash && !S\.income && !S\.sgg && !S\.debtMonthly && !S\.noLoan && !S\.onResult\)\{ clearDraft\(\); return; \}/.test(UI));
  /* 사파리 프라이빗 모드는 sessionStorage 접근에서 던집니다. 화면이 죽으면 안 됩니다. */
  tt('저장 실패가 화면을 막지 않는다',
     (UI.match(/try\{[\s\S]{0,400}?sessionStorage[\s\S]{0,400}?\}catch\(e\)\{\}/g)||[]).length >= 2);
  tt('복구가 첫 렌더 앞에서 일어난다', (()=>{
     const i = UI.indexOf('loadDraft();'), j = UI.lastIndexOf('\nrender();');
     return i > 0 && j > i;
  })());
  tt('입력값을 URL에 싣지 않는다',
     !/location\.(search|href)\s*=[^=]/.test(noComment));
})();

/* ═══ 17. 화면 검사기가 살아 있는가 (지침 v4 2층) ══════════ */
(() => {
  const html = fs.readFileSync(FILE, 'utf8');
  tt('__selfcheck 존재', /window\.__selfcheck\s*=/.test(html));
  /* 🔴 v23.22 — 이전에는 파일 전체에서 문자열을 찾았습니다. 그러면 **주석에만 남아도 통과**합니다.
     실제로 G-17 검사를 지우는 사보타주가 주석 때문에 초록으로 통과했습니다(원칙 90 · 99).
     지금은 ok(...) 호출의 라벨만 모아서 봅니다 — 검사가 실제로 「돌고 있는지」를 봅니다. */
  const LABELS = [...html.matchAll(/\bok\(\s*'([^']+)'/g)].map(m => m[1]);
  /* 🔴 v24.7 — `includes('G-1')`이 **G-13 · G-14 … G-18에도 걸립니다.**
     그래서 G-1 검사를 통째로 지워도 초록이었습니다(사보타주로 확인).
     게이트 이름은 라벨의 **첫 토큰**과 정확히 같아야 합니다. 문장형 라벨만 includes로 봅니다. */
  const TOKENS = ['G-1','G-3','G-6','G-7','G-13','G-14','G-15','G-16','G-17','G-18','G-19'];
  const PHRASES = ['디자인 락','넘침','영수증 합계','대출 ≤ 집값','다크 카드','결과 블록'];
  const head = l => l.split(/\s/)[0];
  TOKENS.forEach(k => tt('__selfcheck 항목: ' + k, LABELS.some(l => head(l) === k),
                     LABELS.length + '개 라벨'));
  PHRASES.forEach(k => tt('__selfcheck 항목: ' + k, LABELS.some(l => l.includes(k)),
                     LABELS.length + '개 라벨'));
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
  /* 🔴 v24.7 — 「직접 입력」이 생기면서 조건이 하나 늘었습니다(지침 5층 3번 — 다시 씀).
     `S.interior > 0`이 없으면 직접 입력 표시값 -1이 **평당 단가로 흘러 음수 비용**이 됩니다. */
  tt('인테리어는 만졌을 때만 엔진으로 넘어간다',
     /interiorPerPyeong\s*:\s*\(\s*S\.itTouched\s*&&\s*S\.pyeong\s*>\s*0\s*&&\s*S\.interior\s*>\s*0\s*\)\s*\?/.test(UI));
  /* 🔴 v24.7 — 직접 입력은 **총액**입니다. 평형으로 나눠 평당으로 되돌리면 반올림 오차가 생깁니다. */
  /* 🔴 v24.12 — **영수증에 들어갔는지를 화면이 말해야 합니다.**
     v24.3에 있던 「지금 영수증에는 인테리어비가 빠져 있어요」가 v24.8에서 사라졌습니다.
     설명을 줄이다가 **사실을 버린** 자리입니다 — 영수증이 완전하다고 오해하는 방향(원칙 28).
     99-b: 이 검사가 🔴가 되려면? 킥커에서 영수증 언급이 빠지면. */
  tt('인테리어가 영수증에 들어갔는지 화면이 말한다', (()=>{
     const m = UI.match(/\$\('itKicker'\)\.textContent = [\s\S]{0,400}?;/);
     if(!m) return false;
     return /아직 영수증에 없어요/.test(m[0]) && /영수증에 더/.test(m[0]);
  })());
  tt('직접 입력은 총액 경로로 흐른다',
     /interiorTotal\s*:\s*\(\s*S\.itTouched\s*&&\s*S\.interior\s*===\s*IT_CUSTOM\s*&&\s*S\.itCustom\s*>\s*0\s*\)\s*\?/.test(UI)
     && /ctx\.interiorTotal \* 10000/.test(UI + fs.readFileSync(FILE,'utf8')));
  /* 표시값 -1이 단가 목록에 섞여 들어가지 않는지 — 섞이면 비용이 음수가 됩니다. */
  tt('직접 입력 표시값이 단가로 쓰이지 않는다', (()=>{
     const src = fs.readFileSync(FILE,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
     return /const IT_CUSTOM = -1;/.test(src)
         && !/interiorPerPyeong\s*:\s*[^,\n]*IT_CUSTOM/.test(src);
  })());

  /* 대출 항목의 이름이 하나인가 (원칙 91 · G-8) */
  tt('대출 이름이 「주택담보대출」로 통일',
     !/은행에서 빌리는 돈/.test(UI), (UI.match(/은행에서 빌리는 돈/g)||[]).length + '곳 남음');
  tt('영수증에 주택담보대출 줄이 있다', /row\('주택담보대출'/.test(UI));
  /* 🔴 v24.15 — 검사의 **목적은 이름 일치**이고, 표현(.report-line)만 바뀌었습니다(원칙 48).
     진단서에서 .report-line이 사라지고 자금 구성 줄(mixRow)로 합쳐졌습니다.
     구조를 묻지 말고 **renderReport 안에 그 이름이 있는가**만 봅니다 — 다음에 또 옮겨도 안 깨집니다. */
  tt('진단서에도 같은 이름', (()=>{
     const f = (UI.match(/function renderReport\([\s\S]*?\n\}/)||[''])[0];
     return f.length > 100 && /주택담보대출/.test(f) && !/은행에서 빌리는 돈/.test(f);
  })());

  /* 면책 — 미반영 항목은 채권 매입비만 남긴다 */
  tt('면책에서 화재보험료 문구 삭제', !/화재보험료/.test(UI));
  tt('면책에 국민주택채권 매입비 명시', /국민주택채권 매입비/.test(UI));

  /* 기존 부채 입력 — 빠지면 여력이 실제보다 크게 나옵니다(원칙 28).
     v22를 대표 화면으로 올리는 필수 조건이었습니다. */
  /* v23.3: 기존 부채 입력을 없애고 소득만으로 DSR을 봅니다.
     그만큼 한도가 과대해지므로 면책 문구가 반드시 살아 있어야 합니다. */
  /* v23.11: 기존 부채 입력을 다시 넣었습니다(과대 오차 최대 1억 2,927만원). */
  tt('기존 부채 입력칸이 있다', /id="inDebt"/.test(fs.readFileSync(FILE,'utf8')));
  /* 🔴 v23.18 — .mfield의 배경(--fill)은 --bg와 같은 값입니다.
     흰 카드(.moneycard) 밖에 두면 회색 박스가 통째로 사라지고 「0만」만 허공에 뜹니다.
     연소득 칸(moneyCard())과 같은 껍데기를 씌워야 합니다. */
  tt('부채 입력칸이 연소득 칸과 같은 카드 안에 있다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const i = src.indexOf('id="inDebt"');
     if (i < 0) return false;
     const before = src.slice(Math.max(0, i - 400), i);
     return /class="moneycard debtcard"/.test(before)
         && before.lastIndexOf('moneycard') > before.lastIndexOf('</div>');
  })());
  /* 🔴 v23.22 — 설명을 입력칸 **위**에서 **아래**로 옮기고 .helper 컴포넌트에 태웠습니다.
     락을 지우지 않고 「필드 아래에 6px로 종속되는가」로 다시 씁니다. */
  /* ⚠ v24.0 — 결과 카드에도 .helper가 생겼습니다. **부채 블록 안에서** 순서를 봐야 합니다.
     파일 전체에서 첫 .helper를 찾으면 결과 카드의 것을 읽고 헛돕니다(원칙 99). */
  tt('헬퍼 텍스트가 입력칸 아래에 종속된다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const i = src.indexOf('id="inDebt"');
     if(i < 0) return false;
     const after = src.slice(i, i + 500);
     return after.indexOf('class="helper"') > 0 && /\.helper\{margin:6px 0 0/.test(src);
  })());
  tt('헬퍼가 12~13px · 쿨 그레이다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     return /\.helper\{[^}]*font-size:var\(--t7\)/.test(src)
         && /\.helper\{[^}]*color:var\(--ink-4\)/.test(src)
         && /--t7:13px/.test(src);
  })());
  /* 🔴 v23.27 — 입력 피드백 */
  /* 🔴 v24.22 — 캐럿 복원을 **모든 숫자 입력이 같은 길로** 지나가게 했습니다.
     전에는 만원 필드만 이 길을 쓰고 억 필드는 `.value`에 직접 써서, 값이 정리되는 순간
     캐럿이 끝으로 튀었습니다(「1.5」의 1 뒤에서 「.」 → 「1..5」 → 「1.5」).
     ⚠ 옛 검사는 `digitsBeforeCaret`이라는 **변수 이름**을 잠그고 있었습니다 — 이름은 사실이 아닙니다. */
  tt('캐럿 복원이 한 곳에서만 나온다',
     /function setMaskedValue\(el, next, isKeep\)/.test(UI)
     && /el\.setSelectionRange\(i, i\)/.test(UI)
     && (UI.match(/setSelectionRange/g)||[]).length === 1);
  tt('억 필드가 value에 직접 쓰지 않는다', (()=>{
     const m = UI.match(/eokEl\.oninput = \(\) => \{[\s\S]*?\n  \};/);
     if(!m) return false;
     return /setMaskedValue\(eokEl,[\s\S]*?isDigitOrDot\)/.test(m[0])
         && !/eokEl\.value\s*=/.test(m[0]);
  })());
  /* `g`가 붙은 정규식의 test()는 lastIndex를 들고 다녀 호출 순서에 결과가 달라집니다. */
  tt('캐럿 판정이 정규식이 아니라 함수다',
     /const isDigit\s+= ch =>/.test(UI) && /const isDigitOrDot = ch =>/.test(UI));
  /* 값이 잘렸는데 아무 말도 안 하면 사용자는 자기가 잘못 눌렀다고 생각합니다. */
  tt('잘린 입력을 화면으로 말한다', (()=>{
     /* 🔴 v24.7 — 셋째 문구를 라벨과 같은 이름으로 고쳤습니다(G-8). 예전엔 「월 상환액」이었는데
        그 입력칸의 라벨은 「매달 나가는 대출 원리금」이라 화면에서 두 이름이 됐습니다. */
     /* 🔴 v24.22 — 문구를 **제한 수치가 먼저 오도록** 다시 썼습니다. 에러 줄은 읽는 것이 아니라
        보이는 것이라, 목적어가 앞에 오면 스캔이 한 박자 늦습니다.
        ⚠ 그래서 이 검사도 **문장이 아니라 형태**를 봅니다 — 네 문구가 전부 「최대」로 시작하는가.
        ⚠ 「99,999만원」처럼 사람이 못 읽는 단위도 같이 고쳤습니다(→ 9억 9,999만원). */
     const msgs = UI.match(/fieldErr\([^,]+, [^?]*\? '([^']+)'/g) || [];
     const quoted = (UI.match(/'최대 [^']+까지 넣을 수 있어요\.'/g) || []);
     return quoted.length >= 4
         && !/'억 단위는|'만 단위는|'인테리어 예산은|'매달 나가는 대출 원리금은/.test(UI)
         && !/99,999만원까지/.test(UI)
         && (UI.match(/fieldErr\(/g)||[]).length >= 4;   /* 정의 1 + 호출 3 */
  })());
  /* hidden으로 껐다 켜면 전환이 재생되지 않습니다 — 항상 DOM에 두고 클래스로 폅니다. */
  tt('에러 줄을 hidden으로 감추지 않는다',
     /class="fielderr" role="alert"/.test(fs.readFileSync(FILE,'utf8'))
     && !/class="fielderr"[^>]*hidden/.test(fs.readFileSync(FILE,'utf8')));
  tt('에러 줄이 스크린리더에 전달된다',
     (fs.readFileSync(FILE,'utf8').match(/role="alert" aria-live="polite"/g)||[]).length >= 2);

  /* 필드 밑 문구는 마진 4~8px 안에서만 붙습니다 — 14px는 「떠 있다」로 읽힙니다. */
  tt('필드 밑 문구가 4~8px 안에 붙는다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     return ['\\.helper','\\.readout'].every(x=>{
       const m = src.match(new RegExp(x+'\\{margin:(\\d+)px'));
       return m && +m[1] >= 4 && +m[1] <= 8;
     });
  })());
  tt('부채 설명에 인라인 여백이 남아 있지 않다',
     !/q-sub" style="margin/.test(fs.readFileSync(FILE,'utf8')));
  tt('기존 부채가 엔진으로 간다',
     /otherDebtMonthly:\(S\.debtMonthly\|\|0\)\*10000/.test(UI));
  tt('기본은 접혀 있다 (피로도 관리)', /debtOpen:false/.test(UI));
  tt('조건 칩에 갚는 대출이 노출', /갚는 대출<\/u>/.test(UI));
  tt('소득은 여전히 필수다', /id==='income'\)\s*return\s*!!S\.income/.test(UI));
  /* 🔴 v24.18 — 전: `/본 DSR 한도는 입력하신 소득과 기존 대출만을 기준/`
     **소스 문자열을 그대로 잠그고 있었습니다.** 그래서 「~습니다」체를 「~어요」로 고치는
     정당한 개선이 검사에 막혔습니다 — 원칙 48이 말한 바로 그 형태입니다.
     잠글 것은 문장이 아니라 **한도가 무엇만 반영했는지 밝히는가**입니다. */
  tt('한도가 소득·기존 대출만 반영했음을 밝힌다', (()=>{
     const m = UI.match(/\$\('limitTip'\)\.innerHTML([\s\S]*?);\n/);
     if(!m) return false;
     const t = m[1].replace(/\/\*[\s\S]*?\*\//g,'');
     return /소득/.test(t) && /기존 대출/.test(t) && /은행/.test(t);
  })());
  tt('한도 안내가 부채 입력 여부를 반영', /갚는 대출을 반영한 값이에요/.test(UI));
  tt('정책대출 미반영을 면책에 밝힌다', /정책대출을 받을 수 있다면/.test(UI));

  /* 전월세는 본체에서 완전히 빠졌다 (2026.08.08 결정) */
  /* 🔴 v24.2 — 전월세는 **보류가 아니라 폐기 확정**입니다(2026.08.11 결정).
     「너무 무겁고 복잡하다 · 보여줄 다른 것이 많다」 — 지우는 판단이지 미루는 판단이 아닙니다.
     락을 「링크가 없다」에서 **「화면 문구에 전월세 어휘가 없다」**로 넓힙니다.
     ⚠ 주석과 `//` 줄은 걷어내고 봅니다. 정책 주석의 「전세사기피해자」는 정책대출 엔진의 기록이고,
       「소액임차보증금」·「최우선변제금」은 **방공제**라 매매 계산의 일부입니다 — 둘 다 대상이 아닙니다. */
  tt('본체에 전월세 기능이 없다 (폐기 확정)', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     if(/href="\/rent"|id="outRent"/.test(src)) return false;
     const clean = src.replace(/\/\*[\s\S]*?\*\//g,'')
                      .replace(/<!--[\s\S]*?-->/g,'')
                      .replace(/^\s*\/\/.*$/gm,'');
     return !/전월세|월세|반전세|임대차/.test(clean);
  })(), (()=>{
     const src = fs.readFileSync(FILE,'utf8')
       .replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'').replace(/^\s*\/\/.*$/gm,'');
     return ['전월세','월세','반전세','임대차'].filter(w=>src.includes(w)).join(', ') || '없음';
  })());

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

  /* ═══ v23.18 — 타이포 밀도 · 수직 리듬 ═══════════════════════
     🔴 button·input은 letter-spacing을 상속하지 않습니다. body에 -.02em을 걸어도
        칩·세그먼트는 브라우저 기본값(0)으로 렌더됩니다. 실제로 본문보다 퍼져 있었습니다. */
  tt('button이 전역 자간을 상속한다',
     /button\{[^}]*letter-spacing:inherit/.test(css2));
  tt('input이 전역 자간을 상속한다',
     /^input\{[^}]*letter-spacing:inherit/m.test(css2));
  tt('전역 기본 자간이 -.02em이다', /body\{[^}]*letter-spacing:-\.02em/.test(css2));

  /* 🔴 v23.20 — 자간을 두 단으로 나눴습니다.
     타이틀은 -.05em(문장이라 붙어도 읽힘), 금액은 -.04em(숫자가 떡지면 못 읽힘). */
  tt('큰 타이틀 자간이 -.05em', (()=>{
     const want = ['\\.q-title\\{[^}]*letter-spacing:-\\.05em',
                   '\\.headline\\{[^}]*letter-spacing:-\\.05em'];
     return want.every(r => new RegExp(r).test(css2));
  })());
  tt('큰 금액 자간이 -.04em', (()=>{
     const want = ['\\.mfield input\\{[^}]*letter-spacing:-\\.04em',
                   '\\.rhead-amount\\{[^}]*letter-spacing:-\\.04em',
                   '\\.tile-v\\{[^}]*letter-spacing:-\\.04em'];
     return want.every(r => new RegExp(r).test(css2));
  })());
  /* 🔴 v23.18의 -1px을 뒤집었습니다. 트래킹 잔여 폭을 상쇄해 붙였더니
     큰 숫자에서 단위가 짓눌려 떡져 보였습니다. 4px 숨통을 줍니다. */
  tt('단위 span에 숨통이 있다',
     /\.mfield span\{[^}]*margin-left:4px/.test(css2));

  /* 죽은 .mrow 규칙이 금액 자간을 -.04em으로 되돌리던 두 번째 정의였습니다. */
  tt('죽은 .mrow 규칙이 없다', !/^\.mrow[\s{]/m.test(css2));
  /* 🔴 v23.23 — 「1억 원당 월 100만 원」 어림값 넛지를 폐기하고 **항목별 자동 합산**으로 바꿨습니다.
     넛지는 「머릿속으로 더하라」는 요구를 남겨 둔 채 힌트만 준 것이었습니다.
     락을 지우지 않고 **대체물이 실제로 있는가**로 다시 씁니다(지침 5층 3번). */
  tt('어림값 넛지를 폐기했다',
     !/신용대출 1억 원당 월 약 100만 원/.test(fs.readFileSync(FILE,'utf8'))
     && !/class="q-hint"/.test(fs.readFileSync(FILE,'utf8'))
     && !/\n\.q-hint\{/.test(fs.readFileSync(FILE,'utf8')));
  tt('항목별 합산 아코디언이 있다',
     /id="debtPartsToggle"/.test(UI) && /대출이 여러 개인가요\? 항목별로 더하기/.test(UI));
  /* 🔴 v24.7 — 사물 존대를 금지합니다. 주어가 사람이 아닌데 `-시-`를 붙이던 자리입니다. */
  tt('화면 문구에 사물 존대가 없다', !/(대출|금액|한도|결과|예산)이?\s*[^ ]*이신가요/.test(UI));
  tt('합산 항목이 신용대출 · 기타 둘이다',
     /id="inDebtCredit"/.test(UI) && /id="inDebtEtc"/.test(UI)
     && (UI.match(/id="inDebt(Credit|Etc)"/g)||[]).length === 2);
  /* ⚠ 값의 출처는 언제나 S.debtMonthly 하나입니다. 항목이 두 번째 진실이 되면 어긋납니다(원칙 84). */
  tt('항목 합계가 메인 칸으로 들어간다',
     /const t=\(S\.debtParts\.credit\|\|0\)\+\(S\.debtParts\.etc\|\|0\);/.test(UI)
     && /S\.debtMonthly = t>0 \? t : null;/.test(UI));
  /* 직접 입력과 빠른 추가 칩, 두 자리 모두에서 항목을 비웁니다.
     한 곳만 비우면 「합계는 5인데 항목은 3+4」인 상태가 남습니다. */
  tt('메인 칸을 직접 고치면 항목이 초기화된다',
     /dbt\.oninput[\s\S]{0,400}clearParts\(\);/.test(UI)
     && /data-debt[\s\S]{0,220}clearParts\(\);/.test(UI));
  tt('엔진으로 가는 값은 여전히 메인 칸 하나',
     /otherDebtMonthly:\(S\.debtMonthly\|\|0\)\*10000/.test(UI)
     && !/debtParts[\s\S]{0,60}otherDebtMonthly/.test(UI));
  /* 토글에서 renderQuestion()을 부르면 입력 포커스가 날아갑니다. */
  tt('합산 토글이 화면을 다시 그리지 않는다',
     /pt\.onclick[\s\S]{0,220}classList\.toggle\('open'/.test(UI)
     && !/pt\.onclick[\s\S]{0,220}renderQuestion\(\)/.test(UI));

  /* v23.19 — 타이틀·금액은 900 고정, 행간 1.1~1.2 */
  tt('타이틀·금액이 900이다', (()=>{
     const want=['\\.headline\\{[^}]*font-weight:900',
                 '\\.q-title\\{[^}]*font-weight:900',
                 '\\.mfield input\\{[^}]*font-weight:900',
                 '\\.rhead-amount\\{[^}]*font-weight:900',
                 '\\.tile-v\\{[^}]*font-weight:900'];
     return want.every(r=>new RegExp(r).test(css2));
  })());
  /* 🔴 v23.26 — 문장과 숫자의 행간을 갈랐습니다(지침 6-9의 행간판).
     문장 타이틀은 **1.22** — 900 + 자간 -.05em에서 2줄이 되면 받침이 붙습니다.
     숫자는 **1.15** — 받침이 없고, 벌리면 큰 금액이 두 덩어리로 흩어집니다.
     v23.19의 「1.1~1.2 한 값」 락을 **두 값으로** 다시 씁니다(지침 5층 3번). */
  tt('문장 타이틀 행간이 1.22다', ['\\.headline\\{','\\.q-title\\{'].every(x=>{
     const m=css2.match(new RegExp(x+'[^}]*line-height:([\\d.]+)'));
     return m && +m[1]===1.22;
  }));
  tt('숫자 행간은 1.1~1.2로 조인다', ['\\.mfield input\\{','\\.rhead-amount\\{','\\.tile-v\\{'].every(x=>{
     const m=css2.match(new RegExp(x+'[^}]*line-height:([\\d.]+)'));
     return m && +m[1]>=1.1 && +m[1]<=1.2;
  }));
  /* 문장이 숫자보다 넓어야 합니다. 뒤집히면 받침 충돌이 그대로 돌아옵니다. */
  tt('문장 행간 > 숫자 행간', (()=>{
     const g=x=>+(css2.match(new RegExp(x+'[^}]*line-height:([\\d.]+)'))||[])[1];
     return g('\\.q-title\\{') > g('\\.tile-v\\{');
  })());
  /* v23.19 — 다음 걸음 · 부채칸 1단 */
  /* 🔴 v24.22 — **락을 뒤집었습니다. 이 자리는 세 번째 왕복입니다** —
       v24.11 한 열 → v24.13 격자 → v24.22 한 열.
     ⏹ v24.13이 격자로 되돌린 근거는 「칸이 다시 넷이라 격자가 성립한다」였습니다.
       **칸 수는 이유가 아니었습니다** — 지금도 넷입니다. 바뀐 것은 칸 안의 내용입니다.
       격자가 성립하던 조건은 「칸마다 제목 + 설명 두 줄」이었고, v24.22에서 설명을 지시로
       지우자 제목 한 줄만 남아 **가운데가 대각선으로 비었습니다.**
     🔴 그리고 반칸에는 「국토교통부 실거래가 열기」가 안 들어갑니다. 화살표도 안 읽혀
       레이블이 동작까지 말해야 하는데, 그 자리는 전폭에만 있습니다.
     → 이제 잠글 사실은 **「한 열이다」 + 「칸 수로 되돌리지 않는다」**입니다.
       격자로 돌아가려면 칸 안에 **두 줄이 생겼을 때**입니다. */
  tt('다음 걸음이 한 열이다', (()=>{
     const src = fs.readFileSync(FILE,'utf8').replace(/<!--[\s\S]*?-->/g,'');
     const m = src.match(/<div class="minigrid">[\s\S]*?<\/div>\s*<\/div>/);
     const cards = m ? (m[0].match(/class="mini(?: [^"]*)?"/g)||[]) : [];
     /* ⚠ `1fr\}`로 앵커하면 `gap:10px}`가 뒤에 붙어 있어 영영 안 맞습니다. 구분자까지 봅니다. */
     return /\n\.minigrid\{[^}]*grid-template-columns:1fr[;}]/.test(css2)
         && /class="minigrid"/.test(src) && cards.length === 4;
  })(), (()=>{ const m=css2.match(/\n\.minigrid\{[^}]*\}/); return m?m[0].trim():'없음'; })());
  /* 반칸용 세로 배치가 남아 있으면 한 줄 안에서 제목과 화살표가 또 갈립니다. */
  tt('칸 안이 세로 배치로 돌아가지 않았다',
     !/\.minigrid \.mini\{[^}]*flex-direction:column/.test(css2)
     && !/\.minigrid \.mini \.arw\{[^}]*margin-top:auto/.test(css2));
  tt('다음 걸음에 크기 특례가 없다', !/\.mini\.wide|class="mini wide"/.test(
     css2 + fs.readFileSync(FILE,'utf8').replace(/<!--[\s\S]*?-->/g,'')));
  tt('부채 입력칸이 1단 100%',
     /\.debtcard \.mfield\{width:100%\}/.test(css2)
     && !/id="inDebt"[\s\S]{0,300}visibility:hidden/.test(fs.readFileSync(FILE,'utf8')));

  /* 질문 → 입력 카드 간격은 01(히어로 카드 안)과 02·03이 같아야 합니다. */
  /* ⚠ `.app.hero-on .funnel > .q .moneycard{` 도 `.moneycard{`를 품습니다.
        줄머리로 앵커하지 않으면 같은 규칙을 두 번 읽고 항상 통과합니다. */
  /* 🔴 v23.22 — 히어로 전용 .moneycard 규칙이 사라졌습니다(01·02·03이 같은 규칙을 씁니다).
     검사를 지우지 않고 「정의가 하나뿐인가 + 값이 24px인가」로 다시 씁니다(원칙 84 · 지침 5층). */
  /* 🔴 v23.23 — 간격의 기준이 「질문 → 입력칸」에서 「라벨 → 입력칸 → 헬퍼」로 옮겼습니다.
     락을 지우지 않고 **3단 위계의 간격 규약**으로 다시 씁니다.
     라벨 위 22px(덩어리 사이) · 라벨 아래 8px · 헬퍼 6px — 안쪽이 바깥쪽보다 좁아야 묶입니다. */
  tt('폼 3단 위계의 간격 규약', (()=>{
     const g = (sel,prop) => (css2.match(new RegExp(sel+'\\{[^}]*'+prop+':(\\d+)px'))||[])[1];
     /* ⚠ v24.3 — .flabel이 flex 한 줄이 되면서 margin이 규칙 앞쪽이 아닙니다. 규칙 안에서 찾습니다. */
     const fl = (css2.match(/\n\.flabel\{([^}]*)\}/)||[])[1] || '';
     const labelTop = (fl.match(/margin:(\d+)px/)||[])[1];
     const labelBot = (fl.match(/margin:\d+px 0 (\d+)px/)||[])[1];
     const card = g('\\n\\.moneycard','margin-top');
     const help = (css2.match(/\.helper\{margin:(\d+)px/)||[])[1];
     const all = css2.match(/\.moneycard[^{]*\{[^}]*margin-top:(\d+)px/g) || [];
     return all.length === 1
         && +labelTop >= 20 && +labelBot === 8 && +card === 8 && +help === 6
         && +labelTop > +labelBot;
  })());
  /* 🔴 모든 입력 필드 앞에 라벨, 뒤에 헬퍼가 있는가 — 구조 자체를 셉니다. */
  tt('모든 입력 필드가 라벨 → 입력 → 헬퍼 순서다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const q = src.slice(src.indexOf('function renderQuestion'), src.indexOf('function moneyCard'))
             + src.slice(src.indexOf('function moneyCard'), src.indexOf('function regionPane'));
     /* moneyCard()가 라벨·헬퍼를 항상 함께 냅니다 */
     const mc = src.slice(src.indexOf('function moneyCard'), src.indexOf('function regionPane'));
     /* ⚠ indexOf는 없으면 -1입니다. **-1 < n 은 언제나 참**이라, 순서만 보면
        라벨을 통째로 지운 사보타주가 조용히 통과합니다. 존재부터 셉니다(원칙 99). */
     const iL = mc.indexOf('class="flabel"'), iF = mc.indexOf('class="mfield"'),
           iH = mc.indexOf('class="helper"');
     const okMc = iL >= 0 && iF >= 0 && iH >= 0 && iL < iF && iF < iH;
     /* 부채 칸도 같은 순서여야 합니다 */
     const i = src.indexOf('id="inDebt"');
     const before = src.slice(0, i), after = src.slice(i);
     const okDebt = before.lastIndexOf('class="flabel"') > before.lastIndexOf('class="helper"')
                 && after.indexOf('class="helper"') > 0 && after.indexOf('class="helper"') < 400;
     return okMc && okDebt;
  })());
  /* ⚠ 원칙 99 — `class="flabel">${label}<` 도 이 패턴에 걸립니다(템플릿 자리표시자).
     실제 문구는 moneyCard() **호출 인자**에 있습니다. 둘을 합쳐서 봅니다. */
  /* 🔴 G-8 — 하나의 값을 부르는 이름은 화면 전체에서 하나입니다.
     입력 라벨과 「답한 것」 요약 줄의 이름이 어긋나면 같은 값이 두 개로 읽힙니다. */
  tt('입력 라벨이 요약 줄의 이름과 같다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const keys = [...src.matchAll(/\{id:'\w+',key:'([^']+)'\}/g)].map(m=>m[1]);
     const args = [...src.matchAll(/moneyCard\('\w+', S\.\w+, '([^']+)'/g)].map(m=>m[1]);
     return args.length === 2 && args.every(a => keys.includes(a));
  })(), [...fs.readFileSync(FILE,'utf8').matchAll(/moneyCard\('\w+', S\.\w+, '([^']+)'/g)].map(m=>m[1]).join(' / '));
  tt('라벨이 명사형이다 (물음표·서술어 없음)', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const inline = [...src.matchAll(/class="flabel">([^<$]+)</g)].map(m=>m[1].trim());
     const args   = [...src.matchAll(/moneyCard\('\w+', S\.\w+, '([^']+)'/g)].map(m=>m[1].trim());
     const labels = inline.concat(args);
     return labels.length >= 3 && labels.every(l => !/[?？]|세요|나요|에요|입니다/.test(l));
  })(), (()=>{ const src=fs.readFileSync(FILE,'utf8');
     return [...src.matchAll(/class="flabel">([^<$]+)</g)].map(m=>m[1])
       .concat([...src.matchAll(/moneyCard\('\w+', S\.\w+, '([^']+)'/g)].map(m=>m[1])).join(' / '); })());
  /* 🔴 v23.22 — 입력칸을 감싸던 흰 라운드 박스(베젤)를 지웠습니다. 3중첩이 부활하면 여기서 걸립니다. */
  tt('입력칸에 흰 베젤이 없다', (()=>{
     const m = (css2.match(/\n\.moneycard\{([^}]*)\}/)||[])[1] || '';
     return /background:transparent/.test(m) && /padding:0/.test(m) && /box-shadow:none/.test(m)
         && !/var\(--pad\)/.test(m);
  })());
  tt('질문 블록이 01·02·03 모두 같은 흰 카드다',
     /\.funnel > \.q\{[^}]*background:var\(--card\)/.test(css2)
     && /\.funnel > \.q\{[^}]*padding:var\(--pad\)/.test(css2)
     && !/\.app\.hero-on \.funnel > \.q\{/.test(css2));

  /* 게이지 어댑티브 컬러 — 임계값을 40/60으로 되돌리면 세 색 중 하나만 나타납니다 */
  /* 🔴 v23.26 — 「임계가 40/60인가」를 **「막대와 색이 같은 눈금을 쓰는가」**로 다시 씁니다.
     이전 락은 값만 지켰고, 그 값 때문에 경고 두 색이 한 번도 뜨지 않았습니다.
     막대의 만석이 0.40이면 색 경계도 그 안(0 < a < b < 0.40)에 있어야 합니다. */
  tt('게이지가 DSR 상한 40%를 만석으로 봐다', /ratio\/0\.40\*100/.test(UI));
  tt('색 단계가 게이지 눈금 안에 있다', (()=>{
     const m = UI.match(/ratio<([\d.]+)\s*\?\s*'ok'\s*:\s*ratio<([\d.]+)\s*\?\s*'mid'/);
     const full = (UI.match(/ratio\/([\d.]+)\*100/)||[])[1];
     if(!m || !full) return false;
     const a=+m[1], b=+m[2], F=+full;
     return 0 < a && a < b && b < F;          /* 두 경계가 만석 안쪽에 있어야 합니다 */
  })(), (UI.match(/ratio<([\d.]+)\s*\?\s*'ok'\s*:\s*ratio<([\d.]+)/)||[]).slice(1).join(' / '));
  /* 경고 두 색이 실제로 도달 가능한가 — 화면 부담률은 스트레스 금리 때문에 최대 ~34%입니다. */
  tt('경고 두 색이 도달 가능하다', (()=>{
     const m = UI.match(/ratio<([\d.]+)\s*\?\s*'ok'\s*:\s*ratio<([\d.]+)\s*\?\s*'mid'/);
     return m && +m[1] <= 0.30 && +m[2] <= 0.36;
  })());
  tt('퍼센트 글자도 단계색을 따른다', /tileBurden'\)\.className='tile-v '\+band/.test(UI));

  /* 🔴 v23.18에서 뒤집었습니다.
     이전 규칙: 「부담은 클수록 무거우니 레드 3단으로만 간다」 → --ok가 #C4837C(팥죽색)였고
     정상 상태가 병색으로 읽혔습니다. 부담 18%는 실제로 좋은 상태이므로 신호등 방향이 맞습니다.
     지금 규칙: 안전 = 그린, 경고 2단만 레드 농도 사다리. */
  const okv = (css2.match(/--ok:\s*(#[0-9A-Fa-f]{6})/)||[])[1] || '';
  tt('부담 낮음이 그린 계열이다 (팥죽색 폐기)',
     !!okv && parseInt(okv.slice(3,5),16) > parseInt(okv.slice(1,3),16), okv);
  tt('팥죽색 #C4837C 잔재 없음', !/#C4837C/i.test(css2));
  tt('경고 2단은 레드 계열을 유지한다', (()=>{
     const g=n=>((css2.match(new RegExp('--'+n+':\\s*(#[0-9A-Fa-f]{6})'))||[])[1]||'#000');
     return [g('warn'),g('bad')].every(h =>
       parseInt(h.slice(1,3),16) > parseInt(h.slice(3,5),16));
  })());
  /* 🔴 v23.20 — 명도 사다리를 **채도 사다리**로 바꿨습니다.
     v23.18~19는 「부담 낮음 = 그린」이라 「부담이 낮다」가 「좋다」로 읽혔습니다.
     지금은 무채색(조용함) → 오렌지(주의) → 딥 레드(위험)입니다.
     명도 순서는 더 이상 성립하지 않으므로 그 검사를 폐기하고 셋으로 나눕니다. */
  const gv=n=>((css2.match(new RegExp('--'+n+':\\s*(#[0-9A-Fa-f]{6})'))||[])[1]||'#000');
  const rgb=h=>[1,3,5].map(i=>parseInt(h.substr(i,2),16));
  const lumT=h=>{h=h.slice(1);const c=[0,2,4].map(i=>{let v=parseInt(h.substr(i,2),16)/255;
    return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2];};
  tt('부담 낮음이 무채색이다 (초록 금지)', (()=>{
     const c=rgb(gv('ok'));
     return Math.max(...c)-Math.min(...c) <= 40 && !(c[1]>c[0] && c[1]>c[2]);
  })(), gv('ok'));
  tt('경고 2단이 난색이다 (R>G>B)', ['warn','bad'].every(n=>{
     const c=rgb(gv(n)); return c[0]>c[1] && c[1]>c[2];
  }));
  tt('주의가 위험보다 옅다', lumT(gv('warn')) > lumT(gv('bad')));
  tt('판정 3색이 흰 면 위에서 읽힌다 (≥4.5:1)', ['ok','warn','bad'].every(n=>{
     const a=lumT(gv(n)), b=lumT('#FFFFFF');
     return (Math.max(a,b)+.05)/(Math.min(a,b)+.05) >= 4.5;
  }));
  tt('영수증 아래 안내 박스가 없다', !/receiptTip/.test(css2));

  /* ═══ v24.0 — 실거래가 ═══════════════════════════════════════════
     🔴 이 기능의 첫 번째 요구사항은 「보여준다」가 아니라 **「계산기를 막지 않는다」**입니다. */
  tt('실거래 카드가 기본은 꺼져 있다',
     /<div class="card" id="dealCard" hidden>/.test(fs.readFileSync(FILE,'utf8')));
  tt('실거래 호출이 계산을 막지 않는다', (()=>{
     /* await로 결과 렌더를 잡으면 API가 느릴 때 화면이 통째로 늦게 뜹니다. */
     return /fetchDeals\(lawd, priceMan\)\.then\(/.test(UI)
         && !/await fetchDeals/.test(UI)
         && /renderOutlinks\(price\); renderDeals\(price\);/.test(UI);
  })());
  /* ⏹ v24.10 — v24.9에서 락을 「0건」과 「호출 실패」로 갈랐다가 **되돌렸습니다.**
     되돌린 이유: 폴백(국토부 링크)이 사라졌으므로 두 경우가 같은 화면이 됩니다.
       — 키 등록은 **일회성**이고, 정식 배포는 Vercel입니다. 거기서는 함수가 돕니다.
       — 「불러오지 못했어요」는 우리 배관 사정이라 화면에 말하지 않습니다.
     ⚠ 두 상태가 **실제로 다르다는 사실은 그대로입니다.** 언젠가 화면을 나눠야 하면
       `fetchDeals`에서 `ok` 플래그를 다시 모으면 됩니다(v24.9 코드 참고). */
  tt('못 받았든 0건이든 카드를 감춘다', (()=>{
     return /if\(!items\.length\)\{ card\.hidden = true; return; \}/.test(UI)
         && /\.catch\(\(\) => \{ if\(my === DEAL\.req\) card\.hidden = true; \}\)/.test(UI);
  })());
  /* 빈 카드도, 남의 사이트로 보내는 링크도 그 자리에 두지 않습니다. */
  tt('실거래 카드에 외부 링크가 없다', (()=>{
     const src = fs.readFileSync(FILE,'utf8').replace(/<!--[\s\S]*?-->/g,'');
     const i = src.indexOf('id="dealCard"');
     if(i < 0) return false;
     const seg = src.slice(i, src.indexOf('</div>', src.indexOf('id="dealFoot"')));
     return !/<a /.test(seg) && !/rt\.molit\.go\.kr/.test(seg);
  })());
  tt('한 달이 실패해도 나머지를 쓴다',
     /\.catch\(\(\) => \(\{items:\[\]\}\)\)/.test(UI) && /Promise\.all\(months\.map/.test(UI));
  /* 늦게 온 응답이 새 결과를 덮으면 다른 지역의 거래가 뜹니다. */
  tt('늦은 응답이 새 결과를 덮지 않는다',
     /const my = \+\+DEAL\.req;/.test(UI) && /if\(my !== DEAL\.req\) return;/.test(UI));

  /* 🔴 밖으로 나가는 것은 지역코드와 년월뿐입니다(원칙 36). */
  tt('실거래 호출에 금액·소득을 싣지 않는다', (()=>{
     const m = UI.match(/fetch\(`\/api\/apt-price\?([^`]+)`/);
     return !!m && !/income|cash|price|debt|amount/i.test(m[1]);
  })());

  /* 🔴 예산을 넘는 거래를 섞으면 「살 수 있다」로 읽힙니다(원칙 28). */
  tt('예산 이하 거래만 보여준다',
     /x\.amountMan >= lo && x\.amountMan <= priceMan/.test(UI));
  /* 취소된 거래를 시세로 보여주면 없는 가격을 믿게 됩니다 — 서버에서 걸러냅니다. */
  tt('해제된 거래를 걸러낸다는 것을 화면에서 밝힌다',
     /해제된 거래는 뺐어요/.test(UI));
  /* 「추천」이 아닙니다 — 우리가 하는 일은 거래가 있었던 곳을 보여주는 것입니다. */
  /* 🔴 v24.7 — 마커가 안 잡히면 slice(-1, j)가 **빈 문자열**이라 무조건 통과했습니다.
     `const DEAL = {`의 공백 한 칸에 검사 전체가 걸려 있었습니다. 구간 가드를 넣습니다. */
  tt('실거래 문구에 「추천」·「최적」이 없다', (()=>{
     const a = UI.indexOf('const DEAL = {'), b = UI.indexOf('function renderOutlinks');
     if(!(a >= 0 && b > a)) return false;          /* 구간을 못 자르면 🔴 — 빈 문자열 통과 금지 */
     return !/추천|최적|딱 맞|베스트/.test(UI.slice(a, b));
  })());
  /* ⏹ v24.14 — 표시 건수와 **가진 건수**가 달라졌습니다.
     5행 상한 때문에 화면에는 5줄인데 실제로는 6건일 수 있습니다.
     리드에는 **가진 건수**를 적습니다 — 「+10%까지」를 켰을 때 숫자가 움직여야
     칩이 무언가 했다는 걸 압니다. */
  tt('건수를 밝힌다', /\$\{total\}건/.test(UI));

  /* 🔴 API가 주지 않는 값으로 칩을 만들지 않습니다. buildYear 하나만 씁니다. */
  /* ⏹ v24.14 — 칩이 **둘**이 됐습니다. 다만 성격이 다릅니다.
     「신축」은 **API 응답의 값**(buildYear)으로 거르는 취향 칩이고,
     「+10%까지」는 **우리가 아는 값**(예산)으로 범위를 넓히는 칩입니다.
     → API가 안 주는 값(역세권·학군·세대수)으로 칩을 만들지 않는다는 규칙은 그대로입니다. */
  tt('예산 범위 칩이 있다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     return /id="dealOver"/.test(src) && /DEAL\.over/.test(UI)
         && /overBand:1\.10/.test(UI);
  })());
  /* 🔴 예산 초과는 **켰을 때만** 보입니다. 기본으로 섞으면 「살 수 있다」로 읽힙니다(원칙 28). */
  /* ⚠ 처음 이 검사를 `A || B ? true : C`로 썼다가 **항상 참**이 됐습니다.
     `over: null`이 설정에 있으니 첫 항이 늘 통과했고, 칩을 없애는 사보타주가 그냥 지나갔습니다.
     99-b: 이 검사가 🔴가 되려면? ①기본값이 켜져 있거나 ②칩 상태를 안 보고 초과분을 넣으면.
     둘 다 **동시에** 봐야 합니다 — `||`로 잇지 않습니다. */
  tt('예산 초과는 기본으로 안 보인다', (()=>{
     const off  = /over:\s*null/.test(UI);                                  /* 기본 꺼짐 */
     const gate = /const keep = DEAL\.over \? Math\.min\(2, over\.length\) : 0;/.test(UI);
     return off && gate;
  })());
  /* 초과 줄에는 **차액**이 붙어야 합니다 — 얼마를 더 모으면 되는지가 이 기능의 값입니다. */
  tt('초과 줄에 차액이 붙는다',
     /x\.amountMan > priceMan\)[\s\S]{0,80}approxWon\(\(x\.amountMan - priceMan\)/.test(UI));
  /* 🔴 인접 구 표는 **우리가 만든 것**입니다. 대칭이 깨지면 한쪽에서만 이웃이 됩니다. */
  tt('인접 구 표가 대칭이다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const m = src.match(/const NEARBY = \{[\s\S]*?\n\};/);
     if(!m) return false;
     let N; try{ N = eval('(' + m[0].replace('const NEARBY = ','').replace(/;$/,'') + ')'); }catch(e){ return false; }
     const ks = Object.keys(N);
     if(ks.length !== 25) return false;                       /* 서울 25개 구 */
     return ks.every(a => N[a].length >= 2 && N[a].every(b => N[b] && N[b].includes(a)));
  })());
  /* 인접 구는 **모자랄 때만** 부릅니다 — 늘 부르면 호출이 25배가 됩니다. */
  tt('인접 구는 모자랄 때만 부른다',
     /if\(splitDeals\(items, priceMan\)\.under\.length >= DEAL\.want\) return items;/.test(UI));
  tt('취향 칩은 신축 하나뿐이다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     return /id="dealNew"/.test(src)
         && !/역세권|학군|세대수|1,000세대/.test(src)
         && /x\.buildYear && thisYear - x\.buildYear <= DEAL\.newYears/.test(UI);
  })());
  tt('신축 칩이 기존 옵션 칩 컴포넌트를 쓴다',
     /<button class="chip" id="dealNew"/.test(fs.readFileSync(FILE,'utf8')));
  /* 🔴 v24.7 — `aria-pressed` 문자열이 파일 어디든 1회만 있으면 통과했습니다.
     setAttribute 두 줄을 다 지워도, 마크업 초기값만 지워도 초록이었습니다. 양쪽을 봅니다. */
  tt('칩 상태가 마크업과 스크립트 양쪽에 있다', (()=>{
     const src = fs.readFileSync(FILE,'utf8').replace(/<!--[\s\S]*?-->/g,'');
     return /aria-pressed="(true|false)"/.test(src) && /setAttribute\('aria-pressed'/.test(UI);
  })());
  tt('칩 상태가 보조기술에 전달된다', /aria-pressed/.test(fs.readFileSync(FILE,'utf8')));
  /* 단지명은 외부 데이터입니다 — 그대로 innerHTML에 넣으면 안 됩니다. */
  tt('외부 데이터를 이스케이프한다',
     /const esc = t =>/.test(UI) && /esc\(x\.name\)/.test(UI) && /esc\(sub\)/.test(UI));
  /* 링크가 아닌 것을 링크처럼 보이게 하지 않습니다 — 단지 상세로 보낼 데이터가 없습니다. */
  tt('거래 줄은 링크가 아니다',
     !/<a[^>]*class="deal"/.test(UI) && /class="deal"><div class="nm">/.test(UI));
  /* 🔴 3개월치를 합치면 같은 단지·같은 평형이 여러 번 나옵니다.
     접지 않으면 같은 이름·같은 금액이 줄줄이 뜨고 G-7(같은 금액 ≤ 2회)에도 걸립니다. */
  tt('같은 단지 · 같은 평형을 접는다',
     /const k = x\.name \+ '\|' \+ \(x\.areaM2 == null \? '' : x\.areaM2\);/.test(UI)
     && /if\(!old \|\| when\(x\) > when\(old\)\) seen\.set\(k, x\);/.test(UI)
     && /\[\.\.\.seen\.values\(\)\]/.test(UI));
  /* 🔴 v23.23 — Light(300) 폐기. 한글 300은 12~17px에서 「흐린 글자」로 읽힙니다.
     대비는 400 ↔ 900으로 만듭니다. */
  tt('본문에 Light(300)를 쓰지 않는다',
     !/font-weight:300/.test(css2), (css2.match(/[^{;]*font-weight:300/g)||[]).slice(0,3).join(' | '));
  tt('핵심 수치가 700 이상이다', ['\\.rhead-amount','\\.tile-v','\\.mfield input','\\.line\\.total \\.v']
     .every(x=>{ const m=css2.match(new RegExp(x+'\\{[^}]*font-weight:(\\d+)')); return m && +m[1]>=700; }));
  /* 지시 6 — 이모지를 화면에서 완전히 뺐습니다(v23.20에서 1개 허용했던 것을 폐기). */
  /* ⚠ __selfcheck는 **콘솔 진단**입니다. ✅·🔴·🟡는 화면에 안 뜹니다 — 잘라내고 봅니다.
     이 경계를 안 그으면 검사가 자기 자신을 보고 영원히 🔴입니다. */
  tt('화면 노출 이모지가 0개다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const from = src.indexOf(ENGINE_MARK);
     const ui  = src.slice(from, src.indexOf('window.__selfcheck', from));
     const body = src.slice(src.indexOf('<body>'), src.indexOf('<script>', src.indexOf('<body>')));
     const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
     const strip = t => t.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
     return !EMOJI.test(strip(ui)) && !EMOJI.test(strip(body));
  })());

  /* v23.5 문구·구조 락 */
  tt('「여력」이 어디에도 없다', !/여력/.test(fs.readFileSync(FILE,'utf8')));
  /* 🔴 v23.26 — 화면 문구에서 과장·모호 표현을 뺍니다.
     면책이 「실제 금액은 은행에서 확인」이라고 말하는데 본문이 「정확한」이라고 하면 서로 어긋납니다. */
  /* 🔴 v24.14 — 이 검사가 **주석까지** 보고 있었습니다(원칙 111).
     코드 주석에 「충분히」를 쓴 것만으로 🔴가 떴습니다 — 화면에는 없는 말인데도요.
     이 검사가 보려는 건 **화면 문구**이므로 주석을 걷어내고 봅니다.
     ⚠ 오늘 같은 함정에 다섯 번 걸렸습니다. 문자열을 보는 검사는 예외 없이 주석을 겁니다. */
  const UI_BARE = UI.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  tt('화면 문구에 과장·모호 표현이 없다', (()=>{
     const BAN = ['정확한 금액','살짝','크게 올라','완벽','충분히','어느 정도','대략적으로'];
     return BAN.every(w => !UI_BARE.includes(w));
  })(), (()=>{ const BAN=['정확한 금액','살짝','크게 올라','완벽','충분히','어느 정도','대략적으로'];
     return BAN.filter(w=>UI_BARE.includes(w)).join(', ')||'없음'; })());
  /* 🔴 v24.19 — 문장 전체를 잠그고 있었습니다(원칙 48). 360px에서 두 줄이라 줄여야 했는데
     이 락이 막고 있었습니다. 잠글 것은 **「왜 묻는지가 화면에 있는가」**입니다. */
  tt('연소득을 묻는 이유가 화면에 있다', /규제\(DSR\)에 쓰여요/.test(UI));
  /* 🔴 v24.5 — 원칙 0(약어 단독 금지)은 화면 어디서나 유효합니다.
     결과 화면은 G-3이 봅니다. **입력 화면은 아무도 안 보고 있었습니다.** */
  tt('입력 화면의 DSR에 한글 설명이 붙어 있다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const m = src.match(/moneyCard\('income',[^)]*?'([^']+)'\)/);
     if(!m) return false;
     /* 🔴 v24.19 — 기준선은 __selfcheck의 G-3과 **같은 것**을 씁니다: 「규제(DSR)」.
        앞에 무슨 말이 더 붙는지는 문장의 문제이지 원칙 0의 문제가 아닙니다. */
     return !/DSR/.test(m[1]) || /규제\(DSR\)/.test(m[1]);
  })());
  /* 🔴 v24.5 — DSR의 핵심 규칙(연소득의 몇 %)이 상시로 보이는 자리에 있어야 합니다.
     이전에는 결과 화면에서 `binding`이 DSR·DTI일 때만 나왔습니다 — 다른 게 걸리면
     소득을 왜 물었는지 끝까지 설명되지 않았습니다. */
  tt('시트에 DSR 규칙 행이 있다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     /* 🔴 v24.18 — 문말어미(「봅니다」)를 빼고 **숫자와 뜻**만 봅니다(원칙 48). */
     return /<b>소득 대비 대출 규제\(DSR\)<\/b>/.test(src)
         && /연소득의 \d+%까지만 원리금 상환에 쓸 수 있/.test(src);
  })());
  /* 🔴 v24.5 — **화면의 숫자와 POLICY가 어긋나는 것**을 막습니다.
     POLICY.ratio.dsr을 고치고 시트 문구를 안 고치면 화면이 거짓말을 합니다.
     지침 — 정책 수치는 POLICY에서만 정의하고, 화면에 쓴 값은 반드시 대조합니다. */
  tt('시트의 DSR 비율이 POLICY.ratio.dsr과 같다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const m = src.match(/연소득의 (\d+)%까지만 원리금 상환에 쓸 수 있/);
     return !!m && Number(m[1]) === Math.round(POLICY.ratio.dsr * 100);
  })(), (()=>{ const src=fs.readFileSync(FILE,'utf8');
     const m=src.match(/연소득의 (\d+)%까지만/);
     return '화면 '+(m?m[1]:'없음')+'% / POLICY '+Math.round(POLICY.ratio.dsr*100)+'%'; })());
  /* ⏹ v24.15 — 「입력 02에서 계산 기준 시트를 열 수 있다」를 삭제했습니다.
     v24.5에서 넣은 버튼을 v24.15에서 뺐습니다(실물에서 자리만 차지했습니다).
     **기능을 지웠으면 락도 같이 지웁니다** — 없는 기능을 지키는 검사는 다음 사람을 속입니다.
     ⚠ 시트 자체는 살아 있습니다. 아래 「결과 ⓘ가 실제로 시트를 연다」가 그걸 지킵니다. */
  /* ⚠ 원칙 66 — **주석을 먼저 벗깁니다.** 여기서 실제로 한 번 걸렸습니다:
     본체에 「02의 계산 기준 보기를 뺐습니다」라는 HTML 주석을 달았더니
     그 주석이 카운트에 잡혀 검사가 빨갛게 떴습니다. 문구를 세는 검사는 주석까지 셉니다. */
  tt('계산 기준 시트가 결과에 한 번만 있다', (()=>{
     const bare = fs.readFileSync(FILE,'utf8')
       .replace(/<!--[\s\S]*?-->/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
     return (bare.match(/계산 기준 보기/g)||[]).length === 1
         && !/id="trustBtn2"/.test(bare);
  })());
  /* 🔴 v24.4 — 입력 화면이 「한도 = 소득」이라고 단정하지 않습니다.
     ⚠ 결과 화면의 「소득이 한도를 정했어요」는 **금지 대상이 아닙니다** —
       거기는 `c.binding==='DSR'||'DTI'`일 때만 나오는 조건부 서술입니다.
       그래서 파일 전체가 아니라 **02 헬퍼 문자열만** 봅니다. */
  tt('입력 화면이 한도를 소득 하나로 단정하지 않는다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const m = src.match(/moneyCard\('income',[^)]*?'([^']+)'\)/);
     if(!m) return false;
     return !/소득으로 정해|소득이 정해|소득이 결정|소득으로 결정/.test(m[1]);
  })());
  /* 🔴 v24.3 — 헬퍼는 **한 줄**입니다.
     ⚠ 글자 수는 지표가 아닙니다. 360px에서 32자짜리 두 개 중 하나만 두 줄이 됐습니다
       — 공백·중점(·)이 섞이면 들어가고, 한글만 붙으면 넘칩니다. **지표는 폭입니다.**
     그래서 진짜 검사는 렌더를 재는 **G-18**이고, 여기 있는 건 싸구려 조기 경보입니다.

     🔴 v24.5 — **34자 상한의 근거가 틀렸습니다.** v24.3 주석은 「34자를 넘으면 어떤
       조합이든 360px에서 넘친다」고 적었는데, 「소득 대비 대출 규제(DSR)에 쓰여요.
       세전 · 부부 합산.」은 **34자인데 한 줄**이고 35자짜리도 한 줄이었습니다.
       라틴 문자·괄호·숫자는 한글보다 좁습니다. **자수는 한글 전용 문장의 어림값일 뿐입니다.**
       상한을 36자로 올리고, 이 줄이 무엇을 재는지 다시 적었습니다(원칙 144).
     이 줄이 초록이라고 한 줄인 게 아닙니다. 360px에서 __selfcheck()를 돌려야 압니다. */
  tt('헬퍼 길이가 조기 경보 상한(36자) 안이다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const hs = [...src.matchAll(/moneyCard\('\w+', S\.\w+, '[^']+',\s*'([^']+)'\)/g)].map(m=>m[1])
       .concat([...src.matchAll(/<p class="helper">([^<]*(?:<b>[^<]*<\/b>[^<]*)*)<\/p>/g)]
         .map(m=>m[1].replace(/<[^>]+>/g,'')));
     return hs.length >= 2 && hs.every(t => t.trim().length <= 36);
  })(), (()=>{ const src=fs.readFileSync(FILE,'utf8');
     return [...src.matchAll(/moneyCard\('\w+', S\.\w+, '[^']+',\s*'([^']+)'\)/g)]
       .map(m=>m[1].length+'자').join(' / '); })());
  /* 🔴 G-18이 실제로 렌더를 재고 있는지 소스에서도 확인합니다(원칙 101).
     라벨만 남기고 알맹이를 지우는 사보타주는 위 「__selfcheck 항목」 검사가 못 잡습니다. */
  /* 🔴 v24.6 — G-18이 표(LINEMAX)로 넓어져 검사식도 다시 씁니다(지침 5층 3번).
     이전: `.helper`를 직접 긁고 `> 1`로 비교했습니다. 지금은 선택자마다 상한이 다릅니다. */
  tt('G-18이 렌더된 줄 수를 잰다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     return /const LINEMAX=\[\['\.helper',1\]/.test(src)
         && /getBoundingClientRect\(\)\.height \/ lh\)/.test(src)
         && /if\(n>max\)/.test(src);
  })());

  /* 🔴 v24.3 — 「지우기」는 빠른 추가 칩의 형제가 아니라 **그 입력칸에 딸린 동작**입니다.
     칩 줄에 두면 칩 폭에 따라 어떤 화면은 같은 줄, 어떤 화면은 혼자 다음 줄로 떨어집니다. */
  tt('지우기가 라벨 줄에 있다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     return /class="flabel">\$\{label\}<button class="clearbtn" data-add="0" hidden>지우기<\/button>/.test(src)
         && /매달 나가는 대출 원리금<button class="clearbtn" data-debt="0" hidden>지우기<\/button>/.test(src);
  })());
  tt('칩 줄에 지우기가 없다',
     !/class="chip is-clear"/.test(fs.readFileSync(FILE,'utf8')));
  tt('라벨 줄이 좌우 양끝 정렬이다',
     /\n\.flabel\{[^}]*display:flex/.test(css2)
     && /\n\.flabel\{[^}]*justify-content:space-between/.test(css2));
  /* 지울 게 없는데 「지우기」가 떠 있으면 소음입니다 — 값이 있을 때만 보입니다. */
  tt('값이 없으면 지우기를 숨긴다',
     /if\(clr\) clr\.hidden = !v;/.test(UI)
     && /if\(dc\) dc\.hidden = !S\.debtMonthly;/.test(UI)
     && /class="clearbtn" data-add="0" hidden/.test(fs.readFileSync(FILE,'utf8')));
  /* G-8 — 같은 상태를 두 이름으로 부르지 않습니다. */
  tt('「소득 미입력」의 이름이 하나다',
     /'넣지 않음'/.test(UI) && !/'안 넣음'/.test(UI));
  /* 🔴 v24.7 — `id="roomTip"`이 **있는지만** 봤습니다. 아코디언 밖으로 옮겨도 초록이었습니다.
     이름이 「이동」이면 위치를 재야 합니다(99-b). */
  tt('방공제 안내가 한도 아코디언 안으로 이동', (()=>{
     const src = fs.readFileSync(FILE,'utf8').replace(/<!--[\s\S]*?-->/g,'');
     const a = src.indexOf('id="limitTip"');
     if(a < 0) return false;
     return src.slice(Math.max(0, a-1200), a+1200).includes('id="roomTip"');
  })());
  /* 🔴 v23.23 — 퍼널(02)에 「항목별로 더하기」 아코디언이 하나 생겼습니다.
     이 락이 지키려던 것은 **결과 화면**의 밀도입니다. 그쪽만 셉니다.
     🔴 v24.19 — 2종 → **3종**. 인테리어 카드를 접었습니다(노아초이님 요청).
       ⚠ 숫자만 올린 것이 아닙니다 — **셋이 같은 문법을 쓰는지**를 아래에서 함께 봅니다.
         접기가 늘 때마다 새 클래스를 만들면 결과 화면에 접기 문법이 둘이 됩니다. */
  tt('결과 화면 아코디언은 3종 (부대비용 · 한도 · 인테리어)', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const res = src.slice(src.indexOf('<section class="result"'), src.indexOf('</section>'));
     return (res.match(/class="disc"/g)||[]).length === 3;
  })());
  /* 인테리어는 **닫힌 채로 시작합니다.** 기본값이 열림이면 접은 의미가 없습니다. */
  tt('인테리어 접기가 셋과 같은 문법이다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     return /class="disc" id="itToggle"[^>]*aria-controls="itBox"/.test(src)
         && /class="costbox" id="itBox"/.test(src)
         && /\['itToggle','itBox','itOpen'\]/.test(src);
  })());
  tt('인테리어는 닫힌 채로 시작한다',
     /itOpen:\s*false/.test(fs.readFileSync(FILE,'utf8')));
  tt('퍼널 아코디언은 1종 (항목별 더하기)',
     (UI.match(/class="disc" id="debtPartsToggle"/g)||[]).length === 1);
  tt('「다른 집값으로 계산하기」가 없다',
     !/priceToggle|다른 집값으로 계산/.test(fs.readFileSync(FILE,'utf8')));
  /* v23.20 — 아코디언의 회색 박스를 벗겼습니다. 버튼이 아니라 「열고 닫는 줄」입니다. */
  tt('아코디언이 투명 면 + 헤어라인이다',
     /\.disc\{[^}]*background:transparent/.test(css2)
     && /\.disc\{[^}]*border-top:1px solid var\(--line\)/.test(css2));
  tt('안내 박스는 여전히 수수하다', /\.tip\{[^}]*background:transparent/.test(css2));
  /* 규제지역은 「정보」가 아니라 「주의」입니다 — 면과 글자로 위계를 만듭니다. */
  tt('규제지역 안내가 주의 위계다',
     /\.tip\.info\{[^}]*background:var\(--warn-tint\)/.test(css2)
     && /\.tip\.info\{[^}]*color:var\(--warn\)/.test(css2));
  /* 🔴 아코디언을 지우다 고아 </div>가 남아 #result가 일찍 닫혔고,
     인테리어·다음걸음 카드가 첫 화면으로 새어 나왔습니다. 구조를 센다. */
  const RES = html2.slice(html2.indexOf('<section class="result"'), html2.indexOf('</section>'));
  tt('result 안 div 개횡수 균형',
     (RES.match(/<div/g)||[]).length === (RES.match(/<\/div>/g)||[]).length,
     (RES.match(/<div/g)||[]).length + ' / ' + (RES.match(/<\/div>/g)||[]).length);
  tt('인테리어·다음걸음이 result 안에 있다',
     RES.includes('id="outInterior"') && RES.includes('id="outSave"'));
  /* 🔴 v24.0 — 실거래 카드가 하나 늘어 **4개**입니다.
     ⚠ G-9(결과 블록 ≤ 8)가 이제 **꽉 찼습니다** — 헤더 1 + 타일 3 + 카드 4 = 8.
       다음에 무엇을 더하려면 **무엇을 접을지 먼저 정해야 합니다**(지침 4층 3번). */
  tt('result 안 카드가 4개', (RES.match(/<div class="card[ "]/g)||[]).length === 4,
     (RES.match(/<div class="card[ "]/g)||[]).length + '개');

  tt('첫 화면 오버랩이 없다 (밴드 끝선이 깔끔하게)',
     /\.funnel > \.q\{[^}]*margin-top:20px/.test(css2));
  tt('보유 라벨이 명사형', /생애 최초[\s\S]{0,400}1주택 이상/.test(UI));
  tt('규제 도달 문구가 전문형', /비율\(LTV\) 최대 한도에 도달/.test(UI)
     && /규제\(DSR\) 최대 한도에 도달/.test(UI));
  /* ⏹ v24.13 — 「밖으로 나가는 링크는 매물 하나뿐」을 **되돌렸습니다.**
     지웠던 근거는 「실거래가는 앱 안에서 보여준다」였는데, 그 카드는 **API 키가 있어야 뜹니다.**
     키를 넣기 전에는 실거래가가 화면 어디에도 없습니다. → 국토부 칸을 되살렸습니다. */
  tt('실거래가 링크가 국토부', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     return /rt\.molit\.go\.kr/.test(src) && !/hogangnono/.test(src);
  })());
  /* 🔴 v24.16 — **실기에서 눌러 보고 되돌렸습니다**(2026.08.12).
     `new.land.naver.com`은 `fin.land.naver.com`으로 리다이렉트되면서 **`?sk=`를 버립니다.**
     도착지는 「MY」 탭(개인화 화면)이었습니다. 「이 예산대를 봐요」가 지키지 못하는 약속이 됐습니다.
     ⚠ 이 검사가 잠그는 것은 **주소가 아니라 약속과 도착지의 일치**입니다 —
       예산대를 약속하는 문구가 되살아나면 실패해야 합니다(원칙 39). */
  tt('네이버 칸이 지키지 못할 예산대를 약속하지 않는다', (()=>{
     const src = fs.readFileSync(FILE,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
     return /outNaver'\)\.href\s*=\s*`https:\/\/fin\.land\.naver\.com\//.test(src)
         && !/new\.land\.naver\.com/.test(src)
         && !/sk=/.test(src)
         && !/억대 추천 단지 보기/.test(src)
         && !/이 예산대를 봐요/.test(src);
  })());
  /* 🔴 v23.27 — 밖으로 나가는 링크는 **진짜 앵커**여야 합니다.
     스크립트로 연 창은 인앱 브라우저(카톡·인스타)에서 막히거나 같은 탭에 뜹니다.
     같은 탭에 뜨면 뒤로가기에서 페이지가 다시 로드되고, 사용자는 계산을 잃습니다. */
  /* 🆕 v24.16 — **밖으로 나가는 도메인의 전수를 잠급니다.**
     남의 주소는 우리 코드가 아닙니다 — 도메인이 바뀌어도 에러가 안 나고, 검사는 문자열이 있는지만 봅니다.
     `new.land.naver.com`이 조용히 죽어 있던 것을 **실기로 눌러 보기 전까지 아무도 몰랐습니다.**
     여기 없는 도메인이 들어오면 실패합니다 — 그때 **실기 확인 목록에 같이 올리라는 신호**입니다. */
  tt('밖으로 나가는 도메인이 확인된 것뿐이다', (()=>{
     const src = fs.readFileSync(FILE,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
     const OK = ['fin.land.naver.com','rt.molit.go.kr','ohou.se','search.naver.com','cdnjs.cloudflare.com'];
     const hosts = [...new Set([...src.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m=>m[1].toLowerCase()))]
       .filter(h => !/^(www\.)?w3\.org$/.test(h) && !/googletagmanager|google-analytics|noah-choi\.vercel\.app/.test(h));
     return hosts.every(h => OK.includes(h));
  })(), (()=>{
     const src = fs.readFileSync(FILE,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
     const OK = ['fin.land.naver.com','rt.molit.go.kr','ohou.se','search.naver.com','cdnjs.cloudflare.com'];
     const bad = [...new Set([...src.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map(m=>m[1].toLowerCase()))]
       .filter(h => !/^(www\.)?w3\.org$/.test(h) && !/googletagmanager|google-analytics|noah-choi\.vercel\.app/.test(h))
       .filter(h => !OK.includes(h));
     return bad.length ? ('미확인 도메인: '+bad.join(' · ')) : '';
  })());
  tt('밖으로 나가는 넷이 전부 앵커다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     return ['outNaver','outHogang','outInterior','outMove'].every(id =>
       new RegExp('<a class="mini[^"]*" id="'+id+'" target="_blank" rel="noopener noreferrer"').test(src));
  })());
  tt('창을 스크립트로 열지 않는다',
     !/window\.open\(/.test(UI) && !/function go\(url\)/.test(UI));
  /* 앵커는 href만 채웁니다 — onclick으로 열면 앵커로 바꾼 의미가 없습니다. */
  tt('앵커는 href로만 연결된다', (()=>{
     return /\$\('outNaver'\)\.href\s*=/.test(UI)
         && /\$\('outInterior'\)\.href\s*=/.test(UI)
         && /\$\('outMove'\)\.href\s*=/.test(UI)
         && !/\$\('out(Naver|Hogang|Interior|Move)'\)\.onclick/.test(UI);
  })());
  tt('앵커가 버튼과 같은 모양이다',
     /\.mini\{[^}]*text-decoration:none/.test(css2) && /\.mini\{[^}]*color:inherit/.test(css2));
  tt('에러 줄이 평소에 자리를 차지하지 않는다',
     /\.fielderr\{[^}]*max-height:0/.test(css2) && /\.fielderr\{[^}]*opacity:0/.test(css2));
  tt('에러 줄이 부드럽게 나타난다', (()=>{
     const m = css2.match(/\.fielderr\{[^}]*transition:([^;}]+)/);
     return !!m && /opacity/.test(m[1]) && /max-height/.test(m[1]);
  })());
  /* 🔴 v23.27 — 공유 카드가 웹과 같은 라이트 톤인가 */
  /* 🔴 v24.1 — 「라이트 톤인가」에서 **「브랜드 그린 면인가」**로 다시 씁니다(지침 5층 3번).
     다크 그라데이션을 막는다는 목적은 그대로이고, 기준만 한 단 올라갔습니다. */
  tt('공유 카드 상단이 브랜드 그린 면이다',
     /\.report-top\{background:var\(--green\);color:var\(--ink\)/.test(css2)
     && !/linear-gradient\(135deg,var\(--grad/.test(css2)
     && !/\.report-top\{[^}]*background:#/.test(css2));
  tt('공유 카드 금액이 잉크다', /\.report-amount\{[^}]*color:var\(--ink\)/.test(css2));
  /* 🔴 그린 면 위에서 읽히는 글자는 --ink(7.64:1)와 --ink-2(5.07:1) 둘뿐입니다.
     --ink-3(3.28) · --ink-4(2.13) · 흰색(2.17)은 AA 미달입니다. 실제 대비를 계산해서 봅니다. */
  tt('그린 면 위 글자가 전부 4.5:1 이상', (()=>{
     const g=n=>((css2.match(new RegExp('--'+n+':\\s*(#[0-9A-Fa-f]{6})'))||[])[1]||'');
     const L=h=>{h=h.slice(1);const c=[0,2,4].map(i=>{let v=parseInt(h.substr(i,2),16)/255;
       return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2];};
     const CR=(a,b)=>(Math.max(L(a),L(b))+.05)/(Math.min(L(a),L(b))+.05);
     const green=g('green'); if(!green) return false;
     /* ⚠ 상속된 규칙(.report-amount .u)까지 포함해야 합니다 — 실제로 여기서 한 건 놓쳤습니다. */
     const rules = css2.match(/\.report-(brand|cond|label|amount)[^{]*\{[^}]*\}/g)||[];
     const used = rules.map(r => (r.match(/color:var\((--[a-z0-9-]+)\)/)||[])[1]).filter(Boolean);
     return used.length >= 5 && used.every(tok => {
       const hex = g(tok.slice(2));
       return hex && CR(hex, green) >= 4.5;
     });
  })());
  /* 그린 위 그린은 안 보입니다 — 브랜드 막대는 잉크로 뒤집혀야 합니다. */
  tt('그린 면 위에 그린을 얹지 않는다',
     /\.report-brand::before\{[^}]*background:var\(--ink\)/.test(css2)
     && !/\.report-(brand|cond|label|amount)[^{]*\{[^}]*var\(--green\)/.test(css2));
  tt('다크 그라데이션 토큰을 삭제했다',
     !/--grad-1\s*:/.test(css2) && !/--bronze-hi\s*:/.test(css2)
     && !/var\(--grad-[12]\)/.test(css2) && !/var\(--bronze-hi\)/.test(css2));

  /* 🔴 v24.15 — 「임시 도메인 표기」를 삭제하고 **실주소 락**으로 바꿨습니다.
     자리표시자를 지키던 검사입니다. 주소가 들어왔으니 역할이 끝났습니다.
     이제 지킬 것은 반대쪽입니다 — **자리표시자가 되돌아오지 않을 것**, 그리고
     주소가 **한 곳에서만 정의될 것**(문자열을 화면에 직접 박으면 세 곳이 어긋납니다). */
  tt('공유 주소가 자리표시자가 아니다',
     !/\[출시-후-도메인-연결-예정\]/.test(UI)
     && /const SERVICE_URL = 'https:\/\/[^'\[\]]+';/.test(UI));
  /* 🔴 v24.15 — 카드의 실거래 블록. **없을 때 안 그리는 것**이 요점입니다(원칙 53). */

  /* ═══ v24.16 — 표시가 화면보다 덜 말하지 않게 잠급니다 ═══════════
     ⚠ 아래 셋은 **주석을 지운 소스**로 봅니다(원칙 66). 이 파일과 본체의 설명 주석에
       옛 문자열이 그대로 인용돼 있어, 원문으로 보면 부정 검사가 전부 헛돕니다. */
  (() => {
    const src = UI.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    /* 진단서는 **화면을 본 적 없는 사람**에게 전달됩니다. 거래가 모자라면 인근 구까지 넓히는데,
       카드 맨 위의 지역은 사용자가 고른 구 하나뿐입니다. 구 이름을 안 달면
       남의 구 거래가 그 구 거래로 읽힙니다(2026.08.12 실물 확인 · 종로구 카드에 성북·서대문). */
    const body = (src.match(/function paintReportDeals[\s\S]*?\n\}/) || [''])[0];
    tt('진단서 실거래 줄이 인근 구 이름을 단다',
       /x\.lawd\s*!==\s*S\.sgg/.test(body) && /sggName\(x\.lawd\)/.test(body),
       body ? '' : 'paintReportDeals를 못 찾음');
    /* 화면(dealLine)과 **같은 규칙**이어야 합니다. 한쪽만 고치면 다음에 또 갈립니다. */
    const line = (src.match(/function dealLine[\s\S]*?\n\}/) || [''])[0];
    tt('진단서와 화면이 같은 규칙으로 구 이름을 판단한다',
       /x\.lawd\s*!==\s*S\.sgg/.test(line) && /x\.lawd\s*!==\s*S\.sgg/.test(body));

    /* 영수증의 기타비용. 이름 안에 이미 가운뎃점이 있어, 이름들을 ' · '로 이으면
       세 항목이 여섯으로 읽힙니다. **켠 것마다 한 줄**이 원래 모양입니다. */
    tt('영수증 기타비용이 항목별 한 줄이다',
       /const ETC_ROWS\s*=/.test(src) && /ETC_ROWS\.forEach/.test(src) && !/etcLabel\s*\(/.test(src));
    /* 순서가 어긋나면 영수증과 「부대비용 상세 설정」을 눈으로 대조할 수 없습니다. */
    /* ⚠ 스위치는 **마크업**에 있습니다. `UI`는 BUILD 줄 뒤의 스크립트만 담으므로
         여기서는 파일 전문을 다시 읽습니다(이걸 놓쳐 검사가 한 번 헛돌았습니다). */
    tt('기타비용 순서가 상세 설정 스위치 순서와 같다', (() => {
       const full = fs.readFileSync(FILE, 'utf8');
       const m = src.match(/const ETC_ROWS\s*=\s*\[([\s\S]*?)\];/);
       if(!m) return false;
       const keys = [...m[1].matchAll(/\['(\w+)'/g)].map(x => x[1]).join(',');
       const sws  = [...full.matchAll(/id="sw(Legal|Move|Appl)"/g)].map(x => x[1].toLowerCase()).join(',');
       return keys === 'legal,move,appl' && sws === 'legal,move,appl';
    })());

    /* 인테리어 카드. 킥커가 「영수증에 더했어요」를 말하는데 설명 꼬리도 같은 말을 했습니다.
       이 함수가 스스로 갈라 둔 역할(설명=무엇인지 / 킥커=영수증에 들어갔는지)을 지킵니다. */
    tt('인테리어 설명이 킥커와 같은 말을 하지 않는다', !/영수증에도 더해져요/.test(src));
    tt('인테리어 킥커는 영수증 반영 여부를 계속 말한다', /영수증에 더했어요/.test(src));
  })();

  /* 🔴 v24.15 — 인접 구 표. 좌표가 없어 **손으로 적은 표**라 구조 검사만으로는 부족합니다.
     대조에서 실제로 다섯 줄이 틀렸습니다. **확인된 것을 값으로 잠급니다** —
     다음 사람이 「정리했다」는 문장만 보고 넘기지 않도록. */
  tt('인접 구 표 — 대조 완료분이 그대로다', (()=>{
     const near = (code) => {
       const m = UI.match(new RegExp("'"+code+"':\\[([^\\]]*)\\]"));
       return m ? m[1].split(',').map(x=>x.trim().replace(/'/g,'')).sort().join(',') : '';
     };
     return near('11215') === ['11200','11230','11260','11680','11710','11740'].sort().join(',')
         && near('11260') === ['11215','11230','11290','11350'].sort().join(',')
         && near('11740') === ['11215','11710'].sort().join(',')
         && near('11380') === ['11110','11410','11440'].sort().join(',');
  })());
  /* 확인된 **오답 넷**이 되돌아오지 않는지 봅니다. 틀린 항목은 빠진 항목보다 나쁩니다 —
     빠지면 결과가 줄 뿐이지만 틀리면 **엉뚱한 동네가 목록에 섞입니다**. */
  tt('인접 구 표 — 확인된 오답이 없다', (()=>{
     const has = (a,b) => {
       const m = UI.match(new RegExp("'"+a+"':\\[([^\\]]*)\\]"));
       return !!m && m[1].includes("'"+b+"'");
     };
     return !has('11215','11350') && !has('11350','11215')   /* 광진 ↔ 노원  — 안 붙습니다 */
         && !has('11260','11740') && !has('11740','11260')   /* 중랑 ↔ 강동  — 안 붙습니다 */
         && !has('11380','11320') && !has('11320','11380')   /* 은평 ↔ 도봉  — 안 붙습니다 */
         && !has('11380','11500') && !has('11500','11380');  /* 은평 ↔ 강서  — 안 붙습니다 */
  })());
  /* 🔴 v24.15 — 면적 칩의 경계. **85㎡는 국민주택규모 · 농특세 경계**입니다.
     위끝이 85를 넘으면 그 줄만 취득세 구조가 화면 계산과 달라집니다.
     ⚠ 경계는 **양쪽을 봅니다**(원칙 56) — 85.0은 들어오고 85.1은 빠져야 합니다. */
  tt('전용 84㎡ 칩이 85㎡를 넘지 않는다', (()=>{
     const m = UI.match(/a84:\s*\[\s*(\d+)\s*,\s*(\d+)\s*\]/);
     return !!m && +m[2] <= 85 && +m[1] >= 82;
  })(), (()=>{ const m=UI.match(/a84:\s*\[([^\]]+)\]/); return m?('a84 = ['+m[1].trim()+']'):'없음'; })());
  tt('면적 경계가 양끝을 포함한다', /v >= b\[0\] && v <= b\[1\]/.test(UI));
  /* 🔴 v24.15 — 굵기·자간·행간 스케일. 크기(--t*)만 규격이 있고 나머지 셋은 자리마다 손으로 골랐습니다. */
  tt('굵기·자간·행간 스케일이 :root에 있다',
     /--w-hero:\s*900;\s*--w-key:\s*700;\s*--w-sub:\s*500;/.test(css2)
     && /--ls-hero:[^;]+;\s*--ls-ttl:[^;]+;\s*--ls-body:[^;]+;\s*--ls-eye:[^;]+;/.test(css2)
     && /--lh-hero:[^;]+;\s*--lh-ttl:[^;]+;\s*--lh-body:[^;]+;/.test(css2));
  /* 🔴 굵기는 **역할 세 단**입니다. 다만 이 규칙은 아직 **공유 카드에만** 적용했습니다.
     ⚠ 처음엔 파일 전체에 물었다가 빨갛게 떴습니다 — 화면 전체는 400·500·600·700·800·900
       **여섯 단**입니다(.eyebrow · .card-title · .line.total 등 800이 17곳).
       화면 전체를 세 단으로 줄이는 것은 모든 글자가 움직이는 변경이라 **단독 판**이어야 합니다.
     검사는 **실제로 지키는 범위만** 잠급니다. 지키지도 않는 규칙을 거는 검사는
     다음 사람에게 「이미 정리됐다」는 거짓 신호를 줍니다. 범위를 카드로 좁힙니다. */
  tt('공유 카드 굵기가 세 단뿐이다', (()=>{
     const bare = css2.replace(/\/\*[\s\S]*?\*\//g,'');
     const rules = (bare.match(/[^{}]*\.report[^{}]*\{[^}]*\}/g)||[]).join(' ');
     const tok = new Set((rules.match(/font-weight:\s*var\((--w-[a-z]+)\)/g)||[])
       .map(x=>(x.match(/--w-[a-z]+/)||[])[0]));
     return tok.size <= 3 && [...tok].every(t=>['--w-hero','--w-key','--w-sub'].includes(t));
  })());
  /* 🔴 공유 카드는 **손으로 고른 굵기·자간·행간이 없어야** 합니다 — 전부 토큰. */
  tt('공유 카드 활자가 전부 토큰이다', (()=>{
     const bare = css2.replace(/\/\*[\s\S]*?\*\//g,'');
     const rules = bare.match(/[^{}]*\.report[^{}]*\{[^}]*\}/g)||[];
     const bad = [];
     rules.forEach(r=>{
       (r.match(/(font-weight|letter-spacing|line-height):\s*([^;}]+)/g)||[]).forEach(d=>{
         if(!/var\(--/.test(d)) bad.push(d.trim());
       });
     });
     return bad.length === 0;
  })(), '남은 것: ' + ((()=>{const bare=css2.replace(/\/\*[\s\S]*?\*\//g,'');
     const rules=bare.match(/[^{}]*\.report[^{}]*\{[^}]*\}/g)||[];const bad=[];
     rules.forEach(r=>{(r.match(/(font-weight|letter-spacing|line-height):\s*([^;}]+)/g)||[])
       .forEach(d=>{if(!/var\(--/.test(d)) bad.push(d.trim());});});
     return bad.slice(0,3).join(' | ')||'없음';})()));
  /* 🔴 숫자와 단위가 붙던 자리 — 음수 자간이 단위까지 당기고 있었습니다. */
  tt('금액 단위가 음수 자간을 물려받지 않는다',
     /\.report-amount \.u\{[^}]*letter-spacing:var\(--ls-body\)/.test(css2)
     && /\.report-amount \.u\{[^}]*padding-left:/.test(css2));
  /* 🔴 내보내는 그림은 보는 기기와 무관해야 합니다 — 반응형 토큰(--d1/--t1/--t2)을 쓰면 안 됩니다. */
  tt('공유 카드가 반응형 토큰을 쓰지 않는다', (()=>{
     const bare = css2.replace(/\/\*[\s\S]*?\*\//g,'');
     const rules = (bare.match(/[^{}]*\.report[^{}]*\{[^}]*\}/g)||[]).join(' ');
     return !/var\(--(d1|t1|t2)\)/.test(rules);
  })());
  /* 🔴 v24.15 — 이미지 속 주소는 **누를 수 없습니다.** 못 칠 길이면 안 적습니다. */
  tt('카드 주소는 짧을 때만 적는다',
     /const HOST_MAX = \d+;/.test(UI)
     && /raw\.length <= HOST_MAX \? raw : ''/.test(UI));
  /* 반대로 요약 문구(텍스트)에는 **길어도 전체 주소**가 들어갑니다 — 거기선 실제로 눌립니다. */
  tt('요약 문구에는 전체 주소가 들어간다', (()=>{
     const f = (UI.match(/function summaryText\([\s\S]*?\n\}/)||[''])[0];
     return f.length > 100 && /L\.push\(SERVICE_URL\)/.test(f);
  })());
  /* 🔴 v24.15 — 원칙 47. 쓰는 곳이 없어진 CSS가 남으면 다음 사람이 산 규칙으로 읽습니다. */
  tt('진단서에 죽은 .report-line 규칙이 없다', (()=>{
     const bare = UI.replace(/\/\*[\s\S]*?\*\//g,'');
     return !/\.report-line/.test(bare);
  })());
  tt('공유 카드 실거래는 2건 미만이면 안 그린다',
     /rows\.length < 2\)\{ box\.hidden = true; return; \}/.test(UI)
     && /if\(!priceMan \|\| items\.length === 0\)\{ box\.hidden = true; return; \}/.test(UI));
  /* 실거래는 async라 renderReport 시점엔 비어 있습니다 — 굽기 직전에 다시 채워야 합니다. */
  /* ⚠ 원칙 48 — 처음엔 `paintReportDeals(LASTVIEW.price)`를 통째로 물었다가,
     단위 버그를 고치며 인자가 바뀌자 빨갛게 떴습니다. **목적은 「굽기 직전에 다시 채운다」**입니다. */
  tt('이미지 저장 직전에 실거래를 다시 채운다',
     /async function saveImage\(\)\{[\s\S]{0,400}paintReportDeals\(/.test(UI));
  /* 🔴 v24.15 — **단위.** 실거래 비교는 전부 **만원**입니다. 원 단위를 넘기면
     예산 구간에 걸리는 거래가 0건이 되어 **에러 없이 블록이 사라집니다.**
     실제로 그렇게 나갔습니다(2026.08.12 카톡 실물). 두 호출 지점 모두 잠급니다. */
  tt('진단서 실거래에 만원 단위를 넘긴다', (()=>{
     const calls = UI.match(/paintReportDeals\(([^)]*)\)/g) || [];
     const passes = calls.filter(c => !/^paintReportDeals\(priceMan\)/.test(c));
     return passes.length >= 2 && passes.every(c => /\/ 10000/.test(c));
  })(), (UI.match(/paintReportDeals\([^)]*\)/g)||[]).join(' | '));
  /* 보낸 사람의 칩(신축·면적)이 카드에 새지 않습니다 — 받는 사람의 취향이 아닙니다. */
  tt('공유 카드 실거래에 칩 필터를 걸지 않는다', (()=>{
     const f = (UI.match(/function paintReportDeals\([\s\S]*?\n\}/)||[''])[0];
     return f.length > 100 && !/DEAL\.(onlyNew|only59|only84|over)/.test(f);
  })());
  tt('공유 주소를 SERVICE_URL 한 곳에서만 쓴다', (()=>{
     const bare = UI.replace(/\/\*[\s\S]*?\*\//g,'');
     const url = (bare.match(/const SERVICE_URL = '([^']+)'/)||[])[1] || '';
     if(!url) return false;
     const host = url.replace(/^https?:\/\//,'');
     return (bare.split(host).length - 1) === 1;
  })());
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
  /* v23.18 — 배경이 --fill이면 앱 배경(--bg)과 같은 값이라 글자만 떠 있는 것처럼 보였습니다. */
  tt('되돌아가기가 버튼 덩어리다 (흰 면 + 헤어라인 + 그림자)',
     /\.reedit-cta\{[^}]*background:var\(--card\)/.test(css2)
     && /\.reedit-cta\{[^}]*border:1px solid var\(--line\)/.test(css2)
     && /\.reedit-cta\{[^}]*box-shadow:var\(--sh\)/.test(css2));
  /* 🔴 v23.23 — 화살표(←)를 뺐습니다. 버튼 안의 아이콘은 **위치가 이미 말하는 것**을 반복합니다.
     v23.21에 「방향 표시가 있는가」로 잠갔던 락을 **반대 방향으로** 다시 씁니다(지침 5층 3번). */
  tt('되돌아가기가 텍스트만이다',
     /id="reeditBtn">이전 단계</.test(UI) && !/←/.test(UI));
  tt('조건 수정은 03단계로 간다', /S\.step = STEPS\.length - 1/.test(UI));
  tt('조건 칩에 ▾ 아이콘', /<b class="cc">\u25be<\/b>|class="cc">▾/.test(UI));
  /* 🔴 v24.6 — 이 검사는 **요소 개수**를 세면서 값을 「줄」이라고 찍고 있었습니다.
     그래서 화면이 두 줄이든 다섯 줄이든 블록이 하나면 초록이었습니다.
     이름을 사실대로 바꿉니다. **렌더된 줄 수는 G-18이 봅니다**(상한 2줄). */
  /* 🔴 v24.7 — 「면책 블록이 하나다」(=== 1)가 이 검사를 완전히 포섭합니다.
     이 줄은 **단독으로 🔴가 될 수 없어** 지웠습니다(99-b). 상한이 필요하면 그 검사를 고치세요. */
  /* 🔴 v24.19 — 문장 그대로가 아니라 **사실 둘**을 봅니다. 360px 세 줄을 두 줄로 줄이면서
     「변화 및」이 「과」로 바뀌었는데, 고지의 내용은 한 글자도 안 줄었습니다(원칙 48). */
  tt('정책 변동 고지가 있다', /정부 정책/.test(UI) && /은행 심사/.test(UI));
  tt('DSR·정책대출 안내는 한도 아코디언으로', /limitTip'\)\.innerHTML = bindingTip[\s\S]{0,300}본 DSR 한도/.test(UI));

  /* v23.10 — 마커가 오른쪽 텍스트를 덮던 버그 · 플로팅 독 · 칩 틴트 */
  tt('형광펜 마커가 없다 (v23.15)',
     !/rhead-amount::after/.test(css2) && !/\.rhead-amount > span\{[^}]*linear-gradient/.test(css2));
  /* 🔴 v23.20 — 둥근 캡슐 폐기. 알약 안에 알약이 들어 있어 엄지 폭이 두 번 깎였습니다. */
  tt('독이 가로 2분할이다',
     /\.dockrow\{display:flex;gap:8px\}/.test(css2)
     && /\.dockrow \.cta\{flex:1/.test(css2)
     && /\.dockrow \.cta\.back\{flex:0 0 90px/.test(css2));
  tt('독에 캡슐 껍데기가 없다', !/\.dockrow\{[^}]*border-radius:999px/.test(css2));
  /* 🔴 v23.23 — 검정 솔리드 폐기. 프라이머리 액션은 화면이 달라도 **같은 버튼**이어야 합니다.
     지침 6-5의 「재계산 CTA는 예외로 검정 면」 조항을 폐기하고 락을 뒤집습니다. */
  tt('재계산 CTA가 「다음」과 같은 버튼이다',
     /\.restart-cta\{[^}]*background:var\(--green\);color:var\(--espresso\)/.test(css2)
     && !/\.restart-cta\{[^}]*background:var\(--espresso\)/.test(css2));
  tt('프라이머리 버튼이 화면마다 같다', (()=>{
     const g = sel => (css2.match(new RegExp(sel+'\\{[^}]*background:var\\((--[a-z-]+)\\)'))||[])[1];
     return g('\\.cta') === g('\\.restart-cta');
  })(), (css2.match(/\.restart-cta\{[^}]*background:var\((--[a-z-]+)\)/)||[])[1]);

  /* 🔴 v23.20 — 하드 보더 문법을 폐기하고 v23.18의 그림자 문법으로 되돌렸습니다.
     ⚠ 원칙 101 — 분리의 근거를 셉니다. 지금은 「배경색 차이 + 은은한 그림자」 둘입니다.
        v23.19는 「검은 테두리」 하나뿐이라 지우면 카드가 통째로 사라졌습니다. */
  tt('카드가 그림자로 분리된다',
     /\.card\{[^}]*box-shadow:var\(--sh\)/.test(css2)
     && /\.tile\{[^}]*box-shadow:var\(--sh\)/.test(css2)
     && /\.funnel > \.q\{[^}]*box-shadow:var\(--sh\)/.test(css2));
  /* 카드는 그림자 하나로만 분리합니다 — 질문 카드에만 테두리가 있어 문법이 갈려 있었습니다. */
  tt('카드에 테두리를 두르지 않는다',
     /\.funnel > \.q\{[^}]*border:0/.test(css2)
     && !/\.card\{[^}]*border:1/.test(css2) && !/\.tile\{[^}]*border:1/.test(css2));
  tt('카드에 굵은 검정 테두리가 없다',
     !/\.(card|tile|moneycard)\{[^}]*border:var\(--hair\)/.test(css2)
     && !/--hair:1px solid #000/.test(css2));
  tt('오프셋 하드 섀도우 전면 폐기',
     !/--hard(-sm)?:/.test(css2) && !/var\(--hard/.test(css2)
     && !/\d+px \d+px 0(px)? (#000|var\(--edge\))/.test(css2));
  tt('앰비언트 섀도우가 정의돼 있다',
     /--sh:0 4px 20px rgba\(0,0,0,\.03\)/.test(css2)
     && /--sh-lift:0 10px 30px rgba\(0,0,0,\.08\)/.test(css2));

  /* v23.9 — 자동 포커스 금지 · 네비 분리 · 재계산 CTA · 다크모드 차단 */
  tt('진입 시 자동 포커스 없음', !/setTimeout\(\(\)=>\s*\w*El?\.focus/.test(UI));
  tt('상단은 홈, 하단은 이전/다음',
     /id="homeBtn"/.test(css2) && /id="prevBtn"/.test(css2) && !/id="backBtn"/.test(css2));
  tt('재계산 CTA가 있다', /class="restart-cta"/.test(UI));

  /* ═══ v23.21 — 개방감 · 가로 2분할 · 세로선 폐기 · 카피 다이어트 ═══════════
     🔴 아래 검사는 전부 사보타주(값을 되돌린 사본)로 🔴가 뜨는지 확인했습니다(원칙 99). */

  /* 1. 개방감 — 폭을 먹던 것은 바깥 여백(이미 16px)이 아니라 카드 자신의 패딩이었습니다. */
  /* ⚠ 원칙 99 — @media(max-width:400px) 안의 .funnel{padding:22px 12px}가 소스에서 **먼저** 나옵니다.
     줄머리로 앵커하지 않으면 그쪽을 읽고 이 검사가 헛돕니다. 실제로 처음에 그렇게 잡혔습니다. */
  tt('바깥 여백이 16px 인셋', /\n\.funnel\{padding:24px 16px/.test(css2)
     && /\n\.result\{padding:0 16px/.test(css2));
  tt('카드 안쪽 여백이 20px', /--pad:20px/.test(css2));
  tt('질문 카드 안쪽 여백이 토큰을 쓴다', /\.funnel > \.q\{[^}]*padding:var\(--pad\)/.test(css2));
  /* 타이틀 시작점(brandPad+18) = 카드 글자 시작점(16+20). 어긋나면 첫 화면이 계단처럼 보입니다. */
  tt('타이틀과 카드 글자의 시작점이 맞는다', (()=>{
     const bp = (css2.match(/\n\.brand\{background:var\(--bg\);padding:\d+px (\d+)px/)||[])[1];
     const pad = (css2.match(/--pad:(\d+)px/)||[])[1];
     const gut = (css2.match(/\n\.funnel\{padding:\d+px (\d+)px/)||[])[1];
     return bp && pad && gut && (+bp + 18) === (+gut + +pad);
  })());

  /* 2. 하단 조작 버튼 — 세로 2단 → 가로 2분할 (35 : 65) */
  tt('되돌아가기 · 재계산이 가로 2분할이다',
     /\.restartrow\{display:flex/.test(css2)
     && /class="restartrow"/.test(UI));
  tt('가로 2분할 비율이 35 : 65다',
     /\.restartrow \.reedit-cta\{flex:35 1 0\}/.test(css2)
     && /\.restartrow \.restart-cta\{flex:65 1 0\}/.test(css2));
  tt('두 버튼 높이가 같다', /\.restartrow > button\{height:var\(--h-cta\)/.test(css2));
  /* 🔴 v23.26 — 같은 줄의 두 버튼은 글자 크기·굵기가 같아야 합니다. 위계는 「면」이 만듭니다. */
  tt('두 버튼 글자가 같다', (()=>{
     const g = sel => {
       const m = css2.match(new RegExp(sel+'\\{[^}]*font-size:var\\((--t\\d)\\)[^}]*font-weight:(\\d+)'));
       return m ? m[1]+'/'+m[2] : null;
     };
     const a=g('\\.reedit-cta'), b=g('\\.restart-cta');
     return a && b && a===b;
  })(), (css2.match(/\.reedit-cta\{[^}]*font-size:var\((--t\d)\)/)||[])[1]
      + ' vs ' + (css2.match(/\.restart-cta\{[^}]*font-size:var\((--t\d)\)/)||[])[1]);
  /* 왼쪽은 옅은 세컨더리, 오른쪽은 솔리드 프라이머리 — 둘이 같은 무게면 위계가 죽습니다. */
  tt('좌 세컨더리(흰 면) · 우 프라이머리(그린)로 갈린다',
     /\.reedit-cta\{[^}]*background:var\(--card\)/.test(css2)
     && /\.restart-cta\{[^}]*background:var\(--green\)/.test(css2));
  /* ⚠ 세컨더리 면을 --fill로 내리면 앱 배경(--bg)과 1.02:1이라 통째로 사라집니다(원칙 97). */
  tt('세컨더리 면이 앱 배경과 다른 값',
     !/\.reedit-cta\{[^}]*background:var\(--fill\)/.test(css2));

  /* 3. 시각적 노이즈 — 왼쪽 굵은 세로선(레거시 인용문 문법) 전면 폐기 */
  tt('안내 박스에 왼쪽 세로선이 없다', !/border-left/.test(css2));
  tt('결과 헤더의 이유 줄이 세로선 대신 면이다',
     !/\.rhead-why::before/.test(css2)
     && /\.rhead-why\{[^}]*background:var\(--ink-tint\)/.test(css2)
     && /\.rhead-why\.bad\{background:var\(--warn-tint\)/.test(css2));
  tt('초과 안내도 면으로 말한다', /\.overnote\{[^}]*background:var\(--warn-tint\)/.test(css2));
  /* ⚠ 세로선을 지운 만큼 「면」이 유일한 분리 근거가 된 자리입니다(원칙 101). 틴트를 지우면 안 됩니다. */
  tt('틴트 두 값이 정의돼 있다',
     /--warn-tint:rgba\(190,75,0,\.06\)/.test(css2) && /--ink-tint:rgba\(25,31,40,\.04\)/.test(css2));
  /* 틴트는 파생값입니다 — --warn을 바꾸고 틴트를 안 바꾸면 면과 글자의 색상이 어긋납니다. */
  tt('경고 틴트가 --warn에서 파생됐다', (()=>{
     const w = (css2.match(/--warn:\s*#([0-9A-Fa-f]{6})/)||[])[1];
     const t = (css2.match(/--warn-tint:rgba\((\d+),(\d+),(\d+)/)||[]).slice(1);
     if(!w || t.length!==3) return false;
     return [0,2,4].every((i,k)=> parseInt(w.substr(i,2),16) === +t[k]);
  })());

  /* 3-b. 탁한 흙색 → 순색. 채도(R - max(G,B))로 잽니다.
     이전 값 #A85510(83) · #7F2420(91)은 여기서 떨어집니다 — 그게 이 검사의 목적입니다. */
  /* 🔴 v23.26 — **채도에 상한도 겁니다.**
     v23.21은 하한(110)만 걸었습니다. 「탁한 밤색(83·91)」을 고치려고 만든 락인데,
     그 락 때문에 순색 레드(177)까지 갔고 이번엔 「네온」이라는 반대 지적을 받았습니다.
     한쪽만 막으면 다음 판에 반대편 끝으로 튑니다. **95 ≤ 채도 ≤ 150** 이 그 자리입니다.
       탁한 밤색 83·91 → 하한에서 걸림 / 네온 레드 177 → 상한에서 걸림
       현재 warn 115 · bad 107 → 둘 다 안쪽 */
  tt('주의 · 위험의 채도가 95~150이다', ['warn','bad'].every(n=>{
     const c=rgb(gv(n)); const sat=c[0]-Math.max(c[1],c[2]);
     return sat >= 95 && sat <= 150;
  }), ['warn','bad'].map(n=>{const c=rgb(gv(n));return n+'='+(c[0]-Math.max(c[1],c[2]))}).join(' / '));
  /* 위험은 주의보다 **어두워야** 합니다 — 밝기가 뒤집히면 사다리가 무너집니다. */
  tt('위험이 주의보다 어둡다 (다크 레드)', lumT(gv('bad')) < lumT(gv('warn')) * 0.75,
     lumT(gv('bad')).toFixed(4) + ' vs ' + lumT(gv('warn')).toFixed(4));
  tt('탁한 밤색 잔재 없음', !/#A85510|#7F2420|#C4837C|#B33A3A/i.test(css2));

  /* 4. 카피 다이어트 */
  /* 🔴 v24.6 — 이름과 실제가 어긋나 있던 자리입니다(원칙 99).
     「면책이 한 줄이다」라고 적고 `class="legal"` **개수**를 셌습니다. 개수는 1이라 늘 초록.
     실측하면 360 · 390 · 430px **전부 두 줄**이었고, 여섯 판 동안 아무도 못 봤습니다.
     인수인계 체크리스트 23번의 「한 줄인지」도 같은 착각이었습니다 — 「두 줄 이하」로 고쳤습니다.
     ⚠ 면책은 **문장을 줄이면 안 되는 글**입니다(정책대출 미반영·DSR 근거가 걸려 있음).
       줄일 수 있는 건 줄 수뿐이고, 두 줄이 그 하한입니다. 상한 판정은 G-18이 합니다. */
  tt('면책 블록이 하나다', (UI.match(/class="legal"/g)||[]).length === 1,
     (UI.match(/class="legal"/g)||[]).length + '개');
  /* 🔴 v24.6 — G-18이 면책까지 보고 있는지 소스에서 확인합니다(원칙 101).
     표에서 `.legal` 한 줄을 지우면 면책은 다시 아무도 안 보는 글이 됩니다. */
  /* 🔴 v24.6 — **되돌린 락입니다. 지우지 않고 방향을 뒤집어 다시 썼습니다**(지침 5층 3번).
     한때: 「다음 걸음 설명이 서술문이 아니다」 — 제목이 한 말을 설명이 되풀이한다고 보고
     서술을 걷어내 목적지 이름만 남겼습니다(네이버 부동산 / 국토교통부).
     되돌린 이유: 격자이기 때문입니다. 밖으로 나가는 위 두 칸에는 목적지가 남지만
     안에서 끝나는 아래 두 칸에는 남길 말이 없어 제목만 남고, 카드 높이는 행마다 같으므로
     **아래가 통째로 빈 자리**가 됩니다. 격자에서 빈 자리는 글자보다 더 눈에 띕니다.
     → 지금 락은 **네 칸이 모두 설명 줄을 가진다**는 쪽입니다. 다음 사람이 같은 판단으로
       또 지우는 것을 막습니다. 얇게 만들고 싶으면 문구가 아니라 패딩·높이를 건드리세요. */
  /* 🔴 v24.7 — 국토부 칸이 빠져 **세 칸**입니다. 2×2에 홀수를 넣으면 빈 자리가 남으므로
     네이버 칸을 **전폭**으로 올렸습니다(윗줄 1칸 · 아랫줄 2칸). v24.6에서 확인한 자리입니다.
     설명 줄은 세 칸 모두 유지합니다 — 지우면 그때처럼 빈 자리가 생깁니다. */
  /* 🔴 v24.22 — **락을 뒤집었습니다.** 위 v24.6 기록은 「지우면 아래 두 칸이 빈 자리가 된다」였고
     그건 **레이블을 그대로 둔 채 설명만 지웠을 때** 참이었습니다.
     v24.22는 레이블이 목적지·매체를 말하게 고치고 카드 높이를 118 → 88px로 같이 줄였습니다.
     → 이제 잠글 사실은 **「설명 줄이 없다」 + 「높이를 같이 줄였다」**입니다.
     ⚠ 설명을 다시 넣고 싶어지면 **레이블이 약하다는 신호**입니다. 레이블부터 고치세요. */
  tt('다음 걸음 네 칸에 설명 줄이 없다', (()=>{
     const bare = fs.readFileSync(FILE,'utf8').replace(/<!--[\s\S]*?-->/g,'');
     const m = bare.match(/<div class="minigrid">[\s\S]*?<\/div>\s*<\/div>/);
     if(!m) return false;
     const cards = m[0].match(/class="mini(?: [^"]*)?"/g)||[];
     return cards.length === 4
         && !/<\/b><span/.test(m[0])             /* 마크업에 설명 줄이 없다 */
         && !/outNaverS|outInteriorS/.test(bare)  /* JS가 다시 채우지도 않는다 */
         /* 🔴 v24.22 후반 — 높이는 **토큰으로만** 둡니다. 아래 별도 검사가 정확히 봅니다. */
         && true;
  })());
  /* 설명이 없어졌으므로 **레이블 넷이 서로 달라야** 고를 수 있습니다. */
  tt('다음 걸음 네 칸의 레이블이 서로 다르다', (()=>{
     const bare = fs.readFileSync(FILE,'utf8').replace(/<!--[\s\S]*?-->/g,'');
     /* ⚠ **격자 안으로 범위를 좁힙니다.** 처음엔 파일 전체를 봤다가 격자 밖의
        「이사 · 입주청소 견적 비교하기」까지 세어 다섯이 됐습니다. */
     const g = bare.match(/<div class="minigrid">[\s\S]*?<\/div>\s*<\/div>/);
     if(!g) return false;
     const stat = (g[0].match(/<b>([^<]+)<\/b>/g)||[]).map(x=>x.replace(/<\/?b>/g,''));
     const dyn  = (UI.match(/\$\('out(?:Naver|Hogang)T'\)\.textContent=`([^`]+)`/g)||[])
                    .map(x=>x.split('`')[1]);
     const all = stat.filter(x=>x.trim()).concat(dyn);
     return all.length === 4 && new Set(all).size === 4;
  })());

  tt('G-18이 면책 줄 수도 본다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     return /\['#result \.legal',2\]/.test(src) && /LINEMAX/.test(src);
  })());
  /* 🔴 v24.19 — 소스 문자열을 통째로 잠그고 있었습니다(원칙 48 — 2-6장에서 이미 세 번 걸린 형태).
     360px에서 세 줄이라 문장을 줄여야 하는데, 이 락이 「줄이면 빨개진다」로 막고 있었습니다.
     → **문장이 아니라 사실 넷을 잠급니다** — 추정치 · 정부 정책 · 은행 심사 · 한도와 세금. */
  tt('면책에 추정치 · 정책 · 은행 심사 · 한도와 세금이 모두 들어 있다', (()=>{
     const m = UI.match(/<span class="legal">([\s\S]*?)<\/span>/);
     if(!m) return false;
     const t = m[1];
     return /추정치/.test(t) && /정부 정책/.test(t) && /은행 심사/.test(t)
         && /한도/.test(t) && /세금/.test(t);
  })());
  /* 바로 위 조건 칩이 이미 지역을 말합니다. 2×2 칸에서 지역명이 두 줄을 만들었습니다. */
  tt('다음 걸음 문구에 지역명을 반복하지 않는다',
     !/\$\('outNaverT'\)\.textContent=`\$\{region\}/.test(UI)
     && !/\$\('outHogangT'\)\.textContent=`\$\{region\}/.test(UI));
  /* 작고 빽빽한 안내 문구의 행간 — 1.5는 13px 이하에서 붙어 읽힙니다. */
  tt('작은 안내 문구 행간이 1.6 이상', (()=>{
     /* ⏹ v24.22 — `.mini .txt span` 둘을 목록에서 뺐습니다. **설명 줄 자체가 없어졌습니다.**
        없는 셀렉터를 계속 세면 검사가 영원히 빨개지고, 그러면 검사를 지우게 됩니다. */
     const sel=['\\.readout\\{','\\.rhead-why\\{','\\.costrow \\.nm small\\{','\\.overnote\\{'];
     return sel.every(x=>{
       const m=css2.match(new RegExp(x+'[^}]*line-height:([\\d.]+)'));
       return m && +m[1] >= 1.6;
     });
  })());

  tt('다크모드 차단', /name="color-scheme" content="light"/.test(css2)
     && /:root\{[\s\S]{0,80}color-scheme:light/.test(css2));
  /* v23.14: 넓은 어두운 면을 걷어내고 라임을 액센트 면으로 씁니다. */
  /* v23.17 — 마이크로 컴포넌트 네이티브화 */
  tt('세그먼트 선택이 흰 면 + 그린 테두리',
     /\.seg button\.is-on\{background:var\(--card\);border-color:var\(--green\);color:var\(--ink\)/.test(css2));
  tt('세그먼트 선택에 안쪽 링이 없다',
     !/\.seg button\.is-on\{[^}]*inset 0 0 0/.test(css2)
     && !/\.seg button\.is-on\{[^}]*box-shadow:0 0 0/.test(css2));
  tt('체크박스가 직접 그려졌다 (appearance:none)',
     /\.subtoggle input\{[^}]*appearance:none/.test(css2)
     && /\.subtoggle input:checked::after/.test(css2));
  tt('accent-color 의존 없음', !/accent-color\s*:/.test(css2));
  /* ⚠ [\s\S]*? 는 규칙 밖까지 넘어갑니다. 규칙 안([^}]*)으로 가둡니다. */
  tt('스위치 손잡이가 전용 그림자',
     /\.sw::after\{[^}]*box-shadow:0 3px 8px/.test(css2)
     && !/\.sw::after\{[^}]*box-shadow:var\(--sh\)/.test(css2));
  tt('스위치 켜짐이 브랜드 그린', /\.sw\.on\{background:var\(--green\)\}/.test(css2));
  /* v23.20 — 손잡이는 흰 원 + 부드러운 그림자. 검은 테두리를 두르면 네이티브 느낌이 죽습니다. */
  tt('슬라이더 손잡이가 흰 원 + 그림자',
     /::-webkit-slider-thumb\{[^}]*background:var\(--card\);border:0/.test(css2)
     && /::-webkit-slider-thumb\{[^}]*box-shadow:0 3px 8px/.test(css2));

  /* v23.16 — 그린 브랜드 · 카드 분리 · 슬라이더 커스텀 */
  tt('세로선이 그린', /\.brand \.headline::before\{background:var\(--green\)/.test(css2));
  /* v23.18 — 흰 글자를 지키려고 배경 채도를 죽이던 타협을 뒤집었습니다.
     화사한 --green 면 + --espresso 글자 = 7.64:1 (이전 흰 글자 조합은 5.48:1). */
  tt('CTA가 화사한 그린 배경 + 잉크 글자',
     /\.cta\{[^}]*background:var\(--green\);color:var\(--espresso\)/.test(css2));
  tt('CTA 대비 ≥ 4.5:1', (()=>{
     const g=n=>((css2.match(new RegExp('--'+n+':\\s*(#[0-9A-Fa-f]{6})'))||[])[1]||'#000');
     const L=h=>{h=h.slice(1);const c=[0,2,4].map(i=>{let v=parseInt(h.substr(i,2),16)/255;
       return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2];};
     const a=L(g('green')), b=L(g('espresso'));
     return (Math.max(a,b)+.05)/(Math.min(a,b)+.05) >= 4.5;
  })());
  /* 🔴 v23.22 — 「더 짙은 그린」이 존재하지 않으므로 호버에서 색을 바꾸지 않습니다.
     밝기·그림자로만 반응합니다. 잉크 글자가 그대로라 7.64:1이 유지됩니다. */
  tt('CTA 호버가 색을 바꾸지 않는다',
     /\.cta:hover\{filter:brightness\(\.94\);box-shadow:var\(--sh-lift\)\}/.test(css2));
  /* 🔴 v23.22 — 히어로 금액을 잉크로 되돌렸습니다. 크기·굵기가 이미 위계입니다. */
  tt('금액 글자가 잉크다', /\.rhead-amount > span\{color:var\(--ink\)\}/.test(css2));
  tt('금액이 900 · 행간 1.1대',
     /\.rhead-amount\{[^}]*line-height:1\.1[^}]*font-weight:900/.test(css2));
  tt('배경이 쿨 그레이', /--bg:#F2F4F6/.test(css2));
  tt('카드가 퓨어 화이트', /--card:#FFFFFF/.test(css2));
  /* 누런 톤 잔재 — 웜 베이지 팔레트가 한 값이라도 살아 있으면 색이 섞입니다. */
  tt('웜 베이지 잔재 없음',
     !/#EAEADF|#F8F7F7|#DEDED2|#C9C9BC|#C6EF4E|#4D7C0F/i.test(css2));
  /* 🔴 v23.23 — `--fill`이 `--bg`와 **같은 값**(#F2F4F6)이 되었습니다(지시 반복 2회 후 반영).
     원칙 97의 정적 방어선은 여기서 끝납니다. 지금 이것이 성립하는 조건은 딱 하나 —
     **모든 --fill 면이 흰 카드 안에만 놓이는 것**이고, 그건 렌더된 면을 재는 **G-16**만 봅니다.
     정적으로는 「카드 면이 나머지 둘과 다른가」까지만 잠급니다. */
  tt('카드 면이 배경 · 입력면과 다른 값', (()=>{
     const g=n=>((css2.match(new RegExp('--'+n+':\\s*(#[0-9A-Fa-f]{6})'))||[])[1]||'').toUpperCase();
     const [bg,card,fill]=[g('bg'),g('card'),g('fill')];
     return bg && card && fill && card!==bg && card!==fill;
  })());
  tt('입력 면이 #F2F4F6이다', /--fill:#F2F4F6/.test(css2));
  /* --fill == --bg 이므로, 배경 위 호버에 --fill을 쓰면 아무 일도 일어나지 않습니다. */
  tt('배경 위 호버에 --fill을 쓰지 않는다',
     !/\.(iconbtn|arow|cta\.back|reedit-cta|mini\.amber):hover\{[^}]*background:var\(--fill\)/.test(css2));
  /* 🔴 G-15의 정적 축이 하나 줄었으므로, G-16이 살아 있는지를 소스에서도 확인합니다(원칙 101). */
  tt('G-16이 --fill 면 전체를 본다', /querySelectorAll\('\.mfield'\)/.test(fs.readFileSync(FILE,'utf8')));
  /* ⏹ 「카드에 테두리가 없다」는 v23.19에서 폐기했습니다 — 위 '카드가 하드 보더로 분리된다'로 대체. */
  tt('슬라이더가 커스텀되었다', /--fill-pct/.test(css2)
     && /::-webkit-slider-runnable-track/.test(css2));
  tt('02 링크 밑줄 없음', !/\.debtlink\{[^}]*text-decoration/.test(css2));
  tt('영수증 대출액이 블랙', /\.line\.minus \.v\{color:var\(--ink\)/.test(css2));
  /* 🔴 v23.22 — 선은 --line, 면은 --fill. 둘을 섞으면 팔레트를 바꿀 때 선만 따라오지 않습니다. */
  tt('면 토큰(--fill)을 선으로 쓰지 않는다',
     !/border(-top|-bottom|-left|-right)?:[^;{}]*var\(--fill\)/.test(css2));
  /* 독의 이전 버튼도 --fill이면 앱 배경과 1.02:1이라 사라집니다(원칙 97). */
  tt('독의 이전 버튼이 흰 면 + 헤어라인',
     /\.cta\.back\{[^}]*background:var\(--card\);border:1px solid var\(--line\)/.test(css2));
  tt('조건 칩도 헤어라인을 갖는다', /\.condchip\{[^}]*border:1px solid var\(--line\)/.test(css2));
  tt('죽은 규칙 .cta.ghost · .textbtn 없음', !/\.cta\.ghost\{|\n\.textbtn\{/.test(css2));
  /* 🔴 v23.24 — 「기준 반영」 한 줄을 ⓘ 버튼 + 바텀시트로 접었습니다(점진적 정보 공개).
     락을 지우지 않고 「회색 박스가 없고 가운데 정렬인가」를 감싸는 쪽(.trustwrap)에서 봅니다. */
  tt('하단 신뢰 지표가 회색 박스 없이 중앙 정렬',
     /\.trust\{[^}]*background:none/.test(css2)
     && /\.trustwrap\{text-align:center\}/.test(css2));

  /* ═══ v23.24 — 헤더 · 컴포넌트 3계층 · 바텀시트 ═══════════════════════ */

  /* 1. 헤더 — 아이콘 폐기, 워드마크가 홈 버튼 */
  tt('헤더에 아이콘이 없다',
     !/class="iconbtn"/.test(fs.readFileSync(FILE,'utf8'))
     && !/\.iconbtn\{/.test(css2));
  tt('워드마크가 홈 버튼이다',
     /<button class="wordmark" id="homeBtn"/.test(fs.readFileSync(FILE,'utf8')));
  tt('워드마크가 굵기 대비로 위계를 만든다', (()=>{
     const base = (css2.match(/\.wordmark\{[^}]*font-weight:(\d+)/)||[])[1];
     const b    = (css2.match(/\.wordmark b\{font-weight:(\d+)/)||[])[1];
     return base && b && +b - +base >= 300 && /\.wordmark\{[^}]*letter-spacing:-\.04em/.test(css2);
  })());

  /* 2. 컴포넌트 3계층 — 높이·글자 크기를 토큰으로 고정 */
  tt('3계층 높이 토큰이 정의돼 있다',
     /--h-cta:54px/.test(css2) && /--h-opt:46px/.test(css2) && /--h-chip:35px/.test(css2));
  tt('메인 CTA 3종이 같은 높이 토큰을 쓴다', ['\\.cta','\\.restart-cta','\\.reedit-cta']
     .every(x => new RegExp(x+'\\{[^}]*height:var\\(--h-cta\\)').test(css2)));
  tt('메인 CTA가 16px SemiBold다', ['\\.cta','\\.restart-cta'].every(x=>{
     const m = css2.match(new RegExp(x+'\\{[^}]*font-size:var\\(--t5\\)[^}]*font-weight:(\\d+)'));
     return m && +m[1] === 600;
  }));
  tt('옵션 버튼이 --h-opt · 14px이다',
     /\.chip\{[^}]*min-height:var\(--h-opt\)/.test(css2)
     && /\.chip\{[^}]*font-size:var\(--t6\)/.test(css2)
     && /\.seg button\{min-height:var\(--h-opt\)/.test(css2));
  tt('상태 칩이 --h-chip · 13px이다',
     /\.condchip\{[^}]*height:var\(--h-chip\)/.test(css2)
     && /\.condchip\{[^}]*font-size:var\(--t7\)/.test(css2)
     && /\.trust\{[^}]*height:var\(--h-chip\)/.test(css2));
  /* ⚠ 높이를 토큰 밖에서 새로 만들면 버튼이 네 종류가 됩니다. 하드코딩된 px 높이를 셉니다. */
  tt('버튼 높이를 px로 하드코딩한 곳이 없다', (()=>{
     const btn = css2.match(/\.(cta|restart-cta|reedit-cta|chip|seg button|condchip|trust|sheet-close)[^{]*\{[^}]*\}/g)||[];
     return !btn.some(r => /(^|[^-])height:\d+px/.test(r));
  })());
  /* 🔴 지침 — 폼 컨트롤은 16px 이상. 미만이면 iOS가 포커스 시 화면을 확대합니다. */
  /* 🔴 v24.7 — 화면에서 가장 큰 입력인 `.mfield input`은 clamp()라 아래 정규식에 안 걸려
     **통째로 건너뛰고 있었습니다**. 주석엔 「clamp()는 따로 봅니다」인데 그 검사가 없었습니다.
     첫 인자가 16px 미만이면 iOS가 포커스 때 화면을 확대합니다. */
  /* ⚠ 16px 규칙은 **폼 컨트롤에만** 적용됩니다(iOS는 input에 포커스할 때만 확대합니다).
     선택자에 input/textarea/select가 든 규칙만 봅니다 — 처음엔 전부 봐서 소제목까지 잡혔습니다. */
  const clampRules = [...css2.matchAll(/(^|\n)([^{}\n]*(?:input|textarea|select)[^{}\n]*)\{([^}]*)\}/g)]
    .map(m => [m[2].trim(), (m[3].match(/font-size:\s*clamp\(\s*([\d.]+)px/)||[])[1]])
    .filter(([sel, v]) => v !== undefined)
    .map(([sel, v]) => [sel, parseFloat(v)]);
  tt('clamp 입력도 16px 이상이다',
     clampRules.length > 0 && clampRules.every(([, v]) => v >= 16),   /* 대상 0개면 🔴 */
     clampRules.length ? clampRules.map(([sel,v]) => sel+' '+v+'px').join(' / ') : '대상 0개');
  tt('모든 텍스트 입력이 16px 이상이다', (()=>{
     const rules = css2.match(/[^{}]*input[^{}]*\{[^}]*font-size:[^;}]+/g)||[];
     const bad = rules.filter(r => {
       const m = r.match(/font-size:\s*var\((--t\d)\)/);
       if(!m) return false;                       /* clamp() 등은 따로 봅니다 */
       const px = +(css2.match(new RegExp(m[1]+':([\\d.]+)px'))||[])[1];
       return px < 16;
     });
     return bad.length === 0;
  })(), (css2.match(/[^{}]*input[^{}]*\{[^}]*font-size:[^;}]+/g)||[])
        .filter(r=>/var\(--t[67]\)/.test(r)).slice(0,2).join(' | '));
  /* 0.5px 단위는 지침이 금지합니다 — 12.5px이 스케일에 남아 있었습니다. */
  tt('타입 스케일에 0.5px 단위가 없다', !/--t\d:[\d]+\.5px/.test(css2));

  /* 3. 점진적 정보 공개 — ⓘ + 바텀시트 */
  /* 🔴 v24.7 — 「버튼이 있다」와 「버튼이 눌린다」는 다른 검사입니다(원칙 153).
     아래 셋은 마크업만 보고 있어 onclick을 지워도 전부 초록이었습니다. */
  tt('결과 ⓘ가 실제로 시트를 연다', /\$\('trustBtn'\)\.onclick[\s\S]{0,80}openSheet\(\)/.test(UI));
  tt('워드마크가 실제로 홈으로 간다', /\$\('homeBtn'\)\.onclick\s*=\s*goHome/.test(UI));
  tt('하단 CTA·이전 버튼에 핸들러가 있다',
     /\$\('ctaBtn'\)\.onclick/.test(UI) && /\$\('prevBtn'\)\.onclick/.test(UI));
  tt('계산 기준이 ⓘ 인디케이터로 접혔다',
     /id="trustBtn"/.test(fs.readFileSync(FILE,'utf8'))
     && /계산 기준 보기/.test(fs.readFileSync(FILE,'utf8'))
     && !/스트레스 DSR · 취득세 · 지방교육세 · 중개보수 상한요율 기준 반영/.test(UI));
  tt('바텀시트가 대화상자로 선언돼 있다',
     /id="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle"/.test(fs.readFileSync(FILE,'utf8')));
  /* ⚠ .app{overflow-x:clip}은 자손 fixed 요소를 가둡니다. 시트는 .app 밖에 있어야 합니다. */
  /* 🔴 v24.7 — indexOf -1 함정. dock 문자열이 안 잡히면 -1이라 **무엇이든 통과**했습니다.
     속성 순서만 바꿔도(class↔id) 시트를 .app 안에 넣는 사고가 그대로 지나갑니다. */
  tt('시트가 .app 밖에 있다', (()=>{
     const src = fs.readFileSync(FILE,'utf8').replace(/<!--[\s\S]*?-->/g,'');
     const a = src.indexOf('id="sheet"'), b = src.search(/<div[^>]*class="dock"/);
     return a >= 0 && b >= 0 && a > b;      /* 둘 다 존재해야 합니다 — -1 통과 금지 */
  })());
  tt('시트를 닫는 길이 셋이다 (닫기 · 배경 · ESC)',
     /sheetClose'\)\.onclick/.test(UI) && /sheetBack'\)\.onclick/.test(UI)
     && /e\.key==='Escape'[\s\S]{0,60}closeSheet\(\)/.test(UI));
  /* 시트가 닫힌 뒤 스크롤 잠금이 남으면 화면이 통째로 굳습니다. */
  tt('시트를 닫으면 스크롤 잠금이 풀린다',
     /closeSheet\(\)\{[\s\S]{0,300}documentElement\.style\.overflow=''/.test(UI));
  tt('시트가 스크롤 위치를 옮기지 않는다 (원칙 92)',
     !/openSheet\(\)\{[\s\S]{0,400}scrollTo/.test(UI)
     /* 🔴 v24.7 — 여기 있던 절은 **빈 문자열에 정규식을 걸고** 있어 언제나 참이었습니다.
        지우고, 실제로 재는 아래 두 절만 남깁니다. */
     && !/body\.style\.position\s*=/.test(UI));
  /* 🔴 v24.5 — 5 → **6항목**. 락을 지우지 않고 다시 씁니다(지침 5층 3번).
     늘어난 하나가 「소득 대비 대출 규제(DSR)」입니다.
     ⚠ 이 검사는 **개수만** 봅니다 — 무엇이 들어 있는지는 못 봅니다. 내용은 위쪽의
       「시트에 DSR 규칙 행이 있다」 · 「시트의 DSR 비율이 POLICY와 같다」가 봅니다(원칙 99). */
  /* 🔴 v24.24 — **개수 락을 버립니다.** 6 → 9가 됐는데, 다음에 늘 때 또 숫자를 고쳐야 합니다.
     숫자는 사실이 아니라 그때의 상태입니다(원칙 48 — 이번 세션에만 열넷을 이 이유로 다시 썼습니다).
     🔴 잠글 사실은 **「화면에서 쓰는 말을 시트가 설명하는가」**입니다.
        결과 화면이 「LTV가 한도를 정했어요」라고 말하는데 LTV 설명이 없던 것이 실제 구멍이었습니다.
     ⚠ 목록에 말을 더할 때는 **화면에 그 말이 실제로 있는지** 먼저 보세요.
       화면에 없는 말을 시트에 넣는 것은 검색을 노린 글자 채우기입니다 — 그건 이 검사가 못 막습니다. */
  tt('시트가 화면에서 쓰는 말을 전부 설명한다', (()=>{
     const raw = fs.readFileSync(FILE,'utf8');
     /* ⚠ 시트를 **여는 태그와 닫기 버튼 사이**로 정확히 자릅니다.
        처음엔 `</div>\s*</div>`로 끝을 잡았다가 **시트 밖까지 삼켜서**,
        LTV 행을 지운 사보타주가 통과했습니다 — 다른 곳의 LTV를 세고 있었습니다. */
     const a = raw.indexOf('<div class="sheet" id="sheet"');
     const b = raw.indexOf('id="sheetClose"', a);
     const sheet = (a < 0 || b < 0) ? '' : raw.slice(a, b).replace(/<!--[\s\S]*?-->/g,'');
     /* ⚠ **행 제목(<b>)만** 봅니다. 본문까지 세면 다른 행의 설명에 그 말이 스쳐 지나가도
        「설명이 있다」로 읽힙니다 — 실제로 「정부 상한」 설명 안의 'LTV' 때문에
        LTV 행을 통째로 지운 사보타주가 통과했습니다. */
     const titles = (sheet.match(/<b>([^<]+)<\/b>/g)||[]).join(' | ');
     const need = ['LTV','DSR','스트레스','취득세','중개보수','방공제','정부 상한','원리금균등'];
     return need.every(t => titles.includes(t))
         && (raw.match(/class="sheet-row"/g)||[]).length >= need.length;
  })(), (()=>{
     const raw = fs.readFileSync(FILE,'utf8');
     const a = raw.indexOf('<div class="sheet" id="sheet"');
     const b = raw.indexOf('id="sheetClose"', a);
     const sheet = (a < 0 || b < 0) ? '' : raw.slice(a, b).replace(/<!--[\s\S]*?-->/g,'');
     const titles = (sheet.match(/<b>([^<]+)<\/b>/g)||[]).join(' | ');
     return ['LTV','DSR','스트레스','취득세','중개보수','방공제','정부 상한','원리금균등']
              .filter(t => !titles.includes(t)).join(', ') || '없음';
  })());

  /* v23.15: 라임 → 핀테크 그린. 면·테두리와 글자 색을 나눕니다. */
  tt('핀테크 그린 복귀', /--green:#00CA71/.test(css2));
  /* 🔴 v23.22 — 원칙 102의 답을 「두 값」에서 「글자로는 안 쓴다」로 바꿨습니다.
     짙은 녹색(--green-ink)을 정의부터 지웠고, 그린은 면·선(선택·활성)에만 씁니다.
     락을 지우지 않고 **반대 방향으로** 다시 씁니다(지침 5층 3번). */
  /* ⚠ 주석에는 「--green-ink를 지웠다」는 기록을 남깁니다. 검사는 **정의와 사용**만 봅니다. */
  tt('그린 토큰이 단 하나다',
     /--green:#00CA71/.test(css2)
     && !/--green-ink\s*:/.test(css2)
     && !/var\(--green-ink\)/.test(fs.readFileSync(FILE,'utf8')));
  /* ⚠ 원칙 99 — `color:var(--green)`은 `border-color:var(--green)`도 잡습니다.
     경계를 안 붙이면 이 검사가 정반대로 헛돕니다. 실제로 처음에 그렇게 걸렸습니다. */
  tt('그린을 글자색으로 쓰지 않는다',
     (css2.match(/(?:^|[;{\s])color:var\(--green\)/gm)||[]).length === 0,
     (css2.match(/(?:^|[;{\s])color:var\(--green\)/gm)||[]).length + '곳');
  /* 그린이 실제로 「면·선」으로만 쓰이는가 — background / border / outline / 그림자
     🔴 v24.7 — 허용 목록이 **규칙보다 좁았습니다.** 규칙은 「면·선 전용」인데
       `border-color`만 허용해서 `border-bottom:1.5px solid var(--green)` 같은
       **명백한 선**이 🔴로 걸렸습니다. `border`로 넓힙니다.
       ⚠ `color:`는 여전히 막힙니다 — 접두가 `border`라 겹치지 않고,
         글자색은 바로 위 「그린을 글자색으로 쓰지 않는다」가 따로 봅니다. */
  const GREEN_OK = /^(background|border|outline|box-shadow|--fill-pct)/;
  tt('그린은 면 · 선으로만 쓰인다', (()=>{
     const uses = css2.match(/[a-z-]+:[^;{}]*var\(--green\)/g) || [];
     return uses.length > 0 && uses.every(u => GREEN_OK.test(u.trim()));
  })(), (css2.match(/[a-z-]+:[^;{}]*var\(--green\)/g)||[]).filter(u=>!GREEN_OK.test(u.trim())).join(' | ') || '전부 면·선');
  tt('라임 잔재 없음', !/--lime/.test(css2));
  tt('형광펜 하이라이트 삭제', !/linear-gradient\(to top, var\(--/.test(css2));
  /* v23.18 — 2px 안쪽 테두리 폐기. 선택 언어를 「흰 면 + 그린 글자 + 바깥 그림자」 하나로 통일합니다.
     ⚠ border를 0으로 지우면 미선택(1px hair)과 상자 크기가 어긋나 줄이 흔들립니다. */
  /* v23.20 — 선택 언어를 「흰 면 + 그린 글자 + 앰비언트 섀도우」로 되돌립니다.
     ⚠ border를 0으로 지우면 미선택(1px hair)과 상자 크기가 어긋나 줄이 흔들립니다(원칙 34). */
  /* 🔴 v23.22 전역 규칙 — 입력은 테두리 0, 선택 칩은 기본 --line / 활성 --green.
     ⚠ **두 상태의 테두리 폭이 같아야 합니다.** 굵어지면 상자가 커져 줄이 흔들립니다(원칙 34 · G-14). */
  tt('선택 칩이 흰 면 + 잉크 글자 + 그린 테두리',
     /\.chip\.is-on\{background:var\(--card\);color:var\(--ink\);border-color:var\(--green\)/.test(css2)
     && /\.chip\.is-on\{[^}]*box-shadow:var\(--sh-lift\)/.test(css2));
  tt('입력 필드는 테두리 0 · 회색 면',
     /\.mfield\{[^}]*background:var\(--fill\)/.test(css2)
     && /\.mfield\{[^}]*border:0/.test(css2));
  /* 포커스는 outline으로만 냅니다 — border를 키우면 필드가 커져 두 칸 그리드가 흔들립니다. */
  tt('입력 포커스가 레이아웃을 흔들지 않는다',
     /\.mfield:focus-within\{outline:2px solid var\(--green\);outline-offset:-2px\}/.test(css2)
     && !/\.mfield:focus-within\{[^}]*border/.test(css2));
  tt('선택 3종이 같은 테두리 문법을 쓴다', (()=>{
     const w = sel => (css2.match(new RegExp(sel+'\\{[^}]*border:([\\d.]+)px solid'))||[])[1];
     return ['\\.chip','\\.zonecard','\\.seg button'].every(x => w(x) === '1.5');
  })());
  tt('활성 상태는 테두리 색만 바꾼다', ['chip','zonecard','seg button'].every(n=>{
     const k = n==='seg button' ? '\\.seg button\\.is-on' : '\\.'+n+'\\.is-on';
     const m = css2.match(new RegExp(k+'\\{([^}]*)\\}'));
     return m && /border-color:var\(--green\)/.test(m[1]) && !/border:[\d.]+px/.test(m[1]);
  }));
  tt('선택 상태에 2px 안쪽 테두리가 없다',
     !/\.(chip|zonecard)\.is-on\{[^}]*border:2px/.test(css2));
  /* 🔴 v23.22 — 굵기를 바꾸면 글자가 넓어져 상자가 커집니다(칩에서 실측 +1.02px).
     테두리 폭만 보는 G-14는 못 잡습니다. 소스에서도 한 번 막습니다. */
  tt('선택해도 글자 굵기를 바꾸지 않는다',
     !/\.(chip|zonecard|seg button)[^{]*\.is-on[^{]*\{[^}]*font-weight/.test(css2));
  tt('지역 카드 선택도 같은 언어',
     /\.zonecard\.is-on\{background:var\(--card\);border-color:var\(--green\);box-shadow:var\(--sh-lift\)/.test(css2));
  /* 선택해도 테두리 두께는 변하지 않아야 합니다 — 굵어지면 상자가 커져 줄이 흔들립니다(원칙 34). */
  tt('선택 상태에 2px 테두리가 없다',
     !/\.(chip|zonecard)\.is-on\{[^}]*border:2px/.test(css2));
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

/* ═══ v24.18 — 말투 ═══════════════════════════════════════════════
   지침: 화면 문구는 **사실만 서술**합니다. 평가하거나 지시하지 않습니다.
   이 판 전에는 「~습니다」체가 아홉 자리에 흩어져 있었습니다 —
   히어로 부제 · 계산 기준 시트 여섯 행 · DSR 면책 · 인테리어 안내.
   시트를 열면 다른 제품으로 넘어온 것처럼 읽혔습니다. */
(function(){
  const raw = fs.readFileSync(FILE,'utf8');
  /* 화면에 실제로 나가는 부분만 남깁니다.
     제외 ① 주석(/* *​/ 과 //) ② <style> ③ __selfcheck(개발자 콘솔 전용)
          ④ .legal 한 줄 — **법적 고지는 문어체가 맞습니다.** 유일한 문어체라
            「여기부터 법적 문구」라는 신호로 작동합니다. 의도된 예외입니다. */
  let s = raw.replace(/\/\*[\s\S]*?\*\//g,'')
             .replace(/<!--[\s\S]*?-->/g,'')
             .replace(/<style>[\s\S]*?<\/style>/g,'')
             .replace(/\/\/[^\n'"`]*$/gm,'')
             .replace(/<span class="legal">[\s\S]*?<\/span>/g,'');
  /* __selfcheck는 **개발자 콘솔 전용**입니다 — 사용자가 볼 수 없어 말투 규칙 밖입니다.
     ⚠ 함수 하나가 아니라 그 뒤 검사 배열까지 전부 개발자용이라 통째로 잘라 냅니다. */
  const cut = s.search(/function __selfcheck|const R\s*=\s*\[/); if(cut > 0) s = s.slice(0, cut);
  /* 「다시 시도해 주세요」는 **실패 뒤 복구 안내**라 예외입니다 —
     사용자를 평가하거나 재무 판단을 지시하는 문장이 아닙니다. */
  s = s.replace(/다시 시도해 주세요/g,'');

  /* 🔴 「습니다」만 보면 **절반을 놓칩니다** — 합쇼체는 「-습니다」와 「-ㅂ니다」 둘입니다.
     「봅니다 · 달라집니다 · 계산합니다 · 뺍니다 · 기준입니다」가 전부 뒤쪽입니다.
     자모(ㅂ)는 정규식으로 못 집으므로 **「니다」로 끝나는 한글 어절**을 봅니다.
     ⚠ 「지니다 · 다니다」 같은 어간이 걸릴 수 있어 예외 목록을 둡니다 — 늘어나면 여기 적으세요. */
  const EXEMPT = /(지니다|다니다|아니다)$/;
  const formal = [...new Set(s.match(/[가-힣][가-힣 ,·()%]{0,45}(니다|십시오)/g) || [])]
    .filter(x => !EXEMPT.test(x.trim()));
  tt('화면 문구에 「~습니다」체가 없다 (.legal 제외)', formal.length === 0,
     formal.slice(0,4).join(' | '));

  const order = [...new Set(s.match(/[가-힣][가-힣 ,·()%]{0,45}(하세요|해 주세요|하십시오)/g) || [])];
  tt('화면 문구가 사용자에게 지시하지 않는다', order.length === 0,
     order.slice(0,4).join(' | '));

  /* 과잉 존대 — 이 파일에서 「원하시는」이 유일했습니다.
     시공 수준 설명 다섯 중 넷은 서술문인데 하나만 존대 지시문이었습니다. */
  tt('과잉 존대가 없다', !/원하시는|하시겠어요|주시겠어요/.test(s));

  /* 보유 상태 안내가 사용자가 고른 것과 다른 말을 하지 않습니다.
     선택지는 「1주택 이상」인데 안내는 「다주택자」였습니다 — 1주택자는 다주택자가 아닙니다. */
  tt('보유 안내가 「다주택자」로 단정하지 않는다', !/다주택자/.test(s));
})();

/* ═══ v24.17 — 공유 계열 ══════════════════════════════════════════
   실물 카톡 캡쳐(2026.08.12)로 **한 번의 이미지 저장이 세 덩어리를 보낸다**는 것이 확인됐습니다.
   ①이미지 ②요약 말풍선 ③링크 미리보기 카드. 셋 다 우리가 책임지는 표면입니다. */
(function(){
  const raw  = fs.readFileSync(FILE,'utf8');
  const src  = raw.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
  const head = (raw.match(/<head>([\s\S]*?)<\/head>/)||['',''])[1];

  /* ── og 태그 ────────────────────────────────
     없으면 카카오가 **자기 기본 문구**를 찍습니다 — 「여기를 눌러 링크를 확인하세요.」
     그것이 실물에서 나갔습니다. 우리 화면 어디에도 없는 문장입니다. */
  tt('og:title이 있다',       /property=["']og:title["']/.test(head));
  tt('og:description이 있다', /property=["']og:description["']/.test(head));
  tt('og:url이 있다',         /property=["']og:url["']/.test(head));
  /* 🔴 **이 검사는 og:image가 있으면 실패합니다.** 저장소에 이미지 파일이 없어
     경로를 적으면 404가 나고, 카카오는 그때 미리보기를 통째로 접습니다(지금보다 나빠집니다).
     실제로 이미지를 올린 뒤에 이 검사를 뒤집으세요 — 그때가 근거가 바뀌는 시점입니다. */
  tt('og:image는 아직 없다(이미지 파일이 없습니다)', !/property=["']og:image["']/.test(head));
  /* og 설명이 화면 말투를 따르는지 — 평가·지시·단정 금지 */
  tt('og 설명이 지시하거나 단정하지 않는다', (()=>{
     const m = head.match(/property=["']og:description["'][^>]*content=["']([^"']+)["']/);
     if(!m) return false;
     return !/하세요|해보세요|확인하세요|최고|완벽|무리/.test(m[1]);
  })(), (head.match(/property=["']og:description["'][^>]*content=["']([^"']+)["']/)||[])[1]);
  /* og:url은 서비스 주소와 같아야 합니다 — 다르면 미리보기가 엉뚱한 곳을 가리킵니다 */
  tt('og:url이 SERVICE_URL과 같다', (()=>{
     const og = (head.match(/property=["']og:url["'][^>]*content=["']([^"']+)["']/)||[])[1];
     const sv = (src.match(/SERVICE_URL\s*=\s*'([^']+)'/)||[])[1];
     return !!og && !!sv && og.replace(/\/$/,'') === sv.replace(/\/$/,'');
  })());

  /* ── 이미지와 텍스트가 같이 나갈 때 ────────────
     이미지가 이미 말한 것을 텍스트가 되풀이하면 안 됩니다.
     ⚠ 잠그는 것은 **문자열이 아니라 경로**입니다(원칙 48) — 문구는 고쳐도 됩니다. */
  tt('이미지 공유는 shareCaption을 보낸다',
     /navigator\.share\(\{files:\[file\],\s*text:shareCaption\(\)\}\)/.test(src));
  tt('이미지 공유가 열두 줄 요약을 다시 보내지 않는다',
     !/files:\[file\][^)]*summaryText\(\)/.test(src));
  /* 「요약 문구 보내기」는 이미지 없이 혼자 나갑니다 — 여기서는 열두 줄이 그대로여야 합니다 */
  tt('요약 문구 보내기는 summaryText를 그대로 보낸다',
     /navigator\.share\(\{text:txt\}\)/.test(src) && /txt\s*=\s*summaryText\(\)/.test(src));
  /* 캡션에는 금액이 없어야 합니다 — 이미지가 말하고, 이 캡션만 뜨는 경로는 없습니다 */
  tt('shareCaption이 금액을 담지 않는다', (()=>{
     const m = src.match(/function shareCaption\(\)\{([\s\S]*?)\n\}/);
     if(!m) return false;
     return !/headline|cashNeeded|mortgageLoan|formatWon|approxWon/.test(m[1]);
  })());
  tt('shareCaption이 서비스 주소를 나른다', (()=>{
     const m = src.match(/function shareCaption\(\)\{([\s\S]*?)\n\}/);
     return !!m && /SERVICE_URL/.test(m[1]);
  })());

  /* ── 채권 문장의 자리 ──────────────────────────
     비용을 대출 한도 옆에 두면 「한도를 깎는 무엇」으로 읽힙니다(원칙 53). */
  tt('채권 문장이 대출 한도 산출 기준에 없다', (()=>{
     const m = src.match(/\$\('limitTip'\)\.innerHTML([\s\S]*?);\n/);
     return !!m && !/국민주택채권/.test(m[1]);
  })());
  tt('채권 문장이 부대비용 패널에 있다', (()=>{
     const m = src.match(/\$\('costLead'\)\.innerHTML([\s\S]*?);\n/);
     return !!m && /국민주택채권/.test(m[1]);
  })());
  /* 🔴 **왜 안 넣었는지**를 말해야 합니다. 이유가 없으면 그냥 빠뜨린 것으로 읽힙니다(원칙 39). */
  tt('채권 문장이 못 넣은 이유를 함께 말한다', (()=>{
     const m = src.match(/\$\('costLead'\)\.innerHTML([\s\S]*?);\n/);
     return !!m && /달라져서|따라 달라/.test(m[1]);
  })());
  /* 금액을 추정해 넣으면 안 됩니다 — 시가표준액·할인율 둘 다 우리가 모릅니다 */
  tt('채권 매입비에 금액을 적지 않는다', (()=>{
     const m = src.match(/\$\('costLead'\)\.innerHTML([\s\S]*?);\n/);
     if(!m) return false;
     const tail = m[1].split('국민주택채권')[1] || '';
     return !/\d+\s*만원|\d+\s*백만/.test(tail);
  })());
})();

/* ═══ v24.19 — 🔴 템플릿 리터럴 안의 주석 ═════════════════════════
   v24.18은 첫 화면에 **주석을 그대로 찍어서** 배포됐습니다.

     h = eye + `<h2>…</h2>
       (슬래시-별) 🔴 v24.18 — 전: 「대출 없이 살 거예요」 … (별-슬래시)   ← 이 글자가 화면에 나갔습니다
       <label>…`

   슬래시-별 기호는 **문자열 안에서 주석이 아니라 글자**입니다.
   기존 검사 491개가 전부 초록이었습니다 — 계산은 멀쩡했고, 화면 문자열 검사도
   「~습니다」를 소스에서 찾다가 이 자리를 지나쳤습니다.
   __selfcheck()가 잡을 수 있었지만 **세 판 연속 안 돌렸습니다**(브라우저가 없었음).

   → 그래서 여기서 잡습니다. 브라우저 없이, 소스만으로.

   ⚠ 이 검사는 **자바스크립트를 한 글자씩 읽습니다.** 문자열 · 주석 · 정규식을
     구분해야 템플릿 리터럴의 「안」을 알 수 있습니다. 정규식은 앞 토큰으로 판별합니다.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const html = fs.readFileSync(FILE, 'utf8');
  const blocks = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g)];

  /* 템플릿 리터럴 안에 들어간 주석 기호를 모읍니다 */
  function leaks(src){
    const out = [];
    const tpl = [];              /* 템플릿 리터럴 중첩 스택 — ${ } 안에 또 리터럴이 옵니다 */
    let prev = '';               /* 직전 유효 문자 — 정규식이냐 나눗셈이냐를 가릅니다 */
    let i = 0;
    while (i < src.length) {
      const c = src[i], n = src[i+1];
      /* 🔴 템플릿 리터럴 「안」이 먼저입니다. 여기서는 주석도 문자열도 정규식도 없고,
         `${` 와 종료 백틱만 특별합니다. 이 순서를 바꾸면 검사가 스스로 주석을 먹습니다. */
      if (tpl.length && tpl[tpl.length-1] === 'tpl') {
        if (c === '\\') { i += 2; continue; }
        if (c === '`') { tpl.pop(); i++; prev = '`'; continue; }
        if (c === '$' && n === '{') { tpl.push('expr'); i += 2; prev = '{'; continue; }
        if ((c === '/' && n === '*') || (c === '*' && n === '/')) {
          out.push({ line: src.slice(0, i).split('\n').length,
                     text: src.slice(i, i+60).replace(/\s+/g, ' ') });
          i += 2; continue;
        }
        i++; continue;
      }
      if (c === '/' && n === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
      if (c === '/' && n === '*') { const e = src.indexOf('*/', i+2); i = e < 0 ? src.length : e+2; prev = ' '; continue; }
      if (c === '/' && !/[\w$)\]'"`]/.test(prev)) {      /* 정규식 리터럴 */
        i++; let cls = false;
        while (i < src.length) { const d = src[i];
          if (d === '\\') { i += 2; continue; }
          if (d === '[') cls = true; else if (d === ']') cls = false;
          else if (d === '/' && !cls) { i++; break; }
          else if (d === '\n') break;
          i++; }
        prev = '/'; continue;
      }
      if (c === "'" || c === '"') { const q = c; i++;
        while (i < src.length) { if (src[i] === '\\') { i += 2; continue; }
          if (src[i] === q || src[i] === '\n') { i++; break; } i++; }
        prev = q; continue;
      }
      if (c === '`') { tpl.push('tpl'); i++; prev = '`'; continue; }
      if (c === '}' && tpl.length && tpl[tpl.length-1] === 'expr') { tpl.pop(); i++; prev = '}'; continue; }
      if (!/\s/.test(c)) prev = c;
      i++;
    }
    return out;
  }

  const all = blocks.flatMap(m => {
    const base = html.slice(0, m.index + m[0].indexOf(m[1])).split('\n').length - 1;
    return leaks(m[1]).map(x => ({ line: base + x.line, text: x.text }));
  });
  tt('템플릿 리터럴 안에 주석 기호가 없다', all.length === 0,
     all.map(x => x.line + '행 ' + x.text).join(' / '));

  /* 사보타주 — 검사가 실제로 무는지 확인합니다. 안 물면 없는 검사입니다(원칙 48). */
  tt('사보타주: 리터럴 안 주석을 심으면 잡는다',
     leaks('const h = `<p>가</p>\n  /* 설명 */\n  <b>나</b>`;').length > 0);
  tt('사보타주: 리터럴 밖 주석은 안 잡는다',
     leaks('/* 설명 */\nconst h = `<p>가</p>`;\nconst r = /a\\/*b/;').length === 0);
  tt('사보타주: ${} 안의 주석은 안 잡는다',
     leaks('const h = `<p>${ /* 계산 */ 1 + 2 }</p>`;').length === 0);
})();

/* ═══ v24.20 — 문구가 확정을 말하지 않는가 ════════════════════════
   「매달 갚는 돈 301만원」은 **확정된 사실처럼** 읽혔습니다.
   금리(연 5.4%)도 기간(30년)도 우리가 둔 가정이고 은행·신용도마다 다릅니다.
   → 현재형을 미래형으로 돌리고, 가정을 화면에 적습니다(원칙 28 · 39).
   ═══════════════════════════════════════════════════════════════ */
(() => {
  /* ⚠ **주석을 걷어낸 소스**로 봅니다. 지운 문구·바꾼 문구는 「왜 그랬는지」로 코드 주석에 남습니다. */
  const BARE = UI.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  tt('월 상환 타일이 확정형이 아니다',
     /class="tile-k">매달 갚을 원리금</.test(UI0()) && !/class="tile-k">매달 갚는 돈</.test(UI0()));
  /* 사보타주 — 주석 제거가 실제로 동작하는지. 안 되면 위 검사 넷이 전부 헛됩니다.
     ⚠ 본체 문자열에 기대지 않습니다 — 그러면 문구를 바꿀 때마다 이 검사가 같이 흔들립니다. */
  tt('사보타주: 주석 제거가 실제로 동작한다', (()=>{
     const strip = t => t.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
     return strip('A/* 지운 문구 */B\n// 줄 주석\nC').replace(/\s/g,'') === 'ABC';
  })());
  /* 🔴 v24.23 — 이 검사는 **문장을 통째로** 잠그고 있었습니다(원칙 48).
     금리가 슬라이더로 움직이게 되면서 부속 줄에서 금리를 뺐고 — 두 곳에 같은 값을 적으면
     슬라이더를 움직였을 때 한쪽이 거짓이 됩니다(원칙 91) — 검사가 그 개선을 막았습니다.
     잠글 사실은 **「확정처럼 말하지 않는가」**입니다. 어느 문장이냐가 아닙니다. */
  tt('월 상환 타일이 가정임을 말한다', (()=>{
     const m = UI.match(/tileMonthlySub'\)\.textContent = m>0 \? `([^`]+)`/);
     return !!m && /가정/.test(m[1]) && /\$\{D\.years\}년/.test(m[1]);
  })(), (()=>{ const m=UI.match(/tileMonthlySub'\)\.textContent = m>0 \? `([^`]+)`/);
     return m ? m[1] : '없음'; })());
  /* 🔴 금리가 부속 줄과 슬라이더 **양쪽에** 있으면 안 됩니다 — 움직이면 한쪽이 거짓이 됩니다. */
  tt('금리를 두 곳에서 말하지 않는다', (()=>{
     const m = UI.match(/tileMonthlySub'\)\.textContent = m>0 \? `([^`]+)`/);
     return !!m && !/연 |D\.rate/.test(m[1]);
  })());
  /* 🔴 v24.21 — 이 검사는 전에 `/· 매달 갚을 원리금 /`로 **요약 문구의 문장을 잠그고 있었습니다.**
     v24.21에서 그 줄을 의도적으로 뺐고, 검사가 정당한 개선을 막았습니다 — 원칙 48의 사례입니다.
     잠글 사실은 「같은 문장이 있는가」가 아니라 **「이름이 갈리지 않는가」**입니다.
     → 화면 타일이 「매달 갚을 원리금」인 동안 요약 문구가 **다른 이름**을 쓰지 않는지만 봅니다.
       (요약 문구에 그 줄이 아예 없는 것은 통과입니다. 있는데 이름이 다르면 실패합니다.) */
  tt('요약 문구가 월 상환에 다른 이름을 쓰지 않는다',
     !/매달 갚는 돈|월 상환액|월 납입금/.test(sumBody()));

  /* ── 입력 03 — 지역 ────────────────────────────
     설명 줄을 지웠으므로 **구를 고르면 뜨는 안내가 세 갈래 전부 살아 있어야** 합니다.
     하나라도 비면 그 지역을 고른 사람은 아무 설명도 못 받습니다. */
  tt('지역 안내가 세 갈래 전부 있다', (()=>{
     const m = UI.match(/function regionPane\(\)[\s\S]*?\n\}/);
     if(!m) return false;
     return /규제지역이에요/.test(m[0]) && /수도권이에요/.test(m[0]) && /수도권 밖이에요/.test(m[0]);
  })());
  /* 지운 줄이 되살아나면 「지역마다」가 서울 안을 가리키는지 밖을 가리키는지 다시 모호해집니다.
     ⚠ 위에서 만든 BARE를 씁니다 — 지운 문구가 주석에 남아 있어서 원본으로 보면 못 잡습니다
       (v24.20에서 실제로 이 함정에 한 번 걸렸습니다). */
  tt('지역 단계에 일반론 설명 줄이 없다', !/지역마다 빌릴 수 있는 돈과 세금이 달라요/.test(BARE));
  tt('지역 단계 제목이 대상을 묻는다',
     /q-title">어느 지역을 알아보고 계세요\?/.test(BARE) && !/어디에서 찾고 계세요/.test(BARE));

  /* ── 네이버 칸 ────────────────────────────────
     🔴 목적지가 매물 목록이 아닙니다(개인화 「MY」 화면). 이름이 그걸 약속하면 안 됩니다. */
  tt('네이버 칸이 매물 목록을 약속하지 않는다',
     !/outNaverT'\)\.textContent=`[^`]*매물/.test(BARE));
  /* 🔴 v24.22 — 설명 줄이 사라졌으므로 **약속을 못 하게** 막는 쪽으로 바꿉니다.
     예산 조건은 실제로 안 넘어갑니다. 설명으로 그걸 적을 자리가 없어졌으니,
     레이블이 **목적지 이름 하나**여야 합니다 — 여는 것 외에 아무것도 약속하지 않게.
     ⚠ 「N억대 추천 단지 보기」(v24.19에서 지운 것)로 다시 가는 것을 막습니다. */
  tt('네이버 칸이 목적지 이름만 말한다', (()=>{
     const m = UI.match(/\$\('outNaverT'\)\.textContent=`([^`]+)`/);
     if(!m) return false;
     const t = m[1];
     /* 🔴 v24.22 후반 — 전폭이 되어 자리가 생겼으므로 **동사를 되돌렸습니다.**
        판 앞부분에서 「화살표가 이미 하는 말」이라며 뗐는데, **그 전제가 틀렸습니다** —
        만든 사람조차 ↓·⧉를 못 읽었습니다. 아이콘에 뜻을 맡기지 않습니다.
        ⚠ 잠글 것은 여전히 **약속을 안 한다**는 쪽입니다. 「열기」는 여는 것만 약속합니다. */
     return /^네이버 부동산( 열기)?$/.test(t)
         && !/추천|단지|예산|매물|억대|내 조건|보기/.test(t);
  })());
})();

/* ═══ v24.21 — 이름 통일 · 공유물의 설명 · 지역 칩 잘림 ═══════════
   ① 같은 값이 네 자리에서 세 이름으로 불렸고, 그중 둘은 한 번의 공유로 같이 나갑니다(원칙 91).
   ② 밖으로 나가는 둘에 「왜 가진 돈보다 큰가」의 답이 없었습니다.
   ③ 지역 칩의 말줄임이 CSS 구조 때문에 **한 번도 돈 적이 없습니다.**
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const BARE = UI.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const M = UI0().replace(/\/\*[\s\S]*?\*\//g,'');

  /* ── ① 이름 하나 (원칙 91) ─────────────────────
     금액이 **붙는** 자리 셋을 봅니다. 화면 자금 구성은 비율만 찍지만,
     같은 막대 그림이 카드에도 있어 이름이 갈리면 「다른 값인가」가 됩니다. */
  tt('영수증 합계가 「준비할 현금」이다',
     /row\('준비할 현금',/.test(BARE) && !/내가 준비할 현금/.test(BARE));
  tt('공유 카드가 「준비할 현금」이다',
     /mixRow\('d1','준비할 현금'/.test(repBody()));
  tt('공유 카드에 「내 돈」이 없다', !/'내 돈'|내 돈 /.test(repBody()));
  /* ── 공유 카드가 재산을 흘리지 않는다 ────────────
     🔴 v24.15 주석은 이 막대의 근거로 「비율이라서 **재산이 역산되지 않습니다**」를 적어 뒀는데
        같은 판에서 괄호로 금액을 찍었습니다. 실물에서 가진 돈 10억이 「(10억원)」으로 그대로 나갔습니다 —
        인테리어를 안 켜면 준비할 현금 = 가진 돈입니다. 그림은 저장돼 재전달됩니다.
     ⚠ 헤드라인(매수 가능 금액)은 남습니다 — 그건 집값이지 재산이 아닙니다. */
  tt('공유 카드가 현금·대출 금액을 찍지 않는다', (()=>{
     const b = repBody();
     /* 금액을 그리는 길은 헤드라인 하나뿐이어야 합니다. */
     return !/formatWon\(/.test(b)
         && (b.match(/richWon\(/g)||[]).length === 1
         && /richWon\(approx\(headline\)\)/.test(b);
  })());
  tt('mixRow가 금액 인자를 받지 않는다',
     /const mixRow = \(dot, name, pct\) =>/.test(repBody()));
  /* ⚠ 요약 문구(텍스트)에는 금액을 **남깁니다.** 매체가 다르면 판단도 갈립니다 —
     그림은 재전달되지만 텍스트는 보내기 전에 본인이 읽습니다. 여기서 같이 지우면 과잉입니다. */
  tt('요약 문구에는 금액이 남아 있다',
     /준비할 현금 \$\{formatWon/.test(sumBody()));
  /* v24.15에서 쓰는 곳이 없어진 계산이 남아 있었습니다(원칙 47). */
  tt('공유 카드에 죽은 월 상환 계산이 없다', !/monthlyPaymentCalc/.test(repBody()));
  tt('화면 자금 구성도 같은 이름을 쓴다', /준비할 현금 <b>\$\{ownPct\}%/.test(BARE));
  /* 대출이 없을 때도 이름이 갈리면 안 됩니다 — 「전부 내 돈」은 예전 이름입니다. */
  tt('대출 없을 때도 「내 돈」으로 돌아가지 않는다', !/전부 내 돈/.test(BARE));

  /* ── ② 공유물이 구성을 설명한다 ─────────────────
     🔴 한 함수를 둘이 나눠 씁니다. 두 벌로 두면 반드시 어긋납니다(원칙 58). */
  tt('cashNote가 하나뿐이다', (BARE.match(/function cashNote\(/g)||[]).length === 1);
  tt('공유 카드가 cashNote를 쓴다', /cashNote\(c\)/.test(repBody()));
  tt('요약 문구가 cashNote를 쓴다', /cashNote\(c\)/.test(sumBody()));
  /* 🔴 각주 앞에 빈 줄이 있어야 합니다. 실물에서 불릿 두 개에 바로 붙어 **세 번째 불릿처럼**
     보였습니다. 이 줄은 항목이 아니라 위 두 줄에 대한 각주입니다. */
  tt('요약 문구에서 각주가 불릿과 붙지 않는다',
     /L\.push\(''\);\s*\n\s*L\.push\(cashNote\(c\)\);/.test(sumBody()));
  /* 🔴 구분자가 가운뎃점이면 「법무사 · 등기비」가 두 항목으로 읽힙니다(v24.16 함정). */
  tt('cashNote가 쉼표로 잇는다', /p\.join\(', '\)/.test(BARE));
  /* 켠 것만 셉니다 — 안 켠 항목을 적으면 영수증과 어긋납니다. */
  tt('cashNote가 켠 항목만 센다',
     /S\.legal\.on/.test(BARE) && /S\.move\.on/.test(BARE) && /S\.appl\.on/.test(BARE)
     && /c\.interiorCost > 0/.test(BARE));

  /* ── ③ 요약 문구에서 월 상환을 뺐다 ─────────────
     ⚠ 화면 타일은 **살아 있어야** 합니다. 뺀 것은 밖으로 나가는 텍스트뿐입니다. */
  tt('요약 문구에 월 상환 줄이 없다', !/원리금/.test(sumBody()));
  tt('요약 문구가 월 상환을 계산하지도 않는다', !/monthlyPaymentCalc/.test(sumBody()));
  tt('화면 월 상환 타일은 그대로 있다', /class="tile-k">매달 갚을 원리금</.test(M));

  /* ── ④ 지역 칩 — 말줄임이 실제로 걸리는가 ────────
     🔴 `text-overflow`를 flex **컨테이너**에 걸면 아무 일도 안 일어납니다.
        글자가 익명 flex 아이템이 되기 때문입니다. 실물에서 「ㅕ기 고양시 일산동ㄱ」로 양끝이 잘렸습니다. */
  tt('말줄임이 flex 아이템에 걸려 있다', /\.taggrid \.chip>span\{[^}]*text-overflow:ellipsis/.test(M));
  tt('말줄임 대상이 줄어들 수 있다', /\.taggrid \.chip>span\{[^}]*min-width:0/.test(M));
  tt('tagGrid가 글자를 span으로 감싼다', /data-sgg="\$\{c\}"><span>\$\{nm\}<\/span>/.test(BARE));
  /* ── 열 수는 목록이 정합니다 ────────────────────
     🔴 처음에 「경기·인천만 2열」로 하드코딩했다가 같은 결함이 있는 시·도 **여섯 곳**을 놓쳤습니다.
        그래서 지역 이름이 아니라 **이름 길이**를 검사합니다 — 데이터가 늘어도 같이 삽니다. */
  tt('긴 이름 목록이 2열로 간다', /\.taggrid\.wide\{grid-template-columns:repeat\(2,1fr\)\}/.test(M));
  /* 🔴 v24.21 — **본체의 tagGrid를 실제로 돌립니다.**
     처음에는 이 검사가 판정 규칙을 test.js 안에 다시 구현해서 LAWD에 물어봤습니다.
     사보타주로 본체를 `const wide = false && list.some(...)`로 망가뜨렸더니 **검사가 통과했습니다** —
     자기 복사본을 돌리고 있었으니 본체가 어떻게 되든 알 수가 없습니다(원칙 58을 검사 쪽에서 어긴 것).
     → 규칙을 베끼지 않고 **본체 함수를 떼어다 실행해** 결과 HTML에 wide가 붙는지 봅니다. */
  tt('본체 tagGrid가 실제 목록에서 열 수를 갈라 준다', (()=>{
     const src = BARE.match(/const TAG_WIDE = \d+;[\s\S]*?const tagGrid = list => \{[\s\S]*?\n\};/);
     const raw = fs.readFileSync(FILE,'utf8');
     const lw  = raw.match(/const LAWD\s*=\s*\{[\s\S]*?\n\};/);
     const ss  = raw.match(/const SIDO_SHORT\s*=\s*\{[\s\S]*?\};/);
     if(!src || !lw || !ss) return false;
     const r = new Function(`const S={sgg:''};\n${lw[0]}\n${ss[0]}\n${src[0]}
       const short = s => SIDO_SHORT[s] || s;
       return {
         seoul: tagGrid(LAWD['서울특별시']),
         metro: tagGrid(['경기도','인천광역시'].flatMap(s =>
                  LAWD[s].map(x => [x[0], short(s)+' '+x[1]]))),
         gn:    tagGrid(LAWD['경상남도']),
         gw:    tagGrid(LAWD['강원특별자치도'])
       };`)();
     const W = h => /class="taggrid wide"/.test(h);
     return !W(r.seoul)   /* 서울 최장 「동대문구」 4자 — 3열이어야 합니다 */
         &&  W(r.metro)   /* 「경기 고양시 일산동구」 9자 — 2열 */
         &&  W(r.gn)      /* 「창원시 마산합포구」 8자 — 처음에 놓쳤던 자리 */
         && !W(r.gw);     /* 강원 최장 「춘천시」 3자 — 3열 */
  })());
  /* 판정을 통째로 꺼 버리는 사보타주는 위 검사가 잡습니다. 아래는 **규칙의 모양**만 봅니다. */
  tt('열 수를 지역 이름으로 하드코딩하지 않는다', (()=>{
     const m = BARE.match(/const tagGrid = list =>[\s\S]*?\n\};/);
     if(!m) return false;
     return /list\.some\(/.test(m[0]) && !/METRO|SEOUL|'경기'|'인천'/.test(m[0]);
  })());
  /* 접두어를 지우면 「중구 · 동구 · 서구」가 서울 자치구와 구별이 안 됩니다. */
  tt('시 · 도 접두어를 지우지 않았다', /shortSido\(s\)\+' '\+x\[1\]/.test(BARE));
  /* 2열은 좌우 여백을 줄여 글자에 3px을 줍니다 — 360px에서 최장 이름이 여기서 갈립니다. */
  tt('2열 칩이 여백을 줄여 글자 자리를 낸다', /\.taggrid\.wide \.chip\{padding:0 6px\}/.test(M));

  /* ── ⑤ 실거래 헤더가 잘린 것을 말한다 ────────────
     실물에서 「147건」이라 해 놓고 다섯 줄만 보여 줬습니다 — 3.4%입니다. */
  tt('실거래 헤더가 몇 곳을 보여 주는지 말한다',
     /total > shown \? ` 중 \$\{shown\}곳` : ''/.test(BARE));
  tt('잘린 게 없으면 「중 N곳」을 안 붙인다', /total > shown \?/.test(BARE));

  /* ── ⑥ 다음 걸음 — ⏹ v24.22에서 **설명 줄을 전부 지웠습니다** ─────
     ⏹ v24.21은 두 칸의 설명을 「고르는 데 도움이 되도록」 다시 썼고, 그 검사 넷이 여기 있었습니다.
       v24.22에서 지시로 설명 줄을 없앴고, **레이블이 그 말을 하도록** 옮겼습니다.
     → 옛 검사 넷은 「설명 줄이 없다」·「레이블이 서로 다르다」로 옮겨 갔습니다(위 v24.6 락 자리).
       여기서는 **되돌아오는 것**만 막습니다 — 옛 문구가 다시 나타나면 🔴. */
  tt('지운 설명 문구가 되돌아오지 않는다',
     !/그림 한 장에 담겨요/.test(M) && !/글자로 보내거나 복사해요/.test(M)
     && !/메신저와 SNS 어디든/.test(M) && !/카톡·문자로 바로 보내거나/.test(M)
     && !/국토교통부 실거래가 공개시스템에서 확인해요/.test(M)
     && !/같은 평형 포트폴리오를 모아서 봐요/.test(M));
  /* 🔴 v24.22 후반 — **아이콘에 뜻을 맡기지 않습니다.**
     ⏹ 판 앞부분의 락은 정반대였습니다 — 「바로가기·확인하기는 화살표가 이미 하는 말이니 떼라」.
       **전제가 틀렸습니다.** 만든 사람이 「↓·⧉가 무슨 뜻이냐」고 물었습니다.
       프로젝트를 다 아는 사람이 못 읽으면 처음 온 사람은 확실히 못 읽습니다.
     → 네 레이블이 **전부 동사로 끝나야** 합니다. 화살표는 거들 뿐입니다.
     ⚠ 전폭이라 자리가 있습니다. 반칸으로 돌아가면 이 조건부터 깨집니다. */
  tt('네 레이블이 모두 동작을 말한다', (()=>{
     const bare = fs.readFileSync(FILE,'utf8').replace(/<!--[\s\S]*?-->/g,'');
     const g = bare.match(/<div class="minigrid">[\s\S]*?<\/div>\s*<\/div>/);
     if(!g) return false;
     const stat = (g[0].match(/<b>([^<]+)<\/b>/g)||[]).map(x=>x.replace(/<\/?b>/g,'').trim());
     const dyn  = (UI.match(/\$\('out(?:Naver|Hogang)T'\)\.textContent=`([^`]+)`/g)||[])
                    .map(x=>x.split('`')[1].trim());
     const all = stat.filter(Boolean).concat(dyn);
     return all.length === 4 && all.every(t => /(열기|저장|보내기)$/.test(t));
  })(), (()=>{ const bare=fs.readFileSync(FILE,'utf8').replace(/<!--[\s\S]*?-->/g,'');
     const g=bare.match(/<div class="minigrid">[\s\S]*?<\/div>\s*<\/div>/);
     return g ? (g[0].match(/<b>[^<]+<\/b>/g)||[]).join(' · ') : '없음'; })());
})();

/* ═══ v24.22 — 제미나이 피드백 반영 (커서 · 문구 · 평형 · 설명 줄 · NaN) ═══
   ⚠ 열둘 중 넷은 이미 되어 있었고 둘은 사실이 틀렸습니다. 여기 있는 것은 **실제로 고친 것**뿐입니다.
   ═══════════════════════════════════════════════════════════════════════ */
(() => {
  const BARE = UI.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const M = UI0().replace(/\/\*[\s\S]*?\*\//g,'');

  /* ── #12 NaN · Infinity — 표시 함수가 최후의 관문입니다 ──
     🔴 입구를 다 막아도 표시 함수에 가드가 없으면 「NaN만원」이 그대로 찍힙니다.
        그리고 `loan <= 0`류의 **비교는 NaN을 못 거릅니다**(NaN과의 비교는 전부 false).
     ⚠ 이 셋은 **엔진 쪽**이라 `UI`(BUILD 줄 뒤)에 없습니다. 소스를 뒤지지 말고
       `E`가 이미 들고 있는 **본체 함수를 그대로 호출**합니다 — 훨씬 강한 검사입니다. */
  tt('formatWon이 NaN·Infinity를 화면에 안 내보낸다',
     !/NaN|∞|Infinity|undefined/.test(
       E.formatWon(NaN) + '|' + E.formatWon(Infinity) + '|' + E.formatWon(-Infinity)
       + '|' + E.formatWon(undefined) + '|' + E.formatWon(null)),
     () => [NaN, Infinity, undefined].map(v => E.formatWon(v)).join(' / '));
  tt('formatWon이 정상값은 그대로 낸다', E.formatWon(1476469668) === '14억 7,647만원',
     () => E.formatWon(1476469668));
  tt('월 상환 계산이 세 인자 어느 것이 NaN이어도 0을 낸다',
     E.monthlyPaymentCalc(NaN, 5.4, 30) === 0
     && E.monthlyPaymentCalc(1e8, NaN, 30) === 0
     && E.monthlyPaymentCalc(1e8, 5.4, NaN) === 0);
  tt('월 상환 계산이 Infinity 결과를 안 낸다', (()=>{
     const vals = [E.monthlyPaymentCalc(Infinity, 5.4, 30),
                   E.monthlyPaymentCalc(1e8, Infinity, 30),
                   E.monthlyPaymentCalc(1e8, 5.4, Infinity),
                   E.monthlyPaymentCalc(1e8, 5.4, 0),
                   E.monthlyPaymentCalc(0, 5.4, 30)];
     return vals.every(Number.isFinite);
  })(), () => [Infinity,5.4,30].join());
  /* 🔴 **입구 가드만으로는 못 막는 경우**입니다 — 인자가 전부 유한한데 결과가 NaN이 됩니다.
     금리가 아주 크면 `Math.pow(1+r, n)`이 Infinity가 되고 `∞/∞`는 NaN입니다.
     ⚠ 이 검사를 넣기 전에는 **출구 가드를 지워도 552개가 전부 초록이었습니다** —
       두 가드가 서로를 덮어 사보타주가 관측되지 않았습니다. 관측되는 입력을 찾아야 검사입니다. */
  tt('유한한 인자에서도 결과가 NaN이 되는 구간을 막는다',
     Number.isFinite(E.monthlyPaymentCalc(1e8, 1e10, 30)),
     () => String(E.monthlyPaymentCalc(1e8, 1e10, 30)));
  /* 🔴 비교 가드만으로는 NaN이 새 나갑니다(NaN과의 비교는 전부 false).
     ⚠ 함수마다 **어느 자리에** isFinite가 있는지까지 봅니다. 「어딘가에 하나 있다」로 보면
       입구를 지워도 출구가 남아 통과합니다 — 실제로 그렇게 새 나갔습니다. */
  tt('가드가 비교가 아니라 isFinite다', (()=>{
     const src = fs.readFileSync(FILE,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
     const f = src.match(/function formatWon\(n\)\{[\s\S]*?\n\}/);
     const m = src.match(/function monthlyPaymentCalc\([\s\S]*?\n\}/);
     const a = src.match(/function approx\(won\)\{[\s\S]*?\n\}/);
     if(!f || !m || !a) return false;
     return /Number\.isFinite\(n\)/.test(f[0])
         && /Number\.isFinite\(won\)/.test(a[0])
         && /Number\.isFinite\(loan\)/.test(m[0])      /* 입구 */
         && /Number\.isFinite\(out\)/.test(m[0]);      /* 출구 */
  })());

  /* ── #3 캐럿 ──────────────────────────────
     🔴 억 필드가 `.value`에 직접 써서, 값이 정리되는 순간 캐럿이 끝으로 튀었습니다. */
  tt('캐럿 복원 로직을 실제로 돌려 확인한다', (()=>{
     const m = BARE.match(/function setMaskedValue\(el, next, isKeep\)\{[\s\S]*?\n\}/);
     const d = BARE.match(/const isDigit\s+= ch =>[^\n]*\n/);
     if(!m || !d) return false;
     /* ⚠ 이 함수는 `document.activeElement`를 봅니다. node에는 document가 없으므로
        **가짜 document를 주입**합니다 — 그 요소가 활성인 상황을 만들어 캐럿 복원까지 돌립니다. */
     const F = new Function(`
       const el = { value:'1,234', selectionStart:4, setSelectionRange(a){ this.caret = a; } };
       const document = { activeElement: el };
       ${m[0]}
       ${d[0]}
       /* 「1,234」에서 캐럿이 위치 4(숫자 셋을 지남) → 「12,345」에서도 숫자 셋을 지난 자리여야 합니다. */
       setMaskedValue(el, '12,345', isDigit);
       return [el.value, el.caret];`);
     const [v, caret] = F();
     return v === '12,345' && caret === 4;
  })());

  /* ── #5 평형 ──────────────────────────────
     50평은 대형 평형과 하이엔드 거래를 통째로 잘라내고 있었습니다. */
  tt('평형 상한이 100 이상이다', (()=>{
     const n = UI.match(/const PYEONG_MAX = (\d+);/); return !!n && +n[1] >= 100;
  })());

  /* ── #4 문구 스캐너빌리티 ──────────────────
     에러 줄은 **읽는 것이 아니라 보이는 것**이라 제한 수치가 앞에 와야 합니다. */
  tt('에러 문구가 제한 수치로 시작한다', (()=>{
     const q = UI.match(/'[^']*까지 넣을 수 있어요\.'/g) || [];
     return q.length >= 4 && q.every(x => x.startsWith("'최대 "));
  })());
  /* 「99,999만원」은 사람이 못 읽습니다. 억으로 넘어가는 값은 억으로 씁니다. */
  tt('읽을 수 없는 단위를 쓰지 않는다', !/99,999만/.test(UI));

  /* ── #6 설명 줄 삭제 ──────────────────────
     ⚠ 이 판의 지시입니다. **되돌아오는 것**은 위 v24.6 자리의 락이 막습니다. */
  tt('인테리어 칸에도 설명 줄이 없다',
     !/id="outInteriorS"/.test(M) && !/outInteriorS/.test(BARE));
  /* 🔴 v24.22 후반 — **높이를 손가락 표적 토큰에 묶습니다.**
     ⚠ 처음엔 「높이를 아예 박지 않는다」로 잠갔다가 `var(--h-opt)`이 정규식을 비켜가
       **우연히 통과**했습니다. 통과 이유가 의도와 다르면 그건 검사가 아닙니다.
     잠글 사실 둘:
       ① 픽셀 숫자를 박지 않는다 — 88px·118px 같은 옛 값이 돌아오면 🔴
       ② 높이가 있고, 그 값이 **토큰**이다 — 46px은 이 파일이 이미 쓰는 최소 누름 높이입니다.
     🔴 여기가 바닥입니다. 결과 화면에서 누르는 것이 이 넷뿐이라 더 줄이면 안 됩니다. */
  tt('다음 걸음 칸 높이가 손가락 표적 토큰에 묶여 있다', (()=>{
     const rule = (M.match(/\.minigrid \.mini\{[^}]*\}/) || [''])[0];
     if(!rule) return false;
     const opt = M.match(/--h-opt:(\d+)px/);
     return /min-height:var\(--h-opt\)/.test(rule)
         && !/min-height:\d+px/.test(rule)
         && !!opt && +opt[1] >= 44;
  })(), (()=>{ const r=(M.match(/\.minigrid \.mini\{[^}]*\}/)||['없음'])[0];
     const o=M.match(/--h-opt:(\d+)px/); return r + ' / --h-opt ' + (o?o[1]:'?'); })());
  /* 죽은 CSS를 남기지 않습니다(원칙 47) — 설명 줄이 없는데 규칙만 남으면 다음 사람이 헷갈립니다. */
  tt('설명 줄 CSS 규칙을 같이 지웠다', !/\.minigrid \.mini \.txt span\{/.test(M));

  /* ── #7 이모지 ────────────────────────────
     🔴 v23.23 「화면에서 이모지 0개」의 사정거리를 **카톡으로 나가는 문구까지**로 확정했습니다. */
  tt('요약 문구에 이모지가 없다', (()=>{
     const m = BARE.match(/function summaryText\(\)[\s\S]*?\n\}/);
     if(!m) return false;
     return !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(m[0]);
  })());
})();

/* ═══ v24.23 — 금리 시뮬레이터 · GA4 · 금소법 면책 ═══════════════════ */
(() => {
  const BARE = UI.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
  const M = UI0().replace(/\/\*[\s\S]*?\*\//g,'');
  const RAW = fs.readFileSync(FILE,'utf8');

  /* ── 🔴 스크립트 블록이 둘이 됐습니다 ────────────
     `loadEngine`은 **마지막 블록**을 엔진으로 삼습니다. GA4가 head에 들어가면서
     블록이 둘이 됐고, 지금은 순서가 우연히 맞습니다. **우연에 기대면 안 됩니다.**
     head에 스크립트를 하나 더 넣는 순간 검사 전체가 엉뚱한 코드를 읽습니다. */
  tt('엔진이 마지막 스크립트 블록에 있다', (()=>{
     const blocks = [...RAW.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
     const last = blocks[blocks.length-1];
     return /function solveMaxPrice\(/.test(last) && /const POLICY/.test(last);
  })(), (()=>{ const b=[...RAW.matchAll(/<script>([\s\S]*?)<\/script>/g)];
     return b.length + '개 블록'; })());

  /* ── GA4 — 자리표시자면 아무것도 안 합니다 ────────
     🔴 가드가 없으면 배포 즉시 없는 ID로 요청이 나가고 **이유 없는 서드파티 쿠키**만 남습니다. */
  /* 🔴 이 검사는 처음에 **코드를 실행하지 않고 빈 문자열을 실행**했습니다
     (`m[1]`이 캡처 그룹 없이 undefined라 삼항이 항상 `''`를 골랐습니다).
     가드를 지우는 사보타주가 **통과했고**, 그제서야 알았습니다.
     → 우연한 초록은 빨강보다 위험합니다. 실행한 뒤 **부수효과를 셉니다.** */
  tt('GA4가 자리표시자일 때 로드되지 않는다', (()=>{
     const m = RAW.match(/<script>(\s*\(function\(\)\{[\s\S]*?GA_ID[\s\S]*?\}\)\(\);\s*)<\/script>/);
     if(!m) return false;
     let made = 0, appended = 0;
     const doc = { createElement: () => { made++; return {}; },
                   head: { appendChild: () => { appended++; } } };
     const win = {};
     new Function('document','window', m[1])(doc, win);
     return made === 0 && appended === 0 && !win.gtag;
  })());
  /* 🔴 그리고 **진짜 ID를 넣으면 켜져야** 합니다. 안 켜지는 것만 확인하면
     「영영 안 켜지는 코드」도 통과합니다 — 가드가 아니라 벽돌입니다. */
  tt('GA4가 진짜 ID에서는 켜진다', (()=>{
     const m = RAW.match(/<script>(\s*\(function\(\)\{[\s\S]*?GA_ID[\s\S]*?\}\)\(\);\s*)<\/script>/);
     if(!m) return false;
     const body = m[1].replace(/var GA_ID = '[^']*';/, "var GA_ID = 'G-AB12CD34EF';");
     let made = 0, appended = 0, src = '';
     const doc = { createElement: () => { made++; return { set src(v){ src = v; } }; },
                   head: { appendChild: () => { appended++; } } };
     const win = {};
     new Function('document','window', body)(doc, win);
     return made === 1 && appended === 1
         && /googletagmanager\.com\/gtag\/js\?id=G-AB12CD34EF/.test(src)
         && typeof win.gtag === 'function';
  })());
  tt('GA4 측정 ID가 한 곳에만 있다', (RAW.match(/G-XXXXXXXXXX/g)||[]).length === 1);
  /* 이 도구는 사용자가 넣은 금액을 밖으로 보내지 않습니다. GA에도 안 보냅니다. */
  tt('GA에 입력값을 보내지 않는다',
     !/gtag\('event'[\s\S]{0,200}(cash|income|price|S\.)/.test(RAW));

  /* ── 금소법 면책 ─────────────────────────────── */
  tt('금소법 면책 문구가 있다',
     /금융상품 판매 대리·중개업자가 아닙니다/.test(BARE)
     && /실제 대출 가능 여부는 금융기관 심사에 따릅니다/.test(BARE));
  /* 🔴 위계가 가장 낮은 자리(.legal) 안이어야 합니다. 밖으로 나오면 본문처럼 읽힙니다. */
  tt('면책이 .legal 안에 있다', (()=>{
     const m = BARE.match(/<span class="legal">[\s\S]*?<\/span>/);
     return !!m && /금융상품 판매 대리·중개업자가 아닙니다/.test(m[0]);
  })());

  /* ── 금리 시뮬레이터 ──────────────────────────
     🔴 **엔진과 격리되어야 합니다.** 한도는 스트레스 금리(6.9%)로 잡고 상환액만 실제
        금리로 계산하는 구조라, 여기서 D.rate를 건드리면 그 관계가 깨집니다. */
  tt('시뮬레이터가 엔진 금리를 안 건드린다', (()=>{
     /* D.rate에 대입하는 곳이 하나도 없어야 합니다. */
     return !/D\.rate\s*=/.test(BARE) && /let SIM_RATE = null;/.test(BARE);
  })());
  tt('시뮬레이터 값이 별도 변수다',
     /const simRate = \(\) => SIM_RATE == null \? D\.rate : SIM_RATE;/.test(BARE));
  /* 결과를 다시 계산하면 기준으로 되돌아가야 합니다 — 지난 조작이 묻어가면
     사용자는 자기가 만진 줄 모르고 그 숫자를 사실로 읽습니다. */
  tt('결과를 다시 계산하면 기준 금리로 되돌아간다',
     /SIM_RATE = null;\s*\n\s*renderBento\(c\);/.test(BARE));
  /* 대출이 없으면 숨깁니다 — 갚을 것이 없는데 금리를 물을 이유가 없습니다. */
  tt('대출이 없으면 시뮬레이터를 숨긴다',
     /if\(!\(loan > 0\)\)\{ box\.setAttribute\('hidden',''\); return; \}/.test(BARE));
  /* 🔴 금리 값에 판정색을 쓰지 않습니다 — 금리는 좋고 나쁨이 아니라 조건입니다(지침 6-3). */
  tt('금리 값에 판정색을 쓰지 않는다', (()=>{
     const r = (M.match(/\.ratesim-v\{[^}]*\}/)||[''])[0];
     return /color:var\(--ink\)/.test(r) && !/--warn|--bad|--ok|--green/.test(r);
  })());
  /* 슬라이더는 정수 ×10입니다 — step="0.1"은 브라우저마다 부동소수 오차가 납니다. */
  tt('금리 슬라이더가 정수 눈금이다',
     /id="rateRange"[^>]*min="30"[^>]*max="100"[^>]*step="1"/.test(M));
  /* 새 모양을 만들지 않았습니다 — 평형 슬라이더와 같은 전역 규칙을 씁니다. */
  tt('슬라이더 문법을 새로 만들지 않았다',
     !/#rateRange\{|#rateRange::/.test(M));

  /* ── 🔴 실제로 돌려 봅니다 — 금리를 올리면 상환액이 늘어야 합니다 ── */
  tt('금리를 올리면 월 상환액이 는다', (()=>{
     const lo = E.monthlyPaymentCalc(5e8, 3.0, 30);
     const hi = E.monthlyPaymentCalc(5e8, 10.0, 30);
     return Number.isFinite(lo) && Number.isFinite(hi) && hi > lo * 1.4;
  })());
})();

/* ═══ v24.24 — 엔진 경계 표식 · 계산 기준 확장 ══════════════════════ */
(() => {
  const RAW = fs.readFileSync(FILE,'utf8');
  /* 🔴 표식이 여러 번 나오면 어디서 잘릴지 모릅니다. 정확히 한 번이어야 합니다. */
  tt('엔진 경계 표식이 정확히 한 번 있다',
     (RAW.split(ENGINE_MARK).length - 1) === 1,
     () => (RAW.split(ENGINE_MARK).length - 1) + '번');
  /* 🔴 표식 **위쪽만** 떼어 실행했을 때 문법이 성립해야 합니다.
     표식을 주석 안쪽에 두면 열린 `/*`로 끝나 파싱이 죽습니다 — 실제로 한 번 죽였습니다. */
  tt('표식 위쪽만 떼어도 문법이 성립한다', (()=>{
     const src = RAW.match(/<script>([\s\S]*?)<\/script>/g).pop().replace(/<\/?script>/g,'');
     const cut = src.indexOf(ENGINE_MARK);
     if(cut <= 0) return false;
     try { new Function(src.slice(0, cut)); return true; } catch(e){ return false; }
  })());
  /* 로그 줄에 다시 의존하지 않습니다 — 로그는 로그의 일입니다. */
  tt('경계가 로그 줄에 의존하지 않는다',
     !/indexOf\("console\.info\('영끌계산기 BUILD"\)/.test(fs.readFileSync(__filename,'utf8')));
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
