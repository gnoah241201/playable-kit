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
import { PlayableConfig, DEFAULT_CONFIG } from '../types';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: PlayableConfig;
  onSave: (newConfig: PlayableConfig) => void;
}

export default function ConfigModal({
  isOpen,
  onClose,
  config,
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
    setFormConfig(DEFAULT_CONFIG);
  };

  const handleApplyPreset = (preset: 'appsflyer' | 'adjust' | 'blank') => {
    if (preset === 'appsflyer') {
      setFormConfig({
        ...formConfig,
        syncLinks: true,
        iosStoreUrl: 'https://app.appsflyer.com/id1664415775?pid=marketing&c=playable_ad',
        androidStoreUrl: 'https://app.appsflyer.com/com.matryoshka.royal.cooking.kitchen.madness?pid=marketing&c=playable_ad',
      });
    } else if (preset === 'adjust') {
      setFormConfig({
        ...formConfig,
        syncLinks: true,
        iosStoreUrl: 'https://app.adjust.com/abc1234?campaign=playable_ad',
        androidStoreUrl: 'https://app.adjust.com/abc1234?campaign=playable_ad',
      });
    } else if (preset === 'blank') {
      setFormConfig({
        gameTitle: '',
        iosStoreUrl: '',
        androidStoreUrl: '',
        syncLinks: false,
      });
    }
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
          {/* Tracking Notification Banner */}
          <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-semibold text-emerald-900">Bảo đảm an toàn tracking: </span>
              Endpoint <code className="bg-emerald-100/70 text-emerald-900 px-1 py-0.5 rounded font-mono">prod-analytics.matryoshka.com</code> đã bị gỡ bỏ hoàn toàn. Các thay đổi của bạn dưới đây sẽ được tiêm trực tiếp vào mã nguồn sạch.
            </div>
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
              placeholder="VD: Royal Cooking: Kitchen Madness"
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

          {/* Quick Presets */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80 space-y-2">
            <div className="font-semibold text-slate-700 text-[11px]">
              Gợi ý mẫu thiết lập nhanh:
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={handleResetToDefault}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
              >
                Mặc định Royal Cooking
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('appsflyer')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
              >
                Mẫu AppsFlyer OneLink
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('adjust')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
              >
                Mẫu Adjust Tracker
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('blank')}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-rose-600 rounded-lg border border-slate-200 text-[11px] font-medium transition-colors cursor-pointer"
              >
                Xoá trống link
              </button>
            </div>
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
            <span>Khôi phục mặc định</span>
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
