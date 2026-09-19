import React, { useState } from 'react';
import {
  X,
  Download,
  FileCode,
  Code2,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  FileText,
  Sparkles
} from 'lucide-react';
import { PlayableConfig } from '../types';
import {
  slugifyTitle,
  triggerDownload,
  generateAppLovinJs,
  generateAppLovinHtml
} from '../utils/playableGenerator';

interface DownloadModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PlayableConfig;
  customHtml: string;
}

export default function DownloadModal({
  isOpen,
  onClose,
  config,
  customHtml,
}: DownloadModalProps) {
  const [downloadedType, setDownloadedType] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  if (!isOpen) return null;

  const baseSlug = slugifyTitle(config.gameTitle);
  const htmlFilename = `${baseSlug}.html`;
  const jsFilename = `${baseSlug}_applovin.js`;
  const applovinHtmlFilename = `${baseSlug}_applovin.html`;

  const handleDownloadHtml = () => {
    triggerDownload(customHtml, htmlFilename, 'text/html;charset=utf-8');
    setDownloadedType('html');
    setTimeout(() => setDownloadedType(null), 2500);
  };

  const handleDownloadJs = () => {
    const jsContent = generateAppLovinJs(customHtml);
    triggerDownload(jsContent, jsFilename, 'text/javascript;charset=utf-8');
    setDownloadedType('js');
    setTimeout(() => setDownloadedType(null), 2500);
  };

  const handleDownloadApplovinHtml = () => {
    const loaderHtml = generateAppLovinHtml(customHtml, config.gameTitle);
    triggerDownload(loaderHtml, applovinHtmlFilename, 'text/html;charset=utf-8');
    setDownloadedType('applovin');
    setTimeout(() => setDownloadedType(null), 2500);
  };

  const handleCopyHeadSnippet = () => {
    const snippet = `<!-- Playable: ${config.gameTitle} -->\n<!-- Store iOS: ${config.iosStoreUrl} -->\n<!-- Store Android: ${config.androidStoreUrl} -->\n<!-- Analytics prod-analytics.matryoshka.com: REMOVED -->`;
    navigator.clipboard.writeText(snippet);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        id="download-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                Tải Tệp Tin Playable Game
              </h2>
              <p className="text-xs text-slate-500">
                Đã tích hợp tên game & link store bạn vừa cấu hình
              </p>
            </div>
          </div>
          <button
            id="close-download-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Current Config Recap */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-1.5">
            <div className="flex items-center justify-between text-slate-500 text-[11px]">
              <span className="font-semibold text-slate-700">Thông tin xuất bản:</span>
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Zero Tracking
              </span>
            </div>
            <div className="text-slate-800 font-bold text-sm flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>{config.gameTitle || 'Playable Game'}</span>
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              <span className="font-medium text-slate-600">iOS:</span> {config.iosStoreUrl || 'Mặc định'}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              <span className="font-medium text-slate-600">Android:</span>{' '}
              {config.syncLinks ? config.iosStoreUrl : (config.androidStoreUrl || 'Mặc định')}
            </div>
          </div>

          {/* Download Options List */}
          <div className="space-y-2.5">
            {/* 1. Standalone HTML */}
            <div className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition-all flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <span>{htmlFilename}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Khuyên dùng
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    File HTML duy nhất (~2.39 MB), nhúng sẵn Base64 âm thanh và ảnh. Phù hợp mọi mạng QC: Facebook, Google Ads, Unity, TikTok,...
                  </p>
                </div>
              </div>
              <button
                id="download-custom-html-btn"
                onClick={handleDownloadHtml}
                className="shrink-0 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {downloadedType === 'html' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Download className="w-3.5 h-3.5" />}
                <span>{downloadedType === 'html' ? 'Đã tải!' : 'Tải về'}</span>
              </button>
            </div>

            {/* 2. AppLovin JS Bundle */}
            <div className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition-all flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Code2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    {jsFilename}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Định dạng gói JS AppLovin chuẩn (<code className="bg-slate-100 px-1 py-0.2 rounded font-mono">al_renderHtml</code>), tải trực tiếp vào dashboard AppLovin.
                  </p>
                </div>
              </div>
              <button
                id="download-custom-js-btn"
                onClick={handleDownloadJs}
                className="shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200 cursor-pointer"
              >
                {downloadedType === 'js' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5" />}
                <span>{downloadedType === 'js' ? 'Đã tải!' : 'Tải về'}</span>
              </button>
            </div>

            {/* 3. AppLovin Test HTML Loader */}
            <div className="p-3.5 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/30 transition-all flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    {applovinHtmlFilename}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    File HTML wrapper kèm script loader để chạy kiểm thử cục bộ trước khi upload.
                  </p>
                </div>
              </div>
              <button
                id="download-custom-applovin-html-btn"
                onClick={handleDownloadApplovinHtml}
                className="shrink-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-200 cursor-pointer"
              >
                {downloadedType === 'applovin' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5" />}
                <span>{downloadedType === 'applovin' ? 'Đã tải!' : 'Tải về'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            id="done-download-modal-btn"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Hoàn tất
          </button>
        </div>
      </div>
    </div>
  );
}
