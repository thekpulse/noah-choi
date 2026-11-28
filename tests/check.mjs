// 영끌계산기 배포물 점검 — `npm test` 또는 `node tests/check.mjs` (Windows·macOS 공통, 의존성 없음)
// v287 — source/ 빌드 구조가 배포물에 없어(v253 무렵부터 index.html 직접 수정) 회귀 검사가 돌지 않던 것을
//        최소한의 잠금으로 대신함. 하나라도 실패하면 종료 코드 1.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const exists = f => fs.existsSync(path.join(ROOT, f));
let fail = 0, pass = 0;
const ok = (cond, name, detail = '') => {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (detail ? '\n      ' + detail : '')); }
};

const html = read('index.html');

// 1) 계산 엔진 잠금 — POLICY가 든 <script> 시작부터 「ENGINE END」 표식까지 SHA-256.
//    엔진을 일부러 열었다면 아래 값을 새로 계산해 바꾸고, 왜 열었는지 README에 적는다.
const ENGINE_SHA256 = '2b85bce2e2c43192502a64ebaa1ffa0c192746dec268ba1eb78891cbcd241acd'; // v320 — 500만원 미만 탐색 경계만 수정 · 정책값 그대로
{
  const p = html.indexOf('const POLICY');
  const st = html.lastIndexOf('<script', p), en = html.indexOf('ENGINE END');
  const ok1 = p > 0 && st >= 0 && en > st && html.indexOf('ENGINE END', en + 1) < 0;
  ok(ok1, '엔진 구간 표식(POLICY · ENGINE END 한 번)');
  if (ok1) {
    const h = crypto.createHash('sha256').update(html.slice(st, en), 'utf8').digest('hex');
    ok(h === ENGINE_SHA256, '계산 엔진 바이트 동일', '지금 ' + h);
  }
}

// 2) 0.5px 단위 글자 금지(규칙)
{
  const bad = [...html.matchAll(/font-size:\s*(\d+\.\d+)px/g)].map(m => m[1]);
  ok(bad.length === 0, '글자 크기에 소수 px 없음', bad.slice(0, 8).join(', '));
}

// 3) 글꼴 파일 — index.html이 부르는 fonts/ 파일이 모두 있음
{
  const urls = [...new Set([...html.matchAll(/url\((fonts\/[^)'"]+)\)/g)].map(m => m[1]))];
  const miss = urls.filter(u => !exists(u));
  ok(urls.length > 0 && miss.length === 0, `글꼴 파일 ${urls.length}개 모두 있음`, miss.slice(0, 5).join(', '));
}

// 3b) 아이콘 파일(v297) — 검색 결과 · 홈 화면 추가용은 data: 주소를 못 씀
ok(['favicon.ico','apple-touch-icon.png'].every(exists), 'favicon.ico · apple-touch-icon.png 있음');

// 4) 이미지 저장 대체 경로 파일
ok(/\/vendor\/html2canvas\.min\.js/.test(html) && exists('vendor/html2canvas.min.js'), 'vendor/html2canvas.min.js 있음');

// 5) 안내 페이지 — 내부 링크 · 파비콘 · sitemap
{
  const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !/^google[0-9a-f]+\.html$/.test(f) /* v328 — 구글 소유확인 파일은 페이지가 아님 */).sort();
  const sitemap = read('sitemap.xml');
  for (const p of pages) {
    const s = read(p);
    const hrefs = [...s.matchAll(/href="([^"#?]+)"/g)].map(m => m[1])
      .filter(h => !/^(https?:|mailto:|tel:|data:)/.test(h) && !h.includes('${') && !h.includes("'+"));
    // v323 — 내부 링크도 최종 주소(/guide)로 건다. 운영 서버가 /x.html을 /x로 넘기므로 .html 링크는 한 번 넘어가는 주소가 되고,
    // 서치콘솔이 「참조 페이지: 감지된 페이지 없음」으로 본다(2026-11-09 dsr-income-table URL 검사). 확장자 없는 링크는 x.html 파일로 확인.
    const broken = hrefs.filter(h => { const f = h.replace(/^\//, '') || 'index.html'; return !exists(f) && !exists(f + '.html'); });
    ok(broken.length === 0, p + ' 내부 링크', broken.join(', '));
    const viaRedirect = hrefs.filter(h => /\.html$/.test(h));
    ok(viaRedirect.length === 0, p + ' 내부 링크에 .html 없음(넘어가는 주소 금지)', viaRedirect.join(', '));
    ok(/rel="icon"/.test(s) && /href="\/favicon\.ico"/.test(s) && /rel="apple-touch-icon"/.test(s), p + ' 파비콘(svg · ico · 홈 화면 아이콘)');
    // v322 — 운영 서버(Vercel)가 /x.html을 /x로 넘긴다(2026-11-09 브라우저 확인). 서치콘솔 「리디렉션 오류」 4건(guide·budget-examples·
    // dsr-income-table·price-band-cap)의 원인이 canonical·sitemap이 넘어가는 주소(.html)를 가리킨 것이라, 둘 다 최종 주소(확장자 없음)로 쓴다.
    const loc = p === 'index.html' ? 'https://www.myhome-price.com/<' : 'https://www.myhome-price.com/' + p.replace(/\.html$/, '') + '<';
    ok(sitemap.includes('<loc>' + loc.replace('<', '</loc>')), p + ' sitemap 등재(최종 주소)');
    if (p !== 'index.html') {
      const canon = (s.match(/<link rel="canonical" href="([^"]+)"/) || [])[1];
      ok(canon === loc.slice(0, -1), p + ' canonical = 최종 주소(확장자 없음)', canon);
    }
    ok(!/https:\/\/www\.myhome-price\.com\/[a-z0-9-]+\.html/.test(s), p + ' 절대 주소에 .html 없음(넘어가는 주소 금지)');
  }
}

// 6) 공유 이미지에 주택담보대출 월 상환액을 싣지 않는다(오너 결정 2026-09-21 · v152) — renderReport가 rMonthly를 숨기고 비움
{
  const i = html.indexOf('function renderReport');
  const seg = i > 0 ? html.slice(i, html.indexOf('\nfunction ', i + 10)) : '';
  ok(/monthly\.hidden\s*=\s*true/.test(seg) && /monthly\.innerHTML\s*=\s*''/.test(seg), '공유 이미지에 월 상환액 없음(renderReport)');
}

// 7) 인라인 스크립트 문법 — 하나라도 깨지면 그 블록 전체가 안 돎(v294 작업 중 실제로 한 번 깨뜨렸다가 화면 검사로 잡음)
{
  const re = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g; let m, n = 0; const bad = [];
  while ((m = re.exec(html))) { n++;
    if (/application\/ld\+json/.test(m[1])) { try { JSON.parse(m[2]); } catch (e) { bad.push(n + '번째(JSON-LD): ' + e.message); } continue; }   // v314 — 구조화 데이터는 JSON으로 검사
    try { new Function(m[2]); } catch (e) { bad.push(n + '번째: ' + e.message); } }
  ok(n > 0 && bad.length === 0, `인라인 스크립트 ${n}개 문법`, bad.join(' / '));
}

// 8) 접근성 구조(v298 · v299 — axe-core 점검 0건 상태를 지킴): 본문 구획 · 결과 화면 h1
ok(/id="welcome232"[^>]*role="main"/.test(html) && /id="result"[^>]*role="main"/.test(html) && /<main[^>]*id="funnel"/.test(html), '본문 구획(main) 세 화면');
ok(/id="result"[^>]*>\s*<h1 class="sr-only">/.test(html), '결과 화면 h1');

// 9) 지역 카드 그림(v300) — 카드의 data-group 값이 바뀌면 그림이 조용히 빠지므로, 세 값이 화면 틀과 그림 규칙 양쪽에 있는지 본다
{
  const groups = ['seoul', 'metro', 'other'];
  const st = (html.match(/<style id="v300-region-icons">([\s\S]*?)<\/style>/) || [])[1] || '';
  const miss = groups.filter(g => !html.includes(`class="zonecard \${S.group==='${g}'?'is-on':''}" data-group="${g}"`) || !st.includes(`[data-group="${g}"]::before{background-image:url("data:image/svg+xml,`));
  ok(st && miss.length === 0, '지역 카드 그림 3개(서울 · 경기·인천 · 그 외)', miss.join(', '));
}

// 10) 안내 페이지 도표(v301 · v302) — 다섯 페이지에 도표가 있고, 그림 부분만 낭독기에서 숨기며 설명 글(figcaption)은 읽히게 둔다
for (const [pg, need, id] of [['loan-limit.html', '약 2억 6,300만원', 'v301'], ['price-band-cap.html', '16억 3,200만원', 'v301'], ['guide.html', '4억 8,000만원', 'v301'], ['dsr-income-table.html', '1억 3,100만원', 'v302'], ['budget-examples.html', '5억 4,300만원', 'v302']]) {
  const s = read(pg); const fig = (s.match(/<figure class="yk-fig[^"]*">([\s\S]*?)<\/figure>/) || [])[1] || '';
  ok(s.includes(`id="${id}-figures"`) && /^<div aria-hidden="true">/.test(fig) && /<figcaption>[^<]+<\/figcaption>$/.test(fig) && !/<figure[^>]*aria-hidden/.test(s) && s.split(need).length > 1,
     pg + ' 도표(그림 숨김 · 설명 읽힘)');
}

// 11) 안내 페이지 글꼴(v304) — 열 페이지가 계산기와 같은 @font-face 92개를 쓰고 본문에 Pretendard를 건다
{
  const ff = (h) => [...h.matchAll(/@font-face\s*\{[^}]*\}/g)].map(m => m[0]).join('');
  const base = ff((html.match(/<style id="pretendard">([\s\S]*?)<\/style>/) || [])[1] || '');
  for (const pg of ['about.html','guide.html','loan-limit.html','buying-costs.html','existing-debt.html','privacy.html','articles.html','budget-examples.html','dsr-income-table.html','price-band-cap.html','switch-home.html','rate-type.html','regulated-area.html','couple-income.html','room-deduction.html']) {
    const st = (read(pg).match(/<style id="v304-font">([\s\S]*?)<\/style>/) || [])[1] || '';
    ok(base.length > 0 && ff(st) === base && /html body\{font-family:'Pretendard Variable',/.test(st), pg + ' 글꼴(계산기와 같은 Pretendard)');
  }
}

// 12) 애드센스(v305) — 페이지 11개 모두 광고 코드가 있고 게시자 ID가 ads.txt와 같다 · 첫 화면에 글 7편 링크
{
  const pub = ((read('ads.txt').match(/pub-(\d+)/) || [])[1]) || '';
  const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !/^google[0-9a-f]+\.html$/.test(f) /* v328 — 구글 소유확인 파일은 페이지가 아님 */);
  const bad = pages.filter(p => !read(p).includes(`adsbygoogle.js?client=ca-pub-${pub}"`));
  ok(pub && bad.length === 0, `광고 코드 ${pages.length}개 페이지 · 게시자 ID ads.txt와 같음`, bad.join(', '));
  const nav = (html.match(/<nav class="v305-reads[^"]*"[\s\S]*?<\/nav>/) || [])[0] || '';
  ok(nav.includes('href="/articles"') && /#app:has\(#welcome232\[hidden\]\) \.guide-nav\{display:none!important\}/.test(html), '첫 화면 글 링크 한 줄(v315) · 입력 화면에서 안내 링크 줄 숨김');
}

// 13) 조건 입력 불편 줄이기(v306) — 주택 보유 빈 상태 안내 · 「기존 대출 없음」 한 번에 적용
{
  ok(html.includes("if(!S.houseStatus) return '집을 가져본 적이 없으면 생애최초, 가져본 적은 있지만 지금은 없으면 무주택이에요."), '주택 보유 시트 — 고르기 전에도 생애최초·무주택 차이 안내');
  const h = (html.match(/\$\('debtNone'\)\.onclick=\(\)=>\{[\s\S]*?\n  \};/) || [])[0] || '';
  ok(/S\.debtMonthly=0;[\s\S]*closeSheet\('q'\)/.test(h), '「기존 대출 없음」 누르면 바로 적용 · 시트 닫힘');
}

// 14) 부부 소득 합산(v307) — 합치면 배우자 대출도 넣으라는 문구가 연 소득 칸 · 기존 대출 시트에 있고, 「합산 가능」만 단독으로 남지 않는다
{
  ok(html.includes("'부부 합산 시 배우자 대출도 입력'") && html.includes('부부 소득을 합쳤다면 배우자 대출도 넣어요.') && !html.includes("'부부 소득 합산 가능'"), '부부 소득 합산 — 배우자 대출 함께 입력 안내(유리한 오차 막기)');
  // v316 — 근거를 기사에서 감독 규정 원문으로 바꿈. 출처 주석이 빠지거나 기사로 돌아가면 실패
  const c = (html.match(/\/\* v307 — 부부 소득을 합치면[\s\S]*?\*\//) || [])[0] || '';
  ok(c.includes('은행업감독업무시행세칙') && c.includes('<별표18>') && c.includes('9.(연소득의 산정) 나목') && !c.includes('금융위 원문은 못 찾음'), '부부 소득 합산 — 출처 = 은행업감독업무시행세칙 <별표18> 9.나');
}

// 15) 비교 지역 접기(v308) — 고른 비교 지역이 없으면 접힌 채 시작 · 제목이 펼침 버튼 · 접혀도 고른 지역 줄은 남김
{
  ok(/const open = CMP_OPEN \|\| DEAL\.compareCodes\.length > 0;/.test(html) && html.includes('id="cmpToggle" aria-expanded="\'+open+\'" aria-controls="inputRegionGrid"') && html.includes('id="inputRegionGrid"'), '비교 지역 — 접힌 채 시작 · 펼침 버튼');
  ok(/\.input-compare\.is-collapsed>p:not\(#inputRegionStatus\)/.test(html), '비교 지역 — 접혀도 고른 지역 줄 남김');
}

// 16) 지역 → 주택 보유 잇기(v309) — 「선택 완료」로 닫고 주택 보유가 비었으면 주택 보유 시트를 엶(✕로 닫으면 안 엶)
{
  ok(/const chain = QMODE==='region' && !S\.houseStatus;\s*closeSheet\('q'\);\s*if\(chain\)/.test(html) && html.includes(`document.querySelector('#crows [data-mode="house"]')?.click()`), '지역 선택 완료 → 주택 보유 시트 이어 열기');
}

// 17) 유주택 LTV(v310) — 기존 집을 안 파는 1주택 이상은 수도권 비규제에서도 0%(지방 비규제만 60%). 안내 페이지 표도 같은 값
{
  ok(/multi:\s*\{reg: 0, metro: 0, other: 0\.6\}/.test(html) && html.includes("return reg ? L.multi.reg : metro ? L.multi.metro : L.multi.other;"), 'LTV — 수도권 비규제 1주택(처분 안 함) 0%');
  ok(read('loan-limit.html').includes('<td class="num">수도권 0% · 지방 60%</td>'), 'loan-limit 표 — 1주택 이상 수도권 0% · 지방 60%');
}

// 18) 지방 스트레스 금리 기한(v311) — 지방 주담대 0.75%p는 금융위 행정지도로 2026.12.31까지만 유예.
//     2027.1.1부터 이 검사가 실패한다 → 금융위 발표를 다시 확인하고 STRESS.local 값 또는 이 날짜를 고칠 것.
//     (연장 없이 3단계가 되면 변동형 1.50%p — 0.75%p로 두면 지방 한도가 유리하게 나옴)
{
  const today = new Date();
  ok(today < new Date('2027-01-01T00:00:00+09:00') || !/variable: \{ capital: 3\.00, local: 0\.75 \}/.test(html),
     '지방 스트레스 금리 0.75%p 유예 기한(2026.12.31) 안', '기한 지남 — 금융위 스트레스 DSR 행정지도 연장 여부 확인 후 STRESS.local 갱신');
}

// 19) 1주택 0원 안내(v311) — 처분 안 한 1주택이 0원이면 이유와 「기존 주택 처분 예정」을 말함
{
  ok(html.includes("if(S.houseStatus==='multi' && S.ownCount===1 && !S.disposePlan)") && html.includes('6개월 안에 팔기로 하면 「기존 주택 처분 예정」으로 계산할 수 있어요.'), '1주택 0원 — 이유 · 처분 예정 안내');
}

// 20) 글 구조화 데이터(v314) — 해설 글 12편(v317 couple-income · v318 room-deduction)에 Article JSON-LD 하나씩 · JSON으로 읽힘 · headline = <h1> 글자
{
  const strip = h => h.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').trim();
  for (const pg of ['guide.html','loan-limit.html','buying-costs.html','existing-debt.html','budget-examples.html','dsr-income-table.html','price-band-cap.html','switch-home.html','rate-type.html','regulated-area.html','couple-income.html','room-deduction.html']) {
    const s = read(pg), m = [...s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    let okj = false, why = '';
    try { const j = JSON.parse(m[0][1]); const h1 = strip((s.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)||[])[1]||'');
          okj = m.length === 1 && j['@type'] === 'Article' && j.headline === h1 && /^https:\/\/www\.myhome-price\.com\//.test(j.mainEntityOfPage); why = j.headline + ' / ' + h1; }
    catch(e){ why = String(e); }
    ok(okj, pg + ' Article 구조화 데이터', why);
  }
}

// 21) 맞벌이 글(v317) — 규정 원문(배우자 소득 합산 시 배우자 명의 대출 포함) · 예시 한도가 지금 엔진 값과 같은지
//     엔진(POLICY · 스트레스 금리)이 바뀌면 글 숫자가 낡으므로 여기서 실패시킨다.
{
  const s = read('couple-income.html');
  ok(s.includes('&lt;별표18&gt;') && s.includes('9.(연소득의 산정) 나목·라목') && s.includes('<strong>배우자 명의 대출을 포함</strong>해 산정해야 합니다'), 'couple-income — 규정 원문 · 출처');
  const vm = await import('node:vm');
  const p = html.indexOf('const POLICY'), st = html.indexOf('>', html.lastIndexOf('<script', p)) + 1, en = html.indexOf('ENGINE END');
  const c = vm.createContext({});
  vm.runInContext(html.slice(st, en) + '*/;globalThis.__={computeStressBp,repaymentCapLimit};', c);
  const { computeStressBp, repaymentCapLimit } = c.__;
  const lim = (inc, debt, metro) => repaymentCapLimit({incomeEntered:true, income:inc*1e4, years:30, rate:5.4, stressBp:computeStressBp(metro,'variable',0,30), creditLoan:0, otherDebtMonthly:debt*1e4}, false).limit;
  const won = w => { const m = Math.floor(w/1e4/100)*100, e = Math.floor(m/1e4), r = m % 1e4; return (e ? e+'억 ' : '') + (r ? r.toLocaleString('en-US')+'만원' : '원').replace(/^원$/, ''); };
  const want = [[6000,0,true],[4000,0,true],[10000,0,true],[10000,50,true],[8000,100,true],[6000,0,false],[10000,0,false]].map(([i,d,m]) => won(lim(i,d,m)));
  const miss = want.filter(w => !s.includes(w));
  ok(miss.length === 0, 'couple-income — 예시 한도 7개 = 지금 엔진 값', miss.join(', ') + ' / 기대 ' + want.join(', '));
}

// 22) 방공제 글(v318) — 규정 출처 · 시행령 4단 금액 = 엔진 · 예시 대출액 8개 + DSR 예시 = 지금 엔진 값
{
  const s = read('room-deduction.html');
  ok(s.includes('4호(임차보증금 및 최우선변제 소액임차보증금의 산정)') && s.includes('시행령 제10조 제1항(2023.2.21 개정)') && s.includes('「MCI·MCG 가입 조건 적용」'), 'room-deduction — 규정 출처 · 화면 스위치 이름');
  ok(html.includes('aria-label="MCI·MCG 가입 조건 적용"'), 'room-deduction — 글이 가리키는 스위치가 화면에 있음');
  const vm = await import('node:vm');
  const p = html.indexOf('const POLICY'), st = html.indexOf('>', html.lastIndexOf('<script', p)) + 1, en = html.indexOf('ENGINE END');
  const c = vm.createContext({});
  vm.runInContext(html.slice(st, en) + '*/;globalThis.__={computeLoan,computeStressBp,zoneFromSgg,roomDeductFromSgg};', c);
  const { computeLoan, computeStressBp, zoneFromSgg, roomDeductFromSgg } = c.__;
  const won = (w, floor100) => { let m = Math.round(w/1e4); if (floor100) m = Math.floor(w/1e4/100)*100; const e = Math.floor(m/1e4), r = m % 1e4; return (e ? e+'억 ' : '') + (r ? r.toLocaleString('en-US')+'만원' : '원').replace(/^원$/, ''); };
  const loan = (sgg, price, inc, mci) => { const z = zoneFromSgg(sgg); return computeLoan({price:price*1e4, houseStatus:'none', ownCount:1, disposePlan:false, regulated:z==='reg', metro:z!=='other', income:inc*1e4, incomeEntered:true, rate:5.4, years:30, stressBp:computeStressBp(z!=='other','variable',0,30), creditLoan:0, otherDebtMonthly:0, noLoan:false, loanChoice:'bank', mciCovered:mci, roomDeductAmt:roomDeductFromSgg(sgg)*1e4, manualLoanCap:0, bankSelfCap:0, extraFunding:0, seominCheck:false}); };
  const want = [];
  for (const [sgg, price] of [['11440',80000],['41113',50000],['30170',30000],['47290',30000]]) {
    want.push(won(loan(sgg, price, 10000, false).amount), won(loan(sgg, price, 10000, true).amount));
    const room = roomDeductFromSgg(sgg); want.push(room.toLocaleString('en-US') + '만원');
  }
  const d = loan('11440', 150000, 7000, false);
  want.push('약 ' + won(d.limits.DSR, true), '약 ' + won(d.amount, true));
  const miss = want.filter(w => !s.includes(w));
  ok(miss.length === 0 && d.binding === 'DSR', 'room-deduction — 예시 대출액 · 방공제 금액 = 지금 엔진 값', miss.join(', ') + ' / 기대 ' + want.join(', '));
}

// 23) 실거래 실패 카드(v319) — 부제와 같은 말을 되풀이하거나 지시하지 않음(말투 원칙)
ok(!html.includes('실거래 정보를 불러오지 못했습니다. 아래에서 다시 확인해 주세요.') && html.includes("'실거래 목록에서 다시 불러올 수 있어요.'") && html.includes('다시 불러오기</button>'), '실거래 실패 카드 — 문구 한 번 · 사실만(다시 불러오기 버튼 있음)');

// 23b) 첫 화면(v327) — 큰 제목을 되풀이하는 작은 제목·그림 도장·캡션이 없고, 계산기가 하지 않는 판단(생활 적합성)을 약속하지 않음
{
  const w = html.slice(html.indexOf('<section id="welcome232"'), html.indexOf('</section>', html.indexOf('<section id="welcome232"')));
  ok(w.length > 0 && !/welcome232-(kicker|stamp|caption)/.test(html) && !w.includes('생활에 맞는지') && w.includes('실거래'),
     '첫 화면 소개 — 반복 문구 없음 · 실제 기능(예상 집값·실거래)만 서술');
}


// 24) v320 — 저장/복원/초기화: 실제 함수를 실행해 사용자 조건을 왕복한다.
{
  const vm = await import('node:vm');
  const between = (a,b) => html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
  const engineStart=html.indexOf('>',html.lastIndexOf('<script',html.indexOf('const POLICY')))+1;
  const engine=html.slice(engineStart,html.indexOf('ENGINE END'))+'*/;';
  const c=vm.createContext({console,window:{scrollTo(){},__condPreview:{base:1}},render(){},resetDealFilters(){}});
  vm.runInContext(engine,c);
  vm.runInContext(`
    const LEGAL_AUTO_MAN=65;
    ${between('const S = { step:0','const $ =')}
    ${between('function sidoOfCode(', 'const shortSido')}
    const initial=JSON.parse(JSON.stringify(S));
    let stored=null; const sessionStorage={setItem(k,v){stored=v},getItem(){return stored},removeItem(){stored=null}};
    const HOUSE={none:1,multi:1,first:1},STEPS=[{}, {}, {}],PYEONG_MAX=100;
    const INTERIOR=[{v:0},{v:100},{v:150},{v:200},{v:-1}];
    function visible(){return [0,1,2]}
    const DEAL={lastPrice:1,sort:'area'}; let SIM_RATE=9,LASTVIEW={price:1};const BUDGET_BY_RULE=new Map([['old',1]]);
    ${between("const DRAFT_KEY =",'function syncCta(){')}
    ${between('function restart(){','window.__selfcheck =')}
    globalThis.t={S,initial,saveDraft,loadDraft,restart,get:()=>JSON.parse(stored),set:o=>{stored=JSON.stringify(o)},reset:()=>Object.assign(S,JSON.parse(JSON.stringify(initial))),cache:BUDGET_BY_RULE};
  `,c);
  const t=c.t;
  const input={cash:20000,income:7000,sgg:'11440',houseStatus:'multi',ownCount:1,disposePlan:true,debtMonthly:0,onResult:true,lockedPrice:400000000,loanCut:30};
  Object.assign(t.S,input);t.saveDraft();t.reset();t.loadDraft();
  ok(t.S.ownCount===1 && t.S.disposePlan===true && t.S.houseStatus==='multi','v320 처분 예정 저장 → 복원 유지');
  ok(t.S.cash===20000 && t.S.income===7000 && t.S.debtMonthly===0 && t.S.loanCut===30,'v320 금액·기존 대출 없음·대출 조정 복원');
  Object.assign(t.S,{ownCount:2,disposePlan:false});t.saveDraft();t.reset();t.loadDraft();
  ok(t.S.ownCount===2 && !t.S.disposePlan,'v320 2주택 이상 저장 → 복원 유지');
  t.set({cash:20000,income:7000,sgg:'11440',houseStatus:'multi',onResult:true,lockedPrice:400000000});t.reset();t.loadDraft();
  ok(t.S.houseStatus===null && !t.S.onResult && t.S.cash===20000,'v320 구버전 유주택 초안은 금액 보존·주택 조건 재선택');
  t.set({...input,ownCount:99});t.reset();t.loadDraft();
  ok(t.S.houseStatus===null && !t.S.onResult,'v320 잘못된 보유 수로 결과 복원 방지');
  ok(html.includes('if(RESUME_RESULT){ S.lockedPrice = null; showResult(false); }'),'v320 복원 시 저장 집값 재사용하지 않고 재계산');
  Object.assign(t.S,{...input,ownCount:2,itCustom:2500,pick:'old',broker:{on:false,v:100},legal:{on:false,v:500},move:{on:true,v:999},appl:{on:true,v:888}});
  t.restart();
  ok(Object.keys(t.initial).every(k=>JSON.stringify(t.S[k])===JSON.stringify(t.initial[k])),'v320 처음부터 다시 — 초기 입력·비용 전 항목 원복');
  ok(t.get()===null && !t.cache.size && c.window.__condPreview.base===null,'v320 재시작 초안·예산 캐시·미리보기 초기화');

  // 실제 엔진으로 다른 지역의 이전/현재 예산을 대조한다.
  vm.runInContext(`
    const man=v=>(v||0)*10000;
    ${between('function previewRegionBudget(', 'function sameRules(')}
    globalThis.regionBudget=previewRegionBudget;
  `,c);
  const context={houseStatus:'none',ownCount:1,disposePlan:false,income:80000000,incomeEntered:true,rate:5.4,years:30,creditLoan:0,otherDebtMonthly:0,noLoan:false,loanChoice:'bank',mciCovered:false,manualLoanCap:0,bankSelfCap:0,extraFunding:0,pyeong:0,interiorPerPyeong:0,interiorTotal:0,brokerOff:false,brokerCustom:null,etc:65,over85:false,firstTimeTaxCut:false,seominCheck:false};
  const snap=cash=>({context:{...context},cash,rate:{rate:5.4,years:30,rateType:'variable',fixedYears:0},budgets:new Map()});
  const before=snap(300000000),after=snap(350000000);
  const seoul=c.regionBudget(before,'11350'),uijeongbu=c.regionBudget(before,'41150'),changed=c.regionBudget(after,'41150');
  ok(seoul<50000 && uijeongbu>50000 && changed>50000,'v320 의정부 5억 거래 — 서울 예산과 달라도 이전/현재 모두 예산 이내');
  ok(c.regionBudget(before,'41150')===uijeongbu && before.budgets.size===2,'v320 지역 규칙별 미리보기 예산 캐시');
  vm.runInContext('globalThis.engine320={solveMaxPrice,calcCosts}',c);
  const small={...context,noLoan:true,regulated:true,metro:true,roomDeductAmt:55000000};
  const smallPrice=c.engine320.solveMaxPrice(4000000,small);
  ok(smallPrice>0 && smallPrice<5000000 && c.engine320.calcCosts({...small,price:smallPrice}).cashNeeded<=4000000,'v320 500만원 미만 가능한 집값 탐색');
  ok(c.engine320.calcCosts({...small,price:smallPrice+10000}).cashNeeded>4000000,'v320 낮은 금액 탐색의 최대값 검증');
  ok(c.engine320.solveMaxPrice(100000,small)===0,'v320 부대비용도 부족하면 0원');
  ok(html.includes('var was = a > oldBudget, now = a > newBudget;'),'v320 비교 미리보기는 지역별 전후 예산 사용');
}
// 25) v320 — 실거래 부분 실패/1,000건 초과/지역 실패와 재시도를 모의 API로 검증.
{
  const vm=await import('node:vm');let mode='partial',calls=0;
  const c=vm.createContext({DEAL:{cache:new Map(),months:3},recentYmd:()=>[202611,202610,202609],fetch:async url=>{
    calls++;const lawd=/lawd=(\d+)/.exec(url)[1],ymd=Number(/ymd=(\d+)/.exec(url)[1]);
    return {ok:true,json:async()=>mode==='allfail'||(mode==='partial'&&ymd===202610)||(mode==='regionfail'&&lawd==='11350')?{ok:false}:{ok:true,items:[{name:'검증단지',amountMan:50000}],total:ymd===202609&&mode==='partial'?1200:1}};
  }});
  vm.runInContext(html.slice(html.indexOf('async function fetchOne(lawd){'),html.indexOf('async function fetchDeals(lawd,')),c);
  const first=await c.fetchOne('11440');
  ok(first.length===2 && first.queryIssues.some(x=>x.kind==='failed'&&x.ymd===202610),'v320 한 달 실패 — 받은 거래 보존·실패 월 표시');
  ok(first.queryIssues.some(x=>x.kind==='truncated'&&x.ymd===202609),'v320 1,000건 초과 조회 정보 보존');
  ok(!c.DEAL.cache.has('11440'),'v320 부분 실패는 성공 캐시에 넣지 않음');
  mode='success';const retry=await c.fetchOne('11440');
  ok(retry.length===3 && !retry.queryIssues.length,'v320 재시도 성공 후 실패 표시 제거');
  const n=calls;await c.fetchOne('11440');ok(calls===n,'v320 정상 조회 캐시 재사용');
  mode='regionfail';const grouped=await c.fetchDealGroups(['11440','11350']);
  ok(grouped.length===3 && grouped.queryIssues.length===3,'v320 한 지역 실패해도 다른 지역 거래 유지');
  mode='allfail';let failed=false;try{await c.fetchOne('11110')}catch{failed=true}
  ok(failed,'v320 모든 월 실패는 거래 없음이 아닌 오류');
  ok(html.includes('id="v320-query-status"') && html.includes("b.onclick=()=>{if(LASTVIEW?.price>0)renderDeals(LASTVIEW.price);}"),'v320 불완전 조회 안내·재시도 동작 연결');
}
// 26) 서버 API의 실제 Node 모듈 로딩. .mjs 검사는 계속 ESM으로 실행.
{
  const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
  for(const file of ['api/apt-price.js','api/apt-units.js']){
    let valid=false;try{valid=typeof require(path.join(ROOT,file))==='function'}catch{}
    ok(valid,'v320 '+file+' Node 로딩');
  }
}


// 27) v321 선택 실행: 실제 Chromium 렌더·동작. 의존성은 환경 경로로 제공(배포물에 포함하지 않음).

// v324 — 결과에 맞는 해설 글 하나(오너 결정 2026-11-09). 글 주소·제목이 실제 글과 맞고, 고르는 규칙이 의도대로인지.
{
  const src = html;
  ok(/<nav class="v305-reads v315-one read324" id="relatedRead"[^>]*hidden>/.test(src), 'v324 결과 관련 글 자리(처음엔 숨김)');
  ok(/renderLimits\(c, price\); renderRelated\(c\);/.test(src), 'v324 결과를 그릴 때마다 관련 글 갱신');
  const m = src.match(/const RELATED_READ=\{([\s\S]*?)\n\};/);
  ok(!!m, 'v324 RELATED_READ 표');
  const articles = read('articles.html');
  for (const [, slug, title] of (m ? m[1].matchAll(/'([a-z-]+)':'([^']+)'/g) : [])) {
    ok(exists(slug + '.html'), `v324 관련 글 ${slug} 파일 존재`);
    ok(articles.includes(`<a href="/${slug}"><strong>${title}</strong>`), `v324 관련 글 ${slug} 제목이 글 목록의 그 글 제목과 같음`, title);
  }
  const fn = src.match(/function relatedReadSlug\(c\)\{[\s\S]*?\n\}/);
  ok(!!fn, 'v324 relatedReadSlug 함수');
  if (fn) {
    const pick = (S, c) => new Function('S', 'c', fn[0] + '\nreturn relatedReadSlug(c);')(S, c);
    const S0 = { noLoan:false, houseStatus:'none', debtMonthly:0, debtParts:{credit:null,etc:null} };
    const L = { limits:{LTV:1, DSR:2} };
    const cases = [
      [{...S0, noLoan:true}, {...L, binding:'LTV'}, 'buying-costs'],
      [S0, {limits:{}, binding:'none'}, 'buying-costs'],
      [S0, {...L, binding:'구간한도'}, 'price-band-cap'],
      [S0, {...L, binding:'DSR'}, 'dsr-income-table'],
      [{...S0, debtMonthly:100}, {...L, binding:'DSR'}, 'existing-debt'],
      [{...S0, debtParts:{credit:3000,etc:null}}, {...L, binding:'DSR'}, 'existing-debt'],
      [{...S0, houseStatus:'multi'}, {...L, binding:'LTV', roomCut:5500}, 'switch-home'],
      [S0, {...L, binding:'LTV', roomCut:5500}, 'room-deduction'],
      [S0, {...L, binding:'LTV', roomCut:0}, 'loan-limit'],
      [S0, {...L, binding:'manual'}, 'loan-limit'],
    ];
    for (const [S, c, want] of cases) { const got = pick(S, c); ok(got === want, `v324 관련 글 고르기 ${c.binding}/${S.houseStatus}${S.noLoan?'/대출없음':''} → ${want}`, got); }
  }
}

// 26) v328 — 서울 25개 구 · 예상 집값 이하 실거래 건수(순수 함수). 실패는 0건이 아님 · 예산과 같은 값은 「이하」.
{
  const vm=await import('node:vm');
  const a=html.indexOf('var REACH_TILES'), b=html.indexOf('/* ── 화면', a);
  ok(a>0 && b>a, 'v328 순수 함수 구간(REACH_TILES … 화면 앞)');
  const c=vm.createContext({});
  vm.runInContext(html.slice(a,b)+';globalThis.__={REACH_TILES,reachStat,reachLevel,reachRank};',c);
  const {REACH_TILES:T,reachStat,reachLevel,reachRank}=c.__;
  const lawdLine=html.slice(html.indexOf("const LAWD = {"));const lawd=[...lawdLine.slice(lawdLine.indexOf("\"서울특별시\""),lawdLine.indexOf("]],")+2).matchAll(/\["(11\d{3})","([^"]+)"\]/g)];
  const names=new Map(lawd.map(m=>[m[1],m[2]]));
  ok(lawd.length===25 && T.length===25 && new Set(T.map(t=>t[0])).size===25 && T.every(t=>names.has(t[0]) && names.get(t[0]).startsWith(t[1])), 'v328 격자 25칸 — 코드가 지역 표의 서울 25개 구와 같고 칸 이름이 그 구 이름');
  ok(new Set(T.map(t=>t[2]+'/'+t[3])).size===25 && T.every(t=>t[2]>=1&&t[2]<=6&&t[3]>=1&&t[3]<=6), 'v328 격자 칸 자리 겹침 없음(6×6 안)');
  const m=(ymd,ok_,items,total)=>({ymd,ok:ok_,items,total});
  const it=(amountMan,y,mm,d)=>({name:'검증',amountMan,y,m:mm,d});
  const s1=reachStat([m(202611,true,[it(40000,2026,11,3),it(39705,2026,11,9),it(39706,2026,11,1)],3),m(202610,true,[it(30000,2026,10,2),it(0,2026,10,1)],2),m(202609,true,[],0)],39705);
  ok(s1.state==='ok' && s1.total===4 && s1.under===2 && s1.min===30000 && s1.near===2 && s1.nearMin===30000 && s1.nearMax===39705 && s1.underMax===39705, 'v328 건수 — 예산과 같은 값은 이하 · 1만원 높으면 초과 · 금액 0은 세지 않음', JSON.stringify(s1));
  ok(s1.recent.length===2 && s1.recent[0].amountMan===39705, 'v328 최근 이하 거래는 날짜 최신순');
  // v331 — 세는 범위 = 아래 끝(포함) ~ 예상 집값(포함). 「이하 전체」는 따로.
  const band=[m(202611,true,[it(33749,2026,11,1),it(33750,2026,11,2),it(39705,2026,11,3),it(39706,2026,11,4),it(10000,2026,11,5)],5)];
  const s1b=reachStat(band,39705,33750);
  ok(s1b.near===2 && s1b.under===4 && s1b.total===5 && s1b.nearMin===33750 && s1b.nearMax===39705 && s1b.recent.length===2 && s1b.recent.every(x=>x.amountMan>=33750&&x.amountMan<=39705), 'v331 범위 건수 — 아래 끝·예상 집값 둘 다 포함 · 1만원 밖은 제외 · 이하 전체는 따로', JSON.stringify(s1b));
  const lawdBand=/const DEAL = \{[^}]*band:0\.85,/.test(html) && /const lo = Math\.round\(priceMan \* DEAL\.band\);/.test(html) && /function loOf\(budgetMan\)\{ return budgetMan > 0 \? Math\.round\(budgetMan \* bandOf\(\)\) : 0; \}/.test(html);
  ok(lawdBand, 'v331 아래 끝 = 실거래 비교 카드와 같은 식(Math.round(예상 집값 × DEAL.band))');
  ok(s1b.min===10000 && s1b.minDeal && s1b.minDeal.amountMan===10000, 'v333 가장 낮은 거래 한 건을 함께 돌려줌');
  ok(/if\(f && f\.gap > 0\)\{/.test(html.slice(html.indexOf('<script id="v328-reach">'))), 'v333 부족액은 부족할 때만 적음(여유는 적지 않음)');
  const s2=reachStat([m(202611,false,[],null),m(202610,true,[it(20000,2026,10,2)],1200),m(202609,true,[],0)],39705);
  ok(s2.state==='partial' && s2.under===1 && s2.capped===true, 'v328 한 달 실패 → partial · 1,000건 초과 표시');
  const s3=reachStat([m(202611,false,[],null),m(202610,false,[],null),m(202609,false,[],null)],39705);
  ok(s3.state==='failed' && s3.under===0 && s3.total===0, 'v328 세 달 모두 실패 → failed(0건으로 읽지 않음)');
  ok(reachStat([m(202611,true,[it(10000,2026,11,1)],1)],null).under===0, 'v328 예상 집값이 없으면 이하로 세지 않음');
  ok([reachLevel(0,40),reachLevel(1,40),reachLevel(10,40),reachLevel(20,40),reachLevel(30,40),reachLevel(40,40),reachLevel(5,0)].join()==='0,1,2,3,4,4,0', 'v328 색 단계 0~4');
  const rk=reachRank([{i:0,st:{state:'failed',near:0,under:0,total:0}},{i:1,st:{state:'ok',near:3,under:90,total:10}},{i:2,st:{state:'ok',near:3,under:3,total:50}},{i:3,st:{state:'ok',near:9,under:9,total:5}}]).map(r=>r.i).join();
  ok(rk==='3,2,1,0', 'v331 순위 — 범위 건수 → 전체 건수 · 실패한 구는 맨 뒤', rk);
  // 원칙 잠금: 누를 때만 조회 · 금액을 주소에 싣지 않음 · 세대수 API를 25개 구에 부르지 않음
  const js=html.slice(html.indexOf('<script id="v328-reach">'), html.indexOf('</script>', html.indexOf('<script id="v328-reach">')));
  const urls=[...js.matchAll(/fetch\(([^)]*\))/g)].map(m=>m[1]);
  ok(urls.length===2 && urls.some(u=>u==="'/api/apt-reach?ymd=' + ymd)") && urls.some(u=>u==="'/api/apt-price?lawd=' + encodeURIComponent(code)"), 'v329 조회 주소는 ymd · lawd만(금액·소득 없음) — 묶음 1 · 구별 1', urls.join(' | '));
  ok(!/ykUnitsLoad|apt-units/.test(js), 'v328 세대수 API를 부르지 않음');
  ok(/track\('reach_scan', \{ hit: hit === 0 \? 'none'/.test(js) && !/track\([^)]*(budget|amount|price|won)/i.test(js), 'v328 사용 로그는 범주 라벨만');
  ok(/id="reach328"[^>]*hidden/.test(html) && html.indexOf('id="reach328"')>html.indexOf('id="fundingOverview"') && html.indexOf('id="reach328"')<html.indexOf('id="easyMarket"'), 'v328 카드 자리 — 처음엔 숨김 · (v346부터) 예산 카드 다음 · 실거래 카드 앞');   /* v346 옮김 — 옛 기대 「실거래 다음 · 월 상환액 앞」은 시안 C 순서로 바뀜(오너 2026-11-18) */
  ok(/if\(R\.status !== 'done' \|\| !visible\(\)\) return '';/.test(js) && !/reportHtml[\s\S]{0,1500}(scan\(|fetch\()/.test(js.slice(js.indexOf('function reportHtml'), js.indexOf('if(typeof renderReport'))), 'v332 저장 이미지 격자는 조회를 마친 뒤에만 · 이미지를 만들려고 조회하지 않음');
  /* v339 — 이 잠금은 saveImage 안을 보던 것을 공용 그리기 함수(ykCardCanvas)로 옮김(목적 그대로: 카드와 스타일만 베낌) */
  ok(/ignoreElements:function\(n\)\{ return n\.parentElement === document\.body && n !== keep && !\/\^\(STYLE\|LINK\)\$\/\.test\(n\.tagName\); \}/.test(html.slice(html.indexOf('function ykCardCanvas'))) && /const canvas=await ykCardCanvas\(\$\('reportCard'\),'full'\);/.test(html), 'v336 「이미지 저장」도 카드·스타일만 베껴 그림을 만듦(v339부터 ykCardCanvas 안)');
  ok(/track\('reach_save_done', \{ took: sec < 2 \? 'under2s'/.test(js), 'v336 저장에 걸린 시간은 구간 이름으로만 남김');
  // v329 — 묶음 응답 풀기: 실패한 구는 실패 그대로 · 달이 다르면 버림
  const {reachUnpack}=(vm.runInContext('globalThis.__2={reachUnpack}',c),c.__2);
  const un=reachUnpack({ok:true,ymd:202610,gu:{'11110':{ok:true,total:1,d:[[51000,84.9,3,'가','나',5,2010]]},'11350':{ok:false,reason:'gateway-22'}}},202610);
  ok(un && un['11110'].ok && un['11110'].items[0].amountMan===51000 && un['11110'].items[0].y===2026 && un['11110'].items[0].m===10 && un['11110'].items[0].d===3 && un['11350'].ok===false && un['11350'].items.length===0, 'v329 묶음 응답 풀기 — 연·월은 ymd에서 · 실패한 구는 ok:false', JSON.stringify(un));
  ok(reachUnpack({ok:true,ymd:202609,gu:{}},202610)===null && reachUnpack(null,202610)===null && reachUnpack({ymd:202610,gu:{}},202610)===null, 'v329 모양이 아니거나 달이 다른 응답은 버림');
}

// 27) v329 — api/apt-reach.js(서울 25개 구 묶음 조회)를 가짜 국토부 응답으로 직접 실행.
{
  const {createRequire}=await import('node:module');const req=createRequire(import.meta.url);
  ok(exists('api/apt-reach.js'), 'v329 api/apt-reach.js 있음');
  if(exists('api/apt-reach.js')){
    const keep={fetch:globalThis.fetch,key:process.env.MOLIT_API_KEY};
    let now=0,max=0,calls=[],bad='';
    process.env.MOLIT_API_KEY='test';
    globalThis.fetch=async u=>{const lawd=/LAWD_CD=(\d+)/.exec(u)[1];calls.push(lawd);now++;max=Math.max(max,now);await new Promise(r=>setTimeout(r,5));now--;
      if(lawd===bad)return {ok:true,text:async()=>'<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>22</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>'};
      return {ok:true,text:async()=>'<response><header><resultCode>000</resultCode></header><body><items><item><aptNm>검증'+lawd+'</aptNm><umdNm>검증동</umdNm><jibun>1</jibun><excluUseAr>84.93</excluUseAr><floor>7</floor><buildYear>2011</buildYear><dealAmount> 51,000</dealAmount><dealYear>2025</dealYear><dealMonth>3</dealMonth><dealDay>9</dealDay></item><item><aptNm>해제</aptNm><umdNm>검증동</umdNm><excluUseAr>59</excluUseAr><dealAmount>40,000</dealAmount><dealYear>2025</dealYear><dealMonth>3</dealMonth><dealDay>2</dealDay><cdealType>O</cdealType></item></items><totalCount>2</totalCount></body></response>'};};
    try{
      const h=req(path.join(ROOT,'api/apt-reach.js'));
      const run=async q=>{const r={h:{},setHeader(k,v){r.h[k]=v;return r},status(){return r},json(o){r.o=o;return r}};await h({query:q},r);return r;};
      const T2=[...html.slice(html.indexOf('var REACH_TILES')).matchAll(/\['(11\d{3})',/g)].slice(0,25).map(m=>m[1]).sort().join();
      ok(h.SEOUL.slice().sort().join()===T2 && h.SEOUL.length===25, 'v329 서버의 구 25개 = 화면 격자의 구 25개');
      bad='11350';const r1=await run({ymd:'202503'});
      ok(calls.length===25 && max<=h.POOL && h.POOL<=5, 'v329 국토부 동시 호출 '+h.POOL+'개 이하 · 25번', calls.length+' / 동시 '+max);
      ok(r1.o.ok===true && r1.o.ymd===202503 && r1.o.failed===1 && r1.o.gu['11350'].ok===false && r1.o.gu['11350'].reason==='gateway-22' && !('d' in r1.o.gu['11350']), 'v329 실패한 구는 ok:false · 이유(빈 성공 아님)', JSON.stringify(r1.o.gu['11350']));
      ok(JSON.stringify(r1.o.gu['11110'])==='{"ok":true,"total":2,"d":[[51000,84.9,9,"검증11110","검증동",7,2011]]}', 'v329 거래 한 건 = [금액,전용㎡,일,단지,동,층,건축년도] · 해제 거래 제외', JSON.stringify(r1.o.gu['11110']));
      ok(r1.h['Cache-Control']==='no-store', 'v329 하나라도 실패하면 캐시 안 함');
      bad='';calls=[];const r2=await run({ymd:'202503'});
      ok(calls.join()==='11350' && r2.o.failed===0 && /^public, s-maxage=21600, stale-while-revalidate=86400$/.test(r2.h['Cache-Control']), 'v329 다시 부르면 실패한 구만 국토부로 · 모두 성공이면 지난 달 6시간 캐시', calls.join()+' '+r2.h['Cache-Control']);
      const d=new Date(),cur=String(d.getFullYear()*100+d.getMonth()+1);const r3=await run({ymd:cur});
      ok(/s-maxage=1800,/.test(r3.h['Cache-Control']), 'v329 이번 달은 30분 캐시');
      const r4=await run({ymd:'2025'}),r5=await run({ymd:'202513',price:'90000'});
      ok(r4.o.ok===false && r4.o.reason==='bad-param' && r5.o.reason==='bad-param' && r4.h['Cache-Control']==='no-store', 'v329 잘못된 ymd는 bad-param');
      const src=read('api/apt-reach.js');
      ok(!/req\.query\.(?!ymd\b)/.test(src.replace(/req\.query &&/g,'')) && /require\('\.\/apt-price\.js'\)/.test(src) && !/apis\.data\.go\.kr/.test(src), 'v329 받는 값은 ymd 하나 · 조회·해석은 apt-price.js 재사용');
    }finally{globalThis.fetch=keep.fetch;if(keep.key===undefined)delete process.env.MOLIT_API_KEY;else process.env.MOLIT_API_KEY=keep.key;}
  }
}

// 28) v330 — 서울 자치구를 목록 하나에서 최대 3곳(기준 1 + 비교 2). 순수 함수.
{
  const vm=await import('node:vm');
  const a=html.indexOf('function pick330Next'), b=html.indexOf('/* ── 화면', a);
  ok(a>0 && b>a, 'v330 순수 함수 구간(pick330Next … 화면 앞)');
  const c=vm.createContext({});
  vm.runInContext(html.slice(a,b)+';globalThis.__={pick330Next};',c);
  const nx=(s,code)=>{const r=c.__.pick330Next(s,code);return r.base+'|'+r.cmp.join(',')+'|'+r.full;};
  ok(nx({base:'',cmp:[]},'A')==='A||false', 'v330 처음 누른 구 = 계산 기준');
  ok(nx({base:'A',cmp:[]},'B')==='A|B|false' && nx({base:'A',cmp:['B']},'C')==='A|B,C|false', 'v330 다음 두 곳 = 비교(누른 순서)');
  ok(nx({base:'A',cmp:['B','C']},'D')==='A|B,C|true', 'v330 네 번째는 안 들어감(상태 그대로 · full)');
  ok(nx({base:'A',cmp:['B','C']},'B')==='A|C|false', 'v330 비교 구를 다시 누르면 해제');
  ok(nx({base:'A',cmp:['B','C']},'A')==='B|C|false' && nx({base:'A',cmp:[]},'A')==='||false', 'v330 기준을 다시 누르면 해제 — 먼저 고른 비교가 기준으로');
  const js=html.slice(html.indexOf('<script id="v330-pick">'));
  ok(/if\(S\.group !== 'seoul'\)\{ if\(S\.sgg\) CMP_OPEN = true; return basePane\(\); \}/.test(js), 'v330 서울 밖은 기존 화면 그대로(비교 목록만 펼쳐 둠)');
}

// 29) v338 — 지도 탭 구·동 알약(정적): 단지 보기는 범위 안 거래의 중앙값 · 범위 안 거래가 없으면 알약을 내지 않음.
{
  ok(/const inMap = new Map\(\);\s+mapDeals\(\)\.forEach/.test(html) && /inCount: shown\.length, inPrice: shown\.length \? median\(shown\) : 0/.test(html), 'v338 묶음마다 범위 안 거래(mapDeals)의 건수·중앙값을 계산');
  ok(/const p = onDeal\(\) && group\.inCount \? group\.inPrice : group\.price/.test(html) && /if \(onDeal\(\) && !group\.inCount\) button\.hidden = true;/.test(html), 'v338 단지 보기 = inPrice · 범위 안 거래 0건이면 숨김 · 동네 시세 = price');
}

// 30) v339 — 저장 그림: 배율 2.5 · 두 버튼 모두 ykCardCanvas · 가짜 그림 도구일 땐 미리 만들지 않음.
{
  const saveSrc=html.slice(html.indexOf('async function saveImage(){'),html.indexOf('async function saveImage(){')+2600);
  ok(/const canvas=await ykCardCanvas\(\$\('reportCard'\),'full'\);/.test(saveSrc) && !/html2canvas\(\$\('reportCard'\)/.test(saveSrc), 'v339 「이미지 저장」은 ykCardCanvas 로 그림');
  const r339=html.slice(html.indexOf('<script id="v339-render">'));
  ok(/var YK339 = \{ chain: Promise\.resolve\(\), cache: \[\], scale: 2\.5 \};/.test(r339) && /c\.fn === fn && c\.sig === sig/.test(r339), 'v339 배율 2.5 · 같은 그림 도구·같은 카드일 때만 다시 씀');
  ok(/window\.html2canvas !== window\.__ykH2C\) return;/.test(r339) && /navigator\.connection\.saveData\) return;/.test(r339), 'v339 가짜 그림 도구·데이터 절약 모드면 미리 만들지 않음');
  const rj=html.slice(html.indexOf('<script id="v328-reach">'),html.indexOf('</script>',html.indexOf('<script id="v328-reach">')));
  ok(/ykCardCanvas\(card, 'map'\)/.test(rj) && !/scale:3/.test(rj), 'v339 「이 지도를 이미지로 저장」도 ykCardCanvas(배율 3 없음)');
}

// 31) v340 — 홈 「내 예산과 실거래 비교」에 작은 지도를 그리지 않음(지도 탭과 겹침) · 결과 카드 제목·여백·간격 하나로.
{
  ok(/function mapWanted\(\)\{\s*\/\*[^]*?\*\/\s*return false;\s*\}/.test(html), 'v340 홈 작은 지도 끔(mapWanted → false)');
  const c340=html.slice(html.indexOf('<style id="v340-cards">'),html.indexOf('</style>',html.indexOf('<style id="v340-cards">')));
  ok(c340.length>0 && /#app #result #viewAnswer\{row-gap:12px!important\}/.test(c340) && /:is\(#easyMarket,#reach328,#payTile\)\{padding:16px!important\}/.test(c340) && /font-size:16px!important;font-weight:700!important/.test(c340), 'v340 카드 사이 12px · 안쪽 16px · 제목 16px/700');
}

// 32) v341 — 맨 아래 묶음: 관련 글 · 외부 사이트 · 계산 기준 안내 · 다시 계산을 카드 「더 알아보기」 한 장으로(옮기기만, 새로 만들지 않음).
{
  const m341=html.slice(html.indexOf('<script id="v341-more">'),html.indexOf('</script>',html.indexOf('<script id="v341-more">')));
  ok(m341.length>0 && /getElementById\('relatedRead'\), next\.querySelector\('\.external-links'\), next\.querySelector\('\.result-notes321'\), document\.getElementById\('restartWrap'\)/.test(m341) && /list\.appendChild\(e\)/.test(m341) && !/cloneNode|outerHTML/.test(m341), 'v341 네 요소를 옮기기만 함(복제·새로 쓰기 없음)');
  const r341=html.slice(html.indexOf('<script id="v339-render">'),html.indexOf('</script>',html.indexOf('<script id="v339-render">')));
  ok(/var timer = 0, want = \[\];/.test(r341) && /if\(want\.indexOf\(mode\) < 0\) want\.push\(mode\);/.test(r341) && /if\(loading\) return loading;/.test(r341) && /return ensureHtml2canvas\(\)\.then/.test(r341), 'v341 미리 만들기: 두 버튼이 같이 보이면 둘 다 · 그림 도구는 한 번만 불러옴 · 차례로 만듦');
  ok(/id="v341-more">[^]*?#more341\{margin:12px 0 0!important;[^}]*border-radius:20px!important\}/.test(html) && /#viewNext>\.easy-next-card\{margin:12px 0 0!important/.test(html), 'v341 카드 모양(모서리 20px) · 안내문은 카드 밖');
}

// 33) v342 — 홈 요약 = 지도 탭 머리와 같은 셈(distributionModel · 같은 예상 집값 · 같은 필터) · 목록 「곳」에 가격 범위 · 안내문 첫 문장 들여쓰기 없음.
{
  const s342=html.slice(html.indexOf('<script id="v342-summary">'),html.indexOf('</script>',html.indexOf('<script id="v342-summary">')));
  ok(s342.length>0 && /distributionModel\(DEAL\.items \|\| \[\], budget, typeof DEAL\.pass === 'function' \? DEAL\.pass : null\)/.test(s342) && /Math\.floor\(LASTVIEW\.price \/ 10000\)/.test(s342) && /Math\.floor\(m\.under \/ m\.n \* 100\)/.test(s342), 'v342 홈 요약은 지도 탭과 같은 함수·예상 집값·버림으로 셈');
  ok(/addEventListener\('deals:ready', sum342\)/.test(s342) && /paintDeals = function\(\)\{ var r = pd\.apply\(this, arguments\); sum342\(\); return r; \}/.test(s342) && /DEAL\.status !== 'ready'/.test(s342), 'v342 원래 문구(불러오는 중·실패·일부 조회) 뒤에 덧씀 · 준비됐을 때만');
  ok(/lead\.textContent = `예상 집값 \$\{Math\.round\(DEAL\.band\*100\)\}~\$\{Math\.round\(\(DEAL\.over \? DEAL\.overBand : 1\)\*100\)\}% 단지 \$\{total\}곳`/.test(html), 'v342 목록 머리줄에 「예상 집값 85~100% 단지」');
  ok(/#viewNext>\.easy-next-card>\.nx-lead\{padding-left:0!important;text-indent:0!important\}/.test(html), 'v342 안내문 첫 문장 내어쓰기 없앰');
}

// 34) v343 — 첫 카드: 현금·대출 칸 상자 없앰(누르는 「포함된 부대비용」만 상자) · 320px 점이 혼자 한 줄 안 됨 · 금액 단위 글자를 총 필요 금액과 같은 크기로.
{
  const c343=html.slice(html.indexOf('<style id="v343-funding">'),html.indexOf('</style>',html.indexOf('<style id="v343-funding">')));
  const s343=html.slice(html.indexOf('<script id="v343-funding">'),html.indexOf('</script>',html.indexOf('<script id="v343-funding">')));
  ok(c343.length>0 && /\.rlab>div\+div\{background:none!important;border:0!important;border-radius:0!important;padding:0!important/.test(c343) && /:not\(\.cash-only\) \.rlab>div\+div\{border-left:1px solid/.test(c343), 'v343 현금·대출 칸은 상자 없이 가운데 세로선');
  ok(/\.rlab \.t\{display:flex!important;flex-direction:row!important;flex-wrap:wrap!important/.test(c343) && /\.rlab \.n\{margin-top:auto!important/.test(c343), 'v343 이름 줄은 가로(점과 이름 한 줄) · 두 금액은 같은 높이');
  ok(/\.rlab \.n i\.u\{[^}]*font-size:var\(--t7\)!important/.test(c343) && /\['easyCash','easyLoan'\]/.test(s343) && /new MutationObserver/.test(s343) && /el\.querySelector\('i\.u'\)\) return/.test(s343), 'v343 금액 단위 글자 감싸기 · 바뀔 때마다 · 되풀이 없음');
}

// 35) v344 — 서울 25개 구 카드를 시안 C 모양으로: 누르기 전 이름만 있는 격자 · 고른 구 거래는 옆으로 넘기는 카드 + 「예상 집값보다 N」(실거래 목록과 같은 함수).
{
  const s344=html.slice(html.indexOf('<script id="v344-reach">'),html.indexOf('</script>',html.indexOf('<script id="v344-reach">')));
  ok(s344.length>0 && /REACH_TILES\.map/.test(s344) && /setAttribute\('aria-hidden', 'true'\)/.test(s344) && /pv\.hidden = !body\.hidden/.test(s344) && /if\(!go\.disabled && !go\.hidden\) go\.click\(\)/.test(s344), 'v344 미리보기 격자 — REACH_TILES 배치 · 읽기 도구에 숨김 · 조회 뒤 숨김 · 누르면 조회 버튼과 같음');
  ok(/dealBudgetGapHtml\(Number\(li\.getAttribute\('data-man'\)\), null, code\)/.test(s344) && (html.match(/<li data-man="' \+ Number\(/g)||[]).length===2, 'v344 거래 카드 「예상 집값보다 N」은 실거래 목록과 같은 dealBudgetGapHtml · 금액은 data-man');
}

// 36) v345 — 25개 구 카드 정리 + 구를 누르면 그 구 둘러보기(내 조건 그대로).
{
  const s345=html.slice(html.indexOf('<script id="v345-browse">'),html.indexOf('</script>',html.indexOf('<script id="v345-browse">')));
  ok(s345.length>0 && /if\(window\.YK_BROWSE\)\{ DEAL\.wide = false; return fetchDealGroups\(\[window\.YK_BROWSE\]\); \}/.test(s345) && /return ofd\.apply\(this, arguments\)/.test(s345), 'v345 둘러보기 중에는 그 구만 조회(fetchDealGroups — 구 단위 캐시) · 아니면 원래대로');
  ok(/if\(view\.hidden\) leave\(true\)/.test(s345) && /showResult = function\(\)\{ if\(window\.YK_BROWSE\)/.test(s345) && /track\('reach_browse', \{\}\)/.test(s345), 'v345 실거래 탭을 떠나거나 다시 계산하면 둘러보기 끝 · 사용 로그는 범주만');
}

// 37) v346 — 홈 순서: 예산 → 서울 25개 구 → 내 예산과 실거래 → 월 상환액(마크업 순서 · PC는 v345 배치 그대로).
{
  const iF=html.indexOf('id="fundingOverview"'), iR=html.indexOf('<section class="reach328" id="reach328"'), iM=html.indexOf('<section class="plot" id="easyMarket"'), iP=html.indexOf('<div class="paywrap" id="payTile">');
  ok(iF>0 && iF<iR && iR<iM && iM<iP, 'v346 마크업 순서 — 예산 → 25개 구 → 실거래 비교 → 월 상환액');
}

// 38) v347 — 내 매수 지역 칸은 둘러보기 없이(아이폰 캡처 「성동구 둘러보는 중 · 성동구로 돌아가기」).
ok(/if\(t\.classList\.contains\('is-mine'\)\)\{[^]*?leave\(true\);[^]*?yk208Navigate\('map'\)/.test(html) && /#browse345 \.reach328-nb\{white-space:nowrap\}/.test(html), 'v347 내 지역 칸은 평소 실거래로 · 둘러보기 머리 범위 줄바꿈 막음');

// 39) v348 — 홈에서 같은 말 두 번 빼기(「인근 지역 포함」 요약 + 「넓혔어요」 안내). 실거래 탭 안내(#dealScopeNote)는 손대지 않음.
{
  const s348=html.slice(html.indexOf('<script id="v348-scope">'),html.indexOf('</script>',html.indexOf('<script id="v348-scope">')));
  ok(s348.length>0 && /getElementById\('resultScopeNote'\)/.test(s348) && !/dealScopeNote/.test(s348.replace(/\/\*[^]*?\*\//g,'')) && /if\(redundant\(\) && !note\.hidden\) note\.hidden = true/.test(s348), 'v348 홈 안내만 감춤 · 실거래 탭 안내는 그대로 · 되풀이 없음');
}

// 40) v349 — 실거래 목록 머리 「단지 N곳 중 M곳」 → 「단지 N곳」(아래 「단지 더 보기 · K곳 남음」과 같은 사실). 더 보기 문구는 그대로.
ok(/lead\.textContent = `예상 집값 \$\{Math\.round\(DEAL\.band\*100\)\}~\$\{Math\.round\(\(DEAL\.over \? DEAL\.overBand : 1\)\*100\)\}% 단지 \$\{total\}곳`;/.test(html) && !/` 중 \$\{shown\}곳`/.test(html) && /more\.textContent='단지 더 보기 · '\+\(rows\.length-shownRows\.length\)\+'곳 남음'/.test(html), 'v349 목록 머리는 범위 안 단지 수만 · 남은 수는 「단지 더 보기」가 말함');

// 41) v350 — 지도 SDK는 실거래 화면이 열릴 때만(페이지 열자마자 부르던 loadSdk() 없음).
ok(!/navermap_authFailure[^]*?\};\n  loadSdk\(\);\n\}\)\(\);/.test(html) && /const loadOnce = \(\) => \{ if \(sdkAsked \|\| !key\) return; sdkAsked = true; loadSdk\(\); \};/.test(html) && /if \(!dealsView\.hidden\) loadOnce\(\)/.test(html) && /window\.__ykMapWant&&window\.__ykMapWant\(\)\)announce\('지도를 불러오고 있어요\.'\)/.test(html), 'v350 지도 SDK 늦게 받기 — 실거래 화면 · 누르는 순간 · 지도 탭 기다림');

// 42) v351 — 머리의 html2canvas CDN 줄 없음(첫 로딩 가볍게 · v339 미리 만들기가 「직접 부른 도구」로 동작). 필요할 때 ensureHtml2canvas → /vendor.
ok(!/<script[^>]+html2canvas[^>]*><\/script>/.test(html) && /return load\('\/vendor\/html2canvas\.min\.js'\)/.test(html), 'v351 첫 로딩에 그림 도구 없음 · 필요할 때 자체 사본');

// 43) v352 — 첫 화면 한 장: 큰 제목 하나 · 문장 하나 · 시작 버튼 하나(두 번째 제목·설명, 기능 소개 2칸 없음).
{
  const w = html.slice(html.indexOf('<section id="welcome232"'), html.indexOf('</section>', html.indexOf('<section id="welcome232"')));
  ok(w.length > 0 && !/welcome232-(next|features)/.test(w) && !/<h2\b/.test(w) && (w.match(/<h1\b/g)||[]).length===1 && w.includes('id="welcomeStart232"') && w.includes('실거래') && w.includes('href="/articles"'),
     'v352 첫 화면 — 제목 1 · 버튼 1 · 기능 소개 칸 없음 · 글 링크 유지');
}

// 44) v353 — 첫 입력 2단계(감싸서 이음) · 숫자 칸은 키보드 「다음」에서만 넘김(입력 도중 시간으로 넘기지 않음).
{
  const s353 = (html.match(/<script id="v353-steps">[\s\S]*?<\/script>/) || [])[0] || '';
  ok(s353.length > 0 && /renderAnswered=function\(\)\{ var r=origRender\.apply/.test(s353) && /syncCta=function\(\)\{ var r=origSync\.apply/.test(s353)
     && /#crows\[data-stage353="1"\]>\.s353-b\{display:none!important\}/.test(html) && /\}, true\);/.test(s353)
     && !/addEventListener\('input'/.test(s353) && !/\.click\(\);\s*\}\s*,\s*[1-9]\d{3,}/.test(s353),
     'v353 2단계 — renderAnswered·syncCta 감쌈 · 숫자 칸 입력 이벤트로 넘기지 않음');
}

// 45) v354 — 결과 홈 나누기: 25개 구 카드는 실거래 탭으로(마크업은 그대로 · 실행할 때 옮김) · 탭 이름 「실거래」 · 홈 실거래 비교는 한 줄(대표 거래 감춤).
{
  const s354 = (html.match(/<script id="v354-split">[\s\S]*?<\/script>/) || [])[0] || '';
  ok(/if\(head\) head\.after\(reach\)/.test(s354) && /tab\.textContent='실거래'/.test(s354) && /#viewAnswer>#easyMarket #heroDeals\{display:none!important\}/.test(html)
     && /#viewDeals>#reach328\{margin:0 0 16px;padding:16px;/.test(html) && !/fetch\(/.test(s354),
     'v354 홈 나누기 — 25개 구 카드 실거래 탭으로 · 탭 이름 · 홈 대표 거래 감춤 · 조회 추가 없음');
}

// 46) v355 — 숫자 칸 「다음」 버튼(아이폰 숫자 키패드에 「다음」·Enter 가 없음): 터치 화면에서만 · 누르는 동안 입력 칸 포커스 유지 · 시간으로 넘기지 않음.
{
  const s355 = (html.match(/<script id="v355-kbnext">[\s\S]*?<\/script>/) || [])[0] || '';
  ok(/matchMedia\('\(pointer: coarse\)'\)/.test(s355) && /btn\.addEventListener\('pointerdown', function\(e\)\{ e\.preventDefault\(\); \}\)/.test(s355) && /visualViewport/.test(s355)
     && !/setInterval|addEventListener\('input', function\(e\)\{[^}]*focus\(/.test(s355),
     'v355 숫자 칸 「다음」 버튼 — 터치 화면만 · 포커스 유지 · 키보드 따라 올라감 · 입력 중 자동 이동 없음');
}

// 47) v369 — 홈 머리 「월 상환액 N · 세전 소득의 N%」 줄(v356) 뺌: 바로 아래 ③ 카드와 같은 숫자 두 번(오너 2026-11-20 「어수선」 → 같은 숫자는 한 곳).
ok(!/id="v356-hero-monthly"/.test(html) && !/heroMonthly356/.test(html), 'v369 머리 월 상환액 줄 없음(③ 카드에만)');

// 48) v357 — 실거래 탭 [내 지역 | 서울 25개 구]: 「서울 25개 구」를 누를 때만 조회(조회 버튼을 대신 누름 · 새 조회 경로 없음).
{
  const s357 = (html.match(/<script id="v357-deal-seg">[\s\S]*?<\/script>/) || [])[0] || '';
  ok(/if\(go && !go\.hidden && !go\.disabled\) go\.click\(\);/.test(s357) && !/fetch\(|apt-reach|apt-price/.test(s357) && /seg\.hidden=!!reach\.hidden/.test(s357),
     'v357 전환 — 누를 때만 조회(#reach328Go 대신 누름) · 조회 코드 없음 · 25개 구 카드가 숨으면 숨김');
}

// 49) v358 — 홈 자금 흐름 그림: 그려진 값만 옮김(계산 · 정책값 없음) · 옛 덩어리(총 필요 금액 줄 · 현금/대출 막대)는 감춤.
{
  const s358 = (html.match(/<script id="v358-flow">[\s\S]*?<\/script>/) || [])[0] || '';
  ok(/'easyCash','easyLoan','easyCashPct','easyLoanPct','heroAmount','easyPrice','easyCost'/.test(s358) && !/monthlyPaymentCalc|computeLoan|solveMaxPrice|LASTVIEW|POLICY|DSR_RATIO/.test(s358)
     && /#fundingOverview \.budget-summary,html body\.yk208 #app #easyBalance>\.ratio\{display:none!important\}/.test(html) && /\$\('easyCostOpen'\); if\(b\) b\.click\(\);/.test(s358),
     'v358 자금 흐름 — 화면 값만 옮김 · 계산 함수 · 정책값 없음 · 부대비용은 원래 버튼으로');
}

// 50) v359 — 글자 · 여백: :root 스케일 변수만 씀(15px · 18px 같은 스케일 밖 값 없음) · 320px 도움말 10px 규칙을 덮음.
{
  const c359 = (html.match(/<style id="v359-type">[\s\S]*?<\/style>/) || [])[0] || '';
  const raw = (c359.replace(/\/\*[\s\S]*?\*\//g,'').match(/font-size:\s*(\d+)px/g) || []).map(x=>+x.match(/\d+/)[0]);
  ok(c359.length>0 && /--t6/.test(c359) && raw.every(n=>n===16) && /@media\(max-width:360px\)\{[^}]*inline-help\{font-size:var\(--t7\)!important\}/.test(c359),
     'v359 글자 — 스케일 변수만(SVG 막대 숫자 16 단위 하나만 예외 — 화면 약 13.6px) · 320px 도움말도 13px', JSON.stringify(raw));
}

// 51) v360 — 카드 속 카드 한 겹(비교표 · 거래 상세 「거래가 흐름」) · 비교 글자 13px 이상 · 비교 금액 한 줄(v259 두 줄 규칙을 풂).
{
  const c360 = (html.match(/<style id="v360-one-layer">[\s\S]*?<\/style>/) || [])[0] || '';
  ok(/\.v253-compare-scroll>table\{border:0!important/.test(c360) && /\.dealbox \.trend,[^{]*\{border:0!important;border-top:1px solid var\(--yk-line\)!important;border-radius:0!important/.test(c360)
     && /\[data-cols\] tr\.cmp-hero td>\.cmp-money234 \.cmp-money-part234\{display:inline-block!important\}/.test(c360) && /:is\(#viewCompare,#viewDeals\) :is\(\.tr-legend span/.test(c360),
     'v360 한 겹 — 비교표 · 거래가 흐름 테두리 하나 · 비교 금액 한 줄 · 거래가 흐름 그래프 글자(비교 · 거래 상세 공통)');
}

// 52) v361 — 넓은 화면(960px 이상)만: 홈 「더 알아보기」 오른쪽 칸 · 실거래 목록 2열 · 전환 버튼 최대 폭. 매수 지역 시트 여백은 v330 때문에 그대로.
{
  const c361 = (html.match(/<style id="v361-wide-balance">[\s\S]*?<\/style>/) || [])[0] || '';
  ok(/@media\(min-width:960px\)\{/.test(c361) && /#viewAnswer>#viewNext\{grid-column:2!important;grid-row:4!important/.test(c361) && /#dealList\{display:grid!important;grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/.test(c361) && !/#qSheet#qSheet/.test(c361.replace(/\/\*[\s\S]*?\*\//g,'')),
     'v361 넓은 화면 균형 — 960px 이상만 · 매수 지역 시트 여백 그대로');
}

// 53) v362 — 그림은 화면 숫자로 식이 맞을 때만(대출 한도 · 현금 여유) · 숫자를 새로 계산하지 않음.
{
  const s362 = (html.match(/<script id="v362-figures">[\s\S]*?<\/script>/) || [])[0] || '';
  ok(/B-R!==A\) return;/.test(s362) && /sum!==total\) return;/.test(s362) && !/calcCosts|dealAfford\(|monthlyPaymentCalc|POLICY|LASTVIEW/.test(s362),
     'v362 그림 — 식이 맞을 때만 그림 · 계산 함수 · 정책값 안 씀');
}

// 54) v363 — 홈 ④ 미니 분포는 실거래 분포를 복제(새 그림 · 새 계산 없음).
{
  const s363 = (html.match(/<script id="v363-mini-dist">[\s\S]*?<\/script>/) || [])[0] || '';
  ok(/strip\.cloneNode\(true\)/.test(s363) && /aria-hidden','true'/.test(s363) && !/distributionModel|calcCosts|POLICY|LASTVIEW|<circle/.test(s363),
     'v363 미니 분포 — 실거래 분포 복제 · 꾸밈(낭독 제외) · 새 계산 없음');
}

// 55) v364 — 360px 이하에서만 25개 구 지도 위치를 풀어 5열.
{
  const c364 = (html.match(/<style id="v364-reach-narrow">[\s\S]*?<\/style>/) || [])[0] || '';
  ok(/@media\(max-width:360px\)\{/.test(c364) && /repeat\(5,minmax\(0,1fr\)\)!important/.test(c364) && /grid-column:auto!important;grid-row:auto!important/.test(c364),
     'v364 25개 구 — 360px 이하만 5열(지도 위치 풂)');
}

// 56) v365 — 시트: 매수 지역 버튼 줄 바깥 폭 = 시트 여백(18px) · 「기준/비교」 꼬리표는 칸 위 배지(칸 크기 그대로) · 부대비용 금액 상자 누르면 입력칸.
{
  const c365 = (html.match(/<style id="v365-sheets">[\s\S]*?<\/style>/) || [])[0] || '';
  const s365 = (html.match(/<script id="v365-sheets">[\s\S]*?<\/script>/) || [])[0] || '';
  ok(/:has\(#regionSearchInput\) \.sheet-actions\{margin-left:-18px!important;margin-right:-18px!important\}/.test(c365) && /\.tag330\{position:absolute;top:-9px/.test(c365) && /closest\('\.costrow \.amt'\)/.test(s365),
     'v365 시트 — 매수 지역 버튼 줄 · 꼬리표 배지 · 부대비용 금액 상자');
}

// 57) v366 — 실거래 머리 표: 앱이 쓰는 값만(dealBudgetFor · #dealBudget) · 값이 하나라도 없으면 원래 문장.
{
  const s366 = (html.match(/<script id="v366-deal-head">[\s\S]*?<\/script>/) || [])[0] || '';
  ok(/dealBudgetFor\(x\.lawd\)/.test(s366) && /getElementById\('dealBudget'\)/.test(s366) && /if\(!okAll \|\| !rows\.length\) return;/.test(s366) && !/solveMaxPrice|POLICY|LASTVIEW/.test(s366),
     'v366 실거래 머리 표 — 앱이 쓰는 값만 · 값이 없으면 원래 문장');
}
// 58) v367 — 키보드 「다음」 줄에 숫자 칸이 가리지 않게: 키보드(visualViewport) 높이 · 「다음」 줄 높이 · 상단 바 높이를 재서 칸 묶음 전체를 보이게.
{
  const s367 = (html.match(/<script id="v367-kb-reveal">[\s\S]*?<\/script>/) || [])[0] || '';
  ok(/visualViewport/.test(s367) && /getElementById\('kbNext355'\)/.test(s367) && /closest\('\.inline-money'\)/.test(s367) && /barH/.test(s367) && /main-income/.test(s367) && !/scrollIntoView\(\)/.test(s367),
     'v367 숫자 칸 묶음(이름 · 칸 · 읽기 · 도움말)을 키보드 + 「다음」 줄 위로 올림(visualViewport 기준)');
}
// 59) v369 — 모양 줄이기: 카드 머리 한 규칙 · 실거래 탭 점 그림 감춤(홈 ④로) · 입력 2단계 요약 줄 대신 「내 조건」과 같은 두 줄 · 숫자 칸 한 줄.
{
  const c369 = (html.match(/<style id="v369-smooth">[\s\S]*?<\/style>/) || [])[0] || '';
  ok(/#dealDistribution>\.dd-strip/.test(c369) && /#stepSum353\{display:none!important\}/.test(c369) && /\.s353-a\.crow\{display:flex!important\}/.test(c369)
     && /\.inline-money\{grid-template-columns:minmax\(0,1fr\) 136px!important/.test(c369) && /\.f-step,#payTile>\.ans-k,#easyMarket>\.m358,#more341>h2/.test(c369)
     && !/font-size:(15|18)px|\.5px/.test(c369),
     'v369 규칙 — 카드 머리 한 모양 · 실거래 탭 점 그림 감춤 · 입력 요약 줄 대신 두 줄 · 숫자 칸 한 줄 · 스케일 밖 글자 없음');
}
// 60) v370 — 「다음」 줄 자리를 창 스크롤에도 다시 셈 · 맞춤 전에 줄 자리부터 · 숫자 칸 폭 · 7자리 글자 · 탭 막대 감춤
{
  const s355 = (html.match(/<script id="v355-kbnext">[\s\S]*?<\/script>/) || [])[0] || '';
  const s367 = (html.match(/<script id="v367-kb-reveal">[\s\S]*?<\/script>/) || [])[0] || '';
  const c370 = (html.match(/<style id="v370-money-field">[\s\S]*?<\/style>/) || [])[0] || '';
  ok(/window\.addEventListener\('scroll', place/.test(s355) && /__yk355\.place\(\)/.test(s367) && /kbPad370/.test(s367) && /160px!important/.test(c370) && /#kbNext355:not\(\[hidden\]\)\) #v208Nav\{display:none!important\}/.test(c370),
     'v370 「다음」 줄 자리 다시 셈(창 스크롤) · 숫자 칸 160px · 탭 막대 감춤 · 아래 여유 칸');
}
// 61) v372 — 「더 알아보기」 안 줄 모양 한 벌(오른쪽 표시 · 펼친 내용 왼쪽 · 펼친 아래 여백)
{
  const c372 = (html.match(/<style id="v372-more-rows">[\s\S]*?<\/style>/) || [])[0] || '';
  const s372 = (html.match(/<script id="v372-more-rows">[\s\S]*?<\/script>/) || [])[0] || '';
  ok(/\.external-links>a\.mini\{padding:0!important;border-top:0!important\}/.test(c372) && /#restartBtn::after\{content:''!important/.test(c372) && /\.arw\{[^}]*font-size:0!important[^}]*data:image\/svg\+xml/.test(c372)
     && /aria-hidden', 'true'/.test(s372) && !/\.5px|font-size:(?!0!)\d/.test(c372),
     'v372 규칙 — 외부 링크 들여쓰기 · 줄 선 뺌 · 「↗」 글자 → 그림(읽기 도구 감춤) · 다시 계산 줄 끝 표시 · 0.5px · 새 글자 크기 없음');
}
// 62) v373 — 「✓」(U+2713) 글자 → 그림: 실거래 지역 칩 · 입력 시트 지역 칩 · 「기존 대출 없음」 꼬리표
{
  const c373 = (html.match(/<style id="v373-check">[\s\S]*?<\/style>/) || [])[0] || '';
  const tail = html.slice(html.indexOf('<style id="v373-check">'));
  ok(/\.deal-region-chips \.chip\.is-on::before,[^{]*\.input-region-grid \.chip\.is-on::before\{content:''!important/.test(c373) && /margin:0 4px 0 0!important/.test(c373) && /mask:url\("data:image\/svg\+xml/.test(c373)
     && /\.debt-none\.is-on::after\{content:'선택됨'!important/.test(c373) && !/✓/.test(tail.replace(/\/\*[\s\S]*?\*\//g,'')) && !/\.5px/.test(c373),
     'v373 규칙 — 「✓」 세 자리 그림(칩 14px · 4px 띄움 · 꼬리표 「선택됨」) · 블록 안에 「✓」 글자 없음');
}
// 63) v374 — 빼기 기호 「−」(U+2212) 조각 「YK Minus」: 계산기 + 안내 페이지 15개에 같은 @font-face · Pretendard 앞 · 글꼴 파일 · OFL 문서
{
  const FACE374 = "@font-face{font-family:'YK Minus';font-style:normal;font-display:swap;font-weight:45 920;src:url(fonts/pretendard/YKMinus.woff2) format('woff2-variations'),url(fonts/pretendard/YKMinus.woff2) format('woff2');unicode-range:U+2212}";
  const pages374 = 'about articles budget-examples buying-costs couple-income dsr-income-table existing-debt guide loan-limit price-band-cap privacy rate-type regulated-area room-deduction switch-home'.split(' ');
  const blk = t => (t.match(/<style id="v374-minus">[\s\S]*?<\/style>/) || [])[0] || '';
  const bad374 = pages374.filter(pg => { const b = blk(fs.readFileSync(path.join(ROOT, pg + '.html'), 'utf8')); return !b.includes(FACE374) || !/html body\{font-family:'YK Minus','Pretendard Variable',/.test(b); });
  const ib = blk(html);
  const woff = fs.existsSync(path.join(ROOT, 'fonts/pretendard/YKMinus.woff2')) ? fs.readFileSync(path.join(ROOT, 'fonts/pretendard/YKMinus.woff2')) : Buffer.alloc(0);
  const ofl = fs.existsSync(path.join(ROOT, 'fonts/pretendard/YKMinus-OFL.txt')) ? fs.readFileSync(path.join(ROOT, 'fonts/pretendard/YKMinus-OFL.txt'), 'utf8') : '';
  ok(ib.includes(FACE374) && /body,button,input,select\{font-family:'YK Minus','Pretendard Variable','Pretendard',/.test(ib) && !bad374.length
     && woff.length > 1000 && woff.length < 12000 && woff.slice(0, 4).toString('latin1') === 'wOF2'
     && /SIL Open Font License, Version 1\.1/.test(ofl) && /Reserved Font Name Pretendard/.test(ofl),
     'v374 「YK Minus」 — 계산기 · 안내 페이지 15개 같은 @font-face(U+2212만) · 글꼴 순서 Pretendard 앞 · woff2 12KB 미만 · OFL 문서', bad374.join(','));
}
// 64) v375 — 「다음」 줄은 키보드가 있을 때만(방금 그 칸 묶음 · 줄을 누른 초점 또는 보이는 영역이 150px 넘게 짧을 때)
{
  const s375 = (html.match(/<script id="v375-kb-gate">[\s\S]*?<\/script>/) || [])[0] || '';
  ok(/addEventListener\('pointerdown', function\(e\)\{ lastT=Date\.now\(\); lastEl=e\.target; \}, true\)/.test(s375) && /Date\.now\(\)-lastT > 1000/.test(s375) && /> 150/.test(s375)
     && /closest\('\.inline-money'\)/.test(s375) && /visualViewport\.addEventListener\('resize'/.test(s375) && /matchMedia\('\(pointer: coarse\)'\)/.test(s375) && /__yk355\.place\(\)/.test(s375)
     && html.indexOf('<script id="v375-kb-gate">') > html.indexOf("bar.id='kbNext355'"),
     'v375 규칙 — 누른 초점(1초 · 칸 묶음 · 줄) 또는 키보드(보이는 영역 150px 넘게 짧음)일 때만 「다음」 줄 · 터치 화면만 · v355 뒤에 붙음');
}
// 65) v376 — 거래 분포 점: 규칙이 다른 인근 지역 점은 테두리만(감싸서 잇기 · 엔진 밖 · 점 개수가 다르면 손대지 않음)
{
  const s376 = (html.match(/<script id="v376-other-dots">[\s\S]*?<\/script>/) || [])[0] || '';
  const c376 = (html.match(/<style id="v376-other-dots">[\s\S]*?<\/style>/) || [])[0] || '';
  ok(/distributionDots=function\(\)/.test(s376) && /renderDealDistribution=function\(\)/.test(s376) && /!sameRules\(lawd\)/.test(s376) && /cs\.length!==last\.length\) return/.test(s376)
     && /setAttribute\('r', '3'\)/.test(s376) && /setAttribute\('stroke-width', '2'\)/.test(s376) && /그 지역 예상 집값 기준으로 색을 칠했어요/.test(s376)
     && /font-size:var\(--t7\)/.test(c376) && !/\.5px/.test(c376) && html.indexOf('<script id="v376-other-dots">') > html.indexOf('function renderDealDistribution('),
     'v376 규칙 — distributionDots · renderDealDistribution 감싸기 · 규칙 다른 지역(sameRules) 점만 테두리 · 개수 다르면 그대로 · 설명 문구 · 스케일 글자');
}
// 66) v377 — 글자 크기 · 굵기를 :root 스케일 토큰으로(리터럴 px · 550 · 650 없음 · v254/v261보다 센 선택자)
{
  const c377 = (html.match(/<style id="v377-type-scale">[\s\S]*?<\/style>/) || [])[0] || '';
  const body = c377.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/\.deal>\.nm,[^{]*\{font-size:var\(--t5\)!important;font-weight:var\(--w-key\)!important\}/.test(body) && /\.deal>\.amt,[^{]*\{font-size:var\(--t3\)!important;font-weight:700!important\}/.test(body)
     && /\.dd-insight b\{font-size:var\(--t2\)!important\}/.test(body) && /#cmpBody h2\{font-size:var\(--t3\)!important\}/.test(body) && /#app#app/.test(body)
     && !/font-size:\d/.test(body) && !/font-weight:(550|650)/.test(body) && !/\.5px/.test(body),
     'v377 규칙 — 목록 · 거래 비율 · 비교 탭 크기와 굵기를 스케일 토큰으로 · 리터럴 크기 · 550 · 650 없음');
}
// 67) v378 — 모서리는 --r-s · --r-m · --r-l 토큰만(리터럴 px 없음) · 입력 묶음은 위/아래 모서리만 · 주 파랑 #2458FF 하나
{
  const c378 = (html.match(/<style id="v378-corners-blue">[\s\S]*?<\/style>/) || [])[0] || '';
  const body = c378.replace(/\/\*[\s\S]*?\*\//g, '');
  const radii = body.match(/border-radius:[^;}]*/g) || [];
  ok(radii.length >= 18 && radii.every(r => /^border-radius:(var\(--r-[slm]\)|0)( (var\(--r-[slm]\)|0))*!important$/.test(r))
     && /\.crow\[data-mode="region"\]\{border-radius:var\(--r-l\) var\(--r-l\) 0 0!important\}/.test(body) && /\.crow\[data-mode="debt"\]\{border-radius:0 0 var\(--r-l\) var\(--r-l\)!important\}/.test(body)
     && /#stepNext353:not\(:disabled\):not\(:hover\),[^{]*#qClose:not\(:disabled\):not\(:hover\),[^{]*\.v208-primary:not\(:disabled\):not\(:hover\)\{background:#2458FF\}/.test(body) && /\.v208-primary\{border-color:#2458FF\}/.test(body) && /\.report-top\{background:#2458FF!important\}/.test(body) && !/1F5BFF/i.test(body) && !/\.5px/.test(body),
     'v378 규칙 — 모서리 토큰만 · 입력 묶음 위/아래 · 「다음」 · 시트 「적용」 · 「단지 찾아보기」 · 공유 이미지 머리 #2458FF');
}

// 68) v379 — 회색 선 2종: 선 #D6DFEC · 입력/선택지 #A4AFC3. 색 선언은 이 둘과 주 파랑 #2458FF뿐 · 고른/누른 상태는 :not(...)로 비켜 감
{
  const c379 = (html.match(/<style id="v379-lines">[\s\S]*?<\/style>/) || [])[0] || '';
  const body = c379.replace(/\/\*[\s\S]*?\*\//g, '');
  const cols = [...new Set((body.match(/#[0-9A-Fa-f]{6}\b/g) || []).map(c => c.toUpperCase()))].filter(c => !/^#(APP|QSHEET)/i.test(c));
  const decls = body.match(/\{[^}]*\}/g) || [];
  ok(c379 && decls.length >= 6 && decls.every(d => /^\{(border(-(top|bottom))?-color|background-color):#(D6DFEC|A4AFC3|2458FF)!important\}$/.test(d))
     && /#dealChips \.chip:not\(\.is-on\):not\(\[aria-pressed="true"\]\):not\(\[aria-expanded="true"\]\):not\(:hover\)/.test(body)
     && /#condPreview#condPreview\{background-color:#2458FF!important\}/.test(body) && /#cmpReportCard#cmpReportCard/.test(body)
     && !/\.5px/.test(body) && !/1F5BFF/i.test(body),
     'v379 규칙 — 선 색 선언은 #D6DFEC · #A4AFC3(+주 파랑 #2458FF)뿐 · 칩은 고른/누른 상태를 비켜 감 · 조건 미리보기 #2458FF', JSON.stringify(decls.filter(d => !/^\{(border(-(top|bottom))?-color|background-color):#(D6DFEC|A4AFC3|2458FF)!important\}$/.test(d)).slice(0,5)));
}
// 69) v380 — ④ 작은 그래프 점 → 12칸 막대(셈이 distributionModel과 다르면 그대로) · ③ 「세전 소득의 N%」 옆 원 숨김
{
  const s380 = (html.match(/<script id="v380-bars">[\s\S]*?<\/script>/) || [])[0] || '';
  const c380 = (html.match(/<style id="v380-bars">[\s\S]*?<\/style>/) || [])[0] || '';
  ok(/renderDealDistribution=function\(priceMan\)/.test(s380) && /distributionModel\(DEAL\.items\|\|\[\], budget, pass\)/.test(s380)
     && /cat\[i\]\.mu\+cat\[i\]\.ou!==model\.bins\[i\]\.under \|\| cat\[i\]\.mo\+cat\[i\]\.oo!==model\.bins\[i\]\.over\) return/.test(s380)
     && /Math\.min\(11, Math\.floor\(\(x\.amountMan-model\.lo\)\/\(model\.hi-model\.lo\)\*12\)\)/.test(s380) && !/POLICY|calcCosts|solveMaxPrice/.test(s380)
     && /테두리 막대는 대출 규칙이 다른 /.test(s380) && /#payTile \.v288-ring\{display:none!important\}/.test(c380) && !/\.5px/.test(c380),
     'v380 규칙 — 막대는 distributionModel과 같은 칸 나누기 · 칸마다 셈이 같을 때만 그림 · 정책 값 안 씀 · 설명 문구 · ③ 원 숨김');
}
// 70) v381 — 작은 정리: 주택 보유 시트 「적용」은 1주택 이상일 때만 · ≤360px 「이미지 저장」 그림 · 그림 꺾쇠 2px · 지역 그림 한 벌
{
  const c381 = (html.match(/<style id="v381-tidy">[\s\S]*?<\/style>/) || [])[0] || '';
  const s381 = (html.match(/<script id="v381-tidy">[\s\S]*?<\/script>/) || [])[0] || '';
  const body = c381.replace(/\/\*[\s\S]*?\*\//g, '');
  const icons = ['seoul','metro','other'].map(g => (body.match(new RegExp('\\[data-group="'+g+'"\\]::before\\{background-image:url\\("([^"]+)"\\)')) || [])[1] || '');
  const oneSet = icons.every(u => /%3Crect x='2\.9' y='2\.9' width='18\.2' height='18\.2' rx='4\.5'/.test(u) && /r='7'/.test(u) && /r='2\.8'/.test(u) && /stroke-width='1\.8'/.test(u));
  ok(/#qSheet#qSheet\.house-noapply381 \.sheet-actions\{display:none!important\}/.test(body) && /m==='house' && S\.houseStatus!=='multi'/.test(s381)
     && /@media \(max-width:360px\)\{[\s\S]*#outSave \.arw\{display:flex!important\}/.test(body)
     && /#marketOpen \.chev-r\{[^}]*border-right:2px solid currentColor/.test(body) && /\.f-v::after\{content:""!important[^}]*border-right:2px solid #5F6B7D/.test(body)
     && /#savedHomesOpen233>span\[aria-hidden="true"\]\{[^}]*font-size:0!important[^}]*border-right:2px solid currentColor/.test(body)
     && oneSet && !/\.5px|1\.5px/.test(body),
     'v381 규칙 — 주택 시트 「적용」 1주택 이상만 · ≤360 저장 그림 · 꺾쇠 2px 그림 · 지역 그림 한 도식 · 0.5px 없음', JSON.stringify(icons.map(u=>u.length)));
}
// 71) v382 — 안내 페이지 「연 소득별 한도표」: 3열(연 소득 · 수도권 · 지방) 10줄 + 「한도 / 월 상환액」 전환(라디오 + CSS) · 숫자는 v381과 같음
{
  const pg = read('dsr-income-table.html');
  const sec = (pg.match(/<section id="table">[\s\S]*?<\/section>/) || [])[0] || '';
  const rows = [...sec.matchAll(/<tr><th scope="row">([^<]+)<\/th><td class="num c-lim">([^<]+)<\/td><td class="num c-pay">([^<]+)<\/td><td class="num c-lim">([^<]+)<\/td><td class="num c-pay">([^<]+)<\/td><\/tr>/g)].map(m => m.slice(1).join('|'));
  const want = ['3,000만원|1억 3,100만원|74만원|1억 6,400만원|93만원','4,000만원|1억 7,500만원|99만원|2억 1,800만원|123만원','5,000만원|2억 1,800만원|123만원|2억 7,300만원|154만원','6,000만원|2억 6,200만원|148만원|3억 2,800만원|185만원','7,000만원|3억 600만원|172만원|3억 8,200만원|216만원','8,000만원|3억 5,000만원|197만원|4억 3,700만원|246만원','9,000만원|3억 9,300만원|222만원|4억 9,200만원|277만원','1억원|4억 3,700만원|246만원|5억 4,700만원|308만원','1억 2,000만원|5억 2,500만원|295만원|6억 5,600만원|369만원','1억 5,000만원|6억 5,600만원|369만원|8억 2,000만원|461만원'];
  const css = (pg.match(/<style id="v382-income-table">[\s\S]*?<\/style>/) || [])[0] || '';
  ok(JSON.stringify(rows) === JSON.stringify(want) && !/class="stack/.test(sec)
     && /<input class="t382-r" type="radio" name="t382" id="t382-lim" checked><input class="t382-r" type="radio" name="t382" id="t382-pay">/.test(sec) && /<label for="t382-lim">한도<\/label><label for="t382-pay">월 상환액<\/label>/.test(sec)
     && /\.t382 \.c-pay\{display:none\}/.test(css) && /#t382-pay:checked~\.scroll \.c-lim\{display:none\}/.test(css) && !/<script/.test(sec) && !/\.5px|font-size:15px/.test(css),
     'v382 한도표 — 10줄 숫자 그대로 · 3열 + 한도/월 상환액 전환(라디오 · 자바스크립트 없음) · 처음엔 한도', JSON.stringify(rows.slice(0,2)));
}
// 72) v383 — 시트 안 글자 크기를 스케일 변수로(제목 --t3 · 단위/버튼 --t5 · 지역 칩 --t6 · 대출 칸 --t3/--t1 · 부대비용 --t2/--t5) · 숫자 px 없음
{
  const c383 = ((html.match(/<style id="v383-sheet-type">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const decls = c383.match(/\{[^}]*\}/g) || [];
  ok(decls.length === 8 && decls.every(d => /^\{font-size:var\(--t[1-6]\)!important\}$/.test(d)) && /#qSheetTitle\{font-size:var\(--t3\)/.test(c383) && /#inDebt\{font-size:var\(--t1\)/.test(c383)
     && /#regionPane \.taggrid \.chip>span\{font-size:var\(--t6\)/.test(c383) && /#costImpactTotal\{font-size:var\(--t2\)/.test(c383),
     'v383 규칙 — 시트 글자 8묶음이 모두 스케일 변수(--t1~--t6) · 숫자 px 없음', JSON.stringify(decls));
}
// 73) v384 — 아이콘 선 굵기 한 벌: 그림 선 1.8px(크기별 viewBox 값) · 문서 안 SVG는 non-scaling 1.8px · 테두리 꺾쇠 2px
{
  const c384 = (html.match(/<style id="v384-icon-stroke">[\s\S]*?<\/style>/) || [])[0] || '';
  const body = c384.replace(/\/\*[\s\S]*?\*\//g, '');
  const sw = [...body.matchAll(/stroke-width='([\d.]+)'/g)].map(m => m[1]);
  ok(sw.length >= 12 && sw.every(v => ['2.4','2.7','3.1','3.6'].includes(v)) && sw.filter(v => v === '2.4').length === 7
     && /vector-effect:non-scaling-stroke;stroke-width:1\.8px!important/.test(body) && /#v208Nav button svg/.test(body) && /\.minigrid \.action-icon/.test(body)
     && /\{border-width:2px!important\}/.test(body) && /\.crows \.crow \.v \.chev/.test(body) && !/\.5px/.test(body),
     'v384 규칙 — 18px 그림 2.4 · 16px 2.7 · 14px 체크 3.1 · 12px 체크 3.6(모두 화면 1.8px) · 문서 안 SVG 1.8px · 꺾쇠 2px', JSON.stringify(sw));
}
// 74) v385 — 「표시」 단계 --t0(36px): 큰 숫자(결과 집값 · 금액 입력칸 · ③ 월 상환액)와 넓은 화면 큰 제목은 --t0 · 좁은 화면 큰 제목은 --t1 · 집값 「만원」 --t2
{
  const c385 = ((html.match(/<style id="v385-display">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const fz = [...c385.matchAll(/font-size:([^;}!]+)/g)].map(m => m[1].trim());
  ok(/--d1:64px; --t0:36px; --t1:30px; --t2:26px;/.test(html) && fz.length === 7 && fz.every(v => /^var\(--t[012]\)$/.test(v)) && fz.filter(v => v === 'var(--t0)').length === 4 && /#welcomeTitle232\{font-size:var\(--t1\)!important\}/.test(c385) && /\[data-v208-tab="entry"\] \.funnel \.cond-lead\{font-size:var\(--t2\)!important\}/.test(c385)
     && /#fundingOverview #easyPrice\{font-size:var\(--t0\)!important\}/.test(c385) && /#payTile #tileMonthly\{font-size:var\(--t0\)!important\}/.test(c385)
     && /\.single-money-field input\{font-size:var\(--t0\)!important\}/.test(c385) && /\.rhead #easyPrice \.money-unit\{font-size:var\(--t2\)!important\}/.test(c385)
     && /@media\(min-width:960px\)\{[^{]*#welcomeTitle232,[^{]*\[data-v208-tab="entry"\] \.funnel \.cond-lead\{font-size:var\(--t0\)!important\}\}/.test(c385)
     && !/\d(\.\d+)?px/.test(c385.replace('min-width:960px', '')) && !/#reportCard/.test(c385),
     'v385 규칙 — 스케일 맨 위 「표시」 --t0 36px · 큰 숫자 3곳 · 넓은 화면 큰 제목 --t0 · 좁은 화면 첫 화면 --t1 · 입력 제목 --t2 · 「만원」 --t2 · 숫자 px 없음', JSON.stringify(fz));
  const h385 = ((html.match(/<style id="v385-hover-blue">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/#stepNext353:not\(:disabled\):hover,[^{]*#qClose:not\(:disabled\):hover,[^{]*\.v208-primary:not\(:disabled\):hover\{background:var\(--v-blue-deep\)\}/.test(h385) && !/#[0-9A-Fa-f]{6}\b/.test(h385.replace(/#(app|qSheet|stepNext353|qClose)/g, '')),
     'v385 규칙 — 주 버튼(「다음」 · 「적용」 · 「단지 찾아보기」) 마우스 올림은 짙은 파랑 --v-blue-deep(옛 #1F5BFF 아님)');
}
// 75) v386 — 부대비용 시트 덜어내기: 금액 상자 4개 → 글자(밑줄 1px #A4AFC3 · 편집 중 #2458FF · 꺼진 항목 밑줄 없음) · 금액 --t5 · 기존 대출 나눠 입력은 그대로
{
  const c386 = ((html.match(/<style id="v386-cost-text">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^<style[^>]*>|<\/style>$/g, '');
  const sels = (c386.match(/(^|\})([^{}]+)\{/g) || []).map(x => x.replace(/^\}/, '').replace(/\{$/, '').trim());
  const fz = [...c386.matchAll(/font-size:([^;}!]+)/g)].map(m => m[1].trim());
  ok(sels.length >= 9 && sels.every(s => /^html:not\(#yk386\) body\.yk208 #whySheet #(costBox \.costrow|costItems \.line)/.test(s)) && !/debtParts|qSheet/.test(c386)
     && /\.costrow \.amt\{[^}]*background:none!important;border:0!important;border-bottom:1px solid #A4AFC3!important;border-radius:0!important;box-shadow:none!important\}/.test(c386)
     && /\.amt:focus-within\{border-bottom-color:#2458FF!important;box-shadow:0 1px 0 #2458FF!important\}/.test(c386) && /\.amt:has\(input:disabled\)\{border-bottom-color:transparent!important\}/.test(c386)
     && /\.amt::after\{content:'';position:absolute;[^}]*var\(--tap\)/.test(c386) && fz.length === 3 && fz.every(v => v === 'var(--t5)')
     && !/\.5px/.test(c386) && !/1F5BFF/i.test(c386) && (c386.match(/#[0-9A-F]{6}\b/gi) || []).every(c => ['#A4AFC3','#2458FF','#192332','#8490A1'].includes(c.toUpperCase())),
     'v386 규칙 — 부대비용 금액 상자 → 글자(밑줄 #A4AFC3 · 편집 #2458FF · 꺼짐 밑줄 없음) · 금액 · 「만원」 · 취득세 금액 --t5 · 누르는 높이 44 · 부대비용 시트에만', JSON.stringify({n:sels.length,fz}));
}
// 76) v387 — 기존 대출 시트 「대출별로 나눠 입력」 4칸: 상자 → 글자 + 밑줄(v386 방식) · 빈칸이면 「만원」도 회색 · 「만원」/밑줄 아래 눌러도 입력칸
{
  const c387 = ((html.match(/<style id="v387-debt-parts">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^<style[^>]*>|<\/style>$/g, '');
  const j387 = (html.match(/<script id="v387-debt-parts">[\s\S]*?<\/script>/) || [])[0] || '';
  const sels = (c387.match(/(^|\})([^{}]+)\{/g) || []).map(x => x.replace(/^\}/, '').replace(/\{$/, '').trim());
  const fz = [...c387.matchAll(/font-size:([^;}!]+)/g)].map(m => m[1].trim());
  ok(sels.length >= 8 && sels.every(s => /^html:not\(#yk387\) body\.yk208 #qSheet #debtParts \.costrow/.test(s)) && !/whySheet|#inDebt\b/.test(c387)
     && /\.costrow \.amt\{[^}]*background:none!important;border:0!important;border-bottom:1px solid #A4AFC3!important;border-radius:0!important;box-shadow:none!important/.test(c387)
     && /\.amt:focus-within\{border-bottom-color:#2458FF!important;box-shadow:0 1px 0 #2458FF!important;outline:none!important\}/.test(c387) && /input:focus-visible\{outline:none!important\}/.test(c387) && /\.amt:has\(input:placeholder-shown\) u\{color:#8490A1!important\}/.test(c387)
     && /\.amt::after\{content:'';position:absolute;[^}]*var\(--tap\)/.test(c387) && fz.length === 2 && fz.every(v => v === 'var(--t5)') && !/\.5px/.test(c387)
     && (c387.match(/#[0-9A-F]{6}\b/gi) || []).every(c => ['#A4AFC3','#2458FF','#192332','#8490A1'].includes(c.toUpperCase()))
     && /closest\('#debtParts \.costrow \.amt'\)/.test(j387) && /inp\.disabled \|\| inp\.readOnly/.test(j387) && !/amountMan|income|cash/.test(j387),
     'v387 규칙 — 나눠 입력 금액 상자 → 글자(밑줄 #A4AFC3 · 편집 #2458FF · 빈칸 「만원」 회색) · --t5 · 누르는 높이 44 · 「만원」 눌러도 입력칸 · 기존 대출 시트에만', JSON.stringify({n:sels.length,fz}));
}
// 77) v388 — 스케일 밖 남은 글자: 탭 제목 4개 · 실거래 예산 · 조건 탭 금액 → --t2 · 머리줄 「영끌계산기」 → --t3
{
  const c388 = ((html.match(/<style id="v388-scale-rest">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^<style[^>]*>|<\/style>$/g, '');
  const fz = [...c388.matchAll(/font-size:([^;}!]+)/g)].map(m => m[1].trim());
  ok(fz.join(',') === 'var(--t2),var(--t2),var(--t3)' && /\.v232-result-heading h2,[^{]*\.v283-page-head h2,[^{]*#cmpTitle,[^{]*\[data-v208-tab="conditions"\] \.funnel \.cond-lead\{/.test(c388)
     && /strong#dealBudget,[^{]*#condPreview \.cp-v\{/.test(c388) && /#homeBtn,[^{]*#barLabel\{font-size:var\(--t3\)/.test(c388) && !/\d+px/.test(c388) && !/#reportCard/.test(c388),
     'v388 규칙 — 탭 제목 4개 · 실거래 예산 · 조건 탭 금액 --t2 · 머리줄 「영끌계산기」 --t3 · 숫자 px 없음', JSON.stringify(fz));
}
// 78) v389 — 화면 문구에 지시형(「~세요 · ~십시오」) 없음(주석 · 계산 엔진 · 개발자 자가 점검 메시지 제외) · 「실거래 보기」 꺾쇠 앞 간격
{
  const pi = html.indexOf('const POLICY'), es = html.lastIndexOf('<script', pi), ee = html.indexOf('ENGINE END');
  const body = (html.slice(0, es) + html.slice(ee)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').split('\n').filter(l => !/^\s*\/\//.test(l) && !/실행하세요/.test(l)).join('\n');
  const left = body.match(/[가-힣]+(세요|십시오)/g) || [];
  const c389 = ((html.match(/<style id="v389-chev">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(es > 0 && ee > es && left.length === 0 && /#marketOpen\{gap:var\(--sp-1\)!important\}/.test(c389)
     && html.includes("'매수 지역':'매수 지역을 고르지 않았어요.'") && html.includes('단지를 누르면 거래가와 필요 자금이 나와요.') && html.includes('<small>비우면 추정 금리로 계산</small>'),
     'v389 규칙 — 화면 문구 지시형 0개(사실형으로) · 「실거래 보기」 꺾쇠 앞 --sp-1', JSON.stringify(left.slice(0, 12)));
}
// 79) v390 — 계산기 화면 「선 대신 면」: 배경 #F1F4F8 · 카드/시트 테두리 없음 · 입력칸/칩/보조 단추는 면 · 포커스 파랑 2px 하나 · 하단 탭 그림자 · 큰 글자 자간 --ls-ttl · 구 누르면 카드 자리로 다시 맞춤
{
  const c390 = ((html.match(/<style id="v390-surface">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const j390 = (html.match(/<script id="v390-reach-scroll">[\s\S]*?<\/script>/) || [])[0] || '';
  const cols = [...new Set((c390.match(/#[0-9A-Fa-f]{6}\b/g) || []).map(c => c.toUpperCase()))];
  ok(/html:not\(#yk390\)\{background:#F1F4F8!important\}/.test(c390) && /#app#app\.app\{background:#F1F4F8!important\}/.test(c390)
     && /#crows>\.crow,[^{]*#fundingOverview,[^{]*#qSheet#qSheet,[^{]*#whySheet#whySheet\{border-color:transparent!important;box-shadow:none!important\}/.test(c390)
     && /\.inline-money-field:focus-within,[^{]*\.moneycard:focus-within,[^{]*\.region-search-field:focus-within\{box-shadow:inset 0 0 0 2px #2458FF!important;background:#FFFFFF!important\}/.test(c390)
     && /#v208Nav#v208Nav\{border-color:transparent!important;box-shadow:0 1px 3px rgba\(16,24,40,\.06\),0 8px 24px rgba\(16,24,40,\.10\)!important\}/.test(c390)
     && /#tileMonthly\{letter-spacing:var\(--ls-ttl\)!important\}/.test(c390) && !/font-size|border-radius|\.5px/.test(c390)
     && cols.every(c => ['#F1F4F8','#EEF1F5','#2458FF','#FFFFFF','#EDF2FF'].includes(c))
     && /addEventListener\('deals:ready', h\)/.test(j390) && /ct>=b && ct<=b\+40/.test(j390) && !/amountMan|income/.test(j390),
     'v390 규칙 — 배경 #F1F4F8 · 카드/시트 선 없음 · 입력/칩 면 · 포커스 한 겹 · 하단 탭 그림자 · 자간 --ls-ttl · 크기/모서리 그대로 · 구 누름 스크롤 다시 맞춤', JSON.stringify(cols));
}
// 80) v391 — 안내 페이지 15개: 같은 v391-article 블록이 </head> 바로 앞에 하나씩 · 흰 종이 · 소제목 카드 없음 · 본문 --t5 · 제목 스케일 · 강조 상자는 면 · 낱말 줄바꿈
{
  const PG = ['about','articles','budget-examples','buying-costs','couple-income','dsr-income-table','existing-debt','guide','loan-limit','price-band-cap','privacy','rate-type','regulated-area','room-deduction','switch-home'];
  const blocks = PG.map(p => (read(p + '.html').match(/<style id="v391-article">[\s\S]*?<\/style>\n<\/head>/) || [''])[0]);
  const b0 = blocks[0]; const body = b0.replace(/\/\*[\s\S]*?\*\//g, '');
  const cols = [...new Set((body.match(/#[0-9A-Fa-f]{6}\b/g) || []).map(c => c.toUpperCase()))];
  const fz = [...body.matchAll(/font-size:([^;}!]+)/g)].map(m => m[1].trim());
  ok(b0 && blocks.every(b => b === b0) && PG.every(p => (read(p + '.html').match(/v391-article/g) || []).length === 1)
     && /:root\{--t0:36px;--t1:30px;--t2:26px;--t3:19px;--t4:17px;--t5:16px;--t6:14px;--t7:13px;--t8:12px;--ls-ttl:-\.03em\}/.test(body) && /@media\(max-width:400px\)\{:root\{--t1:28px;--t2:24px\}\}/.test(body)
     && /html body main section,html body \.app section\{background:transparent!important;border:0!important;border-radius:0!important;box-shadow:none!important;padding:0!important;margin:48px 0 0!important\}/.test(body)
     && /html body main p,html body main li,html body \.app p,html body \.app li\{font-size:var\(--t5\)!important;line-height:1\.75!important/.test(body)
     && /html body\{word-break:keep-all!important;overflow-wrap:anywhere!important\}/.test(body)
     && fz.every(v => /^var\(--t[0-8]\)$/.test(v)) && !/\.5px/.test(body)
     && cols.every(c => ['#FFFFFF','#192332','#4E5B6E','#2458FF','#6B7789','#F1F4F8','#F3F6FF','#1848D6','#F6F8FB','#EEF2F8','#354258','#E8EDF4','#EEF1F5'].includes(c)),
     'v391 규칙 — 안내 페이지 15개 같은 블록 · 흰 종이 · 소제목 카드 없음 · 본문 16 · 제목 스케일 · 강조 상자 면 · 낱말 줄바꿈', JSON.stringify({miss:PG.filter((p,k)=>blocks[k]!==b0),cols,fz}));
}
// 81) v392 — 결과 홈 ① 합계: 양옆 선 가운데 구분줄 → 「합계 ··· 금액」 한 행(위 옅은 나눔선) · ② 앞 간격 28
{
  const c392 = ((html.match(/<style id="v392-total-row">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/\.f-join\{display:block!important;margin:16px 0 28px!important;padding-top:12px!important;box-shadow:inset 0 1px 0 #EEF1F5!important/.test(c392)
     && /\.f-join::before,[^{]*\.f-join::after\{content:none!important;display:none!important\}/.test(c392)
     && /\.f-join>span\{display:flex!important;justify-content:space-between!important/.test(c392) && /\.f-total\{font-size:var\(--t5\)!important;font-weight:700!important/.test(c392)
     && !/\d+px;font-size|font-size:\d/.test(c392),
     'v392 규칙 — 합계 한 행(양옆 선 없음 · 위 #EEF1F5 · 금액 --t5 굵게) · ② 앞 28');
}
// 82) v393 — 꾸밈 덜기: 입력 행 아이콘 사각형 바탕 없음(그림 18px만) · 결과 카드 번호 원 바탕 없음(파란 숫자 --t5 · 칸 왼쪽)
{
  const c393 = ((html.match(/<style id="v393-less-deco">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/#crows span\.k::before,[^{]*#crows label::before,[^{]*#noLoanT#noLoanT\.nl-t::before\{background-color:transparent!important;width:18px!important;height:18px!important;min-width:18px!important;border-radius:0!important;background-size:18px 18px!important/.test(c393)
     && /#flow358 \.f-step b,[^{]*#viewAnswer \.n358\{background:transparent!important;color:#2458FF!important;font-size:var\(--t5\)!important;font-weight:700!important;justify-content:flex-start!important;text-align:left!important\}/.test(c393),
     'v393 규칙 — 입력 행 아이콘 바탕 없음(18px) · 결과 카드 번호 원 없음(파란 숫자 16 · 칸 왼쪽)');
}
// 83) v394 — 오너 지적: 「기준」 꼬리표 테두리 · 금액 칸 숫자 세로 가운데 · 「15억원」 안내 줄 · 넓은 화면 머리 선(border-image) · 실거래 지도 카드 선
{
  const c394 = ((html.match(/<style id="v394-owner-fix">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/\.chip\.is-base330 \.tag330\{box-shadow:inset 0 0 0 1px #2458FF,0 0 0 2px #FFFFFF!important\}/.test(c394)
     && /#crows \.inline-money-field input\{height:100%!important/.test(c394) && /\.inline-money \.inline-echo\{margin-left:28px!important\}/.test(c394)
     && /#app#app \.appbar\{border-image:none!important\}/.test(c394)
     && /#dealMapRange button\{border-color:transparent!important;background:#F1F4F8!important/.test(c394) && /#dealMapLayer button\[aria-pressed="true"\]\{box-shadow:none!important/.test(c394),
     'v394 규칙 — 기준 꼬리표 테두리 · 금액 칸 높이 · 안내 28 · 머리 border-image 없음 · 지도 카드 칩 면');
}
// 84) v395 — 첫 화면 · 입력 화면 통일(오너 2026-11-27 시안 승인 → 「통일성」): 서울 25개 구 흰 타일 그림 · 시작 버튼 화살표 없음 · 칸 머리 번호 1 · 2 · 아이콘 없음 · 이름 위 값 아래
{
  const c395 = ((html.match(/<style id="v395-entry-unify">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const scene = (html.match(/<div class="welcome232-scene"[\s\S]*?<\/svg>/) || [''])[0];
  ok(c395.length > 0 && (scene.match(/<rect [^>]*width="40" height="40"/g) || []).length === 25 && (scene.match(/<text\b/g) || []).length === 1 && /내 예산<\/text>/.test(scene) && !/(종로|강남|동작|마포)/.test(scene)
     && html.includes('<button type="button" id="welcomeStart232">내 집 예산 알아보기</button>')
     && html.includes('<span aria-hidden="true">1</span>지역과 주택') && html.includes('<span aria-hidden="true">2</span>사용할 자금')
     && /#crows span\.k::before,[^{]*\{content:none!important;display:none!important\}/.test(c395)
     && /#crows>\.crow:not\(#stepSum353\)\{position:relative!important;display:flex!important;flex-direction:column!important/.test(c395)
     && /#crows \.inline-money-field input\{[^}]*font-size:var\(--t1\)!important/.test(c395) && !/\.5px/.test(c395),
     'v395 규칙 — 서울 25칸 그림(구 이름 없음 · 「내 예산」 하나) · 시작 버튼 화살표 없음 · 칸 머리 번호 1·2 · 입력 아이콘 없음 · 이름 위 값 아래 · 금액 --t1');
}
// 85) v396 — 실거래 탭 「보기 고르기」 단추 통일: 고름 = 파랑 글자 700 하나 · 붙은 단추 틀 #E4E8F1 하나 · 글자 14 · 모서리 스케일 · 필터 흰 면 · 분포 접기 줄 = 결과 접기 줄
{
  const c396 = ((html.match(/<style id="v396-pick-unify">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/#seg357 button\[aria-pressed="true"\]\{color:#2458FF!important;font-weight:700!important\}/.test(c396)
     && /:is\(#sortSeg,\.sortseg,\.deal-switch\)\{background:#E4E8F1!important/.test(c396)
     && /button:is\(\.is-on,\[aria-pressed="true"\],\[aria-selected="true"\]\)\{background:#FFFFFF!important;color:#2458FF!important;font-weight:700!important\}/.test(c396)
     && /#dealMapRange button\{border-radius:var\(--r-s\)!important\}/.test(c396) && /#dealFilterBtn\{[^}]*background-color:#FFFFFF!important/.test(c396) && !/\.5px/.test(c396),
     'v396 규칙 — 고름 파랑 700 · 붙은 단추 틀 하나 · 고른 붙은 단추 흰 면 · ±칩 모서리 --r-s · 필터 흰 면');
}
// 86) v397 — 버튼 통일: 주 버튼(17 · 700 · 54 · --r-m · #2458FF) · 작은 파란 버튼(14 · 600 · 44 · --r-m) · 보조 버튼(먹색 · 14 · 600 · --r-m) · 꺼짐 회색 하나
{
  const c397 = ((html.match(/<style id="v397-button-unify">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/#welcomeStart232,[^{]*#dock \.cta,[^{]*#qClose\{min-height:var\(--h-cta\)!important;height:auto!important;border-radius:var\(--r-m\)!important;font-size:var\(--t4\)!important;font-weight:700!important/.test(c397)
     && /#dock \.cta:disabled,[^{]*#qClose:disabled\{background:#E0E5EC!important/.test(c397)
     && /:is\(#marketOpen,\.v208-primary\)\{min-height:44px!important;[^}]*border-radius:var\(--r-m\)!important;font-size:var\(--t6\)!important/.test(c397)
     && /:is\(#outSave,#outCopy\)\{border-radius:var\(--r-m\)!important;font-size:var\(--t6\)!important;font-weight:600!important;color:var\(--yk-ink\)!important\}/.test(c397) && !/\.5px/.test(c397),
     'v397 규칙 — 주 버튼 17·700·54·r-m · 꺼짐 회색 · 작은 파란 버튼 14·44·r-m · 보조 버튼 먹색 r-m');
}
// 87) v398 — 비교 빈 화면 「1 · 2 · 3」 칸 점선 → 면
{
  const c398 = ((html.match(/<style id="v398-empty-slots">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/#cmpBody \.hc-empty-slots span\{border:0!important;background:#F1F4F8!important/.test(c398), 'v398 규칙 — 비교 빈 칸 선 없음 · 면 #F1F4F8');
}
// 88) v399 — 넓은 화면(1025 이상) 탭 막대를 머리줄 오른쪽 가로 탭으로 · 휴대폰 고른 탭 글자 #2458FF
{
  const c399 = ((html.match(/<style id="v399-pc-nav">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/@media \(min-width:1025px\)\{/.test(c399) && /#v208Nav#v208Nav\{top:4px!important;bottom:auto!important;left:auto!important;right:calc\(50% - 492px\)!important/.test(c399)
     && /#v208Nav#v208Nav button\[aria-current="page"\]\{color:#2458FF!important\}/.test(c399) && !/\.5px/.test(c399),
     'v399 규칙 — 1025 이상 머리줄 오른쪽(50% - 492) · 고른 탭 #2458FF');
}
// 89) v400 — 「쓰는 곳」 막대: 집값 #465262 · 부대비용 #B9C2D0(남색 없음)
{
  const c400 = ((html.match(/<style id="v400-spend-bar">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/\.f-bar \.p\{background:#465262!important\}/.test(c400) && /\.f-bar \.x\{background:#B9C2D0!important\}/.test(c400) && /\.f-price \.f-k i\{background:#465262!important\}/.test(c400), 'v400 규칙 — 집값 막대 · 범례 #465262 · 부대비용 #B9C2D0');
}
// 90) v401 — 다크 모드: <style id="v401-dark">가 tools/dark.mjs 생성 결과와 바이트 단위로 같음(손으로 고치지 않음 · 색을 고치면 생성기를 다시 돌림) ·
//   html2canvas 복제본에 yk-light(저장 이미지는 밝게) · theme-color 밝음/다크 · 다크 덩어리는 문서의 마지막 <style>
{
  let same=false, why='';
  try{ const gen = await import((await import('node:url')).pathToFileURL(path.join(ROOT,'tools','dark.mjs')).href); same = gen.applyDark(html) === html; if(!same) why='생성 결과와 다름 — node tools/dark.mjs'; }catch(e){ why='tools/dark.mjs 없음/오류: '+e.message; }
  const styles=[...html.matchAll(/<style([^>]*)>/g)].map(m=>m[1]);
  ok(same && /id="v401-dark"/.test(styles[styles.length-1]||'') && /@media \(prefers-color-scheme:dark\)\{:root:not\(\.yk-light\)\{color-scheme:dark\}/.test(html)
     && html.includes('<script id="v401-dark-capture">') && /doc\.documentElement\.classList\.add\('yk-light'\)/.test(html)
     && html.includes('<meta name="theme-color" content="#F1F4F8" media="(prefers-color-scheme: light)">') && html.includes('<meta name="theme-color" content="#14181E" media="(prefers-color-scheme: dark)">'),
     'v401 다크 — 덩어리 = tools/dark.mjs 생성 결과 · 마지막 <style> · 저장 복제본 yk-light · theme-color 둘', why);
}
// 91) v402 — 밝은 화면 글자 대비: 「거래 상세」 --yk-muted · 「참고용」 꼬리표 면 rgba(14,27,69,.22)
{
  const c402 = ((html.match(/<style id="v402-contrast">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/#dealList \.deal-expand\{color:var\(--yk-muted\)!important\}/.test(c402) && /\.estimate-tag\{background:rgba\(14,27,69,\.22\)!important\}/.test(c402), 'v402 규칙 — 거래 상세 보조 글자색 · 참고용 꼬리표 남색 면');
}
// 92) v403 — 안내 페이지 15개도 다크: tools/dark.mjs PAGES(계산기 + 안내 15) 전부가 생성 결과와 같음 · 다크 덩어리가 마지막 <style> · theme-color 다크 · 안내 페이지 15개가 PAGES에 다 있음
{
  let bad=[], miss=[];
  try{ const gen = await import((await import('node:url')).pathToFileURL(path.join(ROOT,'tools','dark.mjs')).href);
    const guides=['about','articles','budget-examples','buying-costs','couple-income','dsr-income-table','existing-debt','guide','loan-limit','price-band-cap','privacy','rate-type','regulated-area','room-deduction','switch-home'].map(g=>g+'.html');
    miss=guides.filter(g=>!gen.PAGES.includes(g));
    for(const name of gen.PAGES){ const h=fs.readFileSync(path.join(ROOT,name),'utf8'); const st=[...h.matchAll(/<style([^>]*)>/g)].map(m=>m[1]);
      if(gen.applyDark(h)!==h || !/id="v401-dark"/.test(st[st.length-1]||'') || !h.includes('<meta name="theme-color" content="#14181E" media="(prefers-color-scheme: dark)">')) bad.push(name); }
  }catch(e){ bad=['오류: '+e.message]; }
  ok(!bad.length && !miss.length, 'v403 다크 — 계산기 + 안내 페이지 15개 다크 덩어리 = 생성 결과 · 마지막 <style> · theme-color 다크', JSON.stringify({bad,miss}));
  const g=fs.readFileSync(path.join(ROOT,'guide.html'),'utf8');
  ok(/<style id="v403-caption">[\s\S]*html body main \.example figcaption\{color:#607089!important\}/.test(g), 'v403 계산 방법 글 예시 상자 그림 설명 #607089(대비 4.5 이상)');
}
// 93) v404 — D2: 입체 아이콘 7개 :root --ic-* · 떠 있는 카드 · 파란 카드 그러데이션(바탕색 #2458FF 유지) · 칸 머리 아이콘 36 + 19 · 범례 → 목록 줄 · 쓰는 곳 막대 #7D8AA0/#C8D0DB · 「쓰는 곳」 비율은 엔진 pair()와 같은 규칙 · 다크 그림자 검게
{
  const c404 = ((html.match(/<style id="v404-d2">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const ics=['coin','bank','house','receipt','cal','pin','wallet'].every(k=>new RegExp('--ic-'+k+':url\\("data:image/svg\\+xml,').test(c404));
  const gen=fs.readFileSync(path.join(ROOT,'tools','dark.mjs'),'utf8');
  ok(ics && /background-color:#2458FF!important;background-image:radial-gradient\(/.test(c404) && /\.f-bar \.p\{background:linear-gradient\(180deg,#8F9BB0,#7D8AA0\)!important\}/.test(c404) && /\.f-price \.f-k i\{background:#7D8AA0!important\}/.test(c404)
     && /var pn=\(P>0 && C>=0\) \? Math\.round\(P\/\(P\+C\)\*100\) : null;/.test(html) && /\(100-pn\)\+'%'/.test(html)
     && /role==='shadow'/.test(gen) && /prop\.startsWith\('--ic-'\)/.test(gen) && !/\.5px/.test(c404),
     'v404 규칙 — 입체 아이콘 7개 · 파란 카드 바탕색 유지 + 그러데이션 · 쓰는 곳 막대 · 비율(엔진 pair 규칙) · 생성기 그림자/아이콘 처리');
}
// 95) v406 — 첫 화면 · 실거래 탭 D2 톤: 서울 25칸 그림을 파란 그러데이션 카드 안에(유리 칸 · 흰 「내 예산」 칸 · 동전/은행 아이콘) · 생성기는 그 그림 색을 다크에서도 그대로 · 자금 글 줄 책 아이콘 · 실거래 지역 머리 핀 · 25개 구 머리 입체 타일 · 지도 범례 둥근 점
{
  const c406 = ((html.match(/<style id="v406-welcome-deals">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const gen=fs.readFileSync(path.join(ROOT,'tools','dark.mjs'),'utf8');
  ok(/--ic-grid:url\("data:image\/svg\+xml,/.test(c406) && /\.welcome232-scene\{[^}]*height:224px!important[^}]*radial-gradient\(/.test(c406) && /rect\[width="40"\]\[fill="#2458FF"\]\{fill:#FFFFFF!important/.test(c406)
     && /var\(--ic-coin\)/.test(c406) && /var\(--ic-bank\)/.test(c406) && /#dealMapLegend i\{[^}]*border-radius:50%!important/.test(c406) && /const KEEP_SEL=\/\\\.welcome232-scene\\b\//.test(gen)
     && !/\.5px/.test(c406) && html.indexOf('<style id="v406-welcome-deals">')<html.indexOf('<style id="v401-dark">'),
     'v406 규칙 — 첫 화면 파란 카드 그림(높이 224 · 흰 「내 예산」 칸 · 동전/은행) · 생성기 KEEP_SEL · 25개 구 입체 타일 아이콘 · 지도 범례 둥근 점 · 다크 덩어리보다 앞');
}
// 96) v407 — 주택 보유 세 선택지 입체 아이콘 36 · 비교 빈 화면 입체 비교 아이콘 64 · 시트 금액 칸 숫자 왼쪽 맞춤(입력 화면과 같게)
{
  const c407 = ((html.match(/<style id="v407-sheets-compare">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const ics=['first','key','homes','compare'].every(k=>new RegExp('--ic-'+k+':url\\("data:image/svg\\+xml,').test(c407));
  ok(ics && /\[data-house="first"\]::before\{background-image:var\(--ic-first\)/.test(c407) && /\[data-house="none"\]::before\{background-image:var\(--ic-key\)/.test(c407) && /\[data-house="multi"\]::before\{background-image:var\(--ic-homes\)/.test(c407)
     && /\.v208-empty-mark\{[^}]*var\(--ic-compare\)/.test(c407) && /#qSheet :is\(\.single-money-field,\.mfield\) input\{text-align:left!important\}/.test(c407)
     && !/\.5px/.test(c407) && html.indexOf('<style id="v407-sheets-compare">')<html.indexOf('<style id="v401-dark">'),
     'v407 규칙 — 주택 보유 입체 아이콘 3개 · 비교 빈 화면 입체 아이콘 · 시트 금액 칸 왼쪽 맞춤 · 다크 덩어리보다 앞');
}
// 94) v405 — 목록 줄 비율을 금액 옆 괄호로(오너 「30억이면 (%)가 낫지 않아? 위아래다」) · 좁은 화면 한 줄 맞춤 · 결과 아래(이미지 저장 ~ 더 알아보기) D2 · 공유 미리보기 그림 새로
{
  const c405a = ((html.match(/<style id="v405-flow-inline">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const c405b = ((html.match(/<style id="v405-result-bottom">[\s\S]*?<\/style>/) || [])[0] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const og = fs.readFileSync(path.join(ROOT,'og-image.png'));
  const ogW = og.readUInt32BE(16), ogH = og.readUInt32BE(20), ogPng = og.slice(1,4).toString()==='PNG';
  const ics=['book','doc','globe','shield','refresh'].every(k=>new RegExp('--ic-'+k+':url\\("data:image/svg\\+xml,').test(c405b));
  ok(/\.f-v em\{display:inline!important/.test(c405a) && /em::before\{content:'\('\}/.test(c405a) && /em::after\{content:'\)'\}/.test(c405a) && /em:empty\{display:none!important\}/.test(c405a)
     && /@media \(max-width:359px\)/.test(c405a) && ics && /#more341>h2::before\{[^}]*var\(--ic-book\)/.test(c405b) && /#restartBtn::after\{display:none!important\}/.test(c405b)
     && ogPng && ogW===1200 && ogH===630 && og.length<200000 && !/\.5px/.test(c405a+c405b) && html.indexOf('<style id="v405-result-bottom">')<html.indexOf('<style id="v401-dark">'),
     'v405 규칙 — 비율 괄호(빈 비율은 숨김) · 좁은 화면 한 줄 · 더 알아보기 아이콘 5개 · 공유 그림 1200×630 PNG 200KB 미만 · 다크 덩어리보다 앞', JSON.stringify({ogW,ogH,size:og.length}));
}
// YK_PLAYWRIGHT_PATH, YK_CHROMIUM_PATH 필수. YK_CHROMIUM_PACKAGE/ YK_AXE_PATH/ YK_QA_DIR 선택.
if(process.env.YK_PLAYWRIGHT_PATH && process.env.YK_CHROMIUM_PATH){
  const {pathToFileURL}=await import('node:url');
  const {chromium}=await import(pathToFileURL(process.env.YK_PLAYWRIGHT_PATH));
  const args=process.env.YK_CHROMIUM_PACKAGE ? (await import(pathToFileURL(process.env.YK_CHROMIUM_PACKAGE))).default.args : ['--no-sandbox','--disable-dev-shm-usage'];
  const browser=await chromium.launch({executablePath:process.env.YK_CHROMIUM_PATH,args,headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});let mode='error';const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    /* v338 — 검증용 가짜 네이버 지도(실제 SDK 아님). 지도 탭 코드가 쓰는 기능만 흉내 냅니다. */
    let h2cReq351=0;   /* v351 — 그림 도구(html2canvas) 요청 수 */
    let naverReq350=0;   /* v350 — 네이버 지도 SDK 요청 수 */
    let fakeMap338=false; const FAKE_NAVER_338="/* 검증용 가짜 네이버 지도 — 실제 SDK 가 아닙니다. 지도 탭 코드가 쓰는 기능만 흉내 냅니다(로컬·검사 전용).\n   좌표→화면 변환은 줌에 비례하는 단순 선형. 마커의 content 요소를 지도 상자 안에 절대 위치로 붙입니다. */\n(function(){\n  if (window.naver && window.naver.maps && window.naver.maps.__fake) return;\n  function LatLng(lat, lng){ this._lat = lat; this._lng = lng; }\n  LatLng.prototype.lat = function(){ return this._lat; }; LatLng.prototype.lng = function(){ return this._lng; };\n  function Point(x, y){ this.x = x; this.y = y; }\n  var listeners = new Map();\n  var Event = { addListener:function(t, n, f){ var k = listeners.get(t) || []; k.push([n, f]); listeners.set(t, k); return { t:t, n:n, f:f }; },\n    removeListener:function(){}, trigger:function(t, n, a){ (listeners.get(t) || []).forEach(function(x){ if(x[0] === n) x[1](a); }); } };\n  function FMap(node, o){\n    this.node = node; this.zoom = (o && o.zoom) || 12; this.center = (o && o.center) || new LatLng(37.55, 127.0); this.markers = [];\n    node.style.position = node.style.position || 'relative'; if(!node.style.minHeight) node.style.minHeight = '320px';\n    var self = this; window.__fakeMap = this;\n    setTimeout(function(){ self._idle(); }, 30);\n  }\n  FMap.prototype._scale = function(){ return 256 * Math.pow(2, this.zoom) / 360; };\n  FMap.prototype._xy = function(ll){ var s = this._scale(), r = this.node.getBoundingClientRect();\n    return { x:(ll.lng() - this.center.lng()) * s + r.width / 2, y:-(ll.lat() - this.center.lat()) * s * 1.26 + r.height / 2 }; };\n  FMap.prototype._place = function(){ var self = this; this.markers.forEach(function(m){ if(!m.el) return; var p = self._xy(m.position);\n    m.el.style.position = 'absolute'; m.el.style.left = p.x + 'px'; m.el.style.top = p.y + 'px'; m.el.style.transform = 'translate(-50%,-50%)'; }); };\n  FMap.prototype._idle = function(){ this._place(); Event.trigger(this, 'zoom_changed'); Event.trigger(this, 'bounds_changed'); Event.trigger(this, 'idle'); };\n  FMap.prototype.getZoom = function(){ return this.zoom; };\n  FMap.prototype.setZoom = function(z){ this.zoom = z; var s = this; setTimeout(function(){ s._idle(); }, 10); };\n  FMap.prototype.getCenter = function(){ return this.center; };\n  FMap.prototype.setCenter = function(c){ this.center = c; var s = this; setTimeout(function(){ s._idle(); }, 10); };\n  FMap.prototype.panTo = function(c){ this.setCenter(c); };\n  FMap.prototype.refresh = function(){ this._place(); };\n  FMap.prototype.setOptions = function(){}; FMap.prototype.setSize = function(){}; FMap.prototype.autoResize = function(){};\n  FMap.prototype.getSize = function(){ var r = this.node.getBoundingClientRect(); return { width:r.width, height:r.height }; };\n  FMap.prototype.fitBounds = function(pts){ var a = Array.isArray(pts) ? pts : [pts.getSW(), pts.getNE()];\n    var la = a.map(function(p){ return p.lat(); }), ln = a.map(function(p){ return p.lng(); });\n    var span = Math.max(Math.max.apply(null, ln) - Math.min.apply(null, ln), (Math.max.apply(null, la) - Math.min.apply(null, la)) * 1.26, 0.002);\n    var r = this.node.getBoundingClientRect(); this.zoom = Math.max(8, Math.min(18, Math.floor(Math.log2((r.width - 120) * 360 / (256 * span)))));\n    this.setCenter(new LatLng((Math.max.apply(null, la) + Math.min.apply(null, la)) / 2, (Math.max.apply(null, ln) + Math.min.apply(null, ln)) / 2)); };\n  FMap.prototype.getBounds = function(){ var s = this._scale(), r = this.node.getBoundingClientRect(), dx = r.width / 2 / s, dy = r.height / 2 / s / 1.26, c = this.center;\n    var sw = new LatLng(c.lat() - dy, c.lng() - dx), ne = new LatLng(c.lat() + dy, c.lng() + dx); return { getSW:function(){ return sw; }, getNE:function(){ return ne; } }; };\n  FMap.prototype.getProjection = function(){ var self = this; return {\n    fromCoordToOffset:function(ll){ var p = self._xy(ll); return new Point(p.x, p.y); },\n    fromOffsetToCoord:function(pt){ var s = self._scale(), r = self.node.getBoundingClientRect(); return new LatLng(self.center.lat() - (pt.y - r.height / 2) / s / 1.26, self.center.lng() + (pt.x - r.width / 2) / s); } }; };\n  function Marker(o){ this.position = o.position; this.map = null; this.el = o.icon && o.icon.content; this.zIndex = o.zIndex; if(this.el && this.zIndex != null) this.el.style.zIndex = String(this.zIndex);\n    var self = this; if(this.el) this.el.addEventListener('click', function(e){ Event.trigger(self, 'click', e); }); this.setMap(o.map); }\n  Marker.prototype.setMap = function(m){ if(this.map){ var i = this.map.markers.indexOf(this); if(i >= 0) this.map.markers.splice(i, 1); if(this.el && this.el.parentNode) this.el.parentNode.removeChild(this.el); }\n    this.map = m; if(m){ m.markers.push(this); if(this.el){ m.node.appendChild(this.el); m._place(); } } };\n  Marker.prototype.getPosition = function(){ return this.position; }; Marker.prototype.setPosition = function(p){ this.position = p; if(this.map) this.map._place(); };\n  Marker.prototype.setZIndex = function(z){ this.zIndex = z; if(this.el) this.el.style.zIndex = String(z); }; Marker.prototype.getElement = function(){ return this.el; };\n  /* 주소 → 좌표: 구 중심 근처에 주소 글자로 정한 자리(늘 같은 자리) */\n  var GU = { '종로구':[37.594,126.977],'중구':[37.560,126.996],'용산구':[37.531,126.981],'성동구':[37.551,127.041],'광진구':[37.546,127.086],'동대문구':[37.582,127.055],'중랑구':[37.598,127.093],'성북구':[37.606,127.018],'강북구':[37.643,127.011],'도봉구':[37.669,127.032],'노원구':[37.652,127.075],'은평구':[37.619,126.927],'서대문구':[37.578,126.939],'마포구':[37.560,126.908],'양천구':[37.524,126.855],'강서구':[37.561,126.823],'구로구':[37.494,126.856],'금천구':[37.460,126.901],'영등포구':[37.522,126.910],'동작구':[37.499,126.951],'관악구':[37.467,126.945],'서초구':[37.473,127.031],'강남구':[37.496,127.063],'송파구':[37.505,127.115],'강동구':[37.550,127.147] };\n  function hash(s){ var h = 0; for(var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; }\n  var Service = { Status:{ OK:200, ERROR:500 }, geocode:function(q, cb){ var query = String(q.query || ''), g = null;\n      Object.keys(GU).forEach(function(k){ if(query.indexOf(k) >= 0) g = GU[k]; });\n      setTimeout(function(){ if(!g) return cb(200, { v2:{ addresses:[] } });\n        var exact = /\\d/.test(query) || /동\\d/.test(query), h = hash(query);\n        var lat = g[0] + (exact ? ((h % 1000) / 1000 - 0.5) * 0.03 : 0), lng = g[1] + (exact ? (((h >> 10) % 1000) / 1000 - 0.5) * 0.04 : 0);\n        cb(200, { v2:{ addresses:[{ x:String(lng), y:String(lat), roadAddress:query, jibunAddress:query }] } }); }, 5); } };\n  window.naver = window.naver || {};\n  window.naver.maps = { __fake:true, jsContentLoaded:true, Map:FMap, LatLng:LatLng, Point:Point, Marker:Marker, Event:Event, Service:Service,\n    Position:{ CENTER:1, BOTTOM:2, TOP_LEFT:3, TOP_RIGHT:4, BOTTOM_LEFT:5, BOTTOM_RIGHT:6 }, MapTypeId:{ NORMAL:'normal' }, ZoomControlStyle:{}, LatLngBounds:function(sw, ne){ this.getSW = function(){ return sw; }; this.getNE = function(){ return ne; }; } };\n  try{ var cb = new URLSearchParams((document.currentScript && document.currentScript.src.split('?')[1]) || '').get('callback'); if(cb && typeof window[cb] === 'function') setTimeout(window[cb], 0); }catch(e){}\n})();\n";
    const REACH328_CODES=[...html.slice(html.indexOf('var REACH_TILES')).matchAll(/\['(11\d{3})',/g)].slice(0,25).map(m=>[m[1]]);
    const reach328Calls=[],reach328Bulk=[];let reach328Fail='',reach328On=false,reach328Missing=false,reach328Budget=15000; // v328 — 서울 25개 구 조회 모의
    await page.route('**/*',async route=>{
      const u=new URL(route.request().url());if(u.hostname==='oapi.map.naver.com')naverReq350++;if(/html2canvas/.test(u.pathname))h2cReq351++;if(fakeMap338&&u.hostname==='oapi.map.naver.com')return route.fulfill({contentType:'text/javascript',body:FAKE_NAVER_338});if(u.hostname!=='yeongkkeul.test')return route.abort();
      if(u.pathname.startsWith('/api/')){
        const reach328Item=lawd=>({name:'검증아파트',dong:'검증동',jibun:'1',areaM2:84,amountMan:lawd==='11320'?reach328Budget:lawd==='11305'?Math.round(reach328Budget*0.85)-1:990000,buildYear:2010,floor:10,y:2026,m:10,d:20});
        if(reach328On&&u.pathname==='/api/apt-reach'){const ymd=Number(u.searchParams.get('ymd'));reach328Bulk.push(ymd);
          if(reach328Missing)return route.fulfill({status:404,body:''});
          const gu={};for(const [lawd] of REACH328_CODES){const x=reach328Item(lawd);gu[lawd]=lawd===reach328Fail?{ok:false,reason:'gateway-22'}:{ok:true,total:1,d:[[x.amountMan,x.areaM2,x.d,x.name,x.dong,x.floor,x.buildYear]]};}
          return route.fulfill({json:{ok:true,ymd,failed:reach328Fail?1:0,gu}});}
        if(reach328On&&u.pathname==='/api/apt-price'){const lawd=u.searchParams.get('lawd');reach328Calls.push(lawd);
          if(lawd===reach328Fail)return route.fulfill({json:{ok:false,reason:'gateway-22',items:[]}});
          return route.fulfill({json:{ok:true,items:[reach328Item(lawd)],total:1}});}
        const good=mode==='success'||(mode==='partial'&&u.searchParams.get('ymd')?.endsWith('10'));
        const items=good?[{name:'검증아파트',dong:'검증동',jibun:'1',areaM2:84,amountMan:23000,buildYear:2010,floor:10,y:2026,m:10,d:20}]:[];
        return route.fulfill({json:{ok:mode!=='error'&&!(mode==='partial'&&!good),items,total:items.length}});
      }
      const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));
      if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({path:file});
    });
    await page.goto('http://yeongkkeul.test/');await page.evaluate(()=>document.fonts.ready);
    const seed=async()=>{
      await page.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
      await page.waitForFunction(()=>DEAL.status!=='loading');await page.waitForTimeout(80);
    };
    for(const width of [320,390,1264]){
      await page.setViewportSize({width,height:844});
      for(const state of ['error','empty','success','partial']){
        mode=state;await page.evaluate(()=>DEAL.cache.clear());await seed();
        const layout=await page.evaluate(()=>{
          const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width}};
          return {overflow:document.documentElement.scrollWidth>innerWidth+1,funding:rect('fundingOverview'),pay:rect('payTile'),market:rect('easyMarket'),next:rect('viewNext')};
        });
        ok(!layout.overflow,`v321 ${width}px ${state} 가로 넘침 없음`);
        // v326 — 모바일 순서: 예산 → 실거래 → 월 상환액(오너 2026-11-09). 실거래 카드가 숨김(hidden)인 상태는 높이 0이라 위치 비교에서 뺀다.
        const mk=layout.market.width>0;
        // v346 — 모바일: 예산 바로 아래 서울 25개 구 카드(보일 때), 그 아래 실거래 비교. PC: 25개 구는 v345처럼 예산·실거래 아래 한 줄 전체.
        const rc=await page.evaluate(()=>{const e=document.getElementById('reach328');const r=e.getBoundingClientRect();return {w:r.width,y:r.y,bottom:r.bottom};});
        // v354 — 25개 구 카드는 홈에서 빠지고 실거래 탭 머리 아래로(v346 홈 자리 검사를 바꿈).
        ok(rc.w===0 && await page.evaluate(()=>{const r=document.getElementById('reach328'),d=document.getElementById('viewDeals');const g=document.getElementById('seg357');return r.parentElement===d && r.previousElementSibling===g && g.previousElementSibling===d.querySelector(':scope>.v283-page-head');}), `v354·v357 ${width}px ${state} 25개 구 카드는 홈에 없음 · 실거래 탭 머리 · 전환 버튼 아래`, JSON.stringify(rc));
        ok(width<960 ? (mk ? layout.funding.bottom<=layout.pay.y && layout.pay.bottom<=layout.market.y : layout.funding.bottom<=layout.pay.y) : layout.pay.x>layout.funding.x && layout.market.y>=layout.pay.bottom,`v326·v358 ${width}px ${state} 카드 배치 — 휴대폰: 예산 → 월 상환액 → 실거래(v358 흐름 순서 · 데스크톱은 그대로)`);
        if(state==='partial')ok(await page.locator('#marketQueryStatus').isVisible(),'v321 결과에 부분 조회 안내 표시');
        if(process.env.YK_QA_DIR){fs.mkdirSync(process.env.YK_QA_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.YK_QA_DIR,`${width}-${state}.png`),fullPage:true});}
      }
    }
    await page.setViewportSize({width:390,height:844});mode='error';await seed();
    await page.locator('.result-notes321 summary').click();
    ok(await page.locator('#footNote').isVisible(),'v321 계산 기준 접기 열기');
    await page.locator('.result-notes321 summary').press('Enter');
    ok(!(await page.locator('#footNote').isVisible()),'v321 계산 기준 키보드 접기');
    // 실제 새로고침: 처분 예정 상태와 계산 결과가 일치.
    await page.evaluate(()=>{S.houseStatus='multi';S.ownCount=1;S.disposePlan=true;S.lockedPrice=null;showResult(false);});
    const before=await page.evaluate(()=>({price:LASTVIEW.price,loan:LASTVIEW.c.mortgageLoan}));
    await page.reload();await page.waitForFunction(()=>S.onResult && LASTVIEW);
    const after=await page.evaluate(()=>({price:LASTVIEW.price,loan:LASTVIEW.c.mortgageLoan,own:S.ownCount,dispose:S.disposePlan}));
    ok(before.price===after.price && before.loan===after.loan && after.own===1 && after.dispose,'v321 브라우저 새로고침 후 조건·금액 동일');
    await page.evaluate(()=>{S.broker={on:false,v:20};S.legal={on:false,v:700};S.move={on:true,v:900};S.ownCount=2;});
    await page.locator('#restartBtn').click();
    ok(await page.evaluate(()=>S.cash===null && S.ownCount===1 && S.broker.on && S.legal.v===65 && !S.move.on),'v321 재계산 버튼으로 비용·보유 조건 초기화');
    // 부분 실패 → 목록에서 재시도 → 정상 결과와 안내 해제.
    mode='partial';await page.evaluate(()=>DEAL.cache.clear());await seed();
    await page.locator('#marketOpen').click();
    ok(await page.locator('#dealQueryStatus .tr-retry').isVisible(),'v321 목록 부분 조회 재시도 버튼 표시');
    mode='success';await page.locator('#dealQueryStatus .tr-retry').click();
    await page.waitForFunction(()=>DEAL.status==='ready' && !DEAL.items.queryIssues.length);
    ok(!(await page.locator('#dealQueryStatus').isVisible()),'v321 재시도 성공 후 경고 해제');
    // v328 — 서울 25개 구: 누르기 전에는 조회하지 않음 · 실패한 구는 건수에서 빠지고 「조회 실패」 · 다시 불러오면 채워짐.
    {
      mode='success';await page.setViewportSize({width:390,height:844});await page.evaluate(()=>DEAL.cache.clear());await seed();reach328On=true;
      await page.evaluate(()=>window.yk208Navigate('home'));
      const nb354=await page.evaluate(()=>{const m=document.querySelector('#easyMarket .m358');return m?Math.round(parseFloat(getComputedStyle(m,'::before').width)):Math.round(document.querySelector('#easyMarket .section-symbol').getBoundingClientRect().width);});   /* v406 — 칸 머리 아이콘이 v404부터 ::before 입체 아이콘 36(옛 선 아이콘 26은 감춤) → 그 크기와 비교 */   /* v354 — 25개 구 카드가 실거래 탭으로 옮김: 옮기기 전 옆 카드(실거래 비교, 제목은 낭독용으로 남음) 아이콘과 같은 크기 */
      await page.evaluate(()=>window.yk208Navigate('map')); await page.evaluate(()=>window.__yk357&&window.__yk357.show('reach',{query:false}));   /* v354·v357 — 25개 구 카드는 실거래 탭 「서울 25개 구」(검사는 조회 전 상태도 보므로 자동 조회 없이) */
      const priceCalls=()=>reach328Calls.length;
      ok(await page.locator('#reach328').isVisible() && await page.locator('#reach328Go').isVisible() && !(await page.locator('#reach328Body').isVisible()), 'v328 조회 전 — 버튼만 표시');
      reach328Budget=await page.evaluate(()=>dealBudgetFor('11320'));
      ok(await page.evaluate(()=>{renderReport(LASTVIEW);const b=document.getElementById('rReach328');return !!b && b.hidden && !b.innerHTML;}), 'v332 조회 전 — 저장 이미지에 격자 없음(이전과 같은 이미지)');
      const v337a=await page.evaluate((nb354)=>{const g=document.getElementById('reach328Go'),m=document.getElementById('marketOpen');const c=e=>getComputedStyle(e).backgroundColor;return {go:c(g),market:m&&m.offsetParent?c(m):null,sym:(()=>{const e=document.querySelector('#reach328Title .section-symbol');return !!e && (getComputedStyle(e).backgroundImage.startsWith('url(') || !!e.querySelector('svg'));})(),symW:Math.round(document.querySelector('#reach328Title .section-symbol').getBoundingClientRect().width),nbW:nb354};},nb354); /* v340 — 고정 30px 대신 옆 카드 아이콘과 비교 */
      ok(v337a.go==='rgb(255, 255, 255)' && v337a.go!==v337a.market && v337a.sym && v337a.symW>0 && v337a.symW===v337a.nbW, 'v337 조회 버튼은 흰 버튼(파란 큰 버튼과 겹치지 않음) · 카드 머리에 홈 카드와 같은 크기의 아이콘(v354 실거래 탭에서)', JSON.stringify(v337a));
      // v344 — 누르기 전: 구 이름만 있는 회색 격자(읽기 도구에는 숨김) · 진짜 격자와 같은 칸 배치 · 이 격자를 눌러도 조회는 버튼과 같음.
      const v344a=await page.evaluate(()=>{const p=document.getElementById('reach344Preview');const t=p?[...p.querySelectorAll('.reach328-tile')]:[];
        return {vis:!!p&&!p.hidden&&p.getBoundingClientRect().height>0,aria:p&&p.getAttribute('aria-hidden'),n:t.length,names:t.map(x=>x.textContent).join(),want:REACH_TILES.map(x=>x[1]).join(),pos:t.map(x=>x.style.gridColumn+'/'+x.style.gridRow).join(),wantPos:REACH_TILES.map(x=>x[2]+'/'+x[3]).join(),before:p&&p.compareDocumentPosition(document.getElementById('reach328Go'))===4};});
      ok(v344a.vis && v344a.aria==='true' && v344a.n===25 && v344a.names===v344a.want && v344a.pos===v344a.wantPos && v344a.before, 'v344 조회 전 — 구 이름만 있는 격자 25칸(진짜 격자와 같은 배치) · 버튼 위', JSON.stringify(v344a).slice(0,240));
      reach328Calls.length=0; reach328Bulk.length=0; reach328Fail='11350';
      if(await page.locator('#reach344Preview').count()) await page.locator('#reach344Preview').click(); else await page.locator('#reach328Go').click();   /* v344 격자를 눌러 조회(없으면 버튼 — 옛 판에서도 검사가 멈추지 않게) */
      await page.waitForFunction(()=>document.getElementById('reach328Go').hidden);
      ok(reach328Bulk.length===3 && priceCalls()===0, 'v329 묶음 조회 3번(달마다 1번) · 구별 조회 0번', reach328Bulk.length+' / '+priceCalls());
      const r1=await page.evaluate(()=>({tiles:document.querySelectorAll('#reach328Map .reach328-tile').length,fail:document.querySelector('#reach328Map [data-reach="11350"]').className,issue:document.getElementById('reach328Issue').innerText,lead:document.getElementById('reach328Lead').innerText,sum:[...document.querySelectorAll('#reach328Map .reach328-tile:not(.is-fail) b')].reduce((s,b)=>s+Number(b.textContent),0)}));
      ok(r1.tiles===25 && /is-fail/.test(r1.fail) && /1개 구는 조회하지 못해/.test(r1.issue) && /조회된 24개 구/.test(r1.lead), 'v328 실패한 구 — 「조회 실패」 칸 · 문장은 조회된 구 수로', JSON.stringify(r1));
      ok(r1.lead.includes('모두 '+r1.sum.toLocaleString('ko-KR')+'건') || (r1.sum===0 && /거래가 없어요/.test(r1.lead)), 'v328 문장의 합계 = 칸 숫자 합', JSON.stringify(r1));
      const r1b=await page.evaluate(()=>({a:document.querySelector('#reach328Map [data-reach="11320"] b').textContent,b:document.querySelector('#reach328Map [data-reach="11305"] b').textContent,c:document.querySelector('#reach328Map [data-reach="11680"] b').textContent,key:document.getElementById('reach328Key').innerText,pick:document.getElementById('reach328Pick').innerText}));
      ok(r1b.a==='3' && r1b.b==='0' && r1b.c==='0' && r1.sum===3 && /85%~100%/.test(r1b.key) && /85%~100% 3건/.test(r1b.pick) && /이하 3건 · 전체 3건/.test(r1b.pick), 'v331 칸 숫자 = 예상 집값의 85%~100% 건수(예상 집값과 같은 값은 포함 · 85%보다 1만원 낮으면 0)', JSON.stringify(r1b));
      const v344b=await page.evaluate(()=>{const p=document.getElementById('reach344Preview')||{hidden:false,getBoundingClientRect:()=>({height:1})};const lis=[...document.querySelectorAll('#reach328Pick .reach328-deals li')];const sel=document.querySelector('#reach328Map [aria-pressed="true"]').dataset.reach;
        return {hid:p.hidden&&p.getBoundingClientRect().height===0,sel,n:lis.length,gaps:lis.map(l=>(l.querySelector('.reach344-gap')||{}).textContent||'').join('|'),want:lis.map(l=>{const d=document.createElement('div');d.innerHTML=dealBudgetGapHtml(Number(l.dataset.man),null,sel);return d.textContent;}).join('|'),
          row:lis.length>1&&Math.round(lis[0].getBoundingClientRect().top)===Math.round(lis[1].getBoundingClientRect().top),scroll:getComputedStyle(document.querySelector('#reach328Pick .reach328-deals')).overflowX};});
      ok(v344b.hid && v344b.n===3 && v344b.gaps===v344b.want && /예상 집값과 같음/.test(v344b.gaps) && v344b.row && v344b.scroll==='auto', 'v344 조회 뒤 — 미리보기 숨김 · 고른 구 거래는 옆으로 넘기는 카드 · 카드마다 실거래 목록과 같은 「예상 집값보다 …」', JSON.stringify(v344b));
      // v345 — 카드 정리(설명 한 줄 · 고른 구 패널 감춤 · 순위/지도 이미지 저장/집계 기준 한 줄) + 구를 누르면 그 구 둘러보기(내 조건 그대로 · 그 구만 조회).
      const v345a=await page.evaluate(()=>{const r=document.getElementById('reach345Row');const it=r?[...r.children].filter(e=>e.getClientRects().length):[];
        return {lead:document.getElementById('reach328Lead').innerText,pick:getComputedStyle(document.getElementById('reach328Pick')).display,
          kids:it.map(e=>e.id||e.tagName).join(),tops:[...new Set(it.map(e=>Math.round(e.getBoundingClientRect().top)))].length,note:!!(r&&r.querySelector('details #reach328Note')),key:document.getElementById('reach328Key').innerText};});
      ok(/거래가 있는 구 \d+곳 · 모두 [\d,]+건 · 최근 3개월/.test(v345a.lead) && !/가운데/.test(v345a.lead) && v345a.pick==='none' && v345a.kids==='reach328More,reach328Save,DETAILS' && v345a.tops===1 && v345a.note && /\(.+~.+\)/.test(v345a.key), 'v345 카드 — 설명 한 줄 · 고른 구 패널 감춤 · 순위/지도 이미지 저장/집계 기준 한 줄(390px) · 금액 범위는 기준 줄로', JSON.stringify(v345a));
      const v345sg=await page.evaluate(()=>S.sgg); reach328Calls.length=0;
      await page.locator('#reach328Map [data-reach="11320"]').click();
      await page.waitForFunction(()=>window.YK_BROWSE==='11320' && !document.getElementById('viewDeals').hidden && DEAL.status!=='loading',null,{timeout:8000}).catch(()=>{});
      const v345b=await page.evaluate(()=>({sgg:S.sgg,lawds:[...new Set((DEAL.items||[]).map(x=>x.lawd))].join(),bar:(document.getElementById('browse345')||{}).innerText||'',barVis:!!document.getElementById('browse345')&&!document.getElementById('browse345').hidden,head:document.querySelector('#dealDistribution')?document.querySelector('#dealDistribution').innerText.slice(0,40):''}));
      ok(v345b.sgg===v345sg && v345b.lawds==='11320' && v345b.barVis && /도봉구 둘러보는 중/.test(v345b.bar) && /85%~100% 3건/.test(v345b.bar) && reach328Calls.length>0 && reach328Calls.every(c=>c==='11320'), 'v345 구를 누르면 실거래 탭에서 그 구만(누를 때 그 구만 조회) · 매수 지역은 그대로 · 머리에 「둘러보는 중」', JSON.stringify([v345b,reach328Calls]));
      await page.waitForTimeout(300);   /* v354 내림은 v345 처리 뒤(60ms) */
      /* v388 — 부드러운 스크롤이 부하 때 300ms 안에 안 끝나 흔들림(동시 실행 때 y 23 · 카드 164) → 같은 조건이 될 때까지 최대 3초 기다림. 내려가지 않으면 그대로 실패. */
      await page.waitForFunction(()=>{const bar=document.querySelector('.appbar').getBoundingClientRect().bottom,b=document.getElementById('browse345'),c=document.getElementById('dealCard');if(!b||!c)return false;const ct=c.getBoundingClientRect().top;return scrollY>0&&ct>=bar&&ct<=bar+40&&b.getBoundingClientRect().top>=bar;},null,{timeout:3000}).catch(()=>{});
      const v354t=await page.evaluate(()=>{const bar=document.querySelector('.appbar').getBoundingClientRect().bottom,b=document.getElementById('browse345').getBoundingClientRect(),c=document.getElementById('dealCard').getBoundingClientRect();return {bar:Math.round(bar),browse:Math.round(b.top),card:Math.round(c.top),y:Math.round(scrollY)};});
      ok(v354t.y>0 && v354t.card>=v354t.bar && v354t.card<=v354t.bar+40 && v354t.browse>=v354t.bar, 'v354 구를 누르면 바뀐 실거래 카드(둘러보기 머리) 자리로 내려감 — 위에 있는 25개 구 카드에 머물지 않음', JSON.stringify(v354t));
      reach328Calls.length=0;
      if(await page.locator('#browse345 .b345-back').count()) await page.locator('#browse345 .b345-back').click();
      await page.waitForFunction(()=>!window.YK_BROWSE && DEAL.status!=='loading',null,{timeout:8000}).catch(()=>{});
      const v345c=await page.evaluate(()=>({lawds:[...new Set((DEAL.items||[]).map(x=>x.lawd))].join(),bar:!!document.getElementById('browse345')&&document.getElementById('browse345').hidden,deals:!document.getElementById('viewDeals').hidden}));
      ok(v345c.bar && v345c.deals && !/11320/.test(v345c.lawds) && reach328Calls.length===0, 'v345 「돌아가기」 — 내 지역 실거래로(받아 둔 것이라 다시 조회 안 함)', JSON.stringify([v345c,reach328Calls]));
      await page.evaluate(()=>window.__ykBrowse345&&window.__ykBrowse345.enter('11320')); await page.waitForFunction(()=>window.YK_BROWSE==='11320',null,{timeout:8000}).catch(()=>{});
      await page.evaluate(()=>window.yk208Navigate('home')); await page.waitForFunction(()=>!window.YK_BROWSE && DEAL.status!=='loading',null,{timeout:8000}).catch(()=>{});
      await page.evaluate(()=>window.yk208Navigate('map')); await page.evaluate(()=>window.__yk357&&window.__yk357.show('reach',{query:false}));   /* v354·v357 — 25개 구 카드는 실거래 탭 「서울 25개 구」(검사는 조회 전 상태도 보므로 자동 조회 없이) */
      ok(await page.evaluate(()=>!!window.__ykBrowse345 && !/11320/.test([...new Set((DEAL.items||[]).map(x=>x.lawd))].join()) && document.getElementById('browse345').hidden), 'v345 실거래 탭을 떠나면 둘러보기 끝 — 홈 실거래 비교는 내 지역 그대로');
      // v347 — 내 매수 지역 칸(●)을 누르면 둘러보기 머리 없이 평소 실거래로 · 다시 조회 안 함. 둘러보기 머리의 범위는 한 덩어리.
      const v347m=await page.evaluate(()=>{const t=document.querySelector('#reach328Map .reach328-tile.is-mine');return t?t.dataset.reach:null;});
      reach328Calls.length=0;
      if(v347m){ await page.locator('#reach328Map [data-reach="'+v347m+'"]').click(); await page.waitForFunction(()=>!document.getElementById('viewDeals').hidden && DEAL.status!=='loading',null,{timeout:8000}).catch(()=>{}); }
      const v347a=await page.evaluate(()=>({browse:window.YK_BROWSE,bar:!document.getElementById('browse345')||document.getElementById('browse345').hidden,deals:!document.getElementById('viewDeals').hidden}));
      ok(!!v347m && v347a.browse===null && v347a.bar && v347a.deals && reach328Calls.length===0, 'v347 내 매수 지역 칸 — 둘러보기 머리 없이 평소 실거래 · 다시 조회 0번', JSON.stringify([v347m,v347a,reach328Calls]));
      await page.evaluate(()=>window.yk208Navigate('home'));
      await page.evaluate(()=>window.__ykBrowse345&&window.__ykBrowse345.enter('11320')); await page.waitForFunction(()=>window.YK_BROWSE==='11320',null,{timeout:8000}).catch(()=>{});
      const v347b=await page.evaluate(()=>[...document.querySelectorAll('#browse345 .reach328-nb')].map(e=>e.textContent));
      ok(v347b.some(t=>/^\d+%~100%$/.test(t)) && v347b.some(t=>/^\(.+ ~ .+\)$/.test(t)), 'v347 둘러보기 머리 — 「85%~100%」 · 「(금액 ~ 금액)」 한 덩어리', JSON.stringify(v347b));
      await page.evaluate(()=>window.yk208Navigate('home')); await page.waitForFunction(()=>!window.YK_BROWSE,null,{timeout:8000}).catch(()=>{});
      await page.evaluate(()=>window.yk208Navigate('map')); await page.evaluate(()=>window.__yk357&&window.__yk357.show('reach',{query:false}));   /* v354·v357 — 25개 구 카드는 실거래 탭 「서울 25개 구」(검사는 조회 전 상태도 보므로 자동 조회 없이) */
      const rr=await page.evaluate(()=>{renderReport(LASTVIEW);const b=document.getElementById('rReach328');return {hidden:b.hidden,after:b.previousElementSibling&&b.previousElementSibling.id,cells:[...b.querySelectorAll('.rr328-t')].map(t=>t.querySelector('span').textContent+':'+t.querySelector('b').textContent+':'+t.className.replace('rr328-t ','')).join(),tiles:[...document.querySelectorAll('#reach328Map .reach328-tile')].map(t=>t.querySelector('span').textContent+':'+t.querySelector('b').textContent+':'+(t.className.match(/\b(l[0-4]|is-fail)\b/)||[''])[0]).join(),head:b.querySelector('.rr328-h').textContent,over:[...b.querySelectorAll('.rr328-t')].filter(t=>t.scrollWidth>t.clientWidth+1).length};});
      ok(!rr.hidden && rr.after==='rDeals' && rr.cells===rr.tiles && rr.cells.split(',').length===25 && /:–:is-fail/.test(rr.cells) && /85%~100% 거래 건수/.test(rr.head) && rr.over===0, 'v332 조회 뒤 — 저장 이미지 격자 25칸 = 화면 격자(숫자·색 단계·실패 칸)', JSON.stringify(rr).slice(0,300));
      const v337b=await page.evaluate(()=>({rows:document.querySelectorAll('#reach328List .reach328-row').length,label:document.getElementById('reach328More').textContent,exp:document.getElementById('reach328More').getAttribute('aria-expanded')}));
      await page.locator('#reach328More').click();
      const v337c=await page.evaluate(()=>({rows:document.querySelectorAll('#reach328List .reach328-row').length,label:document.getElementById('reach328More').textContent,exp:document.getElementById('reach328More').getAttribute('aria-expanded'),first:document.querySelector('#reach328List .reach328-row .nm').textContent}));
      ok(v337b.rows===0 && v337b.label==='25개 구 순위 보기' && v337b.exp==='false' && v337c.rows===25 && v337c.label==='순위 접기' && v337c.exp==='true' && v337c.first==='도봉구', 'v337 순위는 접혀 있고 펼치면 25개 구 전부(건수 많은 순)', JSON.stringify([v337b,v337c]));
      await page.locator('#reach328More').click();
      await page.locator('#reach328Map [data-reach="11680"]').click();
      await page.waitForFunction(()=>!!window.YK_BROWSE||!window.__ykBrowse345); await page.evaluate(()=>window.yk208Navigate('home')); await page.waitForFunction(()=>!window.YK_BROWSE);   /* v345 — 구를 누르면 실거래 탭으로 넘어감 → 홈으로 돌아와 이어 봄 */
      await page.evaluate(()=>window.yk208Navigate('map')); await page.evaluate(()=>window.__yk357&&window.__yk357.show('reach',{query:false}));   /* v354·v357 — 25개 구 카드는 실거래 탭 「서울 25개 구」(검사는 조회 전 상태도 보므로 자동 조회 없이) */
      const sh=await page.evaluate(()=>{const f=dealAfford(990000,'11680');const t=document.getElementById('reach328Pick').innerText;return {t,need:formatWon(f.C*10000),gap:formatWon(f.gap*10000),pos:f.gap>0,nb:document.querySelectorAll('#reach328Lead .reach328-nb').length,nbWrap:[...document.querySelectorAll('#reach328Lead .reach328-nb')].every(e=>e.getClientRects().length===1)};});
      ok(sh.pos && sh.t.replace(/\u00a0/g,' ').includes('필요한 현금 '+sh.need) && sh.t.replace(/\u00a0/g,' ').includes('현금 '+sh.gap+' 부족') && /가장 낮은 거래 99억/.test(sh.t), 'v333 닿지 않는 구 — 가장 낮은 거래의 필요한 현금·부족액 = 거래 상세와 같은 계산(dealAfford)', sh.t.replace(/\n+/g,' | ').slice(0,260));
      const v344c=await page.evaluate(()=>{const g=document.querySelector('#reach328Pick .reach328-deals li .reach344-gap');return {t:g&&g.textContent,want:'예상 집값보다 '+formatWon((990000-dealBudgetFor('11680'))*10000)+' 높음',over:!!(g&&g.querySelector('.budget-delta.is-over'))};});
      ok(v344c.t && v344c.t.replace(/\s+/g,' ').endsWith(v344c.want) && v344c.over, 'v344 닿지 않는 구 — 가장 낮은 거래 카드에 「예상 집값보다 N 높음」', JSON.stringify(v344c));
      ok(sh.nb>=1 && sh.nbWrap, 'v333 문장의 「85%~100%」·금액 범위가 줄 중간에서 끊기지 않음', String(sh.nb));
      ok(await page.locator('#reach328Save').isVisible() && (await page.locator('#reach328Save').innerText()).trim()==='지도 이미지 저장', 'v332 조회 뒤 — 카드에 「이 지도를 이미지로 저장」');
      // v335·v336 — 「이 지도를 이미지로 저장」: 지도 전용 그림 · 만드는 동안 버튼 자리에서 보임 · 다른 화면은 베끼지 않음 · 끝나면 원래대로.
      await page.evaluate(()=>{window.__m335=null;window.__hold=null;navigator.canShare=undefined;window.html2canvas=(el,o)=>new Promise(res=>{const cs=id=>getComputedStyle(el.querySelector(id)).display;const btn=document.getElementById('reach328Save');
        window.__m335={cls:el.className,mix:cs('#rMix'),deals:cs('#rDeals'),grid:el.querySelectorAll('#rReach328 .rr328-t').length,amount:el.querySelector('#rAmount').textContent,cta:!el.querySelector('#rCta').hidden,key:!!el.querySelector('.rr328-k'),
          busyText:btn.textContent,busy:btn.disabled&&btn.getAttribute('aria-busy')==='true',
          skipApp:o.ignoreElements(document.getElementById('app')),keepCard:!o.ignoreElements(el.closest('.reportwrap')),keepStyle:[...document.body.children].filter(n=>n.tagName==='STYLE').every(n=>!o.ignoreElements(n)),inner:!o.ignoreElements(el.querySelector('#rAmount'))};
        window.__hold=()=>{const c=document.createElement('canvas');c.width=c.height=8;res(c);};});});
      await page.locator('#reach328Save').click();
      await page.waitForFunction(()=>window.__m335);
      const m335=await page.evaluate(()=>window.__m335);
      ok(/is-map335/.test(m335.cls) && m335.mix==='none' && m335.deals==='none' && m335.grid===25 && m335.cta && m335.key && /\d/.test(m335.amount), 'v335 지도 전용 그림 — 예상 집값 + 25칸 + 주소 · 자금 구성·실거래 세 곳은 빠짐', JSON.stringify(m335));
      ok(m335.busy && /만들고 있어요/.test(m335.busyText), 'v336 만드는 동안 버튼 글이 「이미지를 만들고 있어요…」 · 눌림 막힘', m335.busyText);
      ok(m335.skipApp && m335.keepCard && m335.keepStyle && m335.inner, 'v336 그림을 만들 때 계산기 본문은 베끼지 않고 카드·스타일만 베낌');
      await page.evaluate(()=>window.__hold());
      await page.waitForFunction(()=>!document.getElementById('reach328Save').disabled);
      const a336=await page.evaluate(()=>({text:document.getElementById('reach328Save').textContent,note:document.getElementById('reach328SaveNote').textContent,cls:document.getElementById('reportCard').className}));
      ok(a336.text==='지도 이미지 저장' && /내려받았어요|내보냈어요/.test(a336.note) || !!(await page.evaluate(()=>{const b=document.getElementById('exportPreview');return b&&!b.hidden;})), 'v336 끝나면 버튼이 돌아오고 결과가 버튼 아래(또는 미리보기)에 남음', JSON.stringify(a336));
      await page.evaluate(()=>{const b=document.getElementById('exportPreview');if(b&&!b.hidden)closeExportPreview();});
      ok(await page.evaluate(()=>{renderReport(LASTVIEW);const el=document.getElementById('reportCard');return !el.classList.contains('is-map335') && getComputedStyle(el.querySelector('#rMix')).display!=='none';}), 'v335 저장 뒤 카드는 원래대로(「이미지 저장」은 전체 그림 그대로)');
      await page.evaluate(()=>{window.html2canvas=()=>Promise.reject(Object.assign(new Error('x'),{name:'SecurityError'}));});
      await page.locator('#reach328Save').click();
      await page.waitForFunction(()=>/만들지 못했어요/.test(document.getElementById('reach328SaveNote').textContent));
      ok(await page.evaluate(()=>/\(SecurityError\)/.test(document.getElementById('reach328SaveNote').textContent) && !document.getElementById('reach328Save').disabled && !document.getElementById('reportCard').classList.contains('is-map335')), 'v336 실패하면 버튼 아래에 오류 이름과 함께 남고 버튼은 다시 눌림');
      await page.locator('#reach328Map [data-reach="11305"]').click();
      await page.waitForFunction(()=>!!window.YK_BROWSE||!window.__ykBrowse345); await page.evaluate(()=>window.yk208Navigate('home')); await page.waitForFunction(()=>!window.YK_BROWSE);   /* v345 — 구를 누르면 실거래 탭으로 넘어감 → 홈으로 돌아와 이어 봄 */
      await page.evaluate(()=>window.yk208Navigate('map')); await page.evaluate(()=>window.__yk357&&window.__yk357.show('reach',{query:false}));   /* v354·v357 — 25개 구 카드는 실거래 탭 「서울 25개 구」(검사는 조회 전 상태도 보므로 자동 조회 없이) */
      ok(/85%~100% 0건/.test(await page.locator('#reach328Pick').innerText()) && /이 범위 거래는 없어요\. 이하 거래 중 가장 높은 가격/.test(await page.locator('#reach328Pick').innerText()), 'v331 범위 밖·이하 거래만 있는 구 — 0건 + 이하 거래 최고가');
      reach328Calls.length=0; reach328Bulk.length=0; reach328Fail='';
      await page.locator('#reach328Retry').click();
      await page.waitForFunction(()=>document.getElementById('reach328Issue').hidden);
      ok(reach328Bulk.length===3 && priceCalls()===0, 'v329 다시 불러오기 — 묶음으로 다시(구별 75번으로 넘어가지 않음)', reach328Bulk.length+' / '+priceCalls());
      const before=await page.evaluate(()=>S.sgg);
      await page.locator('#reach328Map [data-reach="11320"]').click();
      await page.waitForFunction(()=>window.YK_BROWSE==='11320',null,{timeout:8000}).catch(()=>{}); if(await page.locator('#browse345 .b345-switch').count()) await page.locator('#browse345 .b345-switch').click(); else await page.locator('#reach328 [data-reach-switch="11320"]').click();   /* v345 — 「매수 지역 바꾸기」는 둘러보기 머리로 옮김(같은 v328 처리를 부름) */
      await page.waitForFunction(()=>S.sgg==='11320');
      ok(before!=='11320' && await page.evaluate(()=>document.querySelector('#reach328Map .is-mine').dataset.reach==='11320' && !document.getElementById('reach328Body').hidden), 'v328 매수 지역 바꾸기 — 지역이 바뀌고 받은 결과는 유지');
      await page.evaluate(b=>{selectSearchedRegion(b);S.lockedPrice=null;showResult(true);},before);
      // v329 — 묶음 함수가 없으면(404) 예전처럼 구마다 조회해 같은 결과.
      reach328On=false; reach328Missing=true;
      await page.reload(); await page.evaluate(()=>document.fonts.ready); await seed();
      mode='success';await page.setViewportSize({width:390,height:844});await page.evaluate(()=>DEAL.cache.clear());await seed();reach328On=true;
      await page.evaluate(()=>window.yk208Navigate('map')); await page.evaluate(()=>window.__yk357&&window.__yk357.show('reach',{query:false}));   /* v354·v357 — 25개 구 카드는 실거래 탭 「서울 25개 구」(검사는 조회 전 상태도 보므로 자동 조회 없이) */
      reach328On=true; reach328Calls.length=0; reach328Bulk.length=0;
      await page.locator('#reach328Go').click();
      await page.waitForFunction(()=>document.getElementById('reach328Go').hidden);
      ok(reach328Bulk.length===3 && reach328Calls.length===75 && await page.evaluate(()=>document.querySelectorAll('#reach328Map .reach328-tile:not(.is-fail):not(.is-wait)').length===25), 'v329 묶음 함수 없음(404) → 구별 조회 75번으로 25칸 채움', reach328Bulk.length+' / '+reach328Calls.length);
      reach328Missing=false;
    }

    // v338 — 지도 탭(가짜 지도 SDK): 「단지」 보기의 구 알약 = 예상 집값 ±범위 안 거래의 중앙값 · 「동네 시세」 보기는 전체 중앙값 그대로.
    {
      reach328On=true; reach328Fail=''; reach328Missing=false; fakeMap338=true;
      await page.reload(); await page.evaluate(()=>document.fonts.ready);
      await page.evaluate(b=>{Object.assign(S,{cash:20000,income:7000,sgg:'11320',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null,compareCodes:['11305','11680']});showResult(false);});
      await page.waitForFunction(()=>DEAL.status!=='loading');
      reach328Budget=await page.evaluate(()=>dealBudgetFor('11320'));
      await page.evaluate(()=>{DEAL.cache.clear();showResult(false);});
      await page.waitForFunction(()=>DEAL.status==='done'||DEAL.status==='ok'||Array.isArray(DEAL.items)&&DEAL.items.length>0);
      await page.evaluate(()=>window.yk208Navigate('map'));
      await page.waitForFunction(()=>window.__ykMap&&window.__ykMap.isReady());
      await page.locator('#dealMapTab').click();
      await page.waitForFunction(()=>document.querySelectorAll('.yk-map-group[data-level=gu]').length>=3,null,{timeout:15000});
      await page.waitForTimeout(400);
      const read=()=>page.evaluate(()=>{const all={};DEAL.items.filter(d=>Number(d.amountMan)>0&&(typeof DEAL.pass!=='function'||DEAL.pass(d))).forEach(d=>{(all[d.lawd]=all[d.lawd]||[]).push(Number(d.amountMan));});
        const med=v=>{v=v.slice().sort((a,b)=>a-b);const m=Math.floor(v.length/2);return v.length%2?v[m]:Math.round((v[m-1]+v[m])/2);};
        const out={layer:window.__ykMap.layer(),range:window.__ykMap.range(),note:document.getElementById('dealMapNote').textContent,gu:{}};
        document.querySelectorAll('.yk-map-group[data-level=gu]').forEach(b=>{const name=b.querySelector('span').textContent;out.gu[name]={median:Number(b.dataset.median),basis:b.dataset.basis,hidden:b.hidden,text:b.querySelector('strong').textContent,aria:b.getAttribute('aria-label')};});
        out.all={도봉구:med(all['11320']||[0]),강북구:med(all['11305']||[0]),강남구:med(all['11680']||[0])};out.budget=dealBudgetFor('11320');return out;});
      const d1=await read();
      ok(d1.layer==='deal' && d1.gu['도봉구'].basis==='shown' && d1.gu['도봉구'].median===d1.budget && d1.gu['강북구'].median===Math.round(d1.budget*0.85)-1 && /예상 집값 ±20% 안 거래 1건/.test(d1.gu['도봉구'].aria), 'v338 단지 보기 — 구 알약은 예상 집값 ±범위 안 거래의 중앙값', JSON.stringify(d1).slice(0,400));
      ok(d1.gu['강남구'].hidden===true && d1.all['강남구']===990000 && d1.gu['강남구'].text!=='0만', 'v338 범위 안 거래가 없는 구는 단지 보기에서 알약을 내지 않음(0으로 적지 않음)', JSON.stringify(d1.gu['강남구']));
      ok(/알약 금액은 예상 집값 ±20% 안 거래의 중앙값이에요\./.test(d1.note), 'v338 단지 보기의 알약 설명');
      await page.evaluate(()=>window.__ykMap.setLayer('area'));await page.waitForTimeout(300);
      const d2=await read();
      ok(d2.layer==='area' && ['도봉구','강북구','강남구'].every(n=>d2.gu[n].basis==='all' && d2.gu[n].median===d2.all[n] && !d2.gu[n].hidden) && /면적 구분 없는 최근 거래가 중앙값/.test(d2.note), 'v338 동네 시세 보기 — 전체 거래 중앙값 그대로 · 세 구 모두 보임', JSON.stringify(d2.gu).slice(0,300));
      await page.evaluate(()=>window.__ykMap.setLayer('deal'));await page.waitForTimeout(300);
      const d3=await read();
      ok(d3.gu['도봉구'].basis==='shown' && d3.gu['도봉구'].median===d3.budget && d3.gu['강남구'].hidden===true, 'v338 단지 보기로 돌아오면 다시 범위 안 중앙값');
      ok(!errors.length, 'v338 지도 탭 JavaScript 오류 없음', errors.join(' | '));
      fakeMap338=false; reach328On=false;
      await page.reload(); await page.evaluate(()=>document.fonts.ready); mode='success'; await seed();
    }
    // v350 — 지도 SDK(운영 측정 gzip 약 100KB)는 실거래 화면이 열릴 때만: 홈에서는 요청 0번 · 하단 「지도」를 누르면 받고, 준비되면 지도로 바뀜.
    {
      fakeMap338=true; reach328On=false;
      h2cReq351=0; await page.reload(); await page.evaluate(()=>document.fonts.ready); await page.waitForTimeout(600); naverReq350=0;
      ok(h2cReq351===0 && await page.evaluate(()=>typeof window.html2canvas!=='function'), 'v351 페이지를 열 때 그림 도구(html2canvas) 요청 0번 — 저장 버튼이 보이거나 누를 때만', String(h2cReq351));
      await page.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11320',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null,compareCodes:[]});showResult(false);window.yk208Navigate('home');});
      await page.waitForFunction(()=>DEAL.status!=='loading'); await page.waitForTimeout(800);
      const home350=naverReq350;
      await page.evaluate(()=>window.yk208Navigate('map'));
      const toast350=await page.evaluate(()=>/지도를 불러오고 있어요/.test(document.body.innerText));
      await page.waitForFunction(()=>window.__ykMap&&window.__ykMap.isReady(),null,{timeout:8000}).catch(()=>{});
      await page.waitForFunction(()=>!document.getElementById('dealMapPanel').hidden,null,{timeout:5000}).catch(()=>{});
      const a350=await page.evaluate(()=>({panel:!document.getElementById('dealMapPanel').hidden,ready:!!(window.__ykMap&&window.__ykMap.isReady())}));
      ok(home350===0 && naverReq350>=1 && toast350 && a350.panel && a350.ready, 'v350 홈에서는 지도 SDK 요청 0번 · 「지도」를 누르면 받고 「지도를 불러오고 있어요」 → 준비되면 지도로', JSON.stringify({home350,after:naverReq350,toast350,a350}));
      fakeMap338=false; await page.evaluate(()=>window.yk208Navigate('home'));
    }
    // v339 — 진짜 그림 도구로: 버튼이 보이고 멈추면 미리 만들어 두고, 누를 때 같은 그림(같은 캔버스)을 다시 씀 · 배율 2.5.
    {
      reach328On=true; reach328Fail=''; reach328Missing=false;
      await page.reload(); await page.evaluate(()=>document.fonts.ready);
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11320',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null,compareCodes:[]});showResult(false);});
      await page.waitForFunction(()=>DEAL.status!=='loading'); await page.evaluate(()=>window.yk208Navigate('map')); await page.evaluate(()=>window.__yk357&&window.__yk357.show('reach',{query:false}));   /* v354·v357 — 25개 구 카드는 실거래 탭 「서울 25개 구」(검사는 조회 전 상태도 보므로 자동 조회 없이) */
      await page.locator('#reach328Go').click();
      await page.waitForFunction(()=>document.getElementById('reach328Go').hidden);
      ok(await page.evaluate(()=>typeof window.html2canvas!=='function' && !window.__ykH2C), 'v339 (전제) 그림 도구는 아직 안 불러옴');
      await page.evaluate(()=>document.getElementById('reach328Save').scrollIntoView({block:'center'}));
      await page.waitForFunction(()=>YK339.cache.some(c=>/is-map335/.test(c.sig)),null,{timeout:20000});
      const v339=await page.evaluate(async()=>{const e=YK339.cache.find(c=>/is-map335/.test(c.sig));const pre=await e.p;window.__pre339=pre;const card=document.getElementById('reportCard');
        renderReport(LASTVIEW);const again=await ykCardCanvas(card,'map');
        return {real:window.html2canvas===window.__ykH2C,same:pre===again,w:again.width,cardW:Math.round(card.getBoundingClientRect().width),cls:card.className,n:YK339.cache.length};});
      ok(v339.real && v339.same && v339.w===Math.round(v339.cardW*2.5) && !/is-map335/.test(v339.cls), 'v339 버튼이 보이면 미리 만들고, 누를 때 같은 캔버스를 다시 씀 · 가로 = 카드 폭 × 2.5 · 끝나면 카드 원래대로', JSON.stringify(v339));
      const v339b=await page.evaluate(async()=>{const card=document.getElementById('reportCard');const before=YK339.cache.length;
        const mk=document.createElement('i');mk.hidden=true;mk.textContent='t339';card.appendChild(mk);const c=await ykCardCanvas(card,'map');mk.remove(); /* v341 — 저장 카드는 LASTVIEW.price 를 쓰지 않아 예전 방식은 내용이 안 바뀌던 헛잠금. 카드 안 내용(innerHTML)을 실제로 바꿈 */const ps=await Promise.all(YK339.cache.map(x=>x.p)); /* v341 — 두 버튼이 같이 보이면 「전체」 미리 만들기가 끼어들어 목록 순서·구성이 바뀜: 「이전 캔버스를 다시 쓰지 않음」으로 판정 */
        return {grew:YK339.cache.length<=2, fresh:c instanceof HTMLCanvasElement&&c!==window.__pre339&&ps.length>0};});
      ok(v339b.grew && v339b.fresh, 'v339 카드 내용이 바뀌면 새로 그림(최근 두 장만 기억)', JSON.stringify(v339b));
      reach328On=false; mode='success';
      await page.reload(); await page.evaluate(()=>document.fonts.ready); await seed();
    }
    // v340 — 지도 키가 있어도 홈 카드엔 작은 지도·번호가 없고, 목록 행은 그대로 · 세 카드 모양이 같음 · 지도 탭은 그대로 열림.
    {
      reach328On=true; reach328Fail=''; reach328Missing=false; fakeMap338=true;
      await page.reload(); await page.evaluate(()=>document.fonts.ready);
      for(const width of [390,1264]){
        await page.setViewportSize({width,height:900});
        await page.evaluate(()=>{window.yk208Navigate&&window.yk208Navigate('home');DEAL.cache.clear();Object.assign(S,{cash:20000,income:7000,sgg:'11320',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null,compareCodes:['11305','11680']});showResult(false);});
        await page.waitForFunction(()=>document.querySelectorAll('#heroDeals .hd-list li').length>0,null,{timeout:15000});
        await page.waitForTimeout(300);
        const v=await page.evaluate(()=>({key:!!(document.querySelector('meta[name="naver-map-keyid"]')?.content||'').trim(),map:!!document.getElementById('heroDealsMap'),no:document.querySelectorAll('#heroDeals .hd-no').length,rows:document.querySelectorAll('#heroDeals .hd-list li').length,hdHidden:getComputedStyle(document.getElementById('heroDeals')).display==='none',
          t:['#easyMarket h2','#reach328 h2','#payTile .ans-k'].map(q=>{const c=getComputedStyle(document.querySelector(q));return c.fontSize+'/'+c.fontWeight}),
          pad:['easyMarket','reach328','payTile'].map(i=>getComputedStyle(document.getElementById(i)).paddingTop),gap:getComputedStyle(document.getElementById('viewAnswer')).rowGap,over:document.documentElement.scrollWidth>innerWidth+1}));
        ok(v.key && !v.map && v.no===0 && v.rows>0 && v.hdHidden, `v340·v354 ${width}px 홈 카드: 작은 지도·번호 없음 · 대표 거래 목록은 홈에서 감춤(실거래 탭에 같은 목록)`, JSON.stringify(v));
        /* v404 — 카드 제목 16 → 19(아이콘 36과 짝 · 오너 D2 승인) — 세 카드가 같은 크기라는 목적은 그대로 */
        ok(v.t.every(x=>x==='19px/700') && v.pad.every(x=>x==='16px') && v.gap==='12px' && !v.over, `v340·v354·v404 ${width}px 세 카드(홈 2 · 실거래 탭 25개 구 1) 제목 19px/700 같음 · 안쪽 16px · 카드 사이 12px`, JSON.stringify(v));
      }
      await page.evaluate(()=>window.yk208Navigate('map'));
      await page.waitForFunction(()=>window.__ykMap&&window.__ykMap.isReady(),null,{timeout:15000});
      ok(true,'v340 지도 탭은 그대로 열림');
      ok(!errors.length, 'v340 JavaScript 오류 없음', errors.join(' | '));
      fakeMap338=false; reach328On=false;
      await page.reload(); await page.evaluate(()=>document.fonts.ready); mode='success'; await seed();
    }
    // v341 — 맨 아래: 저장·공유 두 버튼 한 줄 → 카드 「더 알아보기」(줄 4개, 48px 이상) → 안내문은 접히지 않고 보임 · 옮긴 뒤에도 관련 글·접기·다시 계산이 작동.
    {
      mode='success'; await page.reload(); await page.evaluate(()=>document.fonts.ready); await seed();
      for(const width of [320,390,1264]){
        await page.setViewportSize({width,height:900}); await page.waitForTimeout(200);
        const v=await page.evaluate(()=>{const R=e=>e.getBoundingClientRect();const sec=document.getElementById('more341');const s1=document.getElementById('outSave'),s2=document.getElementById('outCopy');
          const lead=document.querySelector('#viewNext>.easy-next-card>.nx-lead');
          return {sec:!!sec&&sec.offsetHeight>0,parent:sec&&sec.parentElement.id,prev:sec&&sec.previousElementSibling&&sec.previousElementSibling.contains(s1),
            rows:sec?[...sec.querySelectorAll('.more341-list>*')].map(e=>e.id||e.className.split(' ')[0]):[],
            rowH:[...document.querySelectorAll('#more341 :is(#relatedReadLink,.external-links>summary,.result-notes321>summary,#restartBtn)')].map(e=>Math.round(R(e).height)),
            title:document.getElementById('relatedReadTitle').textContent.trim(),navShown:!document.getElementById('relatedRead').hidden,
            sameRow:Math.round(R(s1).top)===Math.round(R(s2).top)&&Math.abs(R(s1).width-R(s2).width)<2&&R(s1).height>=48,
            lead:!!lead&&!!sec&&lead.offsetHeight>0&&!lead.closest('details')&&R(lead).top>R(sec).bottom,
            fold:!!document.querySelector('#more341 .result-notes321')&&!document.querySelector('#more341 .result-notes321').open&&!document.getElementById('footNote').checkVisibility(), /* 닫힌 details 안은 offsetHeight 가 남음(크롬) */over:document.documentElement.scrollWidth>innerWidth+1};});
        ok(v.sec && v.parent==='viewNext' && v.prev && JSON.stringify(v.rows)==='["relatedRead","external-links","result-notes321","restartWrap"]' && v.rowH.length===4 && v.rowH.every(h=>h>=48), `v341 ${width}px 저장·공유 다음에 카드 「더 알아보기」 · 줄 4개 순서 · 높이 48px 이상`, JSON.stringify(v));
        ok(v.navShown && v.title.length>0 && v.sameRow && v.lead && v.fold && !v.over, `v341 ${width}px 관련 글 채워짐 · 두 버튼 한 줄 같은 폭 · 안내문 카드 밖에 보임 · 계산 기준은 접힘 · 가로 넘침 없음`, JSON.stringify(v));
      }
      await page.setViewportSize({width:390,height:844});
      if(await page.locator('#more341 .external-links>summary').count()) await page.locator('#more341 .external-links>summary').click();
      ok(await page.locator('#more341 #outNaver').count()===1 && await page.locator('#outNaver').isVisible() && await page.locator('#outHogang').isVisible(), 'v341 「외부 사이트에서 확인」을 누르면 두 링크가 보임');
      if(await page.locator('#more341 .external-links>summary').count()) await page.locator('#more341 .external-links>summary').click();
      // v372 — 「더 알아보기」 안 줄 모양 한 벌: 모든 줄 끝 표시가 같은 칸(가운데 오른쪽에서 10px ±1) · 펼친 내용이 줄 글자와 같은 왼쪽 · 두 접기 간격이 같음(±2px)
      for(const width of [320,390,1264]){
        await page.setViewportSize({width,height:900}); await page.waitForTimeout(120);
        const m372=await page.evaluate(()=>{
          const sec=document.getElementById('more341'), dets=[...sec.querySelectorAll('details')], was=dets.map(d=>d.open); dets.forEach(d=>d.open=true);
          const tb=el=>{const rg=document.createRange();rg.selectNodeContents(el);const rs=[...rg.getClientRects()].filter(x=>x.width>0);return {left:Math.min(...rs.map(x=>x.left)),top:Math.min(...rs.map(x=>x.top)),bottom:Math.max(...rs.map(x=>x.bottom))};};
          const rows=[...sec.querySelectorAll(':is(#relatedReadLink,.external-links>summary,.result-notes321>summary,#restartBtn)')];
          /* v405 — 다시 계산 줄은 왼쪽 되돌이 아이콘(32)이 생겨 오른쪽 되돌이 표시를 감춤(같은 그림 두 번) → 앞 3줄만 같은 칸 · 다시 계산은 감춤 확인 */
          const icon=rows.filter(e=>e.id!=='restartBtn').map(e=>{const a=getComputedStyle(e,'::after');return a.content==='none'||a.display==='none'?null:Math.round(parseFloat(a.right)+parseFloat(a.width)/2);});
          const rsHid=getComputedStyle(document.getElementById('restartBtn'),'::after').display==='none' && getComputedStyle(document.getElementById('restartBtn'),'::before').width==='32px';
          const arw=[...sec.querySelectorAll('.external-links>a.mini>.arw')].map(e=>{const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return {c:Math.round(p.right-(r.left+r.width/2)),glyph:getComputedStyle(e).fontSize!=='0px',img:getComputedStyle(e).backgroundImage!=='none',aria:e.getAttribute('aria-hidden')};});
          const sumL=Math.round(tb(sec.querySelector('.external-links>summary')).left);
          const inner=[...sec.querySelectorAll('.external-links>a.mini b,.result-notes321>p')].filter(e=>e.getClientRects().length).map(e=>Math.round(tb(e).left));
          const lines=[...sec.querySelectorAll('.external-links>a.mini')].map(e=>getComputedStyle(e).borderTopWidth);
          const gap=dets.map(d=>{const sm=d.querySelector('summary'),it=[...d.children].filter(c=>c!==sm&&c.getClientRects().length);return {first:Math.round(tb(it[0]).top-tb(sm).bottom),last:Math.round(d.getBoundingClientRect().bottom-tb(it[it.length-1]).bottom)};});
          dets.forEach((d,i)=>d.open=was[i]);
          return {icon,rsHid,arw,sumL,inner,lines,gap};});
        ok(m372.icon.length===3 && m372.icon.every(c=>c!==null && Math.abs(c-10)<=1) && m372.rsHid && m372.arw.length===2 && m372.arw.every(a=>Math.abs(a.c-10)<=1 && !a.glyph && a.img && a.aria==='true')
           && m372.inner.every(x=>Math.abs(x-m372.sumL)<=1) && m372.lines.every(w=>w==='0px')
           && Math.abs(m372.gap[0].first-m372.gap[1].first)<=2 && Math.abs(m372.gap[0].last-m372.gap[1].last)<=2,
           `v372·v405 ${width}px 「더 알아보기」 줄 끝 표시 같은 칸(다시 계산은 왼쪽 아이콘으로 · ↗ 그림) · 펼친 내용 왼쪽 = 줄 글자 · 두 접기 간격 같음`, JSON.stringify(m372));
      }
      await page.setViewportSize({width:390,height:844});
      ok(!errors.length, 'v341 JavaScript 오류 없음', errors.join(' | '));
    }
    // v342 — 홈 요약과 지도 탭 머리가 같은 숫자 · 목록 머리줄 범위(「조금 넘는 집도」면 ~110%) · 안내문 두 줄이 같은 왼쪽에서 시작.
    {
      mode='success'; await page.reload(); await page.evaluate(()=>document.fonts.ready); await page.setViewportSize({width:390,height:844}); await seed();
      await page.waitForFunction(()=>DEAL.status==='ready',null,{timeout:15000}); await page.waitForTimeout(300);
      const h=await page.evaluate(()=>{const b=Math.floor(LASTVIEW.price/10000);const m=distributionModel(DEAL.items||[],b,typeof DEAL.pass==='function'?DEAL.pass:null);const el=document.getElementById('heroContext');
        const n=document.querySelector('#viewNext>.easy-next-card>.nx-lead');const r=document.createRange();r.selectNodeContents(n);const lefts=[...new Set([...r.getClientRects()].map(x=>Math.round(x.left)))];
        return {text:el.innerText,data:el.dataset.v342,want:m.under+'/'+m.n,n:m.n,lines:r.getClientRects().length,lefts};});
      ok(h.n>0 && h.data===h.want && /내 예상 집값 이하/.test(h.text) && !/맞는 실거래/.test(h.text), 'v342 홈 요약은 거래 건수 기준(예상 집값 이하 비율)', JSON.stringify(h));
      ok(h.lefts.length===1, 'v342 안내문 첫 문장 — 모든 줄이 같은 왼쪽에서 시작', JSON.stringify(h));
      await page.evaluate(()=>window.yk208Navigate('map')); await page.waitForTimeout(400);
      await page.evaluate(()=>{if(typeof paintDeals==='function')paintDeals(DEAL.lastPrice);});
      const mtab=await page.evaluate(()=>({ins:document.querySelector('#dealDistribution .dd-insight')?.innerText||'',lead:document.getElementById('dealLead').innerText,home:document.getElementById('heroContext').innerText}));
      const pc=t=>(t.match(/(\d+)%/)||[])[1]||(/1% 미만/.test(t)?'<1':/모든 거래/.test(t)?'all':/거래(가)? 없/.test(t)?'none':'?');
      ok(mtab.ins && pc(mtab.ins)===pc(mtab.home) && pc(mtab.home)!=='?', 'v342 지도 탭 머리와 홈 요약의 비율이 같음', JSON.stringify(mtab));
      ok(/^예상 집값 85~100% 단지 \d+곳/.test(mtab.lead), 'v342 목록 머리줄 「예상 집값 85~100% 단지 N곳」', mtab.lead);
      const over=await page.evaluate(()=>{const k=DEAL.over;DEAL.over=true;paintDeals(DEAL.lastPrice);const t=document.getElementById('dealLead').innerText;DEAL.over=k;paintDeals(DEAL.lastPrice);return t;});
      ok(/^예상 집값 85~110% 단지 \d+곳/.test(over), 'v342 「조금 넘는 집도」를 켜면 85~110%', over);
      ok(!errors.length, 'v342 JavaScript 오류 없음', errors.join(' | '));
      await page.evaluate(()=>window.yk208Navigate('home'));
    }
    // v343 — 첫 카드: 누르는 것만 상자 · 금액 단위 글자 크기 = 총 필요 금액 · 320px 점과 이름 한 줄 · 두 금액 같은 높이 · 대출 조절 뒤에도 감쌈.
    {
      const fund=()=>page.evaluate(()=>{const q=s=>document.querySelector(s),cs=s=>q(s)?getComputedStyle(q(s)):{};const tiles=[...document.querySelectorAll('#easyBalance .rlab>div')];
        const t=q('#easyBalance .rlab>div:last-child .t'),tr=t.getBoundingClientRect(),dot=getComputedStyle(t,'::before');
        const lab=document.createRange();lab.selectNodeContents(t.firstChild);const lr=lab.getBoundingClientRect();
        return {bg:tiles.map(d=>getComputedStyle(d).backgroundColor),bw:tiles.map(d=>getComputedStyle(d).borderTopWidth),costBg:cs('#easyCostOpen').backgroundColor,
          unit:cs("#easyCash i.u").fontSize,heroUnit:cs('#heroAmount i.u').fontSize,cash:q('#easyCash').textContent,loan:q('#easyLoan').textContent,bsCash:q('#bsCash').textContent,bsLoan:q('#bsLoan').textContent,
          wrapped:!!q('#easyCash i.u')&&!!q('#easyLoan i.u'),dir:getComputedStyle(t).flexDirection,dotTop:Math.round(tr.top+parseFloat(dot.marginTop||0)),labTop:Math.round(lr.top),labH:Math.round(lr.height),
          nTops:[...document.querySelectorAll('#easyBalance .rlab .n')].map(n=>Math.round(n.getBoundingClientRect().top))};});
      const amt=s=>s.replace(/\(.*$/,'').trim();
      for(const w of [320,390]){
        await page.setViewportSize({width:w,height:844});
        await page.evaluate(()=>{Object.assign(S,{cash:30000,income:8000,sgg:'11200',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null,noLoan:false,loanCut:0});showResult(false);window.yk208Navigate('home');});
        await page.waitForTimeout(300);const f=await fund();
        ok(f.bg.every(b=>b==='rgba(0, 0, 0, 0)') && f.bw.every(b=>b==='0px') && f.costBg!=='rgba(0, 0, 0, 0)', `v343 ${w}px 상자는 「포함된 부대비용」 하나만`, JSON.stringify(f));
        ok(f.wrapped && f.unit===f.heroUnit && f.cash===amt(f.bsCash) && f.loan===amt(f.bsLoan), `v343 ${w}px 금액 단위 글자 = 총 필요 금액(${f.heroUnit}) · 글자는 원래와 같음`, JSON.stringify(f));
        ok(f.dir==='row' && f.nTops.length===2 && f.nTops[0]===f.nTops[1], `v343 ${w}px 이름 줄 가로 · 두 금액 같은 높이`, JSON.stringify(f));
      }
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>{Object.assign(S,{lockedPrice:300000000,loanCut:0});showResult(false);}); await page.waitForTimeout(300);
      await page.evaluate(()=>{const r=document.getElementById('loanCutRange');r.value=String(Math.floor(+r.max/2/100)*100);r.dispatchEvent(new Event('input'));}); await page.waitForTimeout(200);
      const g=await fund();
      ok(await page.locator('#loanCutToggle').isVisible() && g.wrapped && g.loan===amt(g.bsLoan) && g.cash===amt(g.bsCash), 'v343 대출을 줄여도 금액·단위 감쌈 그대로', JSON.stringify(g));
      await page.evaluate(()=>{Object.assign(S,{lockedPrice:null,loanCut:0});showResult(false);});
      ok(!errors.length, 'v343 JavaScript 오류 없음', errors.join(' | '));
      // v348 — 홈 실거래 비교: 요약 줄이 「인근 지역 포함」을 말하면 아래 「넓혔어요」 안내는 감춤 · 요약이 없을 때(조회 일부 실패)는 그대로.
      const v348=await page.evaluate(async()=>{const note=document.getElementById('resultScopeNote'),ctx=document.getElementById('heroContext');
        const keep={st:DEAL.status,wide:DEAL.wide,cmp:DEAL.compareCodes,items:DEAL.items,html:ctx.innerHTML,v:ctx.dataset.v342,hid:note.hidden};
        const tick=()=>new Promise(r=>setTimeout(r,30));
        DEAL.status='ready';DEAL.wide=true;DEAL.compareCodes=[];DEAL.items=Object.assign([],{queryIssues:[]});
        ctx.dataset.v342='1/2';ctx.innerHTML='<span class="hc-t">거래의 <b>50%</b>가 내 예상 집값 이하 · <span class="hc-nw">인근 지역 포함</span> · <span class="hc-nw">최근 3개월</span></span>';
        note.hidden=false;await tick();const a=note.hidden;
        DEAL.items=Object.assign([],{queryIssues:[{lawd:'11200',ymd:202610}]});note.hidden=false;await tick();const b=note.hidden;
        DEAL.items=Object.assign([],{queryIssues:[]});DEAL.compareCodes=['11215'];note.hidden=false;await tick();const c=note.hidden;
        Object.assign(DEAL,{status:keep.st,wide:keep.wide,compareCodes:keep.cmp,items:keep.items});ctx.innerHTML=keep.html;if(keep.v)ctx.dataset.v342=keep.v;else delete ctx.dataset.v342;note.hidden=keep.hid;
        return {a,b,c};});
      ok(v348.a===true && v348.b===false && v348.c===false, 'v348 「넓혔어요」 안내 — 요약 줄과 겹칠 때만 홈에서 감춤(조회 일부 실패 · 비교 지역일 때는 그대로)', JSON.stringify(v348));
    }
    // v330 — 지역 시트: 서울 자치구 3곳을 같은 목록에서. 누른 뒤 칸 자리·스크롤이 그대로.
    {
      reach328On=false;
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>{restart();});
      await page.locator('#welcomeStart232').click().catch(()=>{});
      await page.getByRole('button',{name:'매수 지역'}).first().click();
      await page.getByRole('button',{name:'서울',exact:true}).first().click();
      const snap=()=>page.evaluate(()=>{const p=document.getElementById('regionPane');let sc=null;for(let n=p;n&&n!==document.body;n=n.parentElement){const o=getComputedStyle(n).overflowY;if((o==='auto'||o==='scroll')&&n.scrollHeight>n.clientHeight+1){sc=n;break}}
        const c=document.querySelector('.pick330 [data-pick="11215"]').getBoundingClientRect();
        return {sgg:S.sgg,cmp:(S.compareCodes||[]).join(),top:sc?sc.scrollTop:-1,y:Math.round(c.y),h:Math.round(c.height),btn:document.getElementById('qClose').innerText,st:document.getElementById('pick330Status').innerText,tags:[...document.querySelectorAll('.pick330 .tag330')].map(t=>t.textContent+t.parentElement.dataset.pick).join(),fold:!!document.querySelector('#regionPane .primary-region,#regionPane #cmpToggle')};});
      await page.evaluate(()=>{const p=document.getElementById('regionPane');for(let n=p;n&&n!==document.body;n=n.parentElement){if(n.scrollHeight>n.clientHeight+1&&/auto|scroll/.test(getComputedStyle(n).overflowY)){n.scrollTop=140;break}}});
      const s0=await snap();
      await page.locator('.pick330 [data-pick="11215"]').click();const s1=await snap();
      await page.locator('.pick330 [data-pick="11200"]').click();await page.locator('.pick330 [data-pick="11140"]').click();const s3=await snap();
      ok(s0.top>0 && s1.sgg==='11215' && s3.cmp==='11200,11140' && s3.btn==='3개 지역 선택 완료' && s3.tags.split(',').sort().join()==='기준11215,비교11140,비교11200', 'v330 같은 목록에서 3곳 — 기준 1 · 비교 2 · 꼬리표', JSON.stringify(s3));
      ok([s1,s3].every(s=>s.top===s0.top && s.y===s0.y && s.h===s0.h) && !s3.fold, 'v330 누른 뒤 스크롤·칸 자리 그대로 · 접히는 상자 없음', JSON.stringify([s0.top,s0.y,s1.top,s1.y,s3.top,s3.y]));
      await page.locator('.pick330 [data-pick="11170"]').click();const s4=await snap();
      ok(s4.sgg==='11215' && s4.cmp==='11200,11140' && /3곳까지/.test(s4.st), 'v330 네 번째 — 안내만 · 선택 그대로');
      await page.locator('.pick330 [data-pick="11215"]').click();const s5=await snap();
      ok(s5.sgg==='11200' && s5.cmp==='11140' && s5.btn==='2개 지역 선택 완료' && s5.top===s0.top, 'v330 기준 해제 → 먼저 고른 비교가 기준');
      if(process.env.YK_AXE_PATH){
        await page.addScriptTag({path:process.env.YK_AXE_PATH});
        const v=await page.evaluate(async()=> (await axe.run(document.getElementById('qSheet'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
        ok(!v.length,'v330 지역 시트 접근성(3곳 고른 상태)',JSON.stringify(v));
      }
      // v334 — 앱 안 브라우저 크기(393×700)에서 구 칸이 다섯 줄 넘게 보임(이전 1~2줄) · 안내는 목록 아래에 남음
      await page.setViewportSize({width:393,height:700});
      const v334=await page.evaluate(()=>{const p=document.getElementById('regionPane');let sc=null;for(let n=p;n&&n!==document.body;n=n.parentElement){const o=getComputedStyle(n).overflowY;if(o==='auto'||o==='scroll'){sc=n;break}}
        sc.scrollTop=0;const b=sc.getBoundingClientRect();const chips=[...p.querySelectorAll('.pick330 [data-pick]')];
        const vis=chips.filter(c=>{const r=c.getBoundingClientRect();return r.top>=b.top-1&&r.bottom<=b.bottom+1}).length;
        const grid=p.querySelector('.taggrid'),tip=p.querySelector('.pick330-tip'),zc=document.querySelector('#qSheet .zonegrid .zonecard');
        return {vis,tipBelow:!!tip&&!!(grid.compareDocumentPosition(tip)&Node.DOCUMENT_POSITION_FOLLOWING)&&/규제지역/.test(tip.textContent),zoneH:Math.round(zc.getBoundingClientRect().height),title:!!p.querySelector('.pane-title.sr-only'),sheetTop:Math.round(document.getElementById('qSheet').getBoundingClientRect().top),over:document.documentElement.scrollWidth>innerWidth+1};});
      ok(v334.vis>=15 && v334.zoneH===44 && v334.sheetTop<=16, 'v334 구 칸이 다섯 줄 이상 보임(393×700) · 위 버튼 44px · 시트가 화면 위까지', JSON.stringify(v334));
      ok(v334.tipBelow && v334.title && !v334.over, 'v334 규제지역 안내는 목록 아래에 남음 · 제목은 낭독용으로 남음');
      await page.setViewportSize({width:390,height:844});
      await page.locator('#qClose').click();
      mode='success';await seed();reach328On=true;
    }
    // v352 · v353 — 첫 화면 한 장(390×844) · 입력 2단계 · 입력하면 다음 칸으로
    {
      reach328On=false;
      await page.setViewportSize({width:390,height:844});
      await page.waitForTimeout(400);   /* 앞 검사(v330) 「선택 완료」가 240ms 뒤 여는 주택 보유 시트까지 기다렸다가 닫음(닫힘 280ms) */
      await page.evaluate(()=>{if(!document.getElementById('qSheet').hidden)closeSheet('q');restart();});
      await page.waitForFunction(()=>document.getElementById('qSheet').hidden&&document.getElementById('qBack').hidden,null,{timeout:3000}).catch(()=>{});
      const w352=await page.evaluate(()=>{const w=document.getElementById('welcome232');w.hidden=false;document.body.classList.add('welcome232-on');window.scrollTo(0,0);return {h:document.documentElement.scrollHeight,btn:document.getElementById('welcomeStart232').getBoundingClientRect().bottom};});
      ok(w352.h<=844 && w352.btn<=844, 'v352 첫 화면이 390×844 한 장 안(시작 버튼 포함)', JSON.stringify(w352));
      await page.locator('#welcomeStart232').click();
      const st=()=>page.evaluate(()=>({stage:window.__yk353&&window.__yk353.stage(),next:!document.getElementById('stepNext353').hidden,nextDis:document.getElementById('stepNext353').disabled,
        cta:!!document.getElementById('ctaBtn').getClientRects().length,cash:!!document.getElementById('main-cash')?.getClientRects().length,region:!!document.querySelector('#crows [data-mode="region"]')?.getClientRects().length,
        sum:document.getElementById('stepSum353')?.innerText.trim()||'',focus:document.activeElement&&document.activeElement.id,sheet:!document.getElementById('qSheet').hidden,qmode:typeof QMODE!=='undefined'?QMODE:null}));
      const a=await st();
      ok(a.stage===1 && a.next && a.nextDis && !a.cta && !a.cash && a.region, 'v353 1단계 — 지역·주택만 · 「다음」은 둘 다 고르기 전 꺼짐 · 계산하기 숨김', JSON.stringify(a));
      if(process.env.YK_AXE_PATH){
        if(!(await page.evaluate(()=>typeof axe!=='undefined'))) await page.addScriptTag({path:process.env.YK_AXE_PATH});
        const v=await page.evaluate(async()=> (await axe.run(document.getElementById('funnel'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
        ok(!v.length,'v353 1단계 입력 화면 접근성',JSON.stringify(v));
      }
      await page.getByRole('button',{name:'매수 지역'}).first().click();
      await page.getByRole('button',{name:'서울',exact:true}).first().click();
      await page.locator('.pick330 [data-pick="11440"]').click();
      await page.locator('#qClose').click(); await page.waitForTimeout(700);
      const b=await st();
      ok(b.stage===1 && b.sheet && b.qmode==='house', 'v353 지역 선택 완료 → 주택 보유 시트(v309 그대로)', JSON.stringify(b));
      await page.locator('#houseSeg [data-house="none"]').click(); await page.waitForTimeout(800);
      const c=await st();
      ok(c.stage===2 && !c.sheet && c.cash && c.region && c.cta && c.focus==='main-cash' && await page.evaluate(()=>!document.getElementById('stepSum353').getClientRects().length), 'v353·v369 무주택 누름 → 시트 닫힘 → 2단계 · 현금 칸 포커스 · 지역 · 주택은 「내 조건」과 같은 두 줄(요약 한 줄 대신)', JSON.stringify(c));
      await page.keyboard.type('20000'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
      const d=await st();
      ok(d.focus==='main-income' && await page.evaluate(()=>S.cash===20000), 'v353 현금 칸 「다음」 → 소득 칸 포커스', JSON.stringify(d));
      await page.keyboard.type('7000'); await page.keyboard.press('Enter'); await page.waitForTimeout(700);
      const e=await st();
      ok(e.sheet && e.qmode==='debt' && await page.evaluate(()=>S.income===7000), 'v353 소득 칸 「다음」 → 기존 대출 시트(비어 있을 때)', JSON.stringify(e));
      await page.locator('#debtNone').click(); await page.waitForTimeout(800);
      const f=await st();
      ok(!f.sheet && f.focus==='ctaBtn' && await page.evaluate(()=>!document.getElementById('ctaBtn').disabled && document.getElementById('result').hidden), 'v353 기존 대출 없음 → 계산하기 버튼으로(계산은 누를 때만)', JSON.stringify(f));
      if(process.env.YK_AXE_PATH){
        const v=await page.evaluate(async()=> (await axe.run(document.getElementById('funnel'),{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
        ok(!v.length,'v353 2단계 입력 화면 접근성',JSON.stringify(v));
      }
      // v369 — 2단계 숫자 칸 = 한 줄(이름 왼쪽 · 칸 오른쪽 · 금액 읽기 이름 아래 · 도움말 전체 폭) · 지역 줄과 같은 줄 구성
      for(const w of [390,320]){
        await page.setViewportSize({width:w,height:844}); await page.waitForTimeout(150);
        const i369=await page.evaluate(()=>{const R=e=>e.getBoundingClientRect();const m=document.getElementById('main-cash').closest('.inline-money'),lb=R(m.querySelector('label')),fd=R(m.querySelector('.inline-money-field')),ec=m.querySelector('.inline-echo'),hp=R(m.querySelector('.inline-help')),mr=R(m),inp=document.getElementById('main-cash');
          const rg=R(document.querySelector('#crows [data-mode="region"]'));
          return {above:lb.bottom<=fd.top+1,wide:fd.width>=mr.width-48,helpField:hp.width>=fd.width-1,echoUnder:!ec.textContent.trim()||R(ec).top>=fd.bottom-2,helpWide:hp.width>=mr.width-40,fit:inp.scrollWidth<=inp.clientWidth,fs:parseFloat(getComputedStyle(inp).fontSize),fh:Math.round(fd.height),rgW:Math.round(rg.width),mW:Math.round(mr.width)};});
        /* v395 — v369 「한 줄(이름 ─ 칸)」을 옮김: 오너 2026-11-27 시안 승인(이름 위 · 값 아래 한 가지 모양). 목적(안 잘림 · 16px 이상 · 누르기 높이 · 칸 폭 같음)은 그대로. */
        ok(i369.above && i369.wide && i369.echoUnder && i369.helpField && i369.fit && i369.fs>=16 && i369.fh>=44 && Math.abs(i369.rgW-i369.mW)<=1, `v369·v395 ${w}px 2단계 현금 칸 — 이름 위 · 칸 전체 폭 · 금액 읽기 칸 아래 · 도움말 = 칸 폭 · 「20,000」 안 잘림 · 글자 16px 이상 · 칸 높이 44 이상`, JSON.stringify(i369));
      }
      await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(150);
      reach328On=true;mode='success';await seed();
      await page.evaluate(()=>window.yk208Navigate('conditions')); await page.waitForTimeout(300);
      const k=await st();
      ok(k.stage===0 && k.cash && k.region && k.cta && !k.next, 'v353 결과를 본 뒤 「내 조건」은 한 화면 그대로', JSON.stringify(k));
      await page.evaluate(()=>window.yk208Navigate('home')); await page.waitForTimeout(300);
      // v354 — 홈: 하단 탭 「실거래」 · 실거래 비교는 한 줄(요약 + 「실거래 보기」가 같은 줄) · 홈 높이 · 누르면 실거래 탭
      for(const width of [320,390,1264]){
        await page.setViewportSize({width,height:844}); await page.waitForTimeout(150);
        const h354=await page.evaluate(()=>{const m=document.getElementById('easyMarket'),c=document.getElementById('heroContext').getBoundingClientRect(),o=document.getElementById('marketOpen').getBoundingClientRect();
          return {tab:document.querySelector('[data-v208-tab="map"]').innerText.trim(),h:Math.round(m.getBoundingClientRect().height),same:o.top<c.bottom&&c.top<o.bottom,right:o.left>=c.right,below:o.top>=c.bottom-1&&o.width>=m.getBoundingClientRect().width-60,   /* v369 — 374px 이하는 버튼이 문장 아래 전체 폭 */ txt:c.height>0,doc:document.documentElement.scrollHeight,reach:!!document.getElementById('reach328').getClientRects().length,over:document.documentElement.scrollWidth>innerWidth+1};});
        ok(h354.tab==='실거래' && h354.h<=(width<360?320:290) && (width<375 ? h354.below : (h354.same && h354.right)) && h354.txt && !h354.reach && !h354.over && (width>=960 || h354.doc<=2150) /* v404 — D2 목록 줄 4개(현금 · 대출 · 집값 · 부대비용)로 홈이 약 180px 길어짐(390: 1795 → 1965 · 320: 1845 → 2098) — 오너가 시안 D2로 고름. 옛 한도 1850 */, `v354·v358·v363 ${width}px 홈 — 탭 「실거래」 · 실거래 비교(「4」 + 미니 분포 + 요약 옆 버튼) · 25개 구 카드 없음`, JSON.stringify(h354));
      }
      await page.setViewportSize({width:390,height:844});
      await page.locator('#marketOpen').click(); await page.waitForTimeout(300);
      ok(await page.evaluate(()=>!document.getElementById('viewDeals').hidden && document.getElementById('viewAnswer').hidden!==false || !document.getElementById('viewDeals').hidden), 'v354 「실거래 보기」 → 실거래 탭');
      await page.evaluate(()=>window.yk208Navigate('home')); await page.waitForTimeout(200);
    }
    // v355 — 터치 화면(모바일 흉내): 현금 칸 「다음」→ 소득 칸(포커스 유지) → 「다음」→ 기존 대출 시트 → 없음 → 계산하기 · 값이 있으면 「완료」
    {
      const ctx355=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      const p=await ctx355.newPage(); const err355=[]; p.on('pageerror',e=>err355.push(e.message));
      await p.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
        if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,items:[],total:0}});
        const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));
        if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
      await p.goto('http://yeongkkeul.test/'); await p.evaluate(()=>document.fonts.ready);
      const st=()=>p.evaluate(()=>({bar:!document.getElementById('kbNext355').hidden,label:document.getElementById('kbNextBtn355').textContent,dis:document.getElementById('kbNextBtn355').disabled,focus:document.activeElement.id,sheet:!document.getElementById('qSheet').hidden,qmode:typeof QMODE!=='undefined'?QMODE:null}));
      await p.locator('#welcomeStart232').tap();
      await p.evaluate(()=>{S.sgg='11440';S.sido='서울특별시';S.group='seoul';S.houseStatus='none';renderAnswered();syncCta();});
      await p.locator('#stepNext353').tap(); await p.waitForTimeout(200);
      await p.locator('#main-cash').tap(); await p.waitForTimeout(150);
      const a=await st();
      await p.keyboard.type('20000'); await p.waitForTimeout(100);
      const b=await st();
      ok(a.bar && a.label==='다음' && a.dis && a.focus==='main-cash' && !b.dis, 'v355 현금 칸을 누르면 「다음」 버튼(비어 있으면 꺼짐 · 입력하면 켜짐)', JSON.stringify([a,b]));
      await p.locator('#kbNextBtn355').tap(); await p.waitForTimeout(200);
      const c=await st();
      ok(c.focus==='main-income' && c.bar && c.dis, 'v355 「다음」→ 소득 칸 포커스(같은 터치 · 키보드 유지)', JSON.stringify(c));
      await p.keyboard.type('7000'); await p.waitForTimeout(100);
      await p.locator('#kbNextBtn355').tap(); await p.waitForTimeout(700);
      const d=await st();
      ok(d.sheet && d.qmode==='debt' && !d.bar && await p.evaluate(()=>S.cash===20000&&S.income===7000), 'v355 소득 칸 「다음」→ 기존 대출 시트', JSON.stringify(d));
      await p.locator('#debtNone').tap(); await p.waitForTimeout(800);
      await p.locator('#main-income').tap(); await p.waitForTimeout(150);
      const e=await st();
      await p.locator('#kbNextBtn355').tap(); await p.waitForTimeout(300);
      const f=await st();
      ok(e.label==='완료' && f.focus==='ctaBtn' && !f.bar && await p.evaluate(()=>document.getElementById('result').hidden), 'v355 값이 다 차면 「완료」→ 계산하기 버튼(계산은 누를 때만)', JSON.stringify([e,f]));
      ok(!err355.length, 'v355 터치 화면 JavaScript 오류 없음', err355.join(' | '));
      await ctx355.close();
      // v367 — 아이폰 흉내(키보드가 올라와 화면이 짧음): 「다음」→ 소득 칸, 아이폰처럼 칸 아래 끝만 키보드 위로 올린 뒤 → 칸 묶음이 「다음」 줄에 안 가림
      for(const [w,h] of [[390,470],[320,420]]){
        const c367=await browser.newContext({viewport:{width:w,height:h},isMobile:true,hasTouch:true});
        const q=await c367.newPage();
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));
          if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        await q.locator('#welcomeStart232').tap();
        await q.evaluate(()=>{S.sgg='11440';S.sido='서울특별시';S.group='seoul';S.houseStatus='none';renderAnswered();syncCta();});
        await q.locator('#stepNext353').tap(); await q.waitForTimeout(200);
        await q.locator('#main-cash').tap(); await q.waitForTimeout(450); await q.keyboard.type('20000'); await q.waitForTimeout(100);
        await q.locator('#kbNextBtn355').tap(); await q.waitForTimeout(80);
        await q.evaluate(()=>{const i=document.activeElement.getBoundingClientRect();window.scrollBy(0,i.bottom-innerHeight+6);if(window.visualViewport)visualViewport.dispatchEvent(new Event('resize'));});
        await q.waitForTimeout(400);
        const k367=await q.evaluate(()=>{const el=document.activeElement,b=el.closest('.inline-money')||el,r=b.getBoundingClientRect(),bar=document.getElementById('kbNext355'),br=bar.getBoundingClientRect(),hd=document.querySelector('.appbar').getBoundingClientRect();return {id:el.id,bar:!bar.hidden,covered:Math.max(0,Math.round(r.bottom-br.top)),underHead:Math.max(0,Math.round(hd.bottom-r.top))};});
        ok(k367.id==='main-income' && k367.bar && k367.covered===0 && k367.underHead===0, `v367 ${w}×${h} 「다음」→ 소득 칸 묶음이 「다음」 줄 · 상단 바에 안 가림(v366 약 110px 가림)`, JSON.stringify(k367));
        await c367.close();
      }
      // v370 — 아이폰 캡처(2026-11-20): 「다음」 줄이 화면 가운데에 남음 · 마지막 숫자 잘림 · 키보드 위 탭 막대
      {
        const c370=await browser.newContext({viewport:{width:393,height:600},isMobile:true,hasTouch:true});
        const q=await c370.newPage(); const e370=[]; q.on('pageerror',e=>e370.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));
          if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        await q.evaluate(()=>{Object.assign(S,{cash:300000,income:20000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForTimeout(300); await q.evaluate(()=>window.yk208Navigate('conditions')); await q.waitForTimeout(300);
        await q.locator('#main-income').tap(); await q.waitForTimeout(500);
        const a=await q.evaluate(()=>{const bar=document.getElementById('kbNext355');bar.style.transform='translateY(-165px)';bar.style.top='100px';window.scrollBy(0,-20);return true;});
        await q.waitForTimeout(250);
        const b=await q.evaluate(()=>{const bar=document.getElementById('kbNext355'),nav=document.getElementById('v208Nav'),pad=document.getElementById('kbPad370');
          return {bar:!bar.hidden,tf:bar.style.transform,barBottom:Math.round(bar.getBoundingClientRect().bottom),ih:innerHeight,nav:nav?getComputedStyle(nav).display:'none',pad:pad?parseFloat(pad.style.height):-1};});
        await q.evaluate(()=>document.activeElement.blur()); await q.waitForTimeout(250);
        const c=await q.evaluate(()=>{const p=document.getElementById('kbPad370');return {nav:getComputedStyle(document.getElementById('v208Nav')).display,pad:p?parseFloat(p.style.height):-1};});
        ok(b.bar && b.tf==='' && Math.abs(b.barBottom-b.ih)<=1 && b.nav==='none' && b.pad>=360 && c.nav!=='none' && c.pad===0, 'v370 「다음」 줄 — 화면을 움직이면 자리 다시 셈(옛 자리 165px 위 → 화면 아래) · 떠 있는 동안 탭 막대 감춤 · 아래 여유 칸(닫으면 0)', JSON.stringify({b,c}));
        // v371 — 줄은 보이는 영역(visualViewport) 아래 끝 기준으로 놓음(innerHeight에 기대지 않음): 가짜 보이는 영역(위 120 · 높이 300)으로 잼
        await q.locator('#main-income').tap(); await q.waitForTimeout(300);
        const v371=await q.evaluate(()=>{const bar=document.getElementById('kbNext355'),real=window.visualViewport;const fake={offsetTop:120,height:300,addEventListener(){},removeEventListener(){}};
          /* 아이폰처럼 innerHeight(700)가 고정 요소 기준 높이(600)와 다른 경우 — 옛 방식(bottom:0 + innerHeight로 끌어올림)은 100px 어긋남 */
          const ihD=Object.getOwnPropertyDescriptor(window,'innerHeight')||Object.getOwnPropertyDescriptor(Window.prototype,'innerHeight'),vvD=Object.getOwnPropertyDescriptor(window,'visualViewport')||Object.getOwnPropertyDescriptor(Window.prototype,'visualViewport');
          Object.defineProperty(window,'visualViewport',{configurable:true,get:()=>fake});Object.defineProperty(window,'innerHeight',{configurable:true,get:()=>700});
          window.__yk355.place();const r=bar.getBoundingClientRect();
          Object.defineProperty(window,'innerHeight',ihD);Object.defineProperty(window,'visualViewport',vvD);
          const tf=bar.style.transform;bar.style.top='';bar.style.transform='';window.__yk355.place();return {bottom:Math.round(r.bottom),tf,ih:innerHeight};});
        ok(v371.bottom===420 && v371.tf==='' && v371.ih===600, 'v371 「다음」 줄 아래 끝 = 보이는 영역 아래 끝(위 120 + 높이 300 = 420) · innerHeight가 달라도(아이폰) 그대로', JSON.stringify(v371));
        await q.evaluate(()=>document.activeElement.blur()); await q.waitForTimeout(200);
        const fits=[];
        for(const w of [393,320]){
          await q.setViewportSize({width:w,height:600}); await q.waitForTimeout(150);
          for(const v of ['300000','1000000']){
            await q.locator('#main-cash').tap(); await q.fill('#main-cash',v); await q.waitForTimeout(120);
            fits.push(await q.evaluate(([w,v])=>{const i=document.getElementById('main-cash'),c=getComputedStyle(i),cv=document.createElement('canvas').getContext('2d');cv.font=`${c.fontWeight} ${c.fontSize} ${c.fontFamily}`;
              const tw=cv.measureText(i.value).width+(i.value.length-1)*(parseFloat(c.letterSpacing)||0);return {w,v:i.value,fs:parseFloat(c.fontSize),slack:Math.round(i.clientWidth-tw)};},[w,v]));
          }
        }
        /* v395 — 칸이 전체 폭이 되어 7자리도 큰 글자(--t1)로 들어감 → 「7자리부터 16px」 대신 아이폰 차이(약 18px)보다 큰 여유 20px 이상을 잠금. */
        ok(fits.every(f=>f.slack>=20 && f.fs>=16), 'v370·v395 숫자 칸 — 「300,000」 · 「1,000,000」이 393 · 320px 칸 안에 20px 이상 여유(아이폰 안쪽 폭이 약 18px 좁음) · 16px 이상', JSON.stringify(fits));
        ok(!e370.length, 'v370 JavaScript 오류 없음', e370.join(' | '));
        await c370.close();
      }
      await page.evaluate(()=>window.yk208Navigate('conditions')); await page.waitForTimeout(200);
      const m355=await page.evaluate(()=>{const c=document.getElementById('main-cash');c.focus();return {vis:!!c.getClientRects().length,focus:document.activeElement===c,exists:!!document.getElementById('kbNext355'),hidden:document.getElementById('kbNext355').hidden};});
      ok(m355.vis && m355.focus && m355.exists && m355.hidden, 'v355 마우스 화면에서는 「다음」 버튼 안 띄움(Enter 그대로)', JSON.stringify(m355));
      await page.evaluate(()=>{document.activeElement.blur();window.yk208Navigate('home');}); await page.waitForTimeout(200);
    }
    // v356 · v357 — 홈 머리 월 상환액 한 줄 · 실거래 탭 [내 지역 | 서울 25개 구]
    {
      reach328On=true; reach328Fail=''; reach328Missing=false; mode='success';
      await page.setViewportSize({width:390,height:844});
      await page.reload(); await page.evaluate(()=>document.fonts.ready); await seed();
      // v369 — 카드 머리 한 모양(① ② ③ ④ · 더 알아보기 = 16px 굵게 같은 색) · 번호 24px · 머리 월 상환액 줄 없음 · 카드 사이 연결선 없음 · 합계 테두리 없음
      const h369=await page.evaluate(()=>{const q=['#flow358 .f-step','#payTile>.ans-k','#easyMarket>.m358','#more341>h2'];const st=[...document.querySelectorAll(q.join(','))].filter(e=>e.getClientRects().length).map(e=>{const c=getComputedStyle(e);return c.fontSize+'/'+c.fontWeight+'/'+c.color;});
        const b=[...document.querySelectorAll('#flow358 .f-step b,#viewAnswer .n358')].filter(e=>e.getClientRects().length).map(e=>Math.round(e.getBoundingClientRect().width));
        return {n:st.length,kinds:[...new Set(st)],badges:[...new Set(b)],hm:!!document.getElementById('heroMonthly356'),line:getComputedStyle(document.getElementById('payTile'),'::before').content,join:getComputedStyle(document.querySelector('#flow358 .f-join span')).borderTopWidth};});
      /* v404 — 머리 글자 16 → 19 · 번호(24px) → 입체 아이콘 36(번호는 감춤) — 「한 모양」 목적 그대로 */
      const ic369=await page.evaluate(()=>[...document.querySelectorAll('#flow358 .f-step,#payTile>.ans-k,#easyMarket>.m358')].filter(e=>e.getClientRects().length).map(e=>{const c=getComputedStyle(e,'::before');return c.width+'|'+(c.backgroundImage.startsWith('url(')?'ic':'-');}));
      ok(h369.n===5 && h369.kinds.length===1 && /^19px\/700\//.test(h369.kinds[0]) && h369.badges.length===0 && ic369.length===4 && ic369.every(x=>x==='36px|ic') && !h369.hm && (h369.line==='none'||h369.line==='normal') && h369.join==='0px', 'v369·v404 홈 카드 머리 한 모양(5곳 19px 굵게 · 번호 대신 입체 아이콘 36) · 머리 월 상환액 줄 없음 · 연결선 · 합계 테두리 없음', JSON.stringify({h369,ic369}));
      // v358 — 자금 흐름 그림 = 원래 표시값(세 조건) · 글자 13px 이상 · 부대비용 → 시트
      const f358=async()=>page.evaluate(()=>{const f=document.getElementById('flow358'),t=id=>(document.getElementById(id).textContent||'').replace(/\s+/g,''),v=q=>(f.querySelector(q+' .f-v').childNodes[0]?.textContent||'').replace(/\s+/g,'');
        const sizes=[...f.querySelectorAll('*')].filter(e=>e.childNodes.length&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&e.getClientRects().length).map(e=>parseFloat(getComputedStyle(e).fontSize));
        return {cash:v('.f-cash')===t('easyCash'),loan:v('.f-loan')===t('easyLoan'),total:f.querySelector('.f-total').textContent.replace(/\s+/g,'')===t('heroAmount'),price:v('.f-price')===t('easyPrice'),cost:v('.f-cost')===t('easyCost'),
          loanHidden:f.querySelector('.f-loan').hidden,min:Math.min(...sizes),old:!!document.querySelector('#fundingOverview .budget-summary').getClientRects().length||!!document.querySelector('#easyBalance>.ratio').getClientRects().length};});
      const fa=await f358();
      await page.evaluate(()=>{Object.assign(S,{cash:50000,income:12000,sgg:'41135',sido:'경기도',group:'metro',houseStatus:'first',debtMonthly:80,lockedPrice:null});showResult(false);}); await page.waitForTimeout(400);
      const fb=await f358();
      ok([fa,fb].every(x=>x.cash&&x.loan&&x.total&&x.price&&x.cost&&!x.loanHidden&&!x.old&&x.min>=13), 'v358 자금 흐름 숫자 = 원래 표시값(현금 · 대출 · 합계 · 집값 · 부대비용, 두 조건) · 옛 덩어리 감춤 · 글자 13px 이상', JSON.stringify([fa,fb]));
      await page.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);}); await page.waitForTimeout(400);
      await page.locator('#flow358 .f-cost').click(); await page.waitForTimeout(400);
      ok(await page.evaluate(()=>!document.getElementById('whySheet').hidden), 'v358 「부대비용 ›」 → 비용 조정 시트(원래 버튼)');
      await page.evaluate(()=>closeSheet()); await page.waitForTimeout(400);
      await page.evaluate(()=>{S.noLoan=true;S.lockedPrice=null;showResult(false);}); await page.waitForTimeout(300);
      ok(await page.evaluate(()=>document.getElementById('payTile').hidden), 'v356·v369 대출 안 받기 — 월 상환액 카드 없음');
      const fc=await f358();
      ok(fc.loanHidden && fc.cash && fc.total && fc.price && fc.cost, 'v358 대출 안 받기 — 대출 조각 없음 · 나머지 값은 원래 표시값', JSON.stringify(fc));
      await page.evaluate(()=>{S.noLoan=false;S.lockedPrice=null;}); await seed();
      await page.evaluate(()=>window.yk208Navigate('map')); await page.waitForTimeout(300);
      const s1=await page.evaluate(()=>({seg:!document.getElementById('seg357').hidden,mode:window.__yk357.mode(),reach:!!document.getElementById('reach328').getClientRects().length,card:!!document.getElementById('dealCard').getClientRects().length,pressed:document.querySelector('#seg357 [data-seg357="mine"]').getAttribute('aria-pressed')}));
      ok(s1.seg && s1.mode==='mine' && !s1.reach && s1.card && s1.pressed==='true', 'v357 실거래 탭은 「내 지역」부터 — 25개 구 카드 감춤 · 내 지역 실거래 보임', JSON.stringify(s1));
      reach328Calls.length=0; reach328Bulk.length=0;
      ok(reach328Bulk.length===0, 'v357 (전제) 「서울 25개 구」를 누르기 전 25개 구 조회 0번');
      await page.locator('#seg357 [data-seg357="reach"]').click();
      await page.waitForFunction(()=>document.getElementById('reach328Go').hidden,null,{timeout:10000}).catch(()=>{});
      const s2=await page.evaluate(()=>({mode:window.__yk357.mode(),tiles:document.querySelectorAll('#reach328Map .reach328-tile:not(.is-wait) b').length,card:!!document.getElementById('dealCard').getClientRects().length,reach:!!document.getElementById('reach328').getClientRects().length}));
      ok(s2.mode==='reach' && s2.reach && !s2.card && s2.tiles===25 && reach328Bulk.length===3 && reach328Calls.length===0, 'v357 「서울 25개 구」를 누르면 바로 불러옴(묶음 3번 · 구별 0번) · 내 지역 카드는 감춤', JSON.stringify([s2,reach328Bulk.length,reach328Calls.length]));
      await page.locator('#reach328Map [data-reach="11320"]').click();
      await page.waitForFunction(()=>window.YK_BROWSE==='11320' && DEAL.status!=='loading',null,{timeout:8000}).catch(()=>{}); await page.waitForTimeout(300);
      const s3=await page.evaluate(()=>({mode:window.__yk357.mode(),browse:window.YK_BROWSE,card:!!document.getElementById('dealCard').getClientRects().length,bar:!document.getElementById('browse345').hidden}));
      ok(s3.mode==='mine' && s3.browse==='11320' && s3.card && s3.bar, 'v357 구를 누르면 「내 지역」 쪽에서 그 구 둘러보기', JSON.stringify(s3));
      await page.evaluate(()=>window.yk208Navigate('home')); await page.waitForTimeout(200);
      await page.evaluate(()=>window.yk208Navigate('map')); await page.evaluate(()=>window.__yk357.show('reach',{query:false})); await page.evaluate(()=>window.yk208Navigate('home'));
      await page.evaluate(()=>window.yk208Navigate('map')); await page.waitForTimeout(200);
      ok(await page.evaluate(()=>window.__yk357.mode()==='mine'), 'v357 다른 화면에서 실거래 탭으로 오면 늘 「내 지역」부터');
      await page.evaluate(()=>window.yk208Navigate('home'));
      await page.evaluate(()=>{Object.assign(S,{sgg:'26350',sido:'부산광역시',group:'other',lockedPrice:null,compareCodes:[]});showResult(false);});
      await page.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:8000}).catch(()=>{});
      await page.evaluate(()=>window.yk208Navigate('map')); await page.waitForTimeout(200);
      const s4=await page.evaluate(()=>({seg:!document.getElementById('seg357').hidden,reachHidden:document.getElementById('reach328').hidden,mode:window.__yk357.mode()}));
      ok(!s4.seg && s4.reachHidden && s4.mode==='mine', 'v357 서울·수도권이 아니면(부산) 전환 버튼 없음(25개 구 카드 기준 v328 그대로)', JSON.stringify(s4));
      reach328On=false; await page.evaluate(()=>window.yk208Navigate('home'));
      await page.reload(); await page.evaluate(()=>document.fonts.ready); mode='success'; await seed();
    }
    // v359 — 390px 주요 화면에 보이는 글자 13px 이상 · 입력 칸 이름 16px · 줄 높이 56px
    {
      reach328On=true; reach328Fail=''; mode='success';
      await page.setViewportSize({width:390,height:844});
      await page.reload(); await page.evaluate(()=>document.fonts.ready);
      const minFs=(root)=>page.evaluate((root)=>{const R=document.querySelector(root);const w=document.createTreeWalker(R,NodeFilter.SHOW_TEXT);let n,min=99,at='';
        while(n=w.nextNode()){const t=n.textContent.trim();if(!t)continue;const el=n.parentElement;if(!el.getClientRects().length||el.closest('.sr-only'))continue;const r=el.getBoundingClientRect();if(r.width<2||r.height<2)continue;
          const c=getComputedStyle(el);if(c.clip==='rect(0px, 0px, 0px, 0px)')continue;let fs=parseFloat(c.fontSize);if(fs===0)continue;
          if(el.closest('svg')){const svg=el.closest('svg'),vb=svg.viewBox&&svg.viewBox.baseVal;if(vb&&vb.width)fs=fs*svg.getBoundingClientRect().width/vb.width;}
          if(fs<min){min=fs;at=t.slice(0,16);}}
        return {min:Math.round(min*10)/10,at};},root);
      const res={};
      await page.evaluate(()=>{restart();});
      await page.evaluate(()=>{const w=document.getElementById('welcome232');w.hidden=false;document.body.classList.add('welcome232-on');});
      res.first=await minFs('#welcome232');
      await page.locator('#welcomeStart232').click(); await page.waitForTimeout(200);
      res.input1=await minFs('#app');
      const row=await page.evaluate(()=>{const c=document.querySelector('#crows [data-mode="region"]');return {h:Math.round(c.getBoundingClientRect().height),k:parseFloat(getComputedStyle(c.querySelector('.k')).fontSize)};});
      await page.evaluate(()=>{S.sgg='11440';S.sido='서울특별시';S.group='seoul';S.houseStatus='none';renderAnswered();syncCta();}); await page.locator('#stepNext353').click(); await page.waitForTimeout(200);
      res.input2=await minFs('#app');
      const lab=await page.evaluate(()=>parseFloat(getComputedStyle(document.querySelector('#crows .inline-money>label')).fontSize));
      await seed(); res.home=await minFs('#app');
      await page.evaluate(()=>window.yk208Navigate('map')); await page.waitForTimeout(300); res.dealsMine=await minFs('#app');
      await page.locator('#seg357 [data-seg357="reach"]').click(); await page.waitForFunction(()=>document.getElementById('reach328Go').hidden,null,{timeout:10000}).catch(()=>{}); res.dealsReach=await minFs('#app');
      await page.evaluate(()=>window.yk208Navigate('compare')); await page.waitForTimeout(300); res.compare=await minFs('#app');
      await page.evaluate(()=>window.yk208Navigate('conditions')); await page.waitForTimeout(300); res.cond=await minFs('#app');
      // v364 — 25개 구 칸: 320px 5열(칸 44px 이상 · 구 이름 13px) / 390px 지도 위치 그대로
      await page.evaluate(()=>window.yk208Navigate('map')); await page.evaluate(()=>window.__yk357.show('reach',{query:false}));
      const t364=async()=>page.evaluate(()=>{const ts=[...document.querySelectorAll('#reach328Map .reach328-tile')].filter(e=>e.getClientRects().length);const ws=ts.map(e=>e.getBoundingClientRect().width);
        const inl=ts.filter(e=>e.style.gridColumn).slice(0,6).every(e=>getComputedStyle(e).gridColumnStart===String(e.style.gridColumn).split('/')[0].trim());
        return {n:ts.length,min:Math.round(Math.min(...ws)),cols:getComputedStyle(document.getElementById('reach328Map')).gridTemplateColumns.trim().split(/\s+/).length,name:ts[0]?parseFloat(getComputedStyle(ts[0].querySelector('span')).fontSize):0,inl};});
      await page.setViewportSize({width:320,height:700}); await page.waitForTimeout(250);
      const n364=await t364();
      await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(250);
      const w364=await t364();
      ok(n364.n===25 && n364.cols===5 && n364.min>=44 && n364.name>=13 && w364.n===25 && w364.cols===6 && w364.inl, 'v364 25개 구 — 320px 5열(칸 44px 이상 · 이름 13px) · 390px 지도 위치 그대로', JSON.stringify({n364,w364}));
      await page.evaluate(()=>window.yk208Navigate('home'));
      // v365 — 320px 매수 지역 시트: 가로 넘침 없음 · 「기준」 칸 이름 안 잘림 · 꼬리표 13px / 부대비용 금액 상자 빈 곳 누르면 입력칸
      await page.setViewportSize({width:320,height:700});
      await page.evaluate(()=>window.yk208Navigate('conditions')); await page.waitForTimeout(250);
      await page.locator('#crows [data-mode="region"]').click(); await page.waitForTimeout(400);
      await page.getByRole('button',{name:'서울',exact:true}).first().click(); await page.locator('.pick330 [data-pick="11440"]').click(); await page.waitForTimeout(250);
      const r365=await page.evaluate(()=>{const sh=document.getElementById('qSheet'),c=document.querySelector('.pick330 .chip.is-base330'),t=c&&c.querySelector('.tag330');const name=c?[...c.childNodes].filter(n=>n.nodeType===3||!n.classList.contains('tag330')):[];
        return {over:sh.scrollWidth>sh.clientWidth+1,chipTrunc:c?c.scrollWidth>c.clientWidth+1:null,tag:t?parseFloat(getComputedStyle(t).fontSize):0,act:Math.round(document.querySelector('#qSheet .sheet-actions').getBoundingClientRect().right)<=innerWidth};});
      await page.evaluate(()=>closeSheet('q')); await page.waitForTimeout(400);
      await page.setViewportSize({width:390,height:844}); await page.evaluate(()=>window.yk208Navigate('home')); await page.waitForTimeout(200);
      await page.locator('#flow358 .f-cost').click(); await page.waitForTimeout(500);
      /* v386 — 금액 상자가 글자 + 밑줄이 되어 상자 안 빈 곳(왼쪽 위 4px)이 입력칸으로 채워짐 → 빈 곳은 밑줄 아래 누르는 영역(::after · 상자 아래 4px)으로. 「빈 곳을 눌러도 입력칸」이라는 뜻은 그대로. */
      const box=await page.evaluate(()=>{const a=document.querySelector('#whySheet .costrow .amt');const inp=a.querySelector('input');const r=a.getBoundingClientRect(),ri=inp.getBoundingClientRect();const px=r.left+4,py=r.bottom+4;return {x:Math.round(px),y:Math.round(py),inside:!(px>=ri.left&&px<=ri.right&&py>=ri.top&&py<=ri.bottom)&&document.elementFromPoint(px,py)===a,id:inp.id,dis:inp.disabled,small:parseFloat(getComputedStyle(document.querySelector('#whySheet .costrow .nm small')).fontSize)};});
      await page.mouse.click(box.x,box.y); await page.waitForTimeout(150);
      const foc=await page.evaluate(()=>document.activeElement&&document.activeElement.id);
      await page.evaluate(()=>closeSheet('why')); await page.waitForTimeout(400);
      ok(!r365.over && r365.chipTrunc===false && r365.tag>=13 && r365.act && box.inside && !box.dis && foc===box.id && box.small>=13, 'v365 320px 매수 지역 — 가로 넘침 없음 · 「기준」 칸 이름 안 잘림 · 꼬리표 13px / 부대비용 금액 상자 빈 곳 → 입력칸 · 보조 글자 13px', JSON.stringify({r365,box,foc}));
      ok(Object.values(res).every(r=>r.min>=13), 'v359 390px 첫 화면 · 입력 1·2단계 · 홈 · 실거래(내 지역 · 25개 구) · 비교 · 내 조건 — 보이는 글자 13px 이상(SVG는 화면 크기로 환산)', JSON.stringify(res));
      ok(row.h>=56 && row.k>=16 && lab>=16, 'v359 입력 — 줄 높이 56px 이상 · 칸 이름 16px', JSON.stringify({row,lab}));
      // v360 — 비교(3곳 담음) 글자 13px 이상 · 금액 한 줄 · 표 테두리 한 겹 · 거래 상세 「거래가 흐름」 한 겹 · 네이버 링크 낭독 이름
      /* 테스트 실거래 금액은 예상 집값 범위 밖이라 목록 줄이 없음 → 앱의 담기 형식(cmpSnap · cmpStore)으로 3곳을 넣음 */
      await page.evaluate(()=>{const seen=new Set(),list=[];for(const x of (DEAL.items||[])){if(!(Number(x.amountMan)>0))continue;const s=cmpSnap(x);if(seen.has(s.k))continue;seen.add(s.k);list.push(s);if(list.length===3)break;}cmpStore(list);if(typeof cmpSync==='function')cmpSync();});
      /* 거래 상세 「거래가 흐름」: 같은 구조(.dealbox > .trend)를 실거래 화면에 놓고 규칙만 잼 */
      const tr360=await page.evaluate(()=>{const host=document.getElementById('dealList')||document.getElementById('viewDeals');const box=document.createElement('div');box.className='dealbox';box.innerHTML='<div class="trend"><button type="button" class="trend-open">거래가 흐름</button></div>';host.appendChild(box);
        const c=getComputedStyle(box.querySelector('.trend')),r={l:c.borderLeftWidth,r:c.borderRightWidth,top:c.borderTopWidth,rad:c.borderTopLeftRadius};box.remove();return r;});
      await page.evaluate(()=>window.yk208Navigate('compare')); await page.waitForTimeout(500);
      res.compare3=await minFs('#app');
      const c360=await page.evaluate(()=>{const n=cmpLoad().length,tb=document.querySelector('#viewCompare .v253-compare-scroll>table'),m=document.querySelector('#viewCompare tr.cmp-hero td>.cmp-money234'),ps=m?[getComputedStyle(m).flexDirection,getComputedStyle(m).flexWrap]:[];
        const a=document.querySelector('#viewCompare a.cmp-naver');return {n,tbBorder:tb?getComputedStyle(tb).borderTopWidth:'?',oneLine:ps[0]==='row'&&ps[1]==='wrap',naver:a?{txt:a.textContent.trim(),aria:a.getAttribute('aria-label'),href:!!a.getAttribute('href')}:null};});
      ok(c360.n===3 && res.compare3.min>=13 && c360.oneLine && c360.tbBorder==='0px' && c360.naver && /네이버에서 찾기/.test(c360.naver.aria) && c360.naver.href && tr360 && tr360.l==='0px' && tr360.r==='0px' && tr360.rad==='0px' && tr360.top!=='0px',
         'v360 비교 3곳 — 글자 13px 이상 · 금액 가로 한 줄 배치(안 들어가면 꺾임 · v259 두 줄 고정 풂) · 표 테두리 한 겹 · 네이버 링크 낭독 이름 그대로 / 거래 상세 「거래가 흐름」은 위 구분선만', JSON.stringify({c360,min:res.compare3,tr360}));
      await page.evaluate(()=>{try{localStorage.removeItem(CMP_KEY);}catch(e){}});
      // v361 — 넓은 화면 균형: 홈 좌우 칸 끝 맞춤(「저장 · 공유 + 더 알아보기」는 오른쪽 칸) · 실거래 목록 2열 · 전환 버튼 최대 폭 / 390px는 그대로
      const lay361=async()=>page.evaluate(()=>{const R=id=>document.getElementById(id).getBoundingClientRect();window.yk208Navigate('home');const f=R('fundingOverview'),n=document.querySelector('#viewNext>.card').getBoundingClientRect(),m=R('easyMarket');   /* v363 — 넓은 화면에서 #viewNext를 풀어(display:contents) 저장 · 공유 줄을 잼 */
        window.yk208Navigate('map');const dl=getComputedStyle(document.getElementById('dealList')),so=parseFloat(getComputedStyle(document.querySelector('#viewDeals .deal-tools .sortseg')).maxWidth)||9999,sg=document.getElementById('seg357').getBoundingClientRect().width;window.yk208Navigate('home');
        return {fb:Math.round(f.bottom),nb:Math.round(n.bottom),nx:Math.round(n.left),fr:Math.round(f.right),nTop:Math.round(n.top),mb:Math.round(m.bottom),nw:Math.round(n.width),vw:innerWidth,cols:dl.display==='grid'?(/minmax/.test(dl.gridTemplateColumns)?dl.gridTemplateColumns.match(/minmax/g).length:dl.gridTemplateColumns.trim().split(/\s+/).length):1,so:Math.round(so),sg:Math.round(sg)};});
      await page.setViewportSize({width:1264,height:900}); await page.waitForTimeout(300);
      const w361=await lay361();
      await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(300);
      const m361=await lay361();
      ok(w361.nx>w361.fr && w361.nTop>=w361.mb && Math.abs(w361.nb-w361.fb)<=200 && w361.cols===2 && w361.so<=560 && w361.sg<=480, 'v361·v363 1264px — 「저장 · 공유」 오른쪽 칸 ④ 아래 · 좌우 칸 끝 차이 200px 이하(점검 전 약 300px) · 실거래 목록 2열 · 전환 버튼 최대 폭', JSON.stringify(w361));
      ok(m361.cols===1 && m361.nw>=m361.vw-48 && m361.nTop>=m361.fb, 'v361 390px — 한 줄 배치 그대로(목록 1열 · 더 알아보기 전체 폭 · 예산 카드 아래)', JSON.stringify(m361));
      // v362 — 대출 한도 식 그림(화면 숫자로 식이 맞을 때만) · 거래 상세 현금 여유 표(합계가 맞을 때만) · ※ 안내 접기
      const eq362=async(c)=>page.evaluate(c=>{Object.assign(S,{mciCovered:false,loanCap:null,noLoan:false},c,{lockedPrice:null});showResult(false);
        const t=e=>e?(e.textContent||'').replace(/\s+/g,''):'',eq=document.getElementById('eq362'),room=document.getElementById('roomTip'),after=document.getElementById('limitAfterRoom'),bind=document.querySelector('#limits .limitrow.bind .v');
        return {eq:!!eq,b:eq?t(eq.querySelectorAll('b')[0]):'',r:eq?t(eq.querySelectorAll('b')[1]):'',a:eq?t(eq.querySelectorAll('b')[2]):'',bind:t(bind),room:t(room),after:t(after&&after.querySelector('strong')),roomShown:room&&getComputedStyle(room).display!=='none'&&!room.hidden,afterShown:after&&getComputedStyle(after).display!=='none'&&!after.hidden};},c);
      const e1=await eq362({cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0});
      const e2=await eq362({cash:15000,income:15000,sgg:'11680',sido:'서울특별시',group:'seoul',houseStatus:'first',debtMonthly:0});
      ok(e1.eq && e1.b===e1.bind && e1.room.includes(e1.r) && e1.a===e1.after && !e1.roomShown && !e1.afterShown, 'v362 대출 한도 식 — 적용 기준 − 방공제 = 한도(세 숫자 = 화면 값 · 같은 뜻의 글 줄은 접힘)', JSON.stringify(e1));
      ok(!e2.eq && e2.roomShown && e2.afterShown, 'v362 화면 숫자로 식이 안 맞으면(1만원 반올림 차이) 그림 없이 원래 글 그대로', JSON.stringify(e2));
      await page.evaluate(()=>window.yk208Navigate('map')); await page.waitForTimeout(200);
      const wf362=await page.evaluate(async()=>{const host=document.getElementById('viewDeals');const mk=(gap,parts)=>{const d=document.createElement('div');d.className='deal-afford';d.innerHTML='<p class="da-gap">예상 대출 포함 · '+gap+'</p><p class="da-why">'+parts+'</p>';host.appendChild(d);return d;};
        const a=mk('현금 2,154만원 여유','<span>집값 3,912만원 낮음</span> + <span>부대비용 61만원 줄어듦</span> − <span>대출 1,819만원 줄어듦</span>');
        const b=mk('현금 2,155만원 여유','<span>집값 3,912만원 낮음</span> + <span>부대비용 61만원 줄어듦</span> − <span>대출 1,819만원 줄어듦</span>');
        await new Promise(r=>setTimeout(r,80));
        const ra={drawn:!!a.querySelector('.wf362'),why:getComputedStyle(a.querySelector('.da-why')).display,sum:(a.querySelector('.wf-sum')||{}).textContent,rows:a.querySelectorAll('.wf362 .wf-row').length},rb={drawn:!!b.querySelector('.wf362'),why:getComputedStyle(b.querySelector('.da-why')).display};a.remove();b.remove();
        const d=document.querySelector('#viewDeals details.dn362');return {ra,rb,notes:!!d&&!!d.querySelector('#dealNote')&&!!d.querySelector('#dealFoot'),order:d?getComputedStyle(d).order:''};});
      ok(wf362.ra.drawn && wf362.ra.rows===3 && wf362.ra.why==='none' && /2,154만원/.test(wf362.ra.sum) && !wf362.rb.drawn && wf362.rb.why!=='none', 'v362 현금 여유 표 — 부호 붙여 더한 값이 합계와 같을 때만(1만원 틀리면 원래 글)', JSON.stringify(wf362));
      ok(wf362.notes && wf362.order!=='' && wf362.order!=='0', 'v362 실거래 ※ 안내 → 「목록 기준」 접기(목록 아래 자리 그대로)', JSON.stringify(wf362));
      // v363 — 홈 ④ 미니 분포 = 실거래 탭 분포(같은 점 수) · 넓은 화면 「더 알아보기」 아래 전체 폭
      await page.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
      await page.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:8000}).catch(()=>{}); await page.waitForTimeout(400);
      await page.evaluate(()=>window.yk208Navigate('home')); await page.waitForTimeout(200);
      const mi363=await page.evaluate(()=>{const m=document.getElementById('mini363'),src=document.querySelector('#dealDistribution .dd-strip');const cnt=e=>e?e.querySelectorAll('svg *:not(title)').length:-1;
        return {has:!!m,hidden:m?m.hidden:null,src:!!src,a:cnt(m),b:cnt(src),aria:m?m.getAttribute('aria-hidden'):'',h:m?Math.round(m.getBoundingClientRect().height):0,mark:m?(m.querySelector('.dd-mark')||{}).textContent:'',srcMark:src?(src.querySelector('.dd-mark')||{}).textContent:''};});
      ok(mi363.has && (mi363.src ? (!mi363.hidden && mi363.a===mi363.b && mi363.a>0 && mi363.mark===mi363.srcMark && mi363.h>40) : mi363.hidden) && mi363.aria==='true', 'v363 홈 ④ 미니 분포 — 실거래 탭 분포와 같은 점 · 같은 「내 예상 집값」 표시(꾸밈 · 낭독 제외)', JSON.stringify(mi363));
      await page.setViewportSize({width:1264,height:900}); await page.waitForTimeout(300);
      const w363=await page.evaluate(()=>{const R=e=>e.getBoundingClientRect();const share=R(document.querySelector('#viewNext>.card')),more=R(document.getElementById('more341')),mk=R(document.getElementById('easyMarket')),fo=R(document.getElementById('fundingOverview'));return {gap:Math.round(share.top-mk.bottom),moreW:Math.round(more.width),moreTop:Math.round(more.top),fb:Math.round(fo.bottom),vw:innerWidth};});
      await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(200);
      ok(w363.gap>=0 && w363.gap<=24 && w363.moreW>=900 && w363.moreTop>=w363.fb, 'v363 1264px — 저장 · 공유 줄은 ④ 바로 아래(24px 이하) · 더 알아보기는 아래 전체 폭', JSON.stringify(w363));
      // v366 — 실거래 머리: 「대출 규칙이 달라…」 → 지역별 기준 예상 집값 표(내 지역 = 화면 값 · 다른 지역 = dealBudgetFor) · 「넓혔어요」 접음
      await page.evaluate(()=>window.yk208Navigate('map')); await page.waitForTimeout(200);
      const t366=await page.evaluate(()=>{const box=document.getElementById('dealDistribution');if(!box)return {nobox:true};
        const keep=DEAL.items; DEAL.items=(keep||[]).concat([{lawd:'41281',amountMan:30000,name:'검사단지',areaM2:84,y:2026,m:10,d:1}]);
        const a=document.createElement('p');a.className='dd-note dd-scope';a.textContent='고양시 덕양구는 대출 규칙이 달라 그 지역 기준 예상 집값으로 나눴어요.';
        const b=document.createElement('p');b.className='dd-note dd-scope';b.textContent='맞는 거래가 적어 인근 지역까지 넓혔어요.';box.append(b,a);window.__yk366.fix();
        const t=(a.nextElementSibling&&a.nextElementSibling.classList.contains('rt366'))?a.nextElementSibling:null,rows=t?[...t.querySelectorAll('tr')].map(r=>[r.querySelector('th').firstChild.textContent.trim(),r.querySelector('td').textContent.trim()]):[];
        const r={rows,own:(document.getElementById('dealBudget')||{}).textContent,dy:formatWon(dealBudgetFor('41281')*10000),ruleHidden:getComputedStyle(a).position==='absolute'&&a.getBoundingClientRect().width<=1,wideHidden:getComputedStyle(b).position==='absolute'&&b.getBoundingClientRect().width<=1,cap:t?getComputedStyle(t.querySelector('.rt-cap')).display:''};
        if(t)t.remove();a.remove();b.remove();DEAL.items=keep;return r;});
      ok(t366.rows&&t366.rows.length>=2&&t366.rows[0][1]===String(t366.own).trim()&&t366.rows.some(r=>r[0]==='고양시 덕양구'&&r[1]===t366.dy)&&t366.rows.filter(r=>r[0]==='고양시 덕양구').length===1&&t366.ruleHidden&&t366.wideHidden&&t366.cap!=='none', 'v366 실거래 머리 — 지역별 기준 예상 집값 표(내 지역 = 화면 값 · 덕양구 = dealBudgetFor) · 원래 문장은 낭독용 · 「넓혔어요」 접음', JSON.stringify(t366));
      // v369 — 실거래 탭: 점 그림 감춤(홈 ④에만) · 밑줄 탭 · 목록 줄(위치 · 면적 · 거래 활발 한 줄 전체 폭 · 차이 칩 셋째 줄 · 꺾쇠만) — 검사 자료엔 목록 줄이 없어 같은 마크업 한 줄을 잠깐 넣어 잼
      for(const w of [390,320]){
        await page.setViewportSize({width:w,height:844}); await page.waitForTimeout(150);
        const d369=await page.evaluate(()=>{const R=e=>e.getBoundingClientRect();const strip=document.querySelector('#viewDeals #dealDistribution .dd-strip');
          const list=document.getElementById('dealList'),wrap=document.createElement('div');wrap.className='dealwrap';
          wrap.innerHTML='<button type="button" class="deal" data-deal="0" aria-expanded="false"><span class="nm">검사단지</span><span class="amt">4억 1,156만원</span><span class="deal-meta"><span class="deal-place">고양시 덕양구 합성동</span><span class="deal-area">전용 59㎡ · <b>24평</b></span><span class="hotrow"><span class="hot">거래 활발</span></span></span><span class="budget-gap"><span class="sr-only">고양시 덕양구 기준 </span>예상 집값보다 <span class="budget-delta is-under"><b class="budget-basis" aria-hidden="true">덕양구 기준</b> 3,912만원 낮음</span></span><span class="deal-expand">거래 상세 <span class="caret" aria-hidden="true"></span></span></button>';
          list.prepend(wrap);const d=wrap.firstChild,dr=R(d),me=R(d.querySelector('.deal-meta')),gp=R(d.querySelector('.budget-delta')),ex=d.querySelector('.deal-expand'),xr=R(ex),hot=getComputedStyle(d.querySelector('.hot')),am=R(d.querySelector('.amt'));
          const seg=document.querySelector('#seg357 [aria-pressed="true"]');
          const r={strip:strip?!!strip.getClientRects().length:null,metaWide:me.width>=dr.width-4,gapRow3:gp.top>=me.bottom-1,exRight:xr.right>=dr.right-2&&xr.top>=me.bottom-1,exFont:getComputedStyle(ex).fontSize,exLabel:ex.textContent.includes('거래 상세'),hotBg:hot.backgroundColor,amtRow1:am.bottom<=me.top+1,
            segBg:getComputedStyle(document.getElementById('seg357')).backgroundColor,segBar:seg?getComputedStyle(seg,'::after').backgroundColor:''};
          wrap.remove();return r;});
        ok(d369.strip!==true && d369.metaWide && d369.gapRow3 && d369.exRight && d369.exFont==='0px' && d369.exLabel && /rgba\(0, 0, 0, 0\)|transparent/.test(d369.hotBg) && d369.amtRow1 && /rgba\(0, 0, 0, 0\)/.test(d369.segBg) && d369.segBar==='rgb(36, 88, 255)', `v369 ${w}px 실거래 탭 — 점 그림 없음 · 밑줄 탭 · 목록 줄 3단(위치 · 면적 전체 폭 · 차이 칩 · 꺾쇠만, 낭독은 「거래 상세」)`, JSON.stringify(d369));
      }
      await page.setViewportSize({width:390,height:844});
      await page.evaluate(()=>window.yk208Navigate('home'));
      await page.evaluate(()=>window.yk208Navigate('home'));
      reach328On=false; await page.evaluate(()=>window.yk208Navigate('home'));
      await page.reload(); await page.evaluate(()=>document.fonts.ready); mode='success'; await seed();
    }
    if(process.env.YK_AXE_PATH){
      await page.addScriptTag({path:process.env.YK_AXE_PATH});
      for(const width of [320,390,1264]){
        await page.setViewportSize({width,height:844});
        for(const tab of ['home','map','compare','conditions']){
          await page.evaluate(t=>window.yk208Navigate(t),tab);
          await page.waitForTimeout(250); // 120ms 버튼 색상 전환 완료 후 실제 정지 상태 검사
          const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
          ok(!violations.length,`v321 ${width}px ${tab} 접근성`,JSON.stringify(violations));
        }
      }
    }
    // v373 — 화면에 그려진 글자 가운데 Pretendard 글자 범위 밖(기기 글꼴로 그려지는 것) 전수: 첫 화면 · 결과(접기 모두 펼침) · 탭 넷 · 입력 시트 넷.
    //        v374부터 예외 없음(「−」는 YK Minus 조각). 「✓」 자리는 그림인지도 함께 잼.
    {
      const p373=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const e373=[];p373.on('pageerror',e=>e373.push(e.message));
      await p373.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
        const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
      await p373.goto('http://yeongkkeul.test/');await p373.evaluate(()=>document.fonts.ready);
      const scan373=()=>p373.evaluate(()=>{
        const st=[...document.querySelectorAll('style')].map(x=>x.textContent).join('\n').match(/@font-face\s*\{[^}]*\}/g).join('\n'); // v374 — 「YK Minus」(U+2212) 조각도 함께 셈
        const R=[...st.matchAll(/unicode-range:([^}]*)/g)].flatMap(m=>m[1].split(',').map(x=>x.trim().replace('U+','')).map(x=>{const [a,b]=x.split('-');return [parseInt(a,16),parseInt(b||a,16)];}));
        const has=cp=>cp<=0x20||cp===0xA0||R.some(([a,b])=>cp>=a&&cp<=b);const out=[];
        const where=el=>(el.id?'#'+el.id:el.tagName.toLowerCase()+'.'+String(el.className).trim().split(/\s+/)[0])+'<'+((el.parentElement&&el.parentElement.closest('[id]'))||{}).id;
        const add=(t,w)=>{for(const ch of t){if(!has(ch.codePointAt(0)))out.push(ch+' '+w);}};
        const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
        while(n=tw.nextNode()){const el=n.parentElement;if(!el||el.closest('script,style,noscript,svg')||!el.getClientRects().length)continue;const cs=getComputedStyle(el);if(cs.visibility==='hidden'||parseFloat(cs.fontSize)===0||cs.color==='rgba(0, 0, 0, 0)')continue;add(n.textContent,where(el));}
        for(const el of document.querySelectorAll('body *')){if(!el.getClientRects().length)continue;for(const ps of ['::before','::after']){const m=(getComputedStyle(el,ps).content||'').match(/^"(.*)"$/s);if(m)add(m[1],where(el)+ps);}}
        return {ranges:R.length,out};});
      const all373=[];let ranges373=0;const push373=async lab=>{const r=await scan373();ranges373=Math.max(ranges373,r.ranges);r.out.forEach(x=>all373.push(lab+': '+x));};
      await push373('첫 화면');
      await p373.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
      await p373.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:8000}).catch(()=>{});
      for(const tab of ['home','map','compare','conditions']){await p373.evaluate(t=>window.yk208Navigate(t),tab);await p373.waitForTimeout(300);await p373.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true));await push373(tab);}
      await p373.evaluate(()=>window.yk208Navigate('map'));await p373.waitForTimeout(300);await p373.evaluate(()=>{const d=document.getElementById('dealRegions');if(d)d.open=true;});
      const chip373=await p373.evaluate(()=>{const c=document.querySelector('#dealRegionChips .chip.is-on');if(!c)return null;const b=getComputedStyle(c,'::before');return {content:b.content,w:b.width,mr:b.marginRight,mask:(b.webkitMaskImage||b.maskImage||'').startsWith('url(')};});
      await p373.evaluate(()=>window.yk208Navigate('home'));
      for(const [st,md] of [[0,'cash'],[1,'income'],[1,'debt'],[2,'region']]){await p373.evaluate(([a,b])=>{try{closeSheet();}catch(e){}openQ(a,b);},[st,md]);await p373.waitForTimeout(350);await p373.evaluate(()=>document.querySelectorAll('#qSheet details').forEach(d=>d.open=true));await push373('입력 시트 '+md);}
      await p373.evaluate(()=>{try{closeSheet();}catch(e){}S.debtMonthly=0;openQ(1,'debt');});await p373.waitForTimeout(350);
      const debt373=await p373.evaluate(()=>{const e=document.getElementById('debtNone');if(!e||!e.getClientRects().length)return null;const a=getComputedStyle(e,'::after');return {content:a.content,img:/url\(/.test(a.backgroundImage)};});
      ok(ranges373>100 && !all373.length && !e373.length,'v373·v374 기기 글꼴로 그려지는 글자 0개(Pretendard · YK Minus 범위 밖 · 예외 없음) — 첫 화면 · 결과 · 탭 넷 · 입력 시트 넷',JSON.stringify({ranges373,all373:all373.slice(0,12),e373}));
      ok(chip373 && chip373.content==='""' && chip373.w==='14px' && chip373.mr==='4px' && chip373.mask && debt373 && debt373.content==='"선택됨"' && debt373.img,
         'v373 「✓」 자리 그림 — 실거래 지역 칩(14px · 글자와 4px 띄움) · 「기존 대출 없음」 꼬리표',JSON.stringify({chip373,debt373}));
      await p373.close();
    }
    // v374 — 「−」를 실제로 그린 글꼴(Chrome 개발자 도구 「사용된 글꼴」 · CSS.getPlatformFontsForNode): 안내 페이지 4개의 식 · 계산기 결과 화면 시험 글자
    {
      const p374=await browser.newPage({viewport:{width:390,height:844}});const fontReq374=[];
      await p374.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(/YKMinus/.test(u.pathname))fontReq374.push(u.pathname);if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
        const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
      const cdp=await p374.context().newCDPSession(p374);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
      const used374=async()=>{const {root}=await cdp.send('DOM.getDocument',{depth:-1});const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector:'#probe374'});if(!nodeId)return 'no-probe';const r=await cdp.send('CSS.getPlatformFontsForNode',{nodeId});return r.fonts.map(f=>f.familyName).join(',');};
      const res374={};
      for(const pg of ['budget-examples','buying-costs','dsr-income-table','price-band-cap']){
        await p374.goto('http://yeongkkeul.test/'+pg+'.html');await p374.evaluate(()=>document.fonts.ready);
        await p374.evaluate(()=>{const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=tw.nextNode()){const i=n.textContent.indexOf('−');if(i<0||!n.parentElement.getClientRects().length)continue;const r=n.splitText(i);r.splitText(1);const sp=document.createElement('span');sp.id='probe374';r.replaceWith(sp);sp.appendChild(r);return;}});
        await p374.evaluate(()=>document.fonts.ready);await p374.waitForTimeout(150);res374[pg]=await used374();
      }
      await p374.goto('http://yeongkkeul.test/');await p374.evaluate(()=>document.fonts.ready);const reqBefore374=fontReq374.length;
      await p374.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
      await p374.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:8000}).catch(()=>{});
      const lazy374=fontReq374.length===reqBefore374;   // 「−」가 안 보이는 화면에서는 조각을 받지 않음
      await p374.evaluate(()=>{const sp=document.createElement('span');sp.id='probe374';sp.textContent='−1%p';document.getElementById('viewAnswer').prepend(sp);});
      await p374.evaluate(()=>document.fonts.ready);await p374.waitForTimeout(150);res374.index=await used374();
      ok(Object.values(res374).every(v=>/^(.*,)?YK Minus(,.*)?$/.test(v) && !/Inter|DejaVu|Noto|Liberation/.test(v.replace(/Pretendard Variable/g,''))) && lazy374,
         'v374 「−」를 YK Minus 조각이 그림 — 안내 페이지 4개 · 계산기(시험 글자) · 「−」 없는 결과 화면에서는 조각을 안 받음',JSON.stringify({res374,lazy374,fontReq374}));
      await p374.close();
    }
    // v375 — 「다음」 줄은 키보드가 있을 때만: 아이폰 캡처(2026-11-21)와 같은 길(주택 보유 → 생애최초 → 0.3초 뒤 코드 초점)에서 줄이 감춰지는지 ·
    //        그 칸을 누르면 / 이름표를 누르면 / 키보드가 올라오면(보이는 영역 흉내) 뜨는지 · 마우스 화면은 그대로 안 뜨는지
    {
      const c375=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      const q=await c375.newPage(); const e375=[]; q.on('pageerror',e=>e375.push(e.message));
      await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,items:[],total:0}});
        const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
      await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
      const st375=()=>q.evaluate(()=>{const bar=document.getElementById('kbNext355'),r=bar.getBoundingClientRect();return {focus:document.activeElement.id,bar:!bar.hidden,label:document.getElementById('kbNextBtn355').textContent,bottom:Math.round(r.bottom),vvBottom:Math.round(visualViewport.offsetTop+visualViewport.height)};});
      await q.locator('#welcomeStart232').tap();
      await q.evaluate(()=>{S.sgg='11440';S.sido='서울특별시';S.group='seoul';renderAnswered();syncCta();}); await q.waitForTimeout(200);
      await q.locator('#crows [data-mode="house"]').tap(); await q.waitForTimeout(400);
      await q.locator('[data-house="first"]').tap(); await q.waitForTimeout(900);
      const a=await st375();                                    // 코드 초점 · 키보드 없음 → 줄 감춤
      await q.locator('#main-cash').tap(); await q.waitForTimeout(150);
      const b=await st375();                                    // 사용자가 칸을 누름 → 줄
      await q.evaluate(()=>document.activeElement.blur()); await q.waitForTimeout(1100);
      await q.evaluate(()=>document.getElementById('main-cash').focus()); await q.waitForTimeout(100);
      const c=await st375();                                    // 누름 없이 코드 초점 → 감춤
      const d=await q.evaluate(()=>{const real=window.visualViewport,vvD=Object.getOwnPropertyDescriptor(window,'visualViewport')||Object.getOwnPropertyDescriptor(Window.prototype,'visualViewport');
        const fake={offsetTop:0,offsetLeft:0,width:innerWidth,height:innerHeight-320,scale:1,addEventListener(){},removeEventListener(){}};
        Object.defineProperty(window,'visualViewport',{configurable:true,get:()=>fake}); real.dispatchEvent(new Event('resize'));
        const bar=document.getElementById('kbNext355'),r=bar.getBoundingClientRect(),out={bar:!bar.hidden,top:Math.round(r.top),want:Math.round(innerHeight-320-r.height)};
        Object.defineProperty(window,'visualViewport',vvD); return out;});   // 키보드가 올라옴(안드로이드 등) → 줄 · 보이는 영역 아래 끝
      await q.evaluate(()=>document.activeElement.blur()); await q.waitForTimeout(150);
      await q.locator('label[for="main-income"]').tap(); await q.waitForTimeout(150);
      const e=await st375();                                    // 이름표를 누름 → 줄
      ok(a.focus==='main-cash' && !a.bar && b.bar && b.label==='다음' && Math.abs(b.bottom-b.vvBottom)<=1 && c.focus==='main-cash' && !c.bar && d.bar && Math.abs(d.top-d.want)<=1 && e.focus==='main-income' && e.bar && !e375.length,
         'v375 「다음」 줄 — 생애최초 뒤 코드 초점엔 감춤 · 칸 누름 / 이름표 누름 / 키보드 올라옴에 뜸(자리는 보이는 영역 아래 끝)',JSON.stringify({a,b,c,d,e,e375}));
      await c375.close();
      const c375d=await browser.newContext({viewport:{width:1264,height:900}});const qd=await c375d.newPage();
      await qd.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,items:[],total:0}});
        const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
      await qd.goto('http://yeongkkeul.test/'); await qd.evaluate(()=>document.fonts.ready);
      await qd.locator('#welcomeStart232').click(); await qd.evaluate(()=>{S.sgg='11440';S.sido='서울특별시';S.group='seoul';S.houseStatus='none';renderAnswered();syncCta();});
      await qd.locator('#stepNext353').click(); await qd.waitForTimeout(200); await qd.locator('#main-cash').click(); await qd.waitForTimeout(100); await qd.locator('#main-cash').click(); await qd.waitForTimeout(100);
      const dsk=await qd.evaluate(()=>({focus:document.activeElement.id,bar:!document.getElementById('kbNext355').hidden}));
      ok(dsk.focus==='main-cash' && !dsk.bar,'v375 마우스 화면(1264px)은 칸을 눌러도 「다음」 줄 없음(v355 그대로)',JSON.stringify(dsk));
      await c375d.close();
    }
    // v376 — 결과 화면 ④ 작은 그래프: 규칙이 다른 인근 지역(고양시 덕양구) 점은 테두리만(v380부터 막대 조각으로 같은 뜻) · 채운 파란 점은 「내 예상 집값」 선 왼쪽에만 · 설명 한 줄(320 · 390 · 1264)
    {
      const item376=(lawd,i,amt)=>({name:'검증'+lawd+'-'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:amt,buildYear:2015,floor:5,y:2026,m:11,d:1+i});
      for(const width of [320,390,1264]){
        const c376=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c376.newPage();const e376=[];q.on('pageerror',e=>e376.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){const lawd=u.searchParams.get('lawd');const amts=lawd==='41281'?[33000,32000,34000,15000]:[15000,16000,30000,31000,29000];return route.fulfill({json:{ok:true,items:amts.map((a,i)=>item376(lawd,i,a)),total:amts.length}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(500);
        // v380에서 점 → 막대: 같은 뜻(규칙이 다른 지역은 흰 속 + 테두리 · 채운 파랑은 선 왼쪽에만)을 막대 조각으로 잼
        const m376=await q.evaluate(()=>{const root=document.getElementById('mini363'),svg=root&&root.querySelector('.dd-strip svg');if(!svg)return {svg:false};
          const line=[...svg.querySelectorAll('line')].find(l=>l.getAttribute('stroke')==='#2458FF'),lx=+line.getAttribute('x1'),rs=[...svg.querySelectorAll('rect[data-seg380]')];
          const other=rs.filter(r=>/^o[uo]$/.test(r.getAttribute('data-seg380'))),note=root.querySelector('.dd-other376');
          return {svg:true,n:rs.length,circles:svg.querySelectorAll('circle').length,blueRight:rs.filter(r=>r.getAttribute('fill')==='#2458FF'&&+r.getAttribute('x')>lx).length,other:other.length,
            otherOk:other.every(r=>r.getAttribute('fill')==='#fff'&&r.getAttribute('stroke-width')==='2'),otherBlue:other.filter(r=>r.getAttribute('stroke')==='#2458FF').length,
            note:note?note.textContent:'',noteVis:!!(note&&note.getClientRects().length),overflow:document.documentElement.scrollWidth>innerWidth};});
        ok(m376.svg && m376.n>0 && m376.circles===0 && m376.blueRight===0 && m376.other>=1 && m376.otherOk && m376.otherBlue>=1 && /고양시 덕양구/.test(m376.note) && /테두리 막대/.test(m376.note) && /그 지역 예상 집값 기준/.test(m376.note) && m376.noteVis && !m376.overflow && !e376.length,
           `v376(v380 막대) ${width}px ④ 작은 그래프 — 덕양구 조각은 흰 속 + 테두리 2 · 채운 파랑은 선 왼쪽에만 · 설명 한 줄`,JSON.stringify({m376,e376}));
        await c376.close();
      }
    }
    // v377 — 글자 스케일: 목록 이름 16 · 금액 19 · 「거래의 N%」 16 + 숫자 --t2 · 비교 탭 19/14/16 · 보이는 글자에 굵기 550 · 650 없음(320 · 390 · 1264)
    {
      const item377=(lawd,i)=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000][i%3],buildYear:2015,floor:5,y:2026,m:11,d:1+i});
      for(const width of [320,390,1264]){
        const c377=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c377.newPage();const e377=[];q.on('pageerror',e=>e377.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){const lawd=u.searchParams.get('lawd');return route.fulfill({json:{ok:true,items:[0,1,2,3,4,5].map(i=>item377(lawd,i)),total:6}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        const heavy=()=>q.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getClientRects().length&&[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())&&/^(550|650)$/.test(getComputedStyle(el).fontWeight)&&!el.closest('.reportwrap,#reportwrap')).map(el=>(el.id||el.className||el.tagName)+':'+getComputedStyle(el).fontWeight).slice(0,6));
        const bad=[]; await q.locator('#welcomeStart232').click(); await q.waitForTimeout(150); bad.push(...await heavy());
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(400); bad.push(...await heavy());
        await q.evaluate(()=>window.yk208Navigate('map')); await q.waitForTimeout(500); await q.evaluate(()=>document.querySelectorAll('#viewDeals details').forEach(d=>d.open=true)); bad.push(...await heavy());
        const m=await q.evaluate(()=>{const px=s=>{const e=document.querySelector(s);return e?getComputedStyle(e).fontSize+'/'+getComputedStyle(e).fontWeight:'none';};const t2=getComputedStyle(document.documentElement).getPropertyValue('--t2').trim();
          return {nm:px('#dealList .dealwrap>.deal>.nm'),amt:px('#dealList .dealwrap>.deal>.amt'),ins:px('#dealDistribution .dd-insight'),insB:px('#dealDistribution .dd-insight b'),t2,overflow:document.documentElement.scrollWidth>innerWidth};});
        await q.evaluate(()=>window.yk208Navigate('compare')); await q.waitForTimeout(400); bad.push(...await heavy());
        const c=await q.evaluate(()=>{const px=s=>{const e=document.querySelector(s);return e?getComputedStyle(e).fontSize:'none';};return {h2:px('#cmpBody h2'),p:px('#cmpBody p'),btn:px('#cmpBody .v208-primary')};});
        ok(m.nm==='16px/600' && m.amt==='19px/700' && m.ins.startsWith('16px') && m.insB.startsWith(m.t2+'/') && c.h2==='19px' && c.p==='14px' && c.btn==='14px' /* v397 — 작은 파란 버튼 14(「실거래 보기」와 같은 규칙)로 옮김 · 옛 16 */ && !bad.length && !m.overflow && !e377.length,
           `v377 ${width}px 글자 스케일 — 목록 16/600 · 19/700 · 「거래의 N%」 16 + 숫자 --t2 · 비교 19/14/14(v397) · 굵기 550 · 650 없음`,JSON.stringify({m,c,bad,e377}));
        await c377.close();
      }
    }
    // v378 — 모서리 스케일(10 · 14 · 20 · 26 · 알약 · 원 · 4px 이하 표식) 밖 0 — 예외: 체크 상자 #noLoanBox 7px · 공유 이미지 카드 안 · 입력 묶음 위/아래만 20 · 켜진 버튼에 #1F5BFF 없음(320 · 390 · 1264)
    {
      for(const width of [320,390,1264]){
        const c378=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c378.newPage();const e378=[];q.on('pageerror',e=>e378.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return route.fulfill({json:{ok:true,items:[0,1,2,3].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000,26000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:4}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        const scan=()=>q.evaluate(()=>{const OK=new Set(['10px','14px','20px','26px']);const bad=[],blue=[];
          for(const el of document.querySelectorAll('body *')){if(!el.getClientRects().length||el.closest('#reportCard,.reportwrap,#reportwrap')||el.id==='noLoanBox')continue;const cs=getComputedStyle(el);if(cs.visibility==='hidden')continue;
            const r=el.getBoundingClientRect();if(r.width<4||r.height<4)continue;
            if(el.tagName==='BUTTON'&&!el.disabled&&/rgb\(31, 91, 255\)/.test(cs.backgroundColor))blue.push(el.id||el.className);
            if(cs.backgroundColor==='rgba(0, 0, 0, 0)'&&cs.borderTopWidth==='0px'&&cs.boxShadow==='none')continue;
            for(const rad of [cs.borderTopLeftRadius,cs.borderTopRightRadius,cs.borderBottomRightRadius,cs.borderBottomLeftRadius]){const v=parseFloat(rad);if(!v||OK.has(rad)||v<=4||v>=Math.min(r.width,r.height)/2-0.5)continue;bad.push((el.id||String(el.className).split(' ')[0]||el.tagName)+':'+rad);break;}}
          return {bad:[...new Set(bad)].slice(0,8),blue};});
        const all={bad:[],blue:[]};const add=r=>{all.bad.push(...r.bad);all.blue.push(...r.blue);};
        add(await scan()); await q.locator('#welcomeStart232').click(); await q.waitForTimeout(150);
        await q.evaluate(()=>{S.sgg='11440';S.sido='서울특별시';S.group='seoul';S.houseStatus='none';renderAnswered();syncCta();}); await q.waitForTimeout(250); add(await scan());
        await q.locator('#stepNext353').click(); await q.waitForTimeout(400); add(await scan());
        const corners=await q.evaluate(()=>[...document.querySelectorAll('#crows>.crow,#crows>.inline-money,#crows>.main-no-loan')].filter(e=>e.getClientRects().length).map(e=>{const c=getComputedStyle(e);return [c.borderTopLeftRadius,c.borderBottomLeftRadius].join(' ');}));
        await q.evaluate(()=>openQ(0,'cash')); await q.waitForTimeout(350); await q.fill('#qBox input','20000').catch(()=>{}); await q.waitForTimeout(150); add(await scan());
        await q.evaluate(()=>{try{closeSheet('q')}catch(e){};Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(300); add(await scan());
        for(const t of ['map','compare','conditions']){await q.evaluate(t=>window.yk208Navigate(t),t); await q.waitForTimeout(400); add(await scan());}
        const want=['20px 0px','0px 20px','20px 0px','0px 0px','0px 0px','0px 20px'];
        ok(!all.bad.length && !all.blue.length && corners.length===6 && corners.every((c,i)=>c===want[i]) && !e378.length,
           `v378 ${width}px 모서리 스케일 밖 0(체크 상자 · 공유 이미지 예외) · 입력 묶음 위/아래만 20 · 켜진 버튼 #1F5BFF 없음`,JSON.stringify({bad:[...new Set(all.bad)],blue:[...new Set(all.blue)],corners,e378}));
        await c378.close();
      }
    }
    // v379 — 보이는 테두리 색은 선 #D6DFEC · 입력/선택지 #A4AFC3 둘 + 정해 둔 예외(포커스/선택 파랑 · 비교 빈 칸 점선 · 꼬리표 · 꺾쇠 · 범례 · 알림)뿐 · 조건 미리보기 면 #2458FF(320 · 390 · 1264)
    {
      for(const width of [320,390,1264]){
        const c379=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c379.newPage();const e379=[];q.on('pageerror',e=>e379.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return route.fulfill({json:{ok:true,items:[0,1,2,3].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000,26000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:4}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); await q.mouse.move(1,1);
        const scan=lab=>q.evaluate(lab=>{const OK=new Set(['#D6DFEC','#A4AFC3','#2458FF','#5C85FF','#D6E0F3','#192332','#5F6B7D','#FFFFFF','#8792A8','#465262']);const bad=[],seen={};
          const hex=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return c;const v=m[1].split(',').map(Number);if(v.length===4&&v[3]===0)return '';return '#'+v.slice(0,3).map(x=>Math.round(x).toString(16).padStart(2,'0')).join('').toUpperCase();};
          for(const el of document.querySelectorAll('body *')){if(!el.getClientRects().length||el.closest('#reportCard'))continue;const cs=getComputedStyle(el);if(cs.visibility==='hidden')continue;
            const r=el.getBoundingClientRect();if(r.width<2||r.height<1)continue;
            for(const sd of ['Top','Right','Bottom','Left']){const st=cs['border'+sd+'Style'];if(cs['border'+sd+'Width']==='0px'||st==='none'||st==='hidden')continue;const c=hex(cs['border'+sd+'Color']);if(!c)continue;
              seen[c]=(seen[c]||0)+1;if(OK.has(c)||(c==='#BBC3CF'&&st==='dashed'))continue;bad.push(lab+':'+(el.id||String(el.className).split(' ')[0]||el.tagName)+':'+sd+':'+c);}}
          const cp=document.getElementById('condPreview');const cpBg=cp&&cp.getClientRects().length?getComputedStyle(cp).backgroundColor:'';
          return {bad:[...new Set(bad)].slice(0,8),seen,cpBg};},lab);
        const all={bad:[],seen:{},cp:[]};const add=r=>{all.bad.push(...r.bad);for(const k in r.seen)all.seen[k]=(all.seen[k]||0)+r.seen[k];if(r.cpBg)all.cp.push(r.cpBg);};
        add(await scan('첫화면')); await q.locator('#welcomeStart232').click(); await q.mouse.move(1,1); await q.waitForTimeout(150);
        await q.evaluate(()=>{S.sgg='11440';S.sido='서울특별시';S.group='seoul';S.houseStatus='none';renderAnswered();syncCta();}); await q.waitForTimeout(250);
        await q.locator('#stepNext353').click(); await q.mouse.move(1,1); await q.waitForTimeout(400); add(await scan('입력'));
        for(const [a,b] of [[0,'cash'],[1,'debt'],[2,'region'],[0,'house']]){await q.evaluate(([a,b])=>{try{closeSheet('q')}catch(e){};openQ(a,b);},[a,b]); await q.waitForTimeout(350); add(await scan('시트 '+b));}
        await q.evaluate(()=>{try{closeSheet('q')}catch(e){};Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(300);
        for(const t of ['home','map','compare','conditions']){await q.evaluate(t=>window.yk208Navigate(t),t); await q.waitForTimeout(400); await q.evaluate(()=>document.querySelectorAll('details').forEach(d=>d.open=true)); add(await scan(t));}
        /* v390 — 「선 대신 면」으로 선이 줄어 개수 조건(#D6DFEC 100 · #A4AFC3 50 이상)은 뺌. 남은 선의 색은 그대로 이 둘 + 정해 둔 예외뿐. */
        ok(!all.bad.length && all.cp.length>0 && all.cp.every(c=>c==='rgb(36, 88, 255)') && !e379.length,
           `v379 ${width}px 테두리 색 — 선 #D6DFEC · 입력/선택지 #A4AFC3 + 정해 둔 예외뿐 · 조건 미리보기 #2458FF`,JSON.stringify({bad:[...new Set(all.bad)],seen:all.seen,cp:all.cp,e379}));
        await c379.close();
      }
    }
    // v380 — ④ 작은 그래프 = 12칸 막대: 칸마다 건수가 「분포 자세히」 막대 숫자와 같음 · 합 = 그래프 안 건수 · 점 없음 · ③ 원 숨김 · 「세전 소득의 N%」 보임(320 · 390 · 1264)
    {
      const item380=(lawd,i,amt)=>({name:'검증'+lawd+'-'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:amt,buildYear:2015,floor:5,y:2026,m:11,d:1+i});
      for(const width of [320,390,1264]){
        const c380=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c380.newPage();const e380=[];q.on('pageerror',e=>e380.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){const lawd=u.searchParams.get('lawd');const amts=lawd==='41281'?[33000,32000,34000,15000,52000]:[15000,16000,23000,30000,31000,29000,26000,26500,39000,9000];return route.fulfill({json:{ok:true,items:amts.map((a,i)=>item380(lawd,i,a)),total:amts.length}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(500);
        const m380=await q.evaluate(()=>{const svg=document.querySelector('#mini363 .dd-strip svg'),src=document.querySelector('#dealDistribution .dd-strip svg');if(!svg)return {svg:false};
          const per=[...svg.querySelectorAll('g.bars380>g')].map(g=>{const t=(g.querySelector('title')||{}).textContent||'';const m=t.match(/^(\d+)~/);return {i:m?+m[1]:NaN,n:+(t.match(/(\d+)건$/)||[])[1]};});
          const det=[...document.querySelectorAll('#dealDistribution .dd-bars text')].map(t=>+t.textContent);
          const shown=+(((document.querySelector('#dealDistribution .dd-method')||{}).textContent||'').match(/그래프 안 (\d+)건/)||[])[1];
          const ring=document.querySelector('#payTile .v288-ring'),pt=document.querySelector('#payTile .ans-pct');
          return {svg:true,circles:svg.querySelectorAll('circle').length+(src?src.querySelectorAll('circle').length:0),sum:per.reduce((a,p)=>a+p.n,0),nonzero:det.filter(n=>n>0),bars:per.map(p=>p.n),shown,
            ring:ring?getComputedStyle(ring).display:'none',pct:pt?pt.textContent.replace(/\s+/g,' ').trim():'',pctVis:!!(pt&&pt.getClientRects().length),overflow:document.documentElement.scrollWidth>innerWidth};});
        ok(m380.svg && m380.circles===0 && m380.bars.length>=3 && m380.sum===m380.shown && JSON.stringify(m380.bars)===JSON.stringify(m380.nonzero) && m380.ring==='none' && /세전 소득의\s*\d+\s*%/.test(m380.pct) && m380.pctVis && !m380.overflow && !e380.length,
           `v380 ${width}px ④ 막대 — 칸 건수 = 「분포 자세히」 막대 숫자 · 합 = 그래프 안 건수 · 점 없음 · ③ 원 숨김 · 「세전 소득의 N%」 보임`,JSON.stringify({m380,e380}));
        await c380.close();
      }
    }
    // v381 — 주택 보유 시트: 처음 · 생애최초/무주택이면 「적용」 줄 없음(아래 여백 ≥ 24) · 1주택 이상이면 보임 / ≤360 「이미지 저장」 그림이 버튼 안에 / 꺾쇠 2px(320 · 360 · 390 · 1264)
    {
      for(const width of [320,360,390,1264]){
        const c381=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c381.newPage();const e381=[];q.on('pageerror',e=>e381.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); await q.locator('#welcomeStart232').click(); await q.waitForTimeout(150);
        const vis=()=>q.evaluate(()=>{const a=document.querySelector('#qSheet .sheet-actions');return !!(a&&a.getClientRects().length);});
        await q.evaluate(()=>openQ(0,'house')); await q.waitForTimeout(350);
        const h0=await vis(), pad=await q.evaluate(()=>{const s=document.getElementById('qSheet'),e=document.getElementById('houseEcho');return Math.round(s.getBoundingClientRect().bottom-e.getBoundingClientRect().bottom);});
        await q.locator('#houseSeg [data-house="multi"]').click(); await q.waitForTimeout(250); const h1=await vis();
        await q.evaluate(()=>{closeSheet('q');S.houseStatus='first';openQ(0,'house');}); await q.waitForTimeout(350); const h2=await vis();
        await q.evaluate(()=>{closeSheet('q');openQ(0,'cash');}); await q.waitForTimeout(350); const h3=await vis();
        await q.evaluate(()=>{closeSheet('q');Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);}); await q.waitForTimeout(500);
        const b381=await q.evaluate(()=>{const o=document.getElementById('outSave'),ic=o&&o.querySelector('.action-icon'),t=o&&o.querySelector('.txt b');if(!o||!ic)return null;const ob=o.getBoundingClientRect(),ib=ic.getBoundingClientRect(),tb=t.getBoundingClientRect();
          const ch=document.querySelector('#marketOpen .chev-r'),fv=document.querySelector('.flow358 button.f-cost .f-v');
          return {iconW:Math.round(ib.width),inside:ib.right<=ob.right-8&&tb.left>=ob.left+8&&tb.right<=ib.left,chev:ch?getComputedStyle(ch).borderRightWidth:'',fv:fv?getComputedStyle(fv,'::after').content+' '+getComputedStyle(fv,'::after').borderRightWidth:''};});
        ok(!h0 && pad>=24 && h1 && !h2 && h3 && b381 && b381.iconW===20 && b381.inside && b381.chev==='2px' && b381.fv==='"" 2px' && !e381.length,
           `v381 ${width}px 주택 시트 「적용」 1주택 이상만(처음 · 생애최초 숨김 · 현금 시트 그대로) · 「이미지 저장」 그림 20px 버튼 안 · 꺾쇠 2px`,JSON.stringify({h0,pad,h1,h2,h3,b381,e381}));
        await c381.close();
      }
    }
    // v382 — 한도표: 320 · 390 · 1264px 가로 넘침 0 · 보이는 열 3개(한도 → 월 상환액 전환 · 키보드 화살표로도) · 390px 표 구획 높이 1,000px 미만(v381 1,997px)
    {
      const r382={};
      for(const width of [320,390,1264]){
        const c382=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c382.newPage();const e382=[];q.on('pageerror',e=>e382.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false}});
          const file=path.resolve(ROOT,'.'+u.pathname);if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/dsr-income-table.html'); await q.evaluate(()=>document.fonts.ready);
        const m=()=>q.evaluate(()=>{const sec=document.getElementById('table'),sc=sec.querySelector('.scroll');return {over:sc.scrollWidth>sc.clientWidth||document.documentElement.scrollWidth>innerWidth,cols:[...sec.querySelectorAll('thead th')].filter(t=>getComputedStyle(t).display!=='none').map(t=>t.textContent).join('|'),cells:[...sec.querySelectorAll('tbody tr:first-child > *')].filter(t=>getComputedStyle(t).display!=='none').map(t=>t.textContent).join('|'),h:Math.round(sec.getBoundingClientRect().height)};});
        const has=await q.locator('label[for="t382-pay"]').count();
        const a=await m(); if(has) await q.locator('label[for="t382-pay"]').click(); const b=await m();
        if(has){ await q.focus('#t382-pay'); await q.keyboard.press('ArrowLeft'); } const c=await m();
        r382[width]={a,b,c,e382};
        ok(!a.over && !b.over && a.cols==='연 소득|수도권 한도|지방 한도' && a.cells==='3,000만원|1억 3,100만원|1억 6,400만원' && b.cols==='연 소득|수도권 월 상환액|지방 월 상환액' && b.cells==='3,000만원|74만원|93만원' && c.cols===a.cols && (width!==390 || a.h<1000) && !e382.length,
           `v382 ${width}px 한도표 — 넘침 0 · 3열 · 한도 ↔ 월 상환액(누름 · 화살표)`,JSON.stringify(r382[width]));
        await c382.close();
      }
    }
    // v383 — 시트 6종(현금 · 소득 · 지역(서울 펼침) · 주택(1주택 이상) · 기존 대출(나눠 입력 펼침) · 부대비용)의 보이는 글자가 모두 스케일 안 · 예외는 큰 금액 칸 36px 하나(320 · 390 · 1264)
    {
      for(const width of [320,390,1264]){
        const c383=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c383.newPage();const e383=[];q.on('pageerror',e=>e383.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); await q.locator('#welcomeStart232').click(); await q.waitForTimeout(150);
        const SC=width<=400?[28,24,19,17,16,14,13,12]:[30,26,19,17,16,14,13,12];
        const scan=(lab,root)=>q.evaluate(([lab,root,SC])=>{const S=new Set(SC),out=[];const R=document.querySelector(root);if(!R)return [lab+':no-root'];
          for(const el of R.querySelectorAll('*')){if(!el.getClientRects().length)continue;const cs=getComputedStyle(el);if(cs.visibility==='hidden'||el.closest('.sr-only'))continue;
            const ctl=/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName),own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(!own&&!ctl)continue;
            const fz=parseFloat(cs.fontSize);if(S.has(fz)||(el.id==='inMoneyMan'&&fz===36))continue;out.push(lab+':'+(el.id||el.tagName+'.'+String(el.className).split(' ')[0])+':'+fz);}
          return [...new Set(out)];},[lab,root,SC]);
        const bad=[];
        for(const [st,m] of [[0,'cash'],[1,'income'],[2,'region'],[0,'house'],[0,'debt']]){
          await q.evaluate(([st,m])=>{try{closeSheet('q')}catch(e){};if(m==='house')S.houseStatus='multi';openQ(st,m);},[st,m]); await q.waitForTimeout(350);
          if(m==='debt') await q.evaluate(()=>{const b=document.getElementById('debtPartsToggle');if(b&&b.getAttribute('aria-expanded')!=='true')b.click();});
          if(m==='region') await q.evaluate(()=>{const b=document.querySelector('#qSheet [data-group="seoul"]');b&&b.click();});
          await q.waitForTimeout(200); bad.push(...await scan(m,'#qSheet'));
        }
        await q.evaluate(()=>{closeSheet('q');Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);}); await q.waitForTimeout(400);
        await q.evaluate(()=>{const b=document.querySelector('.flow358 button.f-cost');b&&b.click();}); await q.waitForTimeout(400); bad.push(...await scan('why','#whySheet'));
        ok(!bad.length && !e383.length, `v383 ${width}px 시트 6종 글자 크기 모두 스케일 안(큰 금액 칸 36px만 예외)`, JSON.stringify({bad,e383}));
        await c383.close();
      }
    }
    // v384 — 화면의 아이콘 선 굵기: 그림 1.8px · 테두리 꺾쇠 2px 둘뿐(로고 2.4 · 그래프 · 첫 화면 그림 · 공유 카드 · 흐린 장식 그림 빼고 · 320 · 390 · 1264)
    {
      for(const width of [320,390,1264]){
        const c384=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c384.newPage();const e384=[];q.on('pageerror',e=>e384.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return route.fulfill({json:{ok:true,items:[0,1,2].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:3}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        const scan=lab=>q.evaluate(lab=>{const bad=[],seen={};const SKIP='#reportCard,#welcome232 .welcome232-scene,.dd-strip,.dd-group,.dd-bars,#barLabel,#homeBtn,#fundingOverview>.rhead';
          const add=(el,ps,v)=>{const k=+v.toFixed(1);seen[k]=(seen[k]||0)+1;if(!(Math.abs(v-1.8)<=0.05||v===2))bad.push(lab+':'+(el.id||el.tagName+'.'+String(el.className&&el.className.baseVal!==undefined?el.className.baseVal:el.className).split(' ')[0])+ps+':'+v.toFixed(2));};
          for(const svg of document.querySelectorAll('svg')){if(!svg.getClientRects().length||svg.closest(SKIP))continue;const r=svg.getBoundingClientRect();if(r.width<8||r.width>40)continue;const vb=svg.viewBox&&svg.viewBox.baseVal,k=vb&&vb.width?r.width/vb.width:1;
            for(const e of svg.querySelectorAll('path,circle,rect,line,polyline,polygon,ellipse')){const cs=getComputedStyle(e);if(cs.stroke==='none')continue;add(svg.parentElement,'>svg',parseFloat(cs.strokeWidth)*(cs.vectorEffect==='non-scaling-stroke'?1:k));}}
          for(const el of document.querySelectorAll('body *')){if(!el.getClientRects().length||el.closest(SKIP))continue;
            for(const ps of ['','::before','::after']){const cs=getComputedStyle(el,ps||null);if(ps&&(cs.content==='none'||cs.content==='normal'))continue;
              for(const prop of ['backgroundImage','webkitMaskImage']){const v=cs[prop];if(!v||!/svg/.test(v))continue;let d;try{d=decodeURIComponent(v)}catch(e){d=v}const m=[...d.matchAll(/stroke-width='([\d.]+)'/g)].map(x=>+x[1]);if(!m.length)continue;
                const vw=+((d.match(/viewBox='[\d.\s-]+'/)||[''])[0].replace(/[^\d.\s]/g,'').trim().split(/\s+/)[2]||24);const bs=(prop==='backgroundImage'?cs.backgroundSize:cs.webkitMaskSize)||'';const bm=bs.match(/^([\d.]+)px/);const size=bm?+bm[1]:parseFloat(cs.width);
                if(size>40)continue;for(const x of new Set(m))add(el,ps,x*size/vw);break;}
              const bw=Math.max(...['Top','Right','Bottom','Left'].map(sd=>cs['border'+sd+'Style']==='solid'?parseFloat(cs['border'+sd+'Width']):0));
              if(bw>0&&parseFloat(cs.width)<=12&&parseFloat(cs.height)<=12&&/matrix/.test(cs.transform))add(el,ps+'[border]',bw);}}
          return {bad:[...new Set(bad)],seen};},lab);
        const res={bad:[],seen:{}};const put=r=>{res.bad.push(...r.bad);for(const k in r.seen)res.seen[k]=(res.seen[k]||0)+r.seen[k];};
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); put(await scan('첫'));
        await q.locator('#welcomeStart232').click(); await q.waitForTimeout(150); put(await scan('입력'));
        for(const [st,m] of [[0,'cash'],[2,'region'],[0,'house'],[0,'debt']]){await q.evaluate(([st,m])=>{try{closeSheet('q')}catch(e){};if(m==='debt')S.debtMonthly=0;openQ(st,m);},[st,m]);await q.waitForTimeout(300);
          if(m==='region'){await q.evaluate(()=>{document.querySelector('#qSheet [data-group="seoul"]').click();});await q.waitForTimeout(150);await q.evaluate(()=>{const c=document.querySelector('#regionPane .taggrid .chip');c&&c.click();});await q.waitForTimeout(150);}
          if(m==='debt'){await q.evaluate(()=>{const b=document.getElementById('debtPartsToggle');b&&b.getAttribute('aria-expanded')!=='true'&&b.click();});await q.waitForTimeout(150);}
          put(await scan('시트-'+m));}
        await q.evaluate(()=>{closeSheet('q');Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(400);
        for(const t of ['home','map','compare','conditions']){await q.evaluate(t=>window.yk208Navigate(t),t);await q.waitForTimeout(350);await q.evaluate(()=>document.querySelectorAll('#app details').forEach(d=>d.open=true));put(await scan(t));}
        await q.evaluate(()=>window.yk208Navigate('home')); await q.waitForTimeout(250); await q.evaluate(()=>{const b=document.querySelector('.flow358 button.f-cost');b&&b.click();}); await q.waitForTimeout(400); put(await scan('부대비용'));
        ok(!res.bad.length && (res.seen['1.8']||0)>=10 && (res.seen['2']||0)>=8 && !e384.length, `v384 ${width}px 아이콘 선 굵기 — 그림 1.8px · 꺾쇠 2px뿐`, JSON.stringify({bad:[...new Set(res.bad)],seen:res.seen,e384}));
        await c384.close();
      }
    }
    // v385 — 보이는 글자 중 --t1보다 큰 것은 36px(--t0)뿐 · 큰 숫자(집값 · 금액 칸 · 월 상환액) 36 · 큰 제목은 넓은 화면 36 / 좁은 화면 --t1(320 · 390 · 1264 · 공유 이미지 카드 #reportCard는 화면에 안 보여 뺌)
    {
      for(const width of [320,390,1264]){
        const c385=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c385.newPage();const e385=[];q.on('pageerror',e=>e385.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return route.fulfill({json:{ok:true,items:[0,1,2].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:3}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        const T1=width<=400?28:30;const big=[],at36=new Set(),titles={};
        const scan=lab=>q.evaluate(([lab,T1])=>{const out=[],seen=[],tt={};for(const el of document.querySelectorAll('body *')){if(!el.getClientRects().length||el.closest('#reportCard,.sr-only'))continue;const cs=getComputedStyle(el);if(cs.visibility==='hidden')continue;
            const ctl=/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName),own=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());if(!own&&!ctl)continue;const r=el.getBoundingClientRect();if(r.width<1||r.height<1)continue;
            const fz=parseFloat(cs.fontSize),key=el.id||String(el.className).split(' ')[0]||el.tagName;if(el.id==='welcomeTitle232'||el.classList.contains('cond-lead'))tt[lab+':'+key]=fz;
            if(fz>T1+0.01){if(Math.abs(fz-36)>0.01)out.push(lab+':'+key+':'+fz.toFixed(2));else seen.push(key);}}
          return {out,seen,tt};},[lab,T1]);
        const put=r=>{big.push(...r.out);r.seen.forEach(k=>at36.add(k));Object.assign(titles,r.tt);};
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); put(await scan('첫'));
        await q.locator('#welcomeStart232').click(); await q.waitForTimeout(150); put(await scan('입력'));
        const lead1=await q.evaluate(()=>{const h=document.querySelector('#app[data-v208-tab="entry"] .funnel .cond-lead');if(!h)return 0;const r=document.createRange();r.selectNodeContents(h);return [...new Set([...r.getClientRects()].filter(x=>x.width>0).map(x=>Math.round(x.top)))].length;});
        await q.evaluate(()=>{S.sgg='11440';S.sido='서울특별시';S.group='seoul';S.houseStatus='none';renderAnswered();syncCta();}); await q.waitForTimeout(250);
        const nb=await q.locator('#stepNext353').boundingBox(); await q.mouse.move(nb.x+nb.width/2,nb.y+nb.height/2); await q.waitForTimeout(250);
        const hov=await q.evaluate(()=>{const b=document.getElementById('stepNext353');return b.matches(':hover')&&!b.disabled?getComputedStyle(b).backgroundColor:'not-hover';}); await q.mouse.move(1,1); await q.waitForTimeout(200);
        for(const [st,m] of [[0,'cash'],[1,'income'],[0,'debt']]){await q.evaluate(([st,m])=>{try{closeSheet('q')}catch(e){};openQ(st,m);},[st,m]);await q.waitForTimeout(300);
          if(m==='debt'){await q.evaluate(()=>{const b=document.getElementById('debtPartsToggle');b&&b.getAttribute('aria-expanded')!=='true'&&b.click();});await q.waitForTimeout(150);}
          put(await scan('시트-'+m));}
        await q.evaluate(()=>{closeSheet('q');Object.assign(S,{cash:150000,income:30000,sgg:'11680',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(400);
        const fit=await q.evaluate(()=>{const b=document.getElementById('fundingOverview').getBoundingClientRect();return [...document.querySelectorAll('#easyPrice .money-part')].every(p=>p.getBoundingClientRect().right<=b.right+0.5)&&document.documentElement.scrollWidth<=innerWidth;});
        for(const t of ['home','map','compare','conditions']){await q.evaluate(t=>window.yk208Navigate(t),t);await q.waitForTimeout(350);await q.evaluate(()=>document.querySelectorAll('#app details').forEach(d=>d.open=true));put(await scan(t));}
        await q.evaluate(()=>window.yk208Navigate('home')); await q.waitForTimeout(250); await q.evaluate(()=>{const b=document.querySelector('.flow358 button.f-cost');b&&b.click();}); await q.waitForTimeout(400); put(await scan('부대비용'));
        const T2=width<=400?24:26;const tOK=width>=960 ? titles['첫:welcomeTitle232']===36 && titles['입력:cond-lead']===36 : titles['첫:welcomeTitle232']===T1 && titles['입력:cond-lead']===T2 && lead1===1;
        ok(!big.length && ['money-part','tileMonthly','inMoneyMan'].every(k=>at36.has(k)) && tOK && fit && hov==='rgb(24, 72, 214)' && !e385.length, `v385 ${width}px 「표시」 단계 — --t1보다 큰 글자는 36px뿐 · 집값 · 금액 칸 · 월 상환액 36 · 큰 제목 ${width>=960?'36 · 36':T1+' · 입력 '+(width<=400?24:26)+' 한 줄'} · 17억대 집값 넘침 없음 · 「다음」 올림 #1848D6`, JSON.stringify({big:[...new Set(big)],at36:[...at36],titles,fit,hov,e385,lead1}));
        await c385.close();
      }
    }
    // (v387: 「기존 대출 나눠 입력 칸은 상자 그대로」 조건은 v387이 그 칸을 같은 방식으로 바꿔 v387 잠금으로 옮김)
    // v386 — 부대비용 시트: 금액이 상자 없이 글자 · 위 취득세 금액과 같은 열 · 「만원」/밑줄 아래를 눌러도 편집 · 편집 중 파랑 · 「12,345」 넘침 없음 · 바꾸면 합계 갱신 · 꺼진 항목은 안 눌림 · 기존 대출 나눠 입력 칸은 상자 그대로(320 · 390 · 1264)
    {
      for(const width of [320,390,1264]){
        const c386=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c386.newPage();const e386=[];q.on('pageerror',e=>e386.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); await q.locator('#welcomeStart232').click(); await q.waitForTimeout(150);
        await q.evaluate(()=>{openQ(0,'debt');}); await q.waitForTimeout(300); await q.evaluate(()=>{const b=document.getElementById('debtPartsToggle');b&&b.getAttribute('aria-expanded')!=='true'&&b.click();}); await q.waitForTimeout(200);
        const debtBox=await q.evaluate(()=>{const a=document.querySelector('#debtParts .costrow .amt');if(!a||!a.getClientRects().length)return 'hidden';const cs=getComputedStyle(a);return cs.borderTopWidth+'|'+cs.borderRadius;});
        await q.evaluate(()=>{closeSheet('q');Object.assign(S,{cash:150000,income:30000,sgg:'11680',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);}); await q.waitForTimeout(400);
        await q.evaluate(()=>{const b=document.querySelector('.flow358 button.f-cost');b&&b.click();}); await q.waitForTimeout(500);
        const look=await q.evaluate(()=>{const lv=document.querySelector('#costItems .line>.v').getBoundingClientRect().right;
          return [...document.querySelectorAll('#whySheet #costBox .costrow')].map(r=>{const a=r.querySelector('.amt'),i=a.querySelector('input'),u=a.querySelector('u'),cs=getComputedStyle(a);
            return {h:Math.round(r.getBoundingClientRect().height),bg:cs.backgroundColor,top:cs.borderTopWidth,bb:cs.borderBottomWidth+' '+cs.borderBottomColor,dis:i.disabled,fi:parseFloat(getComputedStyle(i).fontSize),fu:parseFloat(getComputedStyle(u).fontSize),edge:Math.abs(a.getBoundingClientRect().right-lv)<=1};});});
        const lookOK=look.length===4&&look.every(x=>x.h<=62&&x.bg==='rgba(0, 0, 0, 0)'&&x.top==='0px'&&x.fi===16&&x.fu===16&&x.edge&&(x.dis?/rgba\(0, 0, 0, 0\)$/.test(x.bb):x.bb==='1px rgb(164, 175, 195)'));
        const total0=await q.evaluate(()=>document.getElementById('costImpactTotal').textContent.trim());
        const ub=await q.locator('#inLegal + u').boundingBox(); await q.mouse.click(ub.x+ub.width/2,ub.y+ub.height/2); await q.waitForTimeout(150); const f1=await q.evaluate(()=>document.activeElement.id);
        await q.evaluate(()=>document.activeElement.blur()); await q.waitForTimeout(100);
        const ab=await q.locator('#inBroker').boundingBox(); await q.mouse.click(ab.x+ab.width/2,ab.y+ab.height+5); await q.waitForTimeout(150); const f2=await q.evaluate(()=>document.activeElement.id);
        const fl=await q.evaluate(()=>getComputedStyle(document.getElementById('inBroker').parentElement).borderBottomColor);
        await q.keyboard.press('Control+A'); await q.keyboard.type('12345'); const ov=await q.evaluate(()=>{const i=document.getElementById('inBroker');return i.value+'|'+(i.scrollWidth>i.clientWidth+1);});
        await q.evaluate(()=>document.activeElement.blur()); await q.waitForTimeout(500); const total1=await q.evaluate(()=>document.getElementById('costImpactTotal').textContent.trim());
        const mb=await q.locator('#inMove').boundingBox(); await q.mouse.click(mb.x+mb.width/2,mb.y+mb.height/2); await q.waitForTimeout(150); const f4=await q.evaluate(()=>document.activeElement.id);
        ok(lookOK && f1==='inLegal' && f2==='inBroker' && fl==='rgb(36, 88, 255)' && ov==='12,345|false' && total1!==total0 && f4!=='inMove' && !e386.length,
           `v386 ${width}px 부대비용 금액 — 상자 없이 글자 · 취득세와 같은 열 · 「만원」/밑줄 아래 눌러도 편집 · 「12,345」 넘침 없음 · 합계 갱신 · 꺼진 항목 안 눌림`, JSON.stringify({look,f1,f2,fl,ov,total0,total1,f4,debtBox,e386}));
        await c386.close();
      }
    }
    // v387 — 기존 대출 「대출별로 나눠 입력」: 4칸 상자 없이 글자 · 16px · 밑줄 #A4AFC3 · 빈칸 「만원」 회색 · 「만원」/밑줄 아래 눌러도 편집 · 편집 중 파랑 · 입력하면 위 합계에 더해짐(320 · 390 · 1264)
    {
      for(const width of [320,390,1264]){
        const c387=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c387.newPage();const e387=[];q.on('pageerror',e=>e387.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); await q.locator('#welcomeStart232').click(); await q.mouse.move(1,1); await q.waitForTimeout(150);
        await q.evaluate(()=>openQ(0,'debt')); await q.waitForTimeout(350); await q.evaluate(()=>{const b=document.getElementById('debtPartsToggle');b&&b.getAttribute('aria-expanded')!=='true'&&b.click();}); await q.waitForTimeout(300);
        await q.evaluate(()=>document.getElementById('debtParts').scrollIntoView({block:'center'})); await q.waitForTimeout(150);
        const look=await q.evaluate(()=>[...document.querySelectorAll('#debtParts .costrow')].filter(r=>r.getClientRects().length).map(r=>{const a=r.querySelector('.amt'),i=a.querySelector('input'),u=a.querySelector('u'),cs=getComputedStyle(a);
          return {h:Math.round(r.getBoundingClientRect().height),bg:cs.backgroundColor,top:cs.borderTopWidth,bb:cs.borderBottomWidth+' '+cs.borderBottomColor,fi:parseFloat(getComputedStyle(i).fontSize),fu:parseFloat(getComputedStyle(u).fontSize),uc:getComputedStyle(u).color};}));
        const lookOK=look.length===4&&look.every(x=>x.h<=60&&x.bg==='rgba(0, 0, 0, 0)'&&x.top==='0px'&&x.bb==='1px rgb(164, 175, 195)'&&x.fi===16&&x.fu===16&&x.uc==='rgb(132, 144, 161)');
        const ub=await q.locator('#inDebtEtc + u').boundingBox(); await q.mouse.click(ub.x+ub.width/2,ub.y+ub.height/2); await q.waitForTimeout(150); const f1=await q.evaluate(()=>document.activeElement.id);
        await q.evaluate(()=>document.activeElement.blur()); await q.waitForTimeout(100);
        const cb=await q.locator('#inDebtCredit').boundingBox(); await q.mouse.click(cb.x+cb.width/2,cb.y+cb.height+5); await q.waitForTimeout(150); const f2=await q.evaluate(()=>document.activeElement.id);
        await q.keyboard.type('35'); await q.waitForTimeout(300);
        const st=await q.evaluate(()=>({ring:getComputedStyle(document.getElementById('inDebtCredit')).outlineStyle+'|'+getComputedStyle(document.getElementById('inDebtCredit').parentElement).outlineStyle,sum:document.getElementById('inDebt').value,uc:getComputedStyle(document.querySelector('#inDebtCredit + u')).color,line:getComputedStyle(document.getElementById('inDebtCredit').parentElement).borderBottomColor,mainBox:(()=>{const m=document.getElementById('inDebt').closest('.moneycard');return m?getComputedStyle(m).borderTopWidth:'none';})()}));
        ok(lookOK && f1==='inDebtEtc' && f2==='inDebtCredit' && st.sum==='35' && st.uc==='rgb(25, 35, 50)' && st.line==='rgb(36, 88, 255)' && st.mainBox==='1px' && st.ring==='none|none' && !e387.length,
           `v387 ${width}px 나눠 입력 — 4칸 상자 없이 글자 · 밑줄 · 빈칸 「만원」 회색 · 「만원」/밑줄 아래 눌러도 편집 · 편집 중 테두리 없이 밑줄만 · 입력하면 합계 35 · 위 합계 칸은 상자 그대로`, JSON.stringify({look,f1,f2,st,e387}));
        await c387.close();
      }
    }
    // v388 — 화면에 보이는 글자는 모두 스케일 안(--t0 36 · --t1~--t8 · ≤400 값) · 첫 화면 · 입력 · 시트 5개 · 결과 4탭(펼침 모두) · 부대비용 · 320/390/768/1264(공유 이미지 카드 #reportCard · 글자 크기 0인 아이콘 자리 글자는 뺌)
    {
      for(const width of [320,390,768,1264]){
        const c388=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c388.newPage();const e388=[];q.on('pageerror',e=>e388.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return route.fulfill({json:{ok:true,items:[0,1,2].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:3}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        const SC=width<=400?[36,28,24,19,17,16,14,13,12]:[36,30,26,19,17,16,14,13,12];const bad=[];let n=0;
        const scan=lab=>q.evaluate(([lab,SC])=>{const S=new Set(SC),out=[];let n=0;for(const el of document.querySelectorAll('body *')){if(!el.getClientRects().length||el.closest('#reportCard,.sr-only'))continue;const cs=getComputedStyle(el);if(cs.visibility==='hidden')continue;
            const ctl=/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName),own=[...el.childNodes].some(x=>x.nodeType===3&&x.textContent.trim());if(!own&&!ctl)continue;const r=el.getBoundingClientRect();if(r.width<1||r.height<1)continue;
            const fz=Math.round(parseFloat(cs.fontSize)*100)/100;if(fz===0)continue;n++;if(!S.has(fz))out.push(lab+':'+(el.id||String(el.className).split(' ')[0]||el.tagName)+':'+fz+':'+(el.value||el.textContent.trim()).slice(0,10));}
          return {out,n};},[lab,SC]);
        const put=r=>{bad.push(...r.out);n+=r.n;};
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); put(await scan('첫'));
        await q.locator('#welcomeStart232').click(); await q.waitForTimeout(150); put(await scan('입력'));
        for(const [st,m] of [[0,'cash'],[1,'income'],[2,'region'],[0,'house'],[0,'debt']]){await q.evaluate(([st,m])=>{try{closeSheet('q')}catch(e){};if(m==='house')S.houseStatus='multi';openQ(st,m);},[st,m]);await q.waitForTimeout(300);
          if(m==='debt'){await q.evaluate(()=>{const b=document.getElementById('debtPartsToggle');b&&b.getAttribute('aria-expanded')!=='true'&&b.click();});await q.waitForTimeout(150);}
          put(await scan('시트-'+m));}
        await q.evaluate(()=>{closeSheet('q');Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(400);
        for(const t of ['home','map','compare','conditions']){await q.evaluate(t=>window.yk208Navigate(t),t);await q.waitForTimeout(350);await q.evaluate(()=>document.querySelectorAll('#app details').forEach(d=>d.open=true));put(await scan(t));}
        await q.evaluate(()=>window.yk208Navigate('home')); await q.waitForTimeout(250); await q.evaluate(()=>{const b=document.querySelector('.flow358 button.f-cost');b&&b.click();}); await q.waitForTimeout(400); put(await scan('부대비용'));
        const head=await q.evaluate(()=>{const b=document.getElementById('barLabel')||document.getElementById('homeBtn');const r=b.getBoundingClientRect();return Math.round(r.height)<=Math.ceil(parseFloat(getComputedStyle(b).lineHeight)||40)+2&&document.documentElement.scrollWidth<=innerWidth;});
        ok(!bad.length && n>200 && head && !e388.length, `v388 ${width}px 스케일 — 보이는 글자 ${n}개 모두 스케일 안(36 · ${SC.slice(1).join(' · ')}) · 머리줄 한 줄 · 가로 넘침 없음`, JSON.stringify({bad:[...new Set(bad)].slice(0,20),n,head,e388}));
        await c388.close();
      }
    }
    // v389 — 화면에 보이는 글자 · aria-label · placeholder · title에 「~세요 · ~십시오」 없음(첫 화면 · 입력 · 시트 5개 · 결과 4탭 · 부대비용 · 실거래 0건) · 「실거래 보기」 flex 간격 4px · 글자와 돌린 꺾쇠 상자 사이 2px 이상(390 · 1264)
    {
      for(const width of [390,1264]){
        const c389=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c389.newPage();const e389=[];q.on('pageerror',e=>e389.push(e.message));let mode='ok';
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return mode==='ok'?route.fulfill({json:{ok:true,items:[0,1,2].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:3}}):route.fulfill({json:{ok:true,items:[],total:0}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        const hits=new Set();
        const grab=lab=>q.evaluate(lab=>{const o=[];const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){const t=n.nodeValue.trim();if(!/(세요|십시오)/.test(t))continue;const e=n.parentElement;if(!e||!e.getClientRects().length||getComputedStyle(e).visibility==='hidden'||e.closest('script,style'))continue;o.push(lab+':'+t.slice(0,40));}
          document.querySelectorAll('[aria-label],[placeholder],[title]').forEach(e=>{for(const a of ['aria-label','placeholder','title']){const v=e.getAttribute(a);if(v&&/(세요|십시오)/.test(v))o.push(lab+'@'+a+':'+v.slice(0,40));}});return o;},lab);
        const add=async lab=>(await grab(lab)).forEach(x=>hits.add(x));
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); await add('첫');
        await q.locator('#welcomeStart232').click(); await q.waitForTimeout(150); await add('입력');
        for(const [st,m] of [[0,'cash'],[1,'income'],[2,'region'],[0,'house'],[0,'debt']]){await q.evaluate(([st,m])=>{try{closeSheet('q')}catch(e){};openQ(st,m);},[st,m]);await q.waitForTimeout(300);
          if(m==='debt'){await q.evaluate(()=>{const b=document.getElementById('debtPartsToggle');b&&b.getAttribute('aria-expanded')!=='true'&&b.click();});await q.waitForTimeout(150);}
          await add('시트-'+m);}
        await q.evaluate(()=>{closeSheet('q');Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(400);
        const chev=await q.evaluate(()=>{const m=document.getElementById('marketOpen');if(!m||!m.getClientRects().length)return -1;const t=[...m.childNodes].find(n=>n.nodeType===3&&n.nodeValue.trim());const c=m.querySelector('.chev-r');if(!t||!c)return -2;const r=document.createRange();r.selectNodeContents(t);const rs=[...r.getClientRects()].filter(x=>x.width>0);return getComputedStyle(m).columnGap==='4px' ? Math.round((c.getBoundingClientRect().left-rs[rs.length-1].right)*10)/10 : -9;});
        for(const t of ['home','map','compare','conditions']){await q.evaluate(t=>window.yk208Navigate(t),t);await q.waitForTimeout(350);await q.evaluate(()=>document.querySelectorAll('#app details').forEach(d=>d.open=true));await add(t);}
        await q.evaluate(()=>window.yk208Navigate('home')); await q.evaluate(()=>{const b=document.querySelector('.flow358 button.f-cost');b&&b.click();}); await q.waitForTimeout(400); await add('부대비용');
        mode='empty'; await q.evaluate(()=>{try{closeSheet('why')}catch(e){};S.sgg='11110';showResult(false);}); await q.waitForTimeout(800); await q.evaluate(()=>window.yk208Navigate('map')); await q.waitForTimeout(400); await add('실거래0건');
        ok(!hits.size && chev>=2 && !e389.length, `v389 ${width}px 말투 — 보이는 글자 · 라벨에 「~세요」 없음 · 「실거래 보기」 꺾쇠 앞 간격 4px(돌린 꺾쇠 상자까지 ${chev}px · v388 -1.4px로 겹침)`, JSON.stringify({hits:[...hits].slice(0,10),chev,e389}));
        await c389.close();
      }
    }
    // v390 — 「선 대신 면」 실측(320 · 390 · 1264): 배경 · 카드/시트/하단 탭 테두리 없음 · 입력칸 면 #F1F4F8 · 포커스 파랑 2px 한 겹(안쪽 입력칸 테두리 없음) · 지역 칩 면/고른 칩 #EDF2FF · 첫 화면 제목 자간 -.03em
    {
      for(const width of [320,390,1264]){
        const c390=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c390.newPage();const e390=[];q.on('pageerror',e=>e390.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return route.fulfill({json:{ok:true,items:[0,1,2].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:3}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        const noLine=sel=>q.evaluate(sel=>[...document.querySelectorAll(sel)].filter(e=>e.getClientRects().length).map(e=>{const cs=getComputedStyle(e);return ['Top','Right','Bottom','Left'].some(sd=>parseFloat(cs['border'+sd+'Width'])>0&&cs['border'+sd+'Style']!=='none'&&!/rgba\(\d+, \d+, \d+, 0\)/.test(cs['border'+sd+'Color']))?(e.id||e.className):'';}).filter(Boolean),sel);
        const bad=[];
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        const bg=await q.evaluate(()=>[document.documentElement,document.body,document.getElementById('app')].map(e=>getComputedStyle(e).backgroundColor));
        const ls=await q.evaluate(()=>{const t=document.getElementById('welcomeTitle232'),cs=getComputedStyle(t);return Math.round(parseFloat(cs.letterSpacing)/parseFloat(cs.fontSize)*1000)/1000;});
        bad.push(...await noLine('#welcome232 .welcome232-start, #welcome232 .v305-reads>a, #app .appbar'));
        await q.locator('#welcomeStart232').click(); await q.mouse.move(1,1); await q.waitForTimeout(150);
        await q.evaluate(()=>{S.sgg='11440';S.sido='서울특별시';S.group='seoul';S.houseStatus='none';renderAnswered();syncCta();}); await q.waitForTimeout(200);
        await q.locator('#stepNext353').click(); await q.mouse.move(1,1); await q.waitForTimeout(400);
        bad.push(...await noLine('#crows>.crow, #crows>.inline-money, #crows>.main-no-loan, #crows .inline-money-field, #entryCount233'));
        const fld=await q.evaluate(()=>{const f=document.querySelector('#crows .inline-money-field:not(:focus-within)');return f?getComputedStyle(f).backgroundColor:'none';});   /* 첫 칸은 자동 포커스(흰 면)라 포커스 없는 칸을 잼 */
        await q.locator('#crows .inline-money-field input').first().click(); await q.waitForTimeout(150);
        const foc=await q.evaluate(()=>{const f=document.querySelector('#crows .inline-money-field:focus-within');if(!f)return 'none';const i=f.querySelector('input');return getComputedStyle(f).boxShadow+'|'+getComputedStyle(i).outlineStyle+'|'+getComputedStyle(i).borderTopColor;});
        await q.evaluate(()=>document.activeElement&&document.activeElement.blur());
        await q.evaluate(()=>openQ(2,'region')); await q.waitForTimeout(350);
        bad.push(...await noLine('#qSheet, #qSheet .chip, #qSheet .zonecard, #qSheet .region-search-field, #qSheet .q-sheet-header, #qSheet .sheet-actions'));
        const chip=await q.evaluate(()=>{const c=[...document.querySelectorAll('#qSheet .chip')].filter(x=>x.getClientRects().length);const off=c.find(x=>!x.classList.contains('is-on')&&!x.classList.contains('is-base330'));const on=c.find(x=>x.classList.contains('is-on')&&!x.classList.contains('is-base330'));return [off&&getComputedStyle(off).backgroundColor,on?getComputedStyle(on).backgroundColor:'rgb(237, 242, 255)'];});
        await q.evaluate(()=>{closeSheet('q');Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(400);
        bad.push(...await noLine('#fundingOverview, #payTile, #easyMarket, #more341, #outSave, #outCopy, #v208Nav'));
        const nav=await q.evaluate(()=>getComputedStyle(document.getElementById('v208Nav')).boxShadow);
        await q.evaluate(()=>window.yk208Navigate('map')); await q.waitForTimeout(400); bad.push(...await noLine('#viewDeals .deal-budget, #dealList, #dealFilterBtn, #dealMore, #viewDeals .dd-region'));
        await q.evaluate(()=>window.yk208Navigate('compare')); await q.waitForTimeout(350); bad.push(...await noLine('#app .v208-empty'));
        const W='rgb(241, 244, 248)';
        ok(bg.every(c=>c===W) && ls===-0.03 && !bad.length && fld===W && /rgb\(36, 88, 255\) 0px 0px 0px 2px inset/.test(foc) && /\|none\|rgba\(0, 0, 0, 0\)$/.test(foc) && chip[0]===W && chip[1]==='rgb(237, 242, 255)' && (width>=960 || /rgba\(16, 24, 40, 0\.1\) 0px 8px 24px/.test(nav)) && !e390.length,
           `v390 ${width}px 선 대신 면 — 배경 #F1F4F8 · 카드/시트/칩/입력/하단 탭 테두리 없음 · 입력 면 · 포커스 파랑 한 겹 · 지역 칩 면 · 제목 자간 -.03em`, JSON.stringify({bg,ls,bad:[...new Set(bad)].slice(0,10),fld,foc,chip,nav:nav.slice(0,90),e390}));
        await c390.close();
      }
    }
    // v391 — 안내 페이지 15개 실측(390 · 1264): 흰 바탕 · 소제목(section) 테두리/면 없음 · 본문 16px · h1 28/30/36 · h2 스케일 · 낱말 줄바꿈 · 가로 넘침 없음
    {
      const PG=['about','articles','budget-examples','buying-costs','couple-income','dsr-income-table','existing-debt','guide','loan-limit','price-band-cap','privacy','rate-type','regulated-area','room-deduction','switch-home'];
      for(const width of [390,1264]){
        const c391=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c391.newPage();const e391=[];q.on('pageerror',e=>e391.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          let pth=u.pathname==='/'?'/index.html':u.pathname;if(!path.extname(pth))pth+='.html';const file=path.resolve(ROOT,'.'+pth);if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        const bad=[];
        for(const pg of PG){
          await q.goto('http://yeongkkeul.test/'+pg); await q.evaluate(()=>document.fonts.ready);
          const r=await q.evaluate(()=>{const W='rgb(255, 255, 255)';const b=getComputedStyle(document.body).backgroundColor;
            const secs=[...document.querySelectorAll('main section, .app section')].filter(e=>e.getClientRects().length);
            const secBad=secs.filter(e=>{const cs=getComputedStyle(e);return parseFloat(cs.borderTopWidth)>0&&!/rgba\(\d+, \d+, \d+, 0\)/.test(cs.borderTopColor)||!/rgba\(0, 0, 0, 0\)/.test(cs.backgroundColor);}).length;
            const ps=[...document.querySelectorAll('main p:not(.src):not(.caption):not(.note):not(.meta):not(.eyebrow):not(.lead):not(.fl):not(.ax):not(.asof):not(.lede):not(.yt):not(.lg2), .app section p:not(.note)')].filter(e=>e.getClientRects().length&&!e.closest('figure,aside,.list,.start'));
            const pBad=ps.filter(e=>parseFloat(getComputedStyle(e).fontSize)!==16).map(e=>e.className+':'+getComputedStyle(e).fontSize).slice(0,3);
            const h1=document.querySelector('main h1, .app h1');const h2=document.querySelector('main h2, .app h2');
            return {b,secs:secs.length,secBad,pN:ps.length,pBad,h1:h1?parseFloat(getComputedStyle(h1).fontSize):0,h2:h2?parseFloat(getComputedStyle(h2).fontSize):0,wb:getComputedStyle(document.body).wordBreak,over:document.documentElement.scrollWidth>innerWidth};});
          const H1=width>=960?36:28, H2=width<=400?24:26;
          if(!(r.b==='rgb(255, 255, 255)'&&r.secBad===0&&r.pN>0&&!r.pBad.length&&r.h1===H1&&(r.h2===0||r.h2===H2)&&r.wb==='keep-all'&&!r.over)) bad.push(pg+':'+JSON.stringify(r));
        }
        ok(!bad.length && !e391.length, `v391 ${width}px 안내 페이지 15개 — 흰 바탕 · 소제목 카드 없음 · 본문 16px · 제목 ${width>=960?36:28}/${width<=400?24:26} · 낱말 줄바꿈 · 넘침 없음`, JSON.stringify({bad:bad.slice(0,4),e391}));
        await c391.close();
      }
    }
    // v392 — 결과 홈 ① 합계 한 행 실측(320 · 390 · 1264): 양옆 선 없음 · 「합계」 왼쪽 끝 = 범례 왼쪽 끝 · 금액 오른쪽 끝 = 위 금액 오른쪽 끝 · 금액 16px · 위 나눔선 · ② 머리까지 28 이상
    {
      for(const width of [320,390,1264]){
        const c392=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c392.newPage();const e392=[];q.on('pageerror',e=>e392.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); await q.locator('#welcomeStart232').click(); await q.waitForTimeout(150);
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);}); await q.waitForTimeout(500);
        const r=await q.evaluate(()=>{const f=document.getElementById('flow358'),j=f.querySelector('.f-join'),sp=j.querySelector('span'),t=j.querySelector('.f-total');
          const rng=document.createRange();rng.selectNodeContents(sp.firstChild);const lab=rng.getBoundingClientRect();
          const leg=f.querySelector('.f-leg'),loan=f.querySelector('.f-loan .f-v')||f.querySelectorAll('.f-leg .f-v')[1];const lr=leg.getBoundingClientRect();const steps=f.querySelectorAll('.f-step');
          const b=getComputedStyle(j,'::before').content,a=getComputedStyle(j,'::after').content;
          return {lines:b+'|'+a,labL:Math.round(lab.left-lr.left),valR:Math.round(t.getBoundingClientRect().right-lr.right),fz:parseFloat(getComputedStyle(t).fontSize),sh:getComputedStyle(j).boxShadow,gap:Math.round(steps[1].getBoundingClientRect().top-j.getBoundingClientRect().bottom),total:t.textContent.trim()};});
        ok(/^(none|normal)\|(none|normal)$/.test(r.lines) && Math.abs(r.labL)<=1 && Math.abs(r.valR)<=1 && r.fz===16 && /rgb\(238, 241, 245\) 0px 1px 0px 0px inset/.test(r.sh) && r.gap>=28 && /억|만원/.test(r.total) && !e392.length,
           `v392 ${width}px 합계 한 행 — 양옆 선 없음 · 「합계」 왼쪽 · 금액 오른쪽 끝 맞춤 · 16px · 위 나눔선 · ② 앞 ${r.gap}px`, JSON.stringify({...r,e392}));
        await c392.close();
      }
    }
    // v393 — 꾸밈 덜기 실측(320 · 390 · 1264): 입력 행 아이콘 6곳 바탕 투명 · 18×18 · 그림 있음 / 결과 카드 번호 4곳 바탕 투명 · 16px · #2458FF · 숫자 왼쪽 끝 = 막대(①②) · 금액(③) 왼쪽 끝
    {
      for(const width of [320,390,1264]){
        const c393=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c393.newPage();const e393=[];q.on('pageerror',e=>e393.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); await q.locator('#welcomeStart232').click(); await q.waitForTimeout(150);
        await q.evaluate(()=>{S.sgg='11440';S.sido='서울특별시';S.group='seoul';S.houseStatus='none';renderAnswered();syncCta();}); await q.waitForTimeout(200); await q.locator('#stepNext353').click(); await q.waitForTimeout(350);
        const ic=await q.evaluate(()=>[...document.querySelectorAll('#crows span.k, #crows label, #noLoanT.nl-t')].filter(e=>e.getClientRects().length).map(e=>getComputedStyle(e,'::before')).filter(b=>b.content!=='none'&&b.backgroundImage!=='none').map(b=>b.backgroundColor+'|'+b.width+'x'+b.height));
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);}); await q.waitForTimeout(500);
        const bd=await q.evaluate(()=>{const f=document.getElementById('flow358');const bar=f.querySelector('.f-bar').getBoundingClientRect().left;const L=b=>{const r=document.createRange();r.selectNodeContents(b);return r.getBoundingClientRect().left;};
          const all=[...document.querySelectorAll('#flow358 .f-step b,#viewAnswer .n358')].filter(e=>e.getClientRects().length);
          const pay=document.querySelector('#payTile .n358'),tm=document.getElementById('tileMonthly');
          return {n:all.length,look:[...new Set(all.map(b=>{const c=getComputedStyle(b);return c.backgroundColor+'|'+c.fontSize+'|'+c.color;}))],flowL:[...f.querySelectorAll('.f-step b')].map(b=>Math.round(L(b)-bar)),payL:Math.round(L(pay)-tm.getBoundingClientRect().left)};});
        /* v395 — 입력 행 아이콘은 없앰(결과 카드 머리처럼 · 오너 시안 승인 2026-11-27) → 6곳 18px 잠금을 「0곳」으로 옮김. */
        /* v404 — 결과 구획 번호를 아이콘으로 바꿔(D2) 번호 모양·번호 기준 왼쪽 맞춤 조건을 뺐다. 번호가 다시 보이면 실패. */
        ok(ic.length===0 && bd.n===0 && !e393.length,
           `v393·v395·v404 ${width}px 꾸밈 덜기 — 입력 행 아이콘 없음(v395) · 결과 구획 번호 숨김(v404 아이콘으로 대체)`, JSON.stringify({ic,bd,e393}));
        await c393.close();
      }
    }
    // v394 — 오너 지적 실측(390 · 1264): 「기준 · 비교」 꼬리표 모두 안쪽 1px 테두리 · 금액 칸 숫자 줄 중심 = 칸 중심(±1) · 「15억원」 왼쪽 = 이름 글자 왼쪽(±1) · 머리 아래 그림 선 없음(넓은 화면) · 지도 카드 안 테두리 없음 · ±칩 면/고른 칩 #EDF2FF
    {
      for(const width of [390,1264]){
        const c394=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c394.newPage();const e394=[];q.on('pageerror',e=>e394.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return route.fulfill({json:{ok:true,items:[0,1,2].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:3}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        const head=await q.evaluate(()=>getComputedStyle(document.querySelector('.appbar')).borderImageSource);
        await q.locator('#welcomeStart232').click(); await q.mouse.move(1,1); await q.waitForTimeout(150);
        await q.evaluate(()=>{S.sgg='11200';S.sido='서울특별시';S.group='seoul';S.houseStatus='first';renderAnswered();syncCta();}); await q.waitForTimeout(200); await q.locator('#stepNext353').click(); await q.mouse.move(1,1); await q.waitForTimeout(350);
        const ins=q.locator('#crows .inline-money-field input'); await ins.nth(0).fill('150000'); await ins.nth(1).fill('30000'); await q.evaluate(()=>document.activeElement.blur()); await q.waitForTimeout(300);
        const fl=await q.evaluate(()=>[...document.querySelectorAll('#crows .inline-money')].filter(r=>r.getClientRects().length).map(row=>{const f=row.querySelector('.inline-money-field'),i=f.querySelector('input'),fr=f.getBoundingClientRect(),ir=i.getBoundingClientRect();
          const lab=row.querySelector('label');const t=[...lab.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());const rg=document.createRange();rg.selectNodeContents(t);const ec=row.querySelector('.inline-echo');
          return {mid:Math.round((ir.top+ir.bottom)/2-(fr.top+fr.bottom)/2),echo:ec&&ec.getClientRects().length?Math.round(ec.getBoundingClientRect().left-rg.getBoundingClientRect().left):'none'};}));
        await q.evaluate(()=>openQ(2,'region')); await q.waitForTimeout(350);
        const z=q.locator('#qSheet button',{hasText:/^서울$/}).first(); if(await z.count()){await z.click();await q.waitForTimeout(250);}
        for(const nm of ['성동구','광진구']){await q.locator('#qSheet .chip',{hasText:nm}).first().click();await q.waitForTimeout(150);}
        const tags=await q.evaluate(()=>[...document.querySelectorAll('#qSheet .chip .tag330')].map(t=>t.textContent+'|'+(/inset/.test(getComputedStyle(t).boxShadow)?'line':'none')));
        await q.evaluate(()=>{closeSheet('q');Object.assign(S,{cash:150000,income:30000,sgg:'11200',sido:'서울특별시',group:'seoul',houseStatus:'first',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(300);
        await q.evaluate(()=>window.yk208Navigate('map')); await q.waitForTimeout(400); await q.evaluate(()=>{const p=document.getElementById('dealMapPanel');p.hidden=false;}); await q.waitForTimeout(150);
        const mp=await q.evaluate(()=>{const root=document.getElementById('dealMapPanel');const L=[root,...root.querySelectorAll('*')].filter(e=>e.getClientRects().length&&e.id!=='v208Status').filter(e=>{const cs=getComputedStyle(e);return ['Top','Right','Bottom','Left'].some(sd=>parseFloat(cs['border'+sd+'Width'])>0&&cs['border'+sd+'Style']!=='none'&&!/rgba\(\d+, \d+, \d+, 0\)/.test(cs['border'+sd+'Color']))&&!e.matches('i,span.caret,.chev,.chev-r');}).map(e=>e.id||e.className||e.tagName);
          const rb=[...document.querySelectorAll('#dealMapRange button')].map(b=>(b.getAttribute('aria-pressed')==='true'?'on:':'')+getComputedStyle(b).backgroundColor);return {L,rb};});
        ok((width<1025||head==='none') && fl.length===2 && fl.every(x=>Math.abs(x.mid)<=1&&(x.echo==='none'||Math.abs(x.echo)<=1)) && tags.length>=2 && tags.every(t=>/\|line$/.test(t)) && !mp.L.length && mp.rb.every(c=>/^on:rgb\(237, 242, 255\)$|^rgb\(241, 244, 248\)$/.test(c)) && !e394.length,
           `v394 ${width}px 오너 지적 — 기준/비교 꼬리표 테두리 · 금액 숫자 세로 가운데 · 「15억원」 줄 맞춤 · 머리 그림 선 없음 · 지도 카드 선 없음 · ±칩 면`, JSON.stringify({head,fl,tags,mp,e394}));
        await c394.close();
      }
    }
    // v395 — 첫 화면 · 입력 화면 통일 실측(320 · 390 · 1264): 그림 안 글자 13px 이상 · 시작 버튼 = 버튼 줄 전체 폭 /
    //   입력: 부제 · 진행 글줄 화면에서 감춤(글줄은 남음) · 고르는 줄 이름(16) 위 값(19) 아래 · 아이콘 없음 · 꺾쇠 줄 오른쪽 20 · 칸 안쪽 20 /
    //   칸 머리 이름 왼쪽 = 결과 카드 머리 이름 왼쪽(같은 32) · 금액 칸 면 #F1F4F8 · 숫자 왼쪽 맞춤 · 「내 조건」 탭도 같은 모양
    {
      for(const width of [320,390,1264]){
        const c395=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c395.newPage();const e395=[];q.on('pageerror',e=>e395.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        const wel=await q.evaluate(()=>{const sv=document.querySelector('#welcome232 .welcome232-scene svg'),t=sv&&sv.querySelector('text');const k=sv?sv.getBoundingClientRect().width/sv.viewBox.baseVal.width:0;
          const b=document.getElementById('welcomeStart232').getBoundingClientRect(),body=document.querySelector('#welcome232 .welcome232-startbody').getBoundingClientRect();
          return {txt:t?Math.round(parseFloat(t.getAttribute('font-size'))*k*10)/10:0,full:Math.abs(b.width-body.width)<=1,arrow:!!document.querySelector('#welcomeStart232 span')};});
        await q.locator('#welcomeStart232').click(); await q.mouse.move(1,1); await q.waitForTimeout(150);
        const row=sel=>q.evaluate(sel=>[...document.querySelectorAll(sel)].filter(e=>e.getClientRects().length).map(r=>{const R=e=>e.getBoundingClientRect(),k=r.querySelector('.k'),v=r.querySelector('.v'),c=r.querySelector('.chev');const rg=document.createRange();rg.selectNodeContents(v.firstChild||v);
          const ic=getComputedStyle(k,'::before');return {stack:R(k).bottom<=rg.getBoundingClientRect().top+1,kf:parseFloat(getComputedStyle(k).fontSize),vf:parseFloat(getComputedStyle(v).fontSize),icon:ic.content!=='none'&&ic.display!=='none',
            chev:c?Math.round(R(r).right-R(c).right):-1,padL:Math.round(R(k).left-R(r).left)};}),sel);
        const head1=await q.evaluate(()=>({sub:!!document.querySelector('#app[data-v208-tab="entry"] .entry-sub')?.getClientRects().length,count:(()=>{const e=document.getElementById('entryCount233'),h=e&&e.closest('.ep233-heading');return e?Math.round(h.getBoundingClientRect().width)+'|'+e.textContent.trim():'none';})(),
          step:[...document.querySelectorAll('#crows>h2.v232-step')].filter(h=>h.getClientRects().length).map(h=>{const r=document.createRange();r.selectNodeContents(h.lastChild);return Math.round(r.getBoundingClientRect().left-h.getBoundingClientRect().left);})}));
        const rows1=await row('#crows>.crow');
        await q.evaluate(()=>{S.sgg='11440';S.sido='서울특별시';S.group='seoul';S.houseStatus='none';renderAnswered();syncCta();}); await q.waitForTimeout(200); await q.locator('#stepNext353').click(); await q.mouse.move(1,1); await q.waitForTimeout(350);
        await q.evaluate(()=>document.activeElement&&document.activeElement.blur()); await q.waitForTimeout(120);
        const money=await q.evaluate(()=>[...document.querySelectorAll('#crows .inline-money')].filter(r=>r.getClientRects().length).map(r=>{const f=r.querySelector('.inline-money-field'),i=f.querySelector('input'),l=r.querySelector('label');
          return {bg:getComputedStyle(f).backgroundColor,al:getComputedStyle(i).textAlign,lf:parseFloat(getComputedStyle(l).fontSize),padL:Math.round(l.getBoundingClientRect().left-r.getBoundingClientRect().left),icon:getComputedStyle(l,'::before').content!=='none'&&getComputedStyle(l,'::before').display!=='none'};}));
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11440',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);}); await q.waitForTimeout(500);
        const res=await q.evaluate(()=>[...document.querySelectorAll('#flow358 .f-step,#payTile .ans-k')].filter(h=>h.getClientRects().length).map(h=>{const r=document.createRange();r.selectNodeContents(h.lastChild);return Math.round(r.getBoundingClientRect().left-h.getBoundingClientRect().left);}));
        await q.evaluate(()=>window.yk208Navigate('conditions')); await q.waitForTimeout(400);
        const rowsC=await row('#crows>.crow:not(#stepSum353)');
        const rowOK=r=>r.stack&&r.kf===16&&r.vf===19&&!r.icon&&Math.abs(r.chev-20)<=2&&Math.abs(r.padL-20)<=1;   /* 칸 테 1px(투명 · v390) 포함 ±1 */
        ok(wel.txt>=13 && wel.full && !wel.arrow && !head1.sub && /^1\|/.test(head1.count) && head1.step.length===1 && rows1.length===2 && rows1.every(rowOK) && rowsC.length>=3 && rowsC.every(rowOK)
           && money.length===2 && money.every(m=>m.bg==='rgb(241, 244, 248)'&&m.al==='left'&&m.lf===16&&Math.abs(m.padL-20)<=1&&!m.icon) && res.length>=3 && head1.step.every(x=>res.every(y=>Math.abs(x-y)<=1)) && !e395.length,
           `v395 ${width}px 첫 화면 · 입력 통일 — 그림 글자 13 이상 · 시작 버튼 전체 폭 · 부제 · 진행 글줄 감춤 · 이름 16 위 값 19 아래 · 아이콘 없음 · 꺾쇠 오른쪽 20 · 안쪽 20 · 칸 머리 이름 = 결과 머리 이름 자리 · 금액 칸 면 · 내 조건 같은 모양`,
           JSON.stringify({wel,head1,rows1,rowsC,money,res,e395}));
        await c395.close();
      }
    }
    // v396 — 실거래 탭 고르기 단추 실측(320 · 390 · 1264 · 지도 보기 + 목록 보기): 고른 것 모두 rgb(36, 88, 255) · 700 / 안 고른 것 rgb(70, 82, 98) · 600 /
    //   글자 14(쪽 탭 「내 지역 | 서울 25개 구」만 16) / 붙은 단추 틀 둘 다 rgb(228, 232, 241) / 모서리 10 · 14 · 999 · 0 밖 없음 / 필터 흰 면 · 높이 = 정렬 줄 / 분포 접기 줄 14 · 600 · 먹색
    {
      for(const width of [320,390,1264]){
        const c396=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c396.newPage();const e396=[];q.on('pageerror',e=>e396.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='oapi.map.naver.com')return route.fulfill({contentType:'text/javascript',body:FAKE_NAVER_338});if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return route.fulfill({json:{ok:true,items:[0,1,2,3].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000,26000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:4}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11590',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(300);
        await q.evaluate(()=>window.yk208Navigate('map')); await q.waitForTimeout(1200); await q.evaluate(()=>{const p=document.getElementById('dealMapPanel');if(p)p.hidden=false;}); await q.mouse.move(1,1); await q.waitForTimeout(200);
        const scan=()=>q.evaluate(()=>{const out=[];for(const b of document.querySelectorAll('#seg357 button,#viewDeals #sortSeg button,#viewDeals .sortseg button,#viewDeals .deal-switch button,#dealMapRange button,#dealMapLayer button')){if(!b.getClientRects().length)continue;const c=getComputedStyle(b);
            const on=b.classList.contains('is-on')||b.getAttribute('aria-pressed')==='true'||b.getAttribute('aria-selected')==='true';out.push({g:b.closest('#seg357')?'tab':'pick',on,col:c.color,fw:c.fontWeight,fs:c.fontSize,r:c.borderTopLeftRadius,t:b.textContent.trim().slice(0,6)});}
          const tracks=[...document.querySelectorAll('#viewDeals .sortseg,#viewDeals .deal-switch')].filter(e=>e.getClientRects().length).map(e=>getComputedStyle(e).backgroundColor);
          const f=document.getElementById('dealFilterBtn'),tools=f&&f.closest('.deal-tools');const fold=[...document.querySelectorAll('#v208DistributionToggle,#dealDistribution .dd-method>summary')].filter(e=>e.getClientRects().length).map(e=>{const c=getComputedStyle(e);return c.fontSize+'|'+c.fontWeight+'|'+c.color;});
          return {out,tracks,filt:f&&f.getClientRects().length?getComputedStyle(f).backgroundColor+'|'+Math.round(f.getBoundingClientRect().height-tools.getBoundingClientRect().height):'none',fold};});
        const a=await scan(); if(await q.locator('#dealListTab').isVisible())await q.locator('#dealListTab').click(); await q.waitForTimeout(400); const b=await scan();
        const all=[...a.out,...b.out];const R=new Set(['0px','10px','14px','999px']);
        const good=all.length>=10 && all.every(x=>(x.on?(x.col==='rgb(36, 88, 255)'&&x.fw==='700'):(x.col==='rgb(70, 82, 98)'&&x.fw==='600')) && x.fs===(x.g==='tab'?'16px':'14px') && R.has(x.r))
          && all.some(x=>x.t.startsWith('±')) && [...a.tracks,...b.tracks].length>=2 && [...a.tracks,...b.tracks].every(t=>t==='rgb(228, 232, 241)')
          && [a.filt,b.filt].every(v=>v==='rgb(255, 255, 255)|0') && [...a.fold,...b.fold].length>=1 && [...a.fold,...b.fold].every(v=>v==='14px|600|rgb(25, 35, 50)');
        ok(good && !e396.length, `v396 ${width}px 실거래 고르기 단추 — 고름 파랑 700 · 안 고름 #465262 600 · 글자 14(쪽 탭 16) · 붙은 틀 한 색 · 모서리 스케일 · 필터 흰 면 같은 높이 · 분포 접기 줄 = 결과 접기 줄`,
           JSON.stringify({a,b,e396}).slice(0,3000));
        await c396.close();
      }
    }
    // v397 — 버튼 실측(320 · 390 · 1264): 주 버튼 5곳(시작 · 다음 · 계산하기 · 결과 보기 · 시트 완료) 54 · 17/700 · 모서리 14 · 켜짐 #2458FF / 꺼짐 #E0E5EC 하나(다음 · 계산하기) /
    //   작은 파란 버튼(실거래 보기 · 단지 찾아보기) 44 · 14/600 · 14 · #2458FF / 보조 버튼(이미지 저장 · 결과 공유 · 지역 변경 · 필터) 먹색 14/600 · 모서리 14
    {
      for(const width of [320,390,1264]){
        const c397=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c397.newPage();const e397=[];q.on('pageerror',e=>e397.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return route.fulfill({json:{ok:true,items:[0,1,2,3].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000,26000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:4}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        const look=async sel=>{await q.mouse.move(1,1);await q.waitForTimeout(250);return q.evaluate(sel=>{const e=document.querySelector(sel);if(!e||!e.getClientRects().length)return null;const c=getComputedStyle(e);return {bg:c.backgroundColor,col:c.color,f:c.fontSize+'/'+c.fontWeight,r:c.borderTopLeftRadius,h:Math.round(e.getBoundingClientRect().height),dis:!!e.disabled};},sel);};
        const L={};
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); L.start=await look('#welcomeStart232');
        await q.locator('#welcomeStart232').click(); L.nextOff=await look('#stepNext353');
        await q.evaluate(()=>{S.sgg='11590';S.sido='서울특별시';S.group='seoul';S.houseStatus='none';renderAnswered();syncCta();}); L.nextOn=await look('#stepNext353');
        await q.locator('#stepNext353').click(); await q.waitForTimeout(300); L.ctaOff=await look('#ctaBtn');
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11590',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(300);
        L.market=await look('#marketOpen'); L.save=await look('#outSave'); L.copy=await look('#outCopy');
        await q.evaluate(()=>window.yk208Navigate('map')); await q.waitForTimeout(800); L.region=await look('#viewDeals .dd-region'); L.filter=await look('#dealFilterBtn');
        await q.evaluate(()=>window.yk208Navigate('compare')); await q.waitForTimeout(400); L.find=await look('#cmpBody .v208-primary');
        await q.evaluate(()=>window.yk208Navigate('conditions')); await q.waitForTimeout(400); L.ctaOn=await look('#ctaBtn');
        await q.evaluate(()=>window.yk208Navigate('home')); await q.waitForTimeout(300); await q.evaluate(()=>openQ(2,'region')); await q.waitForTimeout(400); L.sheet=await look('#qClose');
        const B='rgb(36, 88, 255)',W='rgb(255, 255, 255)',main=x=>x&&x.h===54&&x.f==='17px/700'&&x.r==='14px',on=x=>main(x)&&!x.dis&&x.bg===B&&x.col===W,off=x=>main(x)&&x.dis&&x.bg==='rgb(224, 229, 236)';
        const small=x=>x&&x.h===44&&x.f==='14px/600'&&x.r==='14px'&&x.bg===B&&x.col===W,sub=x=>x&&x.f==='14px/600'&&x.r==='14px'&&x.col==='rgb(25, 35, 50)';
        ok(on(L.start)&&off(L.nextOff)&&on(L.nextOn)&&off(L.ctaOff)&&on(L.ctaOn)&&on(L.sheet)&&small(L.market)&&small(L.find)&&[L.save,L.copy,L.region,L.filter].every(sub)&&!e397.length,
           `v397 ${width}px 버튼 — 주 버튼 54 · 17/700 · 14 · 켜짐 파랑 · 꺼짐 회색 하나 · 작은 파란 버튼 44 · 14/600 · 보조 버튼 먹색 14/600 · 모서리 14`, JSON.stringify({L,e397}));
        await c397.close();
      }
    }
    // v398 — 비교 빈 화면 실측(390 · 1264): 「1 · 2 · 3」 칸 3개 선 없음 · 면 rgb(241, 244, 248) · 비교 화면 전체에 점선(dashed) 0개
    {
      for(const width of [390,1264]){
        const c398=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c398.newPage();const e398=[];q.on('pageerror',e=>e398.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11590',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);}); await q.waitForTimeout(500);
        await q.evaluate(()=>window.yk208Navigate('compare')); await q.waitForTimeout(400);
        const r=await q.evaluate(()=>{const sl=[...document.querySelectorAll('#cmpBody .hc-empty-slots span')].filter(e=>e.getClientRects().length).map(e=>{const c=getComputedStyle(e);return c.borderTopStyle+'|'+c.borderTopWidth+'|'+c.backgroundColor;});
          const dashed=[...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length&&['Top','Right','Bottom','Left'].some(sd=>getComputedStyle(e)['border'+sd+'Style']==='dashed'&&getComputedStyle(e)['border'+sd+'Width']!=='0px')).map(e=>e.id||String(e.className).split(' ')[0]);return {sl,dashed};});
        ok(r.sl.length===3 && r.sl.every(x=>/^(none|solid)\|0px\|rgb\(241, 244, 248\)$/.test(x)) && !r.dashed.length && !e398.length, `v398 ${width}px 비교 빈 칸 — 선 없음 · 면 #F1F4F8 · 점선 0`, JSON.stringify({r,e398}));
        await c398.close();
      }
    }
    // v399 — 탭 막대 자리 실측: 1264 · 1440 → 머리줄 안(위 64px 안) · 오른쪽 끝 = 내용 오른쪽 끝(±1) · 그림자 · 면 없음 · 단추 44 가로(아이콘 왼쪽 · 이름 오른쪽) · 고른 탭 흰 면 + 파랑 700 · 로고와 안 겹침 · 스크롤해도 그 자리 /
    //   1024 · 390 → 화면 아래 그대로(아래 끝 100px 안) · 고른 탭 글자 #2458FF
    {
      for(const width of [390,1024,1264,1440]){
        const c399=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960});const q=await c399.newPage();const e399=[];q.on('pageerror',e=>e399.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11590',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);}); await q.waitForTimeout(500); await q.mouse.move(1,1);
        const m=()=>q.evaluate(()=>{const n=document.getElementById('v208Nav'),r=n.getBoundingClientRect(),c=getComputedStyle(n),cur=n.querySelector('button[aria-current="page"]'),b=n.querySelector('button'),sv=b.querySelector('svg').getBoundingClientRect(),sp=b.querySelector('span').getBoundingClientRect();
          const row=document.querySelector('.appbar .barrow1').getBoundingClientRect(),logo=document.querySelector('.appbar').getBoundingClientRect();
          return {top:Math.round(r.top),bottom:Math.round(r.bottom),right:Math.round(r.right),rowR:Math.round(row.right),sh:c.boxShadow,bg:c.backgroundColor,bh:Math.round(b.getBoundingClientRect().height),side:sv.right<=sp.left+1,cur:getComputedStyle(cur).color+'|'+getComputedStyle(cur).backgroundColor+'|'+getComputedStyle(cur).fontWeight,left:Math.round(r.left),vh:innerHeight};});
        const a=await m(); await q.evaluate(()=>scrollTo(0,600)); await q.waitForTimeout(250); const b=await m();
        const wide=width>=1025;
        const good=wide ? (a.top>=0&&a.bottom<=64&&Math.abs(a.right-a.rowR)<=1&&a.sh==='none'&&a.bg==='rgba(0, 0, 0, 0)'&&a.bh===44&&a.side&&a.cur==='rgb(36, 88, 255)|rgb(255, 255, 255)|700'&&a.left>=a.rowR-560&&b.top===a.top)
                        : (a.bottom>=a.vh-100&&/^rgb\(36, 88, 255\)\|/.test(a.cur));
        ok(good && !e399.length, `v399 ${width}px 탭 막대 — ${wide?'머리줄 오른쪽 가로 탭 · 내용 오른쪽 끝 · 그림자 없음 · 고른 탭 흰 면 파랑 · 스크롤 그대로':'화면 아래 그대로 · 고른 탭 글자 #2458FF'}`, JSON.stringify({a,b,e399}));
        await c399.close();
      }
    }
    // v400 — 「쓰는 곳」 막대 실측(390): 집값 막대 · 범례 rgb(70, 82, 98) · 부대비용 막대 · 범례 rgb(185, 194, 208) · 「오는 곳」 막대 색 그대로 · 화면에 남색 #1B3A8C 0곳
    {
      const c400=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true});const q=await c400.newPage();
      await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
        const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
      await q.goto('http://yeongkkeul.test/');
      await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11590',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);}); await q.waitForTimeout(500);
      const r=await q.evaluate(()=>{const bg=s=>{const e=document.querySelector(s);return e?getComputedStyle(e).backgroundColor:'none';};
        const navy=[...document.querySelectorAll('#viewAnswer *')].filter(e=>e.getClientRects().length&&getComputedStyle(e).backgroundColor==='rgb(27, 58, 140)').length;
        return {p:bg('#flow358 .f-bar .p'),x:bg('#flow358 .f-bar .x'),pk:bg('#flow358 .f-price .f-k i'),xk:bg('#flow358 .f-cost .f-k i'),c:bg('#flow358 .f-bar .c'),l:bg('#flow358 .f-bar .l'),navy};});
      /* v404 — 막대가 광택 그러데이션(background-image)이 되어 색은 그림에서 읽음 · 집값 #465262(거의 검정으로 보임 · 오너 「검은색 막대 수정」) → #7D8AA0 · 부대비용 → #C8D0DB · 점(범례)과 같은 색 */
      const gi=await q.evaluate(()=>{const g=s=>{const e=document.querySelector(s);return e?getComputedStyle(e).backgroundImage:'';};return {p:g('#flow358 .f-bar .p'),x:g('#flow358 .f-bar .x'),c:g('#flow358 .f-bar .c'),l:g('#flow358 .f-bar .l')};});
      ok(gi.p.includes('rgb(125, 138, 160)')&&r.pk==='rgb(125, 138, 160)'&&gi.x.includes('rgb(200, 208, 219)')&&r.xk==='rgb(200, 208, 219)'&&gi.c.includes('rgb(36, 88, 255)')&&gi.l.includes('rgb(147, 174, 255)')&&r.navy===0&&!/rgb\(70, 82, 98\)/.test(gi.p), 'v400·v404 390px 쓰는 곳 막대 — 집값 #7D8AA0 · 부대비용 #C8D0DB(점과 같은 색) · 오는 곳 파랑 · 남색 · 먹색 막대 없음', JSON.stringify({r,gi}));
      await c400.close();
    }
    // v401 — 다크 모드 실측(320 · 390 · 1264 · colorScheme dark): 바탕 · 카드가 어두움(카드가 바탕보다 밝음) · 글자 대비 WCAG(4.5 / 큰 글자 3) 미달 0 —
    //   첫 화면 · 입력 1·2단계 · 홈 · 실거래(지도 · 목록) · 비교 · 내 조건 · 지역 시트 · 부대비용 시트 /
    //   스위치: 켬 막대 파랑 · 끈 막대 #3A3F47 · 손잡이 #F2F4F7 / <html class="yk-light">면 밝은 바탕으로 돌아옴 / html2canvas 감싸기가 복제본에 yk-light /
    //   밝은 모드(390)에서는 다크 규칙이 안 걸림(바탕 #F1F4F8 · 카드 #FFF)
    {
      /* v403 안내 페이지 검사도 씀 — 블록 밖에서도 보이게 */ globalThis.SCAN401=`(()=>{const parse=s=>{const m=s.match(/rgba?\\(([^)]+)\\)/);if(!m)return null;const v=m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);return {r:v[0],g:v[1],b:v[2],a:v[3]===undefined?1:v[3]};};
        const lum=c=>{const f=x=>{x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)};
        const blend=(t,b)=>({r:t.r*t.a+b.r*(1-t.a),g:t.g*t.a+b.g*(1-t.a),b:t.b*t.a+b.b*(1-t.a),a:1});
        function bgOf(el){const st=[];let e=el;while(e&&e.nodeType===1){const cs=getComputedStyle(e);if(cs.backgroundImage!=='none'&&!/^url/.test(cs.backgroundImage))return null;const c=parse(cs.backgroundColor);if(c&&c.a>0){st.push(c);if(c.a>=0.999)break;}e=e.parentElement;}
          let c=parse(getComputedStyle(document.documentElement).backgroundColor);if(!c||c.a<1)c={r:255,g:255,b:255,a:1};for(let i=st.length-1;i>=0;i--)c=blend(st[i],c);return c;}
        const out=[],seen=new Set(),w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
        while((n=w.nextNode())){const t=n.textContent.trim();if(!t)continue;const el=n.parentElement;if(!el||seen.has(el))continue;seen.add(el);
          if(el.closest('svg,[aria-hidden="true"],#dealMap,.reach328-map,script,style,noscript,[hidden],button:disabled,.ep233-heading'))continue;
          const pe=el.parentElement;if(pe&&pe.querySelector(':scope>input:disabled'))continue;   /* 꺼진 입력칸에 딸린 글자(부대비용 끈 줄의 「만원」)는 WCAG 예외 */
          const r=el.getBoundingClientRect();if(r.width<2||r.height<2)continue;const cs=getComputedStyle(el);if(cs.visibility!=='visible'||+cs.opacity<0.5)continue;
          const fg=parse(cs.color),bg=bgOf(el);if(!bg||!fg)continue;const f=fg.a<1?blend(fg,bg):fg;const L1=lum(f),L2=lum(bg);const ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
          const px=parseFloat(cs.fontSize),bold=+cs.fontWeight>=700;const need=(px>=24||(px>=18.66&&bold))?3:4.5;if(ratio<need)out.push((el.id||String(el.className).split(' ')[0]||el.tagName)+':'+t.slice(0,10)+':'+ratio.toFixed(2));}
        return out;})()`;
      const bad={};
      for(const width of [320,390,1264]){
        const c401=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960,colorScheme:'dark'});const q=await c401.newPage();const e401=[];q.on('pageerror',e=>e401.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='oapi.map.naver.com')return route.fulfill({contentType:'text/javascript',body:FAKE_NAVER_338});if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return route.fulfill({json:{ok:true,items:[0,1,2,3,4,5].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000,26000,23000,21000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:6}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        const scan=async k=>{await q.mouse.move(1,1);await q.waitForTimeout(450);const r=await q.evaluate(SCAN401);if(r.length)bad[width+':'+k]=r;};
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); await scan('첫');
        const base=await q.evaluate(()=>({bg:getComputedStyle(document.body).backgroundColor}));
        await q.locator('#welcomeStart232').click(); await scan('입력1');
        await q.evaluate(()=>{S.sgg='11590';S.sido='서울특별시';S.group='seoul';S.houseStatus='none';renderAnswered();syncCta();}); await q.locator('#stepNext353').click(); await scan('입력2');
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11590',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await scan('홈');
        const card=await q.evaluate(()=>{const lum=s=>{const v=s.match(/[\d.]+/g).map(Number);const f=x=>{x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)};return 0.2126*f(v[0])+0.7152*f(v[1])+0.0722*f(v[2]);};
          const b=getComputedStyle(document.body).backgroundColor,c=getComputedStyle(document.getElementById('payTile')).backgroundColor;return {b,c,lb:lum(b),lc:lum(c)};});
        await q.evaluate(()=>window.yk208Navigate('map')); await q.waitForTimeout(900); await scan('실거래');
        if(await q.locator('#dealListTab').isVisible().catch(()=>false)){ await q.locator('#dealListTab').click(); await scan('목록'); }
        await q.evaluate(()=>window.yk208Navigate('compare')); await scan('비교');
        await q.evaluate(()=>window.yk208Navigate('conditions')); await scan('내조건');
        const sw1=await q.evaluate(()=>{const i=document.getElementById('mainNoLoan');if(!i)return null;const off=getComputedStyle(i).backgroundColor,knob=getComputedStyle(i,'::before').backgroundColor;i.click();const on=getComputedStyle(document.getElementById('mainNoLoan')).backgroundColor;document.getElementById('mainNoLoan').click();return {off,on,knob};});
        await q.evaluate(()=>window.yk208Navigate('home')); await q.waitForTimeout(300); await q.evaluate(()=>openQ(2,'region')); await scan('지역시트');
        await q.evaluate(()=>closeSheet('q')); await q.waitForTimeout(300); await q.locator('#flow358 .f-cost').click(); await scan('비용시트');
        const sw2=await q.evaluate(()=>[...document.querySelectorAll('.sw')].filter(e=>e.getClientRects().length).map(e=>(e.classList.contains('on')?'on':'off')+'|'+getComputedStyle(e,'::before').backgroundColor+'|'+getComputedStyle(e,'::after').backgroundColor));
        const light=await q.evaluate(()=>{document.documentElement.classList.add('yk-light');const b=getComputedStyle(document.body).backgroundColor;document.documentElement.classList.remove('yk-light');return b;});
        const cap=await q.evaluate(async()=>{let seen=null;window.html2canvas=function(el,opts){const d=document.implementation.createHTMLDocument('x');if(opts&&typeof opts.onclone==='function')opts.onclone(d);seen=d.documentElement.className;return Promise.resolve(null);};await window.html2canvas(document.body,{});return seen;});
        const good=card.lb<0.03&&card.lc>card.lb&&card.lc<0.06&&base.bg===card.b&&sw1&&sw1.on==='rgb(31, 91, 255)'&&sw1.off==='rgb(58, 63, 71)'&&sw1.knob==='rgb(242, 244, 247)'
          &&sw2.length>=4&&sw2.every(x=>x.startsWith('on|rgb(31, 91, 255)|')||x.startsWith('off|rgb(58, 63, 71)|'))&&sw2.every(x=>x.endsWith('|rgb(242, 244, 247)'))&&light==='rgb(241, 244, 248)'&&cap==='yk-light'&&!e401.length;
        ok(good && !Object.keys(bad).some(k=>k.startsWith(width+':')), `v401 ${width}px 다크 — 바탕 · 카드 어두움 · 글자 대비 미달 0(화면 9곳) · 스위치 켬 파랑 · 끔 #3A3F47 · 손잡이 흰색 · yk-light면 밝게 · 저장 복제본 yk-light`,
           JSON.stringify({card,sw1,sw2,light,cap,bad,e401}).slice(0,3000));
        await c401.close();
      }
      // v402 — 밝은 화면 글자 대비 미달 0(320 · 390 · 1264 · 같은 9곳) — v401 다크와 같은 훑기
      const bad402={};
      for(const width of [320,390,1264]){
        const c402=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960,colorScheme:'light'});const q=await c402.newPage();
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='oapi.map.naver.com')return route.fulfill({contentType:'text/javascript',body:FAKE_NAVER_338});if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return route.fulfill({json:{ok:true,items:[0,1,2,3,4,5].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000,26000,23000,21000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:6}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        const scan=async k=>{await q.mouse.move(1,1);await q.waitForTimeout(450);const r=await q.evaluate(SCAN401);if(r.length)bad402[width+':'+k]=r;};
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready); await scan('첫');
        await q.locator('#welcomeStart232').click(); await scan('입력1');
        await q.evaluate(()=>{S.sgg='11590';S.sido='서울특별시';S.group='seoul';S.houseStatus='none';renderAnswered();syncCta();}); await q.locator('#stepNext353').click(); await scan('입력2');
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11590',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await scan('홈');
        await q.evaluate(()=>window.yk208Navigate('map')); await q.waitForTimeout(900); await scan('실거래');
        if(await q.locator('#dealListTab').isVisible().catch(()=>false)){ await q.locator('#dealListTab').click(); await scan('목록'); }
        await q.evaluate(()=>window.yk208Navigate('compare')); await scan('비교');
        await q.evaluate(()=>window.yk208Navigate('conditions')); await scan('내조건');
        await q.evaluate(()=>window.yk208Navigate('home')); await q.waitForTimeout(300); await q.evaluate(()=>openQ(2,'region')); await scan('지역시트');
        await q.evaluate(()=>closeSheet('q')); await q.waitForTimeout(300); await q.locator('#flow358 .f-cost').click(); await scan('비용시트');
        ok(!Object.keys(bad402).some(k=>k.startsWith(width+':')), `v402 ${width}px 밝은 화면 글자 대비 미달 0(화면 9곳)`, JSON.stringify(bad402).slice(0,2000));
        await c402.close();
      }
      const c401l=await browser.newContext({viewport:{width:390,height:900},isMobile:true,hasTouch:true,colorScheme:'light'});const ql=await c401l.newPage();
      await ql.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
        const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
      await ql.goto('http://yeongkkeul.test/'); await ql.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11590',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);}); await ql.waitForTimeout(400);
      const lt=await ql.evaluate(()=>({b:getComputedStyle(document.body).backgroundColor,c:getComputedStyle(document.getElementById('payTile')).backgroundColor,ink:getComputedStyle(document.querySelector('.v232-result-heading h2')).color}));
      ok(lt.b==='rgb(241, 244, 248)'&&lt.c==='rgb(255, 255, 255)'&&lt.ink==='rgb(25, 35, 50)', 'v401 390px 밝은 모드 — 다크 규칙 안 걸림(바탕 #F1F4F8 · 카드 #FFF · 제목 먹색)', JSON.stringify(lt));
      await c401l.close();
    }
    // v403 — 안내 페이지 15개 실측(밝게 · 다크 × 390 · 1264): 글자 대비 미달 0 · 다크면 바탕이 어두움(밝기 0.05 미만) · 밝게면 바탕 밝음 · JS 오류 없음
    {
      const G403=['about','articles','budget-examples','buying-costs','couple-income','dsr-income-table','existing-debt','guide','loan-limit','price-band-cap','privacy','rate-type','regulated-area','room-deduction','switch-home'];
      for(const scheme of ['light','dark']) for(const width of [390,1264]){
        const c403=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960,colorScheme:scheme});const q=await c403.newPage();const e403=[];q.on('pageerror',e=>e403.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname!=='yeongkkeul.test')return route.abort();
          let file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!fs.existsSync(file)&&fs.existsSync(file+'.html'))file+='.html';
          if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        const bad={},bgs={};
        for(const g of G403){ await q.goto('http://yeongkkeul.test/'+g); await q.evaluate(()=>document.fonts.ready); await q.waitForTimeout(120);
          const r=await q.evaluate(SCAN401); if(r.length) bad[g]=r.slice(0,4);
          bgs[g]=await q.evaluate(()=>{const v=getComputedStyle(document.body).backgroundColor;const c=v.match(/[\d.]+/g).map(Number);const a=c[3]===undefined?1:c[3];const h=a<0.5?getComputedStyle(document.documentElement).backgroundColor.match(/[\d.]+/g).map(Number):c;
            const f=x=>{x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)};return +(0.2126*f(h[0])+0.7152*f(h[1])+0.0722*f(h[2])).toFixed(3);}); }
        const bgOK=Object.values(bgs).every(L=>scheme==='dark'?L<0.05:L>0.8);
        ok(!Object.keys(bad).length && bgOK && !e403.length, `v403 ${scheme==='dark'?'다크':'밝게'} ${width}px 안내 페이지 15개 — 글자 대비 미달 0 · 바탕 ${scheme==='dark'?'어두움':'밝음'}`, JSON.stringify({bad,bgs,e403}).slice(0,2500));
        await c403.close();
      }
    }
    // v404 — D2 실측(320 · 390 · 1264 밝게 + 390 다크): 「쓰는 곳」 집값 · 부대비용 비율 = round(집값/(집값+부대비용)×100) · 합 100 /
    //   범례 4줄: 아이콘 32(그림) + 점 8(막대와 같은 색) + 금액 오른쪽 · 칸 머리 아이콘 36 / 결과 4장 · 실거래 카드 그림자 있음 / 파란 카드 바탕색 #2458FF + 그러데이션 + 집 아이콘 / 다크면 그림자 검정
    {
      for(const [width,scheme] of [[320,'light'],[390,'light'],[1264,'light'],[390,'dark']]){
        const c404=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960,colorScheme:scheme});const q=await c404.newPage();const e404=[];q.on('pageerror',e=>e404.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='oapi.map.naver.com')return route.fulfill({contentType:'text/javascript',body:FAKE_NAVER_338});if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return route.fulfill({json:{ok:true,items:[0,1,2,3].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000,26000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:4}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/');
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11590',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(400);
        const r=await q.evaluate(()=>{const man=t=>{t=String(t||'').replace(/,/g,'');let v=0,m=t.match(/(\d+(?:\.\d+)?)\s*억/),k=t.match(/(\d+)\s*만/);if(m)v+=parseFloat(m[1])*10000;if(k)v+=+k[1];return v;};
          const val=s=>{const e=document.querySelector(s+' .f-v');return e?e.firstChild.textContent.trim():'';},pc=s=>{const e=document.querySelector(s+' .f-v em');return e?e.textContent.trim():'';};
          const P=man(val('#flow358 .f-price')),C=man(val('#flow358 .f-cost')),n=Math.round(P/(P+C)*100);
          const rows=['.f-cash','.f-loan','.f-price','.f-cost'].map(s=>{const k=document.querySelector('#flow358 '+s+' .f-k'),i=k.querySelector('i'),b=getComputedStyle(k,'::before');return {ic:b.width+'|'+b.backgroundImage.slice(0,4),dot:Math.round(i.getBoundingClientRect().width)+'|'+getComputedStyle(i).backgroundColor};});
          const bars={'.f-cash':'rgb(36, 88, 255)','.f-loan':'rgb(157, 180, 255)','.f-price':'rgb(125, 138, 160)','.f-cost':'rgb(200, 208, 219)'};
          const sh=['fundingOverview','payTile','easyMarket','more341'].map(id=>getComputedStyle(document.getElementById(id)).boxShadow);
          const h=document.querySelector('#fundingOverview>.rhead'),hc=getComputedStyle(h),hb=getComputedStyle(h,'::before');
          const heads=[...document.querySelectorAll('#flow358 .f-step,#payTile>.ans-k,#easyMarket>.m358')].map(e=>getComputedStyle(e,'::before').width);
          return {pp:pc('#flow358 .f-price'),cp:pc('#flow358 .f-cost'),n,rows,dotOK:rows.every((x,k)=>x.dot===(innerWidth<360?'0|':'8|')+Object.values(bars)[k]) /* v405 — 좁은 화면(≤359px)은 금액 · 괄호 비율을 한 줄에 넣으려고 점을 감춤(색은 그대로) */,icOK:rows.every(x=>x.ic==='32px|url('),sh,hero:hc.backgroundColor+'|'+hc.backgroundImage.slice(0,15)+'|'+hb.backgroundImage.slice(0,4)+'|'+hb.width,heads,card:getComputedStyle(document.getElementById('fundingOverview')).backgroundColor,xbar:getComputedStyle(document.querySelector('#flow358 .f-bar .x')).backgroundImage};});
        const light=scheme==='light';
        /* v404 — 다크에서 점 4개가 카드 바탕과 대비 1.8 이상(부대비용 점 #C8D0DB가 일반 규칙으로 #04070B가 되어 사라졌던 것) · 부대비용 막대 결 rgb(102,112,128)→rgb(92,101,115) */
        const lum=t=>{const m=String(t).match(/[\d.]+/g)||[0,0,0];const f=v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4);};return 0.2126*f(+m[0])+0.7152*f(+m[1])+0.0722*f(+m[2]);};
        const cr=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
        const darkOK=light || (r.rows.every(x=>cr(x.dot.split('|')[1],r.card)>=1.8) && r.rows[3].dot==='8|rgb(92, 101, 115)' && /rgb\(102, 112, 128\).*rgb\(92, 101, 115\)/.test(r.xbar));
        const shOK=r.sh.every(s=>s!=='none' && (light ? /rgba\(16, 24, 40/.test(s) : /rgba\(0, 0, 0/.test(s) && !/rgba\(16, 24, 40/.test(s)));
        const good=r.pp===r.n+'%' && r.cp===(100-r.n)+'%' && (light?r.dotOK:true) && r.icOK && shOK && r.hero.startsWith('rgb(36, 88, 255)|radial-gradient|url(|72px') && r.heads.length===4 && r.heads.every(x=>x==='36px') && darkOK && !e404.length;
        ok(good, `v404 ${width}px ${light?'밝게':'다크'} D2 — 쓰는 곳 비율(합 100) · 목록 줄 아이콘 32 + 점(막대 색) · 칸 머리 아이콘 36 · 카드 그림자${light?'':' 검정 · 점 4개 카드와 대비 1.8+'} · 파란 카드 그러데이션 + 집`, JSON.stringify({r,e404}).slice(0,2500));
        await c404.close();
      }
    }
    // v405 — 실측: 현금 30억 · 2억 · 3천 × 320 · 390 · 1264 — 목록 4줄이 모두 한 줄(높이 50 이하 · 넘침 없음) · 비율이 금액 옆 「(95%)」 · 부대비용 0이면 괄호 없음 /
    //   결과 아래: 이미지 저장 · 결과 공유 그림자 + 같은 글자색 · 더 알아보기 머리 아이콘 36 · 줄 아이콘 32 4개(그림) / 다크 390: 단추 그림자 검정
    {
      for(const [width,scheme] of [[320,'light'],[390,'light'],[1264,'light'],[390,'dark']]){
        const c405=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960,colorScheme:scheme});const q=await c405.newPage();const e405=[];q.on('pageerror',e=>e405.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='oapi.map.naver.com')return route.fulfill({contentType:'text/javascript',body:FAKE_NAVER_338});if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/');
        const cases=[];
        for(const [cash,income] of [[300000,20000],[20000,7000],[3000,6000]]){
          await q.evaluate(([cash,income])=>{Object.assign(S,{cash,income,sgg:'11200',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);},[cash,income]);
          await q.waitForTimeout(300);
          cases.push(await q.evaluate(()=>[...document.querySelectorAll('#flow358 .f-leg>*')].map(r=>{const em=r.querySelector('.f-v em');const b=getComputedStyle(em,'::before').content;const v=r.querySelector('.f-v'),k=r.querySelector('.f-k');
            return {h:Math.round(r.getBoundingClientRect().height),one:Math.abs(v.getBoundingClientRect().top-k.getBoundingClientRect().top)<14,over:r.scrollWidth>r.clientWidth+1,em:em.textContent.trim(),inl:getComputedStyle(em).display,paren:b,hid:getComputedStyle(em).display==='none'};})));
        }
        const bot=await q.evaluate(()=>{const g=['outSave','outCopy'].map(id=>{const e=document.getElementById(id);return {sh:getComputedStyle(e).boxShadow,c:getComputedStyle(e.querySelector('b')).color};});
          const h=getComputedStyle(document.querySelector('#more341>h2'),'::before');
          const rows=[['#relatedReadLink','::before'],['#more341 .external-links>summary','::before'],['#more341 .result-notes321>summary','::before'],['#restartBtn','::before']].map(([s,pe])=>{const c=getComputedStyle(document.querySelector(s),pe);return c.width+'|'+c.backgroundImage.slice(0,4);});
          return {g,h:h.width+'|'+h.backgroundImage.slice(0,4),rows};});
        const light=scheme==='light';
        const flowOK=cases.every(rs=>rs.length===4 && rs.every(x=>x.h<=50 && x.one && !x.over && (x.em==='' ? x.hid : (/^\d+%$/.test(x.em) && x.inl==='inline' && x.paren==='"("'))));
        const botOK=bot.g.every(x=>x.sh!=='none' && (light ? /rgba\(16, 24, 40/.test(x.sh) : /rgba\(0, 0, 0/.test(x.sh))) && bot.g[0].c===bot.g[1].c && bot.h==='36px|url(' && bot.rows.every(x=>x==='32px|url(');
        ok(flowOK && botOK && !e405.length, `v405 ${width}px ${light?'밝게':'다크'} — 목록 줄 한 줄 · 「금액 (비율%)」(현금 30억 · 2억 · 3천) · 결과 아래 단추 그림자 · 같은 글자색 · 더 알아보기 아이콘 36 + 줄 아이콘 32 ×4`, JSON.stringify({cases,bot,e405}).slice(0,2500));
        await c405.close();
      }
    }
    // v406 — 실측(320 · 390 · 1264 밝게 + 390 다크): 첫 화면 그림 카드 = 파란 바탕 + 그러데이션 · 「내 예산」 칸 흰색 · 나머지 24칸 유리(흰 16%, 다크에서도 같음) ·
    //   동전/은행 아이콘이 카드 안이고 어느 칸과도 겹치지 않음 · 그림 글자 ≥ 13px · 자금 글 줄 책 아이콘 32 / 실거래 지역 머리 핀 36 · 25개 구 머리 입체 타일 36 · 지도 범례 점 8 둥글게
    {
      for(const [width,scheme] of [[320,'light'],[390,'light'],[1264,'light'],[390,'dark']]){
        const c406=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960,colorScheme:scheme});const q=await c406.newPage();const e406=[];q.on('pageerror',e=>e406.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='oapi.map.naver.com')return route.fulfill({contentType:'text/javascript',body:FAKE_NAVER_338});if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname==='/api/apt-price'){return route.fulfill({json:{ok:true,items:[0,1,2,3].map(i=>({name:'검증단지'+i,dong:'검증동',jibun:String(i),areaM2:84,amountMan:[15000,22000,30000,26000][i],buildYear:2015,floor:5,y:2026,m:11,d:1+i})),total:4}});}
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        const w=await q.evaluate(()=>{const sc=document.querySelector('#welcome232 .welcome232-scene'),cs=getComputedStyle(sc),sv=sc.querySelector('svg'),R=sc.getBoundingClientRect();
          const tiles=[...sv.querySelectorAll('rect[width="40"]')],fills=tiles.map(r=>getComputedStyle(r).fill);
          const hi=tiles.filter(r=>r.getAttribute('fill')==='#2458FF').map(r=>getComputedStyle(r).fill);
          const pse=['::before','::after'].map(pe=>{const c=getComputedStyle(sc,pe);const l=R.left+parseFloat(c.left),tp=R.top+parseFloat(c.top),wd=parseFloat(c.width),ht=parseFloat(c.height);return {img:c.backgroundImage.slice(0,4),box:[l,tp,l+wd,tp+ht]};});
          const tb=tiles.map(r=>{const b=r.getBoundingClientRect();return [b.left,b.top,b.right,b.bottom];});
          const hit=pse.some(p=>tb.some(b=>p.box[0]<b[2]-1&&p.box[2]>b[0]+1&&p.box[1]<b[3]-1&&p.box[3]>b[1]+1));
          const inside=pse.every(p=>p.box[0]>=R.left-1&&p.box[2]<=R.right+1&&p.box[1]>=R.top-1&&p.box[3]<=R.bottom+1);
          const t=sv.querySelector('text'),k=sv.getBoundingClientRect().width/sv.viewBox.baseVal.width;
          const rd=getComputedStyle(document.querySelector('#welcome232 .v305-reads>a'),'::before');
          return {bg:cs.backgroundColor+'|'+cs.backgroundImage.slice(0,15),glass:fills.filter(f=>f==='rgba(255, 255, 255, 0.16)').length,hi,pse:pse.map(p=>p.img),hit,inside,txt:Math.round(parseFloat(t.getAttribute('font-size'))*k*10)/10,h:Math.round(R.height),reads:rd.width+'|'+rd.backgroundImage.slice(0,4)};});
        await q.locator('#welcomeStart232').click(); await q.waitForTimeout(150);
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,sgg:'11590',sido:'서울특별시',group:'seoul',houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);window.yk208Navigate('map');});
        await q.waitForFunction(()=>DEAL.status!=='loading',null,{timeout:10000}).catch(()=>{}); await q.waitForTimeout(500);
        const d=await q.evaluate(()=>{const sm=document.querySelector('#viewDeals .dd-head small'),c=sm?getComputedStyle(sm):null;
          const lg=[...document.querySelectorAll('#dealMapLegend i')].map(i=>getComputedStyle(i).borderRadius+'|'+getComputedStyle(i).width);
          window.__yk357&&window.__yk357.show('reach',{query:false});
          const sy=document.querySelector('#reach328Title .section-symbol'),sc=sy?getComputedStyle(sy):null;
          return {pin:c?c.backgroundImage.slice(0,4)+'|'+c.paddingLeft:'none',lg,sym:sc?sc.width+'|'+sc.backgroundImage.slice(0,4)+'|'+(sy.querySelector('svg')?getComputedStyle(sy.querySelector('svg')).display:'-'):'none'};});
        const good=w.bg.startsWith('rgb(36, 88, 255)|radial-gradient') && w.glass===24 && w.hi.length===1 && w.hi[0]==='rgb(255, 255, 255)' && w.pse.every(x=>x==='url(') && !w.hit && w.inside && w.txt>=13 && w.h===224 && w.reads==='32px|url('
          && d.pin==='url(|46px' && d.lg.length===3 && d.lg.every(x=>x==='50%|8px') && d.sym==='36px|url(|none' && !e406.length;
        ok(good, `v406 ${width}px ${scheme==='light'?'밝게':'다크'} — 첫 화면 파란 그림 카드(유리 24칸 · 흰 「내 예산」 · 동전/은행 칸과 안 겹침 · 글자 13+) · 자금 글 책 32 · 실거래 핀 36 · 25개 구 타일 36 · 범례 둥근 점 8`, JSON.stringify({w,d,e406}).slice(0,2500));
        await c406.close();
      }
    }
    // v407 — 실측(320 · 390 · 1264 밝게 + 390 다크): 주택 보유 세 선택지 아이콘 36(그림 3가지 서로 다름) · 비교 빈 화면 표시 64 그림(선 아이콘 감춤) · 시트 금액 칸(현금 · 기존 대출) 숫자 왼쪽 = 입력 화면 금액 칸과 같은 맞춤
    {
      for(const [width,scheme] of [[320,'light'],[390,'light'],[1264,'light'],[390,'dark']]){
        const c407=await browser.newContext({viewport:{width,height:900},isMobile:width<960,hasTouch:width<960,colorScheme:scheme});const q=await c407.newPage();const e407=[];q.on('pageerror',e=>e407.push(e.message));
        await q.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='oapi.map.naver.com')return route.fulfill({contentType:'text/javascript',body:FAKE_NAVER_338});if(u.hostname!=='yeongkkeul.test')return route.abort();
          if(u.pathname.startsWith('/api/'))return route.fulfill({json:{ok:false,items:[],total:0}});
          const file=path.resolve(ROOT,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!file.startsWith(ROOT+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({path:file});});
        await q.goto('http://yeongkkeul.test/'); await q.evaluate(()=>document.fonts.ready);
        await q.locator('#welcomeStart232').click(); await q.waitForTimeout(200);
        const crowsAlign=await q.evaluate(()=>{const e=document.querySelector('#crows .inline-money-field input');return e?getComputedStyle(e).textAlign:'left';});
        await q.evaluate(()=>{S.sgg='11590';S.sido='서울특별시';S.group='seoul';openQ(1,'house');}); await q.waitForTimeout(350);
        const hs=await q.evaluate(()=>[...document.querySelectorAll('#qSheet #houseSeg [data-house]')].map(b=>{const c=getComputedStyle(b,'::before');return c.width+'|'+c.backgroundImage.slice(0,4)+'|'+c.backgroundImage.length+'|'+c.backgroundImage.slice(-80);}));
        await q.evaluate(()=>closeSheet('q')); await q.waitForTimeout(350);
        const al=[];
        for(const [st,md] of [[0,'region'],[2,'debt']]){ await q.evaluate(([st,md])=>openQ(st,md),[st,md]); await q.waitForTimeout(350);
          al.push(await q.evaluate(()=>{const e=document.querySelector('#qSheet :is(.single-money-field,.mfield) input');return e?getComputedStyle(e).textAlign:'none';}));
          await q.evaluate(()=>closeSheet('q')); await q.waitForTimeout(350); }
        await q.evaluate(()=>{Object.assign(S,{cash:20000,income:7000,houseStatus:'none',debtMonthly:0,lockedPrice:null});showResult(false);window.yk208Navigate('compare');}); await q.waitForTimeout(400);
        const mk=await q.evaluate(()=>{const m=document.querySelector('#viewCompare .v208-empty-mark');if(!m)return 'none';const c=getComputedStyle(m),sv=m.querySelector('svg');return Math.round(m.getBoundingClientRect().width)+'|'+c.backgroundImage.slice(0,4)+'|'+(sv?getComputedStyle(sv).display:'-');});
        const good=hs.length===3 && hs.every(x=>x.startsWith('36px|url(')) && new Set(hs).size===3 && al.length===2 && al.every(a=>a==='left'||a==='start') && (crowsAlign==='left'||crowsAlign==='start') && mk==='64|url(|none' && !e407.length;
        ok(good, `v407 ${width}px ${scheme==='light'?'밝게':'다크'} — 주택 보유 입체 아이콘 36 ×3(모두 다름) · 시트 금액 칸 왼쪽 맞춤(입력 화면과 같음) · 비교 빈 화면 입체 아이콘 64`, JSON.stringify({hs:hs.map(x=>x.slice(0,20)),al,crowsAlign,mk,e407}));
        await c407.close();
      }
    }
    ok(!errors.length,'v321 브라우저 JavaScript 실행 오류 없음',errors.join('\n'));
  }finally{await browser.close();}
}

console.log(`\n${pass}개 통과 · ${fail}개 실패`);
process.exit(fail ? 1 : 0);
