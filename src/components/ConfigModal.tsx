import React, { useState, useEffect } from 'react';
import {
  X,
  Sliders,
  Sparkles,
  ExternalLink,
  RotateCcw,
  Check,
  Apple,
  Store,
  Link2,
  Copy,
  Info,
  ShieldCheck,
  Layers,
  ArrowRight
} from 'lucide-react';
import { PlayableConfig } from '../types';
import { AnalyticsState } from '../kit/project';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PlayableConfig;
  original: PlayableConfig;
  analytics: AnalyticsState;
  onSave: (newConfig: PlayableConfig) => void;
}

export default function ConfigModal({
  isOpen,
  onClose,
  config,
  original,
  analytics,
  onSave,
}: ConfigModalProps) {
  const [formConfig, setFormConfig] = useState<PlayableConfig>(config);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setFormConfig(config);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onSave(formConfig);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  const handleResetToDefault = () => {
    setFormConfig(original);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div
        id="config-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-slate-800"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                Điều Chỉnh Thông Tin Game & Store Links
              </h2>
              <p className="text-xs text-slate-500">
                Tự động thay thế trong mã nguồn HTML & JS của Playable Game
              </p>
            </div>
          </div>
          <button
            id="close-config-modal-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Analytics status (from inspect) + strip toggle */}
          <div className={`rounded-xl p-3 border ${analytics === 'active' && !formConfig.disableAnalytics ? 'bg-rose-50 border-rose-200 text-rose-800'
            : analytics === 'gated-off' && !formConfig.disableAnalytics ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                {{
                  none: 'Không có module analytics trong file.',
                  stripped: 'Module analytics đã bị gỡ sẵn trong file.',
                  'gated-off': 'Có module analytics nhưng đang bị khoá bằng cờ applicationSettings.analytics = false, nên không gửi gì. Code và endpoint vẫn còn trong file.',
                  active: 'Module analytics đang hoạt động — playable có thể gửi dữ liệu ra ngoài.',
                }[analytics]}
                <div className="mt-1 text-slate-500">Bản Mintegral dùng link của campaign khi gọi install(), link trong file chỉ dùng cho AppLovin/MRAID.</div>
              </div>
            </div>
            {(analytics === 'active' || analytics === 'gated-off') && (
              <label className="mt-2.5 flex items-center gap-2 cursor-pointer text-[11px] font-semibold text-slate-700 bg-white/70 rounded-lg px-2.5 py-1.5 border border-slate-200">
                <input
                  id="disable-analytics-toggle"
                  type="checkbox"
                  checked={formConfig.disableAnalytics}
                  onChange={(e) => setFormConfig({ ...formConfig, disableAnalytics: e.target.checked })}
                  className="accent-amber-500"
                />
                Tắt analytics khi xuất file (xoá thân hàm send() và endpoint)
              </label>
            )}
          </div>

          {/* Game Title Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="game-title-input" className="font-bold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Tên Game (Title & Thẻ &lt;title&gt;)</span>
              </label>
              <span className="text-[11px] text-slate-400">
                {formConfig.gameTitle.length} ký tự
              </span>
            </div>
            <input
              id="game-title-input"
              type="text"
              value={formConfig.gameTitle}
              onChange={(e) => setFormConfig({ ...formConfig, gameTitle: e.target.value })}
              placeholder={original.gameTitle || "Tên game của bạn"}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-hidden transition-all bg-white font-medium"
            />
            <p className="text-[11px] text-slate-500">
              Tên này sẽ hiển thị trên thanh tiêu đề trình duyệt và định danh tệp tin khi tải về.
            </p>
          </div>

          {/* Sync Links Switch */}
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div className="space-y-0.5">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-slate-600" />
                <span>Dùng chung 1 Link Store (SmartLink / OneLink / Adjust)</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Tự động dùng URL iOS cho cả hệ điều hành Android khi người chơi nhấn nút tải.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="sync-links-toggle"
                type="checkbox"
                checked={formConfig.syncLinks}
                onChange={(e) => setFormConfig({ ...formConfig, syncLinks: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {/* iOS App Store URL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="ios-url-input" className="font-bold text-slate-700 flex items-center gap-1.5">
                <Apple className="w-3.5 h-3.5 text-slate-900" />
                <span>Link Apple App Store (iOS)</span>
              </label>
              {formConfig.iosStoreUrl && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleCopy(formConfig.iosStoreUrl, 'ios')}
                    className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    {copiedField === 'ios' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedField === 'ios' ? 'Đã chép' : 'Sao chép'}</span>
                  </button>
                  <a
                    href={formConfig.iosStoreUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-600 hover:text-amber-700 flex items-center gap-0.5 text-[11px] font-medium"
                    title="Mở kiểm tra URL"
                  >
                    <span>Test mở</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
            <input
              id="ios-url-input"
              type="url"
              value={formConfig.iosStoreUrl}
              onChange={(e) => setFormConfig({ ...formConfig, iosStoreUrl: e.target.value })}
              placeholder="https://apps.apple.com/us/app/..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-hidden transition-all font-mono bg-white"
            />
          </div>

          {/* Android Google Play Store URL */}
          {!formConfig.syncLinks && (
            <div className="space-y-1.5 animate-fadeIn">
              <div className="flex items-center justify-between">
                <label htmlFor="android-url-input" className="font-bold text-slate-700 flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Link Google Play Store (Android)</span>
                </label>
                {formConfig.androidStoreUrl && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopy(formConfig.androidStoreUrl, 'android')}
                      className="text-slate-500 hover:text-slate-700 flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      {copiedField === 'android' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedField === 'android' ? 'Đã chép' : 'Sao chép'}</span>
                    </button>
                    <a
                      href={formConfig.androidStoreUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-600 hover:text-amber-700 flex items-center gap-0.5 text-[11px] font-medium"
                      title="Mở kiểm tra URL"
                    >
                      <span>Test mở</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
              <input
                id="android-url-input"
                type="url"
                value={formConfig.androidStoreUrl}
                onChange={(e) => setFormConfig({ ...formConfig, androidStoreUrl: e.target.value })}
                placeholder="https://play.google.com/store/apps/details?id=..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-hidden transition-all font-mono bg-white"
              />
            </div>
          )}

          {/* Original links detected in the file */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-1 text-[11px] text-slate-500">
            <div className="font-semibold text-slate-700">Link gốc trong file:</div>
            <div className="truncate font-mono" title={original.iosStoreUrl}>iOS: {original.iosStoreUrl || '—'}</div>
            <div className="truncate font-mono" title={original.androidStoreUrl}>Android: {original.androidStoreUrl || '—'}</div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-3">
          <button
            type="button"
            id="reset-config-btn"
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục link gốc</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              id="cancel-config-btn"
              onClick={onClose}
              className="px-4 py-1.5 text-xs text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer font-medium"
            >
              Hủy
            </button>
            <button
              type="button"
              id="save-config-btn"
              onClick={() => handleSave()}
              className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-xl text-white shadow-xs transition-all cursor-pointer ${
                saveSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-amber-500 hover:bg-amber-600'
              }`}
            >
              {saveSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã lưu!</span>
                </>
              ) : (
                <>
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Áp Dụng & Cập Nhật Game</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
