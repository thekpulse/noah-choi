/* ===================================================================
   서울 25개 구 실거래 묶음 조회  —  v329
   Vercel Serverless Function.  GET /api/apt-reach?ymd=202610

   왜: v328 화면은 구 25 × 3개월 = 75번을 /api/apt-price 로 따로 불렀습니다(한 번에 5개 구씩).
       오너 운영 확인(2026-11-16) 「확실히 엄청 느리네」. → 한 달치 25개 구를 **한 번에** 받아 3번으로 줄입니다.

   · 조회·해석은 새로 짜지 않습니다. **같은 폴더의 apt-price.js 를 그대로 부릅니다**(https · 재시도 · 게이트웨이 오류 판별 ·
     해제 거래 제외 · 인스턴스 캐시 모두 그 파일 것). 이 파일은 25개 구를 한꺼번에 돌리고 결과를 작게 묶을 뿐입니다.
   · 금액·소득은 받지 않습니다. 받는 값은 ymd 하나 — 예상 집값과의 비교는 화면이 합니다.
   · 국토부를 한꺼번에 25번 두드리지 않습니다 — **한 번에 POOL(4)개씩** 돌립니다. v328 운영에서 25개 구를 훑는 동안
     원래 화면의 실거래 조회가 실패했습니다(오너 2026-11-16 · 원인은 단정 못 함, 동시 호출이 몰린 것이 유력).
   · DEADLINE(22초)을 넘기면 남은 구는 `time-budget` 실패로 돌려보냅니다(함수 한도 30초 안에 반드시 답함).
     그때까지 받은 구는 apt-price 의 인스턴스 캐시에 남아, 다시 부르면 이어서 채워집니다.
   · 구 하나가 실패해도 나머지는 보냅니다. 실패한 구는 `{ok:false, reason}` — **빈 성공(거래 없음)으로 보내지 않습니다.**
   · 캐시: 모든 구가 성공한 응답만 CDN 에 담습니다(이번 달 30분 · 지난 달 6시간, 그 뒤 하루는 묵은 값을 먼저 주고 뒤에서 새로 받음).
     하나라도 실패하면 no-store — 실패가 캐시에 남지 않습니다.
   · 거래 한 건은 배열 하나: [금액(만원), 전용㎡, 일, 단지명, 법정동, 층, 건축년도]. 연·월은 ymd 에서 나옵니다.
   =================================================================== */
const price = require('./apt-price.js');

/* 서울 25개 구 법정동코드(앞 5자리). 화면 index.html 의 REACH_TILES 와 같은 집합 — tests/check.mjs 가 대조합니다. */
const SEOUL = ['11110','11140','11170','11200','11215','11230','11260','11290','11305','11320','11350','11380','11410',
               '11440','11470','11500','11530','11545','11560','11590','11620','11650','11680','11710','11740'];

const POOL = 4;           /* 국토부 동시 호출 수 */
const DEADLINE = 22000;   /* 이 시간을 넘기면 새 호출을 시작하지 않음(ms) */
const HARD = 27000;       /* 돌고 있던 호출도 여기서 기다리기를 그만둠(ms) — 함수 한도 30초 전에 답함 */

const nowYmd = () => { const d = new Date(); return d.getFullYear() * 100 + (d.getMonth() + 1); };

/* apt-price 의 처리기를 함수처럼 부릅니다. 그 처리기는 항상 res.status(200).json(...) 한 번으로 끝납니다. */
function callPrice(lawd, ymd){
  return new Promise(resolve => {
    let done = false;
    const finish = v => { if(!done){ done = true; resolve(v); } };
    const res = { setHeader(){ return res; }, status(){ return res; }, json(o){ finish(o); return res; } };
    Promise.resolve().then(() => price({ query:{ lawd, ymd } }, res))
      .then(() => finish({ ok:false, reason:'no-response', items:[] }))
      .catch(() => finish({ ok:false, reason:'fetch-failed', items:[] }));
  });
}

module.exports = async function handler(req, res){
  const ymd = String((req.query && req.query.ymd) || '').replace(/[^\d]/g, '');
  const y = +ymd.slice(0, 4), m = +ymd.slice(4, 6);
  if(ymd.length !== 6 || !(y >= 2006 && y <= 2100) || !(m >= 1 && m <= 12)){
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok:false, reason:'bad-param', gu:{} });
  }
  const t0 = Date.now(), rs = new Array(SEOUL.length);
  let next = 0;
  const worker = async () => {
    while(next < SEOUL.length){
      const i = next++;
      const left = HARD - (Date.now() - t0);
      if(Date.now() - t0 > DEADLINE || left <= 0){ rs[i] = { ok:false, reason:'time-budget', items:[] }; continue; }
      let timer;
      rs[i] = await Promise.race([ callPrice(SEOUL[i], ymd),
        new Promise(r => { timer = setTimeout(() => r({ ok:false, reason:'time-budget', items:[] }), left); }) ]);
      clearTimeout(timer);
    }
  };
  await Promise.all(Array.from({ length:POOL }, worker));
  const gu = {};
  let failed = 0;
  rs.forEach((r, i) => {
    if(!r || r.ok !== true || !Array.isArray(r.items)){
      failed++;
      gu[SEOUL[i]] = { ok:false, reason:String((r && r.reason) || 'failed') };
      return;
    }
    gu[SEOUL[i]] = { ok:true, total:(r.total == null ? null : r.total),
      d:r.items.map(x => [x.amountMan, x.areaM2, x.d, x.name, x.dong, x.floor, x.buildYear]) };
  });
  res.setHeader('Cache-Control', failed ? 'no-store'
    : 'public, s-maxage=' + (+ymd >= nowYmd() ? 1800 : 21600) + ', stale-while-revalidate=86400');
  return res.status(200).json({ ok:failed < SEOUL.length, ymd:+ymd, failed, gu });
};
module.exports.SEOUL = SEOUL;
module.exports.POOL = POOL;
module.exports.config = { maxDuration: 30 };   /* HARD 27초에 반드시 답함 */
