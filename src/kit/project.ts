// A loaded playable: inspect it, swap assets / title / store links, and build per-network outputs.
import { strToU8, unzipSync, zipSync, strFromU8 } from 'fflate';
import { dataUri, dataUriBytes, mimeFromName, stripDataUris } from './bytes';
import {
  canConvertToMintegral, detectEngine, detectNetwork, Engine, getStoreLinks, Network, setStoreLinks, setTitle,
  SIZE_LIMIT_MB, StoreLinks, toMintegral,
} from './networks';
import { resolveLoader, unwrapAlRenderHtml } from './loader';
import { decodeImage, explode, repack, SheetFrame } from './spritesheet';
import { AssetModule, findAssetModules, findInlineDataAssets, readJson, UnsupportedBuildError } from './webpack';

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
  storeLinks: StoreLinks | null; analyticsEnabled: boolean | null; analytics: AnalyticsState; externalUrls: string[];
  assetsSupported: boolean; assetsReason?: string; assetMode: 'webpack' | 'inline' | 'none'; mintegralSupported: boolean;
  title: string;
}
export type CompressMode = 'none' | 'webp-hq' | 'webp';
export const COMPRESS_QUALITY: Record<Exclude<CompressMode, 'none'>, number> = { 'webp-hq': 0.95, webp: 0.85 };
export interface BuildConfig { title: string; ios: string; android: string; disableAnalytics?: boolean; compress?: CompressMode }
export interface Check { id: string; status: 'pass' | 'warn' | 'fail'; message: string }

const URL_ALLOWLIST = ['http://www.w3.org/', 'https://github.com/mitsuhiko/webgl-meincraft'];

export type AnalyticsState = 'none' | 'active' | 'gated-off' | 'stripped';

/** Body of the analytics `send(...)` method, with its position, using brace matching. */
function findSendBody(html: string): { start: number; end: number; body: string } | null {
  const m = /playableId\s*=\s*"[^"]*"[\s\S]{0,400}?send\(\w*\)\{/.exec(html);
  if (!m) return null;
  const start = m.index + m[0].length;
  let depth = 1;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return { start, end: i, body: html.slice(start, i) };
  }
  return null;
}

/**
 * none      - no analytics module
 * stripped  - send() does nothing
 * gated-off - send() only runs when applicationSettings.analytics is true, and it is false
 * active    - send() can reach the network in this build
 */
