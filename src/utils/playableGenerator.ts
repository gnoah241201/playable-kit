import { PlayableConfig, ORIGINAL_IOS_URL, ORIGINAL_ANDROID_URL } from '../types';

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
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return clean || 'playable_game';
}

export function cleanInjectedScripts(html: string): string {
  return html
    // Remove AI Studio iframe injection script
    .replace(/<script\b[^>]*aistudio-iframe[^>]*>[\s\S]*?<\/script>/gi, '')
    // Remove Vite client injection script if any
    .replace(/<script\b[^>]*@vite\/client[^>]*>[\s\S]*?<\/script>/gi, '')
    // Fix extra closing brace if present
    .replace(/send\(t\)\{\/\* analytics disabled \*\/\}\}\}/g, 'send(t){/* analytics disabled */}}');
}

export function generatePlayableHtml(rawTemplate: string, config: PlayableConfig): string {
  let output = cleanInjectedScripts(rawTemplate);

  // 1. Replace <title>
  const cleanTitle = config.gameTitle.trim() || 'Playable Game';
  output = output.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(cleanTitle)}</title>`);

  // 2. Replace iOS URL
  const iosTarget = config.syncLinks
    ? (config.iosStoreUrl.trim() || ORIGINAL_IOS_URL)
    : (config.iosStoreUrl.trim() || ORIGINAL_IOS_URL);
  
  const androidTarget = config.syncLinks
    ? (config.iosStoreUrl.trim() || ORIGINAL_ANDROID_URL)
    : (config.androidStoreUrl.trim() || ORIGINAL_ANDROID_URL);

  output = output.replaceAll(ORIGINAL_IOS_URL, iosTarget);
  output = output.replaceAll(ORIGINAL_ANDROID_URL, androidTarget);

  return output;
}

export function generateAppLovinJs(cleanHtml: string): string {
  return `al_renderHtml(${JSON.stringify({ html: cleanHtml })});\n`;
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
    al_renderHtml(${JSON.stringify({ html: cleanHtml })});
  </script>
</body>
</html>`;
}

export function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
