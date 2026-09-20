// AppLovin ships playables as a loader: a small HTML that pulls `al_renderHtml({"html": "..."})`
// from a CDN. These helpers turn such a loader back into the self-contained HTML.

/** Extract the HTML from an `al_renderHtml({...})` payload (a *_js_load.js file or an inline call). */
export function unwrapAlRenderHtml(text: string): string | null {
  const call = /al_renderHtml\s*\(\s*\{/.exec(text);
  if (!call) return null;
  const start = text.indexOf('{', call.index);
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) { end = i + 1; break; }
  }
  if (end < 0) return null;
  try {
    const obj = JSON.parse(text.slice(start, end));
    return typeof obj?.html === 'string' ? obj.html : null;
  } catch {
    return null;
  }
}

/** URL of the remote payload referenced by a loader HTML, if that is all the file contains. */
export function findLoaderUrl(html: string): string | null {
  if (!/al_renderHtml/.test(html) || /ASSETS_TYPES|LunaUnity/.test(html)) return null;
  const m = /<script[^>]+src=["']([^"']+_js_load\.js[^"']*|[^"']+\.js)["']/i.exec(html);
  return m ? m[1] : null;
}

export class LoaderFetchError extends Error {
  constructor(public url: string, cause: string) {
    const blocked = /failed to fetch|networkerror|load failed/i.test(cause);
    super(
      `Không tải được nội dung playable từ ${url} (${cause}).` +
      (blocked
        ? ' Thường là do trình chặn quảng cáo (uBlock, AdGuard) hoặc DNS chặn domain quảng cáo.'
          + ' Cách xử lý: tắt trình chặn cho trang này rồi thử lại, HOẶC mở link trên trong trình duyệt,'
          + ' lưu file .js về (Ctrl+S) rồi kéo thẳng file .js vào đây — cách này không cần mạng.'
        : ' Hãy mở link đó trong trình duyệt, lưu file .js về rồi kéo thẳng file .js vào đây.'),
    );
  }
}

/** Resolve a loader HTML into the real playable HTML, downloading the payload if needed. */
export async function resolveLoader(html: string): Promise<string | null> {
  const inline = unwrapAlRenderHtml(html);
  if (inline) return inline;
  const url = findLoaderUrl(html);
  if (!url) return null;
  let text: string;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    text = await res.text();
  } catch (e) {
    throw new LoaderFetchError(url, (e as Error).message);
  }
  const out = unwrapAlRenderHtml(text);
  if (!out) throw new LoaderFetchError(url, 'nội dung tải về không phải al_renderHtml');
  return out;
}
