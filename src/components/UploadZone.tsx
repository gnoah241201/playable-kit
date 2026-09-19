import React, { useRef, useState } from 'react';
import { UploadCloud, FileCode, Loader2 } from 'lucide-react';

interface UploadZoneProps {
  onFile: (file: File) => void;
  loading: boolean;
  error: string | null;
  compact?: boolean;
}

export default function UploadZone({ onFile, loading, error, compact }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
  };

  const input = (
    <input
      ref={inputRef}
      id="playable-file-input"
      type="file"
      accept=".html,.htm,.zip,text/html,application/zip"
      className="hidden"
      onChange={(e) => {
        handleFiles(e.target.files);
        e.target.value = '';
      }}
    />
  );

  if (compact) {
    return (
      <>
        {input}
        <button
          id="open-other-file-btn"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer"
          title="Mở playable khác"
        >
          <UploadCloud className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Mở file khác</span>
        </button>
      </>
    );
  }

  return (
    <div
      id="upload-zone"
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      onClick={() => !loading && inputRef.current?.click()}
      className={`w-full max-w-xl rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors bg-white ${
        dragging ? 'border-amber-500 bg-amber-50' : 'border-slate-300 hover:border-amber-400'
      }`}
    >
      {input}
      <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center mb-4 shadow-xs">
        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <FileCode className="w-6 h-6" />}
      </div>
      <h2 className="text-base font-bold text-slate-900">
        {loading ? 'Đang phân tích playable…' : 'Kéo thả playable vào đây'}
      </h2>
      <p className="text-xs text-slate-500 mt-1.5">
        File <code className="bg-slate-100 px-1 rounded">.html</code> (AppLovin / MRAID, Luna) hoặc{' '}
        <code className="bg-slate-100 px-1 rounded">.zip</code> (Mintegral). Mọi xử lý chạy ngay trên trình duyệt, không upload đi đâu.
      </p>
      <p className="text-[11px] text-slate-400 mt-3">
        Chỉ dùng với playable bạn sở hữu hoặc được cấp quyền chỉnh sửa.
      </p>
      {error && (
        <p className="mt-4 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  );
}
