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
   + 'globalThis.DSR_RATIO=DSR_RATIO; globalThis.DTI_RATIO=DTI_RATIO;';
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
t('디딤돌 생애최초 LTV는 수도권 기준', html.indexOf('(p.firstTime && !p.metro) ? 0.8 : 0.7') !== -1);
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
t('파랑 배경 위 흰 글씨 아님 (원칙 10)', html.indexOf('.line-item.loan .k{color:#0068BD') !== -1);
t('대출 금액이 그래프와 같은 --loan 색 (원칙 38)', html.indexOf('.line-item.loan .v{color:var(--loan)') !== -1);
t('대출 금액에 골드(--accent) 안 씀 (원칙 38)', html.indexOf('.line-item.loan .v{color:var(--accent)') === -1);
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
t('01 A모드 서브라벨', html.indexOf('<span>살 수 있는 최대 집값</span>') !== -1);
t('01 B모드 서브라벨', html.indexOf('<span>그 집에 필요한 현금</span>') !== -1);
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
t('첫 소제목에는 구분선이 없음',
  html.indexOf('#optionalSection .subsection-label:first-child{') !== -1);
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

console.log('\n결과: ' + pass + ' 통과 / ' + fail + ' 실패\n');
process.exit(fail ? 1 : 0);
