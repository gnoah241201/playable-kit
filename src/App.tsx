import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  RotateCcw,
  Smartphone,
  Tablet,
  Maximize2,
  ExternalLink,
  Download,
  ShieldCheck,
  CheckCircle2,
  Code2,
  FileCode,
  Sliders,
  Sparkles,
  Apple,
  Store,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Link2,
  AlertCircle
} from 'lucide-react';
import {
  PlayableConfig,
  DEFAULT_CONFIG,
  DeviceMode,
  FileType,
  ORIGINAL_IOS_URL,
  ORIGINAL_ANDROID_URL
} from './types';
import {
  generatePlayableHtml,
  generateAppLovinHtml,
  triggerDownload,
  slugifyTitle
} from './utils/playableGenerator';
import ConfigModal from './components/ConfigModal';
import DownloadModal from './components/DownloadModal';

export default function App() {
  const [config, setConfig] = useState<PlayableConfig>(DEFAULT_CONFIG);
  const [rawTemplate, setRawTemplate] = useState<string>('');
  const [loadingTemplate, setLoadingTemplate] = useState<boolean>(true);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('portrait');
  const [activeFile, setActiveFile] = useState<FileType>('standalone');
  const [reloadKey, setReloadKey] = useState<number>(0);

  const [isConfigModalOpen, setIsConfigModalOpen] = useState<boolean>(false);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  // 1. Fetch raw clean template on mount
  useEffect(() => {
    let isMounted = true;
    async function loadTemplate() {
      try {
        let text = '';
        // Try the dedicated non-HTML API endpoint first to prevent proxy script injection
        try {
          const apiRes = await fetch('/api/playable-template');
          if (apiRes.ok) {
            text = await apiRes.text();
          }
        } catch {
          // fallback below
        }

        if (!text) {
          const res = await fetch('/playable.html');
          if (!res.ok) throw new Error('Không thể tải file playable');
          text = await res.text();
        }

        if (isMounted) {
          setRawTemplate(text);
          setLoadingTemplate(false);
        }
      } catch (err) {
        console.error('Lỗi nạp playable template:', err);
        if (isMounted) {
          setLoadingTemplate(false);
          showToast('Lỗi khi tải mã nguồn playable template');
        }
      }
    }
    loadTemplate();
    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Generate customized HTML based on active config
  const customHtml = useMemo(() => {
    if (!rawTemplate) return '';
    return generatePlayableHtml(rawTemplate, config);
  }, [rawTemplate, config]);

  // 3. Create active URL for iframe preview
  // Using direct same-origin endpoint avoids Blob URL iframe sandbox / restriction issues
  const previewUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (config.gameTitle) params.set('title', config.gameTitle);
    if (config.iosStoreUrl) params.set('ios', config.iosStoreUrl);
    if (config.androidStoreUrl && !config.syncLinks) params.set('android', config.androidStoreUrl);
    else if (config.iosStoreUrl && config.syncLinks) params.set('android', config.iosStoreUrl);
    if (activeFile === 'applovin') params.set('format', 'applovin');
    params.set('t', `${reloadKey}`);

    return `/api/playable-view?${params.toString()}`;
  }, [config, activeFile, reloadKey]);

  const handleSaveConfig = (newConfig: PlayableConfig) => {
    setConfig(newConfig);
    setReloadKey((k) => k + 1);
    showToast('Đã lưu cấu hình tên game và link store thành công!');
  };

  const handleReload = () => {
    setReloadKey((k) => k + 1);
    showToast('Đã khởi động lại game');
  };

  const handleOpenNewTab = () => {
    if (previewUrl) {
      window.open(previewUrl, '_blank');
    }
  };

  const handleTestLink = (platform: 'ios' | 'android') => {
    const url = platform === 'ios'
      ? config.iosStoreUrl
      : (config.syncLinks ? config.iosStoreUrl : config.androidStoreUrl);

    if (url) {
      window.open(url, '_blank');
      showToast(`Đang mở link ${platform === 'ios' ? 'iOS App Store' : 'Google Play'}`);
    } else {
      showToast(`Chưa cài đặt URL cho ${platform === 'ios' ? 'iOS' : 'Android'}`);
    }
  };

  const isConfigModified =
    config.gameTitle !== DEFAULT_CONFIG.gameTitle ||
    config.iosStoreUrl !== DEFAULT_CONFIG.iosStoreUrl ||
    config.androidStoreUrl !== DEFAULT_CONFIG.androidStoreUrl ||
    config.syncLinks !== DEFAULT_CONFIG.syncLinks;

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

  return (
    <div id="playable-app-root" className="h-screen flex flex-col bg-slate-100 text-slate-800 font-sans overflow-hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 animate-fadeIn border border-slate-700">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header */}
      <header id="main-header" className="bg-white border-b border-slate-200 px-4 sm:px-6 py-2.5 sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* App Title & Quick Status */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xl shadow-xs">
            🍳
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {config.gameTitle || 'Royal Cooking: Kitchen Madness'}
              </h1>
              {isConfigModified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Đã tùy biến
                </span>
              )}
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                Zero Tracking
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Playable Ads • Gỡ bỏ <code className="bg-slate-100 text-slate-700 px-1 py-0.2 rounded font-mono">prod-analytics.matryoshka.com</code> • Chạy mượt mà
            </p>
          </div>
        </div>

        {/* Primary Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Main Customization Button */}
          <button
            id="open-config-btn"
            onClick={() => setIsConfigModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Điều chỉnh Store & Tên Game</span>
          </button>

          {/* Reload Button */}
          <button
            id="reload-game-btn"
            onClick={handleReload}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Khởi động lại game"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Khởi động lại</span>
          </button>

          {/* Open in New Tab */}
          <button
            id="open-tab-btn"
            onClick={handleOpenNewTab}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Mở toàn màn hình trong tab mới"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Mở tab mới</span>
          </button>

          {/* Download Button */}
          <button
            id="open-download-modal-btn"
            onClick={() => setIsDownloadModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải File</span>
          </button>
        </div>
      </header>

      {/* Sub-Header Toolbar: Links Display & Viewport */}
      <div id="preview-toolbar" className="bg-white/80 backdrop-blur-xs border-b border-slate-200 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Active Store Links Info Bar */}
        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          <span className="text-slate-400 font-medium hidden sm:inline">Link Store hiện hành:</span>

          {/* iOS Link Badge */}
          <div className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 transition-colors">
            <Apple className="w-3.5 h-3.5 text-slate-900" />
            <span className="font-semibold">iOS:</span>
            <span className="font-mono text-slate-500 max-w-[120px] sm:max-w-[160px] truncate" title={config.iosStoreUrl}>
              {config.iosStoreUrl || 'Chưa đặt'}
            </span>
            <button
              id="test-ios-link-btn"
              onClick={() => handleTestLink('ios')}
              className="text-amber-600 hover:text-amber-700 p-0.5 ml-0.5 cursor-pointer"
              title="Test mở link iOS"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Android Link Badge */}
          <div className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 transition-colors">
            <Store className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold">Android:</span>
            <span
              className="font-mono text-slate-500 max-w-[120px] sm:max-w-[160px] truncate"
              title={config.syncLinks ? config.iosStoreUrl : config.androidStoreUrl}
            >
              {config.syncLinks ? config.iosStoreUrl : (config.androidStoreUrl || 'Chưa đặt')}
            </span>
            <button
              id="test-android-link-btn"
              onClick={() => handleTestLink('android')}
              className="text-amber-600 hover:text-amber-700 p-0.5 ml-0.5 cursor-pointer"
              title="Test mở link Android"
            >
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          {/* Quick Edit shortcut */}
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="text-amber-600 hover:text-amber-700 font-semibold underline underline-offset-2 ml-1 cursor-pointer"
          >
            Đổi link
          </button>
        </div>

        {/* Viewport and Format Selectors */}
        <div className="flex items-center gap-2">
          {/* Format Selector */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px]">
            <button
              id="format-standalone-btn"
              onClick={() => setActiveFile('standalone')}
              className={`px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                activeFile === 'standalone'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              HTML
            </button>
            <button
              id="format-applovin-btn"
              onClick={() => setActiveFile('applovin')}
              className={`px-2 py-1 rounded-lg font-medium transition-colors cursor-pointer ${
                activeFile === 'applovin'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              AppLovin
            </button>
          </div>

          {/* Viewport Modes */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              id="view-responsive-btn"
              onClick={() => setDeviceMode('responsive')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                deviceMode === 'responsive'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Khung nhìn toàn màn hình (Responsive)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              id="view-portrait-btn"
              onClick={() => setDeviceMode('portrait')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                deviceMode === 'portrait'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="iPhone Portrait (393x852)"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
            <button
              id="view-landscape-btn"
              onClick={() => setDeviceMode('landscape')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                deviceMode === 'landscape'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Landscape (852x393)"
            >
              <Smartphone className="w-3.5 h-3.5 rotate-90" />
            </button>
            <button
              id="view-tablet-btn"
              onClick={() => setDeviceMode('tablet')}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                deviceMode === 'tablet'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tablet (680x900)"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Game Stage */}
      <main id="game-stage" className="flex-1 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden bg-slate-200/50 relative">
        {loadingTemplate ? (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-500">
            <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-medium">Đang nạp dữ liệu playable game...</p>
          </div>
        ) : (
          <div className={`transition-all duration-300 ease-out overflow-hidden relative bg-black flex items-center justify-center ${getContainerDimensions()}`}>
            {previewUrl && (
              <iframe
                key={`${previewUrl}-${reloadKey}`}
                id="playable-game-iframe"
                src={previewUrl}
                title={config.gameTitle || 'Royal Cooking Playable'}
                className="w-full h-full border-0 block bg-black"
                allow="autoplay; fullscreen; encrypted-media"
              />
            )}
          </div>
        )}
      </main>

      {/* Quick In-Game CTA Test & Info Footer */}
      <footer id="main-footer" className="bg-white border-t border-slate-200 px-4 py-2.5 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span className="font-semibold text-slate-800">CTA Install:</span>
          <span>Khi người chơi nhấn nút tải trong game, hệ thống sẽ mở link store bạn đã cấu hình</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="footer-test-ios-btn"
            onClick={() => handleTestLink('ios')}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            <Apple className="w-3 h-3 text-slate-900" />
            <span>Mở link iOS</span>
          </button>
          <button
            id="footer-test-android-btn"
            onClick={() => handleTestLink('android')}
            className="flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            <Store className="w-3 h-3 text-emerald-600" />
            <span>Mở link Android</span>
          </button>
        </div>
      </footer>

      {/* Customization Modal */}
      <ConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={config}
        onSave={handleSaveConfig}
      />

      {/* Download Modal */}
      <DownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setIsDownloadModalOpen(false)}
        config={config}
        customHtml={customHtml}
      />
    </div>
  );
}
