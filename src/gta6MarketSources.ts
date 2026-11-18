/**
 * Source-of-truth for launch market coverage.
 *
 * Rockstar PS Store countries (last reviewed 2026-11-18):
 * https://support.rockstargames.com/articles/46YkMi4rHxYXMeIHtZiKaE/grand-theft-auto-vi-pre-order-details
 *
 * Rockstar release rule: Nov 19, 2026, local midnight for supported markets:
 * https://support.rockstargames.com/articles/29jV3Cv2cCgvwM1XgtMO5o/grand-theft-auto-vi-regional-pre-load-and-release-times-on-playstation-5-and-xbox-series-x-or-s
 *
 * Storefront-specific timestamps override the general rule whenever known.
 * Their dates are UTC and come from the publicly visible GTA VI Standard
 * Edition product page. Do not equate "not listed" with "banned".
 */
export const PLAYSTATION_SUPPORTED_CODES = [
  'AR','AU','AT','BE','BO','BR','BG','CA','CL','CO','CR','HR','CY','CZ',
  'DK','EC','SV','FI','FR','DE','GR','GT','HN','HK','HU','IS','IN','ID',
  'IE','IL','IT','JP','LU','MY','MT','MX','NL','NZ','NI','NO','PA','PY',
  'PE','PL','PT','RO','SA','SG','SK','SI','ZA','KR','ES','SE','CH','TH',
  'TR','UA','AE','GB','US','UY'
] as const;

export const PLAYSTATION_SUPPORTED_SET: ReadonlySet<string> =
  new Set(PLAYSTATION_SUPPORTED_CODES);

/** Direct GTA VI PlayStation product page / exact unlock UTC for this market. */
export const EXACT_STORE_UNLOCKS: Record<string, { unlockAt: string; url: string }> = {
  BR: { unlockAt: '2026-11-19T03:00:00Z', url: 'https://store.playstation.com/pt-br/product/EP1004-PPSA01547_00-GTAVISTANDARD001' },
  PT: { unlockAt: '2026-11-19T00:00:00Z', url: 'https://store.playstation.com/pt-pt/product/EP1004-PPSA01547_00-GTAVISTANDARD001' },
  US: { unlockAt: '2026-11-19T05:00:00Z', url: 'https://store.playstation.com/en-us/product/EP1004-PPSA01547_00-GTAVISTANDARD001/' },
  CA: { unlockAt: '2026-11-19T05:00:00Z', url: 'https://store.playstation.com/en-ca/product/EP1004-PPSA01547_00-GTAVISTANDARD001/' },
  GB: { unlockAt: '2026-11-19T00:00:00Z', url: 'https://store.playstation.com/en-gb/product/EP1004-PPSA01547_00-GTAVISTANDARD001/' },
  ES: { unlockAt: '2026-11-18T23:00:00Z', url: 'https://store.playstation.com/es-es/product/EP1004-PPSA01547_00-GTAVISTANDARD001' },
  GR: { unlockAt: '2026-11-18T22:00:00Z', url: 'https://store.playstation.com/en-gr/product/EP1004-PPSA01547_00-GTAVISTANDARD001/' },
  TR: { unlockAt: '2026-11-18T21:00:00Z', url: 'https://store.playstation.com/en-tr/product/EP1004-PPSA01547_00-GTAVISTANDARD001' },
  AU: { unlockAt: '2026-11-18T13:00:00Z', url: 'https://store.playstation.com/en-au/product/EP1004-PPSA38500_00-GTAVISTANDARD001' },
  NZ: { unlockAt: '2026-11-18T11:00:00Z', url: 'https://store.playstation.com/en-nz/product/EP1004-PPSA38500_00-GTAVISTANDARD001' },
  JP: { unlockAt: '2026-11-18T15:00:00Z', url: 'https://store.playstation.com/ja-jp/product/JP0230-PPSA29660_00-GTAVISTANDARD001' },
  KR: { unlockAt: '2026-11-18T15:00:00Z', url: 'https://store.playstation.com/ko-kr/product/EP1004-PPSA01547_00-GTAVISTANDARD001' },
  ID: { unlockAt: '2026-11-18T17:00:00Z', url: 'https://store.playstation.com/en-id/product/EP1004-PPSA01547_00-GTAVISTANDARD001' },
  SG: { unlockAt: '2026-11-18T16:00:00Z', url: 'https://store.playstation.com/en-sg/product/EP1004-PPSA01547_00-GTAVISTANDARD001' },
  HK: { unlockAt: '2026-11-18T16:00:00Z', url: 'https://store.playstation.com/en-hk/product/EP1004-PPSA01547_00-GTAVISTANDARD001' },
  CL: { unlockAt: '2026-11-19T03:00:00Z', url: 'https://store.playstation.com/es-cl/product/EP1004-PPSA01547_00-GTAVISTANDARD001' },
  BO: { unlockAt: '2026-11-19T04:00:00Z', url: 'https://store.playstation.com/es-bo/product/EP1004-PPSA01547_00-GTAVISTANDARD001' },
  GT: { unlockAt: '2026-11-19T06:00:00Z', url: 'https://store.playstation.com/es-gt/product/EP1004-PPSA01547_00-GTAVISTANDARD001' },
  SK: { unlockAt: '2026-11-18T23:00:00Z', url: 'https://store.playstation.com/en-sk/product/EP1004-PPSA01547_00-GTAVISTANDARD001/' },
};

/** One principal account/store clock per supported market. */
export const MARKET_CLOCK_ZONE: Record<string, string> = {
  AU:'Australia/Sydney',NZ:'Pacific/Auckland',MX:'America/Mexico_City',
  US:'America/New_York', CA:'America/Toronto', BR:'America/Sao_Paulo',
  ES:'Europe/Madrid',CL:'America/Santiago',ID:'Asia/Jakarta',
  GB:'Europe/London', IE:'Europe/Dublin', GR:'Europe/Athens',
  UA:'Europe/Kyiv',TH:'Asia/Bangkok',MY:'Asia/Kuala_Lumpur',
  HK:'Asia/Hong_Kong',SG:'Asia/Singapore',MT:'Europe/Malta',
  JP:'Asia/Tokyo',KR:'Asia/Seoul',TR:'Europe/Istanbul',
  GT:'America/Guatemala',BO:'America/La_Paz',AR:'America/Argentina/Buenos_Aires',
  SA:'Asia/Riyadh',AE:'Asia/Dubai',
};

/** Markets present on Rockstar's official list but missing from 110m atlas. */
export const SMALL_STORE_MARKETS = [
  { code:'HK',label:'Hong Kong',anchor:[114.17,22.31] as [number,number],color:'#ff8db7',timeZone:'Asia/Hong_Kong' },
  { code:'SG',label:'Singapura',anchor:[103.82,1.35] as [number,number],color:'#88d6e2',timeZone:'Asia/Singapore' },
  { code:'MT',label:'Malta',anchor:[14.375,35.94] as [number,number],color:'#c6a2f9',timeZone:'Europe/Malta' }
] as const;

export const ROCKSTAR_MARKETS_URL =
  'https://support.rockstargames.com/articles/46YkMi4rHxYXMeIHtZiKaE/grand-theft-auto-vi-pre-order-details';
