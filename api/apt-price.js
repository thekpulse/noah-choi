/* api/apt-price.js — 국토교통부 실거래가 프록시
 *
 * 브라우저가 국토부 API를 직접 못 부르는 이유가 두 가지예요.
 *   1) 서비스키가 그대로 노출됨
 *   2) 국토부 서버가 CORS를 허용하지 않음
 * 그래서 이 함수가 중간에서 대신 불러주고, 키는 환경변수에만 둡니다.
 *
 * 호출 예: /api/apt-price?lawdCd=11680&dealYmd=202607&type=trade
 *          /api/apt-price?lawdCd=11680&dealYmd=202607&type=rent
 */

const ENDPOINTS = {
  // 아파트 매매 실거래가 — 안전 진단의 '이 집 매매시세'를 채우는 데 씀
  trade: 'RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev',
  // 아파트 전월세 실거래가 — 전세보증금/월세보증금/월세를 채우는 데 씀
  rent:  'RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
};

export default async function handler(req, res) {
  const lawdCd  = String(req.query.lawdCd  || '');
  const dealYmd = String(req.query.dealYmd || '');
  const type    = String(req.query.type    || 'trade');

  if (!/^\d{5}$/.test(lawdCd)) {
    return res.status(400).json({ error: 'lawdCd는 법정동코드 5자리여야 해요 (예: 서울 강남구 11680)' });
  }
  if (!/^\d{6}$/.test(dealYmd)) {
    return res.status(400).json({ error: 'dealYmd는 YYYYMM 형식이어야 해요 (예: 202607)' });
  }
  if (!ENDPOINTS[type]) {
    return res.status(400).json({ error: "type은 'trade' 또는 'rent'여야 해요" });
  }

  const KEY = process.env.MOLIT_SERVICE_KEY;
  if (!KEY) {
    return res.status(500).json({ error: '서버에 MOLIT_SERVICE_KEY 환경변수가 설정되지 않았어요' });
  }

  const url = `https://apis.data.go.kr/1613000/${ENDPOINTS[type]}`
    + `?serviceKey=${encodeURIComponent(KEY)}`
    + `&LAWD_CD=${lawdCd}`
    + `&DEAL_YMD=${dealYmd}`
    + `&numOfRows=1000&pageNo=1`;

  try {
    const upstream = await fetch(url, { headers: { Accept: 'application/xml' } });
    const xml = await upstream.text();

    // 국토부는 오류도 HTTP 200 + XML 본문으로 주는 경우가 많아요
    if (/SERVICE_KEY_IS_NOT_REGISTERED/.test(xml)) {
      return res.status(502).json({
        error: 'SERVICE_KEY_IS_NOT_REGISTERED',
        hint: '① 데이터포털의 "일반 인증키(Decoding)"를 쓰고 있는지 ② 신청 승인 후 1시간이 지났는지 확인해보세요.'
      });
    }
    const errMsg = xml.match(/<returnAuthMsg>([\s\S]*?)<\/returnAuthMsg>/);
    if (errMsg) {
      return res.status(502).json({ error: '국토부 API 오류', detail: errMsg[1].trim() });
    }

    const items = parseItems(xml);

    // 실거래가는 하루에 몇 번 안 바뀌어요. 6시간 캐시로 호출량을 아낍니다.
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ type, lawdCd, dealYmd, count: items.length, items });

  } catch (e) {
    return res.status(502).json({ error: '국토부 API 호출에 실패했어요', detail: String(e) });
  }
}

/* 필드명을 추측하지 않고 XML의 태그를 그대로 키로 옮겨요.
   국토부 API는 버전에 따라 태그명이 달라서(aptNm/아파트, dealAmount/거래금액 등),
   실제 응답을 눈으로 확인한 뒤에 프론트에서 매핑을 확정합니다. */
function parseItems(xml) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return blocks.map(block => {
    const obj = {};
    const re = /<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g;
    let m;
    while ((m = re.exec(block)) !== null) {
      obj[m[1]] = m[2].trim();
    }
    return obj;
  });
}
