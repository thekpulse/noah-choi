const fs = require('fs');
const html = fs.readFileSync('yeongkkeul-calculator.html', 'utf8');

// <script> 본문 추출 (외부 src 스크립트 제외)
const m = html.match(/<script>([\s\S]*?)<\/script>/g);
let js = null;
for (const blk of m) {
  const body = blk.replace(/^<script>/, '').replace(/<\/script>$/, '');
  if (body.indexOf('function calculateRent') !== -1) { js = body; break; }
}
if (!js) { console.error('script block not found'); process.exit(1); }
js = js.slice(0, js.lastIndexOf('renderProgress();'));

// 최소 DOM 스텁
const store = {};
function el(id) {
  if (!store[id]) store[id] = {
    id, value: '', textContent: '', innerHTML: '', style: {}, dataset: {},
    checked: false, disabled: false,
    _cls: new Set(),
    get classList(){ const s=this._cls; return {
      toggle(c,f){ const on = (f===undefined) ? !s.has(c) : !!f; if(on) s.add(c); else s.delete(c); return on; },
      add(c){s.add(c);}, remove(c){s.delete(c);}, contains(c){return s.has(c);} }; },
    _span: null,
    appendChild(){}, querySelectorAll(){return [];},
    querySelector(){ if(!this._span) this._span={textContent:''}; return this._span; },
    closest(){return null;}, scrollIntoView(){}, selectedOptions: [{textContent:''}],
    setAttribute(){}, removeAttribute(){}, addEventListener(){}
  };
  return store[id];
}
global.document = {
  getElementById: el,
  createElement: () => ({ style:{}, dataset:{}, classList:{add(){},remove(){}}, appendChild(){}, setAttribute(){} }),
  querySelectorAll: () => [], querySelector: () => null,
  body: { appendChild(){}, removeChild(){} }, addEventListener(){}
};
global.window = { scrollTo(){}, location:{search:'', href:''}, history:{replaceState(){}} };
/* 배포 위치에 따라 실거래 박스 노출이 갈립니다(㊱·㊶). 기본은 API가 있는 Vercel. */
global.location = { protocol:'https:', hostname:'noah-choi.vercel.app', search:'', href:'' };
global.navigator = { clipboard: null, userAgent: 'node' };
global.fetch = () => Promise.reject(new Error('no network in test'));
global.AbortController = class { constructor(){ this.signal = {}; } abort(){} };

js += '\n;globalThis.LAWD=LAWD; globalThis.SISE_MONTHS=SISE_MONTHS;'
   + 'globalThis.RATE_BAND=RATE_BAND; globalThis.RATE_DEFAULT=RATE_DEFAULT;'
   + 'globalThis.ROOM_DEDUCT_DEFAULT=ROOM_DEDUCT_DEFAULT; globalThis.RENT_URL_FIELDS=RENT_URL_FIELDS;'
   + 'globalThis.KFB_AVG_RATES=KFB_AVG_RATES; globalThis.KFB_TOP5_AVG=KFB_TOP5_AVG; globalThis.KFB_DISCLOSURE=KFB_DISCLOSURE;'
   + 'globalThis.BOK=BOK; globalThis.LAST_VERIFIED=LAST_VERIFIED; globalThis.STALE_DAYS=STALE_DAYS;'
   + 'globalThis.REG_SGG=REG_SGG; globalThis.ROOM_4800_SGG=ROOM_4800_SGG; globalThis.ROOM_2800_SGG=ROOM_2800_SGG;'
   + 'globalThis.POLICY=POLICY; globalThis.SISE_UI=SISE_UI; globalThis.siseState=siseState;'
   + 'globalThis.DSR_RATIO=DSR_RATIO; globalThis.DTI_RATIO=DTI_RATIO;'
   + 'globalThis.POLICY_DEFS=POLICY_DEFS; globalThis.BINDING_COPY=BINDING_COPY;'
   + 'globalThis.SITUATION_SUB=SITUATION_SUB; globalThis.BUILD=BUILD;';
eval(js);

let pass = 0, fail = 0;
function t(name, cond, extra) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name + (extra ? '  → ' + extra : '')); }
}

console.log('\n=== 기존 회귀 (샘플) ===');
t('formatWon(99999600) = 1억원', formatWon(99999600) === '1억원', formatWon(99999600));
t('rentBrokerFee(3억) 정수 990000', rentBrokerFee(300000000) === 990000, rentBrokerFee(300000000));
t('setAmountManwon 60,500만 → 6억/500만', (() => {
  setAmountManwon('rentMarketEok', 'rentMarketMan', 60500);
  return el('rentMarketEok').value === 6 && el('rentMarketMan').value === '500';
})(), el('rentMarketEok').value + ' / ' + el('rentMarketMan').value);

console.log('\n=== 23. 구를 가진 상위 시가 드롭다운에 없을 것 ===');
const flat = [];
Object.keys(LAWD).forEach(k => LAWD[k].forEach(p => flat.push(p)));
const banned = ['41110','41130','41170','41190','41270','41280','41460','41590','43110','44130','47110','48120','52110'];
const found = flat.filter(p => banned.indexOf(p[0]) !== -1);
t('상위 시 13곳 코드 없음', found.length === 0, JSON.stringify(found));
t('광역 16개', Object.keys(LAWD).length === 16, Object.keys(LAWD).length);
t('시군구 256개', flat.length === 256, flat.length);
t('전남광주통합특별시 존재', !!LAWD['전남광주통합특별시']);
t('폐지된 광주광역시 없음', !LAWD['광주광역시'] && !LAWD['전라남도']);
t('화성시 동탄구 41597 존재', flat.some(p => p[0] === '41597'));

console.log('\n=== 24. 세종 처리 ===');
t('세종 시/도 존재', !!LAWD['세종특별자치시']);
t('세종 시군구 1개 = 36110', LAWD['세종특별자치시'].length === 1 && LAWD['세종특별자치시'][0][0] === '36110');
(() => {
  el('siseSido').value = '세종특별자치시';
  onSiseSido();
  t('세종 선택 시 시군구 자동 선택', el('siseSgg').value === '36110', el('siseSgg').value);
})();

console.log('\n=== recentYms ===');
const yms = recentYms(6);
t('6개월 반환', yms.length === 6, yms.join(','));
t('YYYYMM 형식', yms.every(y => /^\d{6}$/.test(y)), yms.join(','));
t('중복 없음(말일 건너뜀 방지)', new Set(yms).size === 6, yms.join(','));
t('내림차순 연속', (() => {
  for (let i = 1; i < yms.length; i++) {
    const a = +yms[i-1], b = +yms[i];
    const am = a % 100, bm = b % 100;
    const ok = (am > 1) ? (b === a - 1) : (b === a - 89); // 1월 → 전년 12월
    if (!ok) return false;
  }
  return true;
})(), yms.join(','));

console.log('\n=== 21/25. buildSiseGroups 필터링 ===');
const sample = [{ ym: '202606', truncated: false, items: [
  { aptNm:'래미안', dealAmount:'143,000', excluUseAr:'84.97', umdNm:'개포동', floor:'12', dealYear:'2026', dealMonth:'6', dealDay:'10', landLeaseholdGbn:'N' },
  { aptNm:'래미안', dealAmount:'150,000', excluUseAr:'84.92', umdNm:'개포동', floor:'20', dealYear:'2026', dealMonth:'6', dealDay:'20', landLeaseholdGbn:'N' },
  { aptNm:'래미안', dealAmount:'98,000',  excluUseAr:'59.98', umdNm:'개포동', floor:'3',  dealYear:'2026', dealMonth:'6', dealDay:'5',  landLeaseholdGbn:'N' },
  { aptNm:'강남브리지힐', dealAmount:'40,000', excluUseAr:'84.90', umdNm:'자곡동', floor:'5', dealYear:'2026', dealMonth:'6', dealDay:'8', landLeaseholdGbn:'Y' }, // 토지임대부
  { aptNm:'해제단지', dealAmount:'200,000', excluUseAr:'84.90', umdNm:'대치동', floor:'5', dealYear:'2026', dealMonth:'6', dealDay:'9', landLeaseholdGbn:'N', cdealType:'O' }, // 해제
  { aptNm:'필드없음', dealAmount:'110,000', excluUseAr:'75.00', umdNm:'삼성동', dealYear:'2026', dealMonth:'6', dealDay:'1' }, // floor/landLeasehold 없음 → 정상 포함
  { aptNm:'금액없음', excluUseAr:'84.00', umdNm:'논현동', dealYear:'2026', dealMonth:'6', dealDay:'1' } // 제외
]}];
const built = buildSiseGroups(sample);
t('토지임대부 제외 1건', built.exLease === 1, built.exLease);
t('해제거래 제외 1건', built.exCancel === 1, built.exCancel);
t('유효 거래 4건', built.used === 4, built.used);
t('단지 2곳 (래미안·필드없음)', built.groups.size === 2, built.groups.size);
t('토지임대부 단지 미포함', !Array.from(built.groups.values()).some(g => g.name === '강남브리지힐'));
t('금액 없는 건 제외', !Array.from(built.groups.values()).some(g => g.name === '금액없음'));
t('없는 필드 접근해도 에러 없음 (floor 미존재)', (() => {
  const g = Array.from(built.groups.values()).find(g => g.name === '필드없음');
  return g && g.areas.get(75)[0].floor === '';
})());

console.log('\n=== 면적 그룹핑 · 평균 ===');
const ram = Array.from(built.groups.values()).find(g => g.name === '래미안');
t('래미안 면적 2종 (85·60)', ram.areas.size === 2, Array.from(ram.areas.keys()).join(','));
t('84.97·84.92 → 같은 85㎡ 그룹', ram.areas.get(85) && ram.areas.get(85).length === 2);
t('85㎡ 평균 146,500만원', (() => {
  const a = ram.areas.get(85).map(r => r.amt);
  return Math.round((a[0] + a[1]) / 2) === 146500;
})());

console.log('\n=== 26. 원칙5 면적 환산 (전용㎡ ÷ 2.45 = 공급 평) ===');
t('전용 85㎡ → 약 35평', Math.round(85 / 2.45) === 35, (85/2.45).toFixed(1));
t('전용 60㎡ → 약 24평', Math.round(60 / 2.45) === 24, (60/2.45).toFixed(1));
t('역방향 일치: syncPyeong 35평 → 85.75㎡', Math.abs(35 * 2.45 - 85.75) < 0.01);

console.log('\n=== 18. 중복 id 없을 것 ===');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(x => x[1]);
const dup = ids.filter((v, i) => ids.indexOf(v) !== i);
t('중복 id 없음', dup.length === 0, JSON.stringify([...new Set(dup)]));

console.log('\n=== 신규 id 존재 확인 ===');
['siseSido','siseSgg','siseLoadBtn','siseStatus','siseAptWrap','siseAptFilter','siseApt','siseAreaWrap','siseArea','siseResult','rentMarketSource']
  .forEach(id => t('id=' + id, ids.indexOf(id) !== -1));


console.log('\n=== v19 ① 고급설정 위치 ===');
(() => {
  const iToggle = html.indexOf('id="topSectionToggle"');
  const iCta    = html.indexOf('class="cta" onclick="calculate()"');
  const iEnd    = html.indexOf('<span>접기</span>');
  t('더 정확하게 토글이 CTA보다 위', iToggle > 0 && iCta > 0 && iToggle < iCta, iToggle + ' < ' + iCta);
  t('optionalSection 전체가 CTA보다 위', iEnd > 0 && iEnd < iCta, iEnd + ' < ' + iCta);
  t('CTA 위 안내문에 더 정확하게 언급', html.indexOf('cta-lead') !== -1 && html.indexOf('"더 정확하게"</b>를 먼저 펼쳐') !== -1);
})();

console.log('\n=== v19 ② 금액 억/만원 2칸 ===');
['manualLoanCap','creditLoan','companyLoan','sellerFinancing','prevLoanBalance'].forEach(b => {
  t(b + ' 2칸 존재', ids.indexOf(b+'Eok') !== -1 && ids.indexOf(b+'Man') !== -1);
  t(b + ' 옛 단일칸 제거', html.indexOf('id="'+b+'"') === -1);
});
t('신용대출 3억5천 → 35,000만원', (() => {
  el('creditLoanEok').value = 3; el('creditLoanMan').value = '5,000';
  return getAmountManwon('creditLoanEok','creditLoanMan') === 35000;
})(), getAmountManwon('creditLoanEok','creditLoanMan'));
t('ctx.creditLoan = 3.5억원', (() => {
  el('creditLoanEok').value = 3; el('creditLoanMan').value = '5,000';
  el('companyLoanEok').value = ''; el('companyLoanMan').value = '';
  el('sellerFinancingEok').value = ''; el('sellerFinancingMan').value = '';
  const c = buildCtxBase();
  return c.creditLoan === 350000000 && c.extraFunding === 350000000;
})());
t('만원칸만 써도 동작 (8,000만)', (() => {
  el('manualLoanCapEok').value = ''; el('manualLoanCapMan').value = '8,000';
  return getAmountManwon('manualLoanCapEok','manualLoanCapMan') === 8000;
})());
t('setAmountOrBlank(0) → 두 칸 모두 빈 값', (() => {
  setAmountOrBlank('companyLoan', 0);
  return el('companyLoanEok').value === '' && el('companyLoanMan').value === '';
})());
t('setAmountOrBlank(12,300만) → 1억 / 2,300만', (() => {
  setAmountOrBlank('companyLoan', 12300);
  return el('companyLoanEok').value === 1 && el('companyLoanMan').value === '2,300';
})(), el('companyLoanEok').value + ' / ' + el('companyLoanMan').value);
t('toggleNoLoan 체크 시 2칸 모두 비활성·비움', (() => {
  el('manualLoanCapEok').value = 5; el('manualLoanCapMan').value = '500';
  el('noLoanCheck').checked = true; toggleNoLoan();
  const a = el('manualLoanCapEok'), b = el('manualLoanCapMan');
  const off = a.disabled && b.disabled && a.value === '' && b.value === '';
  el('noLoanCheck').checked = false; toggleNoLoan();
  return off && !a.disabled && !b.disabled;
})());
t('공유링크 파라미터명 유지 (cl/col/sf/mlc)',
  ["p.set('cl'","p.set('col'","p.set('sf'","p.set('mlc'"].every(x => html.indexOf(x) !== -1));

console.log('\n=== v19 ③④ 유의사항 ===');
t('본문 글자 11.5px → 13px', html.indexOf('.disclaimer{') !== -1 && /\.disclaimer\{[^}]*font-size:13px/.test(html));
t('색상 ink-faint → ink-soft', /\.disclaimer\{[^}]*color:var\(--ink-soft\)/.test(html));
t('disclaimerMore 존재', ids.indexOf('disclaimerMore') !== -1);
t('접기 토글 버튼 존재', html.indexOf('toggleDisclaimer(this)') !== -1);
t('핵심 2개는 항상 노출 (more 밖)', (() => {
  const iMore = html.indexOf('id="disclaimerMore"');
  const i1 = html.indexOf('이 계산기는 금융·세무·투자 자문이 아니에요');
  const i2 = html.indexOf('결과는 모두 추정치예요');
  const i3 = html.indexOf('아파트 기준이에요');
  return i1 < iMore && i2 < iMore && i3 > iMore;
})());
t('toggleDisclaimer 펼치기/접기 동작', (() => {
  const btn = el('__btn');
  toggleDisclaimer(btn);
  const opened = el('disclaimerMore').classList.contains('open') && btn.querySelector().textContent === '유의사항 접기';
  toggleDisclaimer(btn);
  const closed = !el('disclaimerMore').classList.contains('open');
  return opened && closed;
})());
t('전월세 탭 유의사항도 같은 CSS 적용', (html.match(/class="disclaimer"/g) || []).length === 2);

