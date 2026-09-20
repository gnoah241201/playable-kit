// Finds asset modules that webpack inlined as base64 data URIs (PixiJS playable template):
//   <ctxId>(a,b,c){const j={"./back.jpg":7019,...}}               require.context map
//   importAll(i(<ctxId>), j.ASSETS_TYPES.<kind>)                  loader registration
//   <moduleId>(a){"use strict";a.exports="data:<mime>;base64,..."} the asset itself
import { dataUriBytes } from './bytes';

export interface AssetModule {
  moduleId: string;
  kind: string; // images | sounds | spritesheets | spine | atlas ...
  name: string; // "stars/star_1.png"
  mime: string;
  uri: string; // original data URI, untouched
  start: number; // span of the data URI in the html
  end: number;
}

// Two webpack output shapes are supported:
//   old: 2853(A,I,i){const j={"./x.png":100}}      and  100(A){"use strict";A.exports="data:..."}
//   new: 2853:(M,L,j)=>{var w={"./x.png":100}}     and  100:M=>{"use strict";M.exports="data:..."}
const CTX_RE = /(\d+)\s*:?\s*\(\w+,\s*\w+,\s*\w+\)\s*(?:=>)?\s*\{\s*(?:const|var|let)\s+\w+\s*=\s*(\{"\.\/[^{}]*\})/g;
const IMPORT_RE = /importAll\(\w+\((\d+)\),\s*\w+\.ASSETS_TYPES\.(\w+)\)/g;
const MODULE_RE = /(\d+)\s*:?\s*\(?(\w+)\)?\s*(?:=>)?\s*\{"use strict";\2\.exports="(data:([^;"]+);base64,[A-Za-z0-9+/=]*)"\}/g;
const ENTRY_RE = /"\.\/([^"]+)":(\d+)/g;

export class UnsupportedBuildError extends Error {
  code = 'unsupported_build';
}

export function findAssetModules(html: string): Map<string, AssetModule> {
  const ctxKind = new Map<string, string>();
  for (const m of html.matchAll(IMPORT_RE)) ctxKind.set(m[1], m[2]);
  const names = new Map<string, [string, string]>();
  for (const m of html.matchAll(CTX_RE)) {
    const kind = ctxKind.get(m[1]);
    if (!kind) continue;
    for (const e of m[2].matchAll(ENTRY_RE)) names.set(e[2], [kind, e[1]]);
  }
  if (!names.size) {
    throw new UnsupportedBuildError(
      'Không tìm thấy asset nhúng kiểu webpack (importAll/ASSETS_TYPES). Chỉ hỗ trợ playable PixiJS/webpack nhúng base64.');
  }
  const modules = new Map<string, AssetModule>();
  for (const m of html.matchAll(MODULE_RE)) {
    const info = names.get(m[1]);
    if (!info) continue;
    const start = m.index! + m[0].indexOf(m[3]);
    modules.set(m[1], { moduleId: m[1], kind: info[0], name: info[1], mime: m[4], uri: m[3], start, end: start + m[3].length });
  }
  const missing = [...names.keys()].filter((k) => !modules.has(k));
  if (missing.length) {
    throw new UnsupportedBuildError(`${missing.length} asset không được nhúng trong file (build tải asset từ bên ngoài).`);
  }
  return modules;
}

export function readJson(uri: string): any {
  return JSON.parse(new TextDecoder().decode(dataUriBytes(uri)).replace(/^﻿/, ''));
}

const INLINE_RE = /data:(image\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/json|text\/plain);base64,[A-Za-z0-9+/=]{64,}/g;
// a key right before the data URI, e.g.  "/assets/walls/wall_l.png": `data:image/png;base64,...`
const NAME_BEFORE_RE = /"([^"]{1,140}\.(?:png|jpe?g|webp|avif|mp3|ogg|wav|m4a|json|txt|atlas))"\s*:\s*[`"']$/i;

/**
 * Engine-agnostic fallback: every base64 asset inlined anywhere in the file, named after the
 * nearby key when the bundle has one. Used when the webpack asset registry is not present.
 */
export function findInlineDataAssets(html: string): AssetModule[] {
  const out: AssetModule[] = [];
  const used = new Set<string>();
  for (const m of html.matchAll(INLINE_RE)) {
    const uri = m[0];
    const mime = m[1];
    const before = html.slice(Math.max(0, m.index! - 200), m.index!);
    const named = NAME_BEFORE_RE.exec(before)?.[1];
    const ext = mime.split('/')[1].replace('jpeg', 'jpg').replace('mpeg', 'mp3').replace('svg+xml', 'svg');
    let name = (named ?? `asset_${String(out.length + 1).padStart(3, '0')}.${ext}`).replace(/^[./]+/, '');
    while (used.has(name.toLowerCase())) name = name.replace(/(\.[^.]+)$/, '_2$1');
    used.add(name.toLowerCase());
    const kind = mime.startsWith('image/') ? 'images' : mime.startsWith('audio/') ? 'sounds' : 'data';
    out.push({ moduleId: `inline_${out.length}`, kind, name, mime, uri, start: m.index!, end: m.index! + uri.length });
  }
  return out;
}
