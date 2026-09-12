"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Square,
  Maximize2,
  Minimize2,
  Sun,
  ShieldCheck,
  Zap,
  Activity,
  KeyRound,
  Lock,
} from "lucide-react";
import { TransferSender, SenderProgressInfo } from "@/lib/transfer/sender";
import { QRSenderTransport } from "@/lib/transfer/transport/optical";
import { formatBytes, formatSpeed, formatDuration } from "@/lib/utils/format";
import { TransmissionMode, TRANSMISSION_PROFILES } from "@/lib/transfer/protocol/types";

interface QRPlayerProps {
  files: Array<{ file: File | Blob; name: string; type?: string; lastModified?: number }>;
  mode: TransmissionMode;
  password?: string;
  pairingCode?: string;
  onCancel: () => void;
}

export function QRPlayer({ files, mode, password, pairingCode, onCancel }: QRPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const senderRef = useRef<TransferSender | null>(null);
  const [progress, setProgress] = useState<SenderProgressInfo | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentFps, setCurrentFps] = useState(TRANSMISSION_PROFILES[mode].targetFps);
  const [wakeLockActive, setWakeLockActive] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const profile = TRANSMISSION_PROFILES[mode];
    const transport = new QRSenderTransport({
      canvas: canvasRef.current,
      errorCorrectionLevel: profile.qrErrorCorrection,
      darkColor: "#000000",
      lightColor: "#ffffff",
    });

    const sender = new TransferSender({
      files,
      mode,
      password,
      pairingCode,
      onProgress: (info) => {
        setProgress(info);
        setIsPaused(info.status === "paused");
      },
    });

    sender.setTransport(transport);
    senderRef.current = sender;

    // Start transmission automatically
    sender.start().then(() => {
      setWakeLockActive(true);
    });

    return () => {
      sender.cancel();
    };
  }, [files, mode, password, pairingCode]);

  const togglePause = () => {
    if (!senderRef.current) return;
    if (isPaused) {
      senderRef.current.resume();
      setIsPaused(false);
    } else {
      senderRef.current.pause();
      setIsPaused(true);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  };

  const handleFpsChange = (newFps: number) => {
    setCurrentFps(newFps);
    if (senderRef.current) {
      senderRef.current.setTargetFps(newFps);
    }
  };

  const percentComplete = progress?.totalChunks
    ? Math.min(100, Math.round((progress.sequence / progress.totalChunks) * 100))
    : 0;

  return (
    <div
      ref={containerRef}
      className={`relative w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-4 sm:p-6 transition-colors ${
        isFullscreen ? "bg-black min-h-screen z-50 fixed inset-0" : "bg-slate-900/90 border border-slate-800 rounded-3xl"
      }`}
    >
      {/* Top Header & Transfer ID */}
      <div className="w-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold">
            {progress?.transferId || "T-INITIALIZING"}
          </span>
          {pairingCode && (
            <span className="font-mono text-xs px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <KeyRound className="w-3 h-3" />
              <span>Pairing: {pairingCode}</span>
            </span>
          )}
          {password && (
            <span className="text-xs px-2 py-1 rounded-md bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Password Protected</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
            <Sun className="w-3 h-3" />
            <span>Screen Awake</span>
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Toggle Fullscreen Mode"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Optical QR Display Canvas */}
      <div className="relative p-4 sm:p-6 bg-white rounded-2xl shadow-2xl flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={360}
          height={360}
          className="w-[280px] h-[280px] sm:w-[360px] sm:h-[360px] object-contain rounded-lg"
          style={{ imageRendering: "pixelated" }}
        />

        {isPaused && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center text-slate-100 space-y-2">
            <Pause className="w-12 h-12 text-cyan-400 animate-pulse" />
            <p className="font-semibold text-sm">Transmission Paused</p>
          </div>
        )}
      </div>

      {/* Telemetry & Progress */}
      <div className="w-full mt-6 space-y-3">
        {/* Progress bar */}
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full transition-all duration-200"
            style={{ width: `${percentComplete}%` }}
          />
        </div>

        {/* Telemetry metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2">
            <p className="text-[10px] text-slate-400 uppercase">Frames Sent</p>
            <p className="font-bold text-slate-200 mt-0.5">
              {progress?.sequence || 0} / {progress?.totalChunks || 0}
            </p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2">
            <p className="text-[10px] text-slate-400 uppercase">Actual Speed</p>
            <p className="font-bold text-cyan-400 mt-0.5">
              {formatSpeed(progress?.speedBytesPerSec || 0)}
            </p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2">
            <p className="text-[10px] text-slate-400 uppercase">Rate</p>
            <p className="font-bold text-indigo-300 mt-0.5">{currentFps} FPS</p>
          </div>
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2">
            <p className="text-[10px] text-slate-400 uppercase">Time Elapsed</p>
            <p className="font-bold text-emerald-400 mt-0.5">
              {formatDuration(progress?.elapsedSeconds || 0)}
            </p>
          </div>
        </div>

        {/* Control Bar */}
        <div className="flex items-center justify-between pt-2">
          {/* FPS Slider */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-mono text-[11px]">FPS:</span>
            <input
              type="range"
              min={4}
              max={30}
              value={currentFps}
              onChange={(e) => handleFpsChange(parseInt(e.target.value))}
              className="w-24 sm:w-32 accent-indigo-500 cursor-pointer"
            />
            <span className="font-mono text-cyan-400 font-bold">{currentFps}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={togglePause}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                isPaused
                  ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white"
              }`}
            >
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span>{isPaused ? "Resume" : "Pause"}</span>
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-rose-900/50 hover:text-rose-300 text-slate-300 transition-colors flex items-center gap-1.5"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Stop</span>
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 text-center pt-2">
          Point the receiver device's camera at this screen. Redundant fountain packets broadcast continuously.
        </p>
      </div>
    </div>
  );
}