console.log('\n=== v20 중앙값 · 반올림 · 편차 ===');
t('medianOf 홀수 [50,58,66] = 58', medianOf([50,58,66]) === 58);
t('medianOf 짝수 [50,58,60,66] = 59', medianOf([50,58,60,66]) === 59, medianOf([50,58,60,66]));
t('medianOf 1건 = 그 값', medianOf([12345]) === 12345);
t('medianOf 빈 배열 = 0', medianOf([]) === 0);
t('중앙값이 이상치에 안 흔들림', (() => {
  const a = [500000,510000,520000,530000,1000000].sort((x,y)=>x-y);
  const avg = Math.round(a.reduce((x,y)=>x+y,0)/a.length);
  return medianOf(a) === 520000 && avg === 612000;   // 평균은 이상치에 끌려감
})());
t('roundToTenMil 582143 → 582000', roundToTenMil(582143) === 582000, roundToTenMil(582143));
t('roundToTenMil 반올림 올림 585600 → 586000', roundToTenMil(585600) === 586000, roundToTenMil(585600));
t('roundToTenMil 소액 15300 → 15000', roundToTenMil(15300) === 15000);
t('반올림 오차 1% 미만 (58억대)', Math.abs(roundToTenMil(582143) - 582143) / 582143 < 0.01);
t('스크린샷 케이스: 58억 2,143만 → 58억 2,000만',
  formatWon(roundToTenMil(582143) * 10000) === '58억 2,000만원',
  formatWon(roundToTenMil(582143) * 10000));

console.log('\n=== v20 편차 경고 임계값 ===');
t('압구정 케이스(50~66억, 중앙값 58억) → 경고', (660000 - 500000) / 580000 >= 0.2);
t('편차 작은 케이스(58~60억) → 경고 없음', (600000 - 580000) / 590000 < 0.2);
t('편차 경고 코드 존재', html.indexOf('거래가격 차이가 큽니다') !== -1);
t('spread 20% 임계값 사용', html.indexOf('spread >= 0.2') !== -1);

console.log('\n=== v20 UI 문구 ===');
t('버튼이 중앙값으로 변경', html.indexOf('중앙값으로 채우기') !== -1 && html.indexOf('평균값으로 채우기') === -1);
t('평균은 참고로 계속 표시', html.indexOf("'평균 ' + formatWon(roundToTenMil(avg)") !== -1);
t('중앙값 설명 문구 존재', html.indexOf('한가운데 값') !== -1);
t('자동채움 안내문 span 분리', ids.indexOf('rentMarketHintAuto') !== -1);
t('채운 뒤 안내문 숨김 코드', html.indexOf("autoHint.style.display = 'none'") !== -1);
t('직접 수정 시 안내문 복원', html.indexOf("autoHint.style.display = ''") !== -1);
t('출처 표에 중앙값·반올림 명시', html.indexOf('중앙값, 천만원 단위 반올림') !== -1);


console.log('\n=== v21 ① 지역 3단 분리 (계산 정확성) ===');
t('zone 셀렉트 3옵션 존재', ['value="reg"','value="metro"','value="other"'].every(x => html.indexOf(x) !== -1));
t('옛 id=regulated 제거', html.indexOf('id="regulated"') === -1);
(function(){
  const setZ = v => { el('zone').value = v; };
  setZ('reg');   t('zoneVal reg',   zoneVal() === 'reg' && isReg() && isMetro());
  setZ('metro'); t('zoneVal metro', zoneVal() === 'metro' && !isReg() && isMetro());
  setZ('other'); t('zoneVal other', zoneVal() === 'other' && !isReg() && !isMetro());
  setZ('true');  t('구버전 r=1 링크 → reg',   zoneVal() === 'reg');
  setZ('false'); t('구버전 r=0 링크 → other', zoneVal() === 'other');
  setZ('reg');
})();
t('🚨 수도권 비규제 무주택 LTV 70% (기존 40% 오류)', getLTV('none', false, true) === 0.7, getLTV('none', false, true));
t('규제지역 무주택 LTV 40%',        getLTV('none', true, true) === 0.4);
t('그 외 지역 무주택 LTV 70%',      getLTV('none', false, false) === 0.7);
t('생애최초 수도권 비규제 70%',      getLTV('first', false, true) === 0.7);
t('생애최초 규제지역 70%',           getLTV('first', true, true) === 0.7);
t('생애최초 그 외 지역 80%',         getLTV('first', false, false) === 0.8);
t('처분조건부 수도권 비규제 70%',    getLTV('oneDisposing', false, true) === 0.7);
t('처분조건부 규제지역 40%',         getLTV('oneDisposing', true, true) === 0.4);
t('다주택 규제지역 0%',              getLTV('multi', true, true) === 0);
t('다주택 수도권 비규제 60%',        getLTV('multi', false, true) === 0.6);
t('취득세 중과는 규제지역만 12%',    acquisitionTaxRate(1000000000,'multi',true) === 0.12);
t('취득세 수도권 비규제 다주택 8%',  acquisitionTaxRate(1000000000,'multi',false) === 0.08);
t('스트레스: 수도권 비규제도 3.0%',  computeStressBp(true,'variable',0,30) === 3.0, computeStressBp(true,'variable',0,30));
t('스트레스: 그 외 지역 0.75%',      computeStressBp(false,'variable',0,30) === 0.75);
t('구간한도가 metro 기준 코드', html.indexOf('if(c.metro){') !== -1 && html.indexOf('if(c.regulated){\n      if(c.price <= 1500000000)') === -1);
/* v21.8 교체(원칙 48): 소스 문자열이 아니라 동작을 검사합니다.
   목적 = "신생아특례 생애최초 LTV는 '규제지역'이 아니라 '수도권'으로 갈린다. 수도권 밖 80% · 안 70%" */
t('디딤돌 생애최초 LTV는 수도권 밖 80%',
  POLICY_DEFS.didimdolBaby.ltv({firstTime:true, metro:false}) === 0.8);
t('디딤돌 생애최초 LTV는 수도권 안 70%',
  POLICY_DEFS.didimdolBaby.ltv({firstTime:true, metro:true}) === 0.7);
t('생애최초가 아니면 수도권 밖도 70%',
  POLICY_DEFS.didimdolBaby.ltv({firstTime:false, metro:false}) === 0.7);
t('규제지역 여부는 이 판정에 끼어들지 않음(원칙 26)',
  POLICY_DEFS.didimdolBaby.ltv({firstTime:true, metro:false, regulated:true}) === 0.8);
t('신생아특례 지방인하는 수도권 기준', html.indexOf('(metro ? 0 : 0.2)') !== -1);
t('규제지역 목록에 동탄·기흥·구리 포함', ['화성 동탄','용인 기흥','구리'].every(x => html.indexOf(x) !== -1));

console.log('\n=== v21 ② 방공제 지역 4단 ===');
t('기본값 매핑 reg 5500 / metro 4800 / other 2800',
  ROOM_DEDUCT_DEFAULT.reg === 5500 && ROOM_DEDUCT_DEFAULT.metro === 4800 && ROOM_DEDUCT_DEFAULT.other === 2800);
t('roomDeduct 셀렉트 4단', ['"5500"','"4800"','"2800"','"2500"'].every(x => html.indexOf('value=' + x) !== -1));
t('MCI 가입 시 방공제 0', roomDeduction({mciCovered:true, roomDeductAmt:48000000}) === 0);
t('입력값 그대로 차감', roomDeduction({mciCovered:false, roomDeductAmt:48000000}) === 48000000);
t('값 없으면 2,800만 폴백', roomDeduction({mciCovered:false, roomDeductAmt:0}) === 28000000);
t('applyZoneDefaults가 zone 따라 채움', (() => {
  el('zone').value = 'metro'; delete el('roomDeduct').dataset.touched;
  applyZoneDefaults();
  const a = el('roomDeduct').value === '4800';
  el('zone').value = 'other'; applyZoneDefaults();
  const b = el('roomDeduct').value === '2800';
  el('zone').value = 'reg'; applyZoneDefaults();
  return a && b && el('roomDeduct').value === '5500';
})(), el('roomDeduct').value);
t('사용자가 고치면 덮어쓰지 않음', (() => {
  el('roomDeduct').dataset.touched = '1'; el('roomDeduct').value = '2500';
  el('zone').value = 'reg'; applyZoneDefaults();
  const ok = el('roomDeduct').value === '2500';
  delete el('roomDeduct').dataset.touched;
  return ok;
})());

console.log('\n=== v21 ③ 금리 기본값 · 칩 라벨 ===');
t('기본값 5.4% (시장 하단 4.8% 탈출)', RATE_DEFAULT === 5.4 && html.indexOf('id="rate" value="5.4"') !== -1);
t('평가어 라벨 제거 (우대/보통/높음)',
  html.indexOf('보통 4.8%') === -1 && html.indexOf('우대 4.2%') === -1 && html.indexOf('높음 5.4%') === -1);
t('칩 라벨이 출처 기준 표기', html.indexOf("'공시 평균 '") !== -1 && html.indexOf("'게시 상단 '") !== -1);
t('고정형 구간 4.74~7.50', RATE_BAND.fixed.lo === 4.74 && RATE_BAND.fixed.hi === 7.50);
t('변동형 구간 4.17~6.88', RATE_BAND.variable.lo === 4.17 && RATE_BAND.variable.hi === 6.88);
t('rateType별로 구간이 갈림',
  rateBandFor('variable').hi === 6.88 && rateBandFor('mixed').hi === 7.50 && rateBandFor('periodic').hi === 7.50);
t('구간에 출처·확인일 있음', !!RATE_BAND.fixed.src && /^\d{4}\.\d{2}\.\d{2}$/.test(RATE_BAND.fixed.asOf));
t('기본값이 평균이 아니라고 명시', html.indexOf('시장 평균이 아니') !== -1);
t('출처표에 주담대 금리 행 2종', html.indexOf('<td>주담대 공시 평균금리</td>') !== -1 && html.indexOf('<td>주담대 게시 금리구간</td>') !== -1);
t('renderRateChips가 3개 칩 생성', (() => {
  el('rateType').value = 'variable';
  renderRateChips();
  const h = el('rateChips').innerHTML;
  return (h.match(/class="chip"/g) || []).length === 3 && h.indexOf('4.50') !== -1 && h.indexOf('6.88') !== -1;
})(), el('rateChips').innerHTML.slice(0, 60));

console.log('\n=== v21 ④ 은행 자체 한도 ===');
t('bankSelfCap 2칸 존재', ids.indexOf('bankSelfCapEok') !== -1 && ids.indexOf('bankSelfCapMan') !== -1);
t('한도 후보에 은행자체한도 포함', html.indexOf("cands['은행자체한도'] = c.bankSelfCap") !== -1);
t('병목 진단 카피 존재', html.indexOf("'은행자체한도':") !== -1);
t('KB 사례에 출처·시행일 명시', html.indexOf('2026.7.10') !== -1 && html.indexOf('머니투데이') !== -1);
t('ctx.bankSelfCap 반영 (3억)', (() => {
  el('bankSelfCapEok').value = 3; el('bankSelfCapMan').value = '';
  return buildCtxBase().bankSelfCap === 300000000;
})());

console.log('\n=== v21 ⑤ 연소득 억/만원 2칸 ===');
t('incomeEok/incomeMan 존재', ids.indexOf('incomeEok') !== -1 && ids.indexOf('incomeMan') !== -1);
t('옛 단일칸 id=income 제거', html.indexOf('id="income"') === -1);
t('1억 2,000만 → 12,000만원', (() => {
  el('incomeEok').value = 1; el('incomeMan').value = '2,000';
  return getAmountManwon('incomeEok','incomeMan') === 12000;
})());
t('amountEntered: 둘 다 비면 false', (() => {
  el('incomeEok').value = ''; el('incomeMan').value = '';
  return amountEntered('incomeEok','incomeMan') === false;
})());
t('amountEntered: 만원칸만 있어도 true', (() => {
  el('incomeMan').value = '7,000';
  return amountEntered('incomeEok','incomeMan') === true;
})());
t('연소득 0 입력과 미입력을 구분', (() => {
  el('incomeEok').value = ''; el('incomeMan').value = '0';
  const entered = amountEntered('incomeEok','incomeMan');
  el('incomeEok').value = ''; el('incomeMan').value = '';
  return entered === true && amountEntered('incomeEok','incomeMan') === false;
})());
t('공유링크 inc 파라미터 유지', html.indexOf("p.set('inc'") !== -1);

console.log('\n=== v21 ⑥ 공유 링크 호환 ===');
t('신규 z 파라미터', html.indexOf("p.set('z', zoneVal())") !== -1);
t('구버전 r 파라미터도 계속 씀', html.indexOf("p.set('r', isMetro()") !== -1);
t('읽을 때 z 우선, 없으면 r 폴백', html.indexOf("if(p.has('z'))") !== -1 && html.indexOf("else if(p.has('r'))") !== -1);
t('rd·bsc 파라미터 추가', html.indexOf("p.set('rd'") !== -1 && html.indexOf("p.set('bsc'") !== -1);

console.log('\n=== v21 ⑦ 전월세 탭 개편 ===');
t('리포트 카드 구조 (report/report-top/report-hero)',
  html.indexOf('id="captureAreaRent" class="report"') !== -1 && ids.indexOf('rentReportDate') !== -1);
t('가정 바 존재', ids.indexOf('rentAssumpBar') !== -1);
t('진단 카드 존재', ids.indexOf('rentDiagBox') !== -1);
t('링크 공유 버튼 존재', ids.indexOf('linkBtnRent') !== -1);
t('전월세 파라미터는 r_ 접두사', html.indexOf("p.set('r_' + key, v)") !== -1);
t('전월세 파라미터 19개', RENT_URL_FIELDS.length === 19, RENT_URL_FIELDS.length);
t('매매 파라미터와 이름 충돌 없음', (() => {
  const buyKeys = ['m','z','r','h','py','ip','etc','rt','yr','cash','price','cl','col','sf','ftc','o85','inc','nw','nb','cc','lc','sm','nl','mlc','rd','bsc'];
  return RENT_URL_FIELDS.every(f => buyKeys.indexOf('r_' + f[0]) === -1);
})());
t('전월세 링크에 t=rent 표식', html.indexOf("p.set('t', 'rent')") !== -1);
t('진단 카드가 .diag-card 재사용 (새 클래스 안 만듦)', html.indexOf('class="diag-card"') !== -1);
t('계산 불가 시 이전 결과 비움', html.indexOf('function clearRentExtras()') !== -1
  && (html.match(/clearRentExtras\(\);/g) || []).length === 3, (html.match(/clearRentExtras\(\);/g) || []).length);
t('rentFallbackNote 유지 (원칙: 기존 안내 보존)', ids.indexOf('rentFallbackNote') !== -1);

console.log('\n=== v21 ⑧ 세그먼트 동기화 버그 수정 ===');
t('syncSegments 함수 존재', html.indexOf('function syncSegments()') !== -1);
t('전역 훑기 제거', html.indexOf("'#modeSeg ~ * .seg-btn, .segmented.sm .seg-btn'") === -1);
t('select.sr-only 짝으로 매칭', html.indexOf("querySelectorAll('select.sr-only[id]')") !== -1);

console.log('\n=== v21 ⑨ 출처 표 · 영수증 · 문구 ===');
['규제지역 지정','구간별 대출한도','주담대 공시 평균금리','주담대 게시 금리구간','은행 자체 한도','방공제(최우선변제금)']
  .forEach(x => t('출처표 행: ' + x, html.indexOf('<td>' + x + '</td>') !== -1));
t('모바일에서 출처 열을 숨기지 않음', html.indexOf('.src-table th:nth-child(3),.src-table td:nth-child(3){display:none;}') === -1);
t('모바일 카드형 전환', html.indexOf('.src-table td:nth-child(3)::before{content:"출처 ";') !== -1);
t('영수증 대출 행 강조 클래스', html.indexOf('.line-item.loan{') !== -1 && (html.match(/formatWon\(c\.mortgageLoan\), 'loan'\)/g) || []).length === 2);
t('소계 행 배경 구분', /\.line-item\.total\{[^}]*background:var\(--fill\)/.test(html));
(() => {
  /* ㊴ — 대출 행은 "채워진 진한 블록"이 되면 안 됩니다. 맨 아래 .grand와 역할이 겹쳐요. */
  const seg = html.slice(html.indexOf('.line-item.loan{'), html.indexOf('.line-item.total{'));
  t('파랑 배경 위 흰 글씨 아님 (원칙 10)',
    seg.indexOf('#fff') === -1 && seg.indexOf('#FFF') === -1);
  t('대출 행 배경은 연한 틴트 유지', seg.indexOf('background:var(--primary-soft)') !== -1);
  t('대출 금액이 같은 파랑 계열 (원칙 38)',
    seg.indexOf('.line-item.loan .v{color:var(--primary-dark)') !== -1);
  t('라벨·금액이 같은 토큰을 씀 (하드코딩 색 없음)',
    seg.indexOf('.line-item.loan .k{color:var(--primary-dark)') !== -1);
  t('대출 금액에 골드(--accent) 안 씀 (원칙 38)', seg.indexOf('var(--accent)') === -1);
  t('대출 금액 크기는 17px 유지', seg.indexOf('font-size:17px') !== -1);
  /* 맨 아래 .grand(19px)가 계속 가장 큰 숫자여야 합니다. */
  t('영수증에서 대출 행이 총액 행보다 크지 않음', seg.indexOf('font-size:19px') === -1);
})();
t('"지방" → "그 외 지역" 중립 표현', html.indexOf('<b>그 외 지역</b><span>수도권 밖</span>') !== -1);
t('아파텔 표현 제거', html.indexOf('아파텔') === -1);

