export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function slugifyTitle(title: string): string {
  const clean = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || 'playable_game';
}

/**
 * JSON for embedding inside a <script> block. Every `<` becomes < so that a `</script>`
 * inside the playable cannot close the surrounding script tag (that breaks the whole file).
 */
export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function generateAppLovinJs(cleanHtml: string): string {
  return `al_renderHtml(${scriptSafeJson({ html: cleanHtml })});\n`;
}

export function generateAppLovinHtml(cleanHtml: string, title: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} - AppLovin</title>
</head>
<body style="margin:0;padding:0;overflow:hidden;background:#000;">
  <script>
    function al_renderHtml(obj) {
      document.write(obj.html);
    }
  </script>
  <script>
    al_renderHtml(${scriptSafeJson({ html: cleanHtml })});
  </script>
</body>
</html>`;
}

export function triggerDownload(content: string | Uint8Array, filename: string, mimeType: string) {
  const blob = new Blob([content as BlobPart], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
