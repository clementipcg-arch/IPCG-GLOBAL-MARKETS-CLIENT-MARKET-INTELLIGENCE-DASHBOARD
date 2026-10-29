'use strict';
/**
 * Instrument catalogue. One place to add, remove or re-map instruments.
 *
 * Each entry declares where its data may come from, in priority order (`sources`).
 * Provider ids:
 *   eodhd   – licensed market-data feed (EOD Historical Data). Symbols MUST be confirmed
 *             against your EODHD plan before go-live (see docs/DATA-SOURCES.md).
 *   fred    – Federal Reserve Bank of St. Louis FRED API (free key). Only public-domain
 *             series are used for clients (Fed H.10 FX, EIA energy). Copyrighted series on
 *             FRED (S&P, Dow Jones, Nikkei, ICE BofA) are NOT redistributed.
 *   ust     – U.S. Department of the Treasury daily par yield curve (public domain).
 *   mof     – Japan Ministry of Finance JGB yields (public).
 *   bbk     – Deutsche Bundesbank statistics API (public).
 *   boe     – Bank of England database (public, attribution required).
 *   hkma    – HKMA Open API (public).
 *
 * kind drives validation ranges and formatting: index | fx | commodity | yieldPct | spreadPct
 * licence: 'client' (may be shown to clients) | 'internal' (internal review only)
 */

const I = (o) => ({ decimals: 2, licence: 'client', ...o });

const INDICES = [
  // United States
  I({ id: 'spx', region: 'US', label: 'S&P 500', zh: '標普500指數', kind: 'index', tz: 'America/New_York', sources: [{ p: 'eodhd', s: 'GSPC.INDX' }] }),
  I({ id: 'ccmp', region: 'US', label: 'Nasdaq Composite', zh: '那斯達克綜合指數', kind: 'index', tz: 'America/New_York', sources: [{ p: 'eodhd', s: 'IXIC.INDX' }] }),
  I({ id: 'indu', region: 'US', label: 'Dow Jones Industrial Average', zh: '道瓊工業平均指數', kind: 'index', tz: 'America/New_York', sources: [{ p: 'eodhd', s: 'DJI.INDX' }] }),
  I({ id: 'rty', region: 'US', label: 'Russell 2000', zh: '羅素2000指數', kind: 'index', tz: 'America/New_York', sources: [{ p: 'eodhd', s: 'RUT.INDX' }] }),
  // Europe
  I({ id: 'sxxp', region: 'Europe', label: 'STOXX Europe 600', zh: '斯托克歐洲600指數', kind: 'index', tz: 'Europe/Berlin', sources: [{ p: 'eodhd', s: 'STOXX.INDX' }] }),
  I({ id: 'sx5e', region: 'Europe', label: 'EURO STOXX 50', zh: '歐洲斯托克50指數', kind: 'index', tz: 'Europe/Berlin', sources: [{ p: 'eodhd', s: 'STOXX50E.INDX' }] }),
  I({ id: 'dax', region: 'Europe', label: 'DAX', zh: '德國DAX指數', kind: 'index', tz: 'Europe/Berlin', sources: [{ p: 'eodhd', s: 'GDAXI.INDX' }] }),
  I({ id: 'ukx', region: 'Europe', label: 'FTSE 100', zh: '英國富時100指數', kind: 'index', tz: 'Europe/London', sources: [{ p: 'eodhd', s: 'FTSE.INDX' }] }),
  I({ id: 'cac', region: 'Europe', label: 'CAC 40', zh: '法國CAC 40指數', kind: 'index', tz: 'Europe/Paris', sources: [{ p: 'eodhd', s: 'FCHI.INDX' }] }),
  // Asia
  I({ id: 'nky', region: 'Asia', label: 'Nikkei 225', zh: '日經225指數', kind: 'index', tz: 'Asia/Tokyo', sources: [{ p: 'eodhd', s: 'N225.INDX' }] }),
  I({ id: 'hsi', region: 'Asia', label: 'Hang Seng Index', zh: '恒生指數', kind: 'index', tz: 'Asia/Hong_Kong', sources: [{ p: 'eodhd', s: 'HSI.INDX' }] }),
  I({ id: 'shcomp', region: 'Asia', label: 'Shanghai Composite', zh: '上證綜合指數', kind: 'index', tz: 'Asia/Shanghai', sources: [{ p: 'eodhd', s: '000001.SHG' }] }),
  I({ id: 'csi300', region: 'Asia', label: 'CSI 300', zh: '滬深300指數', kind: 'index', tz: 'Asia/Shanghai', sources: [{ p: 'eodhd', s: '000300.SHG' }] }),
  I({ id: 'taiex', region: 'Asia', label: 'Taiwan Weighted (TAIEX)', zh: '台灣加權指數', kind: 'index', tz: 'Asia/Taipei', sources: [{ p: 'eodhd', s: 'TWII.INDX' }] }),
  I({ id: 'kospi', region: 'Asia', label: 'KOSPI', zh: '韓國綜合指數', kind: 'index', tz: 'Asia/Seoul', sources: [{ p: 'eodhd', s: 'KS11.INDX' }] }),
];