console.log('\n=== v21 ⑩ 카톡 공유 텍스트 간소화 ===');
t('불필요 항목 제거 (대출금액·한도결정)', html.indexOf('· 대출금액   ') === -1 && html.indexOf('· 한도 결정  ') === -1);
t('링크가 함께 붙음', html.indexOf('전체 내역 보기 ↓') !== -1);
t('면책 한 줄로 축약', html.indexOf('추정치 (금융자문 아님)') !== -1);
t('핵심 2줄만 남김', (() => {
  const i = html.indexOf('· 월 상환액  ');
  const j = html.indexOf('· 필요한 내 돈  ');
  return i !== -1 && j !== -1 && j > i;
})());

console.log('\n=== v21 ⑪ 정책 누락 보완 ===');
t('토지거래허가구역 실거주 의무 안내', ids.indexOf('ltaNote') !== -1 && html.indexOf('2년 실거주 의무') !== -1);
t('갭투자 불가 명시', html.indexOf('갭투자') !== -1);
t('규제지역이고 지역이 정해졌을 때만 노출', html.indexOf("(isReg() && ltaResolved()) ? 'block' : 'none'") !== -1);
t('취득세 2주택 단순화 명시', html.indexOf('2주택 이상은 보수적으로 계산해요') !== -1);
t('전세대출 이자 DSR 미반영 명시', html.indexOf('전세대출 이자는 DSR에 넣지 않았어요') !== -1);
t('유의사항 항목 수 증가 (2개 추가)', (html.match(/class="disclaimer-item"/g) || []).length >= 12, (html.match(/class="disclaimer-item"/g) || []).length);

console.log('\n=== v21 ⑫ 은행연합회 공시 반영 ===');
t('공시 은행 16곳 (취급액 없는 2곳 제외)', KFB_AVG_RATES.length === 16, KFB_AVG_RATES.length);
t('산업은행·토스뱅크 제외', !KFB_AVG_RATES.some(b => /산업은행|토스/.test(b.n)));
t('5대 은행 평균 4.50% 검산', (() => {
  const five = ['KB국민은행','신한은행','하나은행','우리은행','NH농협은행']
    .map(n => KFB_AVG_RATES.find(b => b.n === n).r);
  return five.length === 5 && Math.round(five.reduce((a,b)=>a+b,0) / 5 * 100) / 100 === 4.50
    && KFB_TOP5_AVG === 4.50;
})(), KFB_TOP5_AVG);
t('개별 은행 값 정확 (하나 4.26 / 신한 5.00 / 전북 5.57)',
  KFB_AVG_RATES.find(b=>b.n==='하나은행').r === 4.26
  && KFB_AVG_RATES.find(b=>b.n==='신한은행').r === 5.00
  && KFB_AVG_RATES.find(b=>b.n==='전북은행').r === 5.57);
t('금리 오름차순 정렬', KFB_AVG_RATES.every((b,i) => i === 0 || KFB_AVG_RATES[i-1].r <= b.r));
t('공시 메타에 출처·기준월·확인일', !!KFB_DISCLOSURE.src && !!KFB_DISCLOSURE.asOf && !!KFB_DISCLOSURE.checked);
t('공시 기준이 만기 10년 이상 분할상환', html.indexOf('만기 10년 이상 분할상환') !== -1);
t('전월 취급분 시차 명시', html.indexOf('공시는 전월 취급분이라 지금과 시차가 있어요') !== -1);
t('공시 vs 게시 차이 설명', html.indexOf('두 숫자가 다른 걸 재고 있어요') !== -1);
t('🟡 미검증 표시 해제', html.indexOf('🟡 은행연합회 공시 대조 예정') === -1);
t('출처표에 공시 행 추가', html.indexOf('<td>주담대 공시 평균금리</td>') !== -1
  && html.indexOf('전국은행연합회 소비자포털 공시 — 2026년 6월중 취급분') !== -1);
t('은행 선택 드롭다운 존재', ids.indexOf('bankRatePick') !== -1);
t('은행 선택 시 금리 채움', (() => {
  renderBankRateOptions();
  const sel = el('bankRatePick');
  const built = sel.innerHTML.indexOf('KB국민은행') !== -1 && sel.innerHTML.indexOf('4.63') !== -1;
  applyBankRate({value:'4.63'});
  return built && el('rate').value === 4.63 && el('rate').dataset.touched === '1';
})(), el('rate').value);
t('빈 값 선택 시 금리 안 바뀜', (() => {
  el('rate').value = 5.4;
  applyBankRate({value:''});
  return el('rate').value === 5.4;
})());

console.log('\n=== v21.1 기준값 신선도 경고 ===');
t('기준금리 상수화 (하드코딩 제거)', BOK.rate === 2.75 && html.indexOf('const baseRate = BOK.rate;') !== -1);
t('7.16 결정 · 다음 회의 8.27 기록', BOK.decidedOn === '2026.07.16' && BOK.nextMeeting === '2026-08-27');
t('금통위 전에는 경고 없음', (() => {
  const before = new Date('2026-08-05T00:00:00+09:00') >= new Date(BOK.nextMeeting + 'T00:00:00+09:00');
  return before === false;
})());
t('금통위 후에는 경고 발생 (로직 검증)', (() => {
  return new Date('2026-08-28T00:00:00+09:00') >= new Date(BOK.nextMeeting + 'T00:00:00+09:00');
})());
t('bokNote가 문자열 반환', typeof bokNote() === 'string');
t('기준값 확인일 · 90일 임계', LAST_VERIFIED === '2026-08-05' && STALE_DAYS === 90);
t('배너 자리 존재', (html.match(/class="stale-banner"/g) || []).length >= 1);
t('배너 CSS (파랑 배경 위 흰 글씨 아님)', html.indexOf('.stale-banner{') !== -1 && html.indexOf('background:#FFF4E5') !== -1);
t('renderStaleBanner 초기화에 포함', html.indexOf('renderStaleBanner();') !== -1);
t('90일 경과 시 일수 표시', html.indexOf('일</b>이 지났습니다') !== -1);

console.log('\n=== v21.2 시군구 자동 판정 — 규제지역 ===');
t('규제지역 경기 15곳', Object.keys(REG_SGG).length === 15, Object.keys(REG_SGG).length);
t('규제지역 코드가 전부 LAWD에 실재', (() => {
  const all = {}; Object.keys(LAWD).forEach(k => LAWD[k].forEach(p => all[p[0]] = p[1]));
  const bad = Object.keys(REG_SGG).filter(c => all[c] !== REG_SGG[c]);
  return bad.length === 0;
})(), (() => { const all={}; Object.keys(LAWD).forEach(k=>LAWD[k].forEach(p=>all[p[0]]=p[1]));
  return JSON.stringify(Object.keys(REG_SGG).filter(c=>all[c]!==REG_SGG[c]).map(c=>c+':'+REG_SGG[c]+'≠'+all[c])); })());
t('서울 25개 구 전부 reg', LAWD['서울특별시'].every(p => zoneFromSgg(p[0]) === 'reg'));
t('서울 25개 구 맞음', LAWD['서울특별시'].length === 25);
t('강남구 11680 → reg', zoneFromSgg('11680') === 'reg');
t('과천 41290 → reg', zoneFromSgg('41290') === 'reg');
t('화성 동탄 41597 → reg (2026.7.1 신규)', zoneFromSgg('41597') === 'reg');
t('용인 기흥 41463 → reg (2026.7.1 신규)', zoneFromSgg('41463') === 'reg');
t('구리 41310 → reg (2026.7.1 신규)', zoneFromSgg('41310') === 'reg');
t('🚨 안양 만안 41171 → metro (동안구만 규제)', zoneFromSgg('41171') === 'metro');
t('🚨 수원 권선 41113 → metro (나머지 3구만 규제)', zoneFromSgg('41113') === 'metro');
t('🚨 용인 처인 41461 → metro (수지·기흥만 규제)', zoneFromSgg('41461') === 'metro');
t('🚨 화성 병점 41595 → metro (동탄만 규제)', zoneFromSgg('41595') === 'metro');
t('인천 남동구 28200 → metro', zoneFromSgg('28200') === 'metro');
t('인천 강화군 28710 → metro (수도권임)', zoneFromSgg('28710') === 'metro');
t('부산 해운대 → other', zoneFromSgg(LAWD['부산광역시'].find(p=>/해운대/.test(p[1]))[0]) === 'other');
t('세종 36110 → other', zoneFromSgg('36110') === 'other');
t('경기 전체가 reg 아니면 metro', LAWD['경기도'].every(p => ['reg','metro'].indexOf(zoneFromSgg(p[0])) !== -1));
t('경기 규제지역 정확히 15곳', LAWD['경기도'].filter(p => zoneFromSgg(p[0]) === 'reg').length === 15,
  LAWD['경기도'].filter(p => zoneFromSgg(p[0]) === 'reg').map(p=>p[1]).join(','));
t('수도권 밖은 전부 other', (() => {
  return Object.keys(LAWD).filter(k => ['서울특별시','경기도','인천광역시'].indexOf(k) === -1)
    .every(k => LAWD[k].every(p => zoneFromSgg(p[0]) === 'other'));
})());
t('빈 코드는 null', zoneFromSgg('') === null && zoneFromSgg(null) === null);

console.log('\n=== v21.2 시군구 자동 판정 — 방공제 ===');
t('서울 → 5,500만', roomDeductFromSgg('11680') === 5500);
t('성남 분당 → 4,800만 (과밀억제)', roomDeductFromSgg('41135') === 4800);
t('용인 처인 → 4,800만 (시행령 명시)', roomDeductFromSgg('41461') === 4800);
t('화성 동탄 → 4,800만', roomDeductFromSgg('41597') === 4800);
t('김포 → 4,800만', roomDeductFromSgg('41570') === 4800);
t('세종 → 4,800만', roomDeductFromSgg('36110') === 4800);
t('인천 남동구 → 4,800만', roomDeductFromSgg('28200') === 4800);
t('인천 강화군 → 2,500만 (군지역)', roomDeductFromSgg('28710') === 2500);
t('안산 상록 → 2,800만', roomDeductFromSgg('41271') === 2800);
t('평택 → 2,800만', roomDeductFromSgg('41220') === 2800);
t('부산 해운대 → 2,800만', roomDeductFromSgg(LAWD['부산광역시'].find(p=>/해운대/.test(p[1]))[0]) === 2800);
t('부산 기장군 → 2,500만 (군지역)', roomDeductFromSgg('26710') === 2500);
t('대구 달성군 → 2,500만', roomDeductFromSgg('27710') === 2500);
t('경기 양평군 → 2,500만', roomDeductFromSgg('41830') === 2500);
t('강원 → 2,500만', roomDeductFromSgg(LAWD['강원특별자치도'][0][0]) === 2500);
t('모든 시군구가 4단 중 하나로 떨어짐', (() => {
  const ok = [5500,4800,2800,2500];
  return Object.keys(LAWD).every(k => LAWD[k].every(p => ok.indexOf(roomDeductFromSgg(p[0])) !== -1));
})());
t('서울 외 군지역 판별 예외 없음', (() => {
  let bad = [];
  Object.keys(LAWD).forEach(k => { if(k === '서울특별시') return;
    LAWD[k].forEach(p => { if(isGunArea(p[0]) !== /군$/.test(p[1])) bad.push(p[1]); }); });
  return bad.length === 0;
})());

console.log('\n=== v21.2 드롭다운 동작 ===');
t('시/도 목록 16개 생성', (() => {
  initBuyRegion();
  return (el('buySido').innerHTML.match(/<option/g) || []).length === 17;   // 안내 1 + 16
})(), (el('buySido').innerHTML.match(/<option/g) || []).length);
t('경기 선택 시 시군구 47개', (() => {
  el('buySido').value = '경기도'; onBuySido();
  return (el('buySgg').innerHTML.match(/<option/g) || []).length === LAWD['경기도'].length + 1;
})());
t('세종은 시군구 자동 선택', (() => {
  el('buySido').value = '세종특별자치시'; onBuySido();
  return el('buySgg').value === '36110' && el('zone').value === 'other';
})(), el('buySgg').value + '/' + el('zone').value);
t('안양 동안 선택 → zone=reg · 방공제 4,800', (() => {
  el('buySido').value = '경기도'; onBuySido();
  el('buySgg').value = '41173'; onBuySgg();
  return el('zone').value === 'reg' && el('roomDeduct').value === '4800';
})(), el('zone').value + '/' + el('roomDeduct').value);
t('안양 만안으로 바꾸면 zone=metro로 갱신', (() => {
  el('buySgg').value = '41171'; onBuySgg();
  return el('zone').value === 'metro';
})(), el('zone').value);
t('서울 선택 → 방공제 5,500', (() => {
  el('buySido').value = '서울특별시'; onBuySido();
  el('buySgg').value = '11680'; onBuySgg();
  return el('zone').value === 'reg' && el('roomDeduct').value === '5500';
})(), el('roomDeduct').value);
t('직접 고르기로 덮어쓰면 manual 표시', (() => {
  markZoneManual();
  return el('zone').dataset.manual === '1';
})());
t('시군구 다시 고르면 manual 해제', (() => {
  el('buySgg').value = '11710'; onBuySgg();
  return el('zone').dataset.manual === undefined;
})());
t('토지거래허가 안내가 규제지역에서만', (() => {
  el('buySido').value='서울특별시'; onBuySido(); el('buySgg').value='11680'; onBuySgg();
  const on = el('ltaNote').style.display === 'block';
  el('buySido').value='부산광역시'; onBuySido();
  el('buySgg').value = LAWD['부산광역시'][0][0]; onBuySgg();
  return on && el('ltaNote').style.display === 'none';
})());
t('공유링크에 sgg 파라미터', html.indexOf("p.set('sgg'") !== -1);
t('sgg로 시/도까지 역추적해 복원', html.indexOf("Object.keys(LAWD).find(k => LAWD[k].some(x => x[0] === code))") !== -1);
t('sgg 없는 구버전 링크도 z로 동작', html.indexOf("if(p.has('z')) document.getElementById('zone').value = p.get('z');") !== -1);
t('직접 고르기 토글 라벨 유지', html.indexOf("toggleHintDetail(this,'직접 고르기 ▾'") !== -1);
t('기존 toggleHintDetail 호출 호환', (() => {
  const btn = {textContent:'', nextElementSibling:{classList:{toggle(){return true;}}}};
  toggleHintDetail(btn);
  return btn.textContent === '접기 ▴';
})());

/* ============================================================
   v21.3 신규 커버리지
   ============================================================ */

/* calcCosts용 최소 컨텍스트. 중개보수·취득세만 보려고 대출은 끄고 소득도 비웁니다. */
function baseCtx(){
  return {
    zone:'other', regulated:false, metro:false, roomDeductAmt:0, bankSelfCap:0,
    houseStatus:'none', pyeong:0, pyeongEntered:false, interiorPerPyeong:0, etc:0,
    over85:false, firstTimeTaxCut:false, extraFunding:0, loanChoice:'bank',
    income:0, incomeEntered:false, newlywed:false, newborn:false, multiChild:false,
    childCount:0, dualIncome:false, creditLoan:0, companyLoan:0, sellerFinancing:0,
    manualLoanCap:0, seominCheck:false, noLoan:true, rate:5.4, years:30,
    otherDebtMonthly:0, stressBp:0, mciCovered:false, rateType:'variable', fixedYears:0,
    price:0
  };
}

console.log('\n=== v21.3 ① POLICY 단일 저장소 ===');
t('POLICY 존재', typeof POLICY === 'object' && POLICY !== null);
t('LTV가 규제/수도권 기준을 분리해 담고 있음',
  POLICY.ltv.noneOrDispose.reg === 0.4 && POLICY.ltv.noneOrDispose.other === 0.7 &&
  POLICY.ltv.firstTime.metro === 0.7 && POLICY.ltv.firstTime.other === 0.8 &&
  POLICY.ltv.multi.reg === 0 && POLICY.ltv.multi.other === 0.6);
