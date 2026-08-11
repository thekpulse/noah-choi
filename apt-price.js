/* ===================================================================
   국토교통부 아파트 매매 실거래가 프록시  —  v24.0
   Vercel Serverless Function.  GET /api/apt-price?lawd=11110&ymd=202608

   🔴 확인한 것 (2026.08.11 · 공공데이터포털 문서)
     엔드포인트 http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev
                /getRTMSDataSvcAptTradeDev
     요청  serviceKey · LAWD_CD(시군구 5자리) · DEAL_YMD(YYYYMM) · pageNo · numOfRows
     응답  aptNm · buildYear · excluUseAr · dealAmount · umdNm · jibun · floor
           dealYear/Month/Day · sggCd · roadNm · rgstDate · dealingGbn
           cdealType · cdealDay · estateAgentSggNm · buyerGbn · slerGbn
           landLeaseholdGbn · aptDong · aptSeq · bonbun · bubun · landCd …

   🔴 응답에 **없는 것** — 세대수 · 역세권 · 학군 · 좌표.
      그래서 「1,000세대」·「역세권」·「학군」 칩은 이 API만으로 만들 수 없습니다.
      만들 수 있는 취향 칩은 buildYear를 쓰는 **「신축」 하나**뿐입니다.
      없는 값을 지어내지 않습니다(지침 — 출처를 못 찾으면 넣지 않는다).

   🔴 이 함수가 지키는 것
     1. 서비스 키는 **서버에만** 둡니다. 클라이언트로 내려보내지 않습니다.
     2. **해제된 거래(cdealType==='O')를 버립니다.** 취소된 거래를 시세로 보여주면
        사용자가 없는 가격을 믿게 됩니다(원칙 28에 걸리는 방향).
     3. **토지임대부(landLeaseholdGbn==='Y')를 버립니다.** 가격 성격이 일반 매매와 다릅니다.
     4. 지역코드 + 년월 단위로 **메모리 캐시**. 같은 달을 사용자마다 다시 부르지 않습니다.
     5. 실패하면 **200 + 빈 배열**을 돌려줍니다. 계산기는 절대 멈추지 않습니다.
     6. 개인정보는 오지 않습니다 — 소득·현금은 이 경로를 지나지 않습니다.

   ⚠ 환경변수 `MOLIT_API_KEY` 에 **디코딩된** 서비스 키를 넣으세요.
     인코딩 키를 넣으면 이중 인코딩이 되어 SERVICE_KEY_IS_NOT_REGISTERED가 납니다.
   =================================================================== */

const BASE = 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev'
           + '/getRTMSDataSvcAptTradeDev';

/* 서버리스 인스턴스가 살아 있는 동안만 유지되는 캐시.
   지난 달 데이터는 더 이상 바뀌지 않으므로 오래 들고 있어도 됩니다.
   이번 달은 계속 쌓이므로 짧게 잡습니다. */
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

/* XML 한 항목에서 태그 하나를 꺼냅니다.
   ⚠ 정규식으로 XML을 파싱하는 것은 일반적으로 나쁜 습관이지만,
     이 응답은 중첩이 없는 평평한 <item> 목록이고 의존성을 하나도 안 늘리는 쪽을 택했습니다. */
const tag = (xml, name) => {
  const m = xml.match(new RegExp('<' + name + '>([\\s\\S]*?)</' + name + '>'));
  return m ? m[1].trim() : '';
};

function parseItems(xml){
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return blocks.map(b => {
    /* 거래금액은 「  39,500」처럼 공백·콤마가 섞여 옵니다. 만원 단위 정수입니다. */
    const amountMan = parseInt(tag(b, 'dealAmount').replace(/[^\d]/g, ''), 10);
    const area      = parseFloat(tag(b, 'excluUseAr'));
    const year      = parseInt(tag(b, 'buildYear'), 10);
    return {
      name:   tag(b, 'aptNm'),
      dong:   tag(b, 'umdNm'),
      areaM2: Number.isFinite(area) ? Math.round(area * 10) / 10 : null,
      floor:  parseInt(tag(b, 'floor'), 10) || null,
      buildYear: Number.isFinite(year) ? year : null,
      amountMan: Number.isFinite(amountMan) ? amountMan : null,
      y: parseInt(tag(b, 'dealYear'), 10)  || null,
      m: parseInt(tag(b, 'dealMonth'), 10) || null,
      d: parseInt(tag(b, 'dealDay'), 10)   || null,
      /* 아래 둘은 걸러내기 위해서만 읽고, 클라이언트로 내보내지 않습니다. */
      _canceled: tag(b, 'cdealType') === 'O',
      _leasehold: tag(b, 'landLeaseholdGbn') === 'Y'
    };
  }).filter(x =>
    x.name && x.amountMan > 0 && !x._canceled && !x._leasehold
  ).map(({ _canceled, _leasehold, ...keep }) => keep);
}

module.exports = async function handler(req, res){
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');

  const lawd = String((req.query && req.query.lawd) || '').replace(/[^\d]/g, '');
  const ymd  = String((req.query && req.query.ymd)  || '').replace(/[^\d]/g, '');

  /* 입력을 믿지 않습니다 — 그대로 흘리면 이 함수가 남의 요청을 대신 쏘는 통로가 됩니다. */
  if(lawd.length !== 5 || ymd.length !== 6)
    return res.status(200).json({ ok:false, reason:'bad-param', items:[] });

  const key = lawd + ':' + ymd;
  const hit = cacheGet(key);
  if(hit) return res.status(200).json({ ok:true, cached:true, items:hit });

  const serviceKey = process.env.MOLIT_API_KEY;
  if(!serviceKey)
    return res.status(200).json({ ok:false, reason:'no-key', items:[] });

  try{
    const url = BASE
      + '?serviceKey=' + encodeURIComponent(serviceKey)
      + '&LAWD_CD='    + lawd
      + '&DEAL_YMD='   + ymd
      + '&pageNo=1&numOfRows=1000';

    /* 공공 API가 느릴 때 함수가 통째로 매달리지 않게 끊습니다. */
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if(!r.ok) return res.status(200).json({ ok:false, reason:'upstream-'+r.status, items:[] });

    const xml = await r.text();
    /* 키가 잘못됐거나 한도를 넘기면 200에 에러 XML이 옵니다. 코드를 봐야 압니다. */
    const code = tag(xml, 'resultCode');
    if(code && code !== '00' && code !== '000')
      return res.status(200).json({ ok:false, reason:'api-'+code, items:[] });

    const items = parseItems(xml);
    cacheSet(key, items, ymd);
    return res.status(200).json({ ok:true, cached:false, items });
  }catch(e){
    /* 타임아웃·네트워크 오류 — 그래도 200입니다. 화면은 「없음」으로 넘어갑니다. */
    return res.status(200).json({ ok:false, reason:'fetch-failed', items:[] });
  }
};
