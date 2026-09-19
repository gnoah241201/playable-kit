// A loaded playable: inspect it, swap assets / title / store links, and build per-network outputs.
import { strToU8, unzipSync, zipSync, strFromU8 } from 'fflate';
import { dataUri, dataUriBytes, mimeFromName, stripDataUris } from './bytes';
import {
  canConvertToMintegral, detectEngine, detectNetwork, Engine, getStoreLinks, Network, setStoreLinks, setTitle,
  SIZE_LIMIT_MB, StoreLinks, toMintegral,
} from './networks';
import { decodeImage, explode, repack, SheetFrame } from './spritesheet';
import { AssetModule, findAssetModules, readJson, UnsupportedBuildError } from './webpack';

export interface LooseAsset {
  id: string; kind: string; name: string; mime: string;
  module: AssetModule; uri: string; replaced: boolean;
  width?: number; height?: number;
}
export interface FrameAsset {
  id: string; sheet: string; frameName: string; label: string;
  width: number; height: number; original: HTMLCanvasElement; canvas: HTMLCanvasElement;
  thumb: string; replaced: boolean;
}
interface Sheet { key: string; json: AssetModule; png: AssetModule; meta: any; frames: FrameAsset[]; extras: Record<string, Record<string, unknown>> }

export interface Inspection {
  fileName: string; bytes: number; engine: Engine; network: string | null;
  storeLinks: StoreLinks | null; analyticsEnabled: boolean | null; externalUrls: string[];
  assetsSupported: boolean; assetsReason?: string; mintegralSupported: boolean;
  title: string;
}
export interface BuildConfig { title: string; ios: string; android: string }
export interface Check { id: string; status: 'pass' | 'warn' | 'fail'; message: string }

const URL_ALLOWLIST = ['http://www.w3.org/', 'https://github.com/mitsuhiko/webgl-meincraft'];

export function analyticsEnabled(html: string): boolean | null {
  const m = /playableId="[^"]*"[^{}]*\}send\(\w*\)\{([^}]*)\}/.exec(html);
  if (!m) return null;
  const body = m[1].trim();
  return !(body === '' || /^\/\*[\s\S]*?\*\/$/.test(body));
}

