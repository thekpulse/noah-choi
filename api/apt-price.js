/* api/apt-price.js — 국토교통부 실거래가 프록시
 *
 * 브라우저가 국토부 API를 직접 못 부르는 이유가 두 가지예요.
 *   1) 서비스키가 그대로 노출됨
 *   2) 국토부 서버가 CORS를 허용하지 않음
 * 그래서 이 함수가 중간에서 대신 불러주고, 키는 환경변수에만 둡니다.
 *
 * 호출 예: /api/apt-price?lawdCd=11680&dealYmd=202606&type=trade
 *          /api/apt-price?lawdCd=11680&dealYmd=202606&type=rent
 */

const ENDPOINTS = {
  /* 검증 완료 — 공공데이터포털 상세페이지의 End Point 표기와 일치 (2026.08.05 확인)
     https://apis.data.go.kr/1613000/RTMSDataSvcAptTrade / getRTMSDataSvcAptTrade
     ※ 예전 'RTMSDataSvcAptTradeDev' 이름은 더 이상 동작하지 않아요. */
  trade: 'RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade',

  /* ⚠️ 미검증 — 전월세 API 활용신청 승인 후, 상세페이지의 End Point 표기를 보고 확정할 것.
     매매가 'Dev' 접미사 없이 바뀐 걸로 봐서 전월세도 다를 가능성이 큽니다.
     확인 방법: 데이터포털 → 마이페이지 → 해당 서비스 → End Point / 상세기능 경로 */
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
    return res.status(400).json({ error: 'dealYmd는 YYYYMM 형식이어야 해요 (예: 202606)' });
  }
  if (!ENDPOINTS[type]) {
    return res.status(400).json({ error: "type은 'trade' 또는 'rent'여야 해요" });
  }

  const KEY = process.env.MOLIT_SERVICE_KEY;
  if (!KEY) {
    return res.status(500).json({ error: '서버에 MOLIT_SERVICE_KEY 환경변수가 설정되지 않았어요' });
  }

  /* 포털이 주는 Encoding 키에는 이미 %2F, %3D 같은 이스케이프가 들어 있어요.
     그대로 한 번 더 encodeURIComponent 하면 %25로 이중 인코딩돼서 인증이 깨져요.
     그래서 키에 '%' 가 보이면 이미 인코딩된 것으로 보고 그대로 씁니다.
     (Decoding 키를 넣었다면 여기서 정상적으로 인코딩됩니다) */
  const looksEncoded = /%[0-9A-Fa-f]{2}/.test(KEY);
  const keyParam = looksEncoded ? KEY : encodeURIComponent(KEY);

  const url = `https://apis.data.go.kr/1613000/${ENDPOINTS[type]}`
    + `?serviceKey=${keyParam}`
    + `&LAWD_CD=${lawdCd}`
    + `&DEAL_YMD=${dealYmd}`
    + `&numOfRows=1000&pageNo=1`;

  try {
    const upstream = await fetch(url, { headers: { Accept: 'application/xml' } });
    const body = await upstream.text();

    // 국토부는 오류도 HTTP 200 + XML 본문으로 주는 경우가 많아요
    if (/SERVICE_KEY_IS_NOT_REGISTERED/.test(body)) {
      return res.status(502).json({
        error: 'SERVICE_KEY_IS_NOT_REGISTERED',
        hint: '① 이 서비스의 활용신청이 승인됐는지 ② 엔드포인트 이름이 포털 상세페이지의 End Point와 일치하는지 확인해보세요.',
        endpoint: ENDPOINTS[type],
      });
    }
    const errMsg = body.match(/<returnAuthMsg>([\s\S]*?)<\/returnAuthMsg>/);
    if (errMsg) {
      return res.status(502).json({
        error: '국토부 API 오류',
        detail: errMsg[1].trim(),
        endpoint: ENDPOINTS[type],
      });
    }

    const items = parseItems(body);

    // 파싱 결과가 없으면 원인을 알 수 있게 응답 앞부분을 같이 돌려줘요
    if (items.length === 0) {
      const totalCount = body.match(/<totalCount>(\d+)<\/totalCount>/);
      return res.status(200).json({
        type, lawdCd, dealYmd, count: 0, items: [],
        note: totalCount && totalCount[1] === '0'
          ? '해당 지역·월에 신고된 거래가 없어요.'
          : '응답을 해석하지 못했어요. rawPreview를 확인해주세요.',
        rawPreview: body.slice(0, 600),
      });
    }

    // 실거래가는 하루에 몇 번 안 바뀌어요. 6시간 캐시로 호출량을 아낍니다.
    res.setHeader('Cache-Control', 's-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json({ type, lawdCd, dealYmd, count: items.length, items });

  } catch (e) {
    return res.status(502).json({ error: '국토부 API 호출에 실패했어요', detail: String(e) });
  }
}

/* 필드명을 추측하지 않고 XML의 태그를 그대로 키로 옮겨요.
   국토부 API는 개편에 따라 태그명이 달라져서, 실제 응답을 눈으로 확인한 뒤에
   프론트에서 매핑을 확정합니다. (한글 태그도 있을 수 있어 유니코드 범위를 포함) */
function parseItems(xml) {
  const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return blocks.map(block => {
    const obj = {};
    const re = /<([^\/\s>]+)>([\s\S]*?)<\/\1>/g;
    let m;
    while ((m = re.exec(block)) !== null) {
      obj[m[1]] = m[2].trim();
    }
    return obj;
  });
}