t('getLTV가 POLICY와 12조합 모두 일치', (() => {
  const cases = [
    ['multi', true,  true,  POLICY.ltv.multi.reg],
    ['multi', false, true,  POLICY.ltv.multi.other],
    ['multi', false, false, POLICY.ltv.multi.other],
    ['first', true,  true,  POLICY.ltv.firstTime.metro],
    ['first', false, true,  POLICY.ltv.firstTime.metro],
    ['first', false, false, POLICY.ltv.firstTime.other],
    ['none',  true,  true,  POLICY.ltv.noneOrDispose.reg],
    ['none',  false, true,  POLICY.ltv.noneOrDispose.other],
    ['none',  false, false, POLICY.ltv.noneOrDispose.other],
    ['oneDisposing', true,  true,  POLICY.ltv.noneOrDispose.reg],
    ['oneDisposing', false, true,  POLICY.ltv.noneOrDispose.other],
    ['oneDisposing', false, false, POLICY.ltv.noneOrDispose.other]
  ];
  return cases.every(c => getLTV(c[0], c[1], c[2]) === c[3]);
})());
t('DSR 40% · DTI 60%가 POLICY에서 옴', DSR_RATIO === POLICY.ratio.dsr && DTI_RATIO === POLICY.ratio.dti
  && DSR_RATIO === 0.40 && DTI_RATIO === 0.60);
t('ROOM_DEDUCT_DEFAULT가 POLICY 참조', ROOM_DEDUCT_DEFAULT === POLICY.roomDeduct);
t('방공제 4단 기본값 유지', POLICY.roomDeduct.reg === 5500 && POLICY.roomDeduct.metro === 4800
  && POLICY.roomDeduct.other === 2800 && POLICY.roomDeduct.fallbackWon === 28000000);
t('구간한도 6/4/2억 · 경계 15억·25억', (() => {
  const at = p => (POLICY.bandCap.find(b => p <= b.upTo) || {}).cap;
  return at(1500000000) === 600000000 && at(1500000001) === 400000000
      && at(2500000000) === 400000000 && at(2500000001) === 200000000;
})());
t('서민·실수요자 상한 9천만·9억·LTV 60%',
  POLICY.seomin.incomeCap === 90000000 && POLICY.seomin.priceCap === 900000000 && POLICY.seomin.ltv === 0.6);
t('전용률 2.45 (÷3.3058 아님)', POLICY.area.pyeongToM2 === 2.45);
t('계산식에 2.45 리터럴이 남아 있지 않음 (선언·주석 제외)',
  (js.match(/[*\/]\s*2\.45/g) || []).length === 0, (js.match(/[*\/]\s*2\.45/g)||[]).join(','));

console.log('\n=== v21.3 ② 취득세 · 중개보수 (POLICY 이관 후 값 불변) ===');
t('취득세 6억 이하 1%', acquisitionTaxRate(500000000, 'none', false) === 0.01);
t('취득세 9억 초과 3%', acquisitionTaxRate(1000000000, 'none', false) === 0.03);
t('취득세 7.5억 = 2% (선형구간 중앙)',
  Math.abs(acquisitionTaxRate(750000000, 'none', false) - 0.02) < 1e-9,
  acquisitionTaxRate(750000000, 'none', false));
t('다주택 규제지역 12% · 비규제 8%',
  acquisitionTaxRate(800000000, 'multi', true) === 0.12 &&
  acquisitionTaxRate(800000000, 'multi', false) === 0.08);
t('중개보수 4.5천만 → 상한 25만에 걸림 + VAT', (() => {
  const c = calcCosts(Object.assign(baseCtx(), {price: 45000000}));   // 0.6% = 27만 > 상한 25만
  return Math.round(c.brokerFee) === Math.round(250000 * 1.1);
})(), Math.round(calcCosts(Object.assign(baseCtx(), {price: 45000000})).brokerFee));
t('중개보수 1.9억 → 상한 80만에 걸림 + VAT', (() => {
  const c = calcCosts(Object.assign(baseCtx(), {price: 190000000}));  // 0.5% = 95만 > 상한 80만
  return Math.round(c.brokerFee) === Math.round(800000 * 1.1);
})(), Math.round(calcCosts(Object.assign(baseCtx(), {price: 190000000})).brokerFee));
t('중개보수 1억 → 상한 미도달, 요율 그대로', (() => {
  const c = calcCosts(Object.assign(baseCtx(), {price: 100000000}));
  return Math.round(c.brokerFee) === Math.round(500000 * 1.1);
})());
t('중개보수 15억 이상 0.7% + VAT', (() => {
  const c = calcCosts(Object.assign(baseCtx(), {price: 1500000000}));
  return Math.round(c.brokerFee) === Math.round(1500000000 * 0.007 * 1.1);
})());
t('중개보수에 VAT가 빠지지 않음', POLICY.broker.vat === 1.1);

console.log('\n=== v21.3 ③ 매매 탭 실거래가 연동 ===');
['buySiseBox','buySiseLoadBtn','buySiseStatus','buySiseAptWrap','buySiseAptFilter',
 'buySiseApt','buySiseAreaWrap','buySiseArea','buySiseResult','buySiseSource',
 'buySiseHintAuto','buySiseSggEcho'].forEach(id => t('id=' + id, ids.indexOf(id) !== -1));
t('매매 탭은 시/도·시군구를 새로 만들지 않고 #buySgg 재사용', SISE_UI.buy.sgg === 'buySgg');
t('전월세 채움 대상은 rentMarket, 매매는 price',
  SISE_UI.rent.targetEok === 'rentMarketEok' && SISE_UI.buy.targetEok === 'priceEok');
t('보조 버튼 방향이 탭별로 반대 (원칙 28)',
  SISE_UI.rent.altKey === 'min' && SISE_UI.buy.altKey === 'max');
t('탭별 상태가 분리돼 있음', (() => {
  siseState.rent.selected = {tag:'r'};
  siseState.buy.selected  = {tag:'b'};
  return siseState.rent.selected.tag === 'r' && siseState.buy.selected.tag === 'b';
})());
t('전역 siseGroups/siseSelected 제거됨',
  js.indexOf('let siseGroups') === -1 && js.indexOf('let siseSelected') === -1);
t('resetSiseResult(buy)가 매매 쪽만 비움', (() => {
  siseState.rent.groups = {x:1}; siseState.buy.groups = {y:1};
  resetSiseResult('buy');
  return siseState.rent.groups !== null && siseState.buy.groups === null;
})());
t('인자 없이 부르면 전월세 컨텍스트 (구버전 호출 호환)', (() => {
  siseState.rent.groups = {x:1};
  resetSiseResult();
  return siseState.rent.groups === null;
})());
t('siseCtx가 잘못된 키를 rent로 흡수', siseCtx('nope') === 'rent' && siseCtx('buy') === 'buy');
t('syncBuySise가 시군구 없으면 버튼 비활성', (() => {
  el('buySgg').value = '';
  syncBuySise();
  return el('buySiseLoadBtn').disabled === true;
})());
t('syncBuySise가 시군구 있으면 버튼 활성', (() => {
  el('buySido').value = '서울특별시'; onBuySido();
  el('buySgg').value = '11680'; onBuySgg();
  return el('buySiseLoadBtn').disabled === false;
})());
t('지역을 바꾸면 이전 단지 목록이 비워짐 (원칙 30)', (() => {
  siseState.buy.groups = {stale:true};
  el('buySgg').value = '11710'; onBuySgg();
  return siseState.buy.groups === null;
})());
t('매매 시세 직접 수정 시 출처 해제 배선', html.indexOf("clearSiseSource('buy')") !== -1);
t('applySisePrice가 모드 A에서 B로 전환 (원칙 15)',
  js.indexOf("if(k === 'buy' && mode !== 'B'){ setMode('B'); switched = true; }") !== -1);
t('applySisePrice가 max를 지원', js.indexOf("which === 'max' ? sel.max") !== -1);

console.log('\n=== v21.3 ④ 안전카드 ↔ 진단카드 역할 분리 ===');
t('안전카드에서 판단 문구(safety.msg) 제거', js.indexOf('safety-msg') === -1);
t('안전카드 empty 상태 마크업 제거', js.indexOf('safety-card empty') === -1);
t('안전카드에 막대·범례는 남아 있음',
  js.indexOf('safety-bar') !== -1 && js.indexOf('safety-legend') !== -1);
t('진단카드가 판단(safety.msg)을 맡음', js.indexOf('${safety.ratio.toFixed(0)}%</b>예요. ${safety.msg}') !== -1);
t('진단카드가 경매 배당 주의를 흡수', js.indexOf('경매로 넘어가면 <b>집주인 대출이 내 보증금보다 먼저</b>') !== -1);
t('죽은 CSS .result-hero 제거', html.indexOf('result-hero') === -1);
t('죽은 CSS .capture-header 제거', html.indexOf('capture-header') === -1);
t('죽은 CSS .safety-msg/.safety-foot 제거',
  html.indexOf('.safety-msg') === -1 && html.indexOf('.safety-foot') === -1);

console.log('\n=== v21.3 ⑤ Google Analytics ===');
t('GA 스니펫 존재', html.indexOf('googletagmanager.com/gtag/js') !== -1);
t('측정 ID 미설정이면 로드하지 않음', html.indexOf("window.GA_ID.indexOf('G-X') === 0") !== -1);
t('track()이 메인 스크립트 블록에 있음 (테스트 하네스 스코프)', typeof track === 'function');
t('gtag 없어도 track()이 던지지 않음', (() => { try{ track('x', {a:1}); return true; } catch(e){ return false; } })());
t('금액·소득을 이벤트로 보내지 않음', (() => {
  const bad = ['price:', 'income:', 'cash:', 'deposit:'];
  const calls = js.match(/track\([^)]*\)/g) || [];
  return !calls.some(c => bad.some(b => c.indexOf(b) !== -1));
})());
t('이탈 지점 이벤트 존재', js.indexOf("track('calc_blocked'") !== -1);

