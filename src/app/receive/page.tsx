"use client";

import React, { useState } from "react";
import { CameraViewfinder } from "@/components/receiver/CameraViewfinder";
import { TransferCompletedModal } from "@/components/receiver/TransferCompletedModal";
import { FileItemMetadata, TransferManifest } from "@/lib/transfer/protocol/types";
import { Camera, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function ReceivePage() {
  const [completedTransfer, setCompletedTransfer] = useState<{
    files: Array<{ metadata: FileItemMetadata; blob: Blob; verified: boolean }>;
    manifest: TransferManifest;
  } | null>(null);

  const handleTransferComplete = (
    files: Array<{ metadata: FileItemMetadata; blob: Blob; verified: boolean }>,
    manifest: TransferManifest
  ) => {
    setCompletedTransfer({ files, manifest });
  };

  const handleReset = () => {
    setCompletedTransfer(null);
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
              <Camera className="w-5 h-5 text-cyan-400" />
              <span>Optical Receiver</span>
            </h1>
            <p className="text-xs text-slate-400">
              {completedTransfer
                ? "Transfer complete and verified"
                : "Point camera at sender's screen to continuously scan packets"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Receiver View */}
      {!completedTransfer ? (
        <CameraViewfinder onTransferComplete={handleTransferComplete} />
      ) : (
        <TransferCompletedModal
          files={completedTransfer.files}
          manifest={completedTransfer.manifest}
          onReset={handleReset}
        />
      )}
    </div>
  );
}
