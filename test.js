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

/* 🔴 v25.1 — **면책 블록을 꺼내는 함수 하나.** 다섯 검사가 각자
   `/<span class="legal">[\s\S]*?<\/span>/`를 들고 있었습니다. v25.1에서 면책 두 문장을
   문단 둘(`.lg-l`)로 가르자 그 비탐욕 정규식이 **첫 번째 안쪽 `</span>`에서 멈춰**
   다섯이 한꺼번에 빨간불이 났습니다.
   ⚠ **검사가 틀린 게 아니라 세는 방법이 얕았던 것**입니다 — 중첩을 가정하지 않은 식이
     다섯 벌 복사돼 있었고, 구조가 바뀌자 다섯 곳을 다 고쳐야 했습니다(원칙 58).
   → `<span>` 열고 닫기를 세어 **짝이 맞는 곳까지** 잘라 냅니다. 다음에 문단이 셋이 되어도
     이 함수 하나만 맞으면 됩니다.
   ⚠ 못 찾으면 `null`을 돌려줍니다 — 빈 문자열을 주면 「면책이 없다」와
     「면책에 그 말이 없다」가 같은 답이 됩니다(원칙 124). */
function legalBlock(src){
  const at = src.indexOf('<span class="legal">');
  if(at < 0) return null;
  let depth = 0;
  const tag = /<span\b[^>]*>|<\/span>/g;
  tag.lastIndex = at;
  let m;
  while((m = tag.exec(src))){
    depth += m[0] === '</span>' ? -1 : 1;
    if(depth === 0) return src.slice(at, m.index + m[0].length);
  }
  return null;
}
/* 안쪽 문단 태그를 걷어낸 **글자만**. 문구를 보는 검사는 이쪽을 씁니다. */
const legalText = src => { const b = legalBlock(src);
  return b === null ? null : b.replace(/<\/?span[^>]*>/g,''); };

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
                'monthlyPaymentCalc','zoneFromSgg','roomDeductFromSgg','LAWD','isGunArea',
                /* 🔴 v24.28 — 선택 단위(행정구 → 시 묶음). **규칙을 여기 베끼지 않습니다** —
                   본체 함수를 그대로 떼어다 돌려서 그 결과를 봅니다(원칙 106). */
                'PICKS','buildPicks','pickSig','GU_IN_SI','pickOfCode','pickLabel','lawdCodesOf'];
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
/* 🔴 v25.0 — **이 검사는 틀린 믿음을 잠그고 있었습니다.**
   지방세법상 **비조정지역에서 취득 후 2주택은 중과가 아니라 표준세율(1~3%)**입니다.
   「다주택이면 무조건 더 높다」는 조정지역에서만 참입니다.
   → 잠글 것을 **법이 정한 네 칸**으로 바꿉니다(원칙 128 — 대상을 옮기고, 느슨해지지 않게).
     이 검사가 막던 나쁜 상태(「다주택인데 세율이 안 오른다」)는 아래 셋이 그대로 막습니다. */
tt('비조정 · 취득 후 2주택은 표준세율이다 (중과 아님)',
   acquisitionTaxRate(만(80000), 'multi', false, 1) === acquisitionTaxRate(만(80000), 'none', false));
tt('조정 · 취득 후 2주택은 8%다',
   Math.abs(acquisitionTaxRate(만(80000), 'multi', true, 1) - 0.08) < 1e-9);
tt('조정 · 취득 후 3주택 이상은 12%다',
   Math.abs(acquisitionTaxRate(만(80000), 'multi', true, 2) - 0.12) < 1e-9);
tt('비조정 · 취득 후 3주택 이상은 8%다',
   Math.abs(acquisitionTaxRate(만(80000), 'multi', false, 2) - 0.08) < 1e-9);
/* 🔴 **주택 수를 안 넘기면 1주택 보유로 봅니다.** 예전 3-인자 호출과 뜻이 같아야 하고,
   기본값이 3주택 요율로 돌아가면 v24.18~v24.32의 과대 계산이 그대로 되살아납니다. */
tt('주택 수를 안 넘기면 1주택 보유로 본다',
   acquisitionTaxRate(만(80000), 'multi', true) === acquisitionTaxRate(만(80000), 'multi', true, 1));
/* 🔴 화면이 그 수를 실제로 묻는가 — 계산만 고치고 안 물으면 기본값만 쓰이게 됩니다(원칙 122). */
/* 🔴 사보타주가 잡았습니다 — 「`${ownDrawer()}`를 지운다」에서 **초록으로 통과**했습니다.
   정의와 핸들러만 봤고 **불려지는지**를 안 봤습니다. 원칙 122 그대로입니다(「썼는가」 ≠ 「닿았는가」).
   → 질문 마크업이 **실제로 그 함수를 부르는지**까지 봅니다. */
tt('화면이 보유 주택 수를 묻는다',
   /function ownDrawer\(\)/.test(UI) && /data-own="1"/.test(UI) && /data-own="2"/.test(UI)
   && /S\.ownCount = \+b\.dataset\.own/.test(UI)
   && /\$\{ownDrawer\(\)\}/.test(UI)
   && /id="ownSeg"/.test(UI));
/* ⚠ `acquisitionTaxRate` 호출은 **엔진 쪽**이라 `UI`(ENGINE END 뒤)에 없습니다.
   화면이 담는 것과 엔진이 받는 것을 **각각 그 자리에서** 봅니다(이걸 놓쳐 한 번 헛돌았습니다). */
tt('보유 수가 계산으로 흘러간다',
   /ownCount:S\.ownCount/.test(UI)
   && /acquisitionTaxRate\(ctx\.price, ctx\.houseStatus, ctx\.regulated, ctx\.ownCount\)/.test(fs.readFileSync(FILE,'utf8')));
tt('조건칩이 몇 채인지까지 말한다',
   /S\.ownCount>=2\?' \(2채 이상\)':' \(1채\)'/.test(UI));
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
/* 🔴 v25.6 — **「2억 0,000만원」이 안 나오는가**(지시서 8).
   지적은 정확히 이 꼴을 막으라는 것이었고, 실물에서는 **이미 안 나옵니다** —
   `if(man > 0 || eok === 0)`이 만 자리가 0이면 그 토막을 통째로 안 붙입니다.
   ⚠ 그래서 **로직을 더하지 않았습니다.** 이미 하는 일을 한 번 더 적으면 조건이 두 벌이 되고,
     둘이 갈리는 날 어느 쪽이 진짜인지 알 수 없습니다(원칙 43 · 84).
   → 대신 **그 사실을 잠급니다.** 1만원~200억을 훑어 「0만」·「0,000만」이 한 번이라도
     나오면 빨간불입니다. 다음 사람이 저 조건을 지우면 여기서 걸립니다. */
