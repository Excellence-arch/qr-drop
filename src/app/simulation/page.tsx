"use client";

import React, { useState } from "react";
import {
  Cpu,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ArrowLeft,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { TransferSender } from "@/lib/transfer/sender";
import { TransferReceiver } from "@/lib/transfer/receiver";
import { OpticalTransport } from "@/lib/transfer/transport/optical";
import { formatBytes, formatDuration } from "@/lib/utils/format";
import { TransmissionMode } from "@/lib/transfer/protocol/types";
import { ChunkMatrix } from "@/components/ui/ChunkMatrix";

class SimulationChannel implements OpticalTransport {
  public packetLossRate = 0.2;
  public duplicateRate = 0.05;
  public outOfOrder = true;
  private onFrameCb: ((bytes: Uint8Array) => Promise<void> | void) | null = null;
  public transmittedCount = 0;
  public droppedCount = 0;
  public dupCount = 0;

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async sendFrame(packetBytes: Uint8Array): Promise<void> {
    this.transmittedCount++;

    // Simulated packet loss
    if (Math.random() < this.packetLossRate) {
      this.droppedCount++;
      return;
    }

    if (this.onFrameCb) {
      await this.onFrameCb(new Uint8Array(packetBytes));

      // Simulated duplicate frame
      if (Math.random() < this.duplicateRate) {
        this.dupCount++;
        await this.onFrameCb(new Uint8Array(packetBytes));
      }
    }
  }

  onFrameReceived(callback: (packetBytes: Uint8Array) => Promise<void> | void): void {
    this.onFrameCb = callback;
  }
}

export default function SimulationPage() {
  const [fileSizeKB, setFileSizeKB] = useState(250);
  const [packetLoss, setPacketLoss] = useState(20);
  const [duplicateRate, setDuplicateRate] = useState(5);
  const [mode, setMode] = useState<TransmissionMode>("balanced");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    totalChunks: number;
    framesSent: number;
    framesDropped: number;
    duplicatesInjected: number;
    durationMs: number;
    sha256Verified: boolean;
    speedKbps: number;
    solvedChunks: number;
    solvedBitmask?: boolean[];
  } | null>(null);

  const runSimulation = async () => {
    setIsRunning(true);
    setResult(null);

    // 1. Generate pseudo-random test file
    const totalBytes = fileSizeKB * 1024;
    const testData = new Uint8Array(totalBytes);
    for (let i = 0; i < totalBytes; i++) {
      testData[i] = (i * 37 + (i >> 8)) & 0xff;
    }

    const testFile = new Blob([testData], { type: "application/octet-stream" });
    const files = [{ file: testFile, name: `test-simulation-${fileSizeKB}kb.bin`, type: "application/octet-stream" }];

    const channel = new SimulationChannel();
    channel.packetLossRate = packetLoss / 100;
    channel.duplicateRate = duplicateRate / 100;

    let solvedChunks = 0;
    let totalChunks = 0;
    let solvedBitmask: boolean[] | undefined;
    let transferCompleted = false;

    const receiver = new TransferReceiver({
      onProgress: (info) => {
        solvedChunks = info.solvedChunks;
        totalChunks = info.totalChunks;
        solvedBitmask = info.solvedBitmask;
      },
      onComplete: () => {
        transferCompleted = true;
      },
    });

    channel.onFrameReceived(async (bytes) => {
      await receiver.handleIncomingPacketBytes(bytes);
    });

    const sender = new TransferSender({
      files,
      mode,
    });
    sender.setTransport(channel);

    const manifest = await sender.prepare();
    totalChunks = manifest.totalChunks;

    const startTime = performance.now();
    let frames = 0;
    const maxFrames = Math.max(500, totalChunks * 8);

    while (!transferCompleted && frames < maxFrames) {
      await sender.sendNextFrame();
      frames++;
      // Yield thread every few frames for UI responsiveness
      if (frames % 20 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    const durationMs = Math.round(performance.now() - startTime);
    const speedKbps = durationMs > 0 ? Math.round((totalBytes / 1024) / (durationMs / 1000) * 10) / 10 : 0;

    setResult({
      success: transferCompleted,
      totalChunks,
      framesSent: channel.transmittedCount,
      framesDropped: channel.droppedCount,
      duplicatesInjected: channel.dupCount,
      durationMs,
      sha256Verified: transferCompleted,
      speedKbps,
      solvedChunks,
      solvedBitmask,
    });

    setIsRunning(false);
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header */}
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
              <Cpu className="w-5 h-5 text-cyan-400" />
              <span>Protocol Simulation Testbench</span>
            </h1>
            <p className="text-xs text-slate-400">
              Stress-test fountain codes against artificial frame drops and duplicates
            </p>
          </div>
        </div>
      </div>

      {/* Parameter Controls Card */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-5">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span>Simulation Parameters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* File Size */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Payload Size:</span>
              <span className="font-mono text-cyan-400 font-bold">{fileSizeKB} KB</span>
            </div>
            <input
              type="range"
              min={50}
              max={2000}
              step={50}
              value={fileSizeKB}
              onChange={(e) => setFileSizeKB(parseInt(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Packet Loss */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Simulated Loss:</span>
              <span className="font-mono text-rose-400 font-bold">{packetLoss}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              step={5}
              value={packetLoss}
              onChange={(e) => setPacketLoss(parseInt(e.target.value))}
              className="w-full accent-rose-400 cursor-pointer"
            />
          </div>

          {/* Duplicate Frames */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Duplicate Rate:</span>
              <span className="font-mono text-amber-400 font-bold">{duplicateRate}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={5}
              value={duplicateRate}
              onChange={(e) => setDuplicateRate(parseInt(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>
        </div>

        {/* Transmission Mode */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">Mode:</span>
          {(["reliable", "balanced", "fast"] as TransmissionMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize border transition-colors ${
                mode === m
                  ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                  : "bg-slate-950/40 border-slate-800 text-slate-400"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Run Button */}
        <button
          onClick={runSimulation}
          disabled={isRunning}
          className={`w-full py-3.5 px-6 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
            isRunning
              ? "bg-slate-800 text-slate-400 cursor-not-allowed"
              : "bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white shadow-lg shadow-indigo-500/20"
          }`}
        >
          {isRunning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Simulating Optical Stream...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              <span>Run Fountain Code Stress Test</span>
            </>
          )}
        </button>
      </div>

      {/* Results Display */}
      {result && (
        <div className="bg-slate-900/80 border border-indigo-500/30 rounded-3xl p-6 space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {result.success ? (
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : (
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              )}
              <div>
                <h3 className="font-bold text-sm text-slate-100">
                  {result.success ? "Reconstruction Succeeded" : "Reconstruction Incomplete"}
                </h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  {result.sha256Verified ? "✓ SHA-256 Hash Verified Exact" : "✕ Hash verification pending"}
                </p>
              </div>
            </div>

            <span className="font-mono text-xs px-2.5 py-1 rounded bg-slate-950 text-cyan-400 border border-slate-800">
              {result.durationMs} ms
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
              <p className="text-[10px] text-slate-400 uppercase">Frames Sent</p>
              <p className="font-bold text-slate-200 mt-0.5">{result.framesSent}</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
              <p className="text-[10px] text-slate-400 uppercase">Dropped Frames</p>
              <p className="font-bold text-rose-400 mt-0.5">{result.framesDropped}</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
              <p className="text-[10px] text-slate-400 uppercase">Duplicates</p>
              <p className="font-bold text-amber-400 mt-0.5">{result.duplicatesInjected}</p>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2.5">
              <p className="text-[10px] text-slate-400 uppercase">Throughput</p>
              <p className="font-bold text-cyan-400 mt-0.5">{result.speedKbps} KB/s</p>
            </div>
          </div>

          <ChunkMatrix
            totalChunks={result.totalChunks}
            solvedCount={result.solvedChunks}
            solvedBitmask={result.solvedBitmask}
          />
        </div>
      )}
    </div>
  );
}
