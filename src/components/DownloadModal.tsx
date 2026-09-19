import React, { useMemo, useState } from 'react';
import { X, Download, FileCode, Code2, Check, FileText, Package, ShieldCheck, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { PlayableConfig } from '../types';
import { slugifyTitle, triggerDownload, generateAppLovinJs, generateAppLovinHtml } from '../utils/playableGenerator';
import { PlayableProject, validate, Check as KitCheck } from '../kit/project';
import { formatBytes } from '../kit/bytes';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PlayableConfig;
  project: PlayableProject;
  builtHtml: string;
}

function CheckList({ checks }: { checks: KitCheck[] }) {
  return (
    <ul className="mt-2 space-y-0.5">
      {checks.map((c) => (
        <li key={c.id} className="flex items-start gap-1.5 text-[11px]">
          {c.status === 'pass' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
          {c.status === 'warn' && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />}
          {c.status === 'fail' && <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
          <span className={c.status === 'fail' ? 'text-rose-700' : 'text-slate-600'}>{c.message}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DownloadModal({ isOpen, onClose, config, project, builtHtml }: DownloadModalProps) {
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const baseSlug = slugifyTitle(config.gameTitle || project.info.title || project.info.fileName.replace(/\.\w+$/, ''));

  const outputs = useMemo(() => {
    if (!isOpen || !builtHtml) return null;
    const htmlBytes = new Blob([builtHtml]).size;
    let mintegral: { zip: Uint8Array; checks: KitCheck[] } | { error: string } | null = null;
    if (project.info.mintegralSupported) {
      try {
        const mhtml = PlayableProject.mintegralHtml(builtHtml);
        const zip = PlayableProject.zipIndex(mhtml);
        mintegral = { zip, checks: validate(mhtml, 'mintegral', zip.length) };
      } catch (e) {
        mintegral = { error: (e as Error).message };
      }
    }
    return { htmlBytes, applovinChecks: validate(builtHtml, 'applovin', htmlBytes), mintegral };
  }, [isOpen, builtHtml, project]);

  if (!isOpen || !outputs) return null;

  const mark = (k: string) => {
    setDownloaded(k);
    setTimeout(() => setDownloaded(null), 2500);
  };

  const items = [
    {
      key: 'html', icon: <FileCode className="w-4 h-4" />, name: `${baseSlug}.html`, tag: 'AppLovin / MRAID',
      desc: `File HTML duy nhất (${formatBytes(outputs.htmlBytes)}), asset nhúng sẵn. Dùng cho AppLovin và các mạng MRAID (Unity Ads, ironSource…).`,
      checks: outputs.applovinChecks,
      run: () => triggerDownload(builtHtml, `${baseSlug}.html`, 'text/html;charset=utf-8'),
    },
    ...(outputs.mintegral
      ? [{
          key: 'mintegral', icon: <Package className="w-4 h-4" />, name: `${baseSlug}_mintegral.zip`, tag: 'Mintegral / PlayTurbo',
          desc: 'error' in outputs.mintegral
            ? `Không chuyển được: ${outputs.mintegral.error}`
            : `Zip chứa index.html (${formatBytes(outputs.mintegral.zip.length)}): gameReady / gameStart / gameClose / gameEnd / install.`,
          checks: 'error' in outputs.mintegral ? null : outputs.mintegral.checks,
          run: () => { if (outputs.mintegral && !('error' in outputs.mintegral)) triggerDownload(outputs.mintegral.zip, `${baseSlug}_mintegral.zip`, 'application/zip'); },
        }]
      : []),
    {
      key: 'js', icon: <Code2 className="w-4 h-4" />, name: `${baseSlug}_applovin.js`, tag: null,
      desc: 'Gói JS AppLovin (al_renderHtml) để upload trực tiếp.', checks: null,
      run: () => triggerDownload(generateAppLovinJs(builtHtml), `${baseSlug}_applovin.js`, 'text/javascript;charset=utf-8'),
    },
    {
      key: 'loader', icon: <FileText className="w-4 h-4" />, name: `${baseSlug}_applovin.html`, tag: null,
      desc: 'HTML wrapper kèm loader al_renderHtml để test cục bộ.', checks: null,
      run: () => triggerDownload(generateAppLovinHtml(builtHtml, config.gameTitle || baseSlug), `${baseSlug}_applovin.html`, 'text/html;charset=utf-8'),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div id="download-modal-container" className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">Tải file playable</h2>
              <p className="text-xs text-slate-500">
                Đã áp dụng tên game, link store và {project.replacedCount} asset đã thay
              </p>
            </div>
          </div>
          <button id="close-download-modal-btn" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-2.5 text-xs">
          {!project.info.mintegralSupported && (
            <div className="flex items-start gap-2 rounded-xl p-3 border border-amber-200 bg-amber-50 text-amber-800 text-[11px]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              Build này không dùng bootstrap MRAID quen thuộc nên chưa xuất được Mintegral tự động
              {project.info.engine === 'luna' ? ' (với Luna, dùng export Mintegral có sẵn trong Luna Playground).' : '.'}
            </div>
          )}
          {items.map((it) => (
            <div key={it.key} className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-300 transition-all">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5">{it.icon}</div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                      <span>{it.name}</span>
                      {it.tag && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">{it.tag}</span>}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">{it.desc}</p>
                  </div>
                </div>
                <button
                  id={`download-${it.key}-btn`}
                  onClick={() => { it.run(); mark(it.key); }}
                  className="shrink-0 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  {downloaded === it.key ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
                  <span>{downloaded === it.key ? 'Đã tải!' : 'Tải về'}</span>
                </button>
              </div>
              {it.checks && <CheckList checks={it.checks} />}
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button id="done-download-modal-btn" onClick={onClose} className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold cursor-pointer">
            Hoàn tất
          </button>
        </div>
      </div>
    </div>
  );
}
