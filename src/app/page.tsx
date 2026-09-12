"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Send,
  Camera,
  WifiOff,
  Shield,
  Zap,
  Lock,
  Cpu,
  Layers,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  EyeOff,
  Radio,
  Sliders,
  Flame,
  Activity,
  Smartphone,
  Gauge,
} from "lucide-react";
import { Interactive3DStage } from "@/components/home/Interactive3DStage";
import { FountainVisualizer3D } from "@/components/home/FountainVisualizer3D";
import { computeSHA256, encryptData, decryptData } from "@/lib/transfer/crypto/webcrypto";

export default function HomePage() {
  const [benchSpeed, setBenchSpeed] = useState<string | null>(null);
  const [isBenchmarking, setIsBenchmarking] = useState(false);

  const runQuickCryptoBench = async () => {
    setIsBenchmarking(true);
    const testBuf = new Uint8Array(1024 * 1024); // 1 MB
    for (let i = 0; i < testBuf.length; i++) testBuf[i] = i & 0xff;

    const start = performance.now();
    for (let i = 0; i < 4; i++) {
      const enc = await encryptData(testBuf, { password: "QuickBenchPass" });
      await decryptData(enc.ciphertext, enc.ivHex, { password: "QuickBenchPass", saltHex: enc.saltHex });
    }
    const elapsed = (performance.now() - start) / 1000;
    const mbPerSec = Math.round((4 / elapsed) * 10) / 10;
    setBenchSpeed(`${mbPerSec} MB/s`);
    setIsBenchmarking(false);
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-16 py-4 sm:py-8">
      {/* Hero Header */}
      <div className="text-center space-y-5 max-w-4xl">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-bold bg-indigo-500/10 text-cyan-300 border border-indigo-500/30 glow-indigo shadow-[0_0_20px_rgba(99,102,241,0.2)]">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>ZERO-NETWORK OPTICAL TRANSPORT PROTOCOL</span>
        </div>

        <h1 className="text-4xl sm:text-7xl font-black tracking-tight text-slate-100 leading-[1.08]">
          Air-Gapped Optical <br className="hidden sm:inline" />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-indigo-300 to-cyan-300">
            P2P File Transfer.
          </span>
        </h1>

        <p className="text-base sm:text-xl text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
          Broadcast encrypted files across physical space through high-speed fountain-coded QR streams.
          <span className="text-slate-200 font-medium"> Sender Screen → Receiver Camera.</span>
        </p>

        {/* Primary 3D Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/send"
            className="w-full sm:w-auto px-9 py-4 rounded-2xl font-bold text-base bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white shadow-2xl shadow-indigo-500/30 hover:shadow-cyan-500/30 transition-all flex items-center justify-center gap-3 group scale-100 hover:scale-105 duration-200"
          >
            <Send className="w-5 h-5 text-cyan-200 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
            <span>Send File (Transmitter)</span>
          </Link>

          <Link
            href="/receive"
            className="w-full sm:w-auto px-9 py-4 rounded-2xl font-bold text-base bg-slate-900/90 hover:bg-slate-800 text-slate-100 border border-slate-700/80 shadow-xl transition-all flex items-center justify-center gap-3 group scale-100 hover:scale-105 duration-200"
          >
            <Camera className="w-5 h-5 text-cyan-400 group-hover:scale-125 transition-transform" />
            <span>Receive File (Camera)</span>
          </Link>
        </div>

        {/* Zero-Network Feature Pill Grid */}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs font-mono text-slate-400">
          <span className="px-3 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 font-semibold">
            ✓ 100% Airplane Mode Ready
          </span>
          <span className="px-3 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 font-semibold">
            ✓ No Wi-Fi or Bluetooth
          </span>
          <span className="px-3 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 font-semibold">
            ✓ AES-256-GCM On-Device
          </span>
          <span className="px-3 py-1 rounded-lg bg-slate-950/70 border border-slate-800 text-slate-300 font-semibold">
            ✓ Rateless Fountain Parity
          </span>
        </div>
      </div>

      {/* 3D Dual Device Interactive Simulator */}
      <Interactive3DStage />

      {/* Interactive Fountain Code Mechanics */}
      <FountainVisualizer3D />

      {/* Comparison Table: QRDrop vs Legacy Protocols */}
      <div className="w-full max-w-5xl bg-slate-900/50 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base text-slate-100 flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>Transport Protocol Comparison</span>
          </h3>
          <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-500/30">
            Physical Isolation Analysis
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-3 px-3">Vector</th>
                <th className="py-3 px-3 text-cyan-400 font-bold">QRDrop Optical</th>
                <th className="py-3 px-3 text-slate-400">AirDrop / Bluetooth</th>
                <th className="py-3 px-3 text-slate-400">WebRTC / Cloud P2P</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td className="py-3 px-3 font-semibold text-slate-200">RF Emission Leakage</td>
                <td className="py-3 px-3 text-emerald-400 font-bold">Zero (Visible Light Only)</td>
                <td className="py-3 px-3 text-rose-400">High (2.4 GHz RF Beacon)</td>
                <td className="py-3 px-3 text-rose-400">High (Cellular / Wi-Fi)</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-slate-200">Signaling Server Required</td>
                <td className="py-3 px-3 text-emerald-400 font-bold">None (100% Air-Gapped)</td>
                <td className="py-3 px-3 text-amber-400">Proprietary Handshake</td>
                <td className="py-3 px-3 text-rose-400">STUN/TURN Signaling Required</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-slate-200">Frame Loss Tolerance</td>
                <td className="py-3 px-3 text-cyan-300 font-bold">Rateless Soliton Parity</td>
                <td className="py-3 px-3 text-slate-400">TCP/ACK Retransmit</td>
                <td className="py-3 px-3 text-slate-400">SCTP Retransmit</td>
              </tr>
              <tr>
                <td className="py-3 px-3 font-semibold text-slate-200">Software Installation</td>
                <td className="py-3 px-3 text-emerald-400 font-bold">Zero (Runs in Browser / PWA)</td>
                <td className="py-3 px-3 text-amber-400">OS-Locked (Apple Only)</td>
                <td className="py-3 px-3 text-slate-400">Browser / App</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Live On-Device Web Crypto Benchmark Widget */}
      <div className="w-full max-w-5xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-cyan-950/40 border border-indigo-500/40 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1 text-center sm:text-left">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-300">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>ON-DEVICE CRYPTO ACCELERATION TEST</span>
          </div>
          <h3 className="text-lg font-bold text-slate-100">
            Benchmark AES-256-GCM Speed on This Device
          </h3>
          <p className="text-xs text-slate-400 max-w-lg">
            QRDrop utilizes hardware AES-NI instructions in your CPU via Web Crypto SubtleCrypto.
          </p>
        </div>

        <div className="flex items-center gap-4">
          {benchSpeed && (
            <div className="text-right font-mono">
              <p className="text-[10px] text-slate-400 uppercase">Hardware AES Throughput</p>
              <p className="text-xl font-bold text-cyan-400">{benchSpeed}</p>
            </div>
          )}

          <button
            onClick={runQuickCryptoBench}
            disabled={isBenchmarking}
            className="px-5 py-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-2"
          >
            <Gauge className={`w-4 h-4 ${isBenchmarking ? "animate-spin" : ""}`} />
            <span>{isBenchmarking ? "Testing..." : "Test Local Crypto Speed"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
