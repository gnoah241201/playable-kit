import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  RotateCcw,
  Smartphone,
  Tablet,
  Maximize2,
  ExternalLink,
  Download,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Sparkles,
  Apple,
  Store,
  Images,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import { PlayableConfig, EMPTY_CONFIG, DeviceMode } from './types';
import { PlayableProject, readPlayableFile } from './kit/project';
import { toMintegral } from './kit/networks';
import { withPreviewHooks, PreviewMode, PreviewEvent } from './kit/preview';
import { formatBytes } from './kit/bytes';
import ConfigModal from './components/ConfigModal';
import DownloadModal from './components/DownloadModal';
import AssetsModal from './components/AssetsModal';
import UploadZone from './components/UploadZone';

export default function App() {
  const [project, setProject] = useState<PlayableProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [config, setConfig] = useState<PlayableConfig>(EMPTY_CONFIG);
  const [original, setOriginal] = useState<PlayableConfig>(EMPTY_CONFIG);
  const [assetsVersion, setAssetsVersion] = useState(0);
  const [builtHtml, setBuiltHtml] = useState('');
  const [buildError, setBuildError] = useState<string | null>(null);

  const [deviceMode, setDeviceMode] = useState<DeviceMode>('portrait');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('applovin');
  const [previewUrl, setPreviewUrl] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [events, setEvents] = useState<PreviewEvent[]>([]);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isAssetsModalOpen, setIsAssetsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((prev) => (prev === msg ? null : prev)), 2800);
  }, []);

  // 1. Load a playable chosen by the user
  const handleFile = async (file: File) => {
    setLoading(true);
    setLoadError(null);
    try {
      const html = await readPlayableFile(file);
      const p = await PlayableProject.load(file.name, html);
      const orig: PlayableConfig = {
        gameTitle: p.info.title,
        iosStoreUrl: p.info.storeLinks?.ios ?? '',
        androidStoreUrl: p.info.storeLinks?.android ?? '',
        syncLinks: false,
      };
      setProject(p);
      setOriginal(orig);
      setConfig(orig);
      setPreviewMode('applovin');
      setAssetsVersion(0);
      showToast(`Đã nạp ${file.name}`);
    } catch (e) {
      setLoadError(`Không đọc được file: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const links = useMemo(() => ({
    ios: config.iosStoreUrl,
    android: config.syncLinks ? config.iosStoreUrl : config.androidStoreUrl,
  }), [config]);

  // 2. Rebuild whenever config or assets change
  useEffect(() => {
    if (!project) return;
    const id = setTimeout(() => {
      try {
        setBuiltHtml(project.build({ title: config.gameTitle, ...links }));
        setBuildError(null);
      } catch (e) {
        setBuildError((e as Error).message);
      }
    }, 0);
    return () => clearTimeout(id);
  }, [project, config.gameTitle, links, assetsVersion]);

  // 3. Instrumented preview (mock SDK) served from a blob URL
  useEffect(() => {
    if (!builtHtml) return;
    let html = builtHtml;
    if (previewMode === 'mintegral') {
      try {
        html = toMintegral(builtHtml);
      } catch {
        setPreviewMode('applovin');
        return;
      }
    }
    const url = URL.createObjectURL(new Blob([withPreviewHooks(html, previewMode)], { type: 'text/html' }));
    setPreviewUrl(url);
    setEvents([]);
    return () => URL.revokeObjectURL(url);
  }, [builtHtml, previewMode, reloadKey]);

  // 4. SDK / CTA calls reported by the preview iframe
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.__pk !== 1) return;
      setEvents((prev) => [...prev.slice(-19), { type: d.type, detail: d.detail, t: d.t }]);
      if (/CTA/.test(d.type)) showToast(d.detail ? `CTA → ${d.detail}` : `CTA → ${d.type}`);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [showToast]);

  const handleSaveConfig = (newConfig: PlayableConfig) => {
    setConfig(newConfig);
    showToast('Đã lưu tên game và link store');
  };

  const handleTestLink = (platform: 'ios' | 'android') => {
    const url = platform === 'ios' ? links.ios : links.android;
    if (url) window.open(url, '_blank');
    else showToast(`Chưa có URL cho ${platform === 'ios' ? 'iOS' : 'Android'}`);
  };

  const isConfigModified =
    config.gameTitle !== original.gameTitle ||
    config.iosStoreUrl !== original.iosStoreUrl ||
    config.androidStoreUrl !== original.androidStoreUrl ||
    config.syncLinks !== original.syncLinks;

  const getContainerDimensions = () => {
    switch (deviceMode) {
      case 'portrait':
        return 'w-[393px] h-[780px] max-h-[calc(100vh-210px)] shadow-2xl rounded-3xl border-8 border-slate-900 shrink-0';
      case 'landscape':
        return 'w-[750px] h-[375px] max-w-[95vw] max-h-[calc(100vh-210px)] shadow-2xl rounded-3xl border-8 border-slate-900 shrink-0';
      case 'tablet':
        return 'w-[600px] h-[800px] max-h-[calc(100vh-210px)] shadow-2xl rounded-2xl border-8 border-slate-900 shrink-0';
      case 'responsive':
      default:
        return 'w-full h-full max-w-4xl rounded-2xl border border-slate-300 shadow-lg';
    }
  };

  const info = project?.info;
  const warnings: string[] = [];
  if (info) {
    if (info.analyticsEnabled) warnings.push('Module analytics đang hoạt động — playable có thể gửi dữ liệu ra ngoài.');
    if (info.externalUrls.length) warnings.push(`Có ${info.externalUrls.length} URL ngoài link store: ${info.externalUrls.slice(0, 2).join(', ')}`);
    if (!info.storeLinks) warnings.push('Không tìm thấy link store trong file — không đổi link được.');
    if (!info.assetsSupported && info.assetsReason) warnings.push(`Không thay asset được: ${info.assetsReason}`);
    if (buildError) warnings.push(`Lỗi build: ${buildError}`);
  }

  const modeBtn = (active: boolean) =>
    `px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer ${active ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`;
  const viewBtn = (active: boolean) =>
    `p-1.5 rounded-lg transition-colors cursor-pointer ${active ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`;

  if (!project) {
    return (
      <div id="playable-app-root" className="h-screen flex flex-col items-center justify-center gap-6 bg-slate-100 text-slate-800 font-sans p-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-900">Playable Kit</h1>
          <p className="text-xs text-slate-500 mt-1">Đổi link store, thay asset và xuất playable cho AppLovin / Mintegral</p>
        </div>
        <UploadZone onFile={handleFile} loading={loading} error={loadError} />
      </div>
    );
  }

  return (
    <div id="playable-app-root" className="h-screen flex flex-col bg-slate-100 text-slate-800 font-sans overflow-hidden">
      {toastMessage && (
        <div className="fixed bottom-14 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 animate-fadeIn border border-slate-700 max-w-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      <header id="main-header" className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-xs shrink-0">▶</div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight truncate max-w-[280px]">
                {config.gameTitle || info!.fileName}
              </h1>
              {(isConfigModified || project.replacedCount > 0) && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Đã tùy biến{project.replacedCount ? ` · ${project.replacedCount} asset` : ''}
                </span>
              )}
              <span className={`hidden md:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${info!.analyticsEnabled ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}`}>
                <ShieldCheck className="w-3 h-3" />
                {info!.analyticsEnabled ? 'Có analytics' : 'Không tracking'}
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              {info!.fileName} • {formatBytes(info!.bytes)} • engine: <b>{info!.engine}</b> • mạng gốc: <b>{info!.network ?? '?'}</b>
              {info!.assetsSupported && <> • {project.loose.length} asset + {project.sheets.reduce((s, x) => s + x.frames.length, 0)} khung sprite</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button id="open-config-btn" onClick={() => setIsConfigModalOpen(true)} disabled={!info!.storeLinks}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-xl shadow-xs cursor-pointer">
            <Sliders className="w-3.5 h-3.5" />
            <span>Store & Tên game</span>
          </button>
          <button id="open-assets-btn" onClick={() => setIsAssetsModalOpen(true)} disabled={!info!.assetsSupported}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl shadow-xs cursor-pointer"
            title={info!.assetsSupported ? 'Thay ảnh, âm thanh, spritesheet' : info!.assetsReason}>
            <Images className="w-3.5 h-3.5" />
            <span>Thay asset</span>
          </button>
          <button id="reload-game-btn" onClick={() => setReloadKey((k) => k + 1)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer" title="Khởi động lại game">
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Khởi động lại</span>
          </button>
          <button id="open-tab-btn" onClick={() => previewUrl && window.open(previewUrl, '_blank')}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl cursor-pointer" title="Mở bản xem trước trong tab mới">
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mở tab mới</span>
          </button>
          <UploadZone onFile={handleFile} loading={loading} error={null} compact />
          <button id="open-download-modal-btn" onClick={() => setIsDownloadModalOpen(true)} disabled={!builtHtml}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl shadow-xs cursor-pointer">
            <Download className="w-3.5 h-3.5" />
            <span>Tải file</span>
          </button>
        </div>
      </header>

      {warnings.length > 0 && (
        <div id="inspect-warnings" className="bg-amber-50 border-b border-amber-200 px-4 sm:px-6 py-1.5 text-[11px] text-amber-900 space-y-0.5">
          {warnings.map((w) => (
            <div key={w} className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />{w}</div>
          ))}
        </div>
      )}

      <div id="preview-toolbar" className="bg-white/80 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <span className="text-slate-400 font-medium hidden sm:inline">Link store:</span>
          <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
            <Apple className="w-3.5 h-3.5 text-slate-900" />
            <span className="font-mono text-slate-500 max-w-[160px] truncate" title={links.ios}>{links.ios || 'Chưa đặt'}</span>
            <button id="test-ios-link-btn" onClick={() => handleTestLink('ios')} className="text-amber-600 hover:text-amber-700 p-0.5 cursor-pointer" title="Mở link iOS">
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700">
            <Store className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-mono text-slate-500 max-w-[160px] truncate" title={links.android}>{links.android || 'Chưa đặt'}</span>
            <button id="test-android-link-btn" onClick={() => handleTestLink('android')} className="text-amber-600 hover:text-amber-700 p-0.5 cursor-pointer" title="Mở link Android">
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px]">
            <button id="format-applovin-btn" onClick={() => setPreviewMode('applovin')} className={modeBtn(previewMode === 'applovin')}>AppLovin / MRAID</button>
            <button id="format-mintegral-btn" onClick={() => setPreviewMode('mintegral')} disabled={!info!.mintegralSupported}
              className={`${modeBtn(previewMode === 'mintegral')} disabled:opacity-40`} title={info!.mintegralSupported ? '' : 'Build này chưa chuyển được sang Mintegral'}>
              Mintegral
            </button>
          </div>
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button id="view-responsive-btn" onClick={() => setDeviceMode('responsive')} className={viewBtn(deviceMode === 'responsive')} title="Responsive"><Maximize2 className="w-3.5 h-3.5" /></button>
            <button id="view-portrait-btn" onClick={() => setDeviceMode('portrait')} className={viewBtn(deviceMode === 'portrait')} title="Portrait"><Smartphone className="w-3.5 h-3.5" /></button>
            <button id="view-landscape-btn" onClick={() => setDeviceMode('landscape')} className={viewBtn(deviceMode === 'landscape')} title="Landscape"><Smartphone className="w-3.5 h-3.5 rotate-90" /></button>
            <button id="view-tablet-btn" onClick={() => setDeviceMode('tablet')} className={viewBtn(deviceMode === 'tablet')} title="Tablet"><Tablet className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </div>

      <main id="game-stage" className="flex-1 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden bg-slate-200/50 relative">
        <div className={`transition-all duration-300 ease-out overflow-hidden relative bg-black flex items-center justify-center ${getContainerDimensions()}`}>
          {previewUrl && (
            <iframe
              key={previewUrl}
              id="playable-game-iframe"
              src={previewUrl}
              title="Playable preview"
              className="w-full h-full border-0 block bg-black"
              allow="autoplay; fullscreen"
            />
          )}
        </div>
      </main>

      <footer id="main-footer" className="bg-white border-t border-slate-200 px-4 py-2 text-xs text-slate-600 flex items-center gap-2 overflow-x-auto shadow-2xs">
        <Activity className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        <span className="font-semibold text-slate-800 shrink-0">SDK / CTA ({previewMode === 'mintegral' ? 'Mintegral' : 'MRAID'}):</span>
        {events.length === 0 && <span className="text-slate-400">chưa có lời gọi — chơi thử đến CTA để kiểm tra</span>}
        {events.map((ev, i) => (
          <span key={i} title={ev.detail} className={`shrink-0 px-2 py-0.5 rounded-md border text-[11px] ${ev.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-200'}`}>
            {(ev.t / 1000).toFixed(1)}s {ev.type}
          </span>
        ))}
      </footer>

      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={config}
        original={original}
        analyticsEnabled={info!.analyticsEnabled}
        onSave={handleSaveConfig}
      />
      <AssetsModal
        isOpen={isAssetsModalOpen}
        onClose={() => { setIsAssetsModalOpen(false); setAssetsVersion((v) => v + 1); }}
        project={project}
        onChanged={showToast}
      />
      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        config={config}
        project={project}
        builtHtml={builtHtml}
      />
    </div>
  );
}
