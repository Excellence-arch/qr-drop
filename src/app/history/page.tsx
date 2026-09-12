"use client";

import React, { useEffect, useState } from "react";
import {
  History,
  Trash2,
  Download,
  ShieldCheck,
  ArrowLeft,
  Calendar,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import Link from "next/link";
import {
  getAllTransferRecords,
  deleteTransferRecord,
  clearAllTransferRecords,
} from "@/lib/storage/indexeddb";
import { StoredTransferRecord } from "@/lib/transfer/protocol/types";
import { formatBytes } from "@/lib/utils/format";

export default function HistoryPage() {
  const [transfers, setTransfers] = useState<StoredTransferRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    setLoading(true);
    const records = await getAllTransferRecords();
    setTransfers(records);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    await deleteTransferRecord(id);
    setTransfers((prev) => prev.filter((t) => t.id !== id));
  };

  const handleClearAll = async () => {
    if (confirm("Are you sure you want to clear all local transfer history?")) {
      await clearAllTransferRecords();
      setTransfers([]);
    }
  };

  const handleDownloadSavedFile = (fileItem: { name: string; blob: Blob }) => {
    const url = URL.createObjectURL(fileItem.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileItem.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" />
              <span>Transfer History</span>
            </h1>
            <p className="text-xs text-slate-400">
              Stored locally on this device in IndexedDB • Never shared online
            </p>
          </div>
        </div>

        {transfers.length > 0 && (
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* History List */}
      {loading ? (
        <div className="py-12 text-center text-slate-500 font-mono text-xs">
          Loading transfer records...
        </div>
      ) : transfers.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <History className="w-12 h-12 text-slate-700 mx-auto" />
          <h3 className="font-semibold text-slate-300">No Transfers Yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Completed optical transfers will appear here for local download and SHA-256 verification.
          </p>
          <div className="pt-2">
            <Link
              href="/send"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              Start First Transfer
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {transfers.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-xl border ${
                      item.direction === "send"
                        ? "bg-indigo-950/60 text-indigo-400 border-indigo-800/40"
                        : "bg-cyan-950/60 text-cyan-400 border-cyan-800/40"
                    }`}
                  >
                    {item.direction === "send" ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm text-slate-200">{item.name}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400 font-mono">
                      <span className="font-bold text-indigo-300">{item.id}</span>
                      <span>•</span>
                      <span>{formatBytes(item.totalSize)}</span>
                      <span>•</span>
                      <span>{item.filesCount} {item.filesCount === 1 ? "file" : "files"}</span>
                      <span>•</span>
                      <span>{new Date(item.completedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {item.verified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      <ShieldCheck className="w-3 h-3" />
                      <span>Verified</span>
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    title="Delete record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Saved files download buttons if available */}
              {item.fileDataBlobs && item.fileDataBlobs.length > 0 && (
                <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] uppercase font-mono text-slate-500">Files:</span>
                  {item.fileDataBlobs.map((f, fIdx) => (
                    <button
                      key={fIdx}
                      onClick={() => handleDownloadSavedFile(f)}
                      className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/50 text-slate-300 hover:text-white transition-colors"
                    >
                      <Download className="w-3 h-3 text-cyan-400" />
                      <span>{f.name} ({formatBytes(f.size)})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
