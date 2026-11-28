// 영끌계산기 다크 모드 생성기(v401) — 의존성 없음.
// 쓰는 법: node tools/dark.mjs            → index.html 안 <style id="v401-dark"> 를 새로 만들어 넣음
//          node tools/dark.mjs --check    → 지금 index.html 의 다크 덩어리가 생성 결과와 같은지만 확인(다르면 종료 코드 1)
// 원리: 문서의 모든 <style>(다크 덩어리 제외)에서 색이 든 선언만 골라, 같은 선택자에 「같은 만큼」 특정도를 올린 쌍둥이를 만든다.
//   :root:not(.yk-light)… 를 붙이면 모든 쌍둥이가 원본보다 (0,2,0) 높고 서로 사이 순서 · 특정도 차이는 원본과 같다 → 밝은 화면에서 이기던 규칙의 쌍둥이가 다크에서도 이긴다.
//   색은 OKLCH로 바꿔 역할별로 옮긴다: 글자(color 등)는 밝게 · 면/선/채움은 어둡게(밝은 것끼리의 순서 유지) · 파랑 같은 진한 색은 그대로.
//   <html class="yk-light"> 이면 쌍둥이가 꺼진다(비교 이미지 저장 html2canvas 복제 문서에서 씀 — 저장 이미지는 밝게).
// 색을 고친 뒤에는 이 파일을 다시 돌린다. tests/check.mjs 가 --check 와 같은 비교를 한다.
import fs from 'node:fs'; import path from 'node:path'; import {fileURLToPath} from 'node:url';

export const DARK_ID = 'v401-dark';
// 다크를 넣는 문서: 계산기 + 안내 페이지 15개(v403). 안내 페이지를 새로 만들면 여기에도 넣는다.
export const PAGES = ['index.html','about.html','articles.html','budget-examples.html','buying-costs.html','couple-income.html','dsr-income-table.html','existing-debt.html','guide.html','loan-limit.html','price-band-cap.html','privacy.html','rate-type.html','regulated-area.html','room-deduction.html','switch-home.html'];
const META_LIGHT='<meta name="theme-color" content="#F1F4F8" media="(prefers-color-scheme: light)">', META_DARK='<meta name="theme-color" content="#14181E" media="(prefers-color-scheme: dark)">';
const MARK = ':not(.yk-light)';

// ---------- 색 ----------
const NAMED = {white:[255,255,255], black:[0,0,0]};
function hexTo(h){ h=h.slice(1); if(h.length===3||h.length===4) h=[...h].map(c=>c+c).join(''); const n=[0,2,4].map(i=>parseInt(h.slice(i,i+2),16)); const a=h.length===8?parseInt(h.slice(6,8),16)/255:1; return {r:n[0],g:n[1],b:n[2],a}; }
const lin=c=>{c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4);};
const gam=c=>{const v=c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055;return Math.round(Math.min(1,Math.max(0,v))*255);};
function toOk({r,g,b}){ const R=lin(r),G=lin(g),B=lin(b);
  const l=Math.cbrt(0.4122214708*R+0.5363325363*G+0.0514459929*B), m=Math.cbrt(0.2119034982*R+0.6806995451*G+0.1073969566*B), s=Math.cbrt(0.0883024619*R+0.2817188376*G+0.6299787005*B);
  const L=0.2104542553*l+0.7936177850*m-0.0040720468*s, A=1.9779984951*l-2.4285922050*m+0.4505937099*s, Bb=0.0259040371*l+0.7827717662*m-0.8086757660*s;
  return {L, C:Math.hypot(A,Bb), h:Math.atan2(Bb,A)}; }
function fromOk(L,C,h){ for(let k=0;k<40;k++){ const A=C*Math.cos(h),Bb=C*Math.sin(h);
    const l=Math.pow(L+0.3963377774*A+0.2158037573*Bb,3), m=Math.pow(L-0.1055613458*A-0.0638541728*Bb,3), s=Math.pow(L-0.0894841775*A-1.2914855480*Bb,3);
    const R=4.0767416621*l-3.3077115913*m+0.2309699292*s, G=-1.2684380046*l+2.6097574011*m-0.3413193965*s, B=-0.0041960863*l-0.7034186147*m+1.7076147010*s;
    if([R,G,B].every(v=>v>=-0.001&&v<=1.001)) return {r:gam(R),g:gam(G),b:gam(B)}; C*=0.92; }
  const g=gam(Math.pow(L,3)); return {r:g,g:g,b:g}; }
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));

