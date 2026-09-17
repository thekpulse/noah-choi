/* ===================================================================
   공동주택(K-apt) 세대수 프록시  —  v118(서비스 새 판 AptListService4 · AptBasisInfoServiceV5)
   Vercel Serverless Function.  GET /api/apt-units?lawd=41135&part=0

   왜: 앱 안의 세대수 표(APT_UNITS)는 서울 25구 2,939곳뿐이라 경기·인천에서는 세대수가 한 번도
       안 붙고, 서울도 표에 없는 단지가 많음(v112 표본 181곳 중 약 109곳). 오너가 공공데이터포털에서
       두 서비스를 활용신청 승인받음(2026-08-24 · 개발계정):
         ① 국토교통부_공동주택 단지 목록제공 서비스   AptListService3/getSigunguAptList3  (시군구 → 단지코드·단지명)
         ② 국토교통부_공동주택 기본 정보제공 서비스   AptBasisInfoServiceV4/getAphusBassInfoV4 (단지코드 → 세대수 kaptdaCnt · 법정동주소 kaptAddr)
       인증키는 실거래 프록시와 같은 MOLIT_API_KEY(공공데이터포털 계정 키 하나가 승인된 서비스 전부에 통함).

   셈: ①로 시군구 단지 목록(최대 1,000건 × 페이지) → 그중 part 번째 조각(PART 곳)만 ②를 동시에 불러
       [법정동, 단지명, 세대수] 줄로 돌려줌. 화면이 part 0 응답의 parts 를 보고 나머지 조각을 차례로 부름.
       한 요청이 Vercel 함수 시간 안에 끝나게 조각을 나눔(조각당 ② 최대 PART 번).
   캐시: 세대수는 거의 안 바뀜 → CDN s-maxage 30일. 일부 실패한 조각은 1시간만.
   ⚠ 개발계정 일일 호출 한도(서비스별 5,000건 · 포털 표기). 시군구 하나를 처음 채우면 단지 수만큼 ②를 씀 —
     캐시가 차면 다시 안 부름. 모자라면 포털에서 운영계정 신청(활용사례 등록).
   ⚠ 이 파일은 실제 공공데이터 응답으로 돌려 보지 못했습니다(작업 환경에서 data.go.kr 차단 · 2026-09-17).
     응답이 JSON/XML 어느 쪽이어도, 필드가 item/items 어느 모양이어도 읽게 짰습니다. 배포 뒤 첫 확인:
       /api/apt-units?lawd=11200&part=0  → ok:true · total > 0 · items 에 [동, 이름, 세대수]
   =================================================================== */

/* v117b — 운영 첫 응답이 list-failed(2026-09-17 · www·vercel.app 둘 다). 서비스 주소를 확정 못 해 **후보를 차례로** 시도하고,
   실패하면 후보마다 HTTP 상태·응답 앞 160자(키 가림)를 돌려줘 원인을 화면에서 읽게 함. 처음 성공한 후보를 인스턴스에 기억. */
/* v118 — v117c 운영 진단(vercel.app · 2026-09-17): 후보 넷 전부 400 **NO_OPENAPI_SERVICE_ERROR 「해당 오픈API 서비스가 없거나 폐기됨」**(0.4~0.6초).
   포털 영문 상세(2026-09-17 확인): 단지 목록 = **AptListService4**(요청 예 getSidoAptList4) · 기본 정보 = **AptBasisInfoServiceV5**(요청 예 getAphusDtlInfoV5).
   포털 「최종 수정 2026-08-07」에 판이 올라가 옛 V3/V4 가 폐기된 것으로 봄. 새 판을 맨 앞에 · 옛 판은 뒤에 남김(한 번에 동시 호출이라 비용 작음). */
const LISTS = [
  'https://apis.data.go.kr/1613000/AptListService4/getSigunguAptList4',
  'https://apis.data.go.kr/1613000/AptListService3/getSigunguAptList3',
  'https://apis.data.go.kr/1613000/AptListService2/getSigunguAptList',
];
const INFOS = [
  'https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusBassInfoV5',
  'https://apis.data.go.kr/1613000/AptBasisInfoServiceV5/getAphusDtlInfoV5',
  'https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4',
  'https://apis.data.go.kr/1613000/AptBasisInfoServiceV3/getAphusBassInfoV3',
];
let LIST = null, INFO = null;   /* 성공한 후보 */
/* v117c — 운영 v117b 진단(2026-09-17): 목록 후보 넷 모두 status 0 · AbortError = **4초 안에 응답이 안 옴**(주소가 틀리면 404 등 상태가 옴).
   같은 서버의 실거래 API 는 6초 안에 옴 → 이 서비스가 느린 것으로 봄. 대기를 늘리고(목록 20초 · 기본정보 10초) 후보를 **동시에** 불러 한 요청 시간을 줄임.
   Vercel 함수 최대 시간 60초로 요청(module.exports.config). */