export function analyticsState(html: string): AnalyticsState {
  const found = findSendBody(html);
  if (!found) return 'none';
  const body = found.body.trim();
  if (body === '' || /^(\/\*[\s\S]*?\*\/|\/\/[^\n]*)$/.test(body)) return 'stripped';
  if (!/fetch\(|sendBeacon|XMLHttpRequest|WebSocket/.test(body)) return 'stripped';
  const gate = /if\s*\(\s*window\.applicationSettings\.analytics\s*\)/.test(body);
  const flagOff = /window\.applicationSettings\s*=\s*\{[^}]*analytics\s*:\s*(!1|false)/.test(html);
  return gate && flagOff ? 'gated-off' : 'active';
}

export function analyticsEnabled(html: string): boolean | null {
  const s = analyticsState(html);
  return s === 'none' ? null : s === 'active';
}

/** Blank the analytics send() body and its endpoint so nothing can be sent, even if the flag flips. */
export function stripAnalytics(html: string): string {
  const found = findSendBody(html);
  let out = html;
  if (found) out = out.slice(0, found.start) + '/* analytics disabled */' + out.slice(found.end);
  return out.replace(/(analytics\.path\s*=\s*)"[^"]*"/, '$1""');
}

export function externalUrls(html: string): string[] {
  const links = getStoreLinks(html);
  const skip = new Set(links ? [links.ios, links.android] : []);
  const urls = new Set(stripDataUris(html).match(/https?:\/\/[^\s"'`<>)\\]+/g) ?? []);
  return [...urls].filter((u) => !skip.has(u) && !URL_ALLOWLIST.some((a) => u.startsWith(a))).sort();
}

/**
 * Read an uploaded playable: .html, .zip (Mintegral style), or an AppLovin loader
 * (a *_js_load.js payload, or a small HTML that pulls one from a CDN).
 */
export async function readPlayableFile(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (/\.zip$/i.test(file.name) || (buf[0] === 0x50 && buf[1] === 0x4b)) {
    const entries = unzipSync(buf);
    const names = Object.keys(entries).filter((n) => /\.html?$/i.test(n));
    if (!names.length) throw new Error('File zip không có file .html nào');
    return strFromU8(entries[names.includes('index.html') ? 'index.html' : names[0]]);
  }
  const text = new TextDecoder().decode(buf);
  if (/\.m?js$/i.test(file.name)) {
    const html = unwrapAlRenderHtml(text);
    if (!html) throw new Error('File .js này không chứa al_renderHtml({"html": ...})');
    return html;
  }
  return (await resolveLoader(text)) ?? text;
}

export interface ImportReport {
  replaced: string[]; unmatched: string[]; ambiguous: string[]; opaqueSprites: string[]; failed: string[];
}

const EXPORT_README = `Asset export - Playable Kit

Cấu trúc:
  images/   ảnh lẻ (nền, nút, hộp...)
  sounds/   âm thanh mp3
  sprites/<sheet>/<khung>.png   từng khung spritesheet, đúng kích thước game hiển thị
  manifest.json   danh sách file + kích thước gốc (width x height)

Gen lại bằng AI:
  - GIỮ NGUYÊN tên file và thư mục (đổi đuôi .png -> .webp/.jpg vẫn được nhận).
  - Sprite cần nền TRONG SUỐT (PNG/WebP có alpha). Ảnh có nền đặc sẽ bị cảnh báo.
  - Nên giữ đúng tỉ lệ khung; khác kích thước sẽ được tự co vừa kích thước gốc (giữ tỉ lệ, căn giữa).
  - Chỉ cần đưa lại những file đã gen, không cần đủ bộ.

Nạp lại: trong "Thay asset" bấm "Nạp lại hàng loạt" và chọn file .zip (hoặc nhiều ảnh cùng lúc).
`;

/** True if any pixel is not fully opaque (sampled on a downscaled copy for speed). */
function imageHasTransparency(img: ImageBitmap): boolean {
  const s = Math.min(1, 256 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * s));
  c.height = Math.max(1, Math.round(img.height * s));
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
  return false;
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
  private compressCache = new Map<string, string>();

  private constructor(html: string, info: Inspection) {
    this.html = html;
    this.info = info;
  }

  static async load(fileName: string, html: string): Promise<PlayableProject> {
    const engine = detectEngine(html);
    const info: Inspection = {
      fileName, bytes: new Blob([html]).size, engine, network: detectNetwork(html),
      storeLinks: getStoreLinks(html), analyticsEnabled: analyticsEnabled(html), analytics: analyticsState(html),
      externalUrls: externalUrls(html),
      assetsSupported: false, assetMode: 'none', mintegralSupported: canConvertToMintegral(html),
      title: /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '',
    };
    const p = new PlayableProject(html, info);
    try {
      await p.loadAssets();
      info.assetsSupported = true;
      info.assetMode = 'webpack';
    } catch (e) {
      // unknown bundler: fall back to every base64 asset inlined in the file
      p.loose = [];
      p.sheets = [];
      try {
        await p.loadInlineAssets();
        if (p.loose.length) {
          info.assetsSupported = true;
          info.assetMode = 'inline';
          info.assetsReason = 'Bundler lạ: đọc trực tiếp asset base64 trong file, không tách được khung spritesheet.';
        } else {
          info.assetsReason = e instanceof UnsupportedBuildError ? e.message : `Không đọc được asset: ${(e as Error).message}`;
        }
      } catch (e2) {
        info.assetsReason = `Không đọc được asset: ${(e2 as Error).message}`;
      }
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

  /** Fallback loader: flat list of every inline base64 asset (no spritesheet frames). */
  private async loadInlineAssets() {
    for (const m of findInlineDataAssets(this.html)) {
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
  }

  get replacedCount(): number {
    return this.loose.filter((a) => a.replaced).length + this.sheets.reduce((s, sh) => s + sh.frames.filter((f) => f.replaced).length, 0);
  }

  /** Replace a standalone asset. Images are fitted into the original pixel size so layout does not change. */
  async replaceLoose(id: string, file: Blob, name = (file as File).name ?? ''): Promise<void> {
    const a = this.loose.find((x) => x.id === id);
    if (!a) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = file.type || mimeFromName(name, a.mime);
    if (a.mime.startsWith('image/') && a.width && a.height) {
      const bmp = await decodeImage(bytes, mime);
      if (bmp.width === a.width && bmp.height === a.height && mime === a.mime) {
        a.uri = dataUri(a.mime, bytes);
      } else {
        const c = fitCanvas(bmp, a.width, a.height);
        a.uri = a.mime === 'image/jpeg' ? c.toDataURL('image/jpeg', 0.9) : c.toDataURL('image/png');
        if (!a.uri.startsWith(`data:${a.mime};`)) a.uri = c.toDataURL('image/png');
      }
      bmp.close();
    } else {
      a.uri = dataUri(mime, bytes);
    }
    a.replaced = true;
  }

  /** Replace a spritesheet frame. Returns false if the new image has no transparency (likely a solid background). */
  async replaceFrame(id: string, file: Blob, name = (file as File).name ?? ''): Promise<boolean> {
    for (const sh of this.sheets) {
      const f = sh.frames.find((x) => x.id === id);
      if (!f) continue;
      const bmp = await decodeImage(new Uint8Array(await file.arrayBuffer()), file.type || mimeFromName(name, 'image/png'));
      const hasAlpha = imageHasTransparency(bmp);
      f.canvas = fitCanvas(bmp, f.width, f.height);
      bmp.close();
      f.thumb = f.canvas.toDataURL('image/png');
      f.replaced = true;
      return hasAlpha;
    }
    return true;
  }

  // ---------------------------------------------------------------- bulk export / import (AI re-generation)

  /** Stable path of an asset inside an exported zip, e.g. images/back.jpg, sprites/food/broccoli_0.png */
  pathOf(id: string): string | null {
    const a = this.loose.find((x) => x.id === id);
    if (a) return `${a.kind}/${a.name}`;
    for (const sh of this.sheets) {
      const f = sh.frames.find((x) => x.id === id);
      if (f) return `sprites/${sh.key}/${f.label.replace(/[<>:"\\|?*]/g, '_')}.png`;
    }
    return null;
  }

  allIds(): string[] {
    return [...this.loose.map((a) => a.id), ...this.sheets.flatMap((sh) => sh.frames.map((f) => f.id))];
  }

  /** Zip of the current version of the given assets (default: all) + manifest.json + README.txt. */
  exportAssets(ids: string[] = this.allIds()): Uint8Array {
    const files: Record<string, Uint8Array> = {};
    const manifest: any[] = [];
    for (const id of ids) {
      const path = this.pathOf(id);
      if (!path) continue;
      const a = this.loose.find((x) => x.id === id);
      if (a) {
        files[path] = dataUriBytes(a.uri);
        manifest.push({ path, type: a.mime.startsWith('image/') ? 'image' : 'sound', width: a.width, height: a.height, replaced: a.replaced });
        continue;
      }
      for (const sh of this.sheets) {
        const f = sh.frames.find((x) => x.id === id);
        if (!f) continue;
        files[path] = dataUriBytes(f.canvas.toDataURL('image/png'));
        manifest.push({ path, type: 'sprite', sheet: sh.key, frame: f.frameName, width: f.width, height: f.height, transparent: true, replaced: f.replaced });
      }
    }
    files['manifest.json'] = strToU8(JSON.stringify({ source: this.info.fileName, count: manifest.length, assets: manifest }, null, 2));
    files['README.txt'] = strToU8(EXPORT_README);
    return zipSync(files, { level: 6 });
  }

  /**
   * Replace assets from a batch of files (a zip exported by exportAssets, or loose images/sounds).
   * Matching: exact path first, then unique file name (extension may differ, e.g. .png -> .webp).
   */
  async importAssets(input: File[]): Promise<ImportReport> {
    const entries: { name: string; blob: Blob }[] = [];
    for (const file of input) {
      if (/\.zip$/i.test(file.name)) {
        const unz = unzipSync(new Uint8Array(await file.arrayBuffer()));
        for (const [n, bytes] of Object.entries(unz)) {
          if (n.endsWith('/') || /(^|\/)(manifest\.json|README\.txt|__MACOSX\/.*|\.DS_Store)$/i.test(n)) continue;
          entries.push({ name: n, blob: new Blob([bytes as BlobPart], { type: mimeFromName(n, '') }) });
        }
      } else {
        entries.push({ name: (file as any).webkitRelativePath || file.name, blob: file });
      }
    }
    const byPath = new Map<string, string>();
    const byStem = new Map<string, string[]>();
    const stem = (p: string) => p.split('/').pop()!.replace(/\.[^.]+$/, '').toLowerCase();
    for (const id of this.allIds()) {
      const p = this.pathOf(id)!;
      byPath.set(p.toLowerCase(), id);
      byStem.set(stem(p), [...(byStem.get(stem(p)) ?? []), id]);
    }
    const report: ImportReport = { replaced: [], unmatched: [], ambiguous: [], opaqueSprites: [], failed: [] };
    for (const e of entries) {
      const norm = e.name.replace(/\\/g, '/').toLowerCase();
      // accept an extra top folder (e.g. "mygame_assets/sprites/food/x.png") and a changed extension
      let id = byPath.get(norm) ?? [...byPath.entries()].find(([p]) => norm.endsWith('/' + p))?.[1];
      if (!id) {
        const noExt = norm.replace(/\.[^./]+$/, '');
        id = [...byPath.entries()].find(([p]) => p.replace(/\.[^./]+$/, '') === noExt || noExt.endsWith('/' + p.replace(/\.[^./]+$/, '')))?.[1];
      }
      if (!id) {
        const c = byStem.get(stem(norm)) ?? [];
        if (c.length === 1) id = c[0];
        else if (c.length > 1) { report.ambiguous.push(e.name); continue; }
      }
      if (!id) { report.unmatched.push(e.name); continue; }
      try {
        if (id.startsWith('sprite:')) {
          if (!(await this.replaceFrame(id, e.blob, e.name))) report.opaqueSprites.push(this.pathOf(id)!);
        } else {
          await this.replaceLoose(id, e.blob, e.name);
        }
        report.replaced.push(this.pathOf(id)!);
      } catch (err) {
        report.failed.push(`${e.name}: ${(err as Error).message}`);
      }
    }
    return report;
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

  /**
   * Re-encode an image data URI to WebP. Cached per (key, mode); the original is kept
   * when WebP would be bigger (small icons sometimes are).
   */
  private async compressUri(key: string, uri: string, mode: CompressMode): Promise<string> {
    if (mode === 'none' || !uri.startsWith('data:image/')) return uri;
    const cacheKey = `${key}:${mode}:${uri.length}`;
    const hit = this.compressCache.get(cacheKey);
    if (hit) return hit;
    let out = uri;
    try {
      const bmp = await decodeImage(dataUriBytes(uri), uri.slice(5, uri.indexOf(';')));
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext('2d')!.drawImage(bmp, 0, 0);
      bmp.close();
      const webp = c.toDataURL('image/webp', COMPRESS_QUALITY[mode]);
      if (webp.startsWith('data:image/webp') && webp.length < uri.length) out = webp;
    } catch { /* keep the original on any encoder problem */ }
    this.compressCache.set(cacheKey, out);
    return out;
  }

  /** AppLovin / MRAID HTML (the original network of the build) with every change applied. */
  async build(cfg: BuildConfig): Promise<string> {
    const mode = cfg.compress ?? 'none';
    const splices: [number, number, string][] = [];
    for (const a of this.loose) {
      const compressed = a.mime.startsWith('image/') ? await this.compressUri(a.id, a.uri, mode) : a.uri;
      if (a.replaced || compressed !== a.module.uri) splices.push([a.module.start, a.module.end, compressed]);
    }
    for (const sh of this.sheets) {
      const dirty = sh.frames.some((f) => f.replaced);
      if (!dirty && mode === 'none') continue; // untouched atlases stay byte-identical
      let png = sh.png.uri;
      if (dirty) {
        const frames: SheetFrame[] = sh.frames.map((f) => ({ name: f.frameName, width: f.width, height: f.height, canvas: f.canvas, extra: sh.extras[f.frameName] }));
        const [json, repacked] = repack(frames, sh.meta);
        splices.push([sh.json.start, sh.json.end, dataUri('application/json', strToU8(json))]);
        png = repacked;
      }
      splices.push([sh.png.start, sh.png.end, await this.compressUri(sh.key + (dirty ? ':dirty' : ''), png, mode)]);
    }
    splices.sort((a, b) => b[0] - a[0]);
    let html = this.html;
    for (const [s, e, v] of splices) html = html.slice(0, s) + v + html.slice(e);
    if (cfg.disableAnalytics) html = stripAnalytics(html);
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
  const an = analyticsState(html);
  add('analytics_disabled', an !== 'active', {
    none: 'Không có module analytics',
    stripped: 'Analytics đã bị gỡ',
    'gated-off': 'Analytics bị khoá bằng cờ applicationSettings.analytics=false (không gửi)',
    active: 'Analytics có thể gửi dữ liệu ra ngoài',
  }[an], 'warn');
  if (network === 'mintegral') {
    const called = (fn: string) => new RegExp(`window\\.${fn}\\s*\\(\\s*\\)`).test(html);
    add('calls_gameReady', called('gameReady'), 'Gọi window.gameReady()');
    add('calls_install', called('install'), 'CTA gọi window.install()');
    add('calls_gameEnd', called('gameEnd'), 'Gọi window.gameEnd()');
    add('defines_gameStart', /window\.gameStart\s*=/.test(html), 'Định nghĩa window.gameStart');
    add('defines_gameClose', /window\.gameClose\s*=/.test(html), 'Định nghĩa window.gameClose');
    add('bridge_matches_engine', !(/luna:/.test(html) && !/Bridge\.define/.test(html)), 'Bridge SDK khớp engine của game');
    const shimmed = html.includes('mtg:start');
    add('no_mraid_open', shimmed || !/mraid\.open|window\.open\(/.test(html),
      shimmed ? 'MRAID được chuyển tiếp sang SDK Mintegral (shim)' : 'Không còn mraid.open / window.open');
  } else {
    add('mraid_bootstrap', /mraid\.open/.test(html), 'CTA dùng mraid.open');
  }
  return checks;
}