// 역할: 'text'(글자 · 아이콘 선) / 'surface'(면 · 선 · 채움)
// 역할이 정해진 몇 색은 직접 정함(일반 규칙으로는 「구멍」처럼 보이는 것)
const FIXED={ surface:{
  'E0E5EC':'2E333A',                                   // 꺼진 버튼 면 — 카드보다 조금 밝은 회색
  // v404 — 결과 「돈의 흐름」 막대 · 점. 일반 규칙이면 옅은 회색이 거의 검정(#04070B)이 되어 카드에서 사라지고,
  //        옅은 파랑(#B9CBFF)은 진한 파랑 면이 되어 막대 위아래 결이 뒤집힘 → 직접 정함
  'B9CBFF':'B9CBFF', '8F9BB0':'8F9BB0',                // 대출 막대 윗결 · 집값 막대 윗결 — 밝은 색 그대로(어두운 카드 위에서 보임)
  'D5DBE4':'667080', 'C8D0DB':'5C6573'                 // 부대비용 막대 · 점 — 카드(#2A2D33 언저리)보다 밝은 중간 회색
} };
export function mapColor(c, role){
  if(role==='shadow'){ const {L,C}=toOk(c); if(C>=0.05) return c;   // 색 있는 테(포커스 링 #2458FF · 파란 버튼 그림자)는 그대로 — 흐리게 하면 다크에서 포커스가 안 보임
    return L<0.5 ? {r:0,g:0,b:0,a:Math.min(1,c.a*1.8)} : {...c,a:+(c.a*0.35).toFixed(3)}; }   // v404 — 그림자는 검게(밝은 면이 되면 빛 번짐처럼 보임) · 흰 광택은 옅게
  const key=hex2(c.r)+hex2(c.g)+hex2(c.b); const fx=FIXED[role==='text'?'text':'surface']||{};
  if(fx[key]){ const o=hexTo('#'+fx[key]); return {...o,a:c.a}; }
  const {L,C,h}=toOk(c); let L2=L, C2=C, h2=h;
  const tint = role!=='text' && c.b>=250 && c.b-c.r>=10 && L>0.8;   // 옅은 파랑 면(#EDF2FF · #E8EEFF · #CFDCFF … 파랑 칸이 FF) — 회색(#DDE4EF 등 B≤F7)과 가름
  const neutral = !tint && C<(role==='text'?0.05:0.035);   // 글자는 푸른 먹색(#1E273B 등)까지 회색으로 → 흰 글자
  if(role==='text'){
    if(neutral){ if(L>0.9) return c;                          // 흰 글자(색 면 위)는 그대로
      L2 = L<=0.3 ? 0.93 : L<0.75 ? 0.93-(L-0.3)/0.45*0.29 : 0.62; C2=Math.min(C,0.02); }
    else { if(L>0.85) return c; L2=Math.max(L,0.75); C2=Math.min(C,0.16); }
  } else {
    if(neutral){
      if(L>=0.96) L2=0.19+(L-0.96)*2.0;                        // 흰 #FFF → 0.27(카드) · #F1F4F8 → 0.196(바탕)
      else if(L>=0.85) L2=0.19-(0.96-L)*0.6;                   // 선 · 틀(#E4E8F1 · #DDE4EF) → 0.17 언저리
      else if(L>=0.35) L2=1.0-L*0.62;                          // 회색 막대 · 아이콘(#B9C2D0 → 0.50 · #465262 → 0.73)
      else L2=0.36+L*0.1;                                      // 진한 면(말풍선 #192332) → 조금 밝은 진한 면
      C2=0.012; h2=4.45;                                       // 회색 면은 모두 같은 차가운 기운(파랑 쪽 · 255°)으로 맞춤
    } else {
      if(tint||L>0.88){ L2=0.31; C2=0.06; }                     // 옅은 파랑 면(#EDF2FF) → 진한 파랑 면
      else if(L<0.4){ L2=0.52; }                               // 아주 진한 색 → 보이게
      else return c;                                           // 브랜드 파랑 · 코랄 같은 중간 색은 그대로
    }
  }
  L2=clamp(L2,0,1); const o=fromOk(L2,C2,h2); return {...o, a:c.a};
}
const hex2=n=>n.toString(16).padStart(2,'0').toUpperCase();
function fmt(c){ if(c.a>=0.999) return '#'+hex2(c.r)+hex2(c.g)+hex2(c.b); return `rgba(${c.r},${c.g},${c.b},${+c.a.toFixed(3)})`; }

