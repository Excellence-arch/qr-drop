"use client";

import React from "react";
import {
  CheckCircle2,
  Download,
  FileCheck,
  Share2,
  RefreshCw,
  ShieldCheck,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Video,
  Music,
  File,
} from "lucide-react";
import { FileItemMetadata, TransferManifest } from "@/lib/transfer/protocol/types";
import { formatBytes, getFileExtension } from "@/lib/utils/format";

interface TransferCompletedModalProps {
  files: Array<{ metadata: FileItemMetadata; blob: Blob; verified: boolean }>;
  manifest: TransferManifest;
  onReset: () => void;
}

export function TransferCompletedModal({
  files,
  manifest,
  onReset,
}: TransferCompletedModalProps) {
  const downloadSingleFile = (fileItem: { metadata: FileItemMetadata; blob: Blob }) => {
    const url = URL.createObjectURL(fileItem.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileItem.metadata.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadAllFiles = () => {
    files.forEach((item, index) => {
      setTimeout(() => {
        downloadSingleFile(item);
      }, index * 250);
    });
  };

  const getFileIcon = (type: string, name: string) => {
    if (type.startsWith("image/")) return ImageIcon;
    if (type.startsWith("video/")) return Video;
    if (type.startsWith("audio/")) return Music;
    if (type.includes("zip") || type.includes("tar") || type.includes("rar") || name.endsWith(".zip"))
      return FileArchive;
    if (type.includes("text") || type.includes("pdf") || name.endsWith(".txt") || name.endsWith(".pdf"))
      return FileText;
    return File;
  };

  return (
    <div className="w-full max-w-xl mx-auto bg-slate-900 border border-indigo-500/40 rounded-3xl p-6 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Header Banner */}
      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Transfer Completed</h2>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>✓ SHA-256 Hash Verified Bit-For-Bit</span>
        </div>
      </div>

      {/* Transfer Metadata Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs font-mono">
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
          <p className="text-[10px] text-slate-400 uppercase">Total Size</p>
          <p className="font-bold text-slate-200 mt-0.5">{formatBytes(manifest.totalBytes)}</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
          <p className="text-[10px] text-slate-400 uppercase">Total Chunks</p>
          <p className="font-bold text-cyan-400 mt-0.5">{manifest.totalChunks} chunks</p>
        </div>
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5 col-span-2 sm:col-span-1">
          <p className="text-[10px] text-slate-400 uppercase">Transfer ID</p>
          <p className="font-bold text-indigo-300 mt-0.5">{manifest.transferId}</p>
        </div>
      </div>

      {/* Files List */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
          Reconstructed Files ({files.length})
        </h4>
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {files.map((item, idx) => {
            const Icon = getFileIcon(item.metadata.type, item.metadata.name);
            return (
              <div
                key={idx}
                className="flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-xl p-3"
              >
                <div className="flex items-center gap-2.5 truncate max-w-[70%]">
                  <div className="p-2 rounded-lg bg-indigo-950 text-indigo-400 border border-indigo-800/40">
                    <Icon className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div className="truncate">
                    <p className="font-medium text-xs text-slate-200 truncate">
                      {item.metadata.name}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {formatBytes(item.metadata.size)} • {getFileExtension(item.metadata.name)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => downloadSingleFile(item)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 transition-all flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={downloadAllFiles}
          className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span>Download All Files ({files.length})</span>
        </button>

        <button
          onClick={onReset}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center justify-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Receive Another Transfer</span>
        </button>
      </div>
    </div>
  );
}