console.log('\n=== v21.3 타이포·여백 스케일 ===');
(() => {
  const css = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
  const SCALE = [11,12,13,14,15,16,17,19,22,26,31];
  const sizes = [...css.matchAll(/font-size:([0-9.]+)px/g)].map(m => parseFloat(m[1]));
  const off = [...new Set(sizes.filter(v => SCALE.indexOf(v) === -1))];
  t('글자 크기가 스케일 안에만 존재', off.length === 0, off.join(','));
  t('0.5px 단위 글자 크기 없음', !/font-size:[0-9]+\.5px/.test(html), (html.match(/font-size:[0-9]+\.5px/g)||[]).join(','));

  // iOS Safari는 16px 미만 폼 컨트롤에 포커스하면 화면을 확대해요
  const isControl = sel => sel.split(',').some(part => {
    const last = part.trim().split(/\s+/).pop() || '';
    return /^(input|select|textarea)([.\[:#]|$)/.test(last);   // .input-suffix span 같은 건 제외
  });
  const formRules = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter(m => isControl(m[1]));
  const tooSmall = formRules.filter(m => {
    const fs = /font-size:([0-9.]+)px/.exec(m[2]);
    return fs && parseFloat(fs[1]) < 16;
  }).map(m => m[1].trim().slice(0, 40));
  t('폼 컨트롤 글자 16px 이상 (iOS 확대 방지)', tooSmall.length === 0, tooSmall.join(' | '));

  const lh = [...new Set([...css.matchAll(/line-height:([0-9.]+)(?![0-9a-z%])/g)].map(m => m[1]))];
  t('행간 4단계 이내', lh.length <= 4, lh.join(','));

  t('본문에 px 음수 자간 없음', !/letter-spacing:-[0-9.]+px/.test(css),
    (css.match(/letter-spacing:-[0-9.]+px/g)||[]).join(','));
  t('자간은 em 단위로만', [...css.matchAll(/letter-spacing:([^;]+);/g)].every(m => /em$/.test(m[1].trim())));

  const RD = [6,8,10,12,16,20];
  const radii = [...new Set([...css.matchAll(/border-radius:([0-9.]+)px/g)].map(m => parseFloat(m[1])))];
  t('모서리 반경이 스케일 안에만 존재', radii.every(v => RD.indexOf(v) !== -1), radii.join(','));

  t('스케일이 :root에 문서화됨', css.indexOf('타이포·여백 스케일') !== -1);
})();

/* ============================================================
   v21.5 — 04 섹션 정리 · 실패 원인 분기 · 색 통일 · 출처 접기
   ============================================================ */
console.log('\n=== v21.5 ① 04 섹션에서 지운 것 (원칙 37) ===');
/* 이 블록은 "있어야 할 게 있는가"가 아니라 "이건 이제 없는가"를 봅니다.
   지운 문구가 다음 세션에 슬그머니 되살아나는 걸 막는 게 목적이에요. */
t('중복 안내 삭제 — zoneBadge가 대신함',
  html.indexOf('시·군·구만 고르면 규제지역 여부와 방공제가 자동으로 정해져요') === -1);
t('버튼을 설명하는 문장 삭제',
  html.indexOf('목록에 없거나 다르게 계산하고 싶으면') === -1);
t('04 도입문에서 결과화면 안내 삭제',
  html.indexOf('나머지는 일반적인 기준으로 먼저 계산하고') === -1);
t('방공제 경고는 삭제가 아니라 접기 안으로 이동 (원칙 28)',
  html.indexOf('인천 영종·검단 일부와 통합 전 광주광역시') !== -1);
t('방공제 경고가 hint-detail 안에 있음', (() => {
  const m = html.match(/<div class="hint-detail">[\s\S]*?<\/div>/g) || [];
  return m.some(b => b.indexOf('인천 영종·검단 일부와') !== -1);
})());
t('토지거래허가 중복 문장 삭제',
  html.indexOf('세입자 보증금을 뺀 금액만 준비하면 되는 구조가 성립하지 않아요') === -1);
t('토지거래허가 핵심(2년 실거주 의무)은 남아 있음',
  html.indexOf('2년 실거주 의무') !== -1);
(() => {
  /* 입력 라벨이 아니라 "설명문"만 셉니다. 접힌 것(hint-detail)은 화면을 무겁게 하지 않으니 뺍니다.
     v21.3에서 이 값이 555자였습니다. 다시 불어나면 여기서 걸립니다. */
  const sec = html.slice(html.indexOf('<div class="ask-num">04</div>'),
                         html.indexOf('id="topSectionToggle"'));
  const noDetail = sec.replace(/<div class="hint-detail">[\s\S]*?<\/div>/g, '');
  const blocks = noDetail.match(
    /<div class="ask-sub"[^>]*>[\s\S]*?<\/div>|<div class="hint"[^>]*>[\s\S]*?<\/div>|<div class="fallback-note"[^>]*>[\s\S]*?<\/div>/g) || [];
  const n = blocks.reduce((s, b) =>
    s + b.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().length, 0);
  t('04 설명문 총량이 320자 이하 (v21.3은 555자)', n <= 320, n + '자');
})();

console.log('\n=== v21.5 ② 토지거래허가 안내 노출 조건 (원칙 39) ===');
t('첫 로드에는 안 뜸 (지역 미확정)', (() => {
  el('zone').value = 'reg';
  delete el('zone').dataset.manual;
  el('buySgg').value = '';
  syncLtaNote();
  return el('ltaNote').style.display === 'none';
})(), el('ltaNote').style.display);
t('시군구를 고르면 뜸', (() => {
  el('buySido').value = '서울특별시'; onBuySido();
  el('buySgg').value = '11680'; onBuySgg();
  return el('ltaNote').style.display === 'block';
})());
t('직접 규제지역으로 고른 경우에도 뜸', (() => {
  el('buySgg').value = '';
  el('zone').value = 'reg';
  markZoneManual(); syncLtaNote();
  return el('ltaNote').style.display === 'block';
})());
t('비규제로 바꾸면 사라짐', (() => {
  el('zone').value = 'other';
  markZoneManual(); syncLtaNote();
  return el('ltaNote').style.display === 'none';
})());

console.log('\n=== v21.5 ③ 실거래 실패 원인 분기 (원칙 39) ===');
t('확인 안 된 원인을 단정하지 않음',
  html.indexOf('국토교통부 서버가 일시적으로 느릴 수 있어요') === -1);
t('file:// 은 요청 전에 걸러짐',
  html.indexOf("location.protocol !== 'http:'") !== -1 &&
  html.indexOf("reason: 'no_api_local'") !== -1);
t('no_api → Vercel 주소 안내', siseFailMsg('no_api', {}).indexOf('noah-choi.vercel.app') !== -1);
t('api_error → 도달했음을 아는 경우만 서버 언급',
  siseFailMsg('api_error', {}).indexOf('국토교통부') !== -1);
t('timeout → 초 단위로 안내',
  siseFailMsg('timeout', {}).indexOf('20초') !== -1, siseFailMsg('timeout', {}));
t('unknown → 원인을 모른다고 말함',
  siseFailMsg('unknown', {}).indexOf('원인은 확인되지 않았어요') !== -1);
t('unknown이 국토부를 탓하지 않음',
  siseFailMsg('unknown', {}).indexOf('국토교통부') === -1);
t('reason 분류 — NO_API', siseFailReason({code:'NO_API'}) === 'no_api');
t('reason 분류 — API_ERROR', siseFailReason({code:'API_ERROR'}) === 'api_error');
t('reason 분류 — 타임아웃', siseFailReason({name:'AbortError'}) === 'timeout');
t('reason 분류 — 미상', siseFailReason({}) === 'unknown');
t('reason 분류 — 인자 없어도 안 던짐', siseFailReason() === 'unknown');

console.log('\n=== v21.5 ④ 출처 접기 · 02↔04 동선 ===');
t('출처 표가 접힌 영역 안에 있음',
  html.indexOf('<div id="sourcesDetail" class="optional-section">') !== -1);
t('toggleOptionalSection이 대상 id를 받음',
  html.indexOf("toggleOptionalSection(this,'sourcesDetail')") !== -1);
t('인자 없이 부르면 기존 동작 유지', (() => {
  const btn = {classList:{toggle(){return true;}}};
  toggleOptionalSection(btn);
  return true;
})());
t('출처 개수·확인일은 접기 밖에 남음',
  html.indexOf('모두 2026.08에 확인했어요') !== -1);
t('출처 주석 글자 13px 이상 (원칙 25)',
  html.indexOf('.sources-note{margin-top:12px;font-size:13px') !== -1);
t('02에 실거래 진입점 있음', html.indexOf('onclick="goToBuySise()"') !== -1);
t('goToBuySise가 실거래 박스로 이동', (() => {
  let hit = false;
  const box = el('buySiseBox');
  box.scrollIntoView = () => { hit = true; };
  goToBuySise();
  return hit;
})());
t('진입점이 새 CSS 클래스를 만들지 않음',
  html.indexOf('goToBuySise()">실거래가로 채우기') !== -1 &&
  html.indexOf('class="hint-toggle" onclick="goToBuySise()"') !== -1);

console.log('\n=== v21.5 ⑤ 버튼 서브라벨 말투 (원칙 9) ===');
(() => {
  /* 01의 두 개만 물음표로 끝나 있었어요. 01의 질문이 이미 "무엇이 궁금하세요?"라서
     답으로 고르는 버튼 안에 질문이 또 들어간 구조였습니다.
     히어로 <h1>은 헤드라인 목소리라 대상이 아닙니다(여기서는 span 안을 안 봄). */
  const subs = [...html.matchAll(/<b>[^<]*<\/b><span>([^<]*)<\/span>/g)].map(m => m[1].trim());
  const q = subs.filter(s => s.endsWith('?'));
  t('서브라벨이 물음표로 끝나지 않음', q.length === 0, q.join(' | '));
  t('서브라벨 16개를 모두 검사함', subs.length >= 16, subs.length + '개');
})();
/* v21.9 교체(원칙 48): 결과 히어로가 "(예상)"이라고 적는데 그걸 고르는 01에서는
   확정된 값처럼 말하고 있었어요(원칙 44). 문구 자체가 아니라 그 목적을 검사합니다. */
t('01 A모드 부제가 추정치임을 밝힘',
  /<span>살 수 있는 예상 최대 집값<\/span>/.test(html));
t('01 B모드 부제가 추정치임을 밝힘',
  /<span>그 집에 필요한 예상 현금<\/span>/.test(html));
t('결과 히어로와 말이 어긋나지 않음',
  html.indexOf('최대 구매 가능 매매가 (예상)') !== -1 && html.indexOf("'필요한 내 돈 (예상)'") !== -1);
t('히어로 헤드라인은 그대로', html.indexOf('나 살 수 있어?') !== -1);

console.log('\n=== v21.6 고급설정 총량 상한 (원칙 43) ===');
(() => {
  /* 04와 같은 방식입니다(v21.5 문서 5장). 접힌 것(hint-detail)은 화면을 무겁게 하지
     않으니 뺍니다. 다만 hint-detail 안에 <div>가 중첩된 곳이 있어서 04에서 쓴
     비탐욕 정규식으로는 못 지웁니다. 여는/닫는 태그를 세서 잘라냅니다. */
  function stripBalanced(src, openTag) {
    let out = '', i = 0;
    for (;;) {
      const a = src.indexOf(openTag, i);
      if (a === -1) { out += src.slice(i); break; }
      out += src.slice(i, a);
      let j = src.indexOf('>', a) + 1, depth = 1;
      while (depth > 0 && j < src.length) {
        const nd = src.indexOf('<div', j), cd = src.indexOf('</div>', j);
        if (cd === -1) break;
        if (nd !== -1 && nd < cd) { depth++; j = nd + 4; } else { depth--; j = cd + 6; }
      }
      i = j;
    }
    return out;
  }
  const sec = html.slice(html.indexOf('<div id="optionalSection"'),
                         html.indexOf('<div class="cta-lead">'));
  const noDetail = stripBalanced(sec, '<div class="hint-detail"');
  const blocks = noDetail.match(/<div class="hint"[^>]*>[\s\S]*?<\/div>/g) || [];
  const texts = blocks.map(b => b.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
  const n = texts.reduce((a, b) => a + b.length, 0);
  const long = texts.filter(x => x.length > 100);

  t('고급설정 노출 설명문 총량이 600자 이하 (v21.5는 1,488자)', n <= 600, n + '자');
  t('100자 넘는 노출 문단이 없음 (v21.5는 5개)', long.length === 0, long.length + '개');
  t('설명 문단 개수 자체도 줄었음 (v21.5는 21개)', blocks.length <= 19, blocks.length + '개');

  /* 접기지 삭제가 아닙니다(원칙 28·37). 접힌 문장이 사라지면 여기서 걸립니다. */
  const kept = [
    '만기의 70% 이상 고정이면',
    '대출만기 대비 비중으로 스트레스 금리 구간이',
    '전용면적을 자동 환산해서',
    '보금자리론은 1주택자도 신청할 수 있어요',
    '정책대출이라고 항상 금리가 낮지는 않아요',
    '순자산',
    '1자녀 9천만원, 2자녀 이상 1억원',
    '맞벌이는 부부 각자의 소득도 1.3억원 이하',
    'DSR에 합산돼서 새 대출한도가 줄어요',
    '은행연합회 공시(2026.06.30) 표에 따라',
    '세입자 최우선변제금만큼',
    '규제지역 경계와 이 구분은 달라서',
    'KB국민은행은 2026.7.10부터',
    '기본은 도배·장판 위주',
    '평수·이사 거리에 따라'
  ];
  const lost = kept.filter(k => sec.indexOf(k) === -1);
  t('접힌 문장이 지워지지 않고 남아 있음 (원칙 28·37)', lost.length === 0, lost.join(' | '));

  /* 새 CSS를 만들지 말고 기존 것을 재사용하기로 했습니다. */
  const toggles = (sec.match(/class="hint-toggle"/g) || []).length;
  const details = (sec.match(/<div class="hint-detail"/g) || []).length;
  t('접기는 기존 hint-toggle/hint-detail만 씀', toggles >= 12 && toggles === details,
    'toggle ' + toggles + ' / detail ' + details);
  t('고급설정용 새 CSS 클래스를 만들지 않음',
    html.indexOf('.hint-collapsed') === -1 && html.indexOf('.adv-hint') === -1);
})();

console.log('\n=== v21.6 그룹 경계 · 금리 힌트 ===');
t('소제목이 구분선으로 승격됨',
  html.indexOf('#optionalSection .subsection-label{') !== -1 &&
  html.slice(html.indexOf('#optionalSection .subsection-label{'),
             html.indexOf('#optionalSection .subsection-label{') + 200)
      .indexOf('border-top:1px solid var(--border)') !== -1);
/* v21.9 교체(원칙 48): 선택자 문자열이 아니라 "첫 소제목만 구분선이 없다"는 목적을 검사합니다.
   ㊸에서 감춤용 래퍼가 생기면서 선택자가 바뀌었는데, 규칙 자체는 그대로 살아 있어야 해요. */
t('첫 소제목에는 구분선이 없음',
  /#optionalSection[^{]*:first-child[^{]*\{[^}]*border-top:\s*none/.test(html));
t('두 번째 소제목까지 구분선이 지워지지는 않음 (래퍼가 생겨도)',
  /#optionalSection\s*>\s*div:first-child\s*>\s*\.subsection-label:first-child/.test(html)
  || !/id="loanChoiceGroup"/.test(html));
t('구분선이 고급설정 밖(출처 접기 등)에는 안 걸림',
  html.indexOf('.optional-section .subsection-label{') === -1);
t('여백이 스케일 안의 값 (24 / 16 / 12)',
  /#optionalSection \.subsection-label\{[\s\S]{0,200}margin-top:24px;[\s\S]{0,80}padding:16px 0 12px;/.test(html));
t('금리 힌트도 같은 규칙을 따름 (첫 문장만 노출)',
  html.indexOf('`<b>두 숫자가 다른 걸 재고 있어요.</b>`') !== -1);
t('금리 힌트의 나머지가 hint-detail 안으로 들어감',
  html.indexOf('+ `<div class="hint-detail">`') !== -1);
t('금리 힌트 내용은 그대로 남아 있음',
  html.indexOf('실제로 나간 대출의 평균이에요') !== -1 &&
  html.indexOf('시장 평균이 아니에요') !== -1);
(() => {
  /* 금리 힌트는 JS가 그립니다. toggleHintDetail은 nextElementSibling을 봐요.
     버튼 바로 다음이 hint-detail이어야 합니다. */
  const i = html.indexOf('두 숫자가 다른 걸 재고 있어요');
  const seg = html.slice(i, i + 400);
  t('버튼 바로 다음 형제가 hint-detail임',
    seg.indexOf('hint-toggle') < seg.indexOf('hint-detail'));
})();

console.log('\n=== v21.7 ㊳ 대출 없이 계산하는 진입점 (원칙 15) ===');
(() => {
  const iCheck = html.indexOf('id="noLoanCheck"');
  const iOpt   = html.indexOf('<div id="optionalSection"');
  const iAsk04 = html.indexOf('<div class="ask-num">04</div>');
  t('noLoanCheck가 고급설정보다 위에 있음', iCheck > 0 && iCheck < iOpt, iCheck + ' < ' + iOpt);
  t('noLoanCheck가 02 카드 안(04보다 위)에 있음', iCheck < iAsk04, iCheck + ' < ' + iAsk04);
  t('체크박스를 복제하지 않음 (하나만 존재)',
    (html.match(/id="noLoanCheck"/g) || []).length === 1);
  t('옮기면서 새 CSS 클래스를 만들지 않음 (기존 checkrow 재사용)',
    html.indexOf('.no-loan-row') === -1 && html.indexOf('class="checkrow"') !== -1);
  t('toggleNoLoan 동작은 그대로', (() => {
    el('noLoanCheck').checked = true; toggleNoLoan();
    const off = el('manualLoanCapEok').disabled === true;
    el('noLoanCheck').checked = false; toggleNoLoan();
    return off && el('manualLoanCapEok').disabled === false;
  })());
})();

console.log('\n=== v21.7 ㊱·㊶ 실거래 박스 노출 조건 ===');
(() => {
  const setLoc = (proto, host) => { global.location = { protocol:proto, hostname:host, search:'', href:'' }; };
  const boxShown = () => el('buySiseBox').style.display !== 'none';
  const noApiShown = () => el('buySiseNoApi').style.display === 'block';

  t('박스가 마크업에서 기본 숨김',
    html.indexOf('id="buySiseBox" style="display:none;') !== -1);

  setLoc('https:', 'noah-choi.vercel.app');
  t('Vercel은 조회 가능으로 판정', siseApiAvailable() === true);
  setLoc('https:', 'thekpulse.github.io');
  t('GitHub Pages는 조회 불가로 판정 (서버리스 함수 없음)', siseApiAvailable() === false);
  setLoc('file:', '');
  t('file://도 조회 불가로 판정', siseApiAvailable() === false);

  /* 0장 C의 노출 조건 표 4줄을 그대로 옮긴 검사입니다. */
  setLoc('https:', 'noah-choi.vercel.app');
  setMode('B');
  t('B모드·Vercel — 박스 노출', boxShown() && !noApiShown());
  setMode('A');
  t('A모드·Vercel — 숨김 (채울 매매가 칸이 없음)', !boxShown() && !noApiShown());

  setLoc('https:', 'thekpulse.github.io');
  setMode('B');
  t('B모드·Pages — 박스 숨김, 안내는 유지', !boxShown() && noApiShown());
  t('안내가 Vercel 주소를 알려줌',
    el('buySiseNoApi').innerHTML.indexOf('noah-choi.vercel.app') !== -1);
  setMode('A');
  t('A모드·Pages — 둘 다 숨김', !boxShown() && !noApiShown());

  t('02의 진입점도 같은 조건으로 감춰짐', el('buySiseHintRow').style.display === 'none');

  /* 원칙 30·42 — 모드가 바뀌면 이전에 불러온 값이 남지 않아야 합니다. */
  setLoc('https:', 'noah-choi.vercel.app');
  setMode('B');
  siseState.buy.groups = {y:1}; siseState.buy.selected = {tag:'b'};
  siseState.rent.groups = {x:1};
  el('buySiseSource').innerHTML = '<div class="sise-src">✓ 예전 단지</div>';
  setMode('A');
  t('B→A 전환이 매매 실거래 상태를 비움',
    siseState.buy.groups === null && siseState.buy.selected === null);
  t('B→A 전환이 출처 표시도 지움', el('buySiseSource').innerHTML === '');
  t('전월세 쪽 상태는 건드리지 않음', siseState.rent.groups !== null);
  setMode('A');
})();

console.log('\n=== v21.7 ㊵ 출처 접기 하단 버튼 ===');
(() => {
  const i0 = html.indexOf('<div id="sourcesDetail"');
  const i1 = html.indexOf('<div class="sources-note">표시된 확인 시점');
  const sec = html.slice(i0, i1);
  t('접힌 영역 안에 하단 접기 버튼이 있음',
    sec.indexOf("toggleOptionalSection(document.getElementById('sourcesToggle'),'sourcesDetail')") !== -1);
  t('하단 버튼이 표 뒤에 있음',
    sec.indexOf('</table>') < sec.lastIndexOf('section-toggle'));
  t('고급설정과 같은 클래스를 재사용 (새 CSS 없음)',
    sec.indexOf('class="section-toggle"') !== -1 && html.indexOf('.sources-collapse') === -1);
  t('위쪽 버튼은 그대로 남음', html.indexOf('id="sourcesToggle"') !== -1);
})();

console.log('\n=== v21.8 ㉘ 정책 수치 단일 출처 (원칙 33·46) ===');
(() => {
  /* 목적: 화면에 보이는 정책대출 요건 숫자와, 자격을 판정하는 숫자가 갈라지지 않는다.
     표현이 아니라 그 목적을 잠급니다(원칙 48). */
  const i0 = html.indexOf('const POLICY_DEFS = {');
  const i1 = html.indexOf('const BABY_RATE_TABLE');
  const defsSrc = html.slice(i0, i1);
  t('POLICY_DEFS 안에 원 단위 숫자 리터럴이 없음',
    !/\d{8,}/.test(defsSrc), (defsSrc.match(/\d{8,}/g) || []).join(','));
  t('POLICY_DEFS가 POLICY.policyLoan을 참조함',
    defsSrc.indexOf('POLICY.policyLoan.didimdol') !== -1
    && defsSrc.indexOf('POLICY.policyLoan.didimdolBaby') !== -1
    && defsSrc.indexOf('POLICY.policyLoan.bogeumjari') !== -1);

  const head = html.slice(Math.max(0, html.indexOf('policyLoan: {') - 700), html.indexOf('policyLoan: {'));
  t('policyLoan에 기준·출처·확인일 주석이 붙어 있음(원칙 33)',
    head.indexOf('기준:') !== -1 && head.indexOf('출처:') !== -1 && head.indexOf('확인일:') !== -1);

  // meta에 등장할 수 있는 라벨은 POLICY 값에서만 나온다
  function labelsOf(node, set){
    Object.keys(node).forEach(k => {
      const v = node[k];
      if (typeof v === 'number') {
        if (k === 'areaM2') set.add(v + '㎡');
        else if (v >= 10000) set.add(policyAmount(v));
      } else if (v && typeof v === 'object') labelsOf(v, set);
    });
    return set;
  }
  Object.keys(POLICY.policyLoan).forEach(id => {
    const allowed = labelsOf(POLICY.policyLoan[id], new Set());
    const tokens = POLICY_DEFS[id].meta.match(/[\d,.]+(?:천만원|만원|억|㎡)/g) || [];
    const stray = tokens.filter(x => !allowed.has(x));
    t(id + ' meta의 숫자가 전부 POLICY에서 나옴', tokens.length > 0 && stray.length === 0, stray.join(','));
  });

  // POLICY를 고치면 화면 문구가 실제로 따라오는가 (문자열이 살아 있는지 확인)
  const cases = [
    ['didimdol', () => POLICY.policyLoan.didimdol.income.base, v => POLICY.policyLoan.didimdol.income.base = v, 61000000, '6,100만원'],
    ['didimdolBaby', () => POLICY.policyLoan.didimdolBaby.price.base, v => POLICY.policyLoan.didimdolBaby.price.base = v, 950000000, '9.5억'],
    ['bogeumjari', () => POLICY.policyLoan.bogeumjari.income.multiChild, v => POLICY.policyLoan.bogeumjari.income.multiChild = v, 110000000, '1.1억']
  ];
  cases.forEach(([id, get, set, tmp, label]) => {
    const orig = get();
    try {
      set(tmp);
      t(id + ' meta가 POLICY를 따라 바뀜', POLICY_DEFS[id].meta.indexOf(label) !== -1, POLICY_DEFS[id].meta);
    } finally { set(orig); }
    t(id + ' meta 원복 확인', POLICY_DEFS[id].meta.indexOf(policyAmount(orig)) !== -1);
  });

  // 판정도 같은 값을 본다 (경계 동작)
  const base = {noHouse:true, upToOneHouse:true, firstTime:false, newlywed:false, multiChild:false,
                childCount:0, newborn:false, dualIncome:false, metro:false, income:0, price:0, pyeongM2:60};
  const D = POLICY.policyLoan.didimdol, B = POLICY.policyLoan.didimdolBaby, G = POLICY.policyLoan.bogeumjari;
  t('디딤돌 집값 상한 경계가 POLICY와 일치',
    POLICY_DEFS.didimdol.eligible({...base, income:D.income.base, price:D.price.base})
    && !POLICY_DEFS.didimdol.eligible({...base, income:D.income.base, price:D.price.base + 1}));
  t('디딤돌 신혼 집값 상한 경계가 POLICY와 일치',
    POLICY_DEFS.didimdol.eligible({...base, newlywed:true, income:D.income.newlywed, price:D.price.newlywedOrMultiChild})
    && !POLICY_DEFS.didimdol.eligible({...base, newlywed:true, income:D.income.newlywed, price:D.price.newlywedOrMultiChild + 1}));
  t('디딤돌 소득 상한 경계가 POLICY와 일치',
    POLICY_DEFS.didimdol.eligible({...base, income:D.income.base, price:D.price.base})
    && !POLICY_DEFS.didimdol.eligible({...base, income:D.income.base + 1, price:D.price.base}));
  t('디딤돌 전용면적 경계가 POLICY와 일치',
    POLICY_DEFS.didimdol.eligible({...base, income:D.income.base, price:D.price.base, pyeongM2:D.areaM2})
    && !POLICY_DEFS.didimdol.eligible({...base, income:D.income.base, price:D.price.base, pyeongM2:D.areaM2 + 0.1}));
  t('신생아특례 집값 상한 경계가 POLICY와 일치',
    POLICY_DEFS.didimdolBaby.eligible({...base, newborn:true, income:B.income.base, price:B.price.base})
    && !POLICY_DEFS.didimdolBaby.eligible({...base, newborn:true, income:B.income.base, price:B.price.base + 1}));
  t('신생아특례 맞벌이 소득 경계가 POLICY와 일치',
    POLICY_DEFS.didimdolBaby.eligible({...base, newborn:true, dualIncome:true, income:B.income.dualIncome, price:B.price.base})
    && !POLICY_DEFS.didimdolBaby.eligible({...base, newborn:true, dualIncome:true, income:B.income.dualIncome + 1, price:B.price.base}));
  t('보금자리론 집값 상한 경계가 POLICY와 일치',
    POLICY_DEFS.bogeumjari.eligible({...base, income:G.income.base, price:G.price.base})
    && !POLICY_DEFS.bogeumjari.eligible({...base, income:G.income.base, price:G.price.base + 1}));
  t('보금자리론 다자녀 소득 경계가 POLICY와 일치',
    POLICY_DEFS.bogeumjari.eligible({...base, childCount:2, multiChild:true, income:G.income.multiChild, price:G.price.base})
    && !POLICY_DEFS.bogeumjari.eligible({...base, childCount:2, multiChild:true, income:G.income.multiChild + 1, price:G.price.base}));
  t('상품한도도 POLICY에서 나옴',
    POLICY_DEFS.didimdol.cap({...base}) === D.cap.base
    && POLICY_DEFS.didimdol.cap({...base, firstTime:true}) === D.cap.firstTime
    && POLICY_DEFS.bogeumjari.cap({...base, firstTime:true}) === G.cap.firstTime);

  /* meta가 '생애최초·2자녀'를 한 라벨로 묶어 적고 있어요.
     두 한도가 갈라지면 문장을 쪼개야 하므로 여기서 먼저 막습니다. */
  t('생애최초·2자녀 한도가 같은 값 (한 라벨 표기의 전제)',
    D.income.firstTime === D.income.multiChild, D.income.firstTime + ' / ' + D.income.multiChild);

  // 구간별 대출한도 문장도 POLICY.bandCap에서 조립
  t('구간한도 금액 문구가 POLICY.bandCap에서 나옴',
    bandCapAmounts() === POLICY.bandCap.map(b => policyAmount(b.cap)).join('/'), bandCapAmounts());
  t('구간한도 설명 문장이 POLICY.bandCap에서 나옴',
    BINDING_COPY['구간한도'].why.indexOf(bandCapRanges()) !== -1, bandCapRanges());
  t('구간한도 문구에 하드코딩된 숫자가 남아 있지 않음',
    html.indexOf("meta:'규제지역 LTV·구간별 한도(6억/4억/2억) 적용'") === -1
    && html.indexOf('집값 구간별 상한(15억 이하 6억') === -1);
  (() => {
    const orig = POLICY.bandCap[0].cap;
    try {
      POLICY.bandCap[0].cap = 700000000;
      t('bandCap을 고치면 문구가 따라옴', bandCapAmounts().indexOf('7억') === 0, bandCapAmounts());
    } finally { POLICY.bandCap[0].cap = orig; }
    t('bandCap 원복 확인', bandCapAmounts() === '6억/4억/2억', bandCapAmounts());
  })();

  // 표기 규칙 자체
  t('policyAmount 1억 이상은 억 표기', policyAmount(500000000) === '5억' && policyAmount(130000000) === '1.3억' && policyAmount(511000000) === '5.11억');
  t('policyAmount 1억 미만은 만원 표기', policyAmount(60000000) === '6천만원' && policyAmount(85000000) === '8,500만원');
})();

console.log('\n=== v21.8 ㉙ solveMaxPrice 속성 검사 ===');
(() => {
  /* 정답(정책 수치)을 몰라도 걸 수 있는 검사들입니다.
     cashNeeded(price)는 단조가 아니지만(정책대출→은행 전환 역전),
     "현금이 늘었는데 살 수 있는 집값이 줄어드는" 일은 어떤 경우에도 없어야 해요. */
  const pctx = (over) => Object.assign({
    zone:'other', regulated:false, metro:false, houseStatus:'none', price:0,
    roomDeductAmt:28000000, bankSelfCap:0,
    pyeong:25, pyeongEntered:true, interiorPerPyeong:0, etc:0,
    over85:false, firstTimeTaxCut:false,
    extraFunding:0, loanChoice:'bank',
    income:70000000, incomeEntered:true,
    newlywed:false, newborn:false, multiChild:false, childCount:0, dualIncome:false,
    creditLoan:0, companyLoan:0, sellerFinancing:0,
    manualLoanCap:0, seominCheck:false, noLoan:false,
    rate:4.5, years:30, otherDebtMonthly:0, stressBp:1.5,
    mciCovered:false, rateType:'variable', fixedYears:0
  }, over || {});

  const scenarios = {
    '무주택·비수도권': pctx(),
    '무주택·수도권': pctx({zone:'metro', metro:true}),
    '무주택·규제지역': pctx({zone:'reg', metro:true, regulated:true}),
    '다주택·규제지역': pctx({houseStatus:'multi', zone:'reg', metro:true, regulated:true}),
    '생애최초·디딤돌': pctx({houseStatus:'first', loanChoice:'didimdol', income:60000000, pyeong:24}),
    '보금자리론': pctx({loanChoice:'bogeumjari', income:60000000}),
    '신생아특례': pctx({loanChoice:'didimdolBaby', newborn:true, houseStatus:'first', income:100000000, pyeong:24}),
    '대출 없이 전액 현금': pctx({noLoan:true})
  };

  /* ① 현금이 늘면 최대 매매가는 절대 줄지 않는다
     ③ 돌려준 값보다 비싼데 살 수 있는 가격은 없다 (최댓값성)
     cashNeeded는 정책대출 집값 상한을 넘는 순간 은행 주담대로 바뀌며 역전 구간이 생겨요.
     단순 이분탐색으로 되돌리면 낮은 해에 갇히는데, 실측으로 최대 1.4억까지 과소평가됩니다.
     역전 구간이 어디 있는지 모르니 현금 축을 훑으면서 두 성질을 같이 봅니다. */
  const broken = [], notMax = [];
  const CASH_STEP = 50000000, PROBE = 10000000;
  Object.keys(scenarios).forEach(name => {
    let prev = -1;
    for (let cash = 0; cash <= 1000000000; cash += CASH_STEP) {
      const v = solveMaxPrice(cash, scenarios[name]);
      if (v < prev - 1) broken.push(name + ' @' + (cash / 100000000) + '억');
      prev = v;
      for (let p = Math.ceil((v + 1) / PROBE) * PROBE; p <= 5000000000; p += PROBE) {
        if (calcCosts({...scenarios[name], price: p}).cashNeeded <= cash) {
          notMax.push(name + ' @현금 ' + (cash / 100000000) + '억 → ' + (p / 100000000) + '억도 가능');
          break;
        }
      }
    }
  });
  t('현금이 늘면 최대 매매가가 줄지 않음 (8개 경우 · 5천만원 간격)', broken.length === 0, broken.join(', '));
  t('돌려준 값보다 비싼데 살 수 있는 가격이 없음 (최댓값성)', notMax.length === 0, notMax.slice(0, 3).join(' / '));

  // ② 돌려준 매매가는 실제로 살 수 있는 금액이다 (원칙 28 — 유리한 쪽 오차 금지)
  const infeasible = [];
  Object.keys(scenarios).forEach(name => {
    [150000000, 400000000, 800000000].forEach(cash => {
      const v = solveMaxPrice(cash, scenarios[name]);
      if (v > 0 && calcCosts({...scenarios[name], price: v}).cashNeeded > cash + 1) {
        infeasible.push(name + ' @' + (cash / 100000000) + '억');
      }
    });
  });
  t('돌려준 매매가의 필요현금이 보유현금을 넘지 않음', infeasible.length === 0, infeasible.join(', '));

  // ④ 현금 0이면 0
  t('현금 0이면 최대 매매가 0', Object.keys(scenarios).every(n => solveMaxPrice(0, scenarios[n]) === 0));

  // ⑤ 같은 입력은 같은 결과
  t('같은 입력은 같은 결과',
    solveMaxPrice(400000000, scenarios['무주택·수도권']) === solveMaxPrice(400000000, scenarios['무주택·수도권']));

  // ⑥ 불리한 조건이 결과를 유리하게 만들지 않는다 (v20 LTV 오류 계열의 방어선)
  const pairs = [
    ['규제지역이 비규제보다 크지 않음', pctx({zone:'reg', metro:true, regulated:true}), pctx()],
    ['다주택이 무주택보다 크지 않음', pctx({houseStatus:'multi'}), pctx({houseStatus:'none'})],
    ['기타부채가 늘면 커지지 않음', pctx({otherDebtMonthly:1000000}), pctx()],
    ['대출 없이는 대출보다 크지 않음', pctx({noLoan:true}), pctx()],
    ['소득이 낮으면 커지지 않음', pctx({income:40000000}), pctx({income:120000000})],
    ['스트레스 금리가 높으면 커지지 않음', pctx({stressBp:3.0}), pctx({stressBp:0.75})]
  ];
  pairs.forEach(([name, worse, better]) => {
    const bad = [100000000, 400000000, 900000000].filter(cash =>
      solveMaxPrice(cash, worse) > solveMaxPrice(cash, better) + 1);
    t(name, bad.length === 0, bad.map(c => (c / 100000000) + '억').join(', '));
  });
})();

console.log('\n=== v21.9 ㊷ 대출 없이 계산할 때 비교카드 ===');
(() => {
  /* 목적: 히어로가 '주담대 0원'인 화면에 대출 금액을 나란히 보여주지 않는다. */
  const ctx = {
    zone:'reg', regulated:true, metro:true, houseStatus:'first', price:500000000,
    roomDeductAmt:55000000, bankSelfCap:0, pyeong:25, pyeongEntered:true,
    interiorPerPyeong:0, etc:0, over85:false, firstTimeTaxCut:false,
    extraFunding:0, loanChoice:'bank', income:70000000, incomeEntered:true,
    newlywed:false, newborn:false, multiChild:false, childCount:0, dualIncome:false,
    creditLoan:0, companyLoan:0, sellerFinancing:0, manualLoanCap:0, seominCheck:false,
    noLoan:false, rate:5.4, years:30, otherDebtMonthly:0, stressBp:3.0,
    mciCovered:false, rateType:'variable', fixedYears:0
  };

  renderCompare({...ctx, noLoan:false}, 500000000);
  const shownRows = el('compareRows').innerHTML;
  t('대출을 받는 경우엔 카드가 그대로 나옴', el('compareCard').style.display === 'block');
  t('세 가지 보유 상황이 모두 나옴', (shownRows.match(/cmp-row/g) || []).length === 3);
  t('카드는 은행 주담대 기준으로 계산함', shownRows.indexOf('대출 0원') === -1, shownRows.slice(0, 120));

  renderCompare({...ctx, noLoan:true}, 500000000);
  t('대출 없이 계산하면 카드를 감춤', el('compareCard').style.display === 'none');
  t('감출 때 이전 내용도 비움 (원칙 30)', el('compareRows').innerHTML === '', el('compareRows').innerHTML);

  renderCompare({...ctx, noLoan:false}, 500000000);
  t('체크를 다시 풀면 카드가 되살아남',
    el('compareCard').style.display === 'block' && el('compareRows').innerHTML !== '');
})();

console.log('\n=== v21.9 ㊸ 대출 없이 계산할 때 입력칸 ===');
(() => {
  /* 목적: 대출이 없으면 대출에만 쓰이는 칸을 보여주지 않는다.
     단 결과에 실제로 반영되는 칸(평형·추가 자금원)은 남는다. */
  t('감출 대상이 컨테이너로 묶여 있음',
    html.indexOf('id="loanCondGroup"') !== -1 && html.indexOf('id="loanChoiceGroup"') !== -1);
  t('감출 컨테이너를 새 CSS 클래스 없이 처리함',
    html.indexOf('.loan-cond-group') === -1 && html.indexOf('.loan-choice-group') === -1);

  const noLoan = el('noLoanCheck');
  noLoan.checked = true;  toggleNoLoan();
  t('대출 조건 묶음을 감춤', el('loanCondGroup').style.display === 'none');
  t('고를 수 있는 대출 묶음을 감춤', el('loanChoiceGroup').style.display === 'none');

  noLoan.checked = false; toggleNoLoan();
  t('체크를 풀면 대출 조건이 돌아옴', el('loanCondGroup').style.display === '');
  t('체크를 풀면 대출 선택이 돌아옴', el('loanChoiceGroup').style.display === '');

  // 결과에 반영되는 칸은 감추지 않는다
  const optSrc = html.slice(html.indexOf('id="optionalSection"'), html.indexOf('id="loanChoiceGroup"'));
  t('평형은 감춤 묶음 밖에 있음 (인테리어비에 쓰임)',
    optSrc.indexOf('id="pyeong"') !== -1 && optSrc.indexOf('/loanCondGroup') < optSrc.indexOf('id="pyeong"'));
  const afterSrc = html.slice(html.indexOf('/loanChoiceGroup'), html.indexOf('subsection-label">입주 준비 비용'));
  t('회사 사내대출은 감춤 묶음 밖에 있음 (조달자금에 쓰임)', afterSrc.indexOf('id="companyLoanEok"') !== -1);
  t('매도인 근저당도 감춤 묶음 밖에 있음', afterSrc.indexOf('id="sellerFinancingEok"') !== -1);

  // 가정 바에서도 안 쓴 조건을 빼는가
  const base = {zone:'reg', houseStatus:'first', rate:5.4, years:30, rateType:'variable',
                stressBp:3.0, mciCovered:false, pyeong:25, noLoan:false};
  renderAssumptions({...base, noLoan:false});
  const withLoan = el('assumpBar').innerHTML;
  renderAssumptions({...base, noLoan:true});
  const without = el('assumpBar').innerHTML;
  t('대출을 받으면 금리·기간이 가정 바에 남음',
    withLoan.indexOf('금리 5.4%') !== -1 && withLoan.indexOf('30년') !== -1);
  t('대출이 없으면 금리·기간을 빼고 그 사실을 적음',
    without.indexOf('금리') === -1 && without.indexOf('스트레스') === -1
    && without.indexOf('대출 없이 전액 현금') !== -1, without);
  t('대출이 없어도 지역·보유상황은 남음',
    without.indexOf('규제지역') !== -1 && without.indexOf('생애최초') !== -1, without);
})();

console.log('\n=== v21.9 ㉛ 규제지역 판정 기준일 ===');
(() => {
  /* 목적: 자동으로 내린 규제지역 판정에는 "언제 기준인지"가 화면에 함께 보인다. */
  const badge = el('zoneBadge'), sgg = el('buySgg'), zone = el('zone');
  const asOf = LAST_VERIFIED.replace(/-/g, '.');

  sgg.value = ''; zone.value = 'reg'; delete zone.dataset.manual;
  renderZoneBadge();
  t('시·군·구를 고르기 전에는 기준일을 붙이지 않음', badge.innerHTML.indexOf(asOf) === -1);

  sgg.value = '11680'; sgg.selectedOptions = [{textContent:'서울 강남구'}];
  zone.value = 'reg'; delete zone.dataset.manual; el('roomDeduct').value = '';
  renderZoneBadge();
  t('자동 판정에는 기준일이 함께 나옴', badge.innerHTML.indexOf(asOf) !== -1, badge.innerHTML);
  t('판정 결과도 그대로 나옴', badge.innerHTML.indexOf('규제지역') !== -1);

  zone.value = 'other'; zone.dataset.manual = '1';
  renderZoneBadge();
  t('직접 고른 경우엔 기준일을 붙이지 않음', badge.innerHTML.indexOf(asOf) === -1, badge.innerHTML);
  delete zone.dataset.manual;

  const src = html.slice(html.indexOf('function renderZoneBadge'),
                         html.indexOf('function zoneVal'));
  t('기준일을 손으로 적지 않고 LAST_VERIFIED에서 가져옴',
    src.indexOf('LAST_VERIFIED') !== -1 && !/20\d\d[.\-]\d/.test(src));
})();

console.log('\n=== v21.9 ㉚ 면책 문구 위치·문장 ===');
(() => {
  /* 목적: 면책 블록의 제목이 그 블록이 실제로 놓인 자리와 어긋나지 않는다.
     이 블록은 결과와 '입력 수정' 버튼 아래에 있어요. "보기 전에"는 그 자리와 맞지 않습니다. */
  const i0 = html.indexOf('<div class="disclaimer">');
  const head = html.slice(i0, i0 + 400);
  t('면책 제목이 "보기 전에"라고 말하지 않음', head.indexOf('보기 전에') === -1, head.slice(0, 120));
  t('면책 블록이 결과·입력수정 버튼 아래에 있음',
    html.indexOf('btn-back') < i0 && html.indexOf('id="captureAreaBuy"') < i0);

  // 자문 범위가 두 자리에서 같은가
  t('리포트 하단과 면책 블록의 자문 범위가 같음',
    html.indexOf('금융·세무·투자 자문이 아닙니다') !== -1
    && html.indexOf('금융·세무·투자 자문이 아니에요') !== -1
    && html.indexOf('금융·세무 자문이 아닙니다') === -1);

  // 기준일을 손으로 적지 않는가
  t('면책 문구에 연도를 손으로 적지 않음', head.indexOf('2026년 8월 기준') === -1);
  renderStaleBanner();
  t('면책 기준일을 LAST_VERIFIED에서 채움',
    el('disclaimerAsOf').textContent.indexOf(LAST_VERIFIED.replace(/-/g, '.')) === 0,
    el('disclaimerAsOf').textContent);
})();

console.log('\n=== v21.9 ㊻ 결과 화면 중복 정리 ===');
(() => {
  /* 목적: 같은 값에 이름이 하나다. 같은 값을 한 카드 안에서 두 번 보여주지 않는다. */

  // (1) cashNeeded의 이름이 하나로 모였는가
  t('없어진 이름 — 자기자본 투입액', html.indexOf('자기자본 투입액') === -1);
  t('없어진 이름 — 필요 자기자본', html.indexOf("line('필요 자기자본'") === -1);
  t('없어진 이름 — 거래 자기자본', html.indexOf('거래 자기자본') === -1);
  /* 자리는 넷: A모드 꼬리의 두 분기(남는 돈 없음/있음) · B모드 꼬리 · 리포트 지표 칸.
     v21.15에서 A모드 꼬리가 두 갈래로 나뉘며 3 → 4가 됐어요.
     잠그는 건 개수가 아니라 "다른 이름을 새로 만들지 않았다"는 것입니다(원칙 48).
     아래 '자기자본 단독' 검사와 '없어진 이름' 검사가 그 목적을 함께 지킵니다. */
  t('정식 자리는 "내 돈(자기자본)" 하나 — 다른 이름을 쓰지 않음',
    (html.match(/내 돈\(자기자본\)/g) || []).length === 4, (html.match(/내 돈\(자기자본\)/g) || []).length);
  t('"자기자본"만 단독으로 쓰는 자리가 없음',
    !/[^(]자기자본(?!\))/.test(html.replace(/내 돈\(자기자본\)/g, '')),
    (html.replace(/내 돈\(자기자본\)/g, '').match(/.{6}자기자본.{6}/g) || []).slice(0, 3).join(' | '));

  // (2) 소계 이름이 섹션 라벨과 겹치지 않는가
  t('입주 준비 비용 라벨이 두 번 나오지 않음',
    html.indexOf('입주 준비 비용 합계') === -1 && html.indexOf('입주 준비 소계') !== -1);
  t('거래·대출 소계가 소계임을 이름으로 드러냄', html.indexOf('거래·대출 소계') !== -1);

  // (3) 월 상환액이 리포트 카드 안에서 두 번 나오지 않는가
  t('영수증의 월 상환액 블록이 사라짐',
    html.indexOf('monthly-box') === -1 && html.indexOf("id=\"monthlyPayment\"") === -1);
  t('쓰이지 않는 CSS도 같이 정리됨', html.indexOf('.monthly-box') === -1);
  const card = html.slice(html.indexOf('id="captureAreaBuy"'), html.indexOf('id="babyRateHint"'));
  t('리포트 카드 안에 월 상환액 자리는 하나뿐',
    (card.match(/월 원리금 상환액|월 상환액/g) || []).length === 0, card.match(/월 원리금 상환액|월 상환액/g));

  // (4) 값 자체는 여전히 나온다 — 지표 칸에서
  const gridSrc = html.slice(html.indexOf('function renderReportGrid'), html.indexOf('function renderInsights'));
  t('월 상환액은 리포트 지표 칸에 남음', gridSrc.indexOf("k:'월 상환액'") !== -1);
  t('내 돈(자기자본)도 리포트 지표 칸에 남음', gridSrc.indexOf("k:'내 돈(자기자본)'") !== -1);
})();

console.log('\n=== v21.9 ㊹ 대출 없이 계산할 때 질문 흐름 ===');
(() => {
  /* 목적: 결과에 반영되지 않는 질문은 묻지 않는다.
     단 결과가 달라지는 질문은 남긴다 — 지역·보유상황은 취득세율을 정한다. */
  const noLoan = el('noLoanCheck');
  el('houseStatus').value = 'none'; el('zone').value = 'reg';

  noLoan.checked = false; toggleNoLoan();
  t('대출을 받으면 연소득을 묻는다', el('askIncome').style.display === '');
  t('번호가 01~04로 매겨진다',
    ['askMode','askAmount','askIncome','askSituation']
      .map(id => el(id).querySelector('.ask-num').textContent).join(',') === '01,02,03,04');
  t('규제지역 무주택이면 서민 우대가 보인다', el('seominField').style.display === 'block');

  noLoan.checked = true; toggleNoLoan();
  t('대출이 없으면 연소득을 묻지 않는다', el('askIncome').style.display === 'none');
  t('04(내 상황)는 남는다 — 취득세가 걸림', el('askSituation').style.display !== 'none');
  t('02(가진 돈)도 남는다', el('askAmount').style.display !== 'none');
  t('번호를 다시 매겨 01~03이 된다',
    ['askMode','askAmount','askSituation']
      .map(id => el(id).querySelector('.ask-num').textContent).join(',') === '01,02,03');
  t('서민·실수요자 우대도 감춘다 (LTV 우대라 걸릴 곳이 없음)',
    el('seominField').style.display === 'none');
  t('감추면서 서민 체크도 풀어둔다 (원칙 42)', el('seominCheck').checked === false);

  noLoan.checked = false; toggleNoLoan();
  t('체크를 풀면 연소득이 돌아온다', el('askIncome').style.display === '');
  t('번호도 01~04로 돌아온다',
    el('askSituation').querySelector('.ask-num').textContent === '04');

  // 소득 미입력 경고가 대출 없는 화면에 뜨지 않는가
  const diagSrc = html.slice(html.indexOf('연소득 미입력 = DSR 미반영'),
                             html.indexOf('연소득 미입력 = DSR 미반영') + 300);
  t('대출이 없으면 DSR 미반영 경고를 띄우지 않음', diagSrc.indexOf('!ctxBase.noLoan') !== -1);
})();

console.log('\n=== v21.9 ㊾ 계산 불가일 때 직전 결과 지우기 (원칙 30) ===');
(() => {
  /* 목적: "보유자금을 입력해주세요"가 뜬 화면에 직전 계산의 금액이 남지 않는다. */
  ['fundingBarBox','bindingDiagnosis','burdenBox','babyRateHint','reportGrid'].forEach(id => {
    el(id).innerHTML = '이전 계산 값';
  });
  clearInsights();
  t('리포트 지표 칸도 비운다', el('reportGrid').innerHTML === '', el('reportGrid').innerHTML);
  t('자금 구성·진단·부담·안내도 비운다',
    ['fundingBarBox','bindingDiagnosis','burdenBox','babyRateHint']
      .every(id => el(id).innerHTML === ''));

  const src = html.slice(html.indexOf('function clearInsights'), html.indexOf('function renderFallbackNote'));
  t('지우는 목록에 reportGrid가 들어 있음', src.indexOf("'reportGrid'") !== -1);
})();

console.log('\n=== v21.9 ㊻-b 영수증 꼬리 정리 ===');
(() => {
  /* 목적: 같은 금액이 연달아 반복되지 않는다. 채워진 블록이 여럿이 아니다(원칙 10). */
  const c = {interiorCost: 0, etcCost: 0};

  t('입주 준비가 0이면 그 섹션을 통째로 생략', executionBlock(c, 0, 800000000) === '');
  t('입주 준비가 0이면 거래·대출 소계도 생략 (내 돈과 같은 값이라)',
    executionBlock(c, 0, 800000000).indexOf('거래·대출 소계') === -1);

  const withCost = executionBlock({interiorCost: 30000000, etcCost: 3000000}, 33000000, 800000000);
  t('입주 준비가 있으면 두 소계가 모두 나옴',
    withCost.indexOf('거래·대출 소계') !== -1 && withCost.indexOf('입주 준비 소계') !== -1);
  t('인테리어비·기타비용 항목도 나옴',
    withCost.indexOf('인테리어비') !== -1 && withCost.indexOf('기타비용') !== -1);

  // 위계 — 소계는 채워진 블록이 아니다
  t('소계는 sub, 채워진 블록(total/grand)이 아님',
    withCost.indexOf("line-item sub") !== -1
    && withCost.indexOf("line-item total") === -1
    && withCost.indexOf("line-item grand") === -1);
  t('sub 스타일에 배경을 깔지 않음',
    /\.line-item\.sub\{[^}]*\}/.test(html)
    && !/\.line-item\.sub\{[^}]*background/.test(html));

  /* 채워진 블록 개수는 소스의 글자 수가 아니라 **그려진 결과**로 셉니다(원칙 48).
     v21.14까지는 소스에서 'grand'/'total' 문자열을 셌는데, 꼬리가 분기되면
     실제 화면과 무관하게 깨지는 검사였어요. */
  const tailSame = receiptTail(800000000, 800000000);
  const tailLeft = receiptTail(304240000, 400000000);
  t('남는 돈이 없으면 grand 하나뿐 (원칙 10)',
    (tailSame.match(/line-item grand/g) || []).length === 1);
  t('남는 돈이 있어도 grand 하나뿐 (원칙 10)',
    (tailLeft.match(/line-item grand/g) || []).length === 1);
  t('남는 돈이 없으면 total 블록을 쓰지 않음', tailSame.indexOf('line-item total') === -1);
  t('남는 돈이 있으면 total 하나뿐',
    (tailLeft.match(/line-item total/g) || []).length === 1);
})();

console.log('\n=== v21.10 GA 연결 · 로그 개인정보 (원칙 36) ===');
(() => {
  const head = html.slice(0, html.indexOf('</head>'));
  t('측정 ID가 실제 값으로 설정됨',
    /window\.GA_ID = 'G-(?!X)[A-Z0-9]+';/.test(head), (head.match(/window\.GA_ID = '[^']*'/) || [])[0]);
  t('미설정이면 스크립트를 안 불러오는 가드는 그대로',
    head.indexOf("indexOf('G-X') === 0") !== -1);
  t('측정 ID는 한 곳에서만 정의됨',
    (html.match(/G-NVTLEPG53G/g) || []).length === 1);
  t('연결 기록(속성·스트림·연결일)이 주석에 남아 있음',
    head.indexOf('연결일:') !== -1 && head.indexOf('noah-choi.vercel.app') !== -1);

  /* 목적: 사용 로그에 금액·소득이 실려 나가지 않는다. 범주형 라벨만 보낸다. */
  const calls = html.match(/track\('[^']+',\s*\{[^}]*\}/g) || [];
  t('추적 호출을 모두 검사함', calls.length >= 15, calls.length + '개');
  /* ⚠ `income_entered`는 금액이 아니라 입력 여부(1/0)예요. 단어 경계로 갈라야 오탐이 안 납니다. */
  const money = calls.filter(c =>
    /cashNeeded|mortgageLoan|maxPrice|ctxBase\.income\b|ctxBase\.price\b|formatWon|\bcash\b|\bprice\b/.test(c));
  t('금액·소득을 담은 추적 호출이 없음', money.length === 0, money.slice(0, 2).join(' | '));
  t('입력 여부 플래그는 보내도 됨 (금액이 아님)',
    calls.some(c => c.indexOf('income_entered') !== -1));
  const numeric = calls.filter(c => /:\s*\d{5,}/.test(c));
  t('원 단위 숫자를 그대로 보내는 호출도 없음', numeric.length === 0, numeric.slice(0, 2).join(' | '));
})();

console.log('\n=== v21.12 ㊲ 04 전용 판 — 컨트롤 교체와 부제 ===');
(() => {
  /* 목적: 04를 감추지 않고 세로 길이만 줄인다. 내용은 하나도 사라지지 않는다. */
  const card = html.slice(html.indexOf('id="askSituation"'), html.indexOf('id="topSectionToggle"'));

  // (1) 지역 두 칸을 한 쌍으로
  t('시/도–시군구가 가로 한 쌍으로 묶임', /class="row2 inline"[\s\S]{0,220}id="buySgg"/.test(card));
  t('.row2.inline은 가로 배치', /\.row2\.inline\{[^}]*flex-direction:row/.test(html));
  t('줄바꿈시키지 않는다 — 줄바꿈하면 다시 위아래가 됨',
    /\.row2\.inline\{(?![^}]*flex-wrap)[^}]*\}/.test(html));
  t('두 칸 모두 이름이 들어갈 폭을 가짐',
    /select:first-child\{flex:0 1 44%/.test(html) && /select:last-child\{flex:1 1 56%/.test(html));
  /* 잘려도 어느 구인지 알 방법이 남아 있어야 합니다 — 바로 아래 뱃지가 이름을 다시 적습니다. */
  t('판정 뱃지가 고른 시군구 이름을 그대로 다시 적는다',
    html.indexOf('const name = (document.getElementById(\'buySgg\').selectedOptions[0]') !== -1 &&
    /badge\.innerHTML[\s\S]{0,200}\$\{name\}/.test(html));

  // (2) 주택 보유 상황 — 세로 4줄 → 2×2 격자
  t('choice-list 컨트롤이 남아 있지 않음', html.indexOf('choice-list') === -1);
  t('.choice CSS도 같이 지웠음 (원칙 55)', /^\s*\.choice\{/m.test(html) === false);
  t('pickChoice()도 같이 지웠음', html.indexOf('function pickChoice') === -1);
  t('주택 보유 상황이 2×2 격자 세그먼트', /class="segmented sm grid2" id="houseChoices"/.test(card));
  t('.segmented.grid2는 grid — 좁은 화면에서 세로로 접히지 않음',
    /\.segmented\.grid2\{[^}]*display:grid/.test(html));
  t('≤400px에서 .segmented를 세로로 접는 규칙은 그대로 있음 (격자만 예외)',
    /@media \(max-width:400px\)\{[\s\S]{0,400}\.segmented\{flex-direction:column;\}/.test(html));

  // (3) 짝이 되는 select과의 동기화 (원칙 29)
  const btns = card.match(/data-val="(first|none|oneDisposing|multi)"/g) || [];
  t('선택지 개수는 그대로 4개 (⑧와 충돌하지 않음)', btns.length === 4, btns.length + '개');
  t('모두 짝 select로만 동기화함', (card.match(/pickSeg\(this,'houseStatus'\)/g) || []).length === 4);
  t('짝이 되는 select이 그룹 바로 다음에 오는가 (syncSegments 전제)',
    /id="houseChoices"[\s\S]*?<\/div>\s*<select id="houseStatus" class="sr-only"/.test(card));
  t('항목별 설명은 하나도 안 지움', (card.match(/세대원 모두|예전에 있었음|팔기로 하고|원칙적으로 불가/g) || []).length === 4);
  t('접기를 더 늘리지 않음 (04 안 hint-detail 2개 유지)',
    (card.match(/class="hint-detail"/g) || []).length === 2, (card.match(/class="hint-detail"/g) || []).length + '개');

  // (4) 대출 없을 때 04 부제
  t('부제를 값에서 조립함 (정적 문자열 아님)', /id="situationSub"/.test(card));
  t('두 문장이 서로 다름', SITUATION_SUB.loan !== SITUATION_SUB.noLoan);
  /* "이 두 가지"가 무엇인지 몰랐다는 지적. 아래 두 칸의 label 이름을 그대로 씁니다. */
  ['사려는 집의 지역', '주택 보유 상황'].forEach(function(name){
    t('부제가 「' + name + '」을 이름으로 가리킴',
      SITUATION_SUB.loan.indexOf(name) !== -1 && SITUATION_SUB.noLoan.indexOf(name) !== -1);
    t('그 이름이 실제 칸 label과 같음', card.indexOf('<label>' + name + '</label>') !== -1);
  });
  t('지시대명사로만 가리키지 않음',
    SITUATION_SUB.loan.indexOf('이 두 가지가') === -1 && SITUATION_SUB.noLoan.indexOf('이 두 가지가') === -1);
  t('대출이 없으면 대출한도를 말하지 않음', SITUATION_SUB.noLoan.indexOf('대출한도') === -1);
  t('대신 취득세를 말함 (04가 남는 이유)', SITUATION_SUB.noLoan.indexOf('취득세') !== -1);

  const noLoan = el('noLoanCheck');
  noLoan.checked = false; toggleNoLoan();
  t('대출을 받으면 대출한도 문장', el('situationSub').innerHTML === SITUATION_SUB.loan);
  noLoan.checked = true; toggleNoLoan();
  t('대출이 없으면 취득세 문장으로 바뀜', el('situationSub').innerHTML === SITUATION_SUB.noLoan);
  noLoan.checked = false; toggleNoLoan();
  t('체크를 풀면 되돌아옴 (원칙 42)', el('situationSub').innerHTML === SITUATION_SUB.loan);
})();

console.log('\n=== v21.14 ㉝ 미리보기 제거 확인 ===');
(() => {
  /* 목적: 걷어낸 자리가 깨끗한지. 계산 로직은 하나도 안 건드렸는지.
     미리보기는 본 계산 함수를 빌려 쓰기만 했으므로, 지우면 흔적이 남지 않아야 합니다(원칙 55). */
  ['previewBar', 'preview-bar', 'previewState', 'renderPreview', 'PREVIEW_NEED', 'pv-cell', 'pv-need']
    .forEach(name => t('흔적이 남지 않음 — ' + name, html.indexOf(name) === -1));
  t('liveRecalc가 원래대로 돌아옴',
    /function liveRecalc\(\)\{\s*if\(!resultVisible\) return;/.test(html));
  t('왜 걷어냈는지 코드에 남아 있음 (다시 넣지 않도록)',
    /61번/.test(html) && html.indexOf('미리보기(') !== -1);
  /* 계산 쪽은 그대로여야 합니다 */
  t('solveMaxPrice는 그대로', typeof solveMaxPrice === 'function');
  t('calcCosts는 그대로', typeof calcCosts === 'function');
})();

console.log('\n=== v21.13-b 원칙 60 판 표시 ===');
(() => {
  /* 목적: 화면만 보고 어느 판이 올라가 있는지 가릴 수 있다.
     파일명이 매번 같아 다운로드가 여러 개 쌓이면 파일로는 못 가립니다. */
  t('판 번호가 한 곳에서만 정의됨 (원칙 46)',
    (html.match(/const BUILD = /g) || []).length === 1);
  t('판 번호 형식이 v숫자.숫자', /^v\d+\.\d+/.test(BUILD), BUILD);
  t('두 탭 하단에 모두 자리가 있음 (원칙 35)',
    (html.match(/class="footer-copyright build-tag"/g) || []).length === 2);
  t('문구를 값에서 조립함 — 판 번호를 마크업에 적지 않음',
    html.indexOf('>' + BUILD + '<') === -1);
  t('확인일도 같은 상수에서 가져옴',
    /renderBuildTag[\s\S]{0,200}LAST_VERIFIED/.test(html));
  t('첫 화면에서 채워짐', /renderStaleBanner\(\);\s*renderBuildTag\(\);/.test(html));

  t('판 번호가 맨 앞에 오고 확인일이 뒤따름',
    /BUILD \+ ' · 정책 ' \+ LAST_VERIFIED/.test(html));
})();

console.log('\n=== v21.13-d 확인 결과 반영 ===');
(() => {
  /* 목적: 사용자가 화면에서 실제로 지적한 것들이 다시 생기지 않게 잠근다. */

  // (1) 판 표시가 입력 화면에서도 보인다 — 전에는 결과 화면 footer 안에만 있었다
  const step1 = html.slice(html.indexOf('data-step="1"'), html.indexOf('data-step="7"'));
  t('판 표시가 입력 화면에도 있다', step1.indexOf('build-tag') !== -1);
  t('판 표시 자리가 세 곳 (입력·결과·전월세)',
    (html.match(/build-tag/g) || []).filter(x => true).length >= 3);

  // (2) 줄 끝에서 갈라지면 안 되는 문구
  t('"더 정확하게"가 줄 끝에서 갈라지지 않는다',
    /<b style="white-space:nowrap;">"더 정확하게"<\/b>/.test(html));
  t('중개보수 꼬리표가 줄 끝에서 갈라지지 않는다',
    /중개보수 <span class="nowrap">\(중개수수료·VAT 포함\)<\/span>/.test(html));
  t('nowrap 유틸이 정의돼 있다', /\.nowrap\{white-space:nowrap;\}/.test(html));

  // (3) 방공제를 고르는 자리에서 뺀다 (㊺ 규칙 3 — 계산 내부 사정)
  const badgeSrc = html.slice(html.indexOf('function renderZoneBadge'),
                              html.indexOf('function renderZoneBadge') + 1400);
  t('판정 뱃지에 방공제 금액을 적지 않는다', badgeSrc.indexOf('방공제 $') === -1);
  t('판정 결과와 확인일은 그대로 남는다',
    badgeSrc.indexOf('zoneLabelOf') !== -1 && badgeSrc.indexOf('LAST_VERIFIED') !== -1);
  /* ⚠ 화면에서 뺐을 뿐 계산에서 뺀 게 아닙니다. 자동 세팅 경로는 그대로 있어야 합니다. */
  t('방공제 자동 세팅은 그대로 (계산에서 뺀 게 아님)',
    html.indexOf('roomDeductFromSgg(code)') !== -1);
})();

console.log('\n=== v21.15 결과 화면 정리 ===');
(() => {
  /* (1) 영수증 꼬리 — 남는 돈 */
  const same = receiptTail(800000000, 800000000);
  t('내 돈 = 보유자금이면 한 줄만 나온다',
    (same.match(/line-item/g) || []).length === 1);
  t('그 한 줄에 보유자금을 다시 적지 않는다', same.indexOf('보유자금') === -1);
  t('그 한 줄은 "내 돈(자기자본)"이다', same.indexOf('내 돈(자기자본)') !== -1);

  const left = receiptTail(304240000, 400000000);
  t('남는 돈이 있으면 세 줄이 나온다',
    (left.match(/line-item/g) || []).length === 3, (left.match(/line-item/g) || []).length);
  t('세 줄은 내 돈 · 남는 돈 · 보유자금 순서',
    left.indexOf('내 돈(자기자본)') < left.indexOf('남는 돈')
    && left.indexOf('남는 돈') < left.indexOf('보유자금'));
  t('남는 돈 금액이 맞다 (4억 − 3억424만 = 9,576만)', left.indexOf('9,576만원') !== -1,
    (left.match(/>[^<]*만원</g) || []).join(' '));

  /* ⚠ 원칙 28 — 남는 돈은 실제보다 커 보이면 안 됩니다. 만원 단위 내림. */
  t('남는 돈은 내림 처리 (반올림으로 부풀지 않음)',
    receiptTail(100000000 - 19000, 100000000).indexOf('1만원') !== -1,
    receiptTail(100000000 - 19000, 100000000));
  t('1만원 미만 차이는 남는 돈으로 치지 않는다',
    (receiptTail(100000000 - 9000, 100000000).match(/line-item/g) || []).length === 1);
  t('내 돈이 보유자금보다 커도 음수 남는 돈이 안 나온다',
    (receiptTail(900000000, 800000000).match(/line-item/g) || []).length === 1);

  /* (2) 위계 — 채워진 블록끼리 좌우 폭이 같다 */
  const blockCss = id => (html.match(new RegExp('\\.line-item\\.' + id + '\\{[^}]*\\}'))||[''])[0];
  const sideOf = css => [(css.match(/margin:[^;]*/)||[''])[0], (css.match(/padding:[^;]*/)||[''])[0]]
                        .map(s => (s.match(/-?\d+px/g)||[]).slice(-1)[0]).join('/');
  t('grand·loan·total의 좌우 폭이 같다 (margin -10px / padding 10px)',
    sideOf(blockCss('grand')) === '-10px/10px'
    && sideOf(blockCss('loan')) === '-10px/10px'
    && sideOf(blockCss('total')) === '-10px/10px',
    ['grand', 'loan', 'total'].map(k => k + ':' + sideOf(blockCss(k))).join(' | '));

  /* ⚠ 같은 .grand가 전월세 요약 상자 안에도 있어요. 그쪽은 여백을 0으로 되돌려야
     세 줄의 글자가 나란히 섭니다(원칙 55 — 지운 자리가 만드는 새 중복·새 어긋남). */
  t('전월세 요약 상자 안에서는 grand 여백을 되돌린다',
    /\.rent-summary \.line-item\{[^}]*margin:0[^}]*\}/.test(html),
    (html.match(/\.rent-summary \.line-item\{[^}]*\}/)||[])[0]);

  /* (3) 배치 — 공유 버튼이 리포트 카드와 한도 카드 사이에 온다 */
  const iCapture = html.indexOf('id="captureAreaBuy"');
  const iShare   = html.indexOf('class="share-btn-row"');
  const iCopy    = html.indexOf('id="copyTextBtn"');
  const iDiag    = html.indexOf('<div id="bindingDiagnosis">');
  t('공유 버튼이 리포트 카드 뒤에 온다', iCapture < iShare);
  t('공유 버튼이 한도 카드보다 앞에 온다', iShare < iDiag && iCopy < iDiag);

  /* (3) 곁가지 카드는 접는다 — 유의사항은 접지 않는다 */
  t('상황이 달랐다면 카드가 접힘', html.indexOf("toggleOptionalSection(this,'compareBody')") !== -1);
  t('매물 찾아보기 카드가 접힘', html.indexOf("toggleOptionalSection(this,'searchBody')") !== -1);
  t('접는 자리는 기존 optional-section을 재사용',
    html.indexOf('id="compareBody" class="optional-section"') !== -1
    && html.indexOf('id="searchBody" class="optional-section"') !== -1);
  t('접어도 내용은 그대로 있다 (원칙 15 — 도달 가능)',
    html.indexOf('id="compareRows"') !== -1 && html.indexOf("openSearch('naver')") !== -1);

  /* ⚠ 접기 버튼을 .card로 감싸면 접혔을 때 빈 흰 상자만 남고, 버튼 폭이 좌우 24px씩
     좁아져 제목이 두 줄로 접힙니다. 껍데기 없이 두고 제목도 한 줄 길이로 유지해요. */
  t('접기 버튼을 카드로 감싸지 않는다',
    html.indexOf('<div class="card" id="compareCard"') === -1
    && /<div id="compareCard" style="display:none;">\s*<button/.test(html));
  const toggleLabels = (html.match(/class="section-toggle"[^>]*>\s*<span>([^<]*)</g) || [])
    .map(s => s.replace(/^[\s\S]*<span>/, ''));
  const resultLabels = toggleLabels.filter(s => /상황이 달랐다면|매물 찾아보기/.test(s));
  t('결과 화면 접기 제목을 둘 다 검사함', resultLabels.length === 2, resultLabels.join(' | '));
  /* 폭 계산: 화면 393pt · 컨테이너 351pt · 버튼 좌우 padding 16px · 셰브런 자리 24px
     → 글자 자리 약 295pt. 14px 한글이 한 자 14pt이므로 21자가 한계입니다.
     여유를 한 자 두고 20자로 잠급니다. 넘으면 두 줄로 접혀 버튼이 세로로 길어져요. */
  t('접기 제목이 한 줄에 들어가는 길이 (20자 이내)',
    resultLabels.every(s => s.length <= 20), resultLabels.map(s => s + '=' + s.length).join(' | '));
  /* ⚠ 유의사항은 법적 고지라 기본 노출입니다. 접는 대상에 넣지 마세요. */
  const disc = html.slice(html.indexOf('class="disclaimer"'));
  t('유의사항 본문은 접히지 않는다',
    disc.indexOf('disclaimer-item') < disc.indexOf('disclaimer-toggle'));

  /* (4) 말투 — 특정 앱으로 좁히지 않는다 (원칙 9·44) */
  t('화면 문구에 특정 메신저 이름이 없다', html.indexOf('카톡') === -1,
    (html.match(/.{10}카톡.{10}/g) || []).slice(0, 2).join(' | '));
  t('텍스트 복사 버튼 이름에서 용도 제한을 뺐다',
    html.indexOf('📋 요약 텍스트 복사</button>') !== -1);
})();

console.log('\n\uacb0\uacfc: ' + pass + ' 통과 / ' + fail + ' 실패\n');
process.exit(fail ? 1 : 0);
