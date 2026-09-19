// Ad-network adapters. Source builds target AppLovin (MRAID): a `window.onload=function(){...}` bootstrap that
// initialises window.application and opens the store with mraid.open(...).

export type Engine = 'pixi-webpack' | 'luna' | 'unknown';
export type Network = 'applovin' | 'mintegral';

const BOOTSTRAP_RE = /<script[^>]*>\s*window\.onload=function\(\)\{[\s\S]*?<\/script>/;
const PIXI_STORE_RE = /isIOS\?"([^"]+)":"([^"]+)"/;
const LUNA_STORE_RE = /iosLink:"([^"]*)",androidLink:"([^"]*)"/;
const AD_NETWORK_RE = /adNetwork:"([^"]*)"/;

export const MINTEGRAL_BRIDGE =
  '<script defer="defer">window.onload=function(){' +
  'var app=window.application,ended=false;window.is_mraid=!0;' +
  'function end(){if(!ended){ended=true;window.gameEnd&&window.gameEnd();}}' +
  'app.playableFinished=function(){end();};' +
  'app.clickInstall=function(){end();window.install&&window.install();};' +
  'window.gameStart=function(){if(!app.soundMuted&&app.sound)app.sound.unmuteAll();};' +
  'window.gameClose=function(){app.sound&&app.sound.muteAll();};' +
  'Promise.resolve(app.init()).then(function(){window.gameReady&&window.gameReady();});' +
  '}</script>';

export function detectEngine(html: string): Engine {
  if (/LunaUnity|window\.\$environment/.test(html)) return 'luna';
  if (/ASSETS_TYPES/.test(html)) return 'pixi-webpack';
  return 'unknown';
}

export function detectNetwork(html: string): string | null {
  if (/window\.gameReady/.test(html) && /window\.install/.test(html) && !/luna:/.test(html)) return 'mintegral';
  const m = AD_NETWORK_RE.exec(html) ?? /targetPlatform:"([^"]+)"/.exec(html);
  if (m) return m[1];
  return /mraid/.test(html) ? 'mraid' : null;
}

export interface StoreLinks { ios: string; android: string }

export function getStoreLinks(html: string): StoreLinks | null {
  const m = PIXI_STORE_RE.exec(html) ?? LUNA_STORE_RE.exec(html);
  return m ? { ios: m[1], android: m[2] } : null;
}

/** Replace every occurrence of the original links (bootstrap + anywhere else they appear). */
export function setStoreLinks(html: string, original: StoreLinks, next: StoreLinks): string {
  let out = html;
  if (next.ios && next.ios !== original.ios) out = out.split(original.ios).join(next.ios);
  if (next.android && next.android !== original.android) out = out.split(original.android).join(next.android);
  return out;
}

export function setTitle(html: string, title: string): string {
  const safe = title.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
  return /<title>[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${safe}</title>`)
    : html.replace(/<head>/i, `<head><title>${safe}</title>`);
}

export class ConversionError extends Error {
  code = 'conversion_error';
}

export function canConvertToMintegral(html: string): boolean {
  const m = BOOTSTRAP_RE.exec(html);
  return detectNetwork(html) === 'mintegral' || (!!m && /mraid/.test(m[0]) && /window\.application/.test(m[0]));
}

export function toMintegral(html: string): string {
  if (detectNetwork(html) === 'mintegral') return html;
  const m = BOOTSTRAP_RE.exec(html);
  if (!m || !/mraid/.test(m[0]) || !/window\.application/.test(m[0])) {
    throw new ConversionError('Không tìm thấy đoạn khởi động MRAID quen thuộc — không thể chuyển sang Mintegral.');
  }
  let out = html.slice(0, m.index) + MINTEGRAL_BRIDGE + html.slice(m.index + m[0].length);
  out = out.replace(',window.is_applovin=!0', '').replace('window.is_applovin=!0', '');
  return out.replace(AD_NETWORK_RE, 'adNetwork:"mintegral"');
}

export const SIZE_LIMIT_MB: Record<Network, number> = { applovin: 5, mintegral: 5 };
