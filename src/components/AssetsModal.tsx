import React, { useMemo, useRef, useState } from 'react';
import { X, Image as ImageIcon, Music, Layers, RotateCcw, Upload, Check, Search } from 'lucide-react';
import { PlayableProject } from '../kit/project';
import { dataUriBytes, formatBytes } from '../kit/bytes';

interface AssetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: PlayableProject;
  onChanged: (message: string) => void;
}

type Tab = 'images' | 'sounds' | 'sprites';

export default function AssetsModal({ isOpen, onClose, project, onChanged }: AssetsModalProps) {
  const [tab, setTab] = useState<Tab>('sprites');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [, force] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const pending = useRef<{ id: string; sprite: boolean } | null>(null);

  const images = project.loose.filter((a) => a.mime.startsWith('image/'));
  const sounds = project.loose.filter((a) => !a.mime.startsWith('image/'));
  const q = query.trim().toLowerCase();
  const sheets = useMemo(
    () => project.sheets.map((s) => ({ ...s, frames: s.frames.filter((f) => !q || f.label.toLowerCase().includes(q)) }))
      .filter((s) => s.frames.length),
    [project, q, busy],
  );

  if (!isOpen) return null;

  const pick = (id: string, sprite: boolean, accept: string) => {
    pending.current = { id, sprite };
    if (fileRef.current) {
      fileRef.current.accept = accept;
      fileRef.current.click();
    }
  };

  const onPicked = async (file: File | undefined) => {
    const p = pending.current;
    if (!file || !p) return;
    setBusy(p.id);
    try {
      if (p.sprite) await project.replaceFrame(p.id, file);
      else await project.replaceLoose(p.id, file);
      onChanged(`Đã thay ${p.id.split(':').pop()}`);
    } catch (e) {
      onChanged(`Không đọc được file: ${(e as Error).message}`);
    } finally {
      setBusy(null);
      force((n) => n + 1);
    }
  };

  const reset = (id: string) => {
    project.reset(id);
    force((n) => n + 1);
    onChanged(`Đã hoàn tác ${id.split(':').pop()}`);
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { id: 'sprites', label: 'Spritesheet', icon: <Layers className="w-3.5 h-3.5" />, count: project.sheets.reduce((s, x) => s + x.frames.length, 0) },
    { id: 'images', label: 'Ảnh', icon: <ImageIcon className="w-3.5 h-3.5" />, count: images.length },
    { id: 'sounds', label: 'Âm thanh', icon: <Music className="w-3.5 h-3.5" />, count: sounds.length },
  ];

  const ReplaceButtons = ({ id, replaced, sprite, accept }: { id: string; replaced: boolean; sprite: boolean; accept: string }) => (
    <div className="flex items-center gap-1">
      <button
        onClick={() => pick(id, sprite, accept)}
        disabled={busy === id}
        className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 cursor-pointer disabled:opacity-50"
      >
        <Upload className="w-3 h-3" /> Thay
      </button>
      {replaced && (
        <button
          onClick={() => reset(id)}
          className="p-1 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 cursor-pointer"
          title="Hoàn tác"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <input ref={fileRef} type="file" className="hidden" onChange={(e) => { onPicked(e.target.files?.[0]); e.target.value = ''; }} />
      <div id="assets-modal-container" className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden text-slate-800">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div>
            <h2 className="text-base font-bold text-slate-900">Thay Asset</h2>
            <p className="text-xs text-slate-500">
              Ảnh mới được tự co vừa kích thước gốc để không lệch bố cục. Spritesheet chỉ đóng gói lại khi có khung bị thay.
            </p>
          </div>
          <button id="close-assets-modal-btn" onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-[11px]">
            {tabs.map((t) => (
              <button
                key={t.id}
                id={`assets-tab-${t.id}`}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-medium cursor-pointer ${tab === t.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {t.icon} {t.label} <span className="text-slate-400">({t.count})</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500">Đã thay: <b>{project.replacedCount}</b></span>
            {tab === 'sprites' && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-white">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tìm khung…" className="text-xs outline-hidden w-32" />
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 text-xs">
          {tab === 'sprites' && sheets.map((sh) => (
            <section key={sh.key} className="mb-6">
              <h3 className="font-bold text-slate-700 mb-2">{sh.key} <span className="font-normal text-slate-400">· {sh.frames.length} khung</span></h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {sh.frames.map((f) => (
                  <div key={f.id} className={`rounded-xl border p-2 flex flex-col gap-1.5 ${f.replaced ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200'}`}>
                    <div className="h-20 rounded-lg bg-[conic-gradient(#e2e8f0_25%,#fff_0_50%,#e2e8f0_0_75%,#fff_0)] bg-[length:12px_12px] flex items-center justify-center overflow-hidden">
                      <img src={f.thumb} alt={f.label} className="max-h-full max-w-full object-contain" />
                    </div>
                    <div className="truncate font-medium text-slate-700" title={f.frameName}>{f.label}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">{f.width}×{f.height}</span>
                      <ReplaceButtons id={f.id} replaced={f.replaced} sprite accept="image/*" />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {tab === 'images' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {images.map((a) => (
                <div key={a.id} className={`rounded-xl border p-2 flex flex-col gap-1.5 ${a.replaced ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200'}`}>
                  <div className="h-28 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden">
                    <img src={a.uri} alt={a.name} className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="truncate font-medium text-slate-700" title={a.name}>{a.name}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">{a.width}×{a.height} · {formatBytes(dataUriBytes(a.uri).length)}</span>
                    <ReplaceButtons id={a.id} replaced={a.replaced} sprite={false} accept="image/*" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'sounds' && (
            <div className="space-y-2">
              {sounds.map((a) => (
                <div key={a.id} className={`rounded-xl border px-3 py-2 flex items-center gap-3 ${a.replaced ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200'}`}>
                  <Music className="w-4 h-4 text-slate-400 shrink-0" />
                  <div className="w-44 truncate font-medium text-slate-700" title={a.name}>{a.name}</div>
                  <audio controls src={a.uri} className="h-8 flex-1 min-w-0" />
                  <span className="text-[10px] text-slate-400 w-16 text-right">{formatBytes(dataUriBytes(a.uri).length)}</span>
                  <ReplaceButtons id={a.id} replaced={a.replaced} sprite={false} accept="audio/*" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={() => { project.resetAll(); force((n) => n + 1); onChanged('Đã hoàn tác toàn bộ asset'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl cursor-pointer font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Hoàn tác tất cả
          </button>
          <button id="done-assets-modal-btn" onClick={onClose} className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold cursor-pointer">
            <Check className="w-3.5 h-3.5" /> Áp dụng & xem trước
          </button>
        </div>
      </div>
    </div>
  );
}
