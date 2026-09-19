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

const CTX_RE = /(\d+)\(\w+,\w+,\w+\)\{const \w+=(\{"\.\/[^{}]*\})/g;
const IMPORT_RE = /importAll\(\w+\((\d+)\),\s*\w+\.ASSETS_TYPES\.(\w+)\)/g;
const MODULE_RE = /(\d+)\((\w+)\)\{"use strict";\2\.exports="(data:([^;"]+);base64,[A-Za-z0-9+/=]*)"\}/g;
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