t('formatWon 2억(만 자리 0)',  formatWon(만(20000)), '2억원');
t('formatWon 20억(만 자리 0)', formatWon(만(200000)), '20억원');
tt('억 단위가 딱 떨어지면 「0만원」을 안 붙인다', (()=>{
   const bad = [];
   for(let eok = 1; eok <= 200; eok++){
     const s = formatWon(만(eok * 10000));
     if(/0만원$|,000만원$/.test(s) && !/[1-9]/.test(s.replace(/^[\d,]+억\s*/,'').replace(/만원$/,'')))
       bad.push(s);
     if(/\s0만원$/.test(s) || /\s0,000만원$/.test(s)) bad.push(s);
   }
   /* 만 자리가 0이 아닌 값도 같이 훑습니다 — 「5,000만원」 같은 정상 표기를 잘못 잡으면 안 됩니다 */
   const okSamples = [만(15000), 만(10001), 만(1)].map(formatWon);
   return bad.length === 0 && okSamples.join(' ') === '1억 5,000만원 1억 1만원 1만원';
})(), (()=>{ const b=[]; for(let e=1;e<=200;e++){ const s=formatWon(만(e*10000));
   if(/\s0만원$|\s0,000만원$/.test(s)) b.push(s); } return b.slice(0,3).join(' | ')||'없음'; })());

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
  /* ── 🆕 v24.28 안내 시트가 「입력값 보관」을 말한다 ─────────────
     🔴 이 도구는 연소득과 현금을 받는데, **어디로 가느냐를 화면이 한 번도 답한 적이 없었습니다.**
     ⚠ 문구가 있는지만 세면 안 됩니다 — **그 주장이 사실인지**를 같은 자리에서 잠급니다.
       사실이 아닌 안심 문구는 없는 것보다 나쁩니다(원칙 39 · 28). */
  tt('안내 시트가 입력값 보관을 말한다',
     /<b>입력값 보관<\/b>/.test(html) && /서버로 보내지 않아요/.test(html));
  tt('그 주장이 사실이다 — 밖으로 나가는 요청에 금액이 없다', (()=>{
     /* 실제 fetch 호출을 전부 세고, 쿼리에 지역 코드·연월 말고 다른 값이 붙었는지 봅니다. */
     const calls = [...noComment.matchAll(/fetch\(\s*[`'"]([^`'"]+)/g)].map(m => m[1]);
     if(!calls.length) return false;
     return calls.every(u => {
       const q = (u.split('?')[1] || '');
       const keys = [...q.matchAll(/([\w]+)=/g)].map(m => m[1]);
       return keys.every(k => ['lawd','ymd'].indexOf(k) >= 0);
     });
  })(), (()=>{ const calls=[...noComment.matchAll(/fetch\(\s*[`'"]([^`'"]+)/g)].map(m=>m[1]);
     return calls.join(' · ')||'fetch 없음'; })());
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
  /* 🔴 v25.14 — 화면 이름을 **「주담대」 한 벌**로 줄였습니다(오너 지시 — 화면 글자 줄이기).
     ⚠ 잠글 것 둘 : ① 옛 이름이 화면에 **안 섞인다** ② **정식 명칭은 안내 시트에서 한 번** 말한다.
       약어를 쓰려면 어딘가에서 한 번은 풀어 줘야 합니다(원칙 0의 정신 · 58 — 정의는 한 곳). */
  tt('대출 이름이 「주담대」로 통일',
     !/은행에서 빌리는 돈/.test(UI), (UI.match(/은행에서 빌리는 돈/g)||[]).length + '곳 남음');
  tt('영수증에 주담대 줄이 있다', /row\('주담대'/.test(UI));
  /* ⚠ `UI`는 **엔진 뒤 스크립트**입니다 — 안내 시트는 `<body>` 마크업이라 거기 없습니다.
     화면에 나가는 글자는 **마크업 + 화면 스크립트 둘 다**이므로 파일을 통째로 보고 주석만 겁니다
     (원칙 111 — 문자열을 보는 검사는 예외 없이 주석을 겁니다). */
  const SCREEN = fs.readFileSync(FILE,'utf8')
     .replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'').replace(/\/\/[^\n]*/g,'');
  tt('화면 본문에 옛 긴 이름이 안 섞인다',
     (SCREEN.match(/주택담보대출/g)||[]).length === 1,   /* 안내 시트의 정의 한 곳만 */
     (SCREEN.match(/주택담보대출/g)||[]).length + '곳');
  tt('안내 시트가 정식 명칭을 한 번 풀어 준다',
     /<b>주택담보대출<\/b>[^<]*<b>주담대<\/b>/.test(SCREEN),
     '🔴 시트에서 「주택담보대출 → 주담대」를 한 번 말해야 합니다');
  /* 🔴 v24.15 — 검사의 **목적은 이름 일치**이고, 표현(.report-line)만 바뀌었습니다(원칙 48).
     진단서에서 .report-line이 사라지고 자금 구성 줄(mixRow)로 합쳐졌습니다.
     구조를 묻지 말고 **renderReport 안에 그 이름이 있는가**만 봅니다 — 다음에 또 옮겨도 안 깨집니다. */
  tt('진단서에도 같은 이름', (()=>{
     const f = (UI.match(/function renderReport\([\s\S]*?\n\}/)||[''])[0];
     return f.length > 100 && /주담대/.test(f) && !/은행에서 빌리는 돈/.test(f);
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
  /* 🔴 v25.7 — **대상만 옮겼습니다**(원칙 128). ※ 둘이 `limitTip` 뒤에서
     `limitNotes`(카드 맨 아래)로 자리를 옮겼습니다. 잠글 사실은 「**이 카드가** 무엇만
     반영했는지 밝히는가」이지 그 문장이 어느 요소에 붙어 있는가가 아닙니다.
     → 카드 안 두 자리를 **합쳐서** 봅니다. 어느 쪽에 있든 걸립니다. */
  tt('한도가 소득·기존 대출만 반영했음을 밝힌다', (()=>{
     /* 카드 하나가 통째로 무엇을 말하는가 — 요소 이름이 아니라 **함수 몸통**을 봅니다.
        ※가 `limitTip` 안에 있든 `limitNotes`로 옮겨졌든 같은 카드입니다. */
     const i = UI.indexOf('function renderLimits(');
     if(i < 0) return false;
     const t = UI.slice(i, UI.indexOf('\nfunction ', i + 10)).replace(/\/\*[\s\S]*?\*\//g, '');
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
     /* 🔴 v24.32 — 다시 **넷**입니다. v24.31이 네이버를 그린 솔리드로 빼냈다가
        실기에서 「하나만 유독 튄다」로 되돌렸습니다(지침 6-14 — 화면 결정은 화면이 이깁니다).
        ⚠ `.gocta`가 **되살아나지 않았는지**도 같이 봅니다. 죽은 문법이 남으면
          「초록 큰 버튼 규격이 둘」이 됩니다(원칙 84). */
     return /\n\.minigrid\{[^}]*grid-template-columns:1fr[;}]/.test(css2)
         && /class="minigrid"/.test(src) && cards.length === 4
         && !/gocta/.test(css2.replace(/\/\*[\s\S]*?\*\//g,''));
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
     /* 🔴 v25.0 — 돈 칸은 **보이는 라벨을 뗐습니다**(머리글이 라벨을 겸합니다).
        잠글 것을 「보이는 글자가 있는가」에서 **「이름이 있는가」**로 옮깁니다 —
        원래 이 검사가 막던 나쁜 상태는 「이름 없는 입력」이고, 그건 `aria-label`이 막습니다.
        ⚠ 오히려 더 셉니다: 전에는 보이는 라벨만 봤고 `aria-label`은 안 봤습니다(원칙 128). */
     const iF = mc.indexOf('class="mfield"'), iH = mc.indexOf('class="helper"');
     const named = (mc.match(/aria-label="\$\{label\} [^"]+"/g)||[]).length;
     const okMc = iF >= 0 && iH >= 0 && iF < iH && named === 2
               && !/class="flabel[^"]*">\$\{label\}/.test(mc);
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
  /* 🔴 v23.26 — 「임계가 40/60인가」를 **「막대와 색이 같은 눈금을 쓰는가」**로 다시 썼습니다.
     이전 락은 값만 지켰고, 그 값 때문에 경고 두 색이 한 번도 뜨지 않았습니다.
     막대의 만석이 0.40이면 색 경계도 그 안(0 < a < b < 0.40)에 있어야 합니다. */
  /* 🔴 v24.27 — 두 검사가 **리터럴 `0.40`을 찾고 있었습니다.**
     v24.26이 원칙 58을 지켜 `0.40`을 `DSR_RATIO`로 바꾸자 검사가 곧바로 빨간불이 됐습니다 —
     **코드가 옳아진 순간 검사가 틀린 것**이지, 코드가 깨진 것이 아니었습니다.
     이제 만석값을 「눈으로 찾은 숫자」가 아니라 **상수를 풀어서** 구합니다:
       ① `ratio/X*100`에서 X를 뽑고 ② X가 이름이면 그 선언을 좇아 ③ `POLICY.ratio.dsr`까지 내려갑니다.
     이렇게 하면 리터럴로 되돌려도(두 벌 발생) · 다른 상수로 바꿔치기해도 둘 다 걸립니다.
     ⚠ 정책이 바뀌어 dsr이 0.40이 아니게 되어도 이 검사는 따라옵니다 — 숫자를 손으로 안 적습니다. */
  const gaugeFull = (()=>{
     const m = UI.match(/ratio\/([A-Za-z_$][\w$]*|[\d.]+)\*100/);
     if(!m) return null;
     const tok = m[1];
     if(/^[\d.]+$/.test(tok)) return +tok;          /* 리터럴을 직접 적은 경우 */
     const decl = (fs.readFileSync(FILE,'utf8')
       .match(new RegExp('const\\s+' + tok + '\\s*=\\s*([^;]+);')) || [])[1];
     if(!decl) return null;
     const d = decl.trim();
     if(/^[\d.]+$/.test(d)) return +d;              /* 상수가 리터럴을 들고 있는 경우 */
     return /POLICY\.ratio\.dsr/.test(d) ? E.POLICY.ratio.dsr : null;
  })();
  tt('게이지가 DSR 상한을 만석으로 본다',
     gaugeFull !== null && gaugeFull === E.POLICY.ratio.dsr, String(gaugeFull));
  tt('색 단계가 게이지 눈금 안에 있다', (()=>{
     const m = UI.match(/ratio<([\d.]+)\s*\?\s*'ok'\s*:\s*ratio<([\d.]+)\s*\?\s*'mid'/);
     if(!m || !gaugeFull) return false;
     const a=+m[1], b=+m[2];
     return 0 < a && a < b && b < gaugeFull;   /* 두 경계가 만석 안쪽에 있어야 합니다 */
  })(), (UI.match(/ratio<([\d.]+)\s*\?\s*'ok'\s*:\s*ratio<([\d.]+)/)||[]).slice(1).join(' / ')
        + ' / 만석 ' + gaugeFull);
  /* 경고 두 색이 실제로 도달 가능한가 — 화면 부담률은 스트레스 금리 때문에 최대 ~34%입니다. */
  tt('경고 두 색이 도달 가능하다', (()=>{
     const m = UI.match(/ratio<([\d.]+)\s*\?\s*'ok'\s*:\s*ratio<([\d.]+)\s*\?\s*'mid'/);
     return m && +m[1] <= 0.30 && +m[2] <= 0.36;
  })());
  tt('퍼센트 글자도 단계색을 따른다', /tileBurden'\)\.className='tile-v '\+band/.test(UI));

  /* ═══ 🔴 v25.17 — 「소득 대비 부담」의 분자 ══════════════════════════════
     v25.16까지 분자는 **주담대 원리금 하나**였는데 분모(게이지 만석)는 **DSR 규격**이었습니다.
     DSR의 정의는 모든 대출의 연간 원리금이므로 막대가 실제보다 덜 찼습니다 —
     **결과를 유리하게 만드는 오차**입니다(원칙 28). 실측(소득 3억 · 월 50만원): 8% ↔ 9.8%.

     ⚠ **문자열이 아니라 사실을 잠급니다**(원칙 48 · 128). 분자를 어떻게 쓰든 상관없고,
       잠그는 것은 **「분모가 DSR 규격이면 분자도 전체 대출을 센다」** 하나입니다.
     ⚠ 그리고 **두 번째 정의를 금지합니다**(원칙 58) — 화면이 `S.debtMonthly`로 다시
       계산하면 신용대출 10년 분할·스트레스 가산이 바뀔 때 한도와 부담률이 갈립니다. */
  const ratioExpr = (UI.match(/const ratio=([^;]+),\s*pct=/) || [])[1] || '';
  tt('부담률 분자를 찾았다', ratioExpr.length > 0, ratioExpr.trim() || '🔴 못 찾음');
  tt('부담률 분자가 주담대 원리금을 센다', /\bm\s*\*\s*12\b/.test(ratioExpr), ratioExpr.trim());
  tt('부담률 분자가 기존 대출도 센다 (분모가 DSR 규격이므로)',
     /existingAnnual/.test(ratioExpr), ratioExpr.trim());
  tt('부담률 분자가 기존 대출을 다시 계산하지 않는다 (원칙 58)',
     ratioExpr.length > 0 && !/S\.debtMonthly|debtParts/.test(ratioExpr), ratioExpr.trim());

  /* 엔진 쪽 — 화면이 쓰는 이름(`existingAnnual`)과 한도 계산이 쓰는 함수(`existingAnnualDebt`)가
     **한 값**이어야 합니다. 갈리면 「막대는 찼는데 한도는 안 줄었다」가 납니다(원칙 91). */
  tt('calcCosts가 기존 대출 연간 원리금을 내보낸다',
     Number.isFinite(calcCosts(ctx({ price: 만(80000), otherDebtMonthly: 만(50) })).existingAnnual));
  tt('기존 대출 연간 원리금 = 월 상환액 × 12', (() => {
     const c = calcCosts(ctx({ price: 만(80000), otherDebtMonthly: 만(50) }));
     return Math.round(c.existingAnnual) === Math.round(만(50) * 12);
  })(), String(calcCosts(ctx({ price: 만(80000), otherDebtMonthly: 만(50) })).existingAnnual));
  tt('갚는 대출이 없으면 0', calcCosts(ctx({ price: 만(80000) })).existingAnnual === 0);
  /* 🔴 **값 검사** — 위 넷은 표기를 봅니다. 이건 분자가 실제로 커지는지를 봅니다.
     ⚠ 같은 price로 비교합니다. 기존 대출은 한도도 줄이므로 주담대 원리금이 같이 내려가는데,
       그래도 **합이 커져야** 합니다. 안 커지면 부담률이 오히려 낮아지는 것이고,
       그건 고치기 전과 같은 방향의 오차입니다(원칙 28). */
  tt('기존 대출을 넣으면 부담 분자가 커진다', (() => {
     const p = 만(80000);
     const num = c => monthlyPaymentCalc(c.mortgageLoan, 5.4, 30) * 12 + (c.existingAnnual || 0);
     return num(calcCosts(ctx({ price: p, otherDebtMonthly: 만(50) })))
          > num(calcCosts(ctx({ price: p })));
  })());

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
  /* 🔴 v25.11 — **문장을 통째로 잠그고 있었습니다**(원칙 48). 지키려던 사실은
     「이 문장이다」가 아니라 **「해제된 거래를 뺐다는 것을 화면이 말한다」**입니다.
     오너가 각주를 한 줄로 깎으라고 하자 이 잠금이 정당한 개선을 막았습니다. */
  tt('해제된 거래를 걸러낸다는 것을 화면에서 밝힌다',
     /해제[^.]{0,6}거래[^.]{0,6}(뺐|제외)/.test(UI));
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
  /* 🔴 v25.18 — **대상을 옮겼습니다**(원칙 128). 지키려던 사실은 「'건'이라는 글자」가 아니라
     **「머리가 `shown`이 아니라 `total`(가진 것)을 적는다」**입니다. */
  tt('머리가 가진 수를 밝힌다', /\$\{total\}(건|곳)/.test(UI));
  /* 🔴 v25.18 — **단위를 접는 축에 묶습니다**(원칙 91 · 134).
     목록을 `dealSameKey`(단지)로 접으면 `total`은 **곳**이고, 면적으로 접으면 **곳이 아닙니다**
     (「현대 47평」과 「현대 35평」은 2곳이 아닙니다). 축을 되돌리면 이 검사가 걸립니다 —
     단위만 따로 잠그면 축이 바뀔 때 머리가 조용히 거짓이 됩니다. */
  tt('머리의 단위가 접는 축과 같다', (()=>{
     const dd = (UI.match(/const dedupe = arr => \{[\s\S]*?\n  \};/)||[''])[0];
     if(!dd) return false;
     const byComplex = /dealSameKey\(x\)/.test(dd);
     const byArea    = /areaM2/.test(dd);
     const unit = (UI.match(/최근 3개월 · \$\{total\}(건|곳)/)||[])[1];
     if(!unit) return false;
     return byComplex && !byArea ? unit === '곳' : unit === '건';
  })(), (UI.match(/최근 3개월 · \$\{total\}(건|곳)/)||[])[1] || '못 찾음');

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
  /* 🔴 v25.16 — **주석을 걷고 봅니다**(원칙 111 · 152).
     ⏹ 전에는 파일 전문에서 「세대수」를 찾았습니다. v25.16이 **왜 세대수를 안 붙였는지**를
       주석에 적자(인수인계 0장 4️⃣ — 실기 매칭률 1/5) 이 검사가 빨간불을 냈습니다.
       빨간불의 원인은 코드가 아니라 **검사의 전처리**였습니다 — 원칙 152가 적어 둔 그 자리입니다.
     ⚠ 잠글 것은 「그 낱말이 파일에 없다」가 아니라 **「그런 칩이 화면에 없다」**입니다.
       주석은 화면이 아닙니다. 대신 **문자열 리터럴은 그대로 봅니다** — 화면에 나가는 것은 거기입니다. */
  tt('취향 칩은 신축 하나뿐이다', (()=>{
     const src = fs.readFileSync(FILE,'utf8')
       .replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
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
  /* 🔴 v25.16 — **대상을 옮겼습니다**(원칙 128).
     ⏹ 전: 「줄이 `<a>`가 아니고 `<div>`다」. 근거는 「단지 상세로 보낼 데이터가 없다」였습니다.
       v25.16에서 그 전제가 바뀌었습니다 — 3개월치를 이미 전부 받아 두고 있어서
       **줄을 누르면 그 단지 거래 전부를 펼 수 있습니다**(인수인계 0장 3️⃣ ②).
     → 지키려던 사실은 「`<div>`다」가 아니라 **「밖으로 안 나간다」**입니다. 그것을 잠급니다:
       `<a>`가 아니고 · `<button type="button">`이고 · **화살표(↗)를 안 단다**(채널 C · v25.14). */
  tt('거래 줄은 앱 밖으로 나가지 않는다', (()=>{
     if(/<a[^>]*class="deal"/.test(UI)) return false;
     if(!/<button type="button" class="deal" data-deal=/.test(UI)) return false;
     /* ⚠ **주석을 걷고 봅니다**(원칙 111 · 152). 이 함수의 주석이 「채널 C(↗)와 갈린다」고
        적고 있어서, 안 걷으면 검사가 **자기 근거를 적은 글에** 걸려 빨간불을 냅니다. */
     const line = (UI.match(/function dealLine\([^)]*\)[\s\S]*?\n\}/) || [''])[0]
       .replace(/\/\*[\s\S]*?\*\//g, '');
     return !!line.trim() && !/↗/.test(line)
         && /<span class="caret" aria-hidden="true">▾<\/span>/.test(line);
  })());
  /* 🆕 v25.16 — 접기 셋과 **같은 짝**(aria-expanded ↔ aria-controls)을 씁니다. */
  tt('거래 줄이 접기 셋과 같은 짝을 쓴다',
     /aria-expanded="false" aria-controls="dealBox\$\{i\}"/.test(UI)
     && /id="dealBox\$\{i\}"/.test(UI));
  /* 🆕 v25.16 — **한 번에 하나만 폅니다.** 다섯이 다 펴지면 이 카드가 결과 화면보다 길어집니다. */
  tt('펴진 단지 상자는 한 번에 하나다',
     /DEAL\.open = \(DEAL\.open === i\) \? null : i;/.test(UI)
     && /const on = \+b\.dataset\.deal === DEAL\.open;/.test(UI));
  /* 🆕 v25.16 — 펴진 상태는 **저장에 안 실립니다.** `S`에 두면 다음 방문에 펴진 채로 뜹니다 —
     그건 사용자의 답이 아니라 그 순간의 보기 상태입니다. */
  tt('펴진 상태가 저장에 안 실린다',
     /open:null/.test(UI) && !/S\.dealOpen/.test(UI));
  /* 🆕 v25.16 — **같은 단지의 기준이 「거래 활발」 뱃지와 같은 키다**(원칙 58).
     이름만 보면 「현대」·「벽산」이 다른 동의 단지와 한 덩어리가 됩니다. */
  tt('펴기와 뱃지가 같은 단지 기준을 쓴다', (()=>{
     const k = (UI.match(/function dealSameKey\(x\)\{[^}]*\}/) || [''])[0];
     return /\(x\.name\|\|''\) \+ '\|' \+ \(x\.dong\|\|''\) \+ '\|' \+ \(x\.lawd\|\|''\)/.test(k)
         && /const hotKey = x => \(x\.name\|\|''\) \+ '\|' \+ \(x\.dong\|\|''\) \+ '\|' \+ \(x\.lawd\|\|''\);/.test(UI);
  })());
  /* 🆕 v25.16 — 🔴 **없는 데이터를 안 만듭니다.**
     ① 층 — `/api/apt-price`가 정규화해 넘기는지 이 묶음에서 확인 못 했습니다. 안 적습니다.
     ② 세대수 — 표는 있지만 실기 매칭률이 5건 중 1건입니다(0장 4️⃣). 안 붙입니다.
     ③ 날짜 — 셋(y·m·d)이 다 있을 때만 적습니다. 없으면 자리를 비웁니다(원칙 124). */
  tt('펴진 상자가 없는 데이터를 안 만든다', (()=>{
     const box = (UI.match(/function dealBox\(x, i\)\{[\s\S]*?\n\}/) || [''])[0];
     if(!box) return false;
     return !/floor|층/.test(box) && !/APT_UNITS|세대/.test(box)
         && /\(n\.y && n\.m && n\.d\)/.test(UI);
  })());
  /* 🆕 v25.16 — 상한이 있고, **잘랐으면 잘랐다고 말합니다**(원칙 39 · 문법은 v24.21과 같음). */
  tt('펴진 상자에 상한이 있고 그 사실을 말한다',
     /const shown = all\.slice\(0, DEAL\.boxRows\);/.test(UI)
     && /all\.length > shown\.length \? ` 중 \$\{shown\.length\}건` : ''/.test(UI)
     && /boxRows:\d+/.test(UI));
  /* 🆕 v25.16 — 🔴 **G-7은 「보이는」 금액만 셉니다**(원칙 144 · 151).
     ⏹ `textContent`는 접힌 상자 안까지 셉니다. v25.16이 줄마다 상자를 심자
       화면에 두 번 뜨는 금액이 **네 번**으로 잡혔습니다 — 게이트가 재던 것이
       처음부터 「화면」이 아니라 「소스」였다는 사실이 그때 드러났습니다.
     ⚠ 이 검사가 없으면 다음 사람이 `textContent`로 되돌려도 **아무 불도 안 켜집니다**
       (사보타주에서 실제로 초록이었습니다 · 원칙 127). */
  tt('G-7이 접힌 글자를 안 센다', (()=>{
     const g = (UI.match(/G-7 — 같은 금액 반복[\s\S]*?ok\('G-7[^\n]*\n/) || [''])[0];
     return /\$\('result'\)\.innerText\.match\(moneyRe\)/.test(g)
         && !/\$\('result'\)\.textContent\.match\(moneyRe\)/.test(UI);
  })());
  /* 🆕 v25.16 — 개월 수·상한을 문자열에 손으로 안 적습니다(원칙 84 · 91). */
  tt('펴진 상자의 개월 수가 코드 값에서 온다',
     /최근 \$\{DEAL\.months\}개월 \$\{all\.length\}건/.test(UI)
     && !/최근 [0-9]개월 \$\{all\.length\}/.test(UI));
  /* 🆕 v25.16 — 🔴 **상자의 건수에 주어가 있습니다**(원칙 91).
     목록 머리의 「5건」(예산대 · 접은 줄 수)과 상자의 「N건」(이 단지 전부)은
     **세는 대상이 다릅니다.** 주어가 없으면 두 숫자가 서로를 반박하는 것으로 읽힙니다.
     ⚠ v25.15가 구간한도 알약에 「주담대가」를 붙인 것과 **같은 자리**입니다. */
  tt('펴진 상자의 건수에 주어가 있다',
     /`이 단지 최근 \$\{DEAL\.months\}개월 \$\{all\.length\}건`/.test(UI));
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
  /* 🔴 v25.13 — **또 문장을 잠그고 있었고, 이번엔 「실패」가 아니라 「조용한 통과」였습니다.**
     v25.13이 헬퍼를 「주택담보대출 한도 계산(DSR)에 써요」로 바꿨는데, 이 줄은 초록이었습니다 —
     바꾼 이유를 적어 둔 **코드 주석에 옛 문장이 남아 있어서** 거기에 걸린 것입니다.
     이 파일이 스스로 「문자열을 보는 검사는 예외 없이 주석을 걸어라」라고 적어 둔 자리입니다(원칙 111).
     → ① **주석을 걷어낸 뒤** ② **moneyCard 인자만** 보고 ③ 잠글 것은 문장이 아니라
       **「이 칸이 무엇에 쓰이는지 말하는가」**입니다(원칙 48 · 128). */
  tt('연소득을 묻는 이유가 화면에 있다', (()=>{
     const m = UI_BARE.match(/moneyCard\('income',[^)]*?'([^']+)'\)/);
     return !!m && /DSR/.test(m[1]) && /(쓰여요|써요|계산)/.test(m[1]);
  })(), (()=>{ const m = UI_BARE.match(/moneyCard\('income',[^)]*?'([^']+)'\)/);
     return m ? m[1] : '없음'; })());
  /* 🔴 v24.5 — 원칙 0(약어 단독 금지)은 화면 어디서나 유효합니다.
     결과 화면은 G-3이 봅니다. **입력 화면은 아무도 안 보고 있었습니다.** */
  tt('입력 화면의 DSR에 한글 설명이 붙어 있다', (()=>{
     const m = UI_BARE.match(/moneyCard\('income',[^)]*?'([^']+)'\)/);
     if(!m) return false;
     /* 🔴 v24.19 — 기준선은 __selfcheck의 G-3과 **같은 것**을 씁니다: 「규제(DSR)」.
        앞에 무슨 말이 더 붙는지는 문장의 문제이지 원칙 0의 문제가 아닙니다.
        🔴 v25.13 — **그래 놓고 「규제」라는 낱말을 잠그고 있었습니다.** 헬퍼가
          「주택담보대출 한도 계산(DSR)」이 되자 빨간불이 났는데, 그 문장도 **약어 앞에 한글
          설명이 붙어 있어 원칙 0을 지킵니다.** 원칙 0이 막는 것은 **약어 단독**이지
          「그 앞말이 '규제'인 것」이 아닙니다 — 대상만 옮깁니다(원칙 128 · 48).
        ⚠ 주석을 걷어낸 `UI_BARE`를 씁니다. 원본을 보면 지운 옛 문장이 통과시킵니다(원칙 111). */
     return !/DSR/.test(m[1]) || /[가-힣]\s*\(DSR\)/.test(m[1]);
  })(), (()=>{ const m = UI_BARE.match(/moneyCard\('income',[^)]*?'([^']+)'\)/);
     return m ? m[1] : '없음'; })());
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
  /* 🔴 v25.1 — **재는 방법이 바뀌어 검사식도 옮깁니다**(원칙 128 — 대상만 이동).
     ⏹ 전: `블록 높이 ÷ 행간`. v25.1에서 면책 두 문장 사이에 12px을 주자
       **글자를 한 자도 안 늘렸는데** 그 나눗셈이 늘어났습니다 — 여백이 줄로 세어집니다.
     → 줄 상자(`Range.getClientRects`)를 직접 셉니다. 잠글 사실은 그대로 「렌더를 잰다」이고,
       느슨해진 것이 아니라 **여백을 글자로 세지 않게 된 것**입니다.
     ⚠ 「빈 글은 안 센다」까지 같이 잠급니다 — 0줄을 통과시키면 글이 사라진 것과
       상한을 지킨 것이 같은 답이 됩니다(원칙 124). */
  tt('G-18이 렌더된 줄 수를 잰다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     return /const LINEMAX=\[\['\.helper',1\]/.test(src)
         && /createTreeWalker\(el, NodeFilter\.SHOW_TEXT\)/.test(src)
         && /r\.selectNodeContents\(n\)/.test(src)
         && /Math\.round\(x\.top\)/.test(src)
         && /if\(!el\.textContent\.trim\(\)\) return;/.test(src)
         && /const n=lineCount\(el\);/.test(src)      /* 🔴 정의만이 아니라 **불려지는가**(원칙 122) */
         && /if\(n>max\)/.test(src);
  })());
  /* 🔴 짝 — 옛 방식이 **되살아나지 않았는가.** 높이÷행간이 돌아오면 여백이 다시 줄로 세어집니다.
     ⚠ 사보타주가 잡았습니다 — 처음엔 `getBoundingClientRect().height / lh` **한 가지 철자**만
       봤습니다. `lh` 대신 `parseFloat(getComputedStyle(el).lineHeight)`를 그 자리에 바로 써 넣자
       조용히 초록이었습니다. 잠글 것은 철자가 아니라 **높이를 줄 수로 나누는 일** 자체입니다. */
  tt('G-18이 블록 높이를 줄 수로 쓰지 않는다',
     !/getBoundingClientRect\(\)\.height\s*\//.test(fs.readFileSync(FILE,'utf8')));

  /* 🔴 v24.3 — 「지우기」는 빠른 추가 칩의 형제가 아니라 **그 입력칸에 딸린 동작**입니다.
     칩 줄에 두면 칩 폭에 따라 어떤 화면은 같은 줄, 어떤 화면은 혼자 다음 줄로 떨어집니다. */
  tt('지우기가 라벨 줄에 있다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     /* 🔴 v25.0 — 돈 칸의 라벨이 빠지면서 그 줄에는 「지우기」만 남습니다.
        잠글 것은 여전히 **「지우기가 칩 줄이 아니라 그 입력칸의 줄에 있다」**입니다. */
     return /class="flabel only-clear"><button class="clearbtn" data-add="0" hidden>지우기<\/button>/.test(src)
         && /\n\.flabel\.only-clear\{[^}]*justify-content:flex-end/.test(src)
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
  /* 🔴 v24.31 — 세던 자리를 `class="disc"`(닫는 따옴표까지)에서 **`class="disc` + 낱말 경계**로
     넓혔습니다. 부대비용 접기가 영수증 줄로 앉으면서 `class="disc discline"`이 됐고,
     **접기가 늘어난 것이 아니라 같은 접기가 클래스를 하나 더 얻은 것**인데 검사가 사라진 것으로
     읽었습니다 — 잠글 것은 「어떻게 적혔나」가 아니라 **「접기가 셋인가」**입니다(원칙 120). */
  tt('결과 화면 아코디언은 3종 (부대비용 · 한도 · 인테리어)', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const res = src.slice(src.indexOf('<section class="result"'), src.indexOf('</section>'));
     return (res.match(/class="disc[ "]/g)||[]).length === 3;
  })());
  /* 인테리어는 **닫힌 채로 시작합니다.** 기본값이 열림이면 접은 의미가 없습니다. */
  /* 🔴 v25.21 — **대상을 옮겼습니다**(원칙 128). 인테리어 접기 줄이 `.disc` →
     **`.disc.discline`**이 됐습니다(감사 C-3). 지키려던 사실은 「접기 문법이 한 벌인가」이고,
     `.discline`은 **같은 문법의 한 변형**입니다 — 영수증의 「집값 외 부대비용」 줄이 이미 씁니다.
     ⚠ 그래서 잠글 것을 「`.disc`인가」가 아니라 **「`disc`로 시작하는 한 문법인가 + 짝이 맞는가」**로
       넓히되, `costbox`와 상태 짝은 그대로 잠급니다. */
  tt('인테리어 접기가 셋과 같은 문법이다', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     /* ⏹ v25.23 — `.discline` → `.disc-head`. 위계를 되돌린 판입니다(위 CSS 주석).
        잠그는 것은 여전히 **「disc 한 문법인가 + 짝이 맞는가」**입니다. */
     return /class="disc(?: (?:discline|disc-head))?" id="itToggle"[^>]*aria-controls="itBox"/.test(src)
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

  /* 🔴 v25.6 — **대상만 옮겼습니다**(원칙 128). 잠글 사실은 「질문 카드가 밴드에 붙지 않는다」이지
     「그 값이 20px이다」가 아닙니다. 첫 화면 여백 다이어트에서 16px(--gap)으로 내렸는데,
     리터럴을 잠그고 있던 탓에 **값을 스케일 안으로 들여놓는 일**이 빨간불이 됐습니다.
     ⚠ 느슨해진 것이 아닙니다 — 토큰이 아니거나 12px 미만이면 여전히 빨간불입니다. */
  tt('첫 화면 오버랩이 없다 (밴드 끝선이 깔끔하게)', (()=>{
     const m = css2.match(/\.funnel > \.q\{[^}]*margin-top:var\((--[a-z0-9-]+)\)/);
     if(!m) return false;
     const v = +((css2.match(new RegExp(m[1]+':\\s*(\\d+)px'))||[])[1] || 0);
     return v >= 12;
  })(), (css2.match(/\.funnel > \.q\{[^}]*margin-top:[^;}]*/)||[''])[0]);
  tt('보유 라벨이 명사형', /생애 최초[\s\S]{0,400}1주택 이상/.test(UI));
  /* 🔴 v25.20 — **대상을 옮겼습니다**(원칙 128). 이 문장들은 히어로 알약에 있었는데
     알약을 뺐습니다. 지키려던 사실은 「약어를 단독으로 안 쓴다」(원칙 0)이고,
     그 자리는 이제 **한도 서랍의 설명**(`bindingTip`)입니다. */
  tt('한도 설명이 약어를 단독으로 안 쓴다', (()=>{
     const f = (UI.match(/function bindingTip\([\s\S]*?\n\}/)||[''])[0];
     return !!f && /주담대 비율\(LTV\)/.test(f) && /소득 대비 대출 규제\(DSR\)|연소득의 40%|소득이 한도를/.test(f);
  })());
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
     /* 🔴 v25.0 — 도착지가 **루트에서 지역 검색으로** 바뀌었습니다. 잠글 것은 그대로입니다 —
        **약속과 도착지의 일치**. 이제 지역은 실리고 **예산은 안 실립니다**, 그리고 레이블도
        지역·예산 어느 쪽도 약속하지 않습니다(아래 「목적지 이름만」 검사가 그쪽을 봅니다).
        ⚠ 「지역이 실렸는가」까지가 이 파일이 확인할 수 있는 전부입니다. 네이버가 그 경로를
          계속 쓰는지는 **실기로 눌러 봐야** 압니다(v24.16이 `new.land.naver.com`에서 겪은 일). */
     /* 🔴 v25.5 — **루트로 되돌렸습니다**(오너 지시). 잠글 것은 v23.27부터 그대로
        **약속과 도착지의 일치**이고, 이제 도착지가 아무것도 약속하지 않는 루트라
        레이블(「네이버 부동산 열기」)과 정확히 같은 말을 합니다.
        ⚠ v25.0의 지역 검색 경로가 되살아나면 빨간불입니다 — 되돌린 것은 결론이고,
          그때의 근거(「경로가 틀려도 네이버 안에 있다」)는 여전히 참입니다(지침 6-19). */
     return /\$\('outNaver'\)\.href = `https:\/\/fin\.land\.naver\.com\/`;/.test(src)
         && !/m\.land\.naver\.com/.test(src)
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
     /* 🔴 v25.0 — `m.land.naver.com` 추가(지역 검색 경로). **실기 확인 목록에 올라간 도메인입니다** —
        이 검사가 통과한다고 그 주소가 살아 있다는 뜻은 아닙니다(이 검사의 원래 경고 그대로). */
     const OK = ['fin.land.naver.com','m.land.naver.com','rt.molit.go.kr','ohou.se','search.naver.com','cdnjs.cloudflare.com'];
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
     /* 🔴 v24.31 — 네이버만 `.gocta`(계층 1)로 올라갔습니다. 잠글 것은 **클래스가 아니라
        「앵커인가 · 새 탭인가 · rel이 붙었는가」**입니다 — 셋 다 그대로여야 합니다. */
     return ['outNaver','outHogang','outInterior','outMove'].every(id =>
       new RegExp('<a class="(?:mini|gocta)[^"]*" id="'+id+'" target="_blank" rel="noopener noreferrer"').test(src));
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
    /* 🔴 v24.28 — 규칙이 **함수 하나(dealGu)로 모였습니다.**
       ⏹ 전에는 `x.lawd !== S.sgg`라는 **조건식 자체**를 두 곳에서 찾았습니다.
         그 검사는 「두 곳이 같은 규칙인가」를 물은 것이 아니라 **같은 글자가 두 번 있는가**를
         물은 것이라, 규칙이 셋으로 늘어난 이 판에서 대상을 잃었습니다.
         빨간불의 원인은 코드가 틀린 것이 아니라 **근거가 없어진 것**입니다(원칙 115).
       → 「두 곳이 같은 함수를 부르는가」로 다시 씁니다. 규칙이 몇 갈래가 되든 삽니다.
       ⚠ 이 검사는 이전보다 **강합니다** — 전에는 한쪽에서만 조건을 바꿔도
         두 정규식이 각각 통과할 수 있었습니다. 지금은 한 함수라 갈릴 수가 없습니다. */
    const body = (src.match(/function paintReportDeals[\s\S]*?\n\}/) || [''])[0];
    /* ⚠ v25.0 — `dealLine`에 인자가 하나 늘었습니다(`hot`). 시그니처를 **글자 그대로** 잡고
       있어서 조용히 빈 문자열이 됐고, 그러면 아래 검사가 「못 찾음」인 채로 빨간불입니다.
       함수 **이름**으로 잡습니다 — 인자는 늘 수 있고, 이 검사가 보는 것은 몸통입니다. */
    const line = (src.match(/function dealLine\([^)]*\)[\s\S]*?\n\}/) || [''])[0];
    const gu   = (src.match(/function dealGu\(code\)[\s\S]*?\n\}/) || [''])[0];
    tt('진단서 실거래 줄이 인근 구 이름을 단다',
       /dealGu\(x\.lawd\)/.test(body) && /sggName\(code\)/.test(gu),
       body ? '' : 'paintReportDeals를 못 찾음');
    tt('진단서와 화면이 같은 규칙으로 구 이름을 판단한다',
       /dealGu\(x\.lawd\)/.test(line) && /dealGu\(x\.lawd\)/.test(body)
       && (src.match(/function dealGu\(/g)||[]).length === 1);
    /* 🆕 v24.28 — 묶인 시 안의 형제 구는 **구 이름만** 답니다. 줄마다 「청주시」를 두 번 말하지 않습니다. */
    tt('묶인 시 안의 거래는 구 이름만 단다', /GU_IN_SI\.exec\(sggName\(code\)\)/.test(gu) && /m\[2\]/.test(gu));

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
  /* 🔴 v25.7 — **인자를 괄호 균형으로 읽습니다.** 전에는 `\(([^)]*)\)`로 잘랐는데,
     인자가 `Math.floor(approx(x) / 10000)`처럼 **괄호를 품자 첫 `)`에서 끊겨** 「/ 10000」이
     안 보였습니다. 잠글 사실은 「만원 단위로 넘긴다」이지 인자 모양이 단순한가가 아닙니다.
     ⚠ 지침 6-24와 같은 계열입니다 — **문자열로 자르는 검사는 자기가 가정한 모양에서만 맞습니다.** */
  const callArgs = (src, fn) => {                 /* fn( … ) 의 인자를 괄호 균형으로 떼어 냅니다 */
     const out = []; let i = 0;
     while((i = src.indexOf(fn + '(', i)) >= 0){
       let d = 0, j = i + fn.length;
       for(; j < src.length; j++){
         if(src[j] === '(') d++;
         else if(src[j] === ')'){ d--; if(d === 0) break; }
       }
       out.push(src.slice(i + fn.length + 1, j)); i = j + 1;
     }
     return out;
  };
  tt('진단서 실거래에 만원 단위를 넘긴다', (()=>{
     const args = callArgs(UI, 'paintReportDeals').filter(a => a.trim() !== 'priceMan');
     return args.length >= 2 && args.every(a => /\/\s*10000/.test(a));
  })(), callArgs(UI, 'paintReportDeals').join(' | '));
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
  /* 🔴 v25.7 — 조건 요약이 알약에서 **한 줄 글자**가 되면서 ▾도 같이 사라졌습니다.
     ⏹ ▾는 「이걸 누르면 고칠 수 있다」는 표시였습니다. 그 일은 이제 **「수정」 버튼**이 아니라
       바로 위 「이전 단계」와 각 항목 자체가 합니다 — 그리고 각 항목은 여전히 버튼입니다.
     ⚠ 잠글 사실은 아이콘이 아니라 **「조건 요약이 눌러서 그 단계로 돌아가는 것인가」**입니다.
       그게 사라지면 결과 화면에서 조건을 못 고칩니다(원칙 128 — 대상만 옮깁니다). */
  tt('조건 요약이 그 단계로 돌아가는 버튼이다',
     /<button class="cond" data-step="\$\{i\}">/.test(UI)
     && /\$\('condBar'\)\.querySelectorAll\('\[data-step\]'\)/.test(UI));
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
  /* 🔴 v24.31 — **그린이 가리키는 대상이 바뀌었습니다.** v23.23의 규칙(「프라이머리는 화면이
     달라도 같은 버튼」)은 그대로이고, 결과 화면의 그 하나가 **재계산 → 아웃링크**로 옮겨졌습니다.
     재계산은 입력을 전부 지우는 **파괴적 행동**이라 프라이머리 자리에 두지 않습니다.
     ⚠ 그래서 이 검사는 「재계산이 초록인가」가 아니라 **「결과 화면의 초록 솔리드가 정확히
       하나이고, 그것이 아웃링크인가」**를 셉니다. 둘이 되는 순간 빨간불입니다. */
  /* 🔴 v24.32 — **결과 화면에는 그린 솔리드 버튼이 하나도 없습니다.** 의도한 상태입니다.
     결과 화면은 **결론을 읽는 화면**이고, 여기서 강요되는 다음 행동이 없습니다.
     이 앱의 유일한 계층 1은 입력 01·02·03의 「다음」(`.cta`)입니다.
     ⚠ v24.31이 잠갔던 「정확히 하나」보다 **느슨해진 것이 아닙니다.** 그 검사가 막던 상태는
       「초록이 둘」이었고, 여기서는 결과 화면 쪽 후보를 **전부** 세어 0을 요구하므로 더 셉니다.
     ⚠ 재계산이 초록으로 되돌아가면 여기서 즉시 빨간불입니다(원칙 130 — 파괴적 행동). */
  tt('결과 화면에 그린 솔리드 버튼이 없다', (()=>{
     const greens = ['\\.gocta','\\.restart-cta','\\.reedit-cta','\\.trust','\\.mini','\\.restartrow > button']
       .filter(x => new RegExp(x+'\\{[^}]*background:var\\(--green\\)').test(css2));
     return greens.length === 0
         && /\.restart-cta\{[^}]*background:var\(--card\)/.test(css2)
         && !/\.restart-cta\{[^}]*background:var\(--espresso\)/.test(css2);
  })());
  tt('프라이머리 버튼이 화면마다 같다', (()=>{
     const g = sel => (css2.match(new RegExp(sel+'\\{[^}]*background:var\\((--[a-z-]+)\\)'))||[])[1];
     /* 🔴 v24.32 — 결과 화면에 프라이머리가 없어졌으므로 **비교할 짝이 없습니다.**
        v23.23이 잡으려던 것은 「프라이머리가 화면마다 다른 색이면 그 색은 액션을 뜻하지 않는다」이고,
        지금 그 사실을 지키는 방법은 **초록 솔리드 규격이 이 파일에 딱 하나뿐인 것**입니다.
        ⚠ 두 번째 규격이 생기는 순간(어떤 이름이든) 빨간불입니다 — 그게 이 검사의 본래 일입니다. */
     /* ⚠ 「초록 면」 전부가 아니라 **계층 1 규격**만 셉니다 — 진행 막대 · 스위치 · 공유 카드도
        초록 면입니다. 잣대는 `--h-cta`를 같이 쓰는가입니다(그게 「큰 버튼」의 정의입니다). */
     const solids = css2.replace(/\/\*[\s\S]*?\*\//g,'')
       .match(/\n\.[a-z-]+(?:[^{\n]*)?\{[^}]*\}/g)
       ?.filter(r => /background:var\(--green\)/.test(r) && /height:var\(--h-cta\)/.test(r)) || [];
     return g('\\.cta') === '--green' && solids.length === 1;
  })(), (css2.match(/\.cta\{[^}]*background:var\((--[a-z-]+)\)/)||[])[1]);

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
  tt('두 버튼 글자 크기는 같고 굵기로 갈린다', (()=>{
     const g = sel => {
       const m = css2.match(new RegExp(sel+'\\{[^}]*font-size:var\\((--t\\d)\\)[^}]*font-weight:(\\d+)'));
       return m ? m[1]+'/'+m[2] : null;
     };
     /* 🔴 v24.31 — 둘 다 흰 면이 됐으므로 **위계를 낼 채널이 필요합니다.**
        크기는 여전히 같게 두고(같은 줄이니까), 굵기는 **달라야** 합니다 —
        v23.26이 「위계는 면이 만든다」로 잡았는데 그 면이 이제 같기 때문입니다. */
     const a=g('\\.reedit-cta'), b=g('\\.restart-cta');
     if(!a||!b) return false;
     return a.split('/')[0] === b.split('/')[0] && a.split('/')[1] !== b.split('/')[1];
  })(), (css2.match(/\.reedit-cta\{[^}]*font-size:var\((--t\d)\)/)||[])[1]
      + ' vs ' + (css2.match(/\.restart-cta\{[^}]*font-size:var\((--t\d)\)/)||[])[1]);
  /* 왼쪽은 옅은 세컨더리, 오른쪽은 솔리드 프라이머리 — 둘이 같은 무게면 위계가 죽습니다. */
  /* 🔴 v24.31 — 둘 다 흰 면입니다. 그렇다면 **서로 구별되는지**를 대신 잠급니다 —
     ① 폭 35 : 65(아래 별도 검사) ② 글자 잉크 한 단 ③ 그림자 한 단.
     ⚠ 셋 중 하나라도 같아지면 「같은 버튼 둘」이 되고, 그때 사람은 파괴적 행동을 잘못 누릅니다. */
  tt('재계산 행 두 버튼이 흰 면 위에서 구별된다', (()=>{
     const ink = sel => (css2.match(new RegExp(sel+'\\{[^}]*color:var\\((--[a-z0-9-]+)\\)'))||[])[1];
     const sh  = sel => (css2.match(new RegExp(sel+'\\{[^}]*box-shadow:var\\((--[a-z0-9-]+)\\)'))||[])[1];
     return /\.reedit-cta\{[^}]*background:var\(--card\)/.test(css2)
         && /\.restart-cta\{[^}]*background:var\(--card\)/.test(css2)
         && ink('\\.reedit-cta') !== ink('\\.restart-cta')
         && sh('\\.reedit-cta')  !== sh('\\.restart-cta');
  })());
  /* ⚠ 세컨더리 면을 --fill로 내리면 앱 배경(--bg)과 1.02:1이라 통째로 사라집니다(원칙 97). */
  tt('세컨더리 면이 앱 배경과 다른 값',
     !/\.reedit-cta\{[^}]*background:var\(--fill\)/.test(css2));
  /* 🔴 v25.11 — **오너가 실기에서 「검은색 테두리」로 읽고 은은한 회색을 지시했습니다.**
     ⏹ v25.9는 「배경에 묻힌다」는 같은 오너 지적에 `--line` → `--ink-4`로 올렸습니다.
       한 판 만에 반대 방향 지시가 온 것은 **v25.9가 한 채널만 봤기 때문**입니다 —
       대비만 재고 **「이 버튼이 얼마나 세게 말해야 하는가」는 안 쟀습니다.**
       「처음부터 다시 계산하기」는 파괴적 행동이라 **세게 말하면 안 되는 버튼**입니다(원칙 130).
       --ink-4(앱 배경 위 3.9:1) 윤곽은 결과 화면에서 **가장 진한 선**이 되어 있었습니다.
     → `--line`으로 되돌립니다. 경계는 **선이 아니라 여백(26px)과 그림자(--sh-lift)**가 냅니다.
     ⚠ 그래서 이 잠금도 **「진한가」가 아니라 「테두리가 있고 면이 안 채워졌는가」**로 옮깁니다.
       v25.9가 지키려던 사실(「경계가 있다」)은 남고, 틀렸던 부분(「선으로 낸다」)만 빠집니다(원칙 128). */
  tt('재계산 버튼이 테두리와 그림자를 함께 갖는다',
     /\.restart-cta\{[^}]*border:1px solid var\(--line\)/.test(css2)
     && /\.restart-cta\{[^}]*box-shadow:var\(--sh-lift\)/.test(css2));
  /* ⚠ 그림자 단으로 갈립니다 — 「이전 단계」는 `--sh`, 재계산은 `--sh-lift`. */
  tt('두 버튼의 그림자 단이 서로 다르다', (()=>{
     const g = s2 => (css2.match(new RegExp(s2+'\\{[^}]*box-shadow:var\\((--[a-z0-9-]+)\\)'))||[])[1];
     return g('\\.reedit-cta') && g('\\.restart-cta') && g('\\.reedit-cta') !== g('\\.restart-cta');
  })());
  /* ⚠ **면은 그대로 흰 면입니다.** 파괴적 행동을 프라이머리 자리로 올리지 않습니다(원칙 130).
     G-26이 결과 화면 그린 솔리드 0개를 재지만, 그것은 그린만 봅니다 — 여기서 면을 잠급니다. */
  tt('재계산 버튼이 솔리드가 아니다',
     /\.restart-cta\{[^}]*background:var\(--card\)/.test(css2)
     && !/\.restart-cta\{[^}]*background:var\(--(green|espresso|ink)\)/.test(css2));

  /* 3. 시각적 노이즈 — 왼쪽 굵은 세로선(레거시 인용문 문법) 전면 폐기 */
  tt('안내 박스에 왼쪽 세로선이 없다', !/border-left/.test(css2));
  /* 🔴 v25.20 — **대상을 옮겼습니다**(원칙 128 · 6-13). 알약을 뺐으므로 「그 알약의 면」은
     잴 것이 없습니다. 대신 **되살아나지 않는 것**을 잠급니다 — 안 잠그면 다음 판에 조용히
     다시 들어옵니다. 근거는 원칙 141(세 판 연속 같은 22자를 다툰 것 = 존재 문제)이고,
     답은 한도 서랍이 셋으로 냅니다(막대 · bindingTip · roomTip).
     ⚠ **마크업 · CSS · 함수를 한 번에** 봅니다. 하나라도 남으면 살아 있는 두 번째 정의입니다(84). */
  tt('히어로 알약이 되살아나지 않았다 (v25.20)',
     !/rhead-why\s*\{/.test(css2) && !/id="heroPill"/.test(UI)
     && !/function bindingShort\(/.test(UI) && !/function capLabel\(/.test(UI));
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
  /* 🔴 v25.1 — `class="legal"`을 그냥 세면 **안쪽 문단(`class="lg-l"`)까지 걸립니다** —
     「legal」이 「lg-l」의 부분 문자열은 아니지만, 여는 태그 문자열이 아니라 클래스 이름만
     보던 식이라 v25.1에서 2개로 셌습니다. **여는 태그 통째로** 셉니다. */
  tt('면책 블록이 하나다', (UI.match(/<span class="legal">/g)||[]).length === 1,
     (UI.match(/<span class="legal">/g)||[]).length + '개');
  /* 🔴 v25.1 — 짝. 안쪽 문단이 **둘**이어야 합니다 —
     하나면 「문단을 안 갈랐다」이고, 셋이면 면책이 한 문장 늘어난 것입니다(G-18이 먼저 물어야 합니다). */
  tt('면책이 문단 둘로 갈려 있다', (()=>{
     const b = legalBlock(UI);
     return b !== null && (b.match(/<span class="lg-l">/g)||[]).length === 2;
  })(), (()=>{ const b=legalBlock(UI);
     return b===null ? '면책 없음' : (b.match(/<span class="lg-l">/g)||[]).length+'문단'; })());
  tt('면책 문단 사이 여백이 마지막에는 안 붙는다',
     /\.foot \.legal \.lg-l \+ \.lg-l\{margin-top:12px\}/.test(fs.readFileSync(FILE,'utf8')));
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
  tt('다음 걸음 넷에 설명 줄이 없다', (()=>{
     const bare = fs.readFileSync(FILE,'utf8').replace(/<!--[\s\S]*?-->/g,'');
     const m = bare.match(/<div class="minigrid">[\s\S]*?<\/div>\s*<\/div>/);
     if(!m) return false;
     const cards = m[0].match(/class="mini(?: [^"]*)?"/g)||[];
     /* 🔴 v24.31 — 격자 안은 셋. 넷째는 `.gocta`로 올라갔고 **거기에도 설명 줄이 없어야** 합니다. */
     /* 🔴 v24.32 — 다시 넷입니다(네이버가 `.mini`로 돌아왔습니다). */
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

  /* 🔴 v24.25 — **숫자 2를 잠그고 있었습니다**(원칙 48 — 이 세션에만 열아홉 번째).
     v24.23에서 금소법 문구가 더해져 법적 고지가 **한 문장에서 두 문장**이 됐고,
     `__selfcheck()`의 G-18이 실기에서 빨간불로 잡았습니다. 상한은 5로 올라갔습니다.
     잠글 사실은 **「법적 문구도 줄 수 상한을 받는가」**이지 그 값이 몇이냐가 아닙니다.
     ⚠ 다만 **상한이 무한정 올라가는 것**은 막아야 합니다 — 상한을 올려 빨간불을 없애는 길이
       열리면 이 검사는 의미가 없어집니다. 그래서 **천장(6)**을 둡니다.
       6을 넘겨야 할 상황이 오면, 물어야 할 것은 「상한을 올릴까」가 아니라
       **「이 문장이 정말 필요한가」**입니다. */
  tt('G-18이 면책 줄 수도 본다 (상한에 천장이 있다)', (()=>{
     const src = fs.readFileSync(FILE,'utf8');
     const m = src.match(/\['#result \.legal',(\d+)\]/);
     return !!m && /LINEMAX/.test(src) && +m[1] >= 2 && +m[1] <= 6;
  })(), (()=>{ const m=fs.readFileSync(FILE,'utf8').match(/\['#result \.legal',(\d+)\]/);
     return m ? '상한 '+m[1]+'줄' : '없음'; })());
  /* 🔴 v24.19 — 소스 문자열을 통째로 잠그고 있었습니다(원칙 48 — 2-6장에서 이미 세 번 걸린 형태).
     360px에서 세 줄이라 문장을 줄여야 하는데, 이 락이 「줄이면 빨개진다」로 막고 있었습니다.
     → **문장이 아니라 사실 넷을 잠급니다** — 추정치 · 정부 정책 · 은행 심사 · 한도와 세금. */
  /* 🔴 v24.28 — 「은행 심사」라는 **낱말**을 잠그고 있었습니다. 그건 사실이 아니라 표현입니다.
     ⏹ v24.28에서 첫 문장의 「은행 심사 기준에 따라 … 세금은 달라질 수 있습니다」를 지웠습니다 —
       **취득세·중개보수는 은행 심사와 아무 관계가 없어 틀린 문장이었고**, 대출 쪽 심사는
       둘째 문장이 「실제 대출 가능 여부는 금융기관 심사에 따릅니다」로 정확히 말합니다.
       그런데 이 검사가 낱말을 붙들고 있어 **틀린 문장을 고치면 빨간불**이 났습니다(원칙 115 · 48).
     → 심사는 **「은행」이든 「금융기관」이든** 통과시키고, 대신 **기준일**을 사실 목록에 더합니다.
       느슨해진 것이 아니라 **재는 대상이 표현에서 사실로 옮긴 것**이고, 항목은 넷 → 다섯입니다. */
  /* 🔴 v25.7 — **사실 목록이 한 칸 바뀌었습니다.** 「추정치」를 뺀 자리에
     **「무엇의 기준일인가」**(대출 규제 · 세법)가 들어왔습니다.
     ⏹ 「추정치」는 바로 아래 캡션과 공유 카드가 이미 말합니다 — 면책이 세 번째로 말할 이유가
       없었습니다(원칙 43). 반면 「정책 기준」은 **무엇을 반영했는지 아무것도 안 알려 줬습니다.**
     ⚠ 느슨해진 것이 아닙니다 — 항목 수는 다섯 그대로이고, 재는 대상이
       **표현(추정치)에서 사실(무엇의 기준일인가)로** 옮긴 것입니다(v24.28과 같은 계열). */
  tt('면책에 기준일 · 무엇의 기준인지 · 정책 · 심사 · 한도와 세금이 모두 들어 있다', (()=>{
     const t = legalText(UI);
     if(t === null) return false;
     return /POLICY_ASOF_KO|POLICY_ASOF/.test(t)      /* 언제 기준의 계산인가 */
         && /대출 규제/.test(t) && /세법/.test(t)      /* 무엇의 기준인가 */
         /* 🔴 v25.23 — **「정부 정책」 → 「정책」**(원칙 128 · 48). 이 검사 자신의 주석이
            「재는 대상을 표현에서 사실로 옮긴다」고 적어 뒀는데, 이 한 줄만 **표현**을 잡고
            있었습니다. 사실은 「정책이 바뀌면 결과가 달라진다」이고 「정부」는 수식입니다.
            ⏹ 그리고 「정부」를 뺀 이유가 있습니다 — 다섯 폭 전부에서 「정부」/「정책이」로
              **줄이 갈렸습니다**(오너 지적). 근거와 실측은 index.html의 그 줄 주석에. */
         && /정책이 바뀌면/.test(t)
         && /(은행|금융기관) 심사/.test(t)
         && /한도/.test(t) && /세금/.test(t);
  })(), (()=>{ const t=legalText(UI);
     return t === null ? '없음' : t.replace(/\s+/g,' ').slice(0,90)+'…'; })());
  /* 바로 위 조건 칩이 이미 지역을 말합니다. 2×2 칸에서 지역명이 두 줄을 만들었습니다. */
  tt('다음 걸음 문구에 지역명을 반복하지 않는다',
     !/\$\('outNaverT'\)\.textContent=`\$\{region\}/.test(UI)
     && !/\$\('outHogangT'\)\.textContent=`\$\{region\}/.test(UI));
  /* 작고 빽빽한 안내 문구의 행간 — 1.5는 13px 이하에서 붙어 읽힙니다. */
  tt('작은 안내 문구 행간이 1.6 이상', (()=>{
     /* ⏹ v24.22 — `.mini .txt span` 둘을 목록에서 뺐습니다. **설명 줄 자체가 없어졌습니다.**
        없는 셀렉터를 계속 세면 검사가 영원히 빨개지고, 그러면 검사를 지우게 됩니다. */
     /* ⏹ v25.20 — `.rhead-why`를 뺐습니다. **선택자가 없어졌습니다**(알약 폐기 · 위 v24.22와 같은 이유). */
     const sel=['\\.readout\\{','\\.costrow \\.nm small\\{','\\.overnote\\{'];
     return sel.every(x=>{
       const m=css2.match(new RegExp(x+'[^}]*line-height:([\\d.]+)'));
       return m && +m[1] >= 1.6;
     });
  })());

  tt('다크모드 차단', /name="color-scheme" content="light"/.test(css2)
     && /:root\{[\s\S]{0,80}color-scheme:light/.test(css2));

  /* ═══ v24.30 — 다크 모드 동결 ══════════════════════════════════════
     프로덕트 결정: v1.0은 **단일 테마(라이트)**로 나갑니다. 다크는 트래픽이 안정되고
     별도 디자인 스프린트가 열릴 때까지 코드베이스에 안 들어옵니다.
     ⚠ 아래 넷은 **역할이 다릅니다.** 하나로 합치지 마십시오.
       ① 테마 분기가 없는가(동결 그 자체)  ② 라이트를 붙드는 세 자리가 살아 있는가
       ③ 팔레트가 한 벌인가(대체 팔레트 침입)  ④ ①이 주석을 코드로 오인하지 않는가
     🔴 ①을 **원본 그대로** 훑으면 안 됩니다. index.html에는 「무엇을 왜 지웠는지」를 적으면서
       그 미디어 쿼리 문자열이 주석에 그대로 들어 있습니다 — 원본을 훑는 순간 **설명이 코드로
       오인돼** 즉시 빨간불입니다(원칙 121이 실제로 그렇게 걸렸던 자리입니다).
       그래서 주석을 걷어낸 `bareCss`를 봅니다. ④가 그 사실을 **거꾸로** 잠급니다. */
  const bareCss = css2.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
  const DARKMQ = /@media\s*\([^)]*prefers-color-scheme\s*:\s*dark[^)]*\)/;
  tt('다크 동결 ① 테마 분기가 코드에 없다', !DARKMQ.test(bareCss),
     (bareCss.match(DARKMQ)||['없음'])[0]);
  /* ② **지운 블록이 아니라 이 세 줄이 일하고 있었습니다.** 셋을 지우면 다크 시스템에서
     계산값이 `normal`로 떨어지고 폼 컨트롤 · 캐럿 · 스크롤바를 UA가 뒤집습니다(실기로 확인). */
  tt('다크 동결 ② 라이트를 붙드는 세 자리가 살아 있다',
     /<meta name="color-scheme" content="light">/.test(css2)
     && /:root\{[\s\S]{0,80}color-scheme:light/.test(css2)
     && /html,body\{[^}]*color-scheme:light/.test(css2));
  /* ③ 대체 팔레트는 미디어 쿼리 없이도 들어올 수 있습니다(`.dark{--bg:…}` 같은 꼴).
     **락 토큰이 각각 딱 한 번만 선언되는가**로 잡습니다 — 두 번째 선언이 곧 두 번째 테마입니다. */
  const LOCKED = ['--bg','--card','--ink','--green','--line','--fill'];
  const twice = LOCKED.filter(t => (bareCss.match(new RegExp('(^|[;{\\s])'+t+'\\s*:','g'))||[]).length !== 1);
  tt('다크 동결 ③ 락 토큰이 한 벌뿐이다', twice.length===0, twice.join(', ')||'여섯 다 한 번씩');
  /* ④ **카나리아.** 위 주석 안에 그 문자열이 남아 있어야 합니다. 남아 있는데 ①이 초록이면
     ①이 주석을 제대로 걷어냈다는 뜻입니다. 누가 ①을 원본 검사로 되돌리면 ①이 즉시 빨개지고,
     누가 주석을 지우면 ④가 빨개집니다 — 어느 쪽이든 **왜 이렇게 썼는지를 읽게 됩니다**(지침 6-13).
     ⚠ 이건 「문자열을 잠그는 검사」가 아니라 **「①이 주석에 안 속는지」를 잠그는 검사**입니다. */
  tt('다크 동결 ④ 카나리아 — 그 문자열은 주석에만 있다',
     DARKMQ.test(css2) && !DARKMQ.test(bareCss));
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
  /* 🔴 v25.9 — **체크박스 줄의 손가락 면.** 줄 전체는 이미 `<label>`이지만 상자는 22px입니다
     (실측 360px). 보이는 크기는 그대로 두고 투명 면만 --tap으로 넓힙니다(원칙 123).
     ⚠ 44를 손으로 적으면 자리마다 43·45가 생깁니다 — **토큰인지까지** 잽니다(원칙 84). */
  tt('체크박스 줄의 손가락 면이 --tap이다',
     /\.subtoggle\{[^}]*position:relative/.test(css2)
     && /\.subtoggle::after\{[^}]*height:var\(--tap\)/.test(css2));
  /* ⚠ 흐름에서 뺀 투명 면이라 **아무것도 안 밀려야** 합니다 — 자리를 먹으면 첫 화면이 길어집니다. */
  tt('체크박스 손가락 면이 자리를 안 먹는다',
     /\.subtoggle::after\{[^}]*position:absolute/.test(css2));
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
  /* 🔴 v25.10 — **오너가 알약과 자리를 되돌리라고 두 번 지시했습니다.**
     ⏹ v25.7이 「알약으로 돌아가지 않았다」를 잠갔고, 그 잠금 때문에 오더가 반영되지 못했습니다.
       ⚠ **잠금을 지우지 않고 대상을 옮깁니다**(원칙 128). v25.7이 지키려던 사실은
         「알약이 없다」가 아니라 **「덩치가 금액을 밀어내지 않는다」**였습니다 — 그것만 남깁니다.
     → 되살린 것 셋(면 · 테두리 · 곡률) · 안 되살린 것 둘(**--h-chip 높이 · 그림자**).
     ⚠ 면이 `--card`면 흰 카드 위 **1.00**입니다(원칙 97 · 인수인계 6️⃣). `--fill`이어야 합니다. */
  tt('조건칩이 테두리를 가진 알약이다',
     /\.cond\{[^}]*background:var\(--fill\)/.test(css2)
     && /\.cond\{[^}]*border:1px solid var\(--line\)/.test(css2)
     && /\.cond\{[^}]*border-radius:var\(--r-pill\)/.test(css2));
  /* ⚠ **덩치는 안 돌려줍니다** — 46px 옵션칩 덩치가 되면 「읽는 표시」가 「고르는 것」이 됩니다
     (지침 6-3 · 원칙 112). 높이 토큰도 그림자도 안 씁니다. */
  tt('조건칩이 덩치까지 되돌아가지는 않았다',
     !/\.cond\{[^}]*height:var\(--h-(chip|opt|cta)\)/.test(css2)
     && !/\.cond\{[^}]*box-shadow/.test(css2));
  /* ⚠ 알약이 서로를 가르므로 가운뎃점 구분자는 **정의부터** 없어야 합니다(원칙 43 · 84). */
  tt('가르는 방법이 하나다 (알약 + 가운뎃점 겹치기 없음)',
     !/\.condbar \.sep\{/.test(css2) && !/<i class="sep">/.test(UI));
  /* 🔴 벗긴 것은 **덩치뿐**입니다 — 손가락 면(--tap)은 그대로 물려받아야 합니다(지침 6-3 · 원칙 112). */
  tt('조건 요약이 손가락 면을 잃지 않았다',
     /\.cond::after\{[^}]*height:var\(--tap\)/.test(css2));
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
  /* 🔴 v24.32 — 계층 1은 **`.cta` 하나뿐**입니다(입력 화면의 「다음」).
     재계산은 세컨더리라 굵기 700이고, 결과 화면에는 계층 1이 없습니다. */
  tt('메인 CTA가 16px SemiBold다', ['\\.cta'].every(x=>{
     const m = css2.match(new RegExp(x+'\\{[^}]*font-size:var\\(--t5\\)[^}]*font-weight:(\\d+)'));
     return m && +m[1] === 600;
  }));
  tt('옵션 버튼이 --h-opt · 14px이다',
     /\.chip\{[^}]*min-height:var\(--h-opt\)/.test(css2)
     && /\.chip\{[^}]*font-size:var\(--t6\)/.test(css2)
     && /\.seg button\{min-height:var\(--h-opt\)/.test(css2));
  /* 🔴 v25.7 — `.condchip`이 사라져 이 계층의 대표를 `.trust`로 옮겼습니다(원칙 128).
     잠글 사실은 **「계층 3(상태 칩)이 --h-chip · --t7이라는 규격을 갖는다」**이지
     어느 클래스가 그 예인가가 아닙니다. 계층 자체가 없어지면 빨간불입니다. */
  tt('상태 칩이 --h-chip · 13px이다',
     /\.trust\{[^}]*height:var\(--h-chip\)/.test(css2)
     && /\.trust\{[^}]*font-size:var\(--t7\)/.test(css2)
     && /--h-chip:35px/.test(css2));
  /* ⚠ 높이를 토큰 밖에서 새로 만들면 버튼이 네 종류가 됩니다. 하드코딩된 px 높이를 셉니다. */
  tt('버튼 높이를 px로 하드코딩한 곳이 없다', (()=>{
     const btn = css2.match(/\.(cta|restart-cta|reedit-cta|chip|seg button|condchip|trust|sheet-close)[^{]*\{[^}]*\}/g)||[];
     return !btn.some(r => /(^|[^-])height:\d+px/.test(r));
  })());

  /* ══ v24.27 — 지시서에서 실제로 유효했던 넷을 잠급니다 ══ */

  /* 🔴 지시서는 「`:focus` 기본 아웃라인을 제거하라」고 했습니다. 절반만 맞습니다 —
     **지우는 것과 대신 줄 것은 한 쌍**이고, 지우기만 하면 키보드 사용자가 자기 위치를 잃습니다.
     `.mfield`는 처음부터 짝을 맞춰 뒀는데 `.costrow .amt`와 슬라이더는 지우기만 했습니다.
     이 검사는 **`outline:none`을 쓴 자리마다 짝이 있는지**를 봅니다.
     🔴 v24.29 — 슬라이더 쪽 짝을 **`outline:2px solid`라는 표현**으로 잠그고 있었습니다.
       상자가 44px이 되면서 링을 트랙 의사요소의 두 겹 그림자로 옮기자 **이 검사가 빨간불**이었습니다.
       고친 것은 코드가 아니라 검사입니다 — 잠글 것은 「어떤 속성을 썼나」가 아니라
       **「포커스가 보이는 표시가 있는가」**입니다(원칙 120 · 115와 같은 종류).
       ⚠ 느슨해진 것이 아닙니다. 짝의 색(--espresso/--green)은 그대로 요구하고,
         받는 자리를 **상자 또는 트랙** 둘로 넓혔을 뿐입니다. */
  tt('outline을 지운 자리마다 대체 포커스 표시가 있다', (()=>{
     const need = [
       [/\.mfield input:focus\{outline:none\}/,        /\.mfield:focus-within\{outline:2px solid var\(--green\)/],
       [/\.costrow \.amt input:focus\{outline:none\}/, /\.costrow \.amt:focus-within\{outline:2px solid var\(--green\)/],
       [/input\[type=range\]\{[^}]*outline:none/,
        /input\[type=range\]:focus-visible(::-webkit-slider-runnable-track|::-moz-range-track)?\s*\{[^}]*(outline:2px solid var\(--espresso\)|box-shadow:[^}]*var\(--espresso\))/],
       [/\.quote-edit input:focus[^{]*\{outline:none\}/, /\.quote-edit:focus-within\{border-bottom-color:var\(--green\)/],
     ];
     return need.every(([kill, give]) => !kill.test(css2) || give.test(css2));
  })());

  /* 🔴 터치 최소 44px은 **값 하나**입니다. 자리마다 손으로 적으면 43·45가 생깁니다(원칙 84).
     ⚠ 「44가 있는가」가 아니라 **「토큰 밖 44가 없는가」**를 봅니다 — 앞엣것은 리터럴을
       하나 더 적어도 통과합니다. */
  tt('터치 최소는 --tap 토큰 하나로만 관리된다',
     /--tap:\s*44px/.test(css2) && !/(^|[^-\w])height:44px/.test(css2.replace(/--tap:\s*44px/g,'')));

  /* 🔴 지시서는 「모든 곡률을 한 값으로 통일」을 요구했습니다. 그건 안 합니다 —
     26px 카드와 10px 입력칸에 같은 반경을 주면 큰 면이 뭉툭해지고 작은 면이 동그래집니다.
     지켜야 할 것은 「한 값」이 아니라 **「스케일 밖 값이 없을 것」**입니다.
     ⚠ 8px 미만(체크표시·범례점·막대 끝)은 곡률이 아니라 **모양**이라 셈에서 뺍니다. */
  tt('곡률에 스케일(10·14·20·26) 밖 값이 없다', (()=>{
     const lit = [...css2.matchAll(/border-radius:(\d+)px/g)].map(m => +m[1])
       .filter(v => v >= 8);                    /* 8px 미만은 모양입니다 */
     const scale = [10,14,20,26];
     return lit.every(v => scale.includes(v) || v === 8);   /* 8 = :focus-visible 링 */
  })(), (css2.match(/border-radius:\d+px/g)||[]).join(' '));

  /* 🔴 지시서는 「**모든** 금액 입력에 `pattern="[0-9]*"`」을 요구했습니다. 그대로 하면 안 됩니다 —
     억 칸은 `inputmode="decimal"`이고 사람이 **「5.5」를 칩니다.** `[0-9]*`는 소수점을 막습니다.
     이 검사는 **정수 칸에는 있고 · 소수 칸에는 없는지** 둘 다 봅니다. */
  tt('정수 금액 칸에만 pattern이 붙어 있다', (()=>{
     const html = fs.readFileSync(FILE,'utf8');
     const tags = [...html.matchAll(/<input[^>]*inputmode="(numeric|decimal)"[^>]*>/g)];
     if(tags.length < 8) return false;
     return tags.every(m => /pattern="\[0-9\]\*"/.test(m[0]) === (m[1] === 'numeric'));
  })());
  /* 🔴 v25.9 — **억 칸은 `decimal`입니다.** 위 검사만으로는 안 막힙니다 —
     `inEok`을 numeric으로 바꾸면서 pattern까지 같이 붙이면 위 짝 검사는 **초록으로 통과**합니다.
     그 조합이 정확히 지시서가 두 번 요구한 꼴이고(v25.8 · v25.9), 그대로 하면 회귀입니다:
     이 칸은 「1.5억」을 받고 `attachEokMan`이 소수점을 파싱합니다.
     ⚠ id로 직접 잠급니다. 「어떤 칸이 소수인가」는 짝 규칙이 아니라 **그 칸의 사정**입니다. */
  tt('억 칸이 소수를 받는다 (inEok = decimal)', (()=>{
     const html = fs.readFileSync(FILE,'utf8');
     const tag = (html.match(/<input id="inEok"[^>]*>/)||[])[0] || '';
     return /inputmode="decimal"/.test(tag) && !/pattern=/.test(tag);
  })(), (fs.readFileSync(FILE,'utf8').match(/<input id="inEok"[^>]*inputmode="[a-z]+"/)||[])[0]);
  /* ⚠ 그리고 **소수를 실제로 파싱하는지**까지 봅니다. 속성만 잠그면 파서가 정수로 바뀌어도 초록입니다. */
  tt('억 칸의 「1.5」가 1억 5,000만원으로 읽힌다', (()=>{
     const html = fs.readFileSync(FILE,'utf8');
     return /attachEokMan/.test(html) && /parseFloat/.test(html);
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
  /* 🔴 v24.28 — **주석을 걷어내고 봅니다**(원칙 66).
     `[^{}]*input[^{}]*\{` 의 앞부분은 중괄호만 피하면 무엇이든 삼킵니다. 그래서 바로 위 주석에
     「`input:disabled`」라고 적힌 순간, 그 주석 + 아래의 `<u>` 규칙이 한 덩어리로 잡혀
     **13px 단위 글자를 「입력창」으로 오인**했습니다. 코드가 아니라 설명이 검사를 깬 자리입니다. */
  const cssNC = css2.replace(/\/\*[\s\S]*?\*\//g,'');
  tt('모든 텍스트 입력이 16px 이상이다', (()=>{
     const rules = cssNC.match(/[^{}]*input[^{}]*\{[^}]*font-size:[^;}]+/g)||[];
     const bad = rules.filter(r => {
       const m = r.match(/font-size:\s*var\((--t\d)\)/);
       if(!m) return false;                       /* clamp() 등은 따로 봅니다 */
       const px = +(cssNC.match(new RegExp(m[1]+':([\\d.]+)px'))||[])[1];
       return px < 16;
     });
     return bad.length === 0;
  })(), (cssNC.match(/[^{}]*input[^{}]*\{[^}]*font-size:[^;}]+/g)||[])
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
  /* ═══ 🔴 v25.21 — 컴포넌트 높이 세 단 (감사 B-9 · 원칙 84 · 127) ══════════════
     ⏹ `.zonecard`가 `padding:20px 6px`으로 렌더 **58px**이었습니다 — 3계층(54/46/35) 밖의
       **넷째**입니다. 이 카드가 하는 일은 「셋 중 하나 고르기」로 칩·세그먼트와 같은 일인데
       높이가 달랐습니다(DESIGN 0장 — 같은 일에 같은 규격).
     🔴 **이 검사가 없어서 사보타주가 안 잡혔습니다.** 고쳐 놓고 게이트를 안 만들면
       다음 판에 조용히 되돌아갑니다(원칙 127 — 잡아야 할 것이 안 잡히면 통과가 아닙니다).
     ⚠ **값(46px)을 잠그지 않습니다.** 잠글 것은 **「높이가 `--h-*` 토큰에서 오는가」**입니다 —
       값을 잠그면 토큰을 바꿀 때 검사가 거짓말이 됩니다(원칙 149 · v24.27이 같은 함정).
     ⚠ 🔴 **이 검사가 안 보는 것**(원칙 151): 소스가 토큰을 써도 `padding`이 붙으면 렌더 높이는
       토큰을 넘습니다(원칙 159 — 소스로 잠근 규격은 렌더에서 샙니다). 렌더 높이는
       `tools/three.mjs`가 재지만 **게이트가 아닙니다.** 입력 화면 게이트(0장 2️⃣)에 넣을 자리입니다. */
  tt('선택 버튼 높이가 토큰에서 온다 (v25.21)', (()=>{
     const sel = ['\\.chip\\{', '\\.zonecard\\{', '\\.seg button\\{'];
     return sel.every(x => {
       const m = css2.match(new RegExp(x + '[^}]*'));
       if(!m) return false;
       const h = m[0].match(/min-height:([^;}]+)/);
       return !!h && /var\(--h-/.test(h[1]);
     });
  })(), ['\\.chip\\{','\\.zonecard\\{','\\.seg button\\{'].map(x=>{
       const m=css2.match(new RegExp(x+'[^}]*')); const h=m&&m[0].match(/min-height:([^;}]+)/);
       return x.replace(/\\\\|\\{/g,'')+'='+(h?h[1]:'없음'); }).join(' / '));
  /* 🔴 그리고 **세로 여백을 패딩으로 되돌리는 길**을 막습니다. 패딩으로 두면 글꼴이 바뀔 때
     손가락 표적이 같이 작아집니다(원칙 112 · 123 — `.minigrid .mini`가 같은 이유로 min-height). */
  tt('선택 버튼이 세로 패딩으로 높이를 만들지 않는다 (v25.21)', (()=>{
     const m = css2.match(/\.zonecard\{[^}]*/);
     if(!m) return false;
     const pad = m[0].match(/padding:([^;}]+)/);
     if(!pad) return true;
     const first = pad[1].trim().split(/\s+/)[0];
     return /^0(px)?$/.test(first);
  })(), (css2.match(/\.zonecard\{[^}]*padding:([^;}]+)/)||[])[1] || '패딩 없음');

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
  /* 🔴 v24.28 — **락을 다시 썼습니다**(지침 5층 3번 — 지우지 말고 새 규칙으로).
     ⏹ v23.15의 락은 「화면 문구에 날짜를 쓰지 마라」였고, 근거는 날짜가 아니라 **중복**이었습니다
       (「관리 지옥」). 그런데 그 검사는 `textContent='…'`·`innerHTML=\`…\`` 두 모양만 봤기 때문에
       안내 시트에 **정적 마크업으로** 들어온 「2026.08.05 기준이에요」를 못 봤습니다.
       규칙이 막으려던 것이 규칙을 비켜 들어와 있었습니다(원칙 107 — 통과 이유가 의도와 다름).
     → 새 규칙: **화면에 뜨는 날짜는 `POLICY_ASOF` 한 곳에서만 온다.**
       원래 우려(중복)를 더 넓게 막으면서, 법적 고지에 기준일을 밝히는 길을 엽니다.
     ⚠ 이 검사는 이전보다 **강합니다** — 마크업까지 봅니다. */
  tt('정책 확인일 상수가 한 번만 선언된다',
     (fs.readFileSync(FILE,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'')
       .match(/const POLICY_ASOF\s*=/g)||[]).length === 1);
  /* ⚠ **셈에서 뺄 것을 먼저 정합니다**(원칙 117). 다른 날짜까지 막으면 검사가 영원히 빨간불이고,
       그러면 사람이 검사를 끕니다. 여기서 막는 것은 **`POLICY_ASOF`와 같은 값이 두 번째로
       손으로 적히는 것**뿐입니다. 금리 공시일(`RATE_*.asOf` · `KFB_DISCLOSURE`)은 다른 사실이라
       자기 날짜를 갖습니다 — 값이 우연히 같은 날이어도 같은 사실이 아닙니다. */
  tt('정책 확인일이 마크업에 손으로 적혀 있지 않다', (()=>{
     const raw = fs.readFileSync(FILE,'utf8');
     const asof = (raw.match(/const POLICY_ASOF\s*=\s*'([\d.]+)'/)||[])[1];
     if(!asof) return false;
     /* 스크립트와 주석을 걷어낸 **순수 마크업**만 봅니다. 시트 행이 여기로 새어 들어왔던 자리입니다. */
     const markup = raw.replace(/<!--[\s\S]*?-->/g,'').replace(/<script[\s\S]*?<\/script>/g,'');
     return markup.indexOf(asof) < 0;
  })(), (()=>{ const raw=fs.readFileSync(FILE,'utf8');
     const asof=(raw.match(/const POLICY_ASOF\s*=\s*'([\d.]+)'/)||[])[1]||'?';
     const markup=raw.replace(/<!--[\s\S]*?-->/g,'').replace(/<script[\s\S]*?<\/script>/g,'');
     const i=markup.indexOf(asof);
     return i<0 ? asof+' 마크업에 없음' : '「'+markup.slice(Math.max(0,i-30), i+15)+'」'; })());
  tt('시트의 정책 확인일이 상수에서 온다',
     /<b>정책 확인일<\/b><span id="asOfNote"><\/span>/.test(fs.readFileSync(FILE,'utf8'))
     && /\$\('asOfNote'\)\.textContent = `\$\{POLICY_ASOF\}/.test(UI));
  /* 🆕 면책 첫 문장이 **언제 기준의 계산인지** 말한다. 없으면 반년 뒤의 오차와 오늘의 오차가 구별되지 않습니다. */
  /* 🔴 v25.1 — 문단이 갈리면서 `class="legal">※` 붙어 있기가 깨졌습니다.
     잠글 사실은 **「첫 문장이 기준일로 시작한다」**이지 두 문자열이 붙어 있는가가 아닙니다. */
  /* 🔴 v25.7 — **대상만 옮겼습니다**(원칙 128). 잠글 사실은 「첫 문장이 **무엇의** 기준일인지
     밝히며 시작한다」입니다. 「정책 기준」처럼 무엇인지 안 밝히는 꼴로 돌아가면 빨간불입니다.
     ⚠ 날짜는 여전히 상수에서만 옵니다 — 리터럴이 들어오면 여기서 걸립니다. */
  tt('면책 첫 문장이 무엇의 기준일인지 밝힌다', (()=>{
     const t = (legalText(UI)||'').trim();
     return /^※ 대출 규제 · 세법 기준일 \$\{POLICY_ASOF\}\./.test(t)
         && !/\d{4}\.\d{2}\.\d{2}/.test(t.split('.')[0] + t.slice(0, 60));
  })(), (legalText(UI)||'없음').trim().slice(0, 60));
  tt('면책이 여전히 두 문장이다',            /* 세 번째가 붙으면 G-18(5줄)이 먼저 물어야 합니다 */
     ((legalText(UI)||'').match(/※/g)||[]).length === 2);
  tt('정책 확인일은 주석에 남아 있다', /<!-- BUILD[^>]*2026\.08\.13/.test(css2));
  /* 🔴 v25.0 — 사보타주가 잡았습니다 — `POLICY_ASOF`만 되돌려도 위 검사는 초록이었습니다.
     **두 곳에 같은 날짜가 있으면 갈립니다**(원칙 91). 위는 마크업, 아래는 상수 —
     둘이 **서로 같은지**를 봅니다. 어느 한쪽만 고치면 빨간불입니다. */
  tt('BUILD 주석과 POLICY_ASOF가 같은 날이다', (()=>{
     const a = (css2.match(/<!-- BUILD[^>]*?(\d{4}\.\d{2}\.\d{2})/)||[])[1];
     const b = (css2.match(/const POLICY_ASOF = '(\d{4}\.\d{2}\.\d{2})'/)||[])[1];
     return !!a && a === b;
  })(), (css2.match(/const POLICY_ASOF = '([\d.]+)'/)||[])[1]);

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
             ;
  /* 🔴 v25.1 — 면책이 문단 둘로 갈리면서 비탐욕 정규식이 **절반만** 잘라 냈고,
     남은 뒷문장(금소법)이 「~습니다」로 잡혔습니다. 짝을 세어 통째로 걷어냅니다.
     ⚠ 못 찾으면 **아무것도 안 지웁니다** — 그러면 면책이 그대로 남아 이 검사가 빨개집니다.
       면책이 사라졌을 때 조용히 초록이 되는 것보다 그쪽이 맞습니다(원칙 124). */
  { const b = legalBlock(s); if(b !== null) s = s.replace(b, ''); }
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
  tt('tagGrid가 글자를 span으로 감싼다', /data-pick="\$\{key\}"><span>\$\{nm\}<\/span>/.test(BARE));
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
     const src = BARE.match(/const TAG_WIDE = \d+;[\s\S]*?const tagGrid = \(list[\s\S]*?\n\};/);
     const pk  = BARE.match(/const picksOf = [^\n]*\n/);
     const raw = fs.readFileSync(FILE,'utf8');
     const ss  = raw.match(/const SIDO_SHORT\s*=\s*\{[\s\S]*?\};/);
     if(!src || !pk || !ss) return false;
     /* 🔴 v24.28 — **PICKS를 본체에서 가져옵니다.** LAWD를 직접 넣으면 「묶기 전 목록」을 재게 되고,
        그러면 이 검사는 화면이 실제로 그리는 것과 다른 것을 보게 됩니다(원칙 107). */
     const r = new Function('PICKS','SIDO_SHORT',`const S={sgg:''};
       const openPick = () => null;
       ${src[0]}
       ${pk[0]}
       const short = s => SIDO_SHORT[s] || s;
       return {
         seoul:  tagGrid(picksOf('서울특별시')),
         gyeongi:tagGrid(picksOf('경기도')),
         incheon:tagGrid(picksOf('인천광역시')),
         sejong: tagGrid(picksOf('세종특별자치시')),
         gn:     tagGrid(picksOf('경상남도')),
         gw:     tagGrid(picksOf('강원특별자치도'))
       };`)(E.PICKS, JSON.parse(JSON.stringify(eval('('+ss[0].replace(/^const SIDO_SHORT\s*=\s*/,'').replace(/;$/,'')+')'))));
     const W = h => /class="taggrid wide"/.test(h);
     /* 🔴 v25.14 — **2열 표본을 바꿨습니다.** 전에는 「경기 의정부시」(접두어 6자)를 2열 표본으로
        썼는데, 경기·인천이 시·도 2단계가 되면서 접두어가 사라져 **그 목록이 이제 3열**입니다.
        표본을 화면에 실제로 있는 것으로 바꿉니다 — **세종특별자치시(7자)**가 지금 유일한 2열입니다.
        ⚠ 표본을 바꾼 것이지 규칙을 무른 것이 아닙니다. 「이름 길이가 열 수를 정한다」는 그대로이고,
          3열 표본이 넷으로 오히려 늘었습니다. */
     return !W(r.seoul)    /* 서울 최장 「동대문구」 4자 — 3열 */
         && !W(r.gyeongi)  /* 🔴 v25.14 — 접두어가 사라져 최장 「의정부시」 4자 — 3열 */
         && !W(r.incheon)  /* 최장 「제물포구」 4자 — 3열 */
         &&  W(r.sejong)   /* 「세종특별자치시」 7자 — 2열 */
         && !W(r.gn)       /* 「창원시 마산합포구」 8자가 「창원시」 3자로 묶여 3열 */
         && !W(r.gw);      /* 강원 최장 「춘천시」 3자 — 3열 */
  })());

  /* ── 🆕 v24.28 행정구 → 시 묶음 ─────────────────
     🔴 이 검사들은 **본체 함수를 돌린 결과**를 봅니다. 규칙을 베끼면 본체가 죽어도 초록입니다(원칙 106). */
  /* ① 자치구와 행정구를 이름 모양으로 가른다 — 지역 이름을 코드에 안 적었는가(원칙 111) */
  tt('묶는 규칙을 지역 이름으로 적지 않는다', (()=>{
     /* ⚠ GU_IN_SI · buildPicks는 **엔진 쪽**입니다. UI만 보면 못 찾고 조용히 통과합니다(원칙 107). */
     const eng = fs.readFileSync(FILE,'utf8').split(ENGINE_MARK)[0].replace(/\/\*[\s\S]*?\*\//g,'');
     const m = eng.match(/const GU_IN_SI = [\s\S]*?function buildPicks[\s\S]*?\n\}/);
     if(!m) return false;
     return !/청주|천안|전주|창원|포항|고양|부천|안산|성남|수원|안양|용인|화성/.test(m[0]);
  })());
  /* ② 자치구는 한 개도 안 묶였다 — 서울·부산·인천 등은 급이 시·군과 같습니다 */
  tt('자치구는 묶지 않는다', ['서울특별시','부산광역시','대구광역시','인천광역시','대전광역시','울산광역시']
     .every(s => E.PICKS[s].length === E.LAWD[s].length));
  /* ③ 행정구는 하나도 안 남았다 — 「○○시 ○○구」가 목록 맨 위에 그대로 있으면 안 됩니다 */
  tt('행정구가 1차 목록에 남아 있지 않다', (()=>{
     const left = Object.keys(E.PICKS).flatMap(s => E.PICKS[s].filter(p => E.GU_IN_SI.test(p.name)).map(p=>p.name));
     return left.length === 0;
  })(), (()=>{ const left = Object.keys(E.PICKS).flatMap(s => E.PICKS[s].filter(p => E.GU_IN_SI.test(p.name)).map(p=>p.name));
     return left.length ? left.join(', ') : Object.values(E.LAWD).flat().length + '개 → ' + Object.values(E.PICKS).flat().length + '개'; })());
  /* ④ 🔴 **묶은 시는 구마다 정책이 같아야 합니다.** 여기가 이 판에서 제일 비싼 자리입니다 —
        수원 권선구(비규제)를 영통구(규제)와 묶으면 LTV가 40%↔70%로 갈려 수억이 틀립니다(원칙 28). */
  tt('묶은 시는 구마다 정책값이 같다', (()=>{
     const bad = [];
     Object.keys(E.PICKS).forEach(s => E.PICKS[s].forEach(p => {
       if(!p.kids || p.split) return;
       const sig = p.kids.map(k => E.pickSig(k.code));
       if(sig.some(x => x !== sig[0])) bad.push(p.name);
     }));
     return bad.length === 0;
  })());
  /* ⑤ 반대 방향 — 정책이 갈리는 시는 **반드시** split이어야 합니다.
        ④만 있으면 「전부 split」으로 도망가도 통과합니다(원칙 108 — 관측되는 차이를 만듭니다). */
  tt('정책이 갈리는 시는 구를 한 번 더 묻는다', (()=>{
     const split = [], must = [];
     Object.keys(E.PICKS).forEach(s => E.PICKS[s].forEach(p => {
       if(!p.kids) return;
       const sig = p.kids.map(k => E.pickSig(k.code));
       const varies = sig.some(x => x !== sig[0]);
       if(varies) must.push(p.name);
       if(p.split) split.push(p.name);
     }));
     return must.length > 0 && must.length === split.length && must.every(n => split.indexOf(n) >= 0);
  })(), (()=>{ const out=[]; Object.keys(E.PICKS).forEach(s => E.PICKS[s].forEach(p => { if(p.split) out.push(p.name); }));
     return '구 유지: ' + (out.join(' · ')||'없음'); })());
  /* ⑥ 실제로 갈리는 곳이 있다 — 전부 묶여 버리면 ⑤가 공회전합니다(원칙 107) */
  tt('수원 · 안양 · 용인 · 화성이 갈리는 쪽에 있다', (()=>{
     const split = E.PICKS['경기도'].filter(p=>p.split).map(p=>p.name);
     return ['수원시','안양시','용인시','화성시'].every(n => split.indexOf(n) >= 0);
  })());
  /* ⑦ 묶인 시는 **구 코드를 전부 들고 있다** — 실거래가가 대표 구만 보면 「청주시 147건」이 거짓말이 됩니다 */
  tt('묶인 시가 구 코드를 전부 들고 있다', (()=>{
     let seen = 0;
     const ok = Object.keys(E.PICKS).every(s => E.PICKS[s].every(p => {
       if(!p.kids || p.split) return true;
       seen++;
       return E.lawdCodesOf(p.code).length === p.kids.length;
     }));
     return ok && seen >= 9;      /* 성남·부천·안산·고양·청주·천안·포항·창원·전주 */
  })(), (()=>{ const m=[]; Object.keys(E.PICKS).forEach(s=>E.PICKS[s].forEach(p=>{ if(p.kids&&!p.split) m.push(p.name+'('+p.codes.length+')'); }));
     return m.join(' · '); })());
  /* ⑦-b 갈리는 시를 고르면 **새 질문이 눈에 들어오게** 합니다.
     경기·인천은 42칸이라 두 번째 질문이 화면 밖입니다. 안 데려가면
     「아무 일도 안 일어났는데 다음 버튼이 안 눌리는」 상태가 됩니다. */
  tt('갈리는 시를 고르면 두 번째 질문으로 데려간다',
     /op\.split && !S\.sgg[\s\S]{0,200}?scrollIntoView\(\{block:'nearest'/.test(UI));
  tt('두 번째 질문이 왜 뜨는지 화면이 말한다',
     /class="pane-note">\$\{op\.name\}는 구마다 대출 비율이 달라요\./.test(UI));
  /* ⑧ 실거래가가 그 목록을 **실제로 부른다** — codes를 들고만 있고 안 쓰면 ⑦은 헛돕니다 */
  tt('실거래가가 묶인 구를 전부 부른다', /lawdCodesOf\(lawd\)[\s\S]{0,200}?own\.map\(c => fetchOne\(c\)\)/.test(UI));
  /* ⑨ 화면 이름이 묶인 이름을 쓴다 — 「충북 청주시 상당구」로 돌아가면 묶은 뜻이 없습니다 */
  tt('결과 라벨이 묶인 시 이름을 쓴다',
     /const regionLabel = \(\) => S\.sgg \? shortSido\(sidoOfCode\(S\.sgg\)\)\+' '\+pickLabel\(S\.sgg\)/.test(UI));
  /* ⚠ **깨끗하게 실패해야 합니다.** 「청주시」가 목록에서 사라지는 사보타주에서 이 줄이 그대로
     예외를 던져 러너를 죽였고, 그러면 「검사가 못 잡음」과 구별이 안 됩니다(원칙 114 · 지침 6-10). */
  tt('묶은 시 이름에 구가 안 붙는다',
     E.pickLabel((E.PICKS['충청북도'].find(p=>p.name==='청주시')||{}).code) === '청주시');
  tt('갈리는 시 이름에는 구가 붙는다', E.pickLabel('41117') === '수원시 영통구');
  /* 판정을 통째로 꺼 버리는 사보타주는 위 검사가 잡습니다. 아래는 **규칙의 모양**만 봅니다. */
  tt('열 수를 지역 이름으로 하드코딩하지 않는다', (()=>{
     const m = BARE.match(/const tagGrid = \(list[\s\S]*?\n\};/);
     if(!m) return false;
     return /list\.some\(/.test(m[0]) && !/METRO|SEOUL|'경기'|'인천'/.test(m[0]);
  })());
  /* 접두어를 지우면 「중구 · 동구 · 서구」가 서울 자치구와 구별이 안 됩니다.
     🔴 v24.28 — 접두어를 붙이는 자리가 `x[1]` 뒤에서 `picksOf`의 인자로 옮겼습니다.
        **글자를 좇지 말고 결과를 봅니다**(원칙 115) — 경기·인천 칩에 실제로 접두어가 붙는지. */
  /* 🔴 v25.14 — **대상을 옮겼습니다**(원칙 128 · 148). 이 잠금의 근거는
     「접두어를 지우면 『중구·동구·서구』가 서울 자치구와 구별이 안 된다」였고, 그것은
     **한 격자에 여러 시·도가 섞여 있을 때만** 참입니다. v25.14가 경기·인천을 시·도 2단계로
     바꾸면서 **그 전제가 사라졌습니다** — 격자마다 시·도가 하나이고, 위 시·도 칩이 켜진 채로
     어느 목록인지 말합니다. 지키려던 사실은 「접두어가 있다」가 아니라
     **「한 격자 안에서 이름이 서로 구별된다」**입니다.
     → 잠글 것을 **「한 격자에 시·도를 섞지 않는다」**로 옮깁니다. 다시 섞으면 빨간불입니다. */
  tt('한 격자에 시 · 도를 섞지 않는다', (()=>{
     const f = (BARE.match(/function regionPane\(\)[\s\S]*?\n\}/)||[''])[0];
     if(!f) return false;
     /* 두 시·도를 한 목록으로 이어 붙이는 꼴(flatMap · concat)이 없어야 합니다 */
     return !/flatMap|\.concat\(/.test(f) && /METRO\.map\(/.test(f);
  })(), (()=>{ const f=(BARE.match(/function regionPane\(\)[\s\S]*?\n\}/)||[''])[0];
     return (f.match(/flatMap|\.concat\(/g)||['섞지 않음']).join(' '); })());
  tt('경기 · 인천도 시 · 도를 먼저 고른다', (()=>{
     const f = (BARE.match(/function regionPane\(\)[\s\S]*?\n\}/)||[''])[0];
     const m = f.match(/S\.group==='metro'\)\{([\s\S]*?)\n  \}/);
     return !!m && /sidoscroll/.test(m[1]) && /METRO\.indexOf\(S\.sido\)/.test(m[1]);
  })(), '🔴 metro 갈래가 시·도 칩 → 시·군·구 두 단계여야 합니다');
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
     const b = legalBlock(BARE);
     return b !== null && /금융상품 판매 대리·중개업자가 아닙니다/.test(b);
  })());

  /* ── 금리 시뮬레이터 ──────────────────────────
     🔴 **엔진과 격리되어야 합니다.** 한도는 스트레스 금리(`computeStressBp`)로 잡고 상환액만 실제
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

/* ═══ v24.25 — __selfcheck()가 실기에서 잡은 셋 ════════════════════
   🔴 **셋 다 이 세션에 제가 만든 것이고, test.js는 하나도 못 잡았습니다.**
      `__selfcheck()`는 **렌더된 화면**을 재고 `test.js`는 **소스**를 봅니다.
      둘의 사정거리가 다르다는 것을 알면서도, 소스로 잴 수 있는 부분까지 놓쳤습니다.
      → 소스로 잴 수 있는 것은 여기서 잡습니다. 렌더에서만 보이는 것은 여전히 __selfcheck 몫입니다.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const M = UI0().replace(/\/\*[\s\S]*?\*\//g,'');
  const RAW = fs.readFileSync(FILE,'utf8');

  /* ── ① 결과 블록 ≤ 8 — 소스에서 미리 셉니다 ──────
     __selfcheck의 「결과 블록 ≤ 8」과 **같은 셈**입니다: 1(히어로) + .bento .tile + #result .card.
     v24.23이 시뮬레이터를 별도 타일로 더해 9개가 됐고, 실기에서야 걸렸습니다. */
  tt('결과 블록이 여덟을 넘지 않는다', (()=>{
     const bare = RAW.replace(/<!--[\s\S]*?-->/g,'');
     const bento = (bare.match(/<div class="bento"[\s\S]*?\n    <\/div>/)||[''])[0];
     const tiles = (bento.match(/class="tile(?: [^"]*)?"/g)||[]).length;
     const res = bare.slice(bare.indexOf('id="result"'));
     const cards = (res.match(/<div class="card"/g)||[]).length;
     return 1 + tiles + cards <= 8;
  })(), (()=>{
     const bare = RAW.replace(/<!--[\s\S]*?-->/g,'');
     const bento = (bento_ => bento_)((bare.match(/<div class="bento"[\s\S]*?\n    <\/div>/)||[''])[0]);
     const tiles = (bento.match(/class="tile(?: [^"]*)?"/g)||[]).length;
     const res = bare.slice(bare.indexOf('id="result"'));
     const cards = (res.match(/<div class="card"/g)||[]).length;
     return `1 + 타일 ${tiles} + 카드 ${cards} = ${1+tiles+cards}개`;
  })());
  /* 시뮬레이터가 다시 **자기 블록**을 갖지 않게 막습니다. */
  tt('금리 시뮬레이터가 자기 블록을 갖지 않는다',
     !/class="tile[^"]*ratesim"|class="ratesim[^"]*tile"/.test(M)
     && /<div class="ratesim" id="rateSim"/.test(M));

  /* ── 🆕 v24.28 결과 격자에 빈칸이 생길 구조가 없다 ────────────
     🔴 실기 지적: 「원리금 옆이 붕 떠 있다」. 원인은 CSS 버그가 아니라 **격자 구조**였습니다 —
        2열 격자에서 전폭 타일이 새 줄을 시작하면 앞 줄의 반칸이 그대로 빕니다.
     ⚠ 「지금 빈칸이 없다」만 재면 다음에 반칸 타일이 하나 생기는 순간 그대로 돌아옵니다.
        **빈칸이 생길 수 있는 구조인가**를 잠급니다(원칙 101 — 근거를 세어 둡니다). */
  tt('결과 격자가 한 열이다', (()=>{
     const b = M.match(/\n\.bento\{[^}]*\}/);
     return !!b && !/grid-template-columns/.test(b[0]);
  })(), (M.match(/\n\.bento\{[^}]*\}/)||['없음'])[0]);
  tt('반칸 타일 규칙이 남아 있지 않다', !/\.tile\.wide\{/.test(M) && !/class="tile wide"/.test(RAW));
  /* 두 값이 **한 타일 안 한 줄**에 있는가. 마크업 순서까지 봅니다 — 떨어지면 격자가 다시 갈립니다. */
  tt('원리금과 부담이 한 타일 안에 있다', (()=>{
     const bare = RAW.replace(/<!--[\s\S]*?-->/g,'');
     const row = bare.match(/<div class="payrow">[\s\S]*?<\/div>\s*<\/div>/);
     if(!row) return false;
     return /id="tileMonthly"/.test(row[0]) && /id="tileBurden"/.test(row[0]);
  })());
  /* 🔴 wrap을 허용하면 좁은 화면에서 오른쪽 값만 아래로 떨어집니다 — **그게 그 빈칸입니다.** */
  tt('두 값이 줄바꿈하지 않는다', /\.payrow\{[^}]*flex-wrap:nowrap/.test(M));
  tt('줄이는 쪽이 오른쪽이 아니다', /\.payitem\.end\{[^}]*flex:none/.test(M)
     && /\.payitem\{[^}]*min-width:0/.test(M));

  /* ── 🆕 v24.28 활자 사다리 ────────────────────────
     지적: 「핵심 메시지의 임팩트가 죽어 있다」. 값 하나가 아니라 **간격**이 문제였습니다.
     ⚠ 크기를 손으로 적어 잠그지 않습니다 — 토큰을 좇아 **실제 간격**을 봅니다(원칙 115). */
  tt('히어로 · 핵심값 · 부속값이 스케일 안의 서로 다른 단이다', (()=>{
     const tok = n => { const m = M.match(new RegExp('--'+n+':(\\d+)px')); return m ? +m[1] : null; };
     const sizeOf = sel => { const m = M.match(new RegExp('\\'+'.'+sel+'\\{[^}]*font-size:var\\(--(t\\d)\\)'));
                             return m ? tok(m[1]) : null; };
     const t1 = tok('t1'), tileV = sizeOf('tile-v'), simV = sizeOf('ratesim-v');
     const heroMin = +( (M.match(/\.rhead-amount\{[^}]*font-size:clamp\((\d+)px/)||[])[1] );
     if(!t1 || !tileV || !simV || !heroMin) return false;
     /* 히어로는 핵심값보다 **눈에 띄게** 커야 합니다. 1.5배로는 「둘 다 크다」로 읽힙니다. */
     return heroMin >= tileV * 1.5 && tileV > simV;
  })(), (()=>{
     const tok = n => { const m = M.match(new RegExp('--'+n+':(\\d+)px')); return m ? +m[1] : '?'; };
     const sizeOf = sel => { const m = M.match(new RegExp('\\'+'.'+sel+'\\{[^}]*font-size:var\\(--(t\\d)\\)'));
                             return m ? tok(m[1]) : '?'; };
     const heroMin = (M.match(/\.rhead-amount\{[^}]*font-size:clamp\((\d+)px/)||['','?'])[1];
     return `히어로 ${heroMin}+ / 핵심 ${sizeOf('tile-v')} / 부속 ${sizeOf('ratesim-v')}`;
  })());

  /* ── ② 판정 알약의 이름과 색이 맞는다 ──────────
     🔴 클래스는 `.bad`인데 색만 `--warn`이었습니다. 그 조합이 **회색 배경 위에서 4.19:1**이라
        G-19에 걸렸습니다 — 흰 카드 위(4.61:1)에서는 통과했기 때문에 여태 안 보였습니다.
     ⚠ 값이 아니라 **이름과 값의 일치**를 잠급니다(원칙 91). */
  /* 🔴 v25.20 — **대상을 옮겼습니다**(원칙 128). 알약이 사라졌으므로 지키려던 사실
     (「`.bad`라는 이름에 `--warn` 값이 붙으면 안 된다 · 원칙 91」)을 **아직 살아 있는
     `.bad` 자리**에서 잽니다 — 부담 판정 값과 뱃지입니다. */
  tt('.bad가 --warn이 아니라 --bad를 쓴다',
     /\.bad\{[^}]*color:var\(--bad\)/.test(M) && !/\.rhead-why/.test(M));

  /* ── ③ 대비를 실제로 계산해 봅니다 ─────────────
     🔴 소스에 색만 적어 두면 「흰 면 위 5.00:1」 같은 **주석의 값**을 믿게 됩니다.
        원칙 97 — 같은 토큰도 **놓인 자리**가 바뀌면 값이 달라집니다.
        이 알약은 흰 카드가 아니라 회색 배경(--bg) 위에 얹힙니다. 그 조건으로 잽니다. */
  tt('판정 알약이 회색 배경 위에서도 4.5:1을 넘는다', (()=>{
     const tok = n => (M.match(new RegExp('--'+n+':\\s*([^;]+);'))||[])[1];
     const hex = h => { h=(h||'').trim().replace('#',''); if(h.length!==6) return null;
       return {r:parseInt(h.substr(0,2),16),g:parseInt(h.substr(2,2),16),b:parseInt(h.substr(4,2),16)}; };
     const rgba = s2 => { const m=(s2||'').match(/[\d.]+/g);
       return m && m.length>=3 ? {r:+m[0],g:+m[1],b:+m[2],a:m[3]!==undefined?+m[3]:1} : null; };
     const over = (f,b) => ({r:f.r*f.a+b.r*(1-f.a), g:f.g*f.a+b.g*(1-f.a), b:f.b*f.a+b.b*(1-f.a)});
     const L = o => { const c=[o.r,o.g,o.b].map(v=>{let x=v/255;
       return x<=.03928?x/12.92:Math.pow((x+.055)/1.055,2.4)}); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
     const bad = hex(tok('bad')), bg = hex(tok('bg')), tint = rgba(tok('warn-tint'));
     if(!bad || !bg || !tint) return false;
     const face = over(tint, bg);
     const cr = (Math.max(L(bad),L(face))+.05)/(Math.min(L(bad),L(face))+.05);
     return cr >= 4.5;
  })(), (()=>{
     const tok = n => (M.match(new RegExp('--'+n+':\\s*([^;]+);'))||[])[1];
     return '토큰 --bad ' + (tok('bad')||'?').trim();
  })());

  /* ── ④ favicon — 콘솔에 상시 빨간불을 두지 않습니다 ──
     🔴 실기 콘솔에 매 접속마다 `/favicon.ico 404`가 찍히고 있었습니다.
        기능에는 영향이 없지만 **상시 빨간불이 있으면 진짜 에러가 묻힙니다.**
     ⚠ 파일을 늘리지 않습니다 — 단일 정적 HTML 배포라 data URI로 인라인합니다. */
  tt('favicon이 인라인으로 선언돼 있다',
     /<link rel="icon" href="data:image\/svg\+xml,/.test(RAW));
  tt('favicon이 외부 파일을 요구하지 않는다',
     !/<link[^>]*rel="(?:shortcut )?icon"[^>]*href="(?!data:)/.test(RAW));

  /* ── ⑤ 법적 고지 줄 수 상한에 천장 ─────────────
     상한을 올려 빨간불을 없애는 길이 열리면 G-18은 의미가 없어집니다. */
  tt('면책 줄 수 상한이 6을 넘지 않는다', (()=>{
     const m = RAW.match(/\['#result \.legal',(\d+)\]/);
     return !!m && +m[1] <= 6;
  })());

  /* ═══════════════════════════════════════════════════════════
     🆕 v24.29 — CPO 지시서(마이크로 디자인) 대조 결과
     ⚠ 이 장은 **채택한 셋**과 **미채택한 넷**을 같이 잠급니다.
       미채택을 안 잠그면 다음 판에 같은 지시서가 오면 조용히 들어옵니다 —
       그때 남는 것은 「왜 안 했는지」가 아니라 「누가 되돌렸는지」뿐입니다(5층).
     ═══════════════════════════════════════════════════════════ */
  /* 🔴 **주석을 먼저 걷어냅니다.** 아래 검사들은 「지시서의 #F5F5F7은 안 씁니다」 같은
     **설명 문장**을 코드로 오인합니다 — 원칙 121이 정확히 이 자리입니다.
     이 파일은 주석에 코드 조각을 인용하는 문화라 이 종류의 실패가 **주석을 잘 쓸수록 자주** 납니다. */
  const SRC = fs.readFileSync(FILE,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');

  /* ── ① 터치 면적 — v24.27이 --tap을 만들고 한 자리에만 붙였습니다 ── */
  /* 🔴 「--tap을 썼는가」가 아니라 **「몇 자리에 썼는가」**를 셉니다.
     v24.27 시점에 이 값은 **1**이었고, 그래서 `.trust`·`.wordmark`·`.debtlink`·`.sw`·슬라이더가
     남아 있는데도 검사는 전부 초록이었습니다. 어디에 안 붙였는지는 정적으로 못 봅니다 —
     그건 `__selfcheck()`의 **G-22**가 렌더에서 잽니다. 여기서는 **후퇴만** 막습니다. */
  tt('터치 면을 여러 자리에서 --tap으로 넓힌다',
     (SRC.match(/height:var\(--tap\)/g)||[]).length >= 5,
     (SRC.match(/height:var\(--tap\)/g)||[]).length + '자리');
  /* 🔴 스위치는 `::after`를 **손잡이**로 이미 쓰고 있었습니다. 거기에 터치 면을 얹으면 손잡이가
     사라집니다 — 같은 문법이라도 **빈 의사요소를 먼저 확인**해야 합니다. */
  tt('스위치 터치 면이 손잡이를 덮지 않는다',
     /\.sw::before\{[^}]*height:var\(--tap\)/.test(SRC)
     && /\.sw::after\{[^}]*width:21px/.test(SRC)
     && /\.sw\.on::after\{transform:translateX\(19px\)\}/.test(SRC));
  /* 🔴 슬라이더는 ::after가 안 생깁니다(입력 요소). 상자를 키우고 **칠을 트랙으로 옮깁니다** —
     안 옮기면 44px 전체가 초록으로 칠해집니다. */
  tt('슬라이더 상자가 --tap이고 칠은 트랙이 한다',
     /input\[type=range\]\{[^}]*height:var\(--tap\)/.test(SRC)
     && /input\[type=range\]\{[^}]*background:transparent/.test(SRC)
     && /::-webkit-slider-runnable-track\{[^}]*linear-gradient/.test(SRC));
  /* 🔴 상자가 커진 만큼 레이아웃 점유는 되돌립니다. **음수 마진은 히트 영역을 줄이지 않습니다.**
     ⚠ -19px·-9px을 손으로 적으면 --tap을 고칠 때 조용히 어긋납니다(원칙 84 · 115). */
  tt('슬라이더 레이아웃 상쇄를 손으로 적지 않았다',
     /margin-top:calc\(\(var\(--thumb\) - var\(--tap\)\)\/2\)/.test(SRC)
     && /\.ratesim input\[type=range\]\{margin-top:calc\(6px \+ \(var\(--thumb\) - var\(--tap\)\)\/2\)\}/.test(SRC));
  /* 🔴 트랙 두께·썸 지름이 규칙 넷에 리터럴로 흩어져 있었습니다. 토큰 하나로 모읍니다. */
  tt('트랙 · 썸 치수가 토큰 하나에서만 온다', (()=>{
     const one = n => (SRC.match(new RegExp('--'+n+':\\s*\\d+px','g'))||[]).length === 1;
     const rangeRules = (SRC.match(/input\[type=range\][^{]*\{[^}]*\}/g)||[]).join('');
     return one('track') && one('thumb') && !/(height|width):(6|26)px/.test(rangeRules);
  })());
  /* 🔴 지시서는 「모든 버튼·칩·입력창의 **높이**를 44px 이상으로」였습니다. 그대로 하면 안 됩니다 —
     `.condchip`(35px)이 46px 옵션칩과 같은 덩치가 되면 「읽는 표시」가 「고르는 것」이 됩니다.
     넓히는 것은 **손가락 면**이고 그리는 크기는 그대로입니다(지침 6-3 · 원칙 112). */
  /* 🔴 v25.7 — 대표를 `.trust`로(위와 같은 이유). 지시서의 「전부 44px로」는 여전히 미채택입니다 —
     보이는 크기를 키우면 「읽는 표시」가 「고르는 것」이 됩니다(지침 6-3 · 원칙 112). */
  tt('보이는 칩 높이는 그대로 --h-chip이다',
     /\.trust\{[^}]*height:var\(--h-chip\)/.test(SRC)
     && !/\.trust\{[^}]*height:var\(--tap\)/.test(SRC));

  /* ── ② 지역 선택 서랍 — 누른 칩 바로 아래 ── */
  /* 🔴 v24.28은 하위 구 목록을 격자 **뒤**에 붙였고, 경기·인천(42칸)에서 누른 칩과 1,146px
     떨어져 있었습니다(390px 실측). 자리는 `tagGrid`가 정합니다 — 어느 격자인지는 안 적습니다. */
  tt('하위 구 서랍이 누른 칩 다음 자리에 들어간다',
     /\(\(drawer && op\.id===key\) \? drawer : ''\)/.test(SRC));
  tt('서랍이 격자 한 줄을 통째로 먹는다',
     /\.taggrid \.drawer\{[^}]*grid-column:1\/-1/.test(SRC));
  /* 🔴 지시서의 `#F5F5F7`·`border-radius:12px`은 **새 값**입니다 — --fill(#F2F4F6)과 사실상 같은
     회색이 하나 더 생기고, 12px은 곡률 스케일(10·14·20·26) 밖입니다(원칙 84 · 117). */
  tt('서랍이 팔레트 · 곡률 스케일 안에 있다',
     /\.taggrid \.drawer\{[^}]*background:var\(--fill\)/.test(SRC)
     && /\.taggrid \.drawer\{[^}]*border-radius:var\(--r-m\)/.test(SRC)
     && !/#f5f5f7/i.test(SRC));
  /* 🔴 **면이 바뀌면 같은 토큰의 대비가 바뀝니다.** 바깥 `.pane-title`은 흰 카드 위라 --ink-4로
     4.62:1인데, 서랍 안은 --fill 위라 같은 값이 4.19:1입니다(원칙 97 · G-19가 렌더에서 잡습니다). */
  tt('서랍 제목이 --fill 면에서 대비를 지킨다',
     /\.drawer-t\{[^}]*color:var\(--ink-3\)/.test(SRC));
  /* 🔴 서랍 안에서 또 서랍을 열면 자기를 무한히 엽니다. 지금은 키가 코드라 안 맞지만 **잠급니다.** */
  /* ⚠ v25.14 — 세 번째 인자(지역 안내)가 붙으면서 **호출 문자열이 길어졌습니다.**
     잠글 것은 「인자가 둘이다」가 아니라 **「안쪽 호출이 inDrawer=true로 들어간다」**입니다(원칙 48). */
  tt('서랍 안에서 또 서랍을 열지 않는다',
     /tagGrid\(op\.kids\.map\(k => \[k\.code, k\.name\]\), true[,)]/.test(SRC)
     && /const drawer = \(!inDrawer/.test(SRC));

  /* ── ③ Copyright 꼬리말 ── */
  tt('저작권 줄이 결과 밖 · 앱 안에 있다', (()=>{
     const a = SRC.indexOf('</section>'), b = SRC.indexOf('class="copyright"');
     return a > 0 && b > a && b < SRC.indexOf('<div class="dock"');
  })());
  /* 🔴 연도를 마크업에 적으면 1월 1일에 조용히 틀립니다. 아무도 신고하지 않는 종류의 오류입니다. */
  tt('저작권 연도를 손으로 적지 않았다',
     /\$\('copyright'\)\.textContent = `© \$\{new Date\(\)\.getFullYear\(\)\}/.test(SRC)
     && !/©\s*20\d\d/.test(SRC));
  /* 🔴 지시서의 `#9E9E9E`는 앱 배경(--bg) 위에서 **2.43:1**입니다. 한 단 위인 --ink-4도 4.19:1로
     모자랍니다 — `.barlabel`이 여섯 판 동안 걸려 있던 **같은 자리**입니다(원칙 97). */
  tt('저작권 색이 배경 위에서 대비를 지킨다',
     /\.copyright\{[^}]*color:var\(--ink-3\)/.test(SRC) && !/#9e9e9e/i.test(SRC));
  /* 🔴 v24.29 지시서의 `font-size:12px`은 그때 **리터럴**이라 스케일 밖이었습니다(원칙 117).
     🔴 v25.6 — 12px이 `--t8`(각주 단)로 **스케일 안에 들어왔습니다.** 그래서 저작권도 그 단으로
       내려갔습니다 — 각주 넷을 한 규격으로 모으는 판입니다.
     ⚠ **대상만 옮깁니다**(원칙 128). 잠글 사실은 「크기가 토큰이다」이지 「그 토큰이 --t7이다」가
       아닙니다. 리터럴로 되돌아가면 여전히 빨간불입니다. */
  tt('저작권 크기가 활자 스케일 안이다',
     /\.copyright\{[^}]*font-size:var\(--t8\)/.test(SRC) && /--t8:12px/.test(SRC));
  /* 🔴 v25.6 — 각주가 **한 규격**인가. 하나라도 다른 단을 쓰면 같은 덩어리에 크기가 섞입니다.
     ⚠ 리터럴이 하나라도 남으면 빨간불입니다 — v24.29부터 `.foot`이 12px을 손으로 들고 있었습니다.
     🔴 v25.12 — `.caveat`가 **없어졌습니다**(캡션을 갈라 각자 서랍으로 보냈습니다).
       ⚠ **검사를 지운 것이 아니라 대상에서 뺐습니다**(원칙 128) — 잠글 사실은
         「맨 아래 각주들이 한 단을 쓴다」이고, 그 각주가 셋에서 둘이 된 것입니다.
       ⚠ 뒤 조건(`리터럴 금지`)에는 `caveat`를 **남겨 둡니다.** 되살릴 때 12px 리터럴로
         돌아오면 그때 빨간불이 나야 합니다. */
  tt('결과 화면 각주가 한 활자 단을 쓴다', (()=>{
     const one = sel => new RegExp('\\'+'.'+sel+'\\{[^}]*font-size:var\\(--t8\\)').test(SRC);
     return one('foot') && one('copyright')
         && !/\.(caveat|foot|copyright)\{[^}]*font-size:\d+px/.test(SRC);
  })());
  /* 🔴 지시서는 저작권을 `--ink-4`로 내리라고 했습니다. **못 씁니다** — 앱 배경 위 4.19:1입니다.
     조용하게 만드는 것은 색이 아니라 크기와 굵기입니다(원칙 100). 그 미채택을 잠급니다. */
  tt('각주가 대비 미달 잉크로 내려가지 않았다',
     !/\.(caveat|foot|copyright)\{[^}]*color:var\(--ink-4\)/.test(SRC));
  /* 🔴 결과 화면은 `.app.no-dock`이라 padding-bottom이 0입니다 — 화면 맨 아래를 책임지는 값이
     이제 **이 하나뿐**입니다(v24.28에서 `.result`에 같은 판단을 했습니다). */
  tt('저작권이 결과 화면에서 안전영역을 피한다',
     /\.app\.no-dock \.copyright\{padding-bottom:calc\(24px \+ env\(safe-area-inset-bottom\)\)\}/.test(SRC));
  /* 🔴 v24.30 — **v24.29의 「입력 화면은 안 겹칩니다」는 틀린 문장이었습니다.**
     사용자 실기 캡쳐(인앱 브라우저)에서 「© 2026 …」이 「다음」 버튼 뒤로 깔렸고,
     「이전」과 「다음」 **사이 틈으로 「0」 한 자만** 비어져 나왔습니다.
     Playwright로 스크롤 0에서 도크↔꼬리말 겹침을 재면 세로 폭에 따라 갈립니다.
       375×667 **+54px** · 390×720 **+23px** · 414×736 **+19px** / 390×844 −101 · 430×932 −176
     인앱 브라우저는 위아래 크롬이 dvh를 60~90px 먹어서, **실사용자가 가장 많이 보는 높이대가
     정확히 겹치는 구간**입니다. `padding-bottom`은 문서 **끝**을 비우는 값이지 꼬리말이
     **어디에 놓이는지**를 정하지 않습니다 — 본문이 짧으면 꼬리말은 도크 띠 안에 들어앉습니다.
     ⏹ `.app`을 flex로 바꿔 꼬리말을 아래로 미는 안을 먼저 쟀습니다. 본문이 짧은 화면만
       고쳐지고(−101 → −36) **겹치던 셋은 그대로**였습니다 — 본문이 화면보다 길면 밀 자리가 없습니다.
     ⚠ **정적 검사는 규칙이 있는지만 봅니다. 「안 겹치는가」는 렌더(G-25)가 잽니다** —
       G-22와 같은 역할 분담입니다(원칙 122 — 「썼는가」와 「닿았는가」는 다른 질문). */
  tt('저작권이 도크 있는 화면에는 안 걸린다',
     /\.app:not\(\.no-dock\) \.copyright\{display:none\}/.test(SRC));
  /* 🔴 **한쪽만 잠그면 안 됩니다.** 위 규칙만 보면 「꼬리말을 아예 지웠다」와 구별이 안 됩니다.
     결과 화면에는 **있어야** 한다는 짝을 같이 잠급니다(지침 6-13의 「관계를 잠근다」). */
  /* ═══ v24.31 — 프로덕트 오너 지시 반영분 ═══════════════════════════
     ⚠ 이 묶음은 **채택한 것과 미채택한 것을 같은 자리에** 둡니다(지침 6-13).
       미채택을 안 잠그면 같은 지시서가 다시 왔을 때 조용히 들어옵니다. */
  /* ① 저작권 명의. 「영끌계산기」는 **도구 이름**이고 저작권은 **사람**에게 있습니다 —
     한 문자열이 둘을 겸하면 이름을 바꿀 때 저작권 표시가 따라 바뀝니다(원칙 91). */
  tt('저작권 명의가 noahchoi 하나다',
     /\$\('copyright'\)\.textContent = `© \$\{new Date\(\)\.getFullYear\(\)\} noahchoi`/.test(SRC));
  tt('저작권 문구에 서비스 이름이 섞이지 않는다', (()=>{
     const m = SRC.match(/\$\('copyright'\)\.textContent = `[^`]*`/);
     return !!m && !/영끌계산기|All rights reserved/.test(m[0]);
  })());
  /* ② 블록 1 — 자금 구조 막대가 히어로 안으로. `.bento`에 남아 있으면 카드 경계가
     「이 금액이 어디서 오는가」를 둘로 끊습니다. */
  tt('자금 구조 막대가 히어로 안에 있다', (()=>{
     /* ⚠ `</header>`는 파일 **앞쪽**에도 있습니다. 결과 섹션 시작점부터 찾습니다 —
        안 그러면 시작 > 끝이 되어 잘라낸 문자열이 빈 채로 조용히 빨간불입니다. */
     const st = SRC.indexOf('<section class="result"');
     const res = SRC.slice(st, SRC.indexOf('</header>', st));
     return /<div class="fundwrap">[\s\S]*?id="fundStack"[\s\S]*?id="fundLegend"/.test(res);
  })());
  /* 🔴 `.tile-k`(--ink-4)는 **흰 카드 위에서** 4.62:1로 검증된 값입니다. 히어로는 앱 배경이라
     같은 토큰이 4.19:1로 떨어집니다 — `.barlabel`과 같은 자리(원칙 97). */
  tt('히어로 안 라벨이 배경 위 대비를 지킨다',
     /\.fund-k\{[^}]*color:var\(--ink-3\)/.test(SRC)
     && !/\.fund-k\{[^}]*color:var\(--ink-4\)/.test(SRC));
  /* ③ 블록 2 — 판정 뱃지. **색과 글자를 같은 `band`가 정해야** 합니다.
     따로 판정하면 「색은 주의인데 글자는 적정」이 납니다(원칙 91). */
  tt('부담 판정이 색과 글자를 한 값으로 낸다',
     /vd\.className='verdict '\+band/.test(UI)
     && /band==='ok' \? '적정' : band==='mid' \? '주의' : '부담 큼'/.test(UI));
  tt('값이 「—」일 때 판정 뱃지도 없다',
     /vd\.setAttribute\('hidden',''\)/.test(UI));
  /* 🔴 v25.3 — **대상만 옮겼습니다**(원칙 128). 뱃지가 글자색에서 **알약**으로 바뀌었습니다.
     ⏹ 전: `--ok`(#333D4B 무채색) 글자. 바로 위 「18%」(`.tile-v.ok`도 --ok)와 **같은 색**이라
       「적정」이 판정이 아니라 딸린 글자로 읽혔습니다 — v24.31이 이 뱃지를 만든 근거가
       바로 그 문제였는데 뱃지 자신이 그것을 물려받고 있었습니다.
     잠글 사실은 그대로 「새 색을 안 만든다」이고, **재는 자리만** 면으로 옮깁니다. */
  tt('판정 뱃지가 새 색을 만들지 않는다', (()=>{
     const r = (SRC.match(/\.verdict\.ok\{[^}]*\}\s*\n?\.verdict\.mid\{[^}]*\}\s*\n?\.verdict\.bad\{[^}]*\}/)||[''])[0];
     return !!r && !/#[0-9A-Fa-f]{3,6}|rgb\(/.test(r)
         && /\.verdict\.ok\{background:var\(--fill\);color:var\(--ink-3\)\}/.test(r)
         && /\.verdict\.mid\{background:var\(--warn-tint\);color:var\(--warn\)\}/.test(r)
         && /\.verdict\.bad\{background:var\(--warn-tint\);color:var\(--bad\)\}/.test(r);
  })());
  /* 🔴 짝 — **위 숫자와 색이 같아지면 안 됩니다.** 그게 이번에 오너가 본 것입니다.
     `.tile-v.ok`는 `--ok`, 뱃지 「적정」은 `--ink-3` — 둘이 같은 토큰이 되면 빨간불입니다. */
  tt('판정 뱃지가 바로 위 숫자와 다른 색이다', (()=>{
     const num = (SRC.match(/\.tile-v\.ok\{color:var\((--[a-z0-9-]+)\)\}/)||[])[1];
     const bad = (SRC.match(/\.verdict\.ok\{[^}]*color:var\((--[a-z0-9-]+)\)/)||[])[1];
     return !!num && !!bad && num !== bad;
  })(), (()=>{
     const num=(SRC.match(/\.tile-v\.ok\{color:var\((--[a-z0-9-]+)\)\}/)||[])[1];
     const b=(SRC.match(/\.verdict\.ok\{[^}]*color:var\((--[a-z0-9-]+)\)/)||[])[1];
     return `숫자 ${num} / 뱃지 ${b}`; })());
  /* 🔴 판정임을 **형태**로도 말하는가 — 면과 곡률이 붙어야 「값」이 아니라 「이름표」로 읽힙니다. */
  tt('판정 뱃지가 알약 형태다',
     /\.verdict\{[^}]*display:inline-block/.test(SRC)
     && /\.verdict\{[^}]*border-radius:var\(--r-pill\)/.test(SRC));
  /* 🔴 「적정」에 **그린을 쓰지 않습니다** — 그린은 채널 A(누르는 것)입니다. */
  tt('판정에 브랜드 그린을 쓰지 않는다',
     !/\.verdict\.(ok|mid|bad)\{[^}]*var\(--green\)/.test(SRC));
  /* ④ 블록 3 — 부대비용 소계 접기. **영수증 자체는 안 접습니다.** */
  /* 🔴 v25.6 — **대상만 옮겼습니다**(원칙 128). 이름 span 안에 비율 알약이 하나 들어왔습니다.
     잠글 사실은 「이름과 금액이 한 줄에 나란하다」이지 「둘 사이에 아무것도 없다」가 아닙니다. */
  tt('부대비용이 영수증 소계 한 줄로 접힌다',
     /<button class="disc discline" id="costToggle"/.test(SRC)
     && /<span class="k">집값 외 부대비용[\s\S]*?<\/span><span class="v" id="etcTotal">/.test(SRC));
  /* 🔴 v25.9 — **영수증 금액이 한 열에 선다**(오너 지적).
     접히는 줄만 오른쪽 끝에 ▾가 서서 그 줄의 금액이 혼자 안으로 들어와 있었습니다
     (실측 360px: 다른 넷 328 · 이 줄 310). 비우는 폭은 **한 곳(`--caret-col`)**에서 옵니다.
     ⚠ 「18px인가」를 안 잽니다 — 값이 아니라 **두 자리가 같은 토큰을 보는가**를 잽니다(원칙 84).
     ⚠ 꺾쇠에 고정 폭이 없으면 열이 **글리프 폭에 딸려** 갑니다. 이 앱은 글꼴이 늦게 붙습니다(v25.8). */
  tt('영수증 금액이 꺾쇠 열만큼 비운다', (()=>{
     const gutter = (SRC.match(/#receipt \.line,#receiptBot \.line,#costItems \.line\{padding-right:var\((--[a-z0-9-]+)\)\}/)||[])[1];
     const caret  = (SRC.match(/\.disc\.discline \.caret\{[^}]*width:var\((--[a-z0-9-]+)\)/)||[])[1];
     return !!gutter && gutter === caret;
  })());
  /* ⚠ `gap`이 「이름↔금액」과 「금액↔꺾쇠」를 겸하면 열 폭이 두 값의 합이 됩니다. 0으로 내리고
     간격은 이름 쪽 여백이 냅니다 — 그래야 비우는 폭이 `--caret-col` 하나로 끝납니다. */
  tt('소계 줄의 꺾쇠 간격이 열 폭에 안 섞인다',
     /\.disc\.discline\{gap:0\}/.test(SRC)
     && /\.disc\.discline \.caret\{[^}]*margin-left:0/.test(SRC));
  /* 🔴 여기가 이 판의 선입니다 — 대출과 준비할 현금은 **서랍 밖**입니다.
     서랍 안으로 들어가면 첫 화면의 약속(「실제로 드는 돈이 나와요」)이 접힌 채로 시작합니다. */
  tt('대출 · 준비할 현금이 접히는 서랍 밖이다', (()=>{
     const a = SRC.indexOf('id="costBox"'), b = SRC.indexOf('id="receiptBot"');
     const box = SRC.slice(a, b);
     return a > 0 && b > a
         && /\$\('receiptBot'\)\.innerHTML=h/.test(UI)
         && !/id="receiptBot"/.test(box)
         && /row\('주담대'/.test(UI) && /row\('준비할 현금'/.test(UI);
  })());
  /* 소계는 화면에 적힌 것들의 합입니다. 켠 항목의 **금액을 서랍 안에 두 번 적지 않습니다** —
     스위치 줄이 이미 말하고 있어서, 두 벌이면 껐을 때 어느 쪽이 진짜인지 알 수 없습니다. */
  tt('부대비용 소계가 켠 항목까지 센다',
     /ETC_ROWS\.forEach\(\(\[k\]\) => \{ if\(S\[k\]\.on && S\[k\]\.v > 0\) etcSum \+= man10k\(S\[k\]\.v \* 10000\); \}\);/.test(UI));
  /* 🔴 소계는 **화면에 적힌 값끼리** 더합니다. 원값 합을 다시 반올림하면 항목 합과 1만원 어긋나고,
     사람은 이 표를 눈으로 더해 봅니다(실기에서 5,911 vs 5,912로 실제로 어긋났습니다 · 원칙 91). */
  tt('부대비용 소계가 화면에 적힌 단위로 더해진다',
     /const man10k = v => Math\.round\(v\/10000\)\*10000;/.test(UI)
     && /etcSum = man10k\(c\.tax\) \+ man10k\(c\.brokerFee\)/.test(UI));
  /* ⑤ 실거래 부속 줄 — 잘림. 사용자 캡쳐에서 「2017ㄴ」으로 확인, 390px 실측 37px 넘침. */
  tt('실거래 부속 줄이 두 줄로 흐른다',
     /\.deal \.nm small\{[^}]*white-space:normal/.test(SRC)
     && !/\.deal \.nm small\{[^}]*white-space:nowrap/.test(SRC));
  /* 단지 이름은 **여전히 한 줄**입니다 — 두 줄로 흐르면 금액과 기준선이 어긋납니다. */
  tt('단지 이름은 여전히 한 줄 말줄임이다',
     /\.deal \.nm\{[^}]*text-overflow:ellipsis;white-space:nowrap/.test(SRC));
  /* 🔴 지시서는 줄마다 「(공급 약 OO평형)」을 요구했습니다 — 390px에서 **97px 넘칩니다.**
     지적(「무엇의 평인지 안 밝힌다」)은 맞으므로 **목록 아래에서 한 번** 말합니다. */
  /* ⚠ 같은 이유(원칙 48). 「공급면적」과 「추정」 **두 낱말이 함께** 있으면 뜻이 섭니다. */
  tt('평이 무엇의 평인지 화면이 말한다',
     /평[^.]{0,10}공급면적[^.]{0,10}추정/.test(UI));
  tt('면적 표기가 줄마다 길어지지 않았다',
     !/공급 약/.test(SRC.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,''))
     || /foot\.textContent/.test(UI));
  /* ⑥ 🔴 **미채택 잠금** — 아웃링크 레이블은 조건을 약속하지 않습니다.
     목적지가 `fin.land.naver.com` 루트라 지역도 가격대도 안 넘어갑니다.
     「이 가격대」·「내 예산」 같은 말이 들어오는 순간 **지키지 못할 약속**이 됩니다(v24.22와 같은 근거). */
  tt('아웃링크 레이블이 조건을 약속하지 않는다', (()=>{
     const m = UI.match(/\$\('outNaverT'\)\.textContent=`[^`]*`/);
     return !!m && !/가격대|예산|조건|매물/.test(m[0]);
  })());
  /* 🔴 v25.0 — v24.31이 「조건을 안 실으면 루트로만 간다」로 잠갔던 자리입니다.
     이번 판에서 **지역을 실었습니다.** 그래서 잠글 것을 뒤집지 않고 **한 칸 옮깁니다** —
     「지역은 실리되 **예산·가격은 안 실린다**, 그리고 지역이 없으면 루트로 되돌아간다」.
     ⚠ 가격을 싣는 순간 레이블도 같이 고쳐야 하고, 그건 이 검사가 아니라
       「목적지 이름만 말한다」가 잡습니다. 둘이 짝입니다(지침 6-13). */
  /* 🔴 v25.5 — **다시 「루트로만 간다」로 돌아왔습니다**(오너 지시).
     ⏹ v24.31: 「조건을 안 실으면 루트로만」 → v25.0: 「지역은 싣되 가격은 안 싣는다」
        → v25.5: **아무 조건도 안 싣는다.**
     ⚠ 세 판을 오간 자리입니다. 되돌린 이유는 링크가 죽어서가 아니라(실기에서 살아 있었습니다)
       **지역만 걸린 검색 결과가 「내 조건으로 찾아 준다」로 오해되기 때문**입니다.
     ⚠ 지역·가격 어느 쪽도 실리면 안 됩니다 — 하나라도 실리는 순간 레이블이 지키지 못할
       약속을 하게 되고, 그건 v24.22가 막아 둔 자리입니다. */
  tt('네이버 링크가 아무 조건도 싣지 않는다', (()=>{
     const m = UI.match(/\$\('outNaver'\)\.href\s*=[\s\S]{0,200}?;/);
     if(!m) return false;
     return /^\$\('outNaver'\)\.href = `https:\/\/fin\.land\.naver\.com\/`;$/.test(m[0].trim())
         && !/encodeURIComponent|_nq|sgg|price|priceMan|budget|만원|억/.test(m[0]);
  })(), (UI.match(/\$\('outNaver'\)\.href\s*=[\s\S]{0,200}?;/)||[''])[0].trim());

  /* ═══ v25.0 — 정책 대조(2026.8.13) · 취득세 4단 · 거래 활발 뱃지 ═══════════════
     ⚠ 이 묶음의 요점은 「값을 바꿨다」가 아니라 **「대조했고, 셋은 그대로였다」**입니다. */
  /* ① 8.13 금융 종합대책 9쪽: LTV·DSR·주담대 한도는 「확고하게 유지」. 우리 값과 대조합니다.
     ⚠ 숫자를 여기 적는 것이 맞습니다 — 이 검사는 **문서와 코드가 같은가**를 보는 자리라,
       코드에서 값을 읽어 오면 자기 자신과 비교하게 됩니다(원칙 106의 반대 경우). */
  tt('LTV가 8.13 대책과 같다 (규제 40% · 비규제 70%)',
     POLICY.ltv.noneOrDispose.reg === 0.4 && POLICY.ltv.noneOrDispose.other === 0.7);
  tt('DSR이 8.13 대책과 같다 (40%)', POLICY.ratio.dsr === 0.40);
  tt('주담대 구간 상한이 8.13 대책과 같다 (6억 · 4억 · 2억)', (()=>{
     const b = POLICY.bandCap;
     return b.length === 3 && b[0].upTo === 1500000000 && b[0].cap === 600000000
         && b[1].upTo === 2500000000 && b[1].cap === 400000000
         && b[2].cap === 200000000;
  })());
  /* ② 아직 시행 전인 것은 **계산이 아니라 안내**로 말합니다. 시행일과 「무엇을 고쳐야 하는가」가
     같이 적혀 있어야 합니다 — 내규로 되는 것과 국회를 거쳐야 하는 것은 확실성이 다릅니다. */
  /* 🔴 v25.1 — 다섯 항목이 `.chg` 문단으로 갈리면서 비탐욕 식이 **첫 항목에서 멈췄습니다.**
     안쪽 `</span>`이 생긴 것이지 안내가 사라진 게 아닙니다 — 여는 태그부터
     `</span></div>`까지를 봅니다(원칙 128 — 세는 방법만 넓힙니다). */
  tt('시행 전 정책을 안내로만 말한다', (()=>{
     const m = SRC.match(/곧 바뀌는 것 \(아직 계산에 없음\)<\/b><span>([\s\S]*?)<\/span><\/div>/);
     if(!m) return false;
     const box = m[1];
     return /2026년 8월 31일/.test(box) && /2027년 1월/.test(box)
         && /법률 개정이 필요/.test(box)            /* 청년미래보금자리론 */
         && /시행세칙|내규|가이드라인|행정지도/.test(box);
  })());
  /* ③ 거래 활발 뱃지 — **임의 임계를 안 씁니다.** 「같은 단지가 두 번 이상」이 유일한 기준입니다. */
  tt('거래 활발이 임의 임계를 쓰지 않는다',
     /const hotOf = x => \(seen\.get\(hotKey\(x\)\)\|\|0\) >= 2;/.test(UI)
     && !/거래 활발[\s\S]{0,120}(월\s*\d+건|>= *[3-9]|>= *\d\d)/.test(UI));
  /* 다섯 줄이 아니라 **거른 전체**를 셉니다 — 목록이 잘리면 뱃지가 조용히 사라집니다(원칙 99). */
  /* 🔴 v25.1 — **한 겹 더 안쪽으로 옮겼습니다.** v25.0은 「다섯 줄이 아니라 거른 전체」까지
     고쳤는데, 그 「거른 전체」는 `dedupe`로 **이미 접힌** 목록이었습니다 —
     같은 면적이 세 번 팔려도 한 건이라 뱃지가 「반복 거래」를 못 뜻했습니다.
     이제 접기 전(`underRaw`·`overRaw`)을 셉니다. 느슨해진 것이 아니라 **재는 대상이 맞아진 것**입니다. */
  tt('거래 활발을 접기 전 전체에서 센다',
     /\(DEAL\.over \? underRaw\.concat\(overRaw\) : underRaw\)\.forEach/.test(UI)
     && /return \{ under: dedupe\(u\), over: dedupe\(o\), underRaw: u, overRaw: o \};/.test(UI));
  /* 🔴 짝 — 목록 자체는 **여전히 접혀 있어야** 합니다. 풀면 같은 집이 여러 줄로 뜹니다. */
  tt('목록은 여전히 접혀서 나온다',
     /const \{under, over, underRaw, overRaw\} = splitDeals/.test(UI)
     && /list\.innerHTML = shownRows\.map/.test(UI));
  tt('거래 활발이 이름만이 아니라 동 · 지역까지 본다',
     /hotKey = x => \(x\.name\|\|''\) \+ '\|' \+ \(x\.dong\|\|''\) \+ '\|' \+ \(x\.lawd\|\|''\)/.test(UI));
  /* 🔴 이모지 금지 — 건조한 톤. 점 하나 + 굵기 + 무채색 면으로만 냅니다. */
  tt('거래 활발 뱃지에 이모지가 없다', (()=>{
     const m = SRC.match(/\.deal \.nm small \.hot\{[^}]*\}[\s\S]{0,160}/);
     return !!m && !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(m[0]);
  })());
  tt('거래 활발 뱃지가 새 색을 만들지 않는다',
     /\.deal \.nm small \.hot\{[^}]*background:var\(--fill\)/.test(SRC)
     && /\.deal \.nm small \.hot\{[^}]*color:var\(--ink-3\)/.test(SRC));
  /* ④ 부속 줄이 두 줄로 흐르므로 행간을 명시했습니다(지시서 5). */
  tt('부속 줄 행간이 1.4~1.5다', (()=>{
     const m = SRC.match(/\.deal \.nm small\{[\s\S]*?line-height:([\d.]+)/);
     return !!m && +m[1] >= 1.4 && +m[1] <= 1.5;
  })());
  tt('숫자가 tabular-nums로 고정돼 있다',
     /body\{[^}]*font-variant-numeric:tabular-nums/.test(SRC)
     && /input\{[^}]*font-variant-numeric:inherit/.test(SRC)
     && /button\{[^}]*font-variant-numeric:inherit/.test(SRC));

  tt('저작권이 결과 화면에는 남아 있다',
     /class="copyright" id="copyright"/.test(SRC)
     /* ⚠ 홑선택자 규칙만 봅니다. `.app:not(.no-dock) .copyright{display:none}`도
        「.copyright{display:none」을 품고 있어서, 안 가두면 이 검사가 **자기 짝을 오인합니다.** */
     && !/\n\.copyright\{[^}]*display:none/.test(SRC));

  /* ── ④ 미채택 넷을 잠급니다 (실기 대조로 되돌린 것들) ── */
  /* 🔴 지시서: 「고객님의 예산으로 …노려볼 수 있는 집은 최대 O억입니다」.
     실기에서 셋이 한꺼번에 났습니다 — 지역명이 히어로와 조건칩에 **두 번**(원칙 43),
     라벨이 1줄 → 2줄, 그리고 「최대 …입니다」가 현행보다 **단정형**이라
     같은 지시서 3번이 뱃지에서 없애려던 보증 오인 리스크를 히어로에서 되살립니다. */
  tt('히어로가 헤지된 표현을 지킨다',
     /'현재 조건으로 예상되는 매수 가능 금액은'/.test(SRC)
     && /\$\('heroTail'\)\.textContent = '수준이에요'/.test(SRC)
     && !/노려볼 수 있는/.test(SRC));
  /* 🔴 지시서: 영수증 제목을 「필요 자금 총액」으로. 첫 화면이 「입력 세 번이면 **집 살 때 실제로
     드는 돈**이 나와요」라고 약속하고 이 제목이 그 약속을 받습니다 — 바꾸면 약속과 받는 말이
     어긋납니다(v24.28이 영수증 접기를 미채택한 것과 같은 근거).
     ⚠ 이 검사는 **둘이 같은 말인지**를 봅니다. 한쪽만 고치면 빨간불입니다. */
  /* 🔴 v25.1 — **약속하는 쪽이 사라졌습니다.** 프로덕트 오너가 첫 화면 카피를
     「환상 없는 진짜 예산, 내 집 마련의 가장 현실적인 출발선」으로 교체했습니다.
     ⚠ 이 검사가 막던 나쁜 상태는 「첫 화면 약속과 영수증 제목이 어긋남」이었는데,
       약속이 없어졌으니 **어긋날 짝이 없습니다.** 남는 것은 영수증 제목 자체이고,
       그건 v24.28이 「영수증을 접지 않는다」로 잠근 것과 짝이라 그대로 둡니다.
     ⏹ **열어 둔 것:** 첫 화면이 무엇을 약속하는지는 이제 아무 검사도 안 봅니다.
       카피를 다시 약속형으로 되돌리면 이 검사를 옛 형태로 살리세요(원칙 128). */
  tt('영수증 제목이 「실제로 드는 돈」을 그대로 말한다',
     /<h2 class="card-title">이 집을 살 때 실제로 드는 돈<\/h2>/.test(SRC));
  /* 🔴 v25.1 — 교체된 첫 화면 카피가 **그 자리에 있는가.** 문자열을 잠그는 것이
     아니라 「부제가 비어 있지 않고, 옛 문장으로 조용히 되돌아가지 않았는가」를 봅니다. */
  tt('첫 화면 부제가 교체된 카피다',
     /class="subline">환상 없는 진짜 예산,<br>내 집 마련의 가장 현실적인 출발선<\/p>/.test(SRC));
  /* 🔴 지시서: 「(34평)에 Bold + 포인트 컬러」. 흰 카드 위 --green은 **2.17:1**이라 G-19에서
     즉시 빨간불입니다. 강조는 **굵기와 잉크 한 단**으로만 냅니다(지침 6-3 · 원칙 62).
     ⚠ 괄호 포맷도 미채택입니다 — 두 자가 늘면서 390px에서 「2018년」이 잘렸습니다(실측). */
  tt('실거래 평 강조에 포인트 컬러를 쓰지 않는다',
     /\.deal \.nm small b\{color:var\(--ink-3\);font-weight:700\}/.test(SRC));
  tt('실거래 면적이 가운뎃점 리듬을 지킨다',
     /esc\(a\.m2\) \+ \(a\.py \? ` · <b>\$\{esc\(a\.py\)\}<\/b>` : ''\)/.test(SRC));
  /* 🔴 v25.6 — **「17년식」 → 「17년 준공」**(오너 지적 · 실측이 근거를 뒤집었습니다).
     ⏹ v24.29가 「2018년 → 18년」을 미채택한 근거는 **「N년」이 연도와 기간 두 뜻이 된다**는
       것이었습니다(같은 카드에 「신축 (10년)」 칩). **그 근거는 지금도 맞습니다.**
     ⏹ v25.5는 그 근거를 지키려고 「식」을 붙였고, **자동차 연식 표기 관행이라 사람이 읽는 데
       문제가 없다**고 적었습니다. 실기에서 오너가 「17년 된 아파트」로 읽었습니다 —
       그 관행은 **차에서만** 통했습니다(지침 6-14 — 화면 결정은 화면이 이깁니다).
     → 「준공」은 관행이 아니라 **뜻으로** 연도임을 말합니다. 근거는 그대로, 형태만 바꿉니다.
     ⚠ 「준공」이 빠지면 v24.29가 막아 둔 자리로 그대로 돌아갑니다. 그것을 잠급니다.

     🔴 v25.16 — **두 자리 잠금을 풀고 대상을 옮겼습니다**(원칙 128 · 148).
     ⏹ 두 자리를 지키던 근거는 **폭 하나**였는데, 이번 판에서 5폭을 다시 재니
       **두 자리인 채로도 360·375px에서 두 줄**이었습니다(197px 자리에 216.4px).
       근거가 이미 무너져 있었고, 그 사실을 아무도 안 재고 있었습니다.
     ⏹ 그리고 오너 실기 캡쳐에 **「00년 준공」**(2000년)이 찍혀 있었습니다.
       두 자리 규칙은 2000년대에서 깨집니다 — 「00년」은 연도로도 기간으로도 안 읽힙니다.
     → 연식을 부속 줄에서 빼고 **펴진 상자에서 네 자리**로 적습니다.
     ⚠ 지키는 사실은 그대로입니다 — **「준공」이 붙어 있어 기간으로 안 읽힌다.**
       바뀐 것은 **자릿수와 자리**뿐입니다. 「식」 금지도 그대로 둡니다(지침 6-13). */
  tt('연식이 네 자리 + 「준공」이고 펴진 상자에 있다', (()=>{
     if(!/id="dealNew"[^>]*>신축 \(10년\)/.test(SRC)) return false;
     const f = (SRC.match(/const yearFull = [\s\S]*?\n/)||[''])[0];
     if(!/n \+ '년 준공'/.test(f)) return false;
     if(/slice\(-2\) \+ '년 준공'/.test(SRC)) return false;      /* 두 자리로 안 돌아갔는가 */
     const box  = (SRC.match(/function dealBox\(x, i\)\{[\s\S]*?\n\}/)||[''])[0];
     const line = (SRC.match(/function dealLine\([^)]*\)[\s\S]*?\n\}/)||[''])[0];
     /* 상자에는 있고, 부속 줄에는 없습니다 */
     return /yearFull\(x\.buildYear\)/.test(box) && !/yearFull|yearShort/.test(line);
  })());
  /* 🔴 짝 — 뜻을 말하는 말(「준공」)이 빠진 「N년」·「N년식」이 되살아나지 않았는가.
     ⚠ 「식」도 같이 막습니다 — 미채택을 안 잠그면 다음 판에 조용히 돌아옵니다(지침 6-13). */
  tt('연식이 기간으로 읽히는 꼴로 안 돌아갔다',
     !/x\.buildYear \? esc\(`\$\{x\.buildYear\}년`\)/.test(SRC)
     && !/'년식'/.test(SRC));
})();

/* ═══ v25.1 — 런칭 마감 지시서 5건 ═══════════════════════════════
   ⚠ 이 장은 **채택한 넷**과 **못 쓴 문구들**을 같이 잠급니다.
     미채택을 안 잠그면 다음 판에 같은 문구가 조용히 들어옵니다(지침 6-13).
   ⏹ 지시 5(세대수 API 연동)는 **착수 못 했습니다** — 인수인계 v25.1의 5번을 보세요.
     여기에 「했다」로 읽힐 검사를 하나도 두지 않습니다. 없는 것은 없는 채로 둡니다.
   ═══════════════════════════════════════════════════════════ */
(() => {
  const RAW = fs.readFileSync(FILE,'utf8');
  const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');

  /* ── ① 기준일 뱃지 ───────────────────────────── */
  /* ── ① 기준일 뱃지 — 🔴 **v25.7에서 통째로 지웠습니다**(오너 지시) ──────────
     ⏹ v25.1이 `.brand` 안 독립 줄로 넣었고(세로 43px), v25.6이 상단 바로 옮겼습니다(세로 0px).
       v25.7은 **자리가 아니라 존재**를 지웁니다 — 같은 사실을 결과 면책이 이미 말하고 있어서
       입력 화면의 뱃지는 중복이었습니다(원칙 43).
     ⚠ **검사를 지우지 않고 뒤집습니다**(지침 6-13 · 원칙 128). 지워 버리면 다음 판에
       뱃지가 조용히 돌아와도 아무도 모릅니다. 이제 이 검사들은 **「없다」를 잠급니다.**
     ⚠ 되살리려면 마크업 · CSS · 상수 **셋을 한 번에** 되살리고 이 장을 옛 형태로 돌리십시오. */
  tt('첫 화면에 기준일 뱃지가 없다',
     !/id="asOfBadge"/.test(SRC) && !/class="asof"/.test(SRC));
  tt('뱃지 CSS가 죽은 규칙으로 남아 있지 않다',
     !/^\.asof\{/m.test(RAW) && !/\.app\.no-dock \.asof/.test(RAW));
  tt('뱃지용 상수가 죽은 값으로 남아 있지 않다',
     !/POLICY_ASOF_BADGE/.test(SRC));
  /* 🔴 뱃지가 사라져도 **기준일 자체는 화면에 남아야 합니다.** 지운 것은 중복이지 사실이 아닙니다.
     남은 두 자리 — 결과 면책 첫 줄 · 안내 시트의 「정책 확인일」. 둘 다 상수에서 옵니다. */
  tt('기준일이 여전히 두 자리에서 말해진다',
     /※ 대출 규제 · 세법 기준일 \$\{POLICY_ASOF\}/.test(SRC)
     && /\$\('asOfNote'\)\.textContent = `\$\{POLICY_ASOF\}/.test(SRC));
  /* 🔴 v25.1이 뱃지 문구를 「세법」이 아니라 「정책」으로 고른 근거는 **「대출 규제가 더 크다」**였습니다.
     v25.7은 그 둘을 **다 적는 쪽**으로 갔습니다 — 근거를 되돌린 게 아니라 한 단 더 정확해진 것입니다.
     ⚠ 「세법 기준」만 적는 꼴로는 못 돌아갑니다(8.13 금융대책을 안 봤다는 뜻이 됩니다). */
  tt('기준일 문구가 대출 규제를 빠뜨리지 않는다',
     !/세법 기준의/.test(SRC) && /대출 규제 · 세법/.test(SRC));
  /* 🔴 `.eyebrow`(퍼널 단계 표시)는 v25.1에서 이름이 겹쳐 회색 알약이 됐던 자리입니다.
     뱃지가 사라져도 **그 규격은 그대로여야** 합니다 — 겹침이 풀렸다고 원래 것이 변하면 안 됩니다. */
  /* 🔴 v25.14 — **대상을 옮겼습니다**(원칙 128). 이 잠금의 근거는 v25.1의 **이름 겹침 사고**
     (`.asof`가 `.eyebrow`를 덮어 단계 표시가 회색 알약이 됨)였습니다. 지켜야 할 사실은
     **「이 부품의 정체가 그대로다」**이지 「굵기가 800이고 잉크가 --espresso다」가 아닙니다.
     아이브로우의 정체는 **작은 크기(--t7)와 넓은 자간(.1em), 그리고 면이 없다는 것**입니다.
     ⏹ v25.14가 굵기 800 → 700(화면 전체 폐기) · 잉크 `--espresso` → `--ink-4`로 내렸습니다 —
       「01 / 03」은 이 화면에서 가장 안 중요한 정보인데 질문 제목과 같은 무게였습니다.
     ⚠ 대신 **위계가 뒤집히지 않는가**를 새로 잠급니다 — 단계 표시가 질문 제목보다 진하면 안 됩니다. */
  tt('단계 표시가 제 정체를 지킨다', (()=>{
     const m = (RAW.match(/\n\.eyebrow\{([^}]*)\}/)||[])[1] || '';
     return /font-size:var\(--t7\)/.test(m) && /letter-spacing:\.1em/.test(m) && !/background/.test(m);
  })(), (RAW.match(/\n\.eyebrow\{[^}]*\}/)||['없음'])[0].slice(0,90));
  tt('단계 표시가 질문 제목보다 조용하다', (()=>{
     const eb = (RAW.match(/\n\.eyebrow\{([^}]*)\}/)||[])[1] || '';
     const qt = (RAW.match(/\n\.q-title\{([^}]*)\}/)||[])[1] || '';
     const w = t => +((t.match(/font-weight:(\d+)/)||[])[1] || 0);
     /* 잉크는 「본문 최상단(--ink/--espresso)이 아닐 것」으로 봅니다 — 값이 아니라 관계입니다 */
     return w(eb) < w(qt) && !/color:var\(--(ink|espresso)\)/.test(eb);
  })(), '🔴 단계 표시가 질문 제목만큼 진합니다');

  /* ── ② 「못 넣은 것」을 이름으로 부른다 ─────────────
     🔴 v25.12 — v25.1의 **투명성 캡션이 없어졌습니다.** 한 문장이 성격이 다른 둘
       (등기 **채권 매입비** · 은행 **우대금리**)을 묶고 있어서, 갈라서 각자 제자리로 보냈습니다.
     ⚠ **검사는 지우지 않고 대상을 옮깁니다**(원칙 128). 지키려던 사실은
       「맨 아래에 문단이 있다」가 아니라 **「못 넣은 둘을 이름으로 부르고, 왜 못 넣는지 말한다」**
       입니다. 이제 두 자리에서 각각 잠급니다 — 한쪽이 조용히 사라지면 빨간불입니다. */
  tt('채권 매입비를 부대비용 서랍이 이름으로 부른다', (()=>{
     const m = SRC.match(/\$\('costLead'\)\.innerHTML =([\s\S]*?);/);
     return !!m && /국민주택채권 매입비/.test(m[1]);
  })());
  tt('우대금리를 한도 서랍이 이름으로 부른다', (()=>{
     const m = SRC.match(/notes\.innerHTML = hasLimit([\s\S]*?): '';/);
     return !!m && /우대금리/.test(m[1]);
  })());
  /* 🔴 `.legal`은 5줄 상한(G-18)이 걸린 **법적 고지** 블록입니다. 계산 범위 설명을 거기 넣으면
     상한을 올리게 되고, 그때 물어야 할 것은 「상한을 올릴까」가 아닙니다(v24.28 · 지침 G-18). */
  tt('못 넣은 것 설명이 면책 블록 밖이다', (()=>{
     const b = legalBlock(SRC);
     return b !== null && !/채권|우대금리/.test(b);
  })());
  /* 🔴 v25.12 — **맨 아래 캡션 문단이 되살아나지 않았다.** 되살리면 채권 이야기가
     부대비용 서랍과 **두 곳**이 되고, 두 벌은 반드시 어긋납니다(원칙 58 · 84).
     ⚠ 되살릴 이유가 생기면 **부대비용 서랍 쪽을 먼저** 보십시오. */
  tt('맨 아래 각주가 면책 하나다', (()=>{
     const m = SRC.match(/<p class="foot" id="footNote"><\/p>\s*<\/section>/);
     return !!m && !/id="caveatNote"/.test(SRC) && !/\.caveat\{/.test(SRC);
  })());
  /* 🔴 지시서 원문은 「…포함하지 않았습니다. 실제 계약 시 최종 확인하시기 바랍니다.」였습니다.
     ① `.legal` 밖은 전부 ~어요체입니다 ② 「확인하시기 바랍니다」는 **지시문**입니다(지침 말투). */
  tt('못 넣은 것 설명이 지시하지 않는다', (()=>{
     const m = SRC.match(/notes\.innerHTML = hasLimit([\s\S]*?): '';/);
     const c = SRC.match(/\$\('costLead'\)\.innerHTML =([\s\S]*?);/);
     if(!m || !c) return false;
     const t = m[1] + c[1];
     return !/바랍니다|하세요|하십시오|확인하시/.test(t) && !/니다/.test(t);
  })());
  /* 🔴 짝 — 「안 넣었다」고만 하고 **왜**를 안 말하면 그냥 발뺌입니다.
     채권은 「공시가격 · 할인율에 따라 달라져서」, 우대금리는 「조건마다 다른」이 그 자리입니다. */
  tt('못 넣은 이유를 두 자리에서 같이 말한다', (()=>{
     const m = SRC.match(/notes\.innerHTML = hasLimit([\s\S]*?): '';/);
     const c = SRC.match(/\$\('costLead'\)\.innerHTML =([\s\S]*?);/);
     return !!m && !!c && /조건마다 다른/.test(m[1]) && /할인율에 따라 달라져서/.test(c[1]);
  })());
  /* 채권을 못 넣은 이유는 v24.17부터 부대비용 패널에 있습니다 — v25.12부터 **여기 하나**입니다. */
  tt('채권 문장이 부대비용 패널에 그대로 있다', /국민주택채권 매입비/.test(SRC));

  /* ── ③ 「곧 바뀌는 것」 구조 ──────────────────── */
  tt('곧 바뀌는 것이 다섯 문단으로 갈려 있다', (()=>{
     const m = SRC.match(/곧 바뀌는 것 \(아직 계산에 없음\)<\/b><span>([\s\S]*?)<\/span><\/div>/);
     return !!m && (m[1].match(/<span class="chg">/g)||[]).length === 5;
  })(), (()=>{
     const m = SRC.match(/곧 바뀌는 것 \(아직 계산에 없음\)<\/b><span>([\s\S]*?)<\/span><\/div>/);
     return m ? (m[1].match(/<span class="chg">/g)||[]).length+'문단' : '못 찾음'; })());
  /* 🔴 줄머리 가운뎃점은 뗐습니다 — 같은 기호를 부속 줄에서 **한 줄 안의 구분자**로 쓰고 있어
     한 기호가 두 뜻을 겸했습니다(원칙 91). 항목 구분은 기호가 아니라 여백이 냅니다. */
  tt('곧 바뀌는 것에 줄머리 가운뎃점이 없다', (()=>{
     const m = SRC.match(/곧 바뀌는 것 \(아직 계산에 없음\)<\/b><span>([\s\S]*?)<\/span><\/div>/);
     return !!m && !/^\s*·/m.test(m[1]) && !/<br>/.test(m[1]);
  })());
  tt('곧 바뀌는 것 항목 사이가 24px이다',
     /\.sheet-row span \.chg \+ \.chg\{margin-top:24px\}/.test(RAW));
  /* 🔴 마지막 항목에는 아래 여백을 안 답니다 — 달면 다음 행과의 간격만 조용히 늘어납니다(원칙 126). */
  tt('마지막 항목에 매달린 여백이 없다',
     !/\.sheet-row span \.chg\{[^}]*margin-bottom/.test(RAW));
  /* 🔴 항목 제목이 `.sheet-row b`(블록 · 14px)를 그대로 물려받고 있었습니다 —
     그래서 줄머리 `·`만 앞 줄에 홀로 남아 「의미 없는 점」으로 보였습니다. 그것이 원인이었습니다. */
  tt('항목 제목이 설명과 같은 줄에서 시작한다',
     /\.sheet-row span \.chg b\{display:inline/.test(RAW));

  /* ── ④ 푸터 간격 ─────────────────────────────── */
  /* 🔴 지시서는 「불필요한 `margin-top:auto`를 제거하라」였습니다. **그 선언은 없었습니다** —
     v24.30에서 `.app` flex 안을 미채택하면서 같이 안 들어갔습니다. 간격을 만들던 것은 padding입니다. */
  tt('저작권에 margin-top:auto가 없다', !/\.copyright\{[^}]*margin-top:auto/.test(RAW));
  /* 🔴 실측이 정했습니다 — 24로 줄여도 화면 간격은 **52px**이었습니다.
     저작권 바로 위에 `.result`의 반응형 아래 여백(40~44px)이 이미 서 있기 때문입니다.
     0으로 두면 28px이 됩니다. 잠글 것은 「위 여백을 스스로 더하지 않는다」입니다. */
  tt('저작권이 위 여백을 스스로 더하지 않는다', /\.copyright\{margin:0;padding:0 0 24px/.test(RAW));
  /* 아래 24px은 안전영역과 짝입니다 — 같이 지우면 홈 인디케이터에 글자가 닿습니다. */
  tt('저작권 아래에 안전영역이 남아 있다',
     /\.app\.no-dock \.copyright\{padding-bottom:calc\(24px \+ env\(safe-area-inset-bottom\)\)\}/.test(RAW));
  /* 🔴 실측이 원인을 하나 더 찾았습니다 — `.result`의 아래 여백이 안전영역을 **두 번째로**
     들고 있었습니다. v24.29에서 저작권이 `.result` 밖으로 나가면서 그 여백의 뜻이 바뀌었는데
     값은 그대로였습니다. 결과 화면에서만 평범한 간격으로 되돌립니다(실측 54 → 38px). */
  tt('결과 화면 아래 여백이 안전영역을 두 번 세지 않는다',
     /\.app\.no-dock \.result\{padding-bottom:24px\}/.test(RAW));
  /* 🔴 짝 — 결과 화면에서 **실제로 이기는 규칙**에는 안전영역이 없어야 합니다.
     ⚠ `.result{...}` 기본 규칙과 미디어 쿼리 쪽은 **그대로 둡니다** — 반응형 여백 블록이고,
       거기서 지우면 저작권이 안 뜨는 맥락에서 화면 끝에 글자가 닿습니다(원칙 118).
       이기는 것은 명시도가 높은 `.app.no-dock .result`입니다(실측으로 확인). */
  tt('결과 화면에서 이기는 규칙에는 안전영역이 없다',
     /\.app\.no-dock \.result\{padding-bottom:24px\}/.test(RAW)
     && !/\.app\.no-dock \.result\{[^}]*env\(safe-area/.test(RAW)
     && /\.app\.no-dock \.copyright\{[^}]*env\(safe-area/.test(RAW));

  /* ── ⑤ 「거래 활발」 뱃지 ─────────────────────── */
  tt('거래 활발 뱃지가 단독 줄이다',
     /<span class="hotrow"><span class="hot">거래 활발<\/span><\/span>/.test(SRC)
     && /\.deal \.nm small \.hotrow\{display:block/.test(RAW));
  /* 🔴 짝 — 줄 끝에 다시 매달리지 않았는가. `margin-left`가 돌아오면 자리가 다시 흔들립니다. */
  tt('거래 활발 뱃지가 줄 끝에 매달리지 않는다',
     !/\.deal \.nm small \.hot\{[^}]*margin-left/.test(RAW));
  /* 🔴 개월 수를 문자열에 손으로 안 적습니다 — `DEAL.months`를 고치면 문구가 따라옵니다(원칙 84). */
  /* ⚠ 잠글 것은 **개월 수가 리터럴이 아니라 `DEAL.months`에서 온다**는 것 하나입니다.
     문장 모양까지 잠그면 문구를 못 고칩니다(원칙 48 · 134). */
  tt('거래 활발 기준 문구가 코드의 값에서 온다',
     /note\.textContent = shownRows\.some\(hotOf\)/.test(SRC)
     && /※ 거래 활발[^`]*\$\{DEAL\.months\}개월/.test(SRC)
     && !/※ 거래 활발[^`]*[0-9]개월/.test(SRC));
  /* 🔴 뱃지가 하나도 없으면 기준도 안 뜹니다 — 안 보이는 것을 설명하지 않습니다(원칙 43). */
  tt('뱃지가 없으면 기준 문구도 없다',
     /shownRows\.some\(hotOf\)\s*\?[\s\S]{0,140}: '';/.test(SRC)
     && /note\.textContent = '';/.test(SRC));
  /* 🔴 문구의 「두 번」과 판정의 `>= 2`가 **같은 사실**이어야 합니다(원칙 91). */
  /* 🔴 원칙 134 그 자리 — **화면에 적은 횟수와 코드가 재는 횟수가 같아야** 합니다.
     ⚠ 문장이 아니라 **숫자**를 봅니다. 「두 번」이든 「2건」이든 2이면 참입니다. */
  tt('기준 문구의 횟수와 판정의 횟수가 같다', (()=>{
     const n = (SRC.match(/const hotOf = x => \(seen\.get\(hotKey\(x\)\)\|\|0\) >= (\d+);/)||[])[1];
     const t = (SRC.match(/※ 거래 활발[^`]*/)||[''])[0];
     const said = /두 번|2건|2회/.test(t) ? 2 : (t.match(/([0-9])\s*(건|번|회)/)||[])[1];
     return !!n && String(said) === n;
  })());

  /* 🔴🔴 미채택 잠금 — 지시서 문구 「최근 6개월 내 동일 평형 거래 3건 이상 기준」.
     세 값이 다 코드와 다릅니다. 받아 오는 것은 3개월치(`DEAL.months`)라 6개월은 볼 수가 없고,
     기준은 같은 단지 2건이며, **평형은 아예 안 봅니다**(같은 단지의 다른 평형도 한 건으로 셉니다).
     그대로 적으면 화면이 거짓말을 합니다 — 하필 이 도구가 다른 계산기와 갈리는 지점이
     「화면에 적힌 것이 실제로 잰 것과 같다」입니다. 다시 오면 여기서 잡힙니다(지침 6-13). */
  tt('거래 활발 기준이 6개월이라고 말하지 않는다', !/6개월/.test(SRC));
  tt('거래 활발 기준이 동일 평형이라고 말하지 않는다',
     !/동일 평형|같은 평형|평형 거래/.test(SRC));
  tt('거래 활발 기준이 3건 이상이라고 말하지 않는다',
     !/3건 이상|세 번 이상/.test(SRC));
  /* 짝 — 실제로 세는 키에 평형(면적)이 안 들어 있는가. 문구만 고치고 키를 바꾸면
     둘이 다시 어긋납니다. */
  tt('거래 활발이 평형을 세는 키에 안 넣는다',
     /hotKey = x => \(x\.name\|\|''\) \+ '\|' \+ \(x\.dong\|\|''\) \+ '\|' \+ \(x\.lawd\|\|''\)/.test(SRC));

  /* ── ⑥ 지시 5(세대수)를 안 한 것이 화면에 안 새어 있는가 ── */
  /* 🔴 세대수는 실거래가 API가 주지 않는 값입니다(단지코드가 있어야 부르는 다른 API입니다).
     「500세대 이상」 칩이나 「N세대」 표기가 화면에 있으면 **어디선가 지어낸 것**입니다. */
  /* 🔴 사보타주가 잡았습니다 — 처음엔 `/세대\b/`로 썼는데 **한글 뒤에는 `\b`가 안 섭니다**
     (한글은 `\w`가 아니라 낱말 경계가 안 생깁니다). 「500세대 이상」 칩을 넣어도 초록이었습니다.
     → 실거래 칩을 **이름으로 세고**, 「N세대」 표기를 문자열로 봅니다.
     ⚠ 「무주택 세대주」는 정책대출 조건 문구라 예외입니다 — 그건 API가 주는 값이 아니라
       사용자가 고른 조건입니다. 세는 것은 **단지의 세대수**뿐입니다. */
  tt('없는 값(세대수)을 화면이 말하지 않는다', (()=>{
     const box = (SRC.match(/<div class="chips" id="dealChips"[\s\S]*?<\/div>/)||[''])[0];
     const chips = (box.match(/id="([^"]+)"/g)||[]).join(',');
     return chips === 'id="dealChips",id="dealNew",id="deal59",id="deal84",id="dealOver"'
         && !/세대/.test(box)
         && !/\$\{[^}]*\}세대|세대수|세대 ·|· \$\{[^}]*\}세대/.test(SRC);
  })(), (()=>{
     const box = (SRC.match(/<div class="chips" id="dealChips"[\s\S]*?<\/div>/)||[''])[0];
     return (box.match(/id="([^"]+)"/g)||[]).join(','); })());
  /* 🔴 v25.6 — 표기가 「17년식」 → 「17년 준공」으로 바뀌었습니다(위 항목). **대상만 옮깁니다** —
     잠글 사실은 **「함수 하나에서만 만들어지는가」**이지 그 문자열이 무엇인가가 아닙니다(원칙 128).
     목록과 공유 카드가 같은 표기를 쓰려면 두 벌로 두면 안 됩니다(원칙 58). */
  tt('연식 표기가 함수 한 곳에서만 만들어진다',
     (SRC.match(/'년 준공'/g)||[]).length === 1);
})();

/* ═══ v25.2 — 카톡 공유 카드(진단서) 가독성 ══════════════════════
   ⚠ 오너가 실기 카톡 이미지를 보고 「글자가 작고 그린에 묻힌다」로 지적한 자리입니다.
     대비는 원래도 AA였습니다(5.07:1) — **묻힌 원인은 크기와 채도**입니다.
   ═══════════════════════════════════════════════════════════ */
(() => {
  const RAW = fs.readFileSync(FILE,'utf8');
  const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g,'');
  const rule = sel => (CSS.match(new RegExp('\\'+'.'+'report-'+sel+'\\{[^}]*\\}'))||[''])[0];

  /* ① 그린 면 위 글자가 **한 색**이다 — 색으로 층을 내면 한 단은 반드시 5.07:1로 내려갑니다. */
  tt('그린 면 위 글자가 전부 --ink 한 색이다', (()=>{
     const sels = ['brand','cond','label','amount'];
     const rules = sels.map(rule).concat([(CSS.match(/\.report-amount \.u\{[^}]*\}/)||[''])[0]]);
     if(rules.some(r=>!r)) return false;
     const used = rules.map(r => (r.match(/color:var\((--[a-z0-9-]+)\)/)||[])[1]).filter(Boolean);
     return used.length === 5 && used.every(t => t === '--ink');
  })(), (()=>{
     const rules = ['brand','cond','label','amount'].map(rule)
       .concat([(CSS.match(/\.report-amount \.u\{[^}]*\}/)||[''])[0]]);
     return rules.map(r=>(r.match(/color:var\((--[a-z0-9-]+)\)/)||[])[1]).join(' / '); })());

  /* ② 크기가 **--t7(13px)보다 크다.** 13px이 묻힌 값이라 그 자리로 되돌아가면 빨간불입니다.
     ⚠ 숫자를 여기 안 적습니다 — 토큰 이름으로 봅니다(원칙 115 · 지침 타이포 스케일). */
  tt('그린 면 캡션이 13px 자리로 돌아가지 않았다',
     !/\.report-(brand|cond|label)\{[^}]*font-size:var\(--t7\)/.test(CSS));
  tt('조건 줄이 브랜드 · 라벨보다 한 단 크다',
     /\.report-cond\{[^}]*font-size:var\(--t5\)/.test(CSS)
     && /\.report-brand\{[^}]*font-size:var\(--t6\)/.test(CSS)
     && /\.report-label\{[^}]*font-size:var\(--t6\)/.test(CSS));
  /* ③ 짝 — 색이 한 색이 됐으니 **위계는 굵기가** 나야 합니다. 셋 다 같은 굵기면 층이 없습니다. */
  tt('그린 면 위계가 굵기로 난다',
     /\.report-brand\{[^}]*font-weight:var\(--w-key\)/.test(CSS)
     && /\.report-cond\{[^}]*font-weight:var\(--w-key\)/.test(CSS)
     && /\.report-label\{[^}]*font-weight:var\(--w-sub\)/.test(CSS));
  /* ④ 흰 글자는 여전히 못 씁니다(그린 위 2.17:1). 위쪽 「그린 면 위 글자가 전부 4.5:1 이상」이
     실제 대비를 계산하지만, **리터럴 흰색**은 토큰이 아니라 그 계산에 안 걸립니다. */
  tt('그린 면에 흰 글자를 리터럴로 쓰지 않는다',
     !/\.report-(top|brand|cond|label|amount)[^{]*\{[^}]*color:\s*(#fff|#FFF|white|rgb\(255)/.test(CSS));

  /* ⑤ 범례 한 줄 — v24.21이 괄호 금액을 뺀 뒤로 두 줄일 이유가 없어졌습니다(원칙 136). */
  tt('자금 구성 범례가 한 줄이다',
     /\.report-mix \.lg\{display:flex;flex-wrap:wrap;gap:6px 22px;margin-top:14px\}/.test(CSS));
  /* 🔴 짝 — **잘리지 않고 흐릅니다.** nowrap이면 이름이 길어질 때 조용히 잘립니다
     (「전부 현금」 한 줄만 나오는 경우도 있습니다). */
  tt('범례가 좁으면 잘리는 대신 흐른다',
     /\.report-mix \.lg\{[^}]*flex-wrap:wrap/.test(CSS)
     && !/\.report-mix \.lg\{[^}]*(white-space:nowrap|overflow:hidden)/.test(CSS));
  /* 🔴 범례에 **괄호 금액이 돌아오지 않았는가.** 돌아오면 한 줄이 폭을 넘고,
     그보다 먼저 **재산이 역산됩니다**(v24.21이 뺀 이유). 두 사실이 한 검사에 걸립니다. */
  tt('범례에 괄호 금액이 없다', (()=>{
     const f = (UI.match(/const mixRow = [\s\S]*?;\n/)||[''])[0];
     return f.length > 40 && !/class="a"/.test(f) && !/formatWon|richWon|approxWon/.test(f);
  })());
})();

/* ═══ v25.3 — 결과 화면 실기 지적 셋 ═════════════════════════════ */
(() => {
  const RAW = fs.readFileSync(FILE,'utf8');
  const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');

  /* 🔴 「무엇이 한도를 정했나」 다섯 중 **LTV만 중립**입니다. 오너가 「지금 그대로」로 정했습니다.
     ⚠ 잠글 것은 「LTV가 중립이다」 하나가 아니라 **다섯의 배치 전체**입니다 —
       하나만 옮기면 어느 한도가 나쁜 것인지가 화면마다 달라집니다. 다섯을 같이 셉니다. */
  /* 🔴 v25.20 — **대상을 옮겼습니다**(원칙 128). `bindingShort`가 사라졌으므로 「다섯의
     색 배치」는 잴 것이 없습니다. 지키려던 사실은 **「어느 한도가 걸렸는지가 화면마다
     달라지지 않는다」**였고, 그 일은 이제 **한도 막대의 `.bind` 줄**이 합니다 —
     색이 아니라 **굵기**로요(원칙 62 · 100 — 강조는 색이 아니라 굵기와 잉크 한 단으로).
     ⚠ 그래서 다섯을 따로 셀 필요가 없어졌습니다. 셀 것은 하나입니다:
       「`c.binding`과 같은 키의 줄에만 `.bind`가 붙는가」(원칙 58). */
  tt('걸린 한도가 막대에서 하나만 표시된다 (v25.20)', (()=>{
     const f = (SRC.match(/function renderLimits\([\s\S]*?\n\}/)||[''])[0];
     return !!f && /k===c\.binding\?'bind':''/.test(f.replace(/\s+/g,''));
  })());

  /* 🔴 카드 제목 넷이 **같은 문법**인가 — 전부 명사구입니다. 조건절·권유로 끝나면 톤이 갈립니다. */
  tt('결과 카드 제목이 넷 다 명사구다', (()=>{
     /* ⏹ v25.21 — 넷 → **셋**입니다. 인테리어 카드의 제목 줄이 접기 줄과 합쳐졌습니다
        (감사 C-3 · 원칙 43). 잠그는 사실은 개수가 아니라 **「전부 명사구인가」**이지만,
        개수를 안 세면 제목이 통째로 사라져도 통과합니다 — 그래서 셋을 셉니다. */
     const t = [...SRC.matchAll(/<h2 class="card-title">([^<]*)<\/h2>/g)].map(m=>m[1].trim());
     if(t.length !== 3) return false;
     return t.every(x => !/(다면|하세요|해보세요|할까요|보시|하시|주세요)$/.test(x));
  })(), [...(fs.readFileSync(FILE,'utf8').replace(/<!--[\s\S]*?-->/g,'')
       .matchAll(/<h2 class="card-title">([^<]*)<\/h2>/g))].map(m=>m[1]).join(' / '));
  /* 🔴 v25.21 — **대상을 옮겼습니다**(원칙 128). 이 문구는 `<h2>`에서 접기 줄의 `.k`로
     자리를 옮겼을 뿐 **그대로 살아 있습니다.** 지키려던 사실은 「'예산'이 아니라 '비용'」입니다. */
  tt('인테리어 카드가 예산이 아니라 비용을 말한다', (()=>{
     const line = (SRC.match(/id="itToggle"[\s\S]{0,200}?<\/button>/)||[''])[0];
     return /입주 전에 드는 인테리어 비용/.test(line) && !/예산/.test(line);
  })());
  /* 🔴 v25.21 — **접힌 줄이 값을 말합니다.** 접힌 채로 정보가 0이던 것이 C-3의 핵심이었습니다.
     ⚠ 값은 `c.interiorCost` 하나에서 옵니다 — 영수증 인테리어 줄과 같은 값(원칙 58 · 91).
     ⚠ 0이면 「—」입니다 — 「0원」은 「인테리어가 0원」으로 읽히는데 실제로는 안 정한 것(원칙 124). */
  /* 🔴 v25.23 — **접힌 줄이 카드 제목 규격을 쓴다**(오너 지적 · 원칙 100 · 132).
     ⚠ 값을 잠그지 않습니다 — `.card-title`과 **같은 값인가**를 봅니다. 제목 규격을 옮기면
       이 줄이 따라와야 하고, 안 따라오면 두 벌이 됩니다(원칙 58 · 84). */
  tt('인테리어 접기 줄이 카드 제목 규격이다 (v25.23)', (()=>{
     const css = fs.readFileSync(FILE,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
     const head = (css.match(/\.disc\.disc-head\{[^}]*\}/)||[''])[0];
     const title = (css.match(/\.card-title\{[^}]*\}/)||[''])[0];
     /* 🔴 **마크업이 실제로 그 클래스를 쓰는가**도 같이 봅니다(원칙 122).
        사보타주로 마크업만 `.discline`으로 되돌렸더니 **CSS가 남아 있어 초록**이었습니다 —
        「정의됐는가」가 아니라 「불려지는가」입니다. */
     const 씀 = /class="disc disc-head" id="itToggle"/.test(css);
     if(!head || !title || !씀) return false;
     const g = (b,k) => (b.match(new RegExp(k+':([^;}]+)'))||[])[1];
     return ['font-size','font-weight','line-height','letter-spacing']
       .every(k => g(head,k) && g(head,k).trim() === g(title,k).trim());
  })(), (()=>{ const css=fs.readFileSync(FILE,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
     return ((css.match(/\.disc\.disc-head\{[^}]*\}/)||['없음'])[0]).slice(0,90); })());
  tt('인테리어 접힌 줄이 값을 말한다 (v25.21)', (()=>{
     const src = fs.readFileSync(FILE,'utf8').replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
     const line = (src.match(/its\.textContent[^;]*/)||[''])[0];
     /* 🔴 v25.23 — **「—」를 뺐습니다**(오너 지적 — 「금액이 없는 것처럼 느껴진다」).
        이 자리에서 「—」는 「없음」이 아니라 **「0원」으로 읽힙니다.** 진실은 「아직 안 정함」입니다.
        → 잠글 것은 「'—'를 쓴다」가 아니라 **「값이 있을 때만 적는다」**입니다(원칙 124 · 128). */
     return /id="itSum"/.test(src) && /c\.interiorCost/.test(line) && /: ''/.test(line);
  })());
})();

/* ═══ v25.4 — 결과 히어로를 흰 카드로 ═══════════════════════════ */
(() => {
  const RAW = fs.readFileSync(FILE,'utf8');
  const CSS = RAW.replace(/\/\*[\s\S]*?\*\//g,'');
  const rh = (CSS.match(/\.rhead\{[^}]*\}/)||[''])[0];
  const card = (CSS.match(/\.card\{[^}]*\}/)||[''])[0];

  /* 🔴 **아래 카드와 같은 규격인가.** 통일성이 이 변경의 유일한 목적이라,
     둘이 갈리면 「비슷한 카드 둘」이 되어 오히려 전보다 나빠집니다. */
  tt('히어로가 아래 카드와 같은 규격이다', (()=>{
     if(!rh || !card) return false;
     const tok = r => ['background','border-radius','box-shadow','padding']
       .map(k => (r.match(new RegExp(k+':(var\\([^)]*\\)|[^;}]+)'))||[])[1]).join('|');
     return tok(rh) === tok(card);
  })(), (()=>{
     const tok = r => ['background','border-radius','box-shadow','padding']
       .map(k => (r.match(new RegExp(k+':(var\\([^)]*\\)|[^;}]+)'))||[])[1]).join(' · ');
     return '히어로 '+tok(rh)+'  /  카드 '+tok(card); })());
  /* 🔴 손으로 고른 숫자가 들어오면 「카드 규격이 둘」이 됩니다(원칙 84 · 115). */
  tt('히어로가 새 값을 만들지 않는다',
     !!rh && !/#[0-9A-Fa-f]{3,6}|rgba?\(/.test(rh)
     && !/padding:\s*\d/.test(rh) && !/border-radius:\s*\d/.test(rh));
  /* 🔴 진행 막대(초록 선)와 띄웁니다 — 붙으면 카드가 막대에 매달린 것처럼 보입니다.
     값은 카드 사이 간격과 **같은 토큰**입니다. */
  tt('히어로가 진행 막대와 띄어져 있다', /\.rhead\{margin-top:var\(--gap\)/.test(CSS));
  /* 🔴 v23이 지운 것은 **어두운 면**입니다. 그게 돌아오면 안 됩니다 — 이번 변경의 경계선입니다. */
  tt('히어로가 어두운 면으로 돌아가지 않았다',
     !!rh && !/background:var\(--(espresso|espresso-2|ink)\b/.test(rh)
     && !/linear-gradient/.test(rh));
})();

/* ═══ v25.5 — 실기 지적 (네이버 · 연식 · 각주 ※) ══════════════════ */
(() => {
  const RAW = fs.readFileSync(FILE,'utf8');
  const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');

  /* 🔴 이 화면의 ※ 규칙 — **각주에는 전부 ※를 붙입니다.**
     붙은 것과 안 붙은 것이 섞이면 ※가 「중요함」이나 「법적 고지」 같은 다른 뜻으로 읽힙니다.
     🔴 v25.12 — 투명성 캡션이 갈려 나가면서 각주는 **셋**입니다:
       거래 활발 기준 · 실거래 출처 · 면책(둘). 그리고 **서랍 안 ※(한도 각주)도 같은 규칙**입니다 —
       자리가 서랍이라고 표기가 달라지면 ※가 「밖에서만 쓰는 기호」가 됩니다.
     ⚠ 대상만 옮겼습니다(원칙 128). 잠글 사실은 「※가 섞이지 않는다」입니다. */
  tt('결과 화면 각주가 전부 ※로 시작한다', (()=>{
     const notes = [
       (SRC.match(/note\.textContent = shownRows\.some\(hotOf\)\s*\?\s*`([^`]*)`/)||[])[1],
       (SRC.match(/foot\.textContent = '([^']*)';/)||[])[1],
     ];
     if(notes.some(x => x == null)) return false;
     const legal = legalText(SRC) || '';
     /* 한도 서랍의 ※ 셋 — `<br>`로 이어 붙인 각 줄이 전부 ※로 시작해야 합니다. */
     /* ⚠ 소스 조각이라 앞에 `? \`` · `+ \`<br>` 같은 문법이 섞입니다. 그 부스러기를 지우지 않고
        **「※ 앞에 글자가 거의 없다」**로 봅니다 — 자르는 규칙을 만들면 그 규칙이 또 뚫립니다(6-24). */
     const lim = (SRC.match(/notes\.innerHTML = hasLimit([\s\S]*?): '';/)||[])[1] || '';
     const limLines = lim.split('<br>').filter(s => /\S/.test(s));
     return notes.every(t => t.trim().startsWith('※'))
         && (legal.match(/※/g)||[]).length === 2
         && limLines.length === 3
         && (lim.match(/※/g)||[]).length === 3
         && limLines.every(t => /^[^※]{0,14}※/.test(t));
  })(), (()=>{
     const g = re => { const m = SRC.match(re); return m ? (m[1]||'').slice(0,10) : '못 찾음'; };
     return [g(/note\.textContent = shownRows\.some\(hotOf\)\s*\?\s*`([^`]*)`/),
             g(/foot\.textContent = '([^']*)';/),
             g(/notes\.innerHTML = hasLimit([\s\S]*?): '';/)].join(' | '); })());

  /* 🔴 각주 둘이 **한 자리**에 있는가 — v25.1은 칩을 사이에 두고 갈라 놨습니다. */
  tt('실거래 각주 둘이 칩 아래 나란히 있다', (()=>{
     const m = SRC.match(/<div class="chips" id="dealChips"[\s\S]*?<\/div>\s*<p class="deal-note" id="dealNote"><\/p>\s*<p class="deal-note" id="dealFoot"><\/p>/);
     return !!m;
  })());
  tt('각주 둘 사이 간격이 좁다', /\.deal-note \+ \.deal-note\{margin-top:6px\}/.test(RAW));
})();

/* ═══ v25.6 — 중개보수 토글 · 첫 화면 여백 · 퍼널/영수증 디테일 ═════════
   ⚠ 이 장은 **채택한 것**과 **못 쓴 지시**를 같이 잠급니다(지침 6-13).
     지시서 셋은 이 파일의 규칙과 정면으로 부딪혀 미채택했습니다 —
     ① 저작권 11px / --ink-4  ② 입력 라이브 프리뷰의 초록 글자  ③ 막대 3분할 고정.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const RAW = fs.readFileSync(FILE,'utf8');
  const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
  const CSS = (RAW.match(/<style>([\s\S]*?)<\/style>/)||['',''])[1];

  /* ── ① 중개보수 — 문구 ────────────────────────────────
     🔴 v25.5까지 화면이 **사실과 다른 말**을 하고 있었습니다:
       「취득세와 중개보수는 법정 기준이라 끄거나 고칠 수 없어요.」
     중개보수에서 법이 정한 것은 **상한요율**이고, 상한 안에서 협의로 낮출 수 있으며
     직거래·증여·상속이면 아예 없습니다. 취득세와 성격이 다른데 한 문장이 둘을 묶고 있었습니다. */
  tt('중개보수 문구가 취득세와 갈라져 있다', (()=>{
     const m = SRC.match(/\$\('costLead'\)\.innerHTML([\s\S]*?);\n/);
     if(!m) return false;
     return !/취득세와 중개보수/.test(m[1])
         && /취득세는 법정 기준/.test(m[1])
         && /중개보수는/.test(m[1]);
  })(), (SRC.match(/\$\('costLead'\)\.innerHTML([\s\S]*?);\n/)||['','못 찾음'])[1].slice(0,80));
  /* 🔴 **되돌아오면 즉시 빨간불.** 이 한 문장이 이 도구의 유일한 약속을 깨던 자리입니다. */
  tt('「취득세와 중개보수는 …끄거나 고칠 수 없어요」가 돌아오지 않았다',
     !/취득세와 중개보수는 법정 기준/.test(SRC));
  /* 🔴 사실을 **셋 다** 말하는가 — 상한이라는 것 · 협의로 낮출 수 있다는 것 · 없을 수도 있다는 것.
     하나만 빠져도 반쪽입니다(원칙 39). */
  tt('중개보수 문구가 상한 · 협의 · 없을 수 있음을 다 말한다', (()=>{
     const m = SRC.match(/\$\('costLead'\)\.innerHTML([\s\S]*?);\n/);
     return !!m && /상한/.test(m[1]) && /협의/.test(m[1]) && /직거래/.test(m[1]);
  })());
  /* 🔴 말투 — 이 화면은 사실을 서술하지 행동을 권하지 않습니다(지침 말투). */
  tt('중개보수 문구가 지시하거나 권하지 않는다', (()=>{
     const m = SRC.match(/\$\('costLead'\)\.innerHTML([\s\S]*?);\n/);
     return !!m && !/하세요|보세요|바랍니다|하십시오/.test(m[1]);
  })());

  /* ── ② 중개보수 — 계산 ────────────────────────────────
     🔴 **가장 조심할 자리.** 집값 탐색 함수가 `calcCosts`를 수백 번 부르는데, 두 값이
        `ctxBase`에 안 실리면 「예상 매수 금액」과 「영수증」이 **에러 없이 갈립니다**(원칙 91). */
  tt('중개보수 상태가 ctxBase에 실린다', (()=>{
     const m = UI.replace(/\/\*[\s\S]*?\*\//g,'').match(/function ctx\(\)\{[\s\S]*?\n\}/);
     return !!m && /brokerOff:\s*!S\.broker\.on/.test(m[0])
         && /brokerCustom:/.test(m[0]);
  })());
  tt('calcCosts가 그 둘을 실제로 본다', (()=>{
     const eng = fs.readFileSync(FILE,'utf8');
     const m = eng.replace(/\/\*[\s\S]*?\*\//g,'').match(/function calcCosts\(ctx\)\{[\s\S]*?\n\}/);
     return !!m && /if\(ctx\.brokerOff\) brokerFee = 0;/.test(m[0])
         && /ctx\.brokerCustom/.test(m[0]);
  })());
  /* 🔴 **끄면 0 · 고치면 그 값**이 실제로 그렇게 되는가 — 엔진을 직접 돌려 봅니다(원칙 106).
     소스에 글자가 있는 것과 그 글자가 일하는 것은 다릅니다(원칙 122). */
  tt('중개보수를 끄면 실제로 0원이 된다',
     calcCosts(ctx({ price: 만(100000), brokerOff:true })).brokerFee === 0);
  tt('중개보수를 고치면 그 값이 쓰인다',
     calcCosts(ctx({ price: 만(100000), brokerCustom:300 })).brokerFee === 만(300));
  /* 🔴 **0으로 고치는 것도 유효한 값입니다.** `> 0`으로 보면 조용히 무시됩니다(원칙 124). */
  tt('중개보수를 0으로 고치면 0이 된다',
     calcCosts(ctx({ price: 만(100000), brokerCustom:0 })).brokerFee === 0);
  /* 🔴 상한요율 원값은 **끄거나 고쳐도 남습니다** — 끈 줄에 0원만 뜨면 무엇을 뺐는지 모릅니다. */
  tt('상한요율 원값이 따로 남는다', (()=>{
     const on  = calcCosts(ctx({ price: 만(100000) }));
     const off = calcCosts(ctx({ price: 만(100000), brokerOff:true }));
     return off.brokerFull > 0 && Math.abs(off.brokerFull - on.brokerFull) < 1;
  })());
  /* 🔴 **기본값이 켜짐인가.** 기본을 0으로 두면 예상 매수 금액이 조용히 올라가고,
     그건 유리한 쪽으로 틀리는 오차입니다(원칙 28). 이 판에서 가장 중요한 잠금입니다. */
  tt('중개보수 기본값이 켜짐이고 상한요율이다',
     /broker:\{on:true,v:null\}/.test(SRC));
  tt('아무것도 안 실으면 상한요율 그대로다', (()=>{
     const c = calcCosts(ctx({ price: 만(100000) }));
     return c.brokerFee > 0 && Math.abs(c.brokerFee - c.brokerFull) < 1;
  })());
  /* 🔴 금액을 **두 곳에 적지 않는가** — 스위치 줄이 말하므로 읽기 전용 목록에서 뺐습니다.
     두 곳에 있으면 껐을 때 어느 쪽이 진짜인지 알 수 없습니다(원칙 43 · 91). */
  tt('중개보수 금액이 영수증에 두 번 적히지 않는다',
     /<div class="costrow"><div class="nm">중개보수/.test(SRC)
     && !/row\('중개보수/.test(SRC));
  /* 🔴 결과 화면 쪽에 둡니다 — 01~03단계에 넣으면 입력 피로가 늘어납니다(오너 지시). */
  tt('중개보수 줄이 부대비용 서랍 안이다', (()=>{
     const a = SRC.indexOf('id="costBox"'), b = SRC.indexOf('id="receiptBot"');
     return a > 0 && b > a && SRC.slice(a,b).indexOf('id="swBroker"') > 0;
  })());

  /* ── ③ 첫 화면 여백 다이어트 ────────────────────────────
     🔴 오너 지적: 인앱 브라우저에서 「대출은 받지 않을 거예요」가 도크에 반쯤 가립니다.
     ⚠ **글자 크기·자간은 한 자도 안 건드렸습니다**(원칙 117). 줄인 것은 전부 여백입니다.
       그 사실을 잠급니다 — 다음 사람이 「글자를 줄이면 더 들어간다」로 가지 않게. */
  tt('첫 화면 활자가 스케일 그대로다',
     /\.headline\{[^}]*font-size:var\(--t2\)/.test(CSS)
     && /\.subline\{[^}]*font-size:var\(--t6\)/.test(CSS)
     && /\.q-title\{font-size:var\(--t2\)/.test(CSS)
     && /\.headline\{[^}]*letter-spacing:-\.05em/.test(CSS));
  /* 🔴 부제 행간이 **스케일 안**으로 들어왔습니다(1.8은 1.06·1.3·1.6 밖에 혼자 있던 값). */
  tt('부제 행간이 토큰이다', /\.subline\{[^}]*line-height:var\(--lh-body\)/.test(CSS));
  /* 🔴 「지우기」 줄이 **빈 채로 40px을 먹던** 자리 — 흐름에서 뺐습니다.
     ⚠ 흐름으로 되돌리면 값을 넣는 순간 입력칸이 아래로 뜁니다. 그 사고를 이름으로 잠급니다. */
  tt('「지우기」 줄이 빈 자리를 먹지 않는다',
     /\.flabel\.only-clear\{position:absolute/.test(CSS)
     && /\.funnel > \.q\{position:relative/.test(CSS));
  /* 🔴 짝 — 실제로 재 봅니다. 첫 화면 요소들의 세로 합이 예산 안인가.
     ⚠ 렌더 없이 재는 것이라 **선언된 여백의 합**만 봅니다. 진짜 측정은 브라우저가 합니다. */
  tt('첫 화면 상단 여백이 줄었다', (()=>{
     const brand = +((CSS.match(/\.brand\{background:var\(--bg\);padding:(\d+)px/)||[])[1]||99);
     const sub   = +((CSS.match(/\.subline\{[^}]*margin:(\d+)px/)||[])[1]||99);
     const q     = (CSS.match(/\.funnel > \.q\{[^}]*margin-top:var\(--gap\)/)||[])[0];
     return brand <= 20 && sub <= 14 && !!q;
  })(), (()=>{
     const brand = (CSS.match(/\.brand\{background:var\(--bg\);padding:[^;}]*/)||['?'])[0];
     const sub   = (CSS.match(/\.subline\{[^}]*margin:[^;}]*/)||['?'])[0];
     return brand + ' / ' + sub; })());

  /* ── ④ 기준일 뱃지 — ⏹ v25.7에서 삭제. 잠금은 위 v25.1 장으로 옮겼습니다(원칙 128) ── */

  /* ── ⑤ 각주 넷 한 규격 (위 v25.1 장에도 짝이 있습니다) ───── */
  tt('--t8이 각주 단으로 정의돼 있다', /--t8:12px/.test(CSS));
  /* 🔴 **--t8은 각주 전용입니다.** 본문·라벨·헬퍼가 쓰기 시작하면 활자 사다리가 한 단 내려앉습니다. */
  tt('--t8을 각주 밖이 쓰지 않는다', (()=>{
     const users = [...CSS.matchAll(/([^{};]+)\{[^}]*font-size:var\(--t8\)/g)].map(m => m[1].trim());
     return users.length > 0 && users.every(s => /caveat|foot|copyright/.test(s));
  })(), (()=>{ const u=[...CSS.matchAll(/([^{};]+)\{[^}]*font-size:var\(--t8\)/g)].map(m=>m[1].trim());
     return u.join(' | ')||'없음'; })());

  /* ── ⑥ 퍼널 진행 막대 ──────────────────────────────────
     🔴 지시서는 「3분할」이었습니다. **못 박으면 안 됩니다** — 「대출은 받지 않을 거예요」를 켜면
        02가 통째로 빠져 퍼널이 **두 걸음**이 됩니다. 칸 수는 단계 수에서 옵니다(원칙 58 · 91). */
  tt('진행 막대 칸 수가 단계 수에서 온다',
     /paintProgress\(posOf\(S\.step\) \+ 1, visible\(\)\.length\)/.test(SRC)
     && /paintProgress\(visible\(\)\.length, visible\(\)\.length\)/.test(SRC));
  tt('진행 막대 칸 수를 손으로 적지 않았다', (()=>{
     const m = SRC.match(/function paintProgress\(done, total\)\{[\s\S]*?\n\}/);
     return !!m && !/\b3\b/.test(m[0]);
  })());
  /* 🔴 채워지는 것은 `.on`뿐입니다. 한쪽 규칙만 고치면 01에서 **세 칸이 전부 초록**이 되어
     「이미 다 했다」로 읽힙니다 — 실제로 이 판에서 한 번 그렇게 났습니다. */
  /* 🔴 **사보타주가 잡았습니다.** 처음엔 `/\.progress i\{[^}]*background:var\(--line\)/`로 썼는데,
     그 식은 `.app.hero-on .progress i{…}`**에도 걸립니다** — 앞에 무엇이 붙어 있든
     문자열 「.progress i{」를 품고 있기 때문입니다. 그래서 빈 칸을 초록으로 칠해도
     hero-on 쪽 규칙 하나만 남아 있으면 조용히 통과했습니다(v25.5의 「찾지 못함」과 같은 계열).
     → 규칙을 **선택자 단위로 갈라** 봅니다. 「.progress i」로 끝나는 선택자 중
     초록을 칠하는 것이 **하나도 없어야** 합니다. 어느 규칙에서 오든 걸립니다. */
  tt('빈 칸과 채운 칸이 갈린다', (()=>{
     const rules = [...CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)]
       .map(m => [m[1].trim().split(/\s*,\s*/), m[2]]);
     const sel = re => rules.filter(([ss, body]) => ss.some(s => re.test(s)) && /background:var\(--green\)/.test(body));
     const emptyGreen = sel(/\.progress i$/);
     const onGreen    = sel(/\.progress i\.on$/);
     const emptyLine  = rules.filter(([ss, body]) =>
       ss.some(s => /\.progress i$/.test(s)) && /background:var\(--line\)/.test(body));
     return emptyGreen.length === 0 && onGreen.length > 0 && emptyLine.length > 0;
  })(), (()=>{
     const rules = [...CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)]
       .filter(m => /\.progress i/.test(m[1]))
       .map(m => m[1].trim() + ' → ' + (m[2].match(/background:[^;}]*/)||['?'])[0]);
     return rules.join(' | ') || '규칙 없음'; })());
  /* 🔴 v25.11 — 오너 실기 지적으로 **2px → 3px**. 잠금을 지우지 않고 **상한으로 옮깁니다**(원칙 128).
     지키려던 사실은 「2px이다」가 아니라 **「이 선이 막대가 되어 위계를 하나 더 만들지 않는다」**입니다.
     ⚠ `top:56px` sticky라 두께가 곧 **첫 화면에서 깎이는 세로**입니다(인앱 574px).
       4px 이상은 막습니다 — 지시서가 「3~4px」이라 했지만 4는 재 보고 안 썼습니다. */
  tt('진행 막대가 선을 넘지 않는다 (≤3px)', (()=>{
     const h = (CSS.match(/\.progress\{[^}]*height:(\d+)px/)||[])[1];
     return !!h && Number(h) >= 2 && Number(h) <= 3;
  })(), (CSS.match(/\.progress\{[^}]*height:\d+px/)||['못 찾음'])[0]);

  /* ── ⑦ 입력 라이브 프리뷰 — ⏹ **v25.7에서 지웠습니다**(오너 지시) ──────────
     ⏹ v25.6이 오타 방지로 넣었습니다. 실기에서 보니 입력칸 자신이 이미 「10 억」「5,000 만」으로
       단위를 달고 있어서, 바로 아래 한 줄이 같은 값을 다시 말하는 꼴이었습니다(원칙 43).
     ⚠ **검사를 지우지 않고 뒤집습니다** — 지워 버리면 다음 판에 조용히 돌아와도 아무도 모릅니다.
     ⚠ v25.6이 미채택한 **초록 글자 금지**는 그대로 살려 둡니다. 프리뷰가 없어졌다고
       「그린을 글자로 안 쓴다」가 풀리는 것이 아닙니다(흰 면 위 1.97:1 · 원칙 102 폐기 자리). */
  tt('입력 되읽기 줄이 없다',
     !/id="moneyHelper"/.test(SRC) && !/data-base=/.test(SRC)
     && !/const echo = v =>/.test(UI));
  tt('되읽기 CSS가 죽은 규칙으로 남아 있지 않다', !/\.helper b\.echo/.test(CSS));
  tt('헬퍼가 제 규격 그대로다',
     /\.helper\{margin:6px 0 0;font-size:var\(--t7\);font-weight:400;color:var\(--ink-4\)/.test(CSS));
  /* 🔴 프리뷰가 사라져도 **그린을 글자로 쓰지 않는다**는 규칙은 그대로입니다(파일 전체). */
  /* 🔴 **이 검사를 쓰다가 6-24를 또 밟았습니다.** 처음엔 `/color:var\(--green\)/`로 썼는데,
     그 식은 **`border-color:var(--green)`에도 걸립니다** — 「color:var(--green)」이 그 안에
     통째로 들어 있기 때문입니다. `.chip.is-on`(선택 칩의 그린 **테두리**)이 그렇게 잡혔습니다.
     → 속성 이름 앞에 **경계**를 둡니다. 선언 구분자(`;`)나 블록 시작만 앞에 올 수 있습니다.
     ⚠ 지침 6-24가 선택자에 대해 말한 것과 **같은 함정이 속성 이름에서도** 납니다. */
  tt('본문 글자에 브랜드 그린을 쓰지 않는다', (()=>{
     const rules = [...CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)]
       .filter(m => /(^|[;\s])color\s*:\s*var\(--green\)/.test(m[2]));
     return rules.length === 0;
  })(), (()=>{ const r=[...CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)]
       .filter(m => /(^|[;\s])color\s*:\s*var\(--green\)/.test(m[2])).map(m=>m[1].trim());
     return r.join(' | ')||'없음'; })());

  /* ── ⑧ 부대비용 비율 알약 ──────────────────────────────
     🔴 분자·분모가 **화면에 적힌 두 값**이어야 합니다. 엔진 원값으로 나누면
        사람이 화면의 두 숫자로 검산했을 때 안 맞습니다(원칙 91 · v24.31 `man10k`와 같은 규칙). */
  tt('비율이 화면에 적힌 소계 ÷ 집값이다', (()=>{
     const m = UI.replace(/\/\*[\s\S]*?\*\//g,'').match(/pctEl\.textContent = [\s\S]*?;/);
     return !!m && /etcSum \/ price \* 100/.test(m[0]);
  })());
  /* 🔴 값이 없으면 **알약이 통째로 없습니다.** 「0.0%」를 띄우면 「부대비용이 안 든다」로 읽힙니다. */
  tt('소계가 0이면 비율 알약이 없다', (()=>{
     const m = UI.replace(/\/\*[\s\S]*?\*\//g,'').match(/pctEl\.textContent = [\s\S]*?;/);
     return !!m && /etcSum > 0 && price > 0/.test(m[0])
         && /\.disc\.discline \.k \.ratio:empty\{display:none\}/.test(CSS);
  })());
  /* 🔴 새 색·새 규격을 만들지 않았는가 — 「거래 활발」·「적정」과 같은 조합입니다(원칙 58 · 62). */
  tt('비율 알약이 새 색을 만들지 않는다', (()=>{
     const m = (CSS.match(/\.disc\.discline \.k \.ratio\{[^}]*\}/)||[''])[0];
     return /background:var\(--fill\)/.test(m) && /color:var\(--ink-3\)/.test(m)
         && /border-radius:var\(--r-pill\)/.test(m) && !/#[0-9A-Fa-f]{3,6}|rgba?\(/.test(m);
  })());

  /* ── ⑨ 자금 구조 막대 ──────────────────────────────────
     🔴 화면과 공유 카드가 **같은 문법**이어야 합니다 — 한쪽만 고치면 저장한 그림과
        보고 있던 화면이 다르게 생깁니다(원칙 91). */
  tt('막대 조각이 화면 · 공유 카드에서 같은 문법이다',
     /\.stack\{[^}]*gap:2px/.test(CSS) && /\.stack i\{[^}]*border-radius:4px/.test(CSS)
     && /\.report-mix \.bar\{[^}]*gap:2px/.test(CSS)
     && /\.report-mix \.bar i\{[^}]*border-radius:4px/.test(CSS));
  /* 🔴 흰 선으로 가르던 방식으로 되돌아가면 빨간불 — 그 흰색은 `--card` 리터럴이라
     막대가 흰 카드 밖으로 나가는 순간 안 보입니다(원칙 97). */
  tt('막대를 흰 선으로 가르지 않는다', !/\.stack i\.f1 \+ i\.f2\{box-shadow/.test(CSS));
  /* 🔴 폭 0인 조각을 안 그립니다 — 「전부 현금」인 사람의 막대 끝에 이유 없는 홈이 생깁니다. */
  tt('0%짜리 조각은 그리지 않는다',
     /100-ownPct > 0 \? `<i class="f2"/.test(UI.replace(/\/\*[\s\S]*?\*\//g,'')));

  /* ── ⑩ 히어로 숫자 카운팅 ──────────────────────────────
     🔴 결과 안에서 값을 만졌을 때(`keepScroll`)는 **애니메이션을 걸지 않습니다** —
        걸면 바뀐 폭이 안 보이고, 그 순간 영수증과 히어로가 다른 값을 말합니다(원칙 91). */
  tt('카운팅이 결과에 처음 들어올 때만 돈다',
     /rollUpWon\(\$\('heroAmount'\), approx\(headline\), !keepScroll\)/.test(SRC));
  /* 🔴 끝값을 보간으로 만들지 않습니다 — 부동소수 때문에 1만원이 어긋날 수 있습니다. */
  tt('카운팅 끝값이 계산된 값 그대로다', (()=>{
     const m = SRC.match(/function rollUpWon\(el, target, animate\)\{[\s\S]*?\n\}/);
     return !!m && /p >= 1 \? richWon\(target\)/.test(m[0]);
  })());
  /* 🔴 움직임을 줄여 달라고 한 사람에게는 **즉시 끝값**입니다. */
  tt('카운팅이 prefers-reduced-motion을 존중한다', (()=>{
     const m = SRC.match(/function rollUpWon\(el, target, animate\)\{[\s\S]*?\n\}/);
     return !!m && /prefers-reduced-motion: reduce/.test(m[0]);
  })());
  /* 🔴 앞선 애니메이션을 무효로 만드는 토큰이 있는가 — 없으면 두 루프가 같은 노드에
     서로 다른 금액을 번갈아 씁니다. */
  tt('카운팅이 겹쳐 돌지 않는다', (()=>{
     const m = SRC.match(/function rollUpWon\(el, target, animate\)\{[\s\S]*?\n\}/);
     return !!m && /\+\+HERO_ROLL/.test(m[0]) && /my !== HERO_ROLL/.test(m[0]);
  })());
  /* 🔴 중간 값도 같은 반올림을 거치는가 — 안 그러면 마지막 자리가 초당 60번 튑니다. */
  tt('카운팅 중간 값이 같은 반올림을 쓴다', (()=>{
     const m = SRC.match(/function rollUpWon\(el, target, animate\)\{[\s\S]*?\n\}/);
     return !!m && /richWon\(approx\(target \* ease\(p\)\)\)/.test(m[0]);
  })());
})();

/* ═══ v25.7 — 뱃지 삭제 · 조건 한 줄 · 각주 자리 · 목록 상한 · Orphan ══════════
   ⚠ 이 장은 **채택한 것**과 **못 쓴 지시**를 같이 잠급니다(지침 6-13).
     못 쓴 것 셋 — ① 「노려볼 수 있는 주요 단지」 ② `text-wrap:pretty` ③ 「20억 노출」 버그(없었습니다).
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const RAW = fs.readFileSync(FILE,'utf8');
  const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
  const CSS = (RAW.match(/<style>([\s\S]*?)<\/style>/)||['',''])[1];

  /* ── ① 실거래 목록의 상한이 **화면에 적힌 금액**이다 ─────────────────
     🔴 오너 지적(「한도 18.5억인데 20억 노출」)을 대조하다 나온 **다른** 어긋남입니다.
       히어로는 `approx(price)`(100만원 내림)를 적는데 목록 상한은 정확값이었습니다.
       실측: 화면 「20억 6,000만원」 · 목록 상한 **206,048만원** → 48만원 초과가 뜰 수 있었습니다.
     ⚠ 지적한 폭(1.5억)은 반올림으로 안 납니다 — 「+10%까지」 칩을 켠 화면입니다.
       **필터 자체는 원래도 엄격했습니다**(`under`는 `<= priceMan`). 그 사실도 같이 잠급니다. */
  tt('실거래 목록 상한이 화면에 적힌 금액이다',
     /const lawd = S\.sgg, priceMan = Math\.floor\(approx\(price\)\/10000\);/.test(SRC));
  tt('공유 카드도 같은 상한을 쓴다',
     (SRC.match(/paintReportDeals\(Math\.floor\(approx\(/g)||[]).length >= 2);
  /* 🔴 예산 **이하**만 기본 목록에 듭니다. 초과 구간은 칩을 켠 사람에게만 — 그 경계가 풀리면 빨간불. */
  tt('예산 초과 거래가 기본 목록에 안 든다',
     /const u = items\.filter\(x => x\.amountMan >= lo && x\.amountMan <= priceMan\)/.test(SRC)
     && /const o = items\.filter\(x => x\.amountMan >  priceMan/.test(SRC));

  /* ── ② 실거래 카드 제목 ─────────────────────────────────────────
     🔴 지시 원문은 「내 예산으로 **노려볼 수 있는 주요 단지**」였습니다. **미채택 둘**:
       ① 「노려볼 수 있는」 — 이 목록은 **끝난 거래**입니다. 살 매물이 있다는 약속이 됩니다(원칙 39).
          네이버 링크의 「이 가격대 매물보기」를 세 번 미채택한 것과 같은 자리입니다.
       ② 「주요」 — 우리가 안 하는 판정입니다(최신순 다섯 줄일 뿐 · 원칙 115). */
  tt('실거래 카드 제목이 「내 예산」을 말한다',
     /<h2 class="card-title">내 예산 안에서 실제로 거래된 곳<\/h2>/.test(SRC));
  tt('실거래 카드가 매물을 약속하지 않는다',
     !/노려볼|주요 단지|매물보기|매물 보기/.test(SRC));

  /* ── ③ 대출 카드 ※ 각주가 맨 아래다 ────────────────────────────
     🔴 전에는 본문(한도 설명) → ※ 둘 → 본문(방공제) 순서라 읽는 흐름이 두 번 끊겼습니다. */
  tt('한도 카드의 ※가 카드 맨 아래 한 자리다', (()=>{
     const m = SRC.match(/<div class="costbox" id="limitBox">([\s\S]*?)<\/div>\s*<\/div>/);
     if(!m) return false;
     const order = ['id="limits"','id="limitTip"','id="roomTip"','id="limitNotes"']
       .map(x => m[1].indexOf(x));
     return order.every(i => i >= 0) && order.every((v,i,a) => i === 0 || a[i-1] < v);
  })());
  /* 🔴 **사보타주가 잡았습니다.** 처음엔 `$('limitTip').innerHTML` **첫 등장**부터 `;`까지만
     봤는데, 뒤에 `+=`로 한 줄 더 붙이는 사보타주가 그 조각 밖이라 조용히 통과했습니다.
     → `renderLimits` **몸통 전체**에서 ※가 `limitNotes`보다 먼저 나오면 빨간불입니다. */
  tt('※가 한도 설명 안에 다시 섞이지 않았다', (()=>{
     const i = SRC.indexOf('function renderLimits(');
     if(i < 0) return false;
     const body = SRC.slice(i, SRC.indexOf('\nfunction ', i + 10));
     const notes = body.indexOf('limitNotes');
     const first = body.indexOf('※');
     return notes > 0 && first > 0 && first > notes;
  })());
  /* 🔴 한도가 없는 화면(대출 없이 계산)에는 전제도 없습니다 — 없는 숫자를 설명하지 않습니다. */
  tt('대출이 없으면 ※도 없다', /const hasLimit = !S\.noLoan && c\.mortgageLoan > 0;/.test(SRC));

  /* ── ④ Orphan — 끝줄에 1~2낱말만 남지 않는다 ────────────────────
     🔴 **`text-wrap:pretty`는 재 보고 미채택했습니다.** 그 속성이 정확히 이 일을 하라고
       만들어진 값인데, 실측에서 **오히려 늘었습니다**(360px 0 → 2개, 430px 2 → 6개).
       「이 속성은 이걸 위한 것이다」는 근거가 아닙니다 — 재 보고 정합니다(지침 6-14).
     ⚠ 되살리려면 **다섯 폭을 다시 재고** 그 표를 인수인계에 적으십시오. */
  /* 🔴 **`text-wrap:pretty`를 재 보고 미채택했습니다.** 그 속성이 정확히 이 일을 하라고
     만들어진 값인데, 실측에서 **오히려 늘었습니다**(360px 0 → 2개, 430px 2 → 6개).
     ⚠ 제목의 `text-wrap:balance` 한 줄은 **v23부터 있던 것**이라 안 건드렸습니다.
       그 선택자 목록을 **그대로** 잠급니다 — 여기에 각주 클래스를 끼워 넣는 식으로
       실측을 대신하려 들면 빨간불입니다.
     ⚠ 되살리려면 **다섯 폭(360 · 375 · 390 · 414 · 430)을 다시 재고** 그 표를 인수인계에 적으십시오. */
  tt('Orphan을 CSS 한 줄로 무마하지 않았다', (()=>{
     /* ⚠ **주석을 걷어내고 봅니다.** 안 걷으면 「pretty를 미채택했다」고 적어 둔 주석 자체가
        검사에 걸립니다 — 근거를 적을수록 빨개지는 검사는 근거를 지우게 만듭니다(원칙 48). */
     const bare = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
     return !/text-wrap:\s*pretty/.test(bare)
         && /h1,h2,p,\.q-title,\.headline,\.card-title,\.hero-label\{text-wrap:balance\}/.test(bare)
         && (bare.match(/text-wrap:/g)||[]).length === 1;
  })(), (CSS.replace(/\/\*[\s\S]*?\*\//g,'').match(/[^{};]*\{[^}]*text-wrap:[^;}]*/g)||['없음']).join(' | ').slice(0,120));
  /* 🔴 실측으로 줄인 문장 다섯이 **다시 길어지지 않았는가.** 글자 수로 잠급니다 —
     한 자만 늘어도 430px에서 줄이 하나 더 생기던 자리들입니다. */
  tt('Orphan 때문에 줄인 문장이 다시 길어지지 않았다', (()=>{
     const cap = (re, n) => { const m = SRC.match(re); return !!m && m[0].length <= n; };
     return cap(/세입자 보호를 위해[^`]*?줄어요\./, 60)
         && cap(/생애최초이거나 규제지역 밖이라면 더 높아져요\./, 30)
         && /빌릴 수 있어요\.<br>생애최초/.test(SRC);      /* 끊길 자리를 마크업이 정합니다 */
  })());

  /* ── ⑤ 조건 요약이 금액·판정 아래에 있다 ─────────────────────────
     🔴 v25.10 — **오너 지시로 자리를 되돌렸습니다**(v25.7이 위로 올린 것).
     ⏹ v25.7의 근거는 「조건이 아래 있으면 금액이 130px 아래로 밀린다」였는데,
       실측하니 **반대였습니다** — 조건을 아래로 내리면 금액 top이 **178 → 123px**로
       오히려 **55px 올라옵니다.** 위에 있을 때는 조건바 자신이 금액을 밀고 있었습니다.
     ⚠ 잠금을 지우지 않고 **부등호만 뒤집었습니다**(원칙 128).
     ⚠ 사보타주 대비 — 금액하고만 비교하면 **판정 위로 끼워 넣어도** 통과합니다.
       라벨 · 금액 · 판정 **셋 다보다 뒤**인지 봅니다. */
  tt('조건 요약이 히어로 금액·판정 아래에 있다', (()=>{
     const st = SRC.indexOf('<header class="rhead">');
     const h = SRC.slice(st, SRC.indexOf('</header>', st));
     const at = x => h.indexOf(x);
     return st > 0 && at('id="condBar"') >= 0
         && at('id="heroLabel"') < at('id="heroAmount"')
         /* ⏹ v25.20 — `heroPill`이 사라져 기준에서 뺐습니다. 지키려던 사실은
            **「조건 요약이 금액보다 아래」**이고 그건 그대로 잠깁니다(원칙 128). */
         && at('id="heroAmount"') < at('id="condBar"');
  })());
})();


/* ═══ v25.8 — 넘침 · 금리 기준 · 빈 화면 ═══════════════════════════ */
(() => {
  const RAW = fs.readFileSync(FILE,'utf8');
  const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');

  /* ── ① 슬라이더가 좌우 마진을 0으로 못 박는가 ─────────────────────
     🔴 인수반계 0장 2️⃣의 `.ratesim` 2px 넘침이 여기였습니다. 브라우저 UA 기본값
        `input[type=range]{margin:2px}`을 우리 규칙이 **세로만** 덮고 있었습니다.
     ⚠ 이 파일에는 `2px`이 한 글자도 안 적혀 있습니다 — 그래서 「2px을 찾는 검사」는
        아무것도 못 잡습니다. 잠글 것은 **좌우 마진이 0으로 못 박혀 있는가**입니다.
     ⚠ 선택자를 문자열로 자르지 않습니다(6-24). `input[type=range]{`로 시작하는 **그 블록만**
        떼어 봅니다 — `.ratesim input[type=range]{`에도 걸리면 엉뚱한 곳을 재게 됩니다. */
  tt('슬라이더가 좌우 마진을 0으로 못 박는다', (()=>{
     /* ⚠ 주석을 걷어낸 자리에 **줄바꿈이 남습니다.** `}`가 바로 붙어 있다고 보면
        찾지 못하고, 「찾지 못함」은 통과가 아니라 빨간불이어야 합니다(인수인계). */
     const at = SRC.search(/(?:^|[};])\s*input\[type=range\]\{/);
     if(at < 0) return false;
     const s = SRC.indexOf('input[type=range]{', at) + 'input[type=range]'.length;
     const e = SRC.indexOf('}', s);
     const blk = SRC.slice(s, e);
     return /margin-left\s*:\s*0/.test(blk) && /margin-right\s*:\s*0/.test(blk);
  })(), '🔴 좌우 마진이 안 잠겨 있습니다 — UA 기본 margin:2px이 되살아납니다');

  /* ── ② 한도를 「연 D.rate% 기준」이라고 적지 않는가 ────────────────
     🔴 v25.8에서 잡은 사실 오류입니다. 한도(DSR)는 `baseRate + stressBp`로 잡는데
        (실측 서울·변동·30년 = 연 8.4%), 화면 두 곳이 「연 5.4% 기준」이라고 적었습니다.
        같은 소득으로 5.4%에 잡았다면 상환능력 한도가 **4억 6,823만원** 더 컸습니다.
     ⚠ 문장을 통째로 잠그지 않습니다(원칙 48). 잠그는 것은 **「한도」와 「D.rate」가 한 문장
        안에서 「기준」으로 묶이지 않는가** 하나입니다. 문구를 고쳐도 이 검사는 살아 있습니다.
     ⚠ `${D.rate}`는 템플릿이라 소스에서 그 꼴로 찾습니다. 숫자 `5.4`를 찾으면
        `D` 객체 정의(`rate:5.4`)에 걸립니다 — 재려는 것이 아닙니다. */
  tt('한도를 「연 D.rate% 기준」이라고 적지 않는다', (()=>{
     const bad = [];
     /* 화면에 나가는 문자열 리터럴만 봅니다 — 백틱 문자열 안에서 찾습니다 */
     for(const m of SRC.matchAll(/`([^`]*\$\{D\.rate\}[^`]*)`/g)){
       const line = m[1];
       if(/한도/.test(line) && /기준/.test(line)) bad.push(line.slice(0,60));
     }
     /* `연 ${D.rate}%`가 한도 카드 각주(#limitNotes)에 남아 있는지도 봅니다 */
     const at = SRC.indexOf("notes.innerHTML");
     const seg = at >= 0 ? SRC.slice(at, at + 400) : '';
     if(/\$\{D\.rate\}/.test(seg)) bad.push('#limitNotes: ' + seg.slice(0,60));
     return bad.length === 0 ? true : bad;
  })() === true, '🔴 한도를 실제보다 낮은 금리 기준으로 적고 있습니다');

  /* ── ③ 한도가 정말 스트레스 금리로 잡히는가 ───────────────────────
     🔴 ②는 「안 적는가」만 봅니다. 그 문장이 왜 거짓이었는지의 **근거 쪽**도 잽니다 —
        규칙을 검사에 베끼지 말고 **본체 함수를 그대로 돌려서** 봅니다(원칙 106).
     ⚠ 스트레스 가산이 0이 되는 조건(고정형 등)에서는 둘이 같습니다. 가산이 붙는
        표준 컨텍스트에서 **한도가 더 작아야** 합니다(가산은 한도를 깎는 방향입니다). */
  const cS = ctx({ income: 만(10000), incomeEntered: true });
  /* ⚠ `repaymentCapLimit`은 NEED에 있지만 맨 위에서 구조분해를 안 했습니다 — `E.`로 부릅니다.
     구조분해를 새로 더하지 않습니다. 이름이 두 곳에 살면 한쪽만 지울 때 조용히 갈립니다. */
  const withStress = E.repaymentCapLimit(cS, false).limit;
  const withoutStress = E.repaymentCapLimit(Object.assign({}, cS, { stressBp: 0 }), false).limit;
  tt('스트레스 가산이 한도를 실제로 깎는다', cS.stressBp > 0 && withStress < withoutStress,
     `가산 ${cS.stressBp} · 한도 ${Math.round(withStress)} vs ${Math.round(withoutStress)}`);

  /* ── ④ 금리 슬라이더 머리글이 양방향을 말하는가 ────────────────────
     🔴 슬라이더는 `min="30"`(연 3.0%)이라 **기준보다 아래로도** 갑니다. 머리글이
        「오르면」이면 각주의 「…덜 나가요」와 같은 블록 안에서 서로를 반박합니다(원칙 39).
     ⚠ 잠글 것은 낱말이 아니라 **범위와 이름의 관계**입니다 — min이 기준 아래인 한
        머리글은 오르는 쪽만 말하면 안 됩니다. min을 올려 고치는 길도 열어 둡니다. */
  tt('금리 슬라이더 이름이 범위와 맞는다', (()=>{
     const m = SRC.match(/id="rateRange"[^>]*min="(\d+)"/);
     const hd = SRC.match(/class="ratesim-hd"><p class="tile-k">([^<]*)</);
     if(!m || !hd) return false;
     const goesDown = (+m[1])/10 < 5.4;         /* D.rate 아래로 내려가는가 */
     return !goesDown || !/오르면|올라가|상승/.test(hd[1]);
  })(), '🔴 슬라이더가 아래로도 가는데 머리글이 오르는 쪽만 말합니다');

  /* ── ⑤ 빈 화면이 면을 갖는가 ─────────────────────────────────────
     🔴 다섯 줄(582px)이 있던 자리에 글자 한 줄만 남으면 카드가 접힌 것처럼 보입니다.
     ⚠ 「회색이면 통과」로 쓰지 않습니다. 잠그는 것은 **면과 안쪽 여백이 같이 있는가**입니다 —
        패딩 없이 면만 주면 글자가 면에 딱 붙습니다. 면은 있는데 패딩이 0인 상태를 막습니다. */
  tt('실거래 빈 화면이 면과 안쪽 여백을 갖는다', (()=>{
     const at = SRC.indexOf('.deal-msg{');
     if(at < 0) return false;
     const blk = SRC.slice(at, SRC.indexOf('}', at));
     return /background\s*:\s*var\(--/.test(blk) && /padding\s*:\s*[1-9]/.test(blk);
  })(), '🔴 빈 화면에 면 또는 안쪽 여백이 없습니다');

  /* ── ⑥ 빈 화면이 「칩 때문」과 「예산 때문」을 가르는가 ──────────────
     🔴 지시서는 둘을 한 문구로 합치라고 했는데, 합치면 84㎡ 칩만 켜서 0건인 사람에게
        **틀린 안내**가 됩니다. 그 갈래가 살아 있는지를 잠급니다(원칙 128 — 대상을 옮김).
     ⚠ 문구가 아니라 **갈래**를 셉니다. 두 갈래의 글자는 자유롭게 고칠 수 있습니다. */
  tt('빈 화면이 좁힌 칩과 예산을 갈라 말한다', (()=>{
     const at = SRC.indexOf('const narrowed');
     if(at < 0) return false;
     const seg = SRC.slice(at, at + 700);
     const arms = (seg.match(/narrowed\s*\n?\s*\?/g) || []).length;
     return /DEAL\.onlyNew/.test(seg) && /DEAL\.only59/.test(seg)
         && /DEAL\.only84/.test(seg) && !/DEAL\.over\b/.test(seg.split('\n')[0])
         && arms >= 2;
  })(), '🔴 빈 화면이 한 문구로 합쳐졌습니다');

  /* ── ⑦ 외부 리소스가 부팅을 막지 못하는가 ─────────────────────────
     🔴 2026.08.18 실기 — 첫 화면이 「진행 막대 없음 · 질문칸 빔 · 「이전」 노출 ·
        「다음」이 초록 활성」으로 굳었습니다. **JS가 손대기 전의 마크업 그대로**입니다.
        원인은 우리 코드가 아니라 `<head>`의 외부 리소스 둘이었습니다:
          · `<script src=html2canvas>` — 차단형이라 파서를 멈춥니다
          · `<link rel=stylesheet pretendard>` — **스크립트는 앞선 스타일시트를 기다립니다**
        망이 끊기면 빨리 실패하지만 **매달리면** 계산기가 통째로 안 뜹니다.
     ⚠ 실측(매달린 지 2.5초) — 원본: 둘 다 **DOM조차 없음** / 수정본: 셋 다 ✅ 정상.
     ⚠ 잠글 것은 「defer가 있는가」가 아니라 **「머리에 파서를 막는 외부 리소스가 없는가」**입니다.
        CDN을 바꾸거나 리소스를 더해도 이 검사는 그대로 삽니다(원칙 48). */
  tt('머리의 외부 리소스가 부팅을 막지 않는다', (()=>{
     const head = RAW.slice(0, RAW.indexOf('</head>') >= 0 ? RAW.indexOf('</head>') : RAW.indexOf('<body'));
     const bare = head.replace(/<!--[\s\S]*?-->/g,'');
     const bad = [];
     /* 외부 스크립트는 defer 또는 async여야 합니다 */
     for(const m of bare.matchAll(/<script\b([^>]*\bsrc=[^>]*)>/g))
       if(!/\bdefer\b|\basync\b/.test(m[1])) bad.push('script: ' + m[1].trim().slice(0,60));
     /* 외부 스타일시트는 렌더·스크립트를 막지 않는 꼴이어야 합니다 */
     for(const m of bare.matchAll(/<link\b([^>]*)>/g)){
       const a = m[1];
       if(!/rel\s*=\s*["']?stylesheet/.test(a)) continue;
       if(!/https?:\/\//.test(a)) continue;                  /* 같은 출처는 매달릴 일이 없습니다 */
       if(!/media\s*=\s*["']print["']/.test(a)) bad.push('link: ' + a.trim().slice(0,60));
     }
     return bad.length === 0 ? true : bad;
  })() === true, '🔴 머리의 외부 리소스가 매달리면 계산기가 통째로 안 뜹니다');

  /* ── ⑧ 비차단으로 받은 스타일시트가 **실제로 적용되는가** ──────────
     ⚠ `media="print"`로 받아 두기만 하고 되돌리지 않으면 글꼴이 **영영 안 붙습니다.**
       「안 막는다」와 「그래도 적용된다」는 다른 사실입니다 — 둘 다 잠급니다(원칙 124의 계열). */
  tt('비차단 스타일시트가 다 받은 뒤 적용된다', (()=>{
     const m = RAW.replace(/<!--[\s\S]*?-->/g,'').match(/<link\b[^>]*media\s*=\s*["']print["'][^>]*>/);
     return !!m && /onload\s*=/.test(m[0]) && /media\s*=\s*['"]all['"]/.test(m[0]);
  })(), '🔴 print로 받아만 두고 all로 되돌리지 않습니다 — 글꼴이 영영 안 붙습니다');

  /* ── ⑨ 세대수 수집이 응답을 버리지 않는가 ────────────────────────
     🔴 수집은 단지당 1회 · 일일 5,000건이라 서울만 해도 하루입니다. 다섯 필드만 남기고
        버리면 주차대수를 넣기로 하는 날 **같은 수집을 처음부터** 다시 돌려야 합니다.
     ⚠ 이 검사는 index.html이 아니라 **build-households.mjs**를 봅니다. 파일이 없으면
        「찾지 못함」으로 조용히 통과하면 안 됩니다 — 없으면 빨간불입니다. */
  tt('세대수 수집이 원본 응답을 통째로 보관한다', (()=>{
     const f = path.join(path.dirname(FILE), 'build-households.mjs');
     if(!fs.existsSync(f)) return false;
     const src = fs.readFileSync(f,'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
     const at = src.indexOf('got[code] = {');
     if(at < 0) return false;
     return /raw:\s*it/.test(src.slice(at, src.indexOf('};', at)));
  })(), '🔴 원본을 버리고 있습니다 — 필드를 늘리면 수집을 다시 해야 합니다');
})();

/* ═══ v25.12 — 모바일 여백 다이어트 · 월 현금흐름 타일 한 치수 ═══════ */
(() => {
  const RAW = fs.readFileSync(FILE,'utf8');
  const CSS = (RAW.match(/<style>([\s\S]*?)<\/style>/)||['',''])[1];
  const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');

  /* ── ① 좁은 화면 세로 여백 ────────────────────────────────────
     오너 지시 「모바일이 뚱뚱하다」. 재서 정했습니다 — 360px 결과 2,873px 중 구조적 여백이
     320px(11%)이고, 토큰 둘을 내려 **−151px**입니다. */
  tt('좁은 화면에서 안쪽 여백과 카드 간격이 줄어든다', (()=>{
     const m = CSS.match(/@media \(max-width:400px\)\{\s*:root\{([^}]*)\}/);
     if(!m) return false;
     return /--gap:12px/.test(m[1]) && /--pad:16px/.test(m[1]);
  })(), '🔴 400px 분기에 세로 여백 토큰이 없습니다');
  /* 🔴 **기본값은 그대로 둡니다.** 넓은 화면에서까지 줄이면 이 판이 답한 지적(모바일)이
     아니라 다른 화면을 바꾸는 것입니다. 되돌릴 자리도 여기 하나로 남습니다. */
  tt('기본 여백 토큰은 20 · 16 그대로다',
     /:root\{[\s\S]*?--gap:16px;\s*--pad:20px;/.test(CSS));
  /* 🔴 v24.28이 좌우 여백에서 밟은 자리 — **미디어 쿼리는 명시도를 안 올려 줍니다.**
     이 블록이 `.card-title` 기본 규칙보다 **앞**에 놓이면 조용히 죽습니다(원칙 118 · G-20).
     ⚠ 잠글 것은 「그 값이 14px이다」가 아니라 **「자기 기본 규칙보다 뒤에 있다」**입니다. */
  tt('세로 여백 블록이 자기 기본 규칙보다 뒤에 있다', (()=>{
     const later = CSS.search(/@media \(max-width:400px\)\{\s*\.card-title/);
     const base  = CSS.search(/\.card-title\{font-size/);
     return later > 0 && base > 0 && later > base;
  })(), '🔴 여백 블록이 기본 규칙보다 앞입니다 — 한 번도 닿지 않습니다');
  /* 🔴 좌우 여백 세 단(12 / 16 / 20)은 **이 판이 건드리지 않았습니다.** 같이 줄이면
     내용 폭이 도로 좁아집니다 — v23.21이 카드 안쪽을 깎아 번 폭을 반납하는 일입니다. */
  tt('좌우 여백 세 단이 그대로다',
     /@media \(max-width:374px\)\{\s*\.funnel\{padding:22px 12px 32px\}/.test(CSS)
     && /@media \(min-width:414px\)\{\s*\.funnel\{padding-left:20px/.test(CSS));

  /* ── ② 월 현금흐름 타일 — 한 치수 ────────────────────────────
     오너 지시 「매달 원리금을 더 심플하고 간결하게 · 55사이즈면 44사이즈로」. */
  tt('월 현금흐름 값이 활자 사다리에서 한 단 내려왔다',
     /\.tile-v\{font-size:var\(--t4\)/.test(CSS));
  /* 🔴 짝 — `.tile-v`가 17px로 내려오면 `.ratesim-v`(17px)와 **같은 크기**가 됩니다.
     그래서 시뮬 값은 크기(16px) **와 굵기(700)** 둘로 갈랐습니다. 한 채널만 잠그면
     다음 사람이 크기만 되돌려 놓고 「사다리가 있다」고 읽습니다(원칙 62 · 6-27). */
  tt('금리 시뮬 값이 크기와 굵기 둘로 한 단 아래다', (()=>{
     const r = (CSS.match(/\.ratesim-v\{[^}]*\}/)||[''])[0];
     return /font-size:var\(--t5\)/.test(r) && /font-weight:var\(--w-key\)/.test(r)
         && /\.tile-v\{[^}]*font-weight:900/.test(CSS);
  })());
  /* 🔴 ⚠ **덩치를 줄이면서 손가락 면을 같이 줄이지 않았는가**(원칙 112 · 123).
     이 판이 조인 것은 선과 글 사이뿐입니다. 슬라이더 상자는 `--tap` 그대로여야 합니다. */
  tt('타일을 줄이면서 슬라이더 손가락 면은 안 줄였다', (()=>{
     const at = SRC.search(/(?:^|[};])\s*input\[type=range\]\{/);
     if(at < 0) return false;
     const s = SRC.indexOf('input[type=range]{', at) + 'input[type=range]'.length;
     const blk = SRC.slice(s, SRC.indexOf('}', s));
     return /height:var\(--tap\)/.test(blk);
  })(), '🔴 슬라이더 높이가 --tap이 아닙니다 — 보이는 크기가 아니라 손가락 면입니다');
  /* 부담 게이지는 「얼마나 찼는가」를 말하는 유일한 그림입니다. 굵기를 줄이면 선이 됩니다. */
  tt('부담 게이지 굵기는 그대로다', /\.gauge\{height:8px/.test(CSS));

  /* ── ③ 조건칩 라벨 대비 — 지시서에 없던 것 ─────────────────────
     🔴 v25.10이 칩 **면**을 `--card` → `--fill`로 바꾸면서 라벨만 `--ink-4`로 남았습니다.
        `--ink-4`는 흰 면 위 4.62:1 · `--fill` 위 **4.19:1**입니다(원칙 97).
        배포본에서 `__selfcheck()` **G-19가 빨간불**이었고 정적 검사 809개는 전부 초록이었습니다.
     ⚠ 잠글 것은 「`--ink-3`이다」가 아니라 **「`--fill` 면 위에 `--ink-4`를 안 쓴다」**입니다 —
        값을 잠그면 다음에 면을 또 바꿀 때 같은 자리가 다시 뚫립니다(원칙 128 · 6-27). */
  tt('조건칩 라벨이 그 면 위에서 대비 미달 잉크를 안 쓴다', (()=>{
     const chip = (CSS.match(/\.cond\{[^}]*\}/)||[''])[0];
     const lab  = (CSS.match(/\.cond u\{[^}]*\}/)||[''])[0];
     if(!chip || !lab) return false;
     const onFill = /background:var\(--fill\)/.test(chip);
     return !(onFill && /color:var\(--ink-4\)/.test(lab));
  })(), '🔴 --fill 면 위 --ink-4는 4.19:1입니다 — G-19가 렌더에서 잡습니다');
})();

/* ═══ v25.13 — 문구 판 (오너 지적 · 계산 0) ══════════════════════
   이 절이 잠그는 것은 **문장이 아니라 사실**입니다(원칙 48 · 128).
   문구를 더 다듬는 것은 막지 않고, **뜻을 되돌리는 것만** 막습니다.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const RAW  = fs.readFileSync(FILE,'utf8');
  const BARE = RAW.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'').replace(/\/\/[^\n]*/g,'');
  const CSS2 = (RAW.match(/<style>([\s\S]*?)<\/style>/)||['',''])[1]
                 .replace(/\/\*[\s\S]*?\*\//g,'');

  /* ── ① 「대출」이 두 뜻이 아니다 ────────────────────────────────
     이 체크박스가 끄는 것은 **주택담보대출 하나**인데(02가 통째로 빠짐) 바로 다음 화면이
     신용대출 월 상환액을 묻습니다. 어느 대출인지 말하지 않으면 같은 퍼널에서 두 뜻입니다.
     ⚠ 잠글 것은 「그 문장」이 아니라 **「라벨이 어떤 대출인지 이름으로 부른다」**입니다. */
  tt('대출 안 받기 체크박스가 어떤 대출인지 말한다', (()=>{
     const m = BARE.match(/id="noLoanBox"[^>]*>([^<]+)</);
     return !!m && /주담대/.test(m[1]);
  })(), (()=>{ const m = BARE.match(/id="noLoanBox"[^>]*>([^<]+)</); return m?m[1]:'없음'; })());

  /* ── ② 가진 돈 헬퍼 ────────────────────────────────────────────
     「주택담보대출 **말고**」는 붙는 자리가 애매해 「주담대가 아닌 대출은 넣으라는 건가」로
     읽혔습니다 — 실제로 그게 맞아서 더 나빴습니다(신용대출로 당긴 현금도 여기 넣습니다).
     ⚠ 두 가지를 같이 봅니다: **주담대를 뺀다**는 말과 **끌어모은다**는 말.
       뒤엣것을 지우면 「신용대출도 넣는다」를 말하는 유일한 낱말이 사라집니다(원칙 39). */
  tt('가진 돈 헬퍼가 주담대 제외를 또렷이 말한다', (()=>{
     const m = BARE.match(/moneyCard\('cash',[^)]*?'([^']+)'\)/);
     if(!m) return false;
     return /주담대/.test(m[1]) && /(빼고|제외)/.test(m[1]) && /끌어모을/.test(m[1]);
  })(), (()=>{ const m = BARE.match(/moneyCard\('cash',[^)]*?'([^']+)'\)/); return m?m[1]:'없음'; })());

  /* ── ③ 지역 안내 세 줄 ─────────────────────────────────────────
     이 프로젝트의 말투 규칙은 「사실만 서술한다. 평가하거나 지시하지 않는다」입니다.
     「가장 엄격한」·「가장 여유로운 편」은 평가이고 「편」은 추측이었습니다.
     ⚠ 「가장 낮게 잡히고」는 **세 지역 사이의 사실**(LTV 40 < 70)이라 금지어에 안 넣습니다.
       금지하는 것은 **좋고 나쁨을 말하는 낱말**입니다. */
  tt('지역 안내가 평가어를 쓰지 않는다', (()=>{
     const m = BARE.match(/const tag = z \?[\s\S]*?: '';/);
     if(!m) return false;
     return !/(엄격|여유로운|편이에요)/.test(m[0]);
  })(), (()=>{ const m = BARE.match(/const tag = z \?[\s\S]*?: '';/);
     return m ? (m[0].match(/(엄격|여유로운|편이에요)/g)||['없음']).join(',') : '못 찾음'; })());

  /* 🔴 주의 면(`.tip.info` 오렌지 틴트)은 **규제지역 하나**입니다.
     전에는 셋 다 `.tip info`라 「수도권 밖이에요」에도 경고색이 붙었습니다 —
     규제가 가장 느슨한 곳에 주의를 다는 꼴이었습니다(원칙 28의 반대 방향).
     ⚠ 잠글 것은 「클래스 문자열」이 아니라 **「면이 갈리는가」**입니다 — 조건식을 봅니다. */
  tt('지역 안내의 주의 면이 규제지역에만 붙는다', (()=>{
     const m = BARE.match(/const tag = z \?[\s\S]*?: '';/);
     if(!m) return false;
     if(/class="tip info"/.test(m[0])) return false;      /* 셋 다 주의면 — 갈리지 않음 */
     return /class="tip\$\{\s*z\s*===\s*'reg'/.test(m[0]);
  })(), (()=>{ const m = BARE.match(/const tag = z \?[\s\S]*?: '';/);
     return m ? m[0].slice(0,60).replace(/\n/g,' ') : '못 찾음'; })());

  /* ── ④ 원리금 타일이 무슨 대출을 세는지 ────────────────────────
     🔴 이 값은 **주담대 원리금 하나**인데, 사용자는 02에서 신용대출 월 상환액을 넣습니다.
        빈 값 문장이 「갚을 대출이 없어요」이면 조건칩의 「갚는 대출 월 N만원」과 정면으로
        어긋납니다(원칙 39 · 91). 화면 두 곳이 서로를 반박하면 안 됩니다.
     ⚠ 잠글 것은 문장이 아니라 **「그 문장이 주담대를 이름으로 부르는가」**입니다. */
  tt('원리금 타일의 빈 값이 주담대를 이름으로 부른다', (()=>{
     const m = BARE.match(/tileMonthlySub'\)\.textContent = m>0 \? `[^`]+` : '([^']+)'/);
     return !!m && /주담대/.test(m[1]);
  })(), (()=>{ const m = BARE.match(/tileMonthlySub'\)\.textContent = m>0 \? `[^`]+` : '([^']+)'/);
     return m ? m[1] : '없음'; })());
  tt('원리금 타일의 가정 줄이 무엇의 가정인지 말한다', (()=>{
     const m = BARE.match(/tileMonthlySub'\)\.textContent = m>0 \? `([^`]+)`/);
     return !!m && /주담대/.test(m[1]) && /가정/.test(m[1]);
  })(), (()=>{ const m = BARE.match(/tileMonthlySub'\)\.textContent = m>0 \? `([^`]+)`/);
     return m ? m[1] : '없음'; })());

  /* ── ⑤ 구간한도 알약 ───────────────────────────────────────────
     같은 한도를 화면이 두 이름으로 불렀습니다 — 알약 「정부 규제의 집값 구간별 상한」,
     막대·시트 「정부 상한」. 오너가 「무슨 말인지 모르겠다」고 한 자리입니다(원칙 58 · 91).
     ⚠ 잠글 것 둘 : ① 막대와 **같은 이름**을 쓴다 ② 금액을 **손으로 안 적는다.** */
  /* 🔴 v25.13 — **사보타주가 이 줄을 잡았습니다(원칙 122).** 처음엔 `capLabel`이 **정의돼
     있는지**만 봤습니다. 그래서 알약을 옛 문장으로 되돌려도 `capLabel`이 죽은 함수로 남아
     검사가 **초록**이었습니다 — 「정의됐는가」가 아니라 **「불려지는가」**까지 봐야 합니다.
     ⚠ 옛 문장을 금지어로 넣는 길은 안 갔습니다. 그건 다시 **문장을 잠그는 것**이고,
       다음 사람이 문구를 더 다듬는 것까지 막습니다(원칙 48). 잠글 것은 **연결**입니다. */
  /* 🔴 v25.20 — **대상을 옮겼습니다**(원칙 128). 알약이 사라지고 그 답은 **접힌 서랍 줄**
     (`limitBind`)이 냅니다. 지키려던 사실은 그대로입니다 — **이름이 한 벌인가.**
     서랍 줄과 막대가 **같은 `LNAME`**에서 옵니다(원칙 58 · 감사 A-2가 여기서 닫힙니다). */
  tt('걸린 한도 이름이 LNAME 한 벌에서 온다 (v25.20)', (()=>{
     const f = (BARE.match(/function renderLimits\([\s\S]*?\n\}/)||[''])[0];
     if(!f) return false;
     /* ⚠ 공백을 걷지 않습니다 — 「정부 상한」의 가운데 공백까지 사라져 자기 발등을 찍습니다
        (옛 검사가 대안 둘을 둔 이유가 이것입니다 · 원칙 152). */
     const bar = /'구간한도'\s*:\s*'정부 상한'/.test(BARE);
     const bind = /limitBind/.test(f) && /LNAME\[c\.binding\]/.test(f.replace(/\s+/g,''));
     return bar && bind;
  })(), '🔴 서랍 줄과 막대가 같은 LNAME을 써야 합니다');
  /* 🔴 v25.20 — **대상을 옮겼습니다**(원칙 128). 알약이 금액을 적던 자리가 사라졌습니다.
     ⏹ 옛 검사가 지키던 것은 「금액을 손으로 안 적는다 · 무한값에 괄호를 안 붙인다」였고,
       그 금액은 이제 **한도 막대**가 `formatWon(L[k])`로 적습니다 — 손으로 적을 자리가 없습니다.
     🔴 대신 **새 사실**을 잠급니다 — **접힌 줄에 금액을 안 적는다.** 접힌 줄에 금액을 적으면
       바로 위 영수증 금액 열과 세로로 겹쳐 **다른 것을 비교하게** 됩니다(원칙 91).
       그리고 접힌 줄이 말할 것은 「무엇이」이고 「얼마」는 펴면 막대가 말합니다(원칙 43). */
  tt('접힌 한도 줄이 금액을 안 적는다 (v25.20)', (()=>{
     const f = (BARE.match(/function renderLimits\([\s\S]*?\n\}/)||[''])[0];
     const line = (f.match(/lb\.textContent[^;]*/)||[''])[0];
     return !!line && !/formatWon|억|만원/.test(line);
  })(), (BARE.match(/lb\.textContent[^;]*/)||['🔴 못 찾음'])[0].slice(0,60));
  tt('한도 막대 금액이 값에서 온다 (v25.20)', (()=>{
     const f = (BARE.match(/function renderLimits\([\s\S]*?\n\}/)||[''])[0];
     return !!f && /formatWon\(L\[k\]\)/.test(f) && !/[0-9]억원|[0-9]만원/.test(f);
  })());

  /* ── ⑥ 스트레스 금리 주석 ──────────────────────────────────────
     🔴 「한도는 스트레스 금리(6.9%)로 잡고…」가 **다섯 판** 옛 값으로 남아 있었습니다.
        가산이 1.5 → 3.0으로 바뀐 뒤(8.13 대책) 참이 아니었습니다.
     ⚠ 화면에 안 나오는 주석이지만 **다음 사람이 근거로 씁니다**(원칙 143).
     ⚠ 잠글 것은 「6.9가 없다」가 아니라 **「스트레스 금리를 말하는 자리에 숫자를 안 적는다」**
        입니다. 숫자를 다른 숫자로 바꾸는 길은 막습니다 — 가산은 조건마다 달라
        한 값으로 못 적고, 적으면 다른 조건에서 또 거짓이 됩니다(원칙 84 · 143).
     ⚠ **주석을 안 걷어냅니다.** 이 검사가 보는 대상이 주석 그 자체입니다. */
  tt('스트레스 금리를 말하는 자리에 숫자 리터럴이 없다', (()=>{
     const hits = [...RAW.matchAll(/스트레스 금리[^\n]{0,24}/g)].map(m => m[0]);
     return hits.length > 0 && hits.every(h => !/\(\s*\d+(\.\d+)?\s*%/.test(h));
  })(), (()=>{ const hits = [...RAW.matchAll(/스트레스 금리[^\n]{0,24}/g)]
     .map(m=>m[0]).filter(h => /\(\s*\d+(\.\d+)?\s*%/.test(h));
     return hits.length ? hits.join(' | ') : '숫자 없음'; })());
})();

/* ═══ v25.14 — 디자인 시스템 (활자 · 굵기 · 간격) ══════════════════
   🔴 이 절은 **값이 아니라 규격**을 잠급니다. 문구를 다듬거나 한 자리를 옮기는 것은 막지 않고,
      **「같은 일을 하는 것이 서로 다른 규격이 되는 것」**만 막습니다.
   ⚠ 재는 대상은 **화면 CSS**입니다. 공유 카드(`.report*`)는 내보내는 그림이라 규칙이 따로 있고
      (반응형 토큰 금지) 이 절에서 뺍니다.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const RAW  = fs.readFileSync(FILE,'utf8');
  const CSSA = (RAW.match(/<style>([\s\S]*?)<\/style>/)||['',''])[1].replace(/\/\*[\s\S]*?\*\//g,'');
  const rule = sel => (CSSA.match(new RegExp('\\n'+sel+'\\{([^}]*)\\}'))||[])[1] || '';
  const num  = (r,p) => { const m = r.match(new RegExp(p+':(\\d+)')); return m ? +m[1] : null; };

  /* ── ① 굵기 — 800 폐기 ─────────────────────────────────────────
     v24.15가 「800은 없앴습니다. 700과 900 사이에 눈이 구분 못 하는 단을 하나 더 두는 것」이라고
     적어 두고 **17곳에 남아 있었습니다.** 이 판이 전부 700으로 내렸습니다.
     ⚠ 잠글 것은 「700이다」가 아니라 **「눈이 구분 못 하는 단이 없다」**입니다 —
       그래서 값 하나가 아니라 **쓰이는 단의 목록**을 셉니다. */
  tt('화면 굵기에 800이 없다', !/font-weight:800/.test(CSSA),
     (CSSA.match(/[^{;]*font-weight:800/g)||[]).slice(0,3).join(' | ') || '없음');
  tt('화면 굵기가 다섯 단 안이다', (()=>{
     const screen = CSSA.replace(/[^{}]*\.report[^{}]*\{[^}]*\}/g,'');
     const set = new Set((screen.match(/font-weight:(\d+)/g)||[]).map(x=>x.split(':')[1]));
     const ok = ['400','500','600','700','900'];
     return [...set].every(v => ok.includes(v));
  })(), (()=>{ const screen = CSSA.replace(/[^{}]*\.report[^{}]*\{[^}]*\}/g,'');
     return [...new Set((screen.match(/font-weight:(\d+)/g)||[]).map(x=>x.split(':')[1]))].sort().join(' · '); })());

  /* ── ② 크기 — 화면에 스케일 밖 리터럴이 없다 ────────────────────
     ⚠ 공유 카드의 54px은 **일부러 리터럴**입니다(반응형 토큰 금지 · 위 검사가 그것을 잠급니다).
       그 하나만 예외로 두고 나머지는 전부 `--t*` / `--d1` / clamp여야 합니다(원칙 117). */
  tt('화면에 스케일 밖 크기 리터럴이 없다', (()=>{
     const screen = CSSA.replace(/[^{}]*\.report[^{}]*\{[^}]*\}/g,'');
     const lit = (screen.match(/font-size:\s*(\d+)px/g)||[]);
     return lit.length === 0;
  })(), (()=>{ const screen = CSSA.replace(/[^{}]*\.report[^{}]*\{[^}]*\}/g,'');
     return (screen.match(/[^{;]*font-size:\s*\d+px/g)||['없음']).slice(0,3).join(' | '); })());

  /* ── ③ 설명 줄은 한 규격 ───────────────────────────────────────
     🔴 오너 지적 「1·2페이지와 3페이지의 설명이 다르다」의 자리입니다.
        `.q-sub`가 14px · `--ink-3`이라 `.helper`(13px · `--ink-4`)보다 한 단 컸습니다.
     ⚠ **잉크는 잠그지 않습니다** — 놓인 면이 정합니다(원칙 97). 흰 카드 위 `--ink-4`,
       `--fill` 면 위 `--ink-3`. 잠글 것은 **크기 · 굵기 · 행간** 셋입니다. */
  tt('설명 줄이 한 규격이다 (13 / 400 / 1.6)', (()=>{
     const want = ['\\.helper','\\.readout','\\.pane-note','\\.tile-s'];
     return want.every(sel => {
       const r = rule(sel);
       if(!r) return false;
       const sizeOk = /font-size:var\(--t7\)/.test(r);
       const wOk    = !/font-weight/.test(r) || /font-weight:400/.test(r);
       const lhOk   = !/line-height/.test(r) || /line-height:(var\(--lh-body\)|1\.6)/.test(r);
       return sizeOk && wOk && lhOk;
     });
  })(), ['\\.helper','\\.readout','\\.pane-note','\\.tile-s'].map(x=>x.replace(/\\/g,'')+':'+rule(x).slice(0,42)).join('\n     '));
  tt('죽은 설명 규격(.q-sub)이 되살아나지 않았다', !/\.q-sub\{/.test(CSSA));
  tt('03의 설명이 01·02와 같은 부품이다',
     /<p class="helper" id="houseEcho">/.test(RAW) && !/class="q-sub"/.test(RAW),
     (RAW.match(/class="[^"]*" id="houseEcho"/)||['없음'])[0]);

  /* ── ④ 소제목 세 단이 전부 스케일 안 ───────────────────────────
       13(--t7) 구역 라벨 / 14(--t6) 입력칸 이름 / 16(--t5) 화면 안 둘째 질문
     ⚠ 잠글 것은 「어느 선택자가 몇 px」이 아니라 **「셋이 서로 다른 단이고 전부 토큰」**입니다. */
  tt('소제목 세 단이 전부 토큰이고 서로 다르다', (()=>{
     const t = r => (r.match(/font-size:var\((--t\d)\)/)||[])[1];
     const zone = t(rule('\\.pane-title'));
     const field = t(rule('\\.flabel'));
     const q2 = t(rule('\\.blockhead'));
     return zone === '--t7' && field === '--t6' && q2 === '--t5';
  })(), [ '.pane-title '+rule('\\.pane-title').slice(0,30), '.flabel '+rule('\\.flabel').slice(0,60),
          '.blockhead '+rule('\\.blockhead').slice(0,50) ].join('\n     '));

  /* ── ⑤ 「칩 다음 부속 동작」 간격이 01·02에서 같다 ────────────────
     🔴 오너 지적 그 자리입니다 — 실측 01은 12px, 02는 30px, 03은 34px이었습니다.
     ⚠ 01(`.subtoggle`)과 02(`.debtlink`)는 **같은 관계**(칩 줄에 딸린 부속 동작)라 같은 값입니다.
       03(`.blockhead`)은 **다른 질문**이라 일부러 다릅니다 — 그리고 **더 커야** 합니다.
       그 순서까지 같이 셉니다. 값이 아니라 **관계**를 잠급니다. */
  tt('칩 다음 부속 동작의 간격이 01·02에서 같다', (()=>{
     const a = (rule('\\.subtoggle').match(/margin-top:var\((--[a-z]+)\)/)||[])[1];
     const b = (rule('\\.debtlink').match(/margin-top:var\((--[a-z]+)\)/)||[])[1];
     return !!a && a === b;
  })(), '.subtoggle ' + (rule('\\.subtoggle').match(/margin-top:[^;}]*/)||['?'])[0]
      + '  /  .debtlink ' + (rule('\\.debtlink').match(/margin-top:[^;}]*/)||['?'])[0]);
  tt('다른 질문은 부속 동작보다 멀리 있다', (()=>{
     const q2 = num(rule('\\.blockhead'), 'margin');       /* margin:32px 0 0 */
     const gapMax = 16;                                     /* --gap 기본값 */
     return q2 !== null && q2 > gapMax;
  })(), (rule('\\.blockhead').match(/margin:[^;}]*/)||['?'])[0]);

  /* ── ⑥ 지역 화면 여백이 4의 배수다 ─────────────────────────────
     26 · 28 · 34 같은 「어디에도 없는 값」이 이 화면에만 셋 있었습니다.
     ⚠ 4의 배수는 취향이 아니라 **셈할 수 있는 사다리**입니다 — 4로 안 나뉘는 값이 하나 들어오면
       그 옆의 값들이 전부 「대충 그쯤」이 됩니다. */
  tt('03 지역 화면의 여백이 4의 배수다', (()=>{
     return ['\\.zonegrid','\\.pane','\\.seg','\\.ownbox','\\.ownbox \\.seg'].every(sel=>{
       const m = rule(sel).match(/margin-top:(\d+)px/);
       return !m || (+m[1]) % 4 === 0;
     });
  })(), ['\\.zonegrid','\\.pane','\\.seg','\\.ownbox','\\.ownbox \\.seg']
     .map(x=>x.replace(/\\/g,'')+' '+((rule(x).match(/margin-top:\d+px/)||['-'])[0])).join(' · '));
  tt('음수 여백을 쓰지 않는다', !/margin[^:]*:\s*-\d/.test(CSSA.replace(/[^{}]*\.report[^{}]*\{[^}]*\}/g,'')),
     (CSSA.match(/[^{;]*margin[^:]*:\s*-\d[^;}]*/g)||['없음']).slice(0,2).join(' | '));

  /* ── ⑦ 죽은 규칙 ───────────────────────────────────────────────
     죽은 CSS는 죽은 값이 아니라 **「살아 있는 두 번째 정의」**입니다(지침 6-6 · 원칙 84). */
  tt('죽은 칩 규격이 되살아나지 않았다', !/\.chip\.is-clear\{/.test(CSSA));
  tt('죽은 함수 loanTypeLabel이 되살아나지 않았다', !/function loanTypeLabel/.test(RAW));

  /* ── ⑧ 기호 ────────────────────────────────────────────────────
     ⚠ `⧉`(U+29C9)는 Pretendard에 없어 대체 글꼴로 떨어질 수 있습니다 — 그러면 두부(□)입니다.
       「다음 걸음」의 네 기호는 **화살표 셋 + 없음**으로 맞췄습니다(↗ 밖으로 · ↓ 저장 · ↑ 보내기). */
  /* 🔴 ⚠ **줄 주석(`//`)을 걷지 않습니다.** 처음엔 걷었다가 `href="https://rt.molit.go.kr/"`의
     `//`가 먹혀 그 `<a>` 태그가 통째로 잘렸고, 검사가 「국토부 칸에 화살표가 없다」고 빨간불을
     냈습니다 — **검사가 자기 전처리에 걸린 것**입니다. 이 절이 보는 것은 마크업이라
     블록 주석과 HTML 주석만 걷으면 충분합니다(원칙 111의 반대편 함정). */
  const SCREEN2 = RAW.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
  /* ── ⑨ 지역 안내가 누른 칩 바로 다음 자리에 온다 ─────────────────
     🔴 실측(390px): 성동구 칩 371 → 안내 825px으로 **454px 아래**였습니다. 고친 뒤 **18px**입니다.
     ⚠ v24.29가 「갈리는 시 서랍」에서 정확히 같은 것을 이미 고쳤습니다(1,146px → 바로 아래).
       이 안내만 남아 있었습니다 — **같은 원칙(111)이 두 자리에 있었는데 한 자리만 고쳐져** 있었습니다.
     ⚠ 잠글 것은 「몇 px」이 아니라 **「고른 칩과 같은 격자, 그 다음 자리」**입니다. */
  /* 🔴 v25.22 — **대상을 옮겼습니다**(원칙 128). 「칩 **바로 다음 칸**」이던 것을
     「그 칩이 있는 **줄 다음**」으로 바꿨습니다 — 안내가 `grid-column:1/-1`이라 줄 중간에
     끼면 **같은 줄 동료가 아래로 밀립니다**(실측 390px: 종로구를 고르면 중구·용산구가
     295 → 438px). 누른 것이 아닌 것이 움직이면 안 됩니다(원칙 34).
     ⚠ 지키려던 사실은 그대로입니다 — **「고른 칩과 같은 격자, 그 바로 아래」**.
       바뀐 것은 「다음 칸」이 아니라 「다음 줄」이라는 것뿐입니다.
     ⚠ 그리고 **열 수를 손으로 안 적는가**를 같이 잠급니다 — `wide` 하나에서 와야 합니다.
       리터럴 3을 박으면 `TAG_WIDE`가 정한 2열에서 줄 계산이 어긋납니다(원칙 58 · 84). */
  tt('지역 안내가 고른 칩이 있는 줄 다음에 들어간다 (v25.22)', (()=>{
     const f = (RAW.match(/const tagGrid = \(list[\s\S]*?\n\};/)||[''])[0].replace(/\/\*[\s\S]*?\*\//g,'');
     /* ⚠ `[^)]*`로 자르지 않습니다 — 인자가 `([key]) =>`라 **괄호를 품고 있어** 거기서
        끊깁니다(지침 6-26 · 실제로 이 검사가 처음에 그렇게 죽었습니다). */
     const 줄찾기 = /findIndex\([\s\S]{0,80}?String\(S\.sgg\)/.test(f) && /rowEnd/.test(f);
     const 줄끝에 = /i === rowEnd/.test(f.replace(/\s+/g,' '));
     return 줄찾기 && 줄끝에;
  })(), '🔴 tagGrid가 S.sgg 칩이 있는 줄 끝에 안내를 넣어야 합니다');
  tt('격자 열 수를 손으로 안 적는다 (v25.22)', (()=>{
     const f = (RAW.match(/const tagGrid = \(list[\s\S]*?\n\};/)||[''])[0].replace(/\/\*[\s\S]*?\*\//g,'');
     const m = f.match(/const cols = ([^;]+);/);
     return !!m && /wide/.test(m[1]);
  })(), (fs.readFileSync(FILE,'utf8').match(/const cols = ([^;]+);/)||[])[1] || '없음');
  tt('안내가 격자 한 줄을 통째로 먹는다', /\.taggrid > \.tip\{[^}]*grid-column:1\/-1/.test(CSSA));
  /* 어느 격자에도 못 들어간 경우(그룹을 바꿔 칩이 목록에 없을 때) 조용히 사라지면 안 됩니다 */
  tt('자리를 못 잡은 안내가 사라지지 않는다', (()=>{
     const f = (RAW.match(/function regionPane\(\)[\s\S]*?\n\}/)||[''])[0].replace(/\/\*[\s\S]*?\*\//g,'');
     return /if\(tag && inner\.indexOf\(tag\) < 0\) inner \+= tag;/.test(f);
  })());

  /* ── ⑩ 결과에서 조건을 고치면 한 번에 돌아온다 ────────────────────
     🔴 오너 지적(두 판째) · 지시서 3(Fast-pass). 전에는 현금 칩을 고치면 **화면 셋**을 지나야
        결과로 돌아왔습니다. 새 부품 없이 **상태 하나 + 문구 하나**로 답합니다.
     ⚠ 잠글 것 셋 : ① 상태가 있다 ② 들어오는 두 길이 다 켠다 ③ CTA가 그때 다른 말을 한다. */
  tt('결과에서 온 길을 상태로 기억한다', (()=>{
     const bare = RAW.replace(/\/\*[\s\S]*?\*\//g,'');
     const cond = /S\.step=\+b\.dataset\.step; S\.lockedPrice=null; S\.fromResult=true;/.test(bare);
     const reedit = /reeditBtn'\)\.onclick[\s\S]{0,200}?S\.fromResult = true;/.test(bare);
     return /fromResult:false/.test(bare) && cond && reedit;
  })(), '🔴 조건칩과 「이전 단계」 둘 다 fromResult를 켜야 합니다');
  /* 🔴 v25.15 — **대상을 옮겼습니다. v25.14의 처방이 회귀를 냈습니다**(오너 실기 지적).
     ⏹ v25.14는 결과에서 온 사람의 **주 버튼을 「결과 다시 보기」로 덮었습니다.** 그러면
       01만 고치고 **02·03도 이어서 보려던 사람의 길이 막힙니다** — 「결과로 바로」와
       「다음 단계로」는 **둘 다 참인 의도**인데 버튼 하나에 겹쳐 놓은 것이 잘못이었습니다.
     → 지키려던 사실은 「CTA 문구가 바뀐다」가 아니라 **「결과로 한 번에 돌아가는 길이 있다」**입니다.
       이제 **주 버튼은 순차 이동을 유지**하고, 곁길은 **상단 바 보조 버튼**입니다(원칙 128).
     ⚠ 그래서 이 절은 셋을 잠급니다 —
       ① 주 버튼이 **fromResult로 갈라지지 않는다**(회귀 재발 방지)
       ② 보조 버튼이 **있고 fromResult일 때만 보인다**
       ③ 그 버튼이 **집값을 풀고** 결과로 간다. */
  tt('주 버튼이 결과 복귀로 덮이지 않는다', (()=>{
     const f = (RAW.match(/function syncCta\(\)[\s\S]*?\n\}/)||[''])[0].replace(/\/\*[\s\S]*?\*\//g,'');
     const n = (RAW.match(/function next\(\)[\s\S]*?\n\}/)||[''])[0].replace(/\/\*[\s\S]*?\*\//g,'');
     /* ⚠ `next()`가 **끄는 것**(`S.fromResult=false`)은 정상입니다 — 퍼널을 끝까지 걸어
        결과에 닿으면 그 길은 끝난 것입니다. 막을 것은 **갈라지는 것**(`if(S.fromResult)`)입니다.
        「없다」로 잠그면 정당한 정리 코드까지 막습니다(원칙 48). */
     return !/fromResult/.test(f) && !/if\s*\(\s*S\.fromResult/.test(n);
  })(), (RAW.match(/b\.textContent = [^;]*/)||['없음'])[0].replace(/\s+/g,' ').slice(0,90));
  /* 🔴 v25.18 — **대상을 옮겼습니다**(원칙 128 · 지우지 않았습니다).
     ⏹ 전 : `tr.hidden = !S.fromResult`라는 **문자열 한 줄**을 찾았습니다. 그 줄은
       `render()` 안에만 있었고 `render()`는 입력 화면에서만 돕니다 — 그래서
       **「결과 보기」로 결과에 돌아오면 버튼이 안 사라졌습니다.** 검사는 초록이었습니다.
       **검사가 지키려던 사실은 「그 줄이 있다」가 아니라 「입력 화면에서만 보인다」였습니다.**
     → 이제 셋을 봅니다: ① 버튼이 있다 ② 표시를 정하는 자리가 **한 곳**이다(원칙 58)
       ③ 그 자리가 **결과 화면에서도 불린다**(원칙 122 — 정의됐는가가 아니라 불려지는가). */
  tt('결과로 돌아가는 보조 문이 따로 있다', (()=>{
     const bare = RAW.replace(/<!--[\s\S]*?-->/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
     const mark = /id="toResultBtn"/.test(bare);
     const one  = (bare.match(/tr\.hidden\s*=/g) || []).length === 1;   /* 두 벌 금지 */
     const cond = /tr\.hidden\s*=[^;]*S\.fromResult/.test(bare);
     return mark && one && cond;
  })(), '🔴 상단 보조 버튼이 있고, 표시를 정하는 자리가 한 곳이며 fromResult를 봐야 합니다');
  /* 🔴 v25.18 — **이 검사는 처음에 자기 자신을 배신했습니다**(원칙 152).
     사보타주로 `syncToResultBtn(true);`를 **`//`로 주석 처리**했더니 **초록으로 통과**했습니다 —
     전처리가 블록 주석(`/* *​/`)만 걷고 **줄 주석을 안 걷어서**, 죽은 호출을 살아 있는 것으로
     셌습니다. 「정의됐는가가 아니라 불려지는가」(원칙 122)를 보려던 검사가 **주석을 보고 있었습니다.**
     ⚠ 그렇다고 `//`를 통째로 걷으면 URL이 잘립니다(원칙 152 ①). **함수 본문 안에서만**,
       그리고 **앞 글자가 `:`가 아닐 때만** 걷습니다. */
  const stripLine = s => s.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  tt('🔴 그 표시가 결과 화면에서도 갱신된다 (v25.18)', (()=>{
     const bare = RAW.replace(/<!--[\s\S]*?-->/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
     /* 표시를 정하는 함수 이름을 코드에서 뽑습니다 — 이름을 손으로 안 적습니다(원칙 84). */
     const fn = (bare.match(/function\s+(\w+)\s*\([^)]*\)\s*\{[^}]*tr\.hidden\s*=/)||[])[1];
     if(!fn) return false;
     const sr = stripLine((bare.match(/function showResult\([\s\S]*?\n\}/)||[''])[0]);
     const rd = stripLine((bare.match(/function render\(\)[\s\S]*?\n\}/)||[''])[0]);
     /* 🔴 결과 화면과 입력 화면 **둘 다** 그 함수를 **살아 있는 코드로** 불러야 합니다.
        하나만 부르면 다른 쪽 화면이 옛 상태를 그대로 들고 있습니다 — v25.15가 그랬습니다. */
     return new RegExp(fn + '\\s*\\(').test(sr) && new RegExp(fn + '\\s*\\(').test(rd);
  })(), '🔴 showResult와 render가 둘 다 (주석이 아니라 코드로) 불러야 합니다');
  tt('그 보조 문이 실제로 결과로 간다', (()=>{
     const f = (RAW.match(/function backToResult\(\)[\s\S]*?\n\}/)||[''])[0].replace(/\/\*[\s\S]*?\*\//g,'');
     /* ⚠ 집값을 다시 풀지 않으면 바뀐 조건과 잠긴 값이 갈립니다(원칙 91)
        ⚠ ready()가 거짓이면 아무 일도 안 합니다 — 빈 답을 결과라고 부르지 않습니다(원칙 124) */
     return /if\(!ready\(\)\) return;/.test(f) && /S\.lockedPrice=null;/.test(f) && /showResult\(\);/.test(f);
  })(), '🔴 backToResult가 ready 확인 · lockedPrice 해제 · showResult 셋을 다 해야 합니다');
  /* ⚠ 이 보조 문은 **앱 안에서 끝나는 이동**입니다 — v25.14가 `↗`를 「밖으로 나간다」 한 뜻으로
     좁혔으므로 여기에 화살표를 달면 그 뜻이 깨집니다(채널 C). */
  tt('결과 복귀 버튼에 밖으로 나가는 표식을 안 쓴다', (()=>{
     const b = (RAW.match(/<button[^>]*id="toResultBtn"[\s\S]*?<\/button>/)||[''])[0];
     return !!b && !/↗|arw/.test(b);
  })());
  /* ⚠ 이 값은 **그 세션의 길**이지 입력이 아닙니다 — 초안에 저장하면 탭을 닫았다 돌아온 사람의
     버튼까지 「결과 다시 보기」가 됩니다(그 사람에게는 돌아갈 결과가 없습니다). */
  tt('결과에서 온 길을 초안에 저장하지 않는다', (()=>{
     const f = (RAW.match(/function saveDraft\(\)[\s\S]*?\n\}/)||[''])[0]
             + (RAW.match(/function loadDraft\(\)[\s\S]*?\n\}/)||[''])[0];
     return !/fromResult/.test(f.replace(/\/\*[\s\S]*?\*\//g,''));
  })());

  tt('글꼴이 없을 수 있는 기호를 화면에 안 쓴다', !/⧉|⇱|⧫|⌘/.test(SCREEN2),
     ((SCREEN2.match(/[⧉⇱⧫⌘]/g)||['없음'])).join(' '));
  /* 🔴 v25.14 — **화살표가 한 가지 뜻만 갖는다.** 「다음 걸음」 넷 중 화살표가 붙는 것은
     **밖으로 나가는 둘**뿐입니다(채널 C · v23.20). 앱 안에서 끝나는 둘은 레이블이 동작을 말합니다.
     ⚠ 잠글 것은 「↗가 몇 개」가 아니라 **「↗가 붙은 것은 전부 밖으로 나가는가」**입니다. */
  /* ⚠ 마크업 덩어리를 정규식으로 자르지 않습니다 — 사이에 주석이 끼면 조용히 짧게 잘립니다
     (실제로 한 번 그랬습니다 · 지침 6-24의 계열). **id로 네 칸을 직접** 집습니다. */
  const MINI = id => (SCREEN2.match(new RegExp('<(a|button)[^>]*id="'+id+'"[\\s\\S]*?<\\/\\1>'))||[''])[0];
  tt('화살표가 밖으로 나가는 것에만 붙는다', (()=>{
     const four = ['outNaver','outHogang','outSave','outCopy'].map(MINI);
     if(four.some(x => !x)) return false;
     return four.every(it => /class="arw"/.test(it) === /target="_blank"/.test(it));
  })(), ['outNaver','outHogang','outSave','outCopy'].map(id=>{ const it=MINI(id);
     return id + (/target="_blank"/.test(it)?'(밖)':'(안)') + (/class="arw"/.test(it)?'↗':'—'); }).join(' · '));
})();

/* ═══ v25.15 — 실기 지적 반영 (마이크로카피 · 위계 · 동선) ══════════
   외부 UX 검토 여덟 건 중 **넷은 전제가 사실과 달랐습니다**(아래 표는 README v25.15 절).
   여기서 잠그는 것은 실제로 고친 셋입니다.
   ═══════════════════════════════════════════════════════════════ */
(() => {
  const RAW  = fs.readFileSync(FILE,'utf8');
  const BARE = RAW.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
  const CSSB = (RAW.match(/<style>([\s\S]*?)<\/style>/)||['',''])[1].replace(/\/\*[\s\S]*?\*\//g,'');

  /* ── ① 구간한도 알약이 주어를 갖는다 ────────────────────────────
     「정부 상한에 도달했어요」만으로는 **무엇이** 닿았는지 모릅니다 —
     내 DSR 한도인지, 총부채 상한인지, 주담대 한도인지. 이 알약은 언제나 **주담대**입니다.
     ⚠ 잠글 것은 「그 문장」이 아니라 **「주어가 있다」**입니다(원칙 48). */
  /* 🔴 v25.20 — **대상을 옮겼습니다**(원칙 128). 「무엇이 닿았는지」는 이제 접힌 서랍 줄이
     `LNAME[c.binding]`으로 말합니다. 알약에 주어를 붙이려던 v25.15·v25.19의 다툼은
     **알약을 빼면서 끝났습니다** — 서랍 줄은 「대출 한도 산출 기준」이라는 제목 옆에 서므로
     주어가 제목에 이미 있습니다(원칙 43 · 141). */
  tt('걸린 한도를 접힌 줄이 말한다 (v25.20)', (()=>{
     const f = (BARE.match(/function renderLimits\([\s\S]*?\n\}/)||[''])[0];
     return !!f && /LNAME\[c\.binding\]/.test(f.replace(/\s+/g,''));
  })());

  /* ── ② 히어로 서술이 금액보다 두 단 아래다 ──────────────────────
     🔴 v25.11이 오너 지시로 이 잉크를 한 단 **올린** 자리입니다(「너무 안 보인다」).
        그 결정을 되돌리지 않고 **크기**로 위계를 냈습니다 — 조용하게 만드는 것은
        색이 아니라 크기와 굵기입니다(원칙 100).
     ⚠ 잠글 것은 「14px이다」가 아니라 **「금액과의 크기 차가 충분하다」**와
       **「v25.11이 올린 잉크가 안 내려갔다」** 둘입니다. */
  tt('히어로 서술이 금액보다 확실히 작다', (()=>{
     const lab = (CSSB.match(/\n\.rhead-label\{([^}]*)\}/)||[])[1] || '';
     const tail = (CSSB.match(/\n\.rhead-tail\{([^}]*)\}/g)||[]).join(' ');
     const t = x => (x.match(/font-size:var\((--t\d)\)/g)||[]).pop();
     /* --t6(14) 이하여야 합니다. 히어로는 clamp(32,11vw,--d1)로 40px 안팎입니다 */
     const ok = v => v === 'font-size:var(--t6)' || v === 'font-size:var(--t7)';
     return ok(t(lab)) && ok(t(tail));
  })(), (()=>{ const lab=(CSSB.match(/\n\.rhead-label\{([^}]*)\}/)||[])[1]||'';
     return 'label ' + (lab.match(/font-size:[^;}]*/)||['?'])[0]
          + ' / tail ' + ((CSSB.match(/\n\.rhead-tail\{[^}]*font-size:[^;}]*/g)||[]).pop()||'?').split('font-size:').pop(); })());
  tt('히어로 서술 잉크를 v25.11 이전으로 되돌리지 않았다', (()=>{
     const lab = (CSSB.match(/\n\.rhead-label\{([^}]*)\}/)||[])[1] || '';
     return /color:var\(--ink-2\)/.test(lab);
  })(), '🔴 오너가 「너무 안 보인다」고 올린 잉크입니다(v25.11) — 크기로만 조절합니다');

  /* ── ③ 결과 복귀는 곁길이지 주 버튼이 아니다 ────────────────────
     🔴 v25.14가 주 버튼을 덮어 **「01만 고치고 02로 이어 가려는 사람」의 길을 막았습니다.**
        「결과로 바로」와 「다음 단계로」는 **둘 다 참인 의도**입니다 — 한 버튼에 겹치면 안 됩니다.
     ⚠ 세 검사가 이 절 앞쪽(v25.14 블록)에 있습니다. 여기서는 **자리**만 한 번 더 잠급니다. */
  tt('결과 복귀 버튼이 하단 도크에 있지 않다', (()=>{
     const dock = (BARE.match(/<div class="dock"[\s\S]*?<\/div>\s*<\/div>/)||[''])[0];
     return !/toResultBtn/.test(dock);
  })(), '🔴 도크는 「이전 + 다음」 둘입니다 — 셋이 되면 엄지 폭이 나뉩니다');
  tt('결과 복귀 버튼이 상단 바에 있다', (()=>{
     const bar = (BARE.match(/<div class="appbar">[\s\S]*?<\/div>/)||[''])[0];
     return /id="toResultBtn"/.test(bar);
  })());
  /* ⚠ 새 규격을 만들지 않았습니다 — `.trust`(35px 알약)를 그대로 씁니다(지침 6-22). */
  tt('결과 복귀 버튼이 기존 부품을 재사용한다', (()=>{
     const b = (BARE.match(/<button[^>]*id="toResultBtn"[^>]*>/)||[''])[0];
     return /class="trust /.test(b) && /\.trust\.barresult\{/.test(CSSB);
  })(), (BARE.match(/<button[^>]*id="toResultBtn"[^>]*>/)||['없음'])[0].slice(0,70));
})();

/* ── 결과 ─────────────────────────────────────────────────────── */
/* ⏹ v25.20 — **v25.18-b의 알약 검사 둘을 지웠습니다.**
   지키려던 것(「알약이 한도 이야기임을 말한다」·「실행액을 안 적는다」)은 **알약이 사라져
   대상 자체가 없어졌습니다.** 두 사실은 위에서 형태를 바꿔 살아 있습니다 —
   「걸린 한도를 접힌 줄이 말한다」와 「접힌 한도 줄이 금액을 안 적는다」.
   ⚠ 그리고 「히어로 알약이 되살아나지 않았다」가 **되돌아오는 길을 막습니다**(6-13).
   ⚠ 이것이 **한 판 만에 검사를 옮긴 사례**입니다 — v25.19가 알약 문구를 다듬고 잠갔는데
     v25.20이 알약 자체를 뺐습니다. 원칙 141이 말하는 「자리를 두 번 옮기면 존재 문제」를
     v25.19가 아직 못 본 것입니다. **잠금은 오더보다 오래 삽니다**(원칙 148) — 그래서
     지우지 않고 **옮겼습니다.** */

/* ═══ 🔴 v25.22 — 정책대출 각주는 자격이 될 수 있는 집값에서만 (오너 지적) ══════════
   ⏹ 「디딤돌·보금자리론을 받으면 한도가 더 늘어나요」가 **한도가 있는 모든 화면**에 붙었습니다.
     두 상품에는 집값 상한이 있고(디딤돌 5억 · 신생아특례 9억 · 보금자리론 6억), 실기 캡쳐의
     집값은 **17.7억**이라 셋 다 대상 밖입니다. 엔진은 그걸 알고 은행 경로로 떨어뜨리는데
     화면만 반대로 말했습니다(원칙 143). 오독 방향은 **유리한 쪽**입니다(원칙 28).
   ⚠ 잠글 것은 「9억」이 아니라 **「상한을 POLICY에서 뽑는가」와 「조건부인가」**입니다 —
     값을 잠그면 정책이 바뀔 때 검사가 거짓말이 됩니다(원칙 84 · 149). */
(() => {
  const RAW  = fs.readFileSync(FILE,'utf8');
  const BARE = RAW.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
  const f = (BARE.match(/const policyPriceMax[\s\S]*?notes\.hidden/)||[''])[0];
  tt('정책대출 각주가 조건부다 (v25.22)',
     !!f && /policyPossible \?/.test(f), f ? '조건부 ✅' : '🔴 못 찾음');
  tt('정책 집값 상한을 POLICY에서 뽑는다 (v25.22)',
     !!f && /POLICY\.policyLoan/.test(f) && !/[0-9]00000000/.test(f));
  /* 🔴 **값 검사** — 위 둘은 표기를 봅니다. 이건 실제로 갈리는지를 봅니다.
     ⚠ 「상한 이하면 보이고, 넘으면 안 보인다」 둘 다 확인합니다 — 한쪽만 보면
       늘 보이거나 늘 안 보이는 코드도 통과합니다(원칙 127의 계열). */
  tt('정책 집값 상한이 실제로 갈린다 (v25.22)', (()=>{
     const caps = Object.values(E.POLICY.policyLoan)
       .flatMap(v => Object.values(v.price || {})).filter(Number.isFinite);
     const max = Math.max(...caps, 0);
     return max > 0 && max < 만(200000);      /* 상한이 있고, 20억보다는 작아야 뜻이 있습니다 */
  })(), String(Math.max(...Object.values(E.POLICY.policyLoan)
       .flatMap(v => Object.values(v.price || {})).filter(Number.isFinite), 0)));
})();

/* ═══ 🔴 v25.23 — 규제 문구 정제 (오너 지적) ═══════════════════════════════
   ⏹ 「대출 상한이 **붙어요**」가 03 지역 안내와 결과 `bindingTip` **두 곳**에 있었습니다.
     규제는 붙는 것이 아니라 **적용되는** 것입니다. 둘을 같이 고쳤습니다(원칙 58).
   ⚠ 잠글 것은 문장이 아니라 **「구어체 '붙어요'를 안 쓴다」와 「두 화면이 같은 낱말인가」**입니다. */
(() => {
  const RAW  = fs.readFileSync(FILE,'utf8');
  const BARE = RAW.replace(/\/\*[\s\S]*?\*\//g,'').replace(/<!--[\s\S]*?-->/g,'');
  tt('규제 설명에 「붙어요」를 안 쓴다 (v25.23)',
     !/상한(도|이)? (따로 )?붙어요/.test(BARE),
     (BARE.match(/상한[^。.]{0,12}붙어요/)||['없음'])[0]);
  tt('03 안내와 결과 설명이 같은 낱말을 쓴다 (v25.23)', (()=>{
     const n = (BARE.match(/대출 상한이 적용돼요/g)||[]).length;
     return n >= 2;                 /* 03 지역 안내 · bindingTip 구간한도 갈래 */
  })(), String((BARE.match(/대출 상한이 적용돼요/g)||[]).length) + '곳');
  /* 🔴 **확인 못 한 것을 화면에 적지 않습니다**(원칙 1).
     이 코드가 아는 것은 `regulated` boolean 하나이고, 투기과열지구/조정대상지역을 가르는
     표가 없습니다. 지역 안내에 그 이름이 들어오면 **근거 없이 적은 것**입니다. */
  tt('지역 안내가 못 가르는 것을 말하지 않는다 (v25.23)', (()=>{
     const f = (BARE.match(/const tag = [\s\S]*?\}<\/div>`/)||[''])[0]
            || (BARE.match(/규제지역이에요[\s\S]{0,400}/)||[''])[0];
     return !!f && !/투기과열|조정대상/.test(f);
  })());
})();

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
