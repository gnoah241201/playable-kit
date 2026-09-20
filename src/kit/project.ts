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
    if (a) return `${a.mime.startsWith('image/') ? 'images' : 'sounds'}/${a.name}`;
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