const COLOR_RE=/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+%?\s*)?\)|\b(?:white|black)\b/g;
function parseTok(t){ if(t[0]==='#') return hexTo(t); if(NAMED[t]) {const [r,g,b]=NAMED[t]; return {r,g,b,a:1};}
  const n=t.match(/[\d.]+%?/g); let a=n[3]===undefined?1:(n[3].endsWith('%')?parseFloat(n[3])/100:parseFloat(n[3])); return {r:+n[0],g:+n[1],b:+n[2],a}; }
// 값 안의 색만 바꿈(url(...) 안은 %23hex 만 — 아이콘 선이라 글자 역할)
export function mapValue(v, role){
  let out='', i=0;
  const re=/url\(/gi; let m;
  const plain=s=>s.replace(COLOR_RE,t=>{ if(t[0]==='#'&&!/^#[0-9a-fA-F]+$/.test(t)) return t; return fmt(mapColor(parseTok(t),role)); });
  while((m=re.exec(v))){ out+=plain(v.slice(i,m.index)); let d=0,j=m.index+4; for(;j<v.length;j++){ if(v[j]==='(')d++; else if(v[j]===')'){ if(d===0)break; d--; } }
    out+=v.slice(m.index,j+1).replace(/%23([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g,(_,hx)=>'%23'+fmt(mapColor(hexTo('#'+hx),'text')).slice(1)); i=j+1; re.lastIndex=i; }
  return out+plain(v.slice(i));
}

const TEXT_PROPS=new Set(['color','-webkit-text-fill-color','caret-color','text-decoration-color','text-emphasis-color','-webkit-text-stroke-color']);
const COLOR_PROPS=/^(color|background|background-color|background-image|border|border-(top|right|bottom|left)(-color)?|border-color|border-(block|inline)(-start|-end)?(-color)?|outline|outline-color|box-shadow|text-shadow|fill|stroke|stop-color|flood-color|lighting-color|column-rule(-color)?|accent-color|caret-color|text-decoration(-color)?|text-emphasis-color|-webkit-text-fill-color|-webkit-text-stroke(-color)?|--[\w-]+)$/i;
function roleOf(prop, sel){
  prop=prop.toLowerCase();
  if(TEXT_PROPS.has(prop)) return 'text';
  if(prop==='box-shadow'||prop==='text-shadow') return 'shadow';
  if(prop==='fill'||prop==='stroke'){ return /(^|[\s>+~(,])(text|tspan)\b[^\s>+~]*$/.test(sel.trim()) ? 'text' : 'surface'; }
  if(prop.startsWith('--')){ if(/(line|stroke|bg|surface|fill|paper|plot|card|disabled|soft|tint|border|selected)/.test(prop)) return 'surface';
    if(/(ink|sub|muted|faint|on-|text|label|espresso)/.test(prop)) return 'text'; return 'surface'; }
  return 'surface';
}

// ---------- CSS 읽기 ----------
function stripComments(css){ return css.replace(/\/\*[\s\S]*?\*\//g,''); }
function splitTop(s, ch){ const out=[]; let d=0,q=null,cur='';
  for(const c of s){ if(q){ cur+=c; if(c===q)q=null; continue; } if(c==='"'||c==="'"){q=c;cur+=c;continue;} if(c==='('||c==='[')d++; if(c===')'||c===']')d--; if(c===ch&&d===0){out.push(cur);cur='';continue;} cur+=c; }
  if(cur.trim())out.push(cur); return out; }
function prefixSel(sel){
  return splitTop(sel,',').map(x=>{ x=x.trim(); if(!x) return x;
    let m;
    if((m=x.match(/^html(?![\w-])/))) return 'html'+MARK+':not(.yk-l2)'+x.slice(4);
    if((m=x.match(/^:root(?![\w-])/))) return ':root'+MARK+':not(.yk-l2)'+x.slice(5);
    return ':root'+MARK+' '+x;
  }).join(',');
}
// 블록 읽기: [{type:'rule',sel,decls} | {type:'at',prelude,children}]
function parseBlock(css){ const items=[]; let i=0;
  while(i<css.length){ while(i<css.length&&/\s|;/.test(css[i]))i++; if(i>=css.length)break;
    let j=i,d=0,q=null; for(;j<css.length;j++){ const c=css[j]; if(q){if(c===q)q=null;continue;} if(c==='"'||c==="'"){q=c;continue;} if(c==='(')d++; else if(c===')')d--; else if(d===0&&(c==='{'||c===';'))break; }
    const prelude=css.slice(i,j).trim();
    if(css[j]===';'||j>=css.length){ i=j+1; continue; }
    let k=j+1,depth=1; q=null; for(;k<css.length;k++){ const c=css[k]; if(q){if(c===q)q=null;continue;} if(c==='"'||c==="'"){q=c;continue;} if(c==='{')depth++; else if(c==='}'){depth--; if(depth===0)break;} }
    const inner=css.slice(j+1,k);
    if(prelude.startsWith('@')){ if(/^@(media|supports|layer|container)\b/i.test(prelude)) items.push({type:'at',prelude,children:parseBlock(inner)}); }
    else items.push({type:'rule',sel:prelude,decls:inner});
    i=k+1; }
  return items; }
// :root 변수 색표(마지막 정의) — 「color: var(--yk-blue-dark)」처럼 변수로 쓴 색도 쓰인 자리의 역할(글자/면)대로 옮기려고
let VARS={};
function collectVars(items){ for(const it of items){ if(it.type==='at'){ collectVars(it.children); continue; }
    if(!/(^|,)\s*(:root|html)(?![\w-])/.test(it.sel)) continue;
    for(const d of splitTop(it.decls,';')){ const p=d.indexOf(':'); if(p<0)continue; const k=d.slice(0,p).trim(); if(!k.startsWith('--'))continue;
      const v=d.slice(p+1).replace(/!important/i,'').trim(); if(/^(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))$/.test(v)) VARS[k]=v; } } }
function twin(items){ let out='';
  for(const it of items){
    if(it.type==='at'){ const inner=twin(it.children); if(inner) out+=it.prelude+'{'+inner+'}'; continue; }
    const ds=[]; for(const d of splitTop(it.decls,';')){ const p=d.indexOf(':'); if(p<0)continue; const prop=d.slice(0,p).trim(); let val=d.slice(p+1).trim(); if(!COLOR_PROPS.test(prop))continue;
      const imp=/!important\s*$/i.test(val); if(imp) val=val.replace(/\s*!important\s*$/i,'');
      // 순서 보존: 색 속성 선언은 값이 안 바뀌어도(브랜드 파랑 · transparent · var() · none) 모두 쌍둥이를 만든다 — 하나라도 빠지면
      //   그 규칙만 (0,2,0) 덜 올라가서 다른 쌍둥이에게 진다(예: 스위치 켜짐 파랑이 꺼짐 회색 쌍둥이에 짐). 사용자 변수는 색 · var()가 든 것만.
      if(prop.startsWith('--') && !COLOR_RE.test(val) && !/var\(/.test(val)){ COLOR_RE.lastIndex=0; continue; } COLOR_RE.lastIndex=0;
      if(prop.startsWith('--ic-')){ ds.push(prop+':'+val+(imp?'!important':'')); continue; }   // v404 — 입체 아이콘 그림은 다크에서도 그대로
      const vm=val.match(/^var\((--[\w-]+)(?:\s*,[^)]*)?\)$/);
      const nv = (vm && VARS[vm[1]] && !prop.startsWith('--')) ? mapValue(VARS[vm[1]], roleOf(prop,it.sel)) : mapValue(val, roleOf(prop,it.sel));
      ds.push(prop+':'+nv+(imp?'!important':'')); }
    if(ds.length) out+=prefixSel(it.sel)+'{'+ds.join(';')+'}';
  }
  return out; }

// 손으로 정한 예외(일반 규칙으로는 안 되는 것) — :not(#…) 여섯 개로 어떤 쌍둥이보다도 높게.
//   켬/끔 스위치: 손잡이는 흰색 그대로(어둡게 바뀌면 끈 막대와 구분이 안 됨) · 끈 막대는 카드보다 한 단계 밝은 회색.
const XP=':root'+MARK+':not(#y1):not(#y2):not(#y3):not(#y4):not(#y5):not(#y6) ';
const EXTRAS=[
  ['.sw::after, .main-no-loan input::before', 'background:#F2F4F7!important'],
  ['.sw:not(.on):not([aria-checked="true"])::before, .main-no-loan input:not(:checked)', 'background:#3A3F47!important'],
];
export function buildDark(html){
  const styles=[]; html.replace(/<style([^>]*)>([\s\S]*?)<\/style>/g,(all,attr,css)=>{ if(!attr.includes(`id="${DARK_ID}"`)) styles.push(css); return all; });
  const parsed=styles.map(css=>parseBlock(stripComments(css))); VARS={}; for(const p of parsed) collectVars(p);
  let body=''; for(const p of parsed) body+=twin(p);
  // SVG 그림의 fill/stroke 속성(마크업 · 스크립트 문자열) · 인라인 style 색 — 문서 밖 그림(저장 이미지 SVG→캔버스)에는 닿지 않음
  const rest=html.replace(/<style[^>]*>[\s\S]*?<\/style>/g,'');
  const attrs=[...new Set(rest.match(/\b(fill|stroke|stop-color)="#[0-9a-fA-F]{3,8}"/g)||[])].sort();
  for(const a of attrs){ const [, prop, hx]=a.match(/^([\w-]+)="(#[0-9a-fA-F]+)"$/); const c=hexTo(hx);
    body+=`:root${MARK} [${prop}="${hx}" i]{${prop}:${fmt(mapColor(c,'surface'))}}`;
    if(prop==='fill') body+=`:root${MARK} text[fill="${hx}" i]{fill:${fmt(mapColor(c,'text'))}}`; }
  const inl=[...new Set(rest.match(/style="(?:background|color):#[0-9a-fA-F]{3,6}"/g)||[])].sort();
  for(const a of inl){ const [, prop, hx]=a.match(/^style="([\w-]+):(#[0-9a-fA-F]+)"$/);
    body+=`:root${MARK} [style="${prop}:${hx}"]{${prop}:${fmt(mapColor(hexTo(hx),prop==='color'?'text':'surface'))}!important}`; }
  for(const [sel,decl] of EXTRAS) body+=splitTop(sel,',').map(x=>XP+x.trim()).join(',')+'{'+decl+'}';
  return `<style id="${DARK_ID}">\n/* v401 — 다크 모드(폰 · PC 설정이 다크일 때 자동). tools/dark.mjs 가 만든 덩어리 — 손으로 고치지 말고 생성기를 다시 돌린다. 원리 · 색 옮기는 규칙은 생성기 머리 주석. */\n@media (prefers-color-scheme:dark){:root${MARK}{color-scheme:dark}${body}}\n</style>`;
}
export function applyDark(html){
  if(!html.includes(META_DARK)) html=html.replace(/<head>\n?/, m=>m+(m.endsWith('\n')?'':'\n')+META_LIGHT+'\n'+META_DARK+'\n');   // 주소창 색(안내 페이지에도) — <head> 바로 뒤(안내 페이지 v391 덩어리는 </head> 바로 앞이어야 함)
  const block=buildDark(html); const re=new RegExp(`<style id="${DARK_ID}">[\\s\\S]*?<\\/style>`);
  if(re.test(html)) return html.replace(re,()=>block);
  const anchor='</body>'; const i=html.lastIndexOf(anchor); return html.slice(0,i)+block+'\n'+html.slice(i);
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'); const check=process.argv.includes('--check'); let stale=[];
  for(const name of PAGES){ const file=path.join(root,name); const html=fs.readFileSync(file,'utf8'); const next=applyDark(html);
    if(check){ if(next!==html) stale.push(name); continue; }
    if(next!==html) fs.writeFileSync(file,next); const m=next.match(new RegExp(`<style id="${DARK_ID}">[\\s\\S]*?<\\/style>`))[0]; console.log(name.padEnd(22), '다크 덩어리', m.length, 'bytes'); }
  if(check){ if(stale.length){ console.error('다크 덩어리가 생성 결과와 다름: '+stale.join(', ')+' — node tools/dark.mjs 로 다시 만드세요'); process.exit(1);} console.log('다크 덩어리 최신(16개 문서)'); }
}
