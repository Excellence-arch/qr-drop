"use client";

import React, { useState } from "react";
import { FileDropzone, SelectedFileItem } from "@/components/sender/FileDropzone";
import { QRPlayer } from "@/components/sender/QRPlayer";
import { TransmissionMode } from "@/lib/transfer/protocol/types";
import { Send, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SendPage() {
  const [activeFiles, setActiveFiles] = useState<SelectedFileItem[]>([]);
  const [transferOptions, setTransferOptions] = useState<{
    mode: TransmissionMode;
    password?: string;
    pairingCode?: string;
  }>({
    mode: "balanced",
  });
  const [isTransmitting, setIsTransmitting] = useState(false);

  const handleStartTransfer = (
    files: SelectedFileItem[],
    options: {
      mode: TransmissionMode;
      password?: string;
      pairingCode?: string;
    }
  ) => {
    setActiveFiles(files);
    setTransferOptions(options);
    setIsTransmitting(true);
  };

  const handleCancel = () => {
    setIsTransmitting(false);
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
              <Send className="w-5 h-5 text-cyan-400" />
              <span>Optical Transmitter</span>
            </h1>
            <p className="text-xs text-slate-400">
              {isTransmitting
                ? "Broadcasting high-density fountain packets"
                : "Select files to encode and stream via QR animation"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Sender View */}
      {!isTransmitting ? (
        <FileDropzone onStartTransfer={handleStartTransfer} />
      ) : (
        <QRPlayer
          files={activeFiles}
          mode={transferOptions.mode}
          password={transferOptions.password}
          pairingCode={transferOptions.pairingCode}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
