"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Camera,
  Flashlight,
  FlashlightOff,
  SwitchCamera,
  AlertCircle,
  Lock,
  KeyRound,
  CheckCircle2,
  RefreshCw,
  Zap,
} from "lucide-react";
import { TransferReceiver, ReceiverProgressInfo } from "@/lib/transfer/receiver";
import { QRReceiverTransport } from "@/lib/transfer/transport/optical";
import { ChunkMatrix } from "../ui/ChunkMatrix";
import { formatBytes, formatSpeed, formatDuration } from "@/lib/utils/format";
import { FileItemMetadata, TransferManifest } from "@/lib/transfer/protocol/types";

interface CameraViewfinderProps {
  onTransferComplete: (
    files: Array<{ metadata: FileItemMetadata; blob: Blob; verified: boolean }>,
    manifest: TransferManifest
  ) => void;
}

export function CameraViewfinder({ onTransferComplete }: CameraViewfinderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const receiverRef = useRef<TransferReceiver | null>(null);
  const transportRef = useRef<QRReceiverTransport | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [progress, setProgress] = useState<ReceiverProgressInfo | null>(null);
  const [passwordInput, setPasswordInput] = useState<string>("");
  const [pairingInput, setPairingInput] = useState<string>("");
  const [isDecryptingPrompt, setIsDecryptingPrompt] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    async function initCamera() {
      setCameraError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API (getUserMedia) is not supported in this browser.");
        }

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!active) return;
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }

        // Check flashlight capability
        const track = stream.getVideoTracks()[0];
        const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
        setHasTorch(!!capabilities.torch);

        // Initialize Transfer Receiver & Transport
        const receiver = new TransferReceiver({
          onProgress: (info) => {
            setProgress(info);
            if (info.manifest?.protection === "password" && !passwordInput) {
              setIsDecryptingPrompt(true);
            }
          },
          onComplete: (files, manifest) => {
            onTransferComplete(files, manifest);
          },
          onError: (err) => {
            console.error("Receiver error:", err);
          },
        });
        receiverRef.current = receiver;

        if (videoRef.current) {
          const transport = new QRReceiverTransport({
            video: videoRef.current,
            targetScanFps: 30,
            onFrame: (bytes) => {
              receiver.handleIncomingPacketBytes(bytes);
            },
          });
          transportRef.current = transport;
          transport.start();
        }
      } catch (err: any) {
        if (!active) return;
        setCameraError(err.message || "Failed to access camera.");
      }
    }

    initCamera();

    return () => {
      active = false;
      if (transportRef.current) {
        transportRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [facingMode]);

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextState = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn("Flashlight toggle failed:", err);
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const applyPassword = () => {
    if (receiverRef.current) {
      receiverRef.current.setPassword(passwordInput);
      setIsDecryptingPrompt(false);
    }
  };

  const applyPairingCode = () => {
    if (receiverRef.current) {
      receiverRef.current.setPairingCode(pairingInput);
      setIsDecryptingPrompt(false);
    }
  };

  const resetScanner = () => {
    if (receiverRef.current) {
      receiverRef.current.reset();
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center space-y-4">
      {/* Video Viewfinder Container */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="w-full h-full object-cover"
        />

        {/* HUD Scanning Reticle & Corner Guides */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
          <div className="relative w-56 h-56 sm:w-72 sm:h-72 border-2 border-cyan-400/40 rounded-3xl flex items-center justify-center shadow-[0_0_30px_rgba(0,240,255,0.15)]">
            {/* Top-Left Corner */}
            <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-cyan-400 rounded-tl-xl" />
            {/* Top-Right Corner */}
            <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-cyan-400 rounded-tr-xl" />
            {/* Bottom-Left Corner */}
            <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-cyan-400 rounded-bl-xl" />
            {/* Bottom-Right Corner */}
            <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-cyan-400 rounded-br-xl" />

            {/* Laser scanning line */}
            <div className="absolute left-2 right-2 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_#00f0ff] animate-scan-line" />

            {/* Center crosshair */}
            <div className="w-3 h-3 rounded-full border border-cyan-400/60" />
          </div>
        </div>

        {/* Top Controls Overlay */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-900/80 backdrop-blur-md text-cyan-400 border border-slate-700/80 font-bold">
              {progress?.transferId || "SCANNING FOR STREAM"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`p-2 rounded-xl backdrop-blur-md border transition-colors ${
                  torchOn
                    ? "bg-amber-500 text-slate-950 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                    : "bg-slate-900/80 text-slate-200 border-slate-700"
                }`}
                title="Toggle Torch"
              >
                {torchOn ? <Flashlight className="w-4 h-4" /> : <FlashlightOff className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={switchCamera}
              className="p-2 rounded-xl bg-slate-900/80 backdrop-blur-md text-slate-200 border border-slate-700 hover:bg-slate-800"
              title="Switch Camera"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
            <button
              onClick={resetScanner}
              className="p-2 rounded-xl bg-slate-900/80 backdrop-blur-md text-slate-200 border border-slate-700 hover:bg-slate-800"
              title="Reset Scan Session"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera Error Message */}
        {cameraError && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center space-y-3">
            <AlertCircle className="w-12 h-12 text-rose-400" />
            <h3 className="font-bold text-slate-100">Camera Access Error</h3>
            <p className="text-xs text-slate-400 max-w-sm">{cameraError}</p>
            <p className="text-[11px] text-slate-500">
              Ensure camera permissions are allowed in your browser settings.
            </p>
          </div>
        )}
      </div>

      {/* Real-Time Telemetry & Chunk Matrix */}
      <div className="w-full space-y-3">
        {/* Progress Bar & Status Text */}
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
              <span className="font-semibold text-slate-200 capitalize">
                {progress?.status ? progress.status.replace("_", " ") : "Waiting for optical QR stream..."}
              </span>
            </div>
            <span className="font-mono text-cyan-400 font-bold text-sm">
              {progress?.progressPercent || 0}%
            </span>
          </div>

          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full transition-all duration-300"
              style={{ width: `${progress?.progressPercent || 0}%` }}
            />
          </div>

          {/* Metrics Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono pt-1">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2">
              <p className="text-[10px] text-slate-400 uppercase">Packets Received</p>
              <p className="font-bold text-slate-200 mt-0.5">
                {progress?.receivedChunks || 0} frames
              </p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2">
              <p className="text-[10px] text-slate-400 uppercase">Chunks Solved</p>
              <p className="font-bold text-cyan-400 mt-0.5">
                {progress?.solvedChunks || 0} / {progress?.totalChunks || 0}
              </p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2">
              <p className="text-[10px] text-slate-400 uppercase">Speed</p>
              <p className="font-bold text-indigo-300 mt-0.5">
                {formatSpeed(progress?.currentSpeedBytesPerSec || 0)}
              </p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2">
              <p className="text-[10px] text-slate-400 uppercase">Est. Remaining</p>
              <p className="font-bold text-emerald-400 mt-0.5">
                {formatDuration(progress?.etaSeconds || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Chunk Matrix Grid */}
        {progress && progress.totalChunks > 0 && (
          <ChunkMatrix
            totalChunks={progress.totalChunks}
            solvedCount={progress.solvedChunks}
            solvedBitmask={progress.solvedBitmask}
          />
        )}

        {/* Password / Pairing Prompt Modal */}
        {isDecryptingPrompt && (
          <div className="bg-indigo-950/40 border border-indigo-500/40 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <Lock className="w-4 h-4 text-cyan-400" />
              <span>Transfer is Protected with Passcode</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="password"
                placeholder="Enter password to decrypt"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200"
              />
              <button
                onClick={applyPassword}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
              >
                Unlock
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
