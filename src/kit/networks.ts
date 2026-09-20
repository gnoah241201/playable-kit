// Ad-network adapters. Source builds target AppLovin (MRAID): a `window.onload=function(){...}` bootstrap that
// initialises window.application and opens the store with mraid.open(...).

export type Engine = 'pixi-webpack' | 'luna' | 'unknown';
export type Network = 'applovin' | 'mintegral';

const BOOTSTRAP_RE = /<script[^>]*>\s*window\.onload=function\(\)\{[\s\S]*?<\/script>/;
const PIXI_STORE_RE = /isIOS\?"([^"]+)":"([^"]+)"/;
const LUNA_STORE_RE = /iosLink:"([^"]*)",androidLink:"([^"]*)"/;
// last resort: any store URL anywhere in the file (works for engines we do not know)
const URL_STOP = '[^\\s"\'`\\\\<>)]+';
const ANY_IOS_RE = new RegExp('https://(?:apps|itunes)\\.apple\\.com/' + URL_STOP);
const ANY_ANDROID_RE = new RegExp('https://play\\.google\\.com/store/apps/' + URL_STOP);
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
  if (m) return { ios: m[1], android: m[2] };
  const ios = ANY_IOS_RE.exec(html)?.[0] ?? '';
  const android = ANY_ANDROID_RE.exec(html)?.[0] ?? '';
  return ios || android ? { ios, android } : null;
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

/** The tailored bridge only fits the known template; everything else gets the generic MRAID shim. */
function hasKnownBootstrap(html: string): boolean {
  const m = BOOTSTRAP_RE.exec(html);
  return !!m && /mraid/.test(m[0]) && /window\.application/.test(m[0]);
}

export function canConvertToMintegral(html: string): boolean {
  return detectNetwork(html) === 'mintegral' || hasKnownBootstrap(html) || /mraid/.test(html);
}

export function toMintegral(html: string): string {
  if (detectNetwork(html) === 'mintegral') return html;
  let out: string;
  if (hasKnownBootstrap(html)) {
    const m = BOOTSTRAP_RE.exec(html)!;
    out = html.slice(0, m.index) + MINTEGRAL_BRIDGE + html.slice(m.index + m[0].length);
  } else if (/mraid/.test(html)) {
    // generic: keep the game untouched and shim MRAID so its own CTA drives the Mintegral SDK
    out = /<head[^>]*>/i.test(html)
      ? html.replace(/<head[^>]*>/i, (h) => h + MINTEGRAL_SHIM)
      : MINTEGRAL_SHIM + html;
  } else {
    throw new ConversionError('Playable này không dùng MRAID nên chưa chuyển sang Mintegral tự động được.');
  }
  out = out.replace(',window.is_applovin=!0', '').replace('window.is_applovin=!0', '');
  return out.replace(AD_NETWORK_RE, 'adNetwork:"mintegral"');
}

/**
 * Engine-agnostic bridge: the playable keeps using MRAID, we translate it to the Mintegral SDK.
 * Injected before the game's own scripts so `typeof mraid` is defined when they run.
 */
export const MINTEGRAL_SHIM =
  '<script>(function(){var ended=false;' +
  'function end(){if(!ended){ended=true;window.gameEnd&&window.gameEnd();}}' +
  'window.gameStart=function(){try{window.dispatchEvent(new Event("mtg:start"));}catch(e){}};' +
  'window.gameClose=function(){try{window.dispatchEvent(new Event("mtg:close"));}catch(e){}};' +
  'var L={};window.mraid={getState:function(){return"default"},isViewable:function(){return true},' +
  'getVersion:function(){return"3.0"},getPlacementType:function(){return"interstitial"},' +
  'addEventListener:function(e,f){(L[e]=L[e]||[]).push(f);if(e==="ready")setTimeout(f,0);},' +
  'removeEventListener:function(e,f){(L[e]||[]).splice((L[e]||[]).indexOf(f),1);},' +
  'open:function(u){end();window.install&&window.install();},close:function(){},' +
  'expand:function(){},useCustomClose:function(){},setOrientationProperties:function(){}};' +
  'window.open=function(u){end();window.install&&window.install();return null;};' +
  'window.addEventListener("load",function(){setTimeout(function(){window.gameReady&&window.gameReady();},50);});' +
  '})();</script>';

export const SIZE_LIMIT_MB: Record<Network, number> = { applovin: 5, mintegral: 5 };