export function externalUrls(html: string): string[] {
  const links = getStoreLinks(html);
  const skip = new Set(links ? [links.ios, links.android] : []);
  const urls = new Set(stripDataUris(html).match(/https?:\/\/[^\s"'`<>)\\]+/g) ?? []);
  return [...urls].filter((u) => !skip.has(u) && !URL_ALLOWLIST.some((a) => u.startsWith(a))).sort();
}

/** Read an uploaded .html or .zip (Mintegral style) into an HTML string. */
export async function readPlayableFile(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (/\.zip$/i.test(file.name) || (buf[0] === 0x50 && buf[1] === 0x4b)) {
    const entries = unzipSync(buf);
    const names = Object.keys(entries).filter((n) => /\.html?$/i.test(n));
    if (!names.length) throw new Error('File zip không có file .html nào');
    return strFromU8(entries[names.includes('index.html') ? 'index.html' : names[0]]);
  }
  return new TextDecoder().decode(buf);
}

function fitCanvas(img: ImageBitmap, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const s = Math.min(w / img.width, h / img.height);
  const dw = Math.round(img.width * s), dh = Math.round(img.height * s);
  c.getContext('2d')!.drawImage(img, Math.round((w - dw) / 2), Math.round((h - dh) / 2), dw, dh);
  return c;
}

export class PlayableProject {
  readonly html: string;
  readonly info: Inspection;
  loose: LooseAsset[] = [];
  sheets: Sheet[] = [];

  private constructor(html: string, info: Inspection) {
    this.html = html;
    this.info = info;
  }

  static async load(fileName: string, html: string): Promise<PlayableProject> {
    const engine = detectEngine(html);
    const info: Inspection = {
      fileName, bytes: new Blob([html]).size, engine, network: detectNetwork(html),
      storeLinks: getStoreLinks(html), analyticsEnabled: analyticsEnabled(html), externalUrls: externalUrls(html),
      assetsSupported: false, mintegralSupported: canConvertToMintegral(html),
      title: /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '',
    };
    const p = new PlayableProject(html, info);
    try {
      await p.loadAssets();
      info.assetsSupported = true;
    } catch (e) {
      info.assetsReason = e instanceof UnsupportedBuildError ? e.message : `Không đọc được asset: ${(e as Error).message}`;
      p.loose = [];
      p.sheets = [];
    }
    return p;
  }

  private async loadAssets() {
    const modules = findAssetModules(this.html);
    const images = new Map([...modules.values()].filter((m) => m.kind === 'images').map((m) => [m.name, m]));
    const sheetMods = new Set<string>();
    for (const m of modules.values()) {
      if (m.kind !== 'spritesheets') continue;
      const key = m.name.replace(/\.json$/, '');
      const doc = readJson(m.uri);
      const base = key.split('/').pop()!;
      const dir = key.includes('/') ? key.slice(0, key.lastIndexOf('/') + 1) : '';
      const png = [doc?.meta?.image, `${dir}${doc?.meta?.image}`, `spritesheet_${key}.png`, `${dir}spritesheet_${base}.png`, `${key}.png`]
        .map((c) => (c ? images.get(c) : undefined)).find(Boolean);
      if (!png) throw new UnsupportedBuildError(`Không tìm thấy ảnh atlas cho spritesheet "${m.name}"`);
      sheetMods.add(m.moduleId).add(png.moduleId);
      const frames = await explode(doc, png.uri);
      const extras: Record<string, Record<string, unknown>> = {};
      this.sheets.push({
        key, json: m, png, meta: doc.meta, extras,
        frames: frames.map((f: SheetFrame) => {
          extras[f.name] = f.extra;
          return {
            id: `sprite:${key}:${f.name}`, sheet: key, frameName: f.name,
            label: f.name.startsWith(`${key}/`) ? f.name.slice(key.length + 1) : f.name,
            width: f.width, height: f.height, original: f.canvas, canvas: f.canvas,
            thumb: f.canvas.toDataURL('image/png'), replaced: false,
          };
        }),
      });
    }
    for (const m of modules.values()) {
      if (sheetMods.has(m.moduleId)) continue;
      const a: LooseAsset = { id: `asset:${m.kind}/${m.name}`, kind: m.kind, name: m.name, mime: m.mime, module: m, uri: m.uri, replaced: false };
      if (m.mime.startsWith('image/')) {
        try {
          const bmp = await decodeImage(dataUriBytes(m.uri), m.mime);
          a.width = bmp.width;
          a.height = bmp.height;
          bmp.close();
        } catch { /* keep without size */ }
      }
      this.loose.push(a);
    }
    this.loose.sort((x, y) => x.kind.localeCompare(y.kind) || x.name.localeCompare(y.name));
    this.sheets.sort((x, y) => x.key.localeCompare(y.key));
  }

  get replacedCount(): number {
    return this.loose.filter((a) => a.replaced).length + this.sheets.reduce((s, sh) => s + sh.frames.filter((f) => f.replaced).length, 0);
  }

  /** Replace a standalone asset. Images are fitted into the original pixel size so layout does not change. */
  async replaceLoose(id: string, file: File): Promise<void> {
    const a = this.loose.find((x) => x.id === id);
    if (!a) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (a.mime.startsWith('image/') && a.width && a.height) {
      const bmp = await decodeImage(bytes, file.type || mimeFromName(file.name, a.mime));
      if (bmp.width === a.width && bmp.height === a.height && (file.type || mimeFromName(file.name)) === a.mime) {
        a.uri = dataUri(a.mime, bytes);
      } else {
        const c = fitCanvas(bmp, a.width, a.height);
        a.uri = a.mime === 'image/jpeg' ? c.toDataURL('image/jpeg', 0.9) : c.toDataURL('image/png');
        if (!a.uri.startsWith(`data:${a.mime};`)) a.uri = c.toDataURL('image/png');
      }
      bmp.close();
    } else {
      a.uri = dataUri(file.type || mimeFromName(file.name, a.mime), bytes);
    }
    a.replaced = true;
  }

  async replaceFrame(id: string, file: File): Promise<void> {
    for (const sh of this.sheets) {
      const f = sh.frames.find((x) => x.id === id);
      if (!f) continue;
      const bmp = await decodeImage(new Uint8Array(await file.arrayBuffer()), file.type || mimeFromName(file.name, 'image/png'));
      f.canvas = fitCanvas(bmp, f.width, f.height);
      bmp.close();
      f.thumb = f.canvas.toDataURL('image/png');
      f.replaced = true;
    }
  }

  reset(id: string) {
    const a = this.loose.find((x) => x.id === id);
    if (a) { a.uri = a.module.uri; a.replaced = false; }
    for (const sh of this.sheets) {
      const f = sh.frames.find((x) => x.id === id);
      if (f) { f.canvas = f.original; f.thumb = f.original.toDataURL('image/png'); f.replaced = false; }
    }
  }

  resetAll() {
    this.loose.forEach((a) => this.reset(a.id));
    this.sheets.forEach((sh) => sh.frames.forEach((f) => this.reset(f.id)));
  }

  /** AppLovin / MRAID HTML (the original network of the build) with every change applied. */
  build(cfg: BuildConfig): string {
    const splices: [number, number, string][] = [];
    for (const a of this.loose) if (a.replaced) splices.push([a.module.start, a.module.end, a.uri]);
    for (const sh of this.sheets) {
      if (!sh.frames.some((f) => f.replaced)) continue; // untouched atlases stay byte-identical
      const frames: SheetFrame[] = sh.frames.map((f) => ({ name: f.frameName, width: f.width, height: f.height, canvas: f.canvas, extra: sh.extras[f.frameName] }));
      const [json, png] = repack(frames, sh.meta);
      splices.push([sh.json.start, sh.json.end, dataUri('application/json', strToU8(json))]);
      splices.push([sh.png.start, sh.png.end, png]);
    }
    splices.sort((a, b) => b[0] - a[0]);
    let html = this.html;
    for (const [s, e, v] of splices) html = html.slice(0, s) + v + html.slice(e);
    if (cfg.title.trim() && cfg.title.trim() !== this.info.title) html = setTitle(html, cfg.title.trim());
    if (this.info.storeLinks) html = setStoreLinks(html, this.info.storeLinks, { ios: cfg.ios.trim(), android: cfg.android.trim() });
    return html;
  }

  static mintegralHtml(applovinHtml: string): string {
    return toMintegral(applovinHtml);
  }

  /** Mintegral package: a zip holding a single index.html. */
  static zipIndex(html: string): Uint8Array {
    return zipSync({ 'index.html': strToU8(html) }, { level: 6 });
  }
}

/** Static checks, mirroring `playable-kit validate`. */
export function validate(html: string, network: Network, fileBytes: number): Check[] {
  const checks: Check[] = [];
  const add = (id: string, ok: boolean, message: string, level: 'warn' | 'fail' = 'fail') =>
    checks.push({ id, status: ok ? 'pass' : level, message });
  const mb = fileBytes / 1024 / 1024;
  add('size_limit', mb <= SIZE_LIMIT_MB[network], `${mb.toFixed(2)} MB (giới hạn ${SIZE_LIMIT_MB[network]} MB)`);
  const ext = externalUrls(html);
  add('no_external_urls', !ext.length, ext.length ? `${ext.length} URL ngoài: ${ext.slice(0, 3).join(', ')}` : 'Không có URL ngoài link store', 'warn');
  const an = analyticsEnabled(html);
  add('analytics_disabled', an !== true, an ? 'send() analytics có nội dung — có thể gửi dữ liệu' : 'Không gửi analytics', 'warn');
  if (network === 'mintegral') {
    const called = (fn: string) => new RegExp(`window\\.${fn}\\s*\\(\\s*\\)`).test(html);
    add('calls_gameReady', called('gameReady'), 'Gọi window.gameReady()');
    add('calls_install', called('install'), 'CTA gọi window.install()');
    add('calls_gameEnd', called('gameEnd'), 'Gọi window.gameEnd()');
    add('defines_gameStart', /window\.gameStart\s*=/.test(html), 'Định nghĩa window.gameStart');
    add('defines_gameClose', /window\.gameClose\s*=/.test(html), 'Định nghĩa window.gameClose');
    add('bridge_matches_engine', !(/luna:/.test(html) && !/Bridge\.define/.test(html)), 'Bridge SDK khớp engine của game');
    add('no_mraid_open', !/mraid\.open|window\.open\(/.test(html), 'Không còn mraid.open / window.open');
  } else {
    add('mraid_bootstrap', /mraid\.open/.test(html), 'CTA dùng mraid.open');
  }
  return checks;
}
