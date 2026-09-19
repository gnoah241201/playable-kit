import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, Plugin} from 'vite';

function rawPlayablePlugin(): Plugin {
  return {
    name: 'raw-playable-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && (req.url === '/api/playable-template' || req.url.startsWith('/api/playable-template?'))) {
          try {
            const filePath = path.resolve(__dirname, 'public/playable.html');
            const content = fs.readFileSync(filePath, 'utf8');
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(content);
            return;
          } catch (e: any) {
            res.statusCode = 500;
            res.end(e.message || 'Error loading file');
            return;
          }
        }
        if (req.url && (req.url === '/api/playable-view' || req.url.startsWith('/api/playable-view?'))) {
          try {
            const filePath = path.resolve(__dirname, 'public/playable.html');
            let content = fs.readFileSync(filePath, 'utf8');
            // Parse query params if any
            const urlObj = new URL(req.url, 'http://localhost:3000');
            const title = urlObj.searchParams.get('title');
            const ios = urlObj.searchParams.get('ios');
            const android = urlObj.searchParams.get('android');
            const isAppLovin = urlObj.searchParams.get('format') === 'applovin';

            if (title) {
              content = content.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
            }
            if (ios) {
              content = content.replaceAll('https://apps.apple.com/us/app/royal-cooking-kitchen-madness/id1664415775', ios);
            }
            if (android) {
              content = content.replaceAll('https://play.google.com/store/apps/details?id=com.matryoshka.royal.cooking.kitchen.madness', android);
            }

            if (isAppLovin) {
              content = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title || 'Playable'} - AppLovin</title><style>html,body{width:100%!important;height:100%!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#000!important;}canvas{display:block!important;}</style></head><body style="margin:0;padding:0;overflow:hidden;background:#000;"><script>function al_renderHtml(o){document.write(o.html)}</script><script>al_renderHtml(${JSON.stringify({ html: content })});</script></body></html>`;
            }

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store');
            res.end(content);
            return;
          } catch (e: any) {
            res.statusCode = 500;
            res.end(e.message || 'Error loading file');
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), rawPlayablePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