const T_LIST = 20000, T_INFO = 10000;
const PART = 20;           /* 조각당 단지 수(= ② 호출 수) · v117c 40 → 20(응답이 느려 한 요청 시간을 줄임) */
const CONC = 10;           /* ② 동시 호출 */
const SIDO_OK = ['11', '28', '41'];   /* 오너 결정 2026-09-17 「수도권까지」 */

const LIST_CACHE = new Map();   /* 인스턴스 메모리: 시군구 목록(조각마다 다시 안 부르게) */
const LIST_TTL = 6 * 60 * 60 * 1000;

const tag = (xml, name) => { const m = String(xml).match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>')); return m ? m[1].trim() : ''; };

/* JSON 이든 XML 이든 item 목록으로 */
function itemsOf(text){
  const t = String(text || '').trim();
  if (t.startsWith('{')) {
    let j; try { j = JSON.parse(t); } catch { return { code: 'parse', items: [], total: 0 }; }
    const head = (j.response && j.response.header) || j.header || {};
    const body = (j.response && j.response.body) || j.body || {};
    let it = body.items; if (it && !Array.isArray(it)) it = it.item != null ? it.item : it;
    if (body.item && !it) it = body.item;
    const items = it == null ? [] : (Array.isArray(it) ? it : [it]);
    return { code: String(head.resultCode || '00'), items, total: Number(body.totalCount) || items.length };
  }
  const blocks = t.match(/<item>[\s\S]*?<\/item>/g) || [];
  const items = blocks.map(b => { const o = {}; for (const m of b.replace(/^<item>|<\/item>$/g, "").matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) o[m[1]] = m[2].trim(); return o; });
  return { code: tag(t, 'resultCode') || '00', items, total: Number(tag(t, 'totalCount')) || items.length };
}

/* 법정동주소 「경기도 성남시 분당구 정자동 123 …」 → 「정자동」(없으면 읍·면) */
function dongOf(addr){
  const w = String(addr || '').split(/\s+/).slice(1);
  return w.find(x => /(동|\d+가|리)$/.test(x) && !/(시|군|구)$/.test(x)) || w.find(x => /(읍|면)$/.test(x)) || '';
}

const LAST = { tries: [] };   /* 진단: 후보별 결과 */
const peek = (t, key) => String(t || '').replace(key ? new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g') : /$^/, '***').replace(/\s+/g, ' ').slice(0, 160);
async function get(url, ms, key){
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), ms); const t0 = Date.now();
  try { const r = await fetch(url, { signal: ctrl.signal }); const text = await r.text();
        if (key !== undefined) LAST.tries.push({ at: url.split('?')[0], status: r.status, ms: Date.now() - t0, head: peek(text, key) });
        return r.ok ? text : null; }
  catch (e) { if (key !== undefined) LAST.tries.push({ at: url.split('?')[0], status: 0, ms: Date.now() - t0, head: String(e && (e.name || e.message) || 'error') + (e && e.cause ? ' · ' + String(e.cause.code || e.cause.message || '') : '') }); return null; }
  finally { clearTimeout(timer); }
}

