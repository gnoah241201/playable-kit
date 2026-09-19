// Preview-only instrumentation: mocks the ad SDK inside the iframe and reports SDK/CTA calls to the parent window.
// Never included in downloaded files.
export type PreviewMode = 'applovin' | 'mintegral';

export interface PreviewEvent { type: string; detail?: string; t: number }

export function withPreviewHooks(html: string, mode: PreviewMode): string {
  const sdk = mode === 'mintegral'
    ? `window.gameReady=function(){post('gameReady');setTimeout(function(){post('gameStart');window.gameStart&&window.gameStart()},200)};
       window.gameEnd=function(){post('gameEnd')};window.install=function(){post('install (CTA)')};`
    : `window.mraid={getState:function(){return'default'},isViewable:function(){return true},addEventListener:function(){},
       removeEventListener:function(){},getVersion:function(){return'3.0'},open:function(u){post('mraid.open (CTA)',u)}};`;
  const hook = `<script>(function(){var t0=Date.now();function post(type,detail){try{parent.postMessage({__pk:1,type:type,
    detail:detail||'',t:Date.now()-t0},'*')}catch(e){}}
    window.open=function(u){post('window.open (CTA)',u);return null};
    window.addEventListener('error',function(e){post('error',e.message)});${sdk}})();</script>`;
  return /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + hook) : hook + html;
}
