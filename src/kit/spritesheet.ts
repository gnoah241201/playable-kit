// TexturePacker (JSON hash) spritesheets: explode to full-size frames, repack on change.
import { dataUriBytes } from './bytes';

const FRAME_KEYS = new Set(['frame', 'rotated', 'trimmed', 'spriteSourceSize', 'sourceSize']);

export interface SheetFrame {
  name: string;
  width: number;
  height: number;
  canvas: HTMLCanvasElement; // full sourceSize, un-rotated, untrimmed
  extra: Record<string, unknown>;
}

export async function decodeImage(bytes: Uint8Array, mime: string): Promise<ImageBitmap> {
  return createImageBitmap(new Blob([bytes as BlobPart], { type: mime }));
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

export async function explode(sheetJson: any, atlasUri: string): Promise<SheetFrame[]> {
  if (!sheetJson || typeof sheetJson.frames !== 'object' || Array.isArray(sheetJson.frames)) {
    throw new Error('Chỉ hỗ trợ spritesheet TexturePacker dạng JSON hash');
  }
  const atlas = await decodeImage(dataUriBytes(atlasUri), 'image/png');
  const out: SheetFrame[] = [];
  for (const [name, f] of Object.entries<any>(sheetJson.frames)) {
    const { frame: fr, spriteSourceSize: ss, sourceSize: src } = f;
    const c = canvas(src.w, src.h);
    const ctx = c.getContext('2d')!;
    if (f.rotated) {
      // stored rotated 90° clockwise in the atlas: rotate back counter-clockwise
      ctx.save();
      ctx.translate(ss.x, ss.y + fr.h);
      ctx.rotate(-Math.PI / 2);
      ctx.drawImage(atlas, fr.x, fr.y, fr.h, fr.w, 0, 0, fr.h, fr.w);
      ctx.restore();
    } else {
      ctx.drawImage(atlas, fr.x, fr.y, fr.w, fr.h, ss.x, ss.y, fr.w, fr.h);
    }
    const extra: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(f)) if (!FRAME_KEYS.has(k)) extra[k] = v;
    out.push({ name, width: src.w, height: src.h, canvas: c, extra });
  }
  atlas.close();
  return out;
}

function alphaBBox(c: HTMLCanvasElement): [number, number, number, number] {
  const { data, width, height } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height);
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? [0, 0, 1, 1] : [x0, y0, x1 + 1, y1 + 1];
}

/** Repack frames (alpha-trimmed, never rotated). Returns [jsonString, pngDataUri]. */
export function repack(frames: SheetFrame[], meta: any, pad = 2): [string, string] {
  const items = frames.map((f) => {
    const bbox = alphaBBox(f.canvas);
    return { f, bbox, w: bbox[2] - bbox[0], h: bbox[3] - bbox[1] };
  });
  const area = items.reduce((s, it) => s + (it.w + pad) * (it.h + pad), 0);
  const width = Math.max(Math.max(...items.map((it) => it.w)) + pad, Math.floor(Math.sqrt(area) * 1.15));
  const sorted = [...items].sort((a, b) => b.h - a.h || a.f.name.localeCompare(b.f.name));
  const pos = new Map<string, [number, number]>();
  let x = 0, y = 0, rowH = 0;
  for (const it of sorted) {
    if (x + it.w > width) { x = 0; y += rowH + pad; rowH = 0; }
    pos.set(it.f.name, [x, y]);
    x += it.w + pad;
    rowH = Math.max(rowH, it.h);
  }
  const atlas = canvas(width, y + rowH);
  const ctx = atlas.getContext('2d')!;
  const outFrames: Record<string, unknown> = {};
  for (const it of items) {
    const [px, py] = pos.get(it.f.name)!;
    ctx.drawImage(it.f.canvas, it.bbox[0], it.bbox[1], it.w, it.h, px, py, it.w, it.h);
    outFrames[it.f.name] = {
      frame: { x: px, y: py, w: it.w, h: it.h }, rotated: false,
      trimmed: it.w !== it.f.width || it.h !== it.f.height,
      spriteSourceSize: { x: it.bbox[0], y: it.bbox[1], w: it.w, h: it.h },
      sourceSize: { w: it.f.width, h: it.f.height }, ...it.f.extra,
    };
  }
  const json = JSON.stringify({ frames: outFrames, meta: { ...meta, size: { w: atlas.width, h: atlas.height } } });
  return [json, atlas.toDataURL('image/png')];
}