async function listOf(key, lawd){
  const hit = LIST_CACHE.get(lawd); if (hit && Date.now() < hit.exp) return hit.val;
  const all = [];
  if (!LIST) {   /* 후보 고르기: 첫 페이지가 목록 모양으로 오는 주소 */
    LAST.tries = [];
    const texts = await Promise.all(LISTS.map(base => get(`${base}?${new URLSearchParams({ serviceKey: key, sigunguCode: lawd, pageNo: '1', numOfRows: '10' })}`, T_LIST, key)));
    for (let k = 0; k < LISTS.length; k++) { const text = texts[k]; if (text == null || /returnReasonCode/.test(text)) continue;
      const r = itemsOf(text); if ((r.code === '00' || r.code === '000') && r.items.some(x => x.kaptCode)) { LIST = LISTS[k]; break; } }
    if (!LIST) return { error: 'list-failed', tries: LAST.tries };
  }
  for (let page = 1; page <= 20; page++) {
    const q = new URLSearchParams({ serviceKey: key, sigunguCode: lawd, pageNo: String(page), numOfRows: '1000' });
    const text = await get(`${LIST}?${q}`, T_LIST); if (text == null) return { error: 'list-failed' };
    /* 키 미등록·트래픽 초과는 게이트웨이가 다른 껍데기(OpenAPI_ServiceResponse · returnReasonCode)로 답함 */
    const gw = String(text).match(/<returnReasonCode>(\d+)<\/returnReasonCode>/); if (gw) return { error: 'gateway-' + gw[1] };
    const r = itemsOf(text); if (r.code !== '00' && r.code !== '000') return { error: 'api-' + r.code };
    for (const x of r.items) if (x.kaptCode) all.push({ code: String(x.kaptCode), name: String(x.kaptName || '') });
    if (all.length >= r.total || r.items.length < 1000) break;
  }
  if (LIST_CACHE.size > 100) LIST_CACHE.delete(LIST_CACHE.keys().next().value);
  LIST_CACHE.set(lawd, { val: all, exp: Date.now() + LIST_TTL });
  return all;
}

async function pickInfo(key, c){
  LAST.tries = [];
  const texts = await Promise.all(INFOS.map(base => get(`${base}?${new URLSearchParams({ serviceKey: key, kaptCode: c.code })}`, T_INFO, key)));
  for (let k = 0; k < INFOS.length; k++) { const text = texts[k]; if (text == null || /returnReasonCode/.test(text)) continue;
    const r = itemsOf(text); if (r.items[0] && (r.items[0].kaptdaCnt != null || r.items[0].kaptName)) { INFO = INFOS[k]; return true; } }
  return false;
}
async function infoOf(key, c){
  const q = new URLSearchParams({ serviceKey: key, kaptCode: c.code });
  const text = await get(`${INFO}?${q}`, T_INFO); if (text == null) return null;
  const r = itemsOf(text); const x = r.items[0]; if (!x) return null;
  const units = parseInt(String(x.kaptdaCnt || '').replace(/[^\d]/g, ''), 10);
  if (!(units > 0)) return false;   /* 세대수 없는 단지 — 실패가 아니라 빈칸 */
  return [dongOf(x.kaptAddr), String(x.kaptName || c.name), units];
}

module.exports = async function handler(req, res){
  const lawd = String((req.query && req.query.lawd) || '').replace(/[^\d]/g, '');
  const part = Math.max(0, parseInt((req.query && req.query.part) || '0', 10) || 0);
  const short = () => res.setHeader('Cache-Control', 'no-store');   /* v118 — 실패는 캐시 안 함 */
  if (lawd.length !== 5 || !SIDO_OK.includes(lawd.slice(0, 2))) { short(); return res.status(200).json({ ok:false, reason:'bad-param', items:[] }); }
  const key = process.env.MOLIT_API_KEY;
  if (!key) { short(); return res.status(200).json({ ok:false, reason:'no-key', items:[] }); }

  const list = await listOf(key, lawd);
  if (!list || list.error) { short(); return res.status(200).json({ ok:false, reason: list ? list.error : 'list-failed', tries: (list && list.tries) || [], items:[] }); }
  if (!INFO && list.length && !(await pickInfo(key, list[0]))) { short(); return res.status(200).json({ ok:false, reason:'info-failed', tries: LAST.tries, items:[] }); }
  const parts = Math.ceil(list.length / PART);
  const slice = list.slice(part * PART, (part + 1) * PART);
  const out = []; let failed = 0;
  for (let i = 0; i < slice.length; i += CONC) {
    const got = await Promise.all(slice.slice(i, i + CONC).map(c => infoOf(key, c)));
    for (const g of got) { if (g === null) failed++; else if (g) out.push(g); }
  }
  res.setHeader('Cache-Control', failed ? 'public, s-maxage=3600' : 'public, s-maxage=2592000, stale-while-revalidate=604800');
  return res.status(200).json({ ok:true, lawd, part, parts, total:list.length, failed, items: out });
};
module.exports.config = { maxDuration: 60 };   /* v117c — 느린 공공데이터 응답 대기(Vercel 요금제 한도 안에서 적용) */
module.exports._test = { itemsOf, dongOf, PART, reset: () => { LIST = null; INFO = null; } };