const FX = [
  I({ id: 'dxy', label: 'US Dollar Index (DXY)', zh: '美元指數 (DXY)', kind: 'fx', decimals: 2, sources: [{ p: 'eodhd', s: 'DXY.INDX' }], note: 'ICE US Dollar Index. Requires a licensed feed.' }),
  I({ id: 'usdbroad', label: 'Fed Broad Dollar Index', zh: '聯準會廣義美元指數', kind: 'fx', decimals: 2, sources: [{ p: 'fred', s: 'DTWEXBGS', latency: 'weekly' }], note: 'Federal Reserve nominal broad dollar index (Jan 2006 = 100). Not the same as DXY.' }),
  I({ id: 'eurusd', label: 'EUR/USD', zh: '歐元/美元', kind: 'fx', decimals: 4, base: 'EUR', quote: 'USD', sources: [{ p: 'eodhd', s: 'EURUSD.FOREX' }, { p: 'fred', s: 'DEXUSEU', latency: 'weekly' }] }),
  I({ id: 'gbpusd', label: 'GBP/USD', zh: '英鎊/美元', kind: 'fx', decimals: 4, base: 'GBP', quote: 'USD', sources: [{ p: 'eodhd', s: 'GBPUSD.FOREX' }, { p: 'fred', s: 'DEXUSUK', latency: 'weekly' }] }),
  I({ id: 'usdjpy', label: 'USD/JPY', zh: '美元/日圓', kind: 'fx', decimals: 2, base: 'USD', quote: 'JPY', sources: [{ p: 'eodhd', s: 'USDJPY.FOREX' }, { p: 'fred', s: 'DEXJPUS', latency: 'weekly' }] }),
  I({ id: 'usdcnh', label: 'USD/CNH (offshore)', zh: '美元/離岸人民幣', kind: 'fx', decimals: 4, base: 'USD', quote: 'CNH', sources: [{ p: 'eodhd', s: 'USDCNH.FOREX' }] }),
  I({ id: 'usdcny', label: 'USD/CNY (onshore)', zh: '美元/在岸人民幣', kind: 'fx', decimals: 4, base: 'USD', quote: 'CNY', sources: [{ p: 'fred', s: 'DEXCHUS', latency: 'weekly' }], note: 'Onshore yuan (CNY), Fed H.10 noon buying rate. CNH trades offshore and can differ.' }),
  I({ id: 'usdhkd', label: 'USD/HKD', zh: '美元/港幣', kind: 'fx', decimals: 4, base: 'USD', quote: 'HKD', sources: [{ p: 'eodhd', s: 'USDHKD.FOREX' }, { p: 'fred', s: 'DEXHKUS', latency: 'weekly' }], note: 'HKD is pegged within a 7.75–7.85 band under the Linked Exchange Rate System.' }),
  I({ id: 'usdtwd', label: 'USD/TWD', zh: '美元/新台幣', kind: 'fx', decimals: 3, base: 'USD', quote: 'TWD', sources: [{ p: 'eodhd', s: 'USDTWD.FOREX' }, { p: 'fred', s: 'DEXTAUS', latency: 'weekly' }] }),
];

