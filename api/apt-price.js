/* ===================================================================
   수정된 국토교통부 아파트 매매 실거래가 프록시
   =================================================================== */

const BASE = 'http://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';

const CACHE = new Map();
const TTL_CLOSED = 24 * 60 * 60 * 1000;
const TTL_OPEN   =      30 * 60 * 1000;
const CACHE_MAX  = 200;

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
  }).filter(x => x.name && x.amountMan > 0 && !x._canceled && !x._leasehold)
    .map(({ _canceled, _leasehold, ...keep }) => keep);
}

module.exports = async function handler(req, res){
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');

  const lawd = String((req.query && req.query.lawd) || '').replace(/[^\d]/g, '');
  const ymd  = String((req.query && req.query.ymd)  || '').replace(/[^\d]/g, '');

  if(lawd.length !== 5 || ymd.length !== 6)
    return res.status(200).json({ ok:false, reason:'bad-param', items:[] });

  const key = lawd + ':' + ymd;
  const hit = cacheGet(key);
  if(hit) return res.status(200).json({ ok:true, cached:true, items:hit });

  const serviceKey = process.env.MOLIT_API_KEY;
  if(!serviceKey)
    return res.status(200).json({ ok:false, reason:'no-key', items:[] });

  try{
    // ✅ URLSearchParams를 사용하여 안전하게 인코딩 (이중 인코딩 방지)
    const params = new URLSearchParams({
      serviceKey: serviceKey, // 원본 키 그대로 전달 (URLSearchParams가 한 번만 인코딩)
      LAWD_CD: lawd,
      DEAL_YMD: ymd,
      pageNo: '1',
      numOfRows: '1000'
    });
    
    const url = `${BASE}?${params.toString()}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);

    if(!r.ok) return res.status(200).json({ ok:false, reason:'upstream-'+r.status, items:[] });

    const xml = await r.text();
    const code = tag(xml, 'resultCode');
    
    // 00은 정상, 000은 공공데이터포털의 정상 코드
    if(code && code !== '00' && code !== '000')
      return res.status(200).json({ ok:false, reason:'api-'+code, items:[] });

    const items = parseItems(xml);
    cacheSet(key, items, ymd);
    return res.status(200).json({ ok:true, cached:false, items });
  }catch(e){
    return res.status(200).json({ ok:false, reason:'fetch-failed', items:[] });
  }
};
