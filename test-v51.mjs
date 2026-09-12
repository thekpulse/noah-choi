import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('./index.html',import.meta.url),'utf8');
function fn(name){const re=new RegExp('(?:async )?function '+name+'\\([^]*?\\n\\}');const match=html.match(re);assert.ok(match,name);return match[0];}
let count=0;
async function test(name,body){await body();count++;console.log('✓ '+name);}
const context={S:{sgg:'11110',compareCodes:[],houseStatus:'first'},LAWD:{서울:[['11110','종로구'],['11140','중구'],['11170','용산구'],['11200','성동구']],경기:[['41110','수원시']]},
 lawdCodesOf:c=>c?[c]:[],sidoOfCode:c=>c.startsWith('11')?'서울':'경기',regionLabel:()=>context.S.sgg==='11110'?'서울 종로구':'경기 수원시',pickLabel:c=>c==='11110'?'종로구':'수원시',sggName:c=>context.LAWD.서울.find(x=>x[0]===c)?.[1]||'수원시'};
context.DEAL={get compareCodes(){return context.S.compareCodes},set compareCodes(v){context.S.compareCodes=v},wide:false};
vm.createContext(context);vm.runInContext(fn('dealCompareCodes')+'\n'+fn('dealScopeLabel')+'\n'+fn('inputCompareMarkup'),context);
await test('잘못된 지역·중복·다른 시도 제거 및 최대 2곳 제한',()=>{
 context.S.compareCodes=['11110','11140','11140','41110','bad','11170','11200'];context.dealCompareCodes();assert.equal(JSON.stringify(context.S.compareCodes),'["11140","11170"]');assert.equal(context.S.sgg,'11110');
});
await test('첫 선택창에 선택 지역 체크 상태와 개수 표시',()=>{
 const markup=context.inputCompareMarkup();assert.match(markup,/data-input-region="11140" aria-pressed="true"/);assert.match(markup,/2 \/ 2곳 선택/);assert.doesNotMatch(markup,/data-input-region="11110"/);
});
await test('시도 변경시 기존 비교 지역 제거 및 깨진 저장 데이터 복구',()=>{
 context.S.sgg='41110';context.dealCompareCodes();assert.equal(context.S.compareCodes.length,0);context.S.compareCodes={broken:true};context.dealCompareCodes();assert.equal(context.S.compareCodes.length,0);context.S.sgg='11110';
});
const buttons=['11140','11170','11200'].map(code=>({dataset:{inputRegion:code},focus(){}}));
const status={textContent:''},pane={innerHTML:'',querySelectorAll:s=>s==='[data-input-region]'?buttons:[],querySelector:s=>buttons.find(b=>s.includes(b.dataset.inputRegion))};
context.$=id=>id==='regionPane'?pane:status;context.regionPane=()=>context.inputCompareMarkup();context.syncCta=()=>{};context.openPick=()=>null;
vm.runInContext(fn('bindPane'),context);context.bindPane();
await test('지역 클릭 동작: 두 곳 선택·세 번째 차단·선택 해제',()=>{
 buttons[0].onclick();buttons[1].onclick();buttons[2].onclick();assert.equal(context.S.compareCodes.length,2);assert.match(status.textContent,/2곳까지/);buttons[0].onclick();buttons[2].onclick();assert.equal(JSON.stringify(context.S.compareCodes),'["11170","11200"]');assert.equal(context.S.sgg,'11110');
});
context.LASTVIEW={c:{},price:1485520000};context.HOUSE={first:'생애최초'};context.D={rate:5.4,years:30};context.S.income=null;
const figures={P:148552,E:5948,T:154500,C:100000,L:54500,pPrice:96,pEtc:4,pCash:65,pLoan:35};
context.heroFigures=()=>figures;context.formatWon=v=>Math.round(v/10000)+'만원';context.richWon=context.formatWon;context.monthlyPaymentCalc=()=>3060000;context.SERVICE_URL='https://example.invalid';context.cashNote=()=>'';context.paintReportDeals=()=>{};context.approx=v=>v;context.comma=String;
const elements={};context.$=id=>elements[id]||(elements[id]={textContent:'',innerHTML:''});
vm.runInContext(fn('summaryText')+'\n'+fn('shareCaption')+'\n'+fn('renderReport'),context);
await test('복사 제목·예상 집값·부대비용·합계·월 상환액·참고용 안내',()=>{
 const text=context.summaryText();assert.ok(text.startsWith('내 집 마련, 얼마까지?'));assert.ok(text.split('\n').length>10,'복사 문구의 실제 줄바꿈');assert.ok(!text.includes('\\n'),'문자 그대로의 역슬래시 n 금지');assert.equal(context.shareCaption().split('\n').length,3);for(const v of ['148552만원','5948만원','154500만원','306만원','참고용','주선·알선·중개'])assert.ok(text.includes(v),v);
});
await test('저장 이미지가 만원 단위 금액을 유지하고 예상 집값을 먼저 표시',()=>{
 context.renderReport(context.LASTVIEW);assert.equal(elements.rAmount.innerHTML,'148552만원');for(const v of ['5948만원','154500만원','54500만원'])assert.ok(elements.rMix.innerHTML.includes(v),v);assert.ok(elements.rNote.textContent.includes('참고용'));assert.equal(elements.rMonthly.hidden,false);assert.ok(elements.rMonthly.innerHTML.includes('306만원'));figures.L=0;context.renderReport(context.LASTVIEW);assert.equal(elements.rMonthly.hidden,true);figures.L=54500;
});
await test('비교 지역 초안 저장·내보내기 중복 단지 키·다운로드 지연 해제 유지',()=>{
 assert.match(html,/const DRAFT_KEYS = \['compareCodes'/);assert.match(html,/const k = dealSameKey\(x\)/);assert.match(html,/setTimeout\(\(\)=>URL.revokeObjectURL\(url\),60000\)/);
});
console.log(`\n${count}개 v51 검사 통과 — DOM 모형 검사이며 실제 브라우저 검증은 아님`);