const COMMODITIES = [
  I({ id: 'xau', label: 'Gold (spot)', zh: '黃金 (現貨)', kind: 'commodity', unit: 'USD/oz', contract: 'Spot XAU/USD', sources: [{ p: 'eodhd', s: 'XAUUSD.FOREX' }] }),
  I({ id: 'xag', label: 'Silver (spot)', zh: '白銀 (現貨)', kind: 'commodity', unit: 'USD/oz', contract: 'Spot XAG/USD', sources: [{ p: 'eodhd', s: 'XAGUSD.FOREX' }] }),
  I({ id: 'brent', label: 'Brent crude (futures)', zh: '布蘭特原油 (期貨)', kind: 'commodity', unit: 'USD/bbl', contract: 'ICE Brent front-month', sources: [{ p: 'eodhd', s: 'BZ.COMM' }] }),
  I({ id: 'wti', label: 'WTI crude (futures)', zh: 'WTI原油 (期貨)', kind: 'commodity', unit: 'USD/bbl', contract: 'NYMEX WTI front-month', sources: [{ p: 'eodhd', s: 'CL.COMM' }] }),
  I({ id: 'brent_spot', label: 'Brent crude (spot, EIA)', zh: '布蘭特原油 (現貨, EIA)', kind: 'commodity', unit: 'USD/bbl', contract: 'Europe Brent spot FOB', sources: [{ p: 'fred', s: 'DCOILBRENTEU', latency: 'weekly' }] }),
  I({ id: 'wti_spot', label: 'WTI crude (spot, EIA)', zh: 'WTI原油 (現貨, EIA)', kind: 'commodity', unit: 'USD/bbl', contract: 'Cushing, OK spot', sources: [{ p: 'fred', s: 'DCOILWTICO' }] }),
  I({ id: 'copper', label: 'Copper (futures)', zh: '銅 (期貨)', kind: 'commodity', unit: 'USD/lb', contract: 'COMEX HG front-month', sources: [{ p: 'eodhd', s: 'HG.COMM' }] }),
  I({ id: 'natgas', label: 'Natural gas (Henry Hub spot)', zh: '天然氣 (亨利港現貨)', kind: 'commodity', unit: 'USD/MMBtu', contract: 'Henry Hub spot', sources: [{ p: 'fred', s: 'DHHNGSP' }] }),
];

// US Treasury par curve columns (Treasury CSV headers) -> tenor ids
const UST_TENORS = [
  ['3M', '3 Mo'], ['6M', '6 Mo'], ['1Y', '1 Yr'], ['2Y', '2 Yr'], ['5Y', '5 Yr'], ['7Y', '7 Yr'], ['10Y', '10 Yr'], ['20Y', '20 Yr'], ['30Y', '30 Yr'],
];

const SOVEREIGNS = [
  { id: 'de2y', country: 'Germany', zh: '德國2年期公債', label: 'Germany 2Y Bund', sources: [{ p: 'bbk', s: 'BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R02XX.R.A.A._Z._Z.A' }] },
  { id: 'de10y', country: 'Germany', zh: '德國10年期公債', label: 'Germany 10Y Bund', sources: [{ p: 'bbk', s: 'BBSIS/D.I.ZAR.ZI.EUR.S1311.B.A604.R10XX.R.A.A._Z._Z.A' }] },
  { id: 'uk10y', country: 'United Kingdom', zh: '英國10年期公債', label: 'UK 10Y gilt (par yield)', sources: [{ p: 'boe', s: 'IUDMNPY' }] },
  { id: 'jp10y', country: 'Japan', zh: '日本10年期公債', label: 'Japan 10Y JGB', sources: [{ p: 'mof', s: '10Y' }] },
  { id: 'jp2y', country: 'Japan', zh: '日本2年期公債', label: 'Japan 2Y JGB', sources: [{ p: 'mof', s: '2Y' }] },
  { id: 'cn10y', country: 'China', zh: '中國10年期公債', label: 'China 10Y CGB', sources: [{ p: 'eodhd', s: 'CN10Y.GBOND' }] },
  { id: 'hk10y', country: 'Hong Kong', zh: '香港10年期政府債', label: 'Hong Kong 10Y Exchange Fund Note / HKGB', sources: [{ p: 'hkma', s: 'efbn-10y' }] },
  { id: 'tw10y', country: 'Taiwan', zh: '台灣10年期公債', label: 'Taiwan 10Y government bond', sources: [{ p: 'eodhd', s: 'TW10Y.GBOND' }] },
].map((x) => ({ kind: 'yieldPct', decimals: 3, licence: 'client', ...x }));

const CREDIT = [
  { id: 'us_ig_oas', label: 'US investment-grade OAS', zh: '美國投資級信用利差', series: 'BAMLC0A0CM', provider: 'fred', licence: 'internal', licenceNote: 'ICE BofA index data: FRED terms permit internal use only. Publishing to clients requires a licence from ICE Data Indices.' },
  { id: 'us_hy_oas', label: 'US high-yield OAS', zh: '美國高收益信用利差', series: 'BAMLH0A0HYM2', provider: 'fred', licence: 'internal', licenceNote: 'ICE BofA index data: FRED terms permit internal use only. Publishing to clients requires a licence from ICE Data Indices.' },
].map((x) => ({ kind: 'spreadPct', decimals: 2, ...x }));

module.exports = { INDICES, FX, COMMODITIES, UST_TENORS, SOVEREIGNS, CREDIT };
