"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  Zap,
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  AlertTriangle,
  Camera,
  Layers,
  Sparkles,
  Radio,
  FileCode,
  CheckCircle2,
} from "lucide-react";
import QRCode from "qrcode";
import { sound } from "@/lib/utils/feedback";

const SAMPLE_SIM_FILES = [
  { name: "satellite_telemetry.bin", size: "3.4 MB", chunks: 28, type: "binary" },
  { name: "quantum_keys.enc", size: "840 KB", chunks: 14, type: "crypto" },
  { name: "cleanroom_cad_spec.pdf", size: "1.8 MB", chunks: 20, type: "doc" },
];

export function Interactive3DStage() {
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [simPacketLoss, setSimPacketLoss] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [currentSeq, setCurrentSeq] = useState(0);
  const [solvedChunks, setSolvedChunks] = useState<number[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isCompleted, setIsCompleted] = useState(false);

  const activeFile = SAMPLE_SIM_FILES[selectedFileIdx];
  const totalChunks = activeFile.chunks;

  // Generate dynamic QR frames for the 3D phone screen
  useEffect(() => {
    let active = true;
    const generateFrame = async () => {
      try {
        const payload = `QRDrop:SIM:${activeFile.name}:SEQ=${currentSeq}:DEGREE=${currentSeq < totalChunks ? 1 : 3}:${Math.random().toString(36).substring(2, 8)}`;
        const url = await QRCode.toDataURL(payload, {
          margin: 1,
          width: 180,
          color: { dark: "#000000", light: "#ffffff" },
        });
        if (active) {
          setQrDataUrl(url);
        }
      } catch (err) {}
    };
    generateFrame();
    return () => {
      active = false;
    };
  }, [currentSeq, activeFile.name, totalChunks]);

  // Simulation step loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setCurrentSeq((prev) => {
        const nextSeq = prev + 1;

        // Packet reception logic: simulate 25% drop if simPacketLoss is enabled
        const isDropped = simPacketLoss && Math.random() < 0.28;

        if (!isDropped) {
          setSolvedChunks((currentSolved) => {
            if (currentSolved.length >= totalChunks) {
              setIsCompleted(true);
              return currentSolved;
            }

            // If systematic chunk, solve directly
            if (nextSeq <= totalChunks && !currentSolved.includes(nextSeq - 1)) {
              sound.playPacketScanned();
              const updated = [...currentSolved, nextSeq - 1];
              if (updated.length >= totalChunks) {
                setIsCompleted(true);
              }
              return updated;
            }

            // Fountain parity packet solves missing chunks randomly
            if (Math.random() > 0.3) {
              const missing = Array.from({ length: totalChunks }, (_, i) => i).filter(
                (i) => !currentSolved.includes(i)
              );
              if (missing.length > 0) {
                const randomMissing = missing[Math.floor(Math.random() * missing.length)];
                sound.playPacketScanned();
                const updated = [...currentSolved, randomMissing];
                if (updated.length >= totalChunks) {
                  setIsCompleted(true);
                }
                return updated;
              }
            }

            return currentSolved;
          });
        }

        return nextSeq;
      });
    }, 180 / speedMultiplier);

    return () => clearInterval(interval);
  }, [isPlaying, simPacketLoss, speedMultiplier, totalChunks]);

  const resetSimulation = () => {
    setCurrentSeq(0);
    setSolvedChunks([]);
    setIsCompleted(false);
    setIsPlaying(true);
  };

  const handleSelectFile = (idx: number) => {
    setSelectedFileIdx(idx);
    setCurrentSeq(0);
    setSolvedChunks([]);
    setIsCompleted(false);
  };

  const percentComplete = Math.min(100, Math.round((solvedChunks.length / totalChunks) * 100));

  return (
    <div className="w-full max-w-5xl mx-auto my-4 space-y-6">
      {/* 3D Isometric Viewport Container */}
      <div className="relative w-full rounded-3xl bg-gradient-to-b from-slate-950 via-[#070d1e] to-slate-950 border border-slate-800/80 p-6 sm:p-10 overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.8)] perspective-1400 cyber-grid-bg">
        {/* Holographic Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800/60 relative z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full bg-cyan-400 animate-ping" />
            <span className="font-mono text-xs font-bold text-cyan-400 uppercase tracking-widest">
              Interactive 3D Optical Stream Stage
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
              Live Ray Simulation
            </span>
          </div>

          {/* Interactive File Pills */}
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
            {SAMPLE_SIM_FILES.map((file, idx) => (
              <button
                key={file.name}
                onClick={() => handleSelectFile(idx)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                  selectedFileIdx === idx
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {file.name}
              </button>
            ))}
          </div>
        </div>

        {/* 3D Dual Device Stage */}
        <div className="relative min-h-[360px] sm:min-h-[420px] flex flex-col md:flex-row items-center justify-between gap-8 py-8 preserve-3d">
          {/* DEVICE A: TRANSMITTER PHONE (3D Tilted Left) */}
          <div className="relative z-10 w-64 sm:w-72 bg-slate-900 border-[3px] border-slate-700/80 rounded-[38px] p-3.5 shadow-2xl device-shadow-sender transform md:rotate-y-[20deg] md:rotate-x-[8deg] hover:rotate-y-[8deg] transition-transform duration-500">
            {/* Phone Speaker & Notch */}
            <div className="w-16 h-3.5 bg-slate-950 rounded-full mx-auto mb-2.5 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800 mr-1" />
              <div className="w-6 h-1 bg-slate-800 rounded-full" />
            </div>

            {/* Transmitter Screen */}
            <div className="bg-slate-950 rounded-[26px] p-3 text-center border border-cyan-500/20 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400 px-1">
                <span>TX • 256B PACKET</span>
                <span className="font-bold">SEQ #{currentSeq}</span>
              </div>

              {/* Dynamic QR Code */}
              <div className="bg-white p-2.5 rounded-xl shadow-inner mx-auto w-fit">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Simulated QR"
                    className="w-36 h-36 sm:w-40 sm:h-40 object-contain rounded"
                    style={{ imageRendering: "pixelated" }}
                  />
                ) : (
                  <div className="w-36 h-36 bg-slate-200 animate-pulse rounded" />
                )}
              </div>

              {/* Device Screen Status */}
              <div className="text-[10px] font-mono text-slate-400 pt-0.5 flex justify-between">
                <span>{activeFile.name}</span>
                <span className="text-emerald-400 font-bold">14 FPS</span>
              </div>
            </div>

            {/* Glowing Transmitter Label */}
            <div className="mt-3 text-center">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-cyan-300 bg-cyan-950/60 px-3 py-1 rounded-full border border-cyan-500/30">
                <Radio className="w-3 h-3 text-cyan-400" />
                <span>Device A (Sender Display)</span>
              </span>
            </div>
          </div>

          {/* OPTICAL PHOTON BEAM CONNECTOR IN THE AIR */}
          <div className="hidden md:flex flex-1 flex-col items-center justify-center px-4 relative z-0">
            {/* Photon Tunnel Glow */}
            <div className="w-full h-1 bg-slate-800/80 rounded-full relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-indigo-500 to-cyan-300 animate-photon" />
            </div>

            {/* Flying Packet Tag */}
            <div className="my-3 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-cyan-500/40 text-center shadow-lg backdrop-blur-md">
              <p className="text-[10px] font-mono text-cyan-300 font-bold">
                {simPacketLoss ? "⚡ OPTICAL GLARE ACTIVE (25% DROP)" : "✨ ZERO-NETWORK PHOTON STREAM"}
              </p>
              <p className="text-[9px] font-mono text-slate-400">
                Fountain Soliton XOR Parity Packets
              </p>
            </div>

            {/* Simulated Hand Obstruction Button */}
            <button
              onClick={() => setSimPacketLoss(!simPacketLoss)}
              className={`px-3 py-1 rounded-full text-[10px] font-mono font-bold transition-all border ${
                simPacketLoss
                  ? "bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                  : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              {simPacketLoss ? "⚠️ Glare Active (Click to Remove)" : "Simulate Glare / Frame Drops"}
            </button>
          </div>

          {/* DEVICE B: RECEIVER PHONE (3D Tilted Right) */}
          <div className="relative z-10 w-64 sm:w-72 bg-slate-900 border-[3px] border-slate-700/80 rounded-[38px] p-3.5 shadow-2xl device-shadow-receiver transform md:rotate-y-[-20deg] md:rotate-x-[8deg] hover:rotate-y-[-8deg] transition-transform duration-500">
            {/* Phone Speaker & Notch */}
            <div className="w-16 h-3.5 bg-slate-950 rounded-full mx-auto mb-2.5 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-800 mr-1" />
              <div className="w-6 h-1 bg-slate-800 rounded-full" />
            </div>

            {/* Receiver Camera Viewfinder Screen */}
            <div className="bg-slate-950 rounded-[26px] p-3 text-center border border-indigo-500/30 space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between text-[10px] font-mono text-indigo-300 px-1">
                <span>RX • CAMERA FEED</span>
                <span className="font-bold text-cyan-400">{percentComplete}%</span>
              </div>

              {/* Viewfinder Target & Real-time Chunk Grid */}
              <div className="relative bg-slate-900/90 rounded-xl p-3 border border-indigo-500/40 h-36 sm:h-40 flex flex-col justify-between overflow-hidden">
                {/* Laser scan reticle */}
                <div className="absolute inset-2 border border-cyan-400/30 rounded-lg pointer-events-none flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-cyan-400/80 animate-ping" />
                </div>

                {/* Status Indicator */}
                <div className="relative z-10 text-[10px] font-mono text-left flex justify-between">
                  <span className="text-slate-300 font-bold">
                    {isCompleted ? "✓ RECONSTRUCTED" : "RECONSTRUCTING..."}
                  </span>
                  <span className="text-cyan-400 font-bold">
                    {solvedChunks.length}/{totalChunks} chunks
                  </span>
                </div>

                {/* Mini Chunk Matrix in Real-Time */}
                <div
                  className="grid gap-1 relative z-10 my-auto"
                  style={{
                    gridTemplateColumns: `repeat(auto-fill, minmax(10px, 1fr))`,
                  }}
                >
                  {Array.from({ length: totalChunks }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-3 rounded-[2px] transition-all duration-200 ${
                        solvedChunks.includes(i)
                          ? "bg-cyan-400 shadow-[0_0_6px_#00f0ff]"
                          : "bg-slate-800/80 border border-slate-700/60"
                      }`}
                    />
                  ))}
                </div>

                {/* SHA-256 Checksum Live Status */}
                <div className="relative z-10 text-[9px] font-mono text-slate-400 flex items-center justify-between">
                  <span>SHA-256:</span>
                  <span className={isCompleted ? "text-emerald-400 font-bold" : "text-slate-500"}>
                    {isCompleted ? "✓ 7F92A... MATCHED" : "VERIFYING..."}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-cyan-400 h-full transition-all duration-300"
                  style={{ width: `${percentComplete}%` }}
                />
              </div>
            </div>

            {/* Receiver Device Label */}
            <div className="mt-3 text-center">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-indigo-300 bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-500/30">
                <Camera className="w-3 h-3 text-indigo-400" />
                <span>Device B (Receiver Camera)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Simulation Control Toolbar */}
        <div className="pt-6 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-4 relative z-20">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 shadow-md shadow-indigo-500/20"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? "Pause Stream" : "Resume Stream"}</span>
            </button>

            <button
              onClick={resetSimulation}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800"
              title="Reset Simulation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span>Speed:</span>
            {[1, 2, 4].map((mult) => (
              <button
                key={mult}
                onClick={() => setSpeedMultiplier(mult)}
                className={`px-2 py-1 rounded-lg border text-[11px] ${
                  speedMultiplier === mult
                    ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold"
                    : "bg-slate-950 border-slate-800 text-slate-400"
                }`}
              >
                {mult}x
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
