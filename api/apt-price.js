/* ===================================================================
   국토교통부 아파트 매매 실거래가 프록시  —  v25.0 (Production)
   Vercel Serverless Function.  GET /api/apt-price?lawd=11110&ymd=202608

   🔴 v25.0 (2026-09-15) — **지번을 한 필드 더 실어 보냅니다.**
     화면의 지도가 카카오(단지명 검색)에서 **네이버**로 바뀌었는데, 네이버 JS API 에는
     단지명 검색이 없고 **주소↔좌표 변환만** 있습니다. 그래서 좌표를 「시도 + 시군구 +
     법정동 + 지번」으로 찾습니다. 지번은 국토부 원본에 **이미 들어 있는 값**이고,
     지금까지 이 파일이 버리고 있었습니다. 만들거나 계산하는 값이 아닙니다.
   ⚠ 값이 없으면 **빈 문자열**입니다. 화면은 빈 값을 「없음」으로 보고 그 단지를 조용히
     건너뜁니다(짐작한 주소로 묻지 않습니다).
   ⚠ 필드 이름이 바뀌었을 때를 대비해 `jibun` → `지번` 순으로 봅니다. 둘 다 없으면 빈 값이고,
     그때 화면은 「확인된 단지 위치가 없어요」로 섭니다 — 깨지지 않습니다.
   =================================================================== */

/* 🔴 v118 (2026-09-17) — **https 로 바꿈 · 실패 응답은 캐시 안 함 · 대기 15초.**
   오너 「갑자기 실거래 연동이 안 됨 · 거래가 없다고 뜸」 → 운영 실측: 이번 달(202608) 조회가 여러 구에서 `fetch-failed`(6초 안에 응답 없음),
   캐시에 남은 지난달 응답만 옴. 공공데이터포털 공지(2026-08-03 · NOTICE_0000000004907): 「http(80포트) 호출이 정상 처리되지 않는 현상 …
   안정적인 이용을 위해 https(443포트)로 호출」. 게다가 이 파일은 **실패 응답에도 s-maxage=1800 · stale-while-revalidate=86400** 을 붙여
   한 번 실패하면 CDN 이 그 실패를 최대 하루 다시 내보낼 수 있었음 → 실패는 no-store. */
const BASE = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade'
           + '/getRTMSDataSvcAptTrade';

const CACHE = new Map();
const TTL_CLOSED = 24 * 60 * 60 * 1000;   /* 지난 달 — 24시간 */
const TTL_OPEN   =      30 * 60 * 1000;   /* 이번 달 — 30분 */
const CACHE_MAX  = 200;                   /* 인스턴스 메모리를 무한정 먹지 않게 */

const nowYmd = () => {
  const d = new Date();
  return d.getFullYear() * 100 + (d.getMonth() + 1);
};

function cacheGet(key){
  const hit = CACHE.get(key);
  if(!hit) return null;
  if(Date.now() > hit.exp){ CACHE.delete(key); return null; }
  return hit.val;
}
function cacheSet(key, val, ymd){
  if(CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(key, { val, exp: Date.now() + (+ymd >= nowYmd() ? TTL_OPEN : TTL_CLOSED) });
}

const tag = (xml, name) => {
  const m = xml.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>'));
  return m ? m[1].trim() : '';
};

function parseItems(xml){
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return blocks.map(b => {
    const amountMan = parseInt(tag(b, 'dealAmount').replace(/[^\d]/g, ''), 10);
    const area      = parseFloat(tag(b, 'excluUseAr'));
    const year      = parseInt(tag(b, 'buildYear'), 10);
    return {
      name:   tag(b, 'aptNm'),
      dong:   tag(b, 'umdNm'),
      /* 🔴 v25.0 — 지도가 좌표를 찾는 데 쓰는 값. 가공하지 않고 그대로 옮깁니다
         (「680-63」 · 「17」 · 「산 12-3」). tag() 가 이미 앞뒤 공백을 뗍니다. */
      jibun:  tag(b, 'jibun') || tag(b, '지번'),
      areaM2: Number.isFinite(area) ? Math.round(area * 10) / 10 : null,
      floor:  parseInt(tag(b, 'floor'), 10) || null,
      buildYear: Number.isFinite(year) ? year : null,
      amountMan: Number.isFinite(amountMan) ? amountMan : null,
      y: parseInt(tag(b, 'dealYear'), 10)  || null,
      m: parseInt(tag(b, 'dealMonth'), 10) || null,
      d: parseInt(tag(b, 'dealDay'), 10)   || null,
      _canceled: tag(b, 'cdealType') === 'O',
      _leasehold: tag(b, 'landLeaseholdGbn') === 'Y'
    };
  }).filter(x =>
    x.name && x.amountMan > 0 && !x._canceled && !x._leasehold
  ).map(({ _canceled, _leasehold, ...keep }) => keep);
}

module.exports = async function handler(req, res){
  /* v118 — 성공 응답만 CDN 캐시. 실패는 아래 fail() 이 no-store 로 덮음 */
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
  const fail = (reason) => { res.setHeader('Cache-Control', 'no-store'); return res.status(200).json({ ok:false, reason, items:[] }); };

  const lawd = String((req.query && req.query.lawd) || '').replace(/[^\d]/g, '');
  const ymd  = String((req.query && req.query.ymd)  || '').replace(/[^\d]/g, '');

  if(lawd.length !== 5 || ymd.length !== 6)
    return fail('bad-param');

  /* 🔴 v25.0 — 캐시 키에 **판 번호**를 넣습니다. 안 넣으면 배포 직후에도 옛 응답(지번 없음)이
     최대 24시간 그대로 나갑니다 — 「고쳤는데 지도가 여전히 비어 있다」로 보입니다.
     ⚠ 이 인스턴스 메모리 캐시는 배포하면 비워지지만, **살아 있는 인스턴스가 남아 있으면**
       그쪽은 옛 값을 계속 들고 있습니다. 판 번호가 그 경우를 막습니다. */
  const key = 'v25:' + lawd + ':' + ymd;
  const hit = cacheGet(key);
  if(hit) return res.status(200).json({ ok:true, cached:true, items:hit });

  const serviceKey = process.env.MOLIT_API_KEY;
  if(!serviceKey)
    return fail('no-key');

  try{
    const params = new URLSearchParams({
      serviceKey: serviceKey,
      LAWD_CD: lawd,
      DEAL_YMD: ymd,
      pageNo: '1',
      numOfRows: '1000'
    });

    const url = `${BASE}?${params.toString()}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);   /* v118 — 6초 → 15초(느린 응답에서 바로 실패로 끊지 않게) */
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if(!r.ok) return fail('upstream-'+r.status);

    const xml = await r.text();
    const code = tag(xml, 'resultCode');
    if(code && code !== '00' && code !== '000')
      return fail('api-'+code);

    const items = parseItems(xml);
    cacheSet(key, items, ymd);
    return res.status(200).json({ ok:true, cached:false, items });
  }catch(e){
    return fail('fetch-failed');
  }
};
module.exports.config = { maxDuration: 30 };   /* v118 — 15초 대기 + 여유 */
