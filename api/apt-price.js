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

/* 🔴 v134 (2026-09-18) — **게이트웨이 오류를 「거래 없음」으로 안 읽습니다 · 한 번 다시 부릅니다.**

   오너 「갑자기 실거래 정보가 불러지지 않네」 → 한 시간 뒤 「엥 이제 잘 나오네?」.
   운영 실측(2026-09-18): 서울·경기·인천·지방 16개 구 × 3개월 전부 `ok:true`, 콘솔 오류 0.
   **고장이 남아 있지 않아 재현이 안 됩니다** — 잠깐 났다가 스스로 나은 모양입니다.

   찾은 자리는 여기입니다. 공공데이터포털은 **키 미등록·일일 트래픽 초과**를 본문이 아니라
   **다른 껍데기**로 답합니다(`<OpenAPI_ServiceResponse><cmmMsgHeader><returnReasonCode>22`).
   그 껍데기에는 `<resultCode>` 도 `<item>` 도 없습니다. v133 까지 이 파일은

     const code = tag(xml, 'resultCode');        → ''  (없음)
     if(code && code !== '00' …)                 → 빈 문자열이라 **검사를 통과**
     parseItems(xml)                             → <item> 이 없으니 []

   를 거쳐 **`{ok:true, items:[]}`**, 즉 「그 달에 거래가 한 건도 없었다」로 돌려보냈습니다.
   게다가 그 거짓 빈 값을 **캐시에 넣었습니다**(인스턴스 30분/24시간 · CDN s-maxage 1800 +
   stale-while-revalidate 86400). 화면은 실패가 아니라고 들었으니 「다시 불러오기」도 안 냅니다.
   → 「갑자기 거래가 없다」 → 한도가 자정에 풀리거나 캐시가 비면 **저절로 정상** 이 그대로 나옵니다.
   ⚠ 같은 껍데기를 `api/apt-units.js` 는 v117b 부터 이미 걸러 냅니다(`returnReasonCode`). 이 파일만 빠져 있었습니다.

   고친 것 셋:
     ① 게이트웨이 껍데기 → `gateway-NN` 실패(no-store · 캐시 안 함). 화면이 「불러오지 못했어요 · 다시 불러오기」로 섭니다.
     ② `<resultCode>` 가 아예 없는 응답(HTML 오류 쪽지 등) → `no-body` 실패. **빈 성공으로 캐시하지 않습니다.**
        ⚠ 진짜 빈 달은 `<resultCode>00</resultCode>` + `<totalCount>0</totalCount>` 가 옵니다 — 그대로 성공입니다.
     ③ 전송 실패·5xx 는 **한 번 다시** 부릅니다(10초 + 10초 · 함수 30초 안). 잠깐 흔들린 것이면 여기서 끝납니다.
   ⚠ 캐시 키의 판 번호를 올립니다(v25 → v134). 안 올리면 **살아 있는 인스턴스에 남은 거짓 빈 값**이
     최대 24시간 그대로 나갑니다 — 「고쳤는데 여전히 거래가 없다」로 보입니다(v25.0 주석과 같은 이유).
   ⚠ **원인을 단정하지 않았습니다.** 트래픽 초과인지 순간 장애인지는 이 파일에서 알 수 없습니다.
     다음에 또 나면 화면이 `gateway-22` 처럼 **이유를 말하고** 서므로 그때 가려집니다(원칙: 짐작을 화면에 적지 않기). */
const BASE = 'https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade'
           + '/getRTMSDataSvcAptTrade';

const TIMEOUT = 10000;   /* v134 — 한 번 부를 때 대기(10초). 두 번까지 → 최대 20초 · maxDuration 30초 안 */

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
  const m = String(xml).match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>'));
  return m ? m[1].trim() : '';
};

/* 🔴 v134 — **게이트웨이 껍데기 판별.** 포털이 본문 대신 돌려보내는 오류 쪽지입니다.
     <OpenAPI_ServiceResponse><cmmMsgHeader>
       <returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg>
       <returnReasonCode>22</returnReasonCode>          (22 트래픽 초과 · 30 키 미등록 · …)
   ⚠ 이유 코드만 돌려줍니다. 사람 말로 바꾸지 않습니다 — 코드표는 포털 것이고 여기서 베껴 두면
     포털이 바꿨을 때 이 파일만 조용히 틀린 말을 하게 됩니다. */
const gatewayCode = (xml) => {
  const m = String(xml).match(/<returnReasonCode>\s*(\d+)\s*<\/returnReasonCode>/);
  return m ? m[1] : '';
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
  const key = 'v134:' + lawd + ':' + ymd;
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

    /* 🔴 v134 — **한 번 더 부릅니다.** 첫 번째가 전송 실패(끊김·시간 초과)나 5xx 면 잠깐 흔들린 것일 수
       있습니다. 그때 바로 실패로 세우면 화면이 「불러오지 못했어요」로 서고, 사람이 버튼을 눌러야 합니다.
       ⚠ 4xx 는 **다시 안 부릅니다** — 잘못 부른 것이지 흔들린 것이 아닙니다. 같은 요청을 또 보내면
         한도만 두 배로 씁니다(이번 사고의 유력한 원인이 바로 한도입니다).
       ⚠ 대기 10초 × 2 = 최대 20초. 함수 한도 30초 안입니다. */
    let last = 'fetch-failed';
    for(let attempt = 0; attempt < 2; attempt++){
      let r;
      try{
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
        try{ r = await fetch(url, { signal: ctrl.signal }); }
        finally{ clearTimeout(timer); }
      }catch(e){
        last = 'fetch-failed';
        continue;                       /* 전송 실패 — 한 번 더 */
      }

      if(!r.ok){
        last = 'upstream-' + r.status;
        if(r.status >= 500) continue;   /* 서버 쪽 일시 오류 — 한 번 더 */
        return fail(last);              /* 4xx — 다시 불러도 같습니다 */
      }

      const xml = await r.text();

      /* ① 게이트웨이 껍데기(키 미등록 · 트래픽 초과 …) — **거래 없음이 아닙니다.** */
      const gw = gatewayCode(xml);
      if(gw) return fail('gateway-' + gw);

      const code = tag(xml, 'resultCode');

      /* ② 본문 모양이 아닌 응답(HTML 오류 쪽지 등) — 빈 성공으로 **캐시하지 않습니다.**
         진짜 빈 달은 resultCode 가 옵니다(00 · 000). 그 경우는 아래로 내려가 성공입니다. */
      if(!code) return fail('no-body');

      if(code !== '00' && code !== '000')
        return fail('api-' + code);

      const items = parseItems(xml);
      cacheSet(key, items, ymd);
      return res.status(200).json({ ok:true, cached:false, items });
    }
    return fail(last);
  }catch(e){
    return fail('fetch-failed');
  }
};
module.exports.config = { maxDuration: 30 };   /* v134 — 10초 × 2 + 여유 */
