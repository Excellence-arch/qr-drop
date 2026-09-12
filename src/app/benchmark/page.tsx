"use client";

import React, { useState } from "react";
import {
  Activity,
  Play,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Zap,
  Lock,
  QrCode,
  Layers,
} from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import jsQR from "jsqr";
import { encryptData, decryptData, computeSHA256 } from "@/lib/transfer/crypto/webcrypto";
import { FountainEncoder, FountainDecoder } from "@/lib/transfer/erasure/fountain";
import { formatBytes, formatSpeed } from "@/lib/utils/format";

interface BenchmarkResult {
  name: string;
  category: "crypto" | "qr" | "erasure";
  metric: string;
  value: string;
  details: string;
  status: "pending" | "running" | "done";
}

export default function BenchmarkPage() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([
    {
      name: "SHA-256 File Hashing",
      category: "crypto",
      metric: "MB/s",
      value: "—",
      details: "Tests Web Crypto subtle digest performance on 2 MB buffer",
      status: "pending",
    },
    {
      name: "AES-256-GCM Encryption",
      category: "crypto",
      metric: "MB/s",
      value: "—",
      details: "Hardware AES-GCM encryption speed",
      status: "pending",
    },
    {
      name: "Fountain Soliton XOR Solver",
      category: "erasure",
      metric: "ops/sec",
      value: "—",
      details: "Luby Transform parity chunk encoding & belief propagation",
      status: "pending",
    },
    {
      name: "QR Matrix Generation",
      category: "qr",
      metric: "FPS",
      value: "—",
      details: "Canvas 2D render rate for 256B binary packets",
      status: "pending",
    },
    {
      name: "QR Optical Scan Engine (jsQR)",
      category: "qr",
      metric: "decodes/sec",
      value: "—",
      details: "Software optical recognition latency",
      status: "pending",
    },
  ]);

  const runAllBenchmarks = async () => {
    setIsRunning(true);
    const updated = [...results];

    // 1. SHA-256 Benchmark
    updated[0].status = "running";
    setResults([...updated]);
    await new Promise((r) => setTimeout(r, 50));

    const testBuf = new Uint8Array(2 * 1024 * 1024); // 2 MB
    for (let i = 0; i < testBuf.length; i++) testBuf[i] = i & 0xff;

    const hashStart = performance.now();
    for (let i = 0; i < 5; i++) {
      await computeSHA256(testBuf);
    }
    const hashTime = (performance.now() - hashStart) / 1000;
    const hashMBs = Math.round(((10 / hashTime) * 10)) / 10;
    updated[0].value = `${hashMBs} MB/s`;
    updated[0].status = "done";
    setResults([...updated]);

    // 2. AES-256-GCM Benchmark
    updated[1].status = "running";
    setResults([...updated]);
    await new Promise((r) => setTimeout(r, 50));

    const encStart = performance.now();
    for (let i = 0; i < 5; i++) {
      const enc = await encryptData(testBuf, { password: "BenchmarkPassword" });
      await decryptData(enc.ciphertext, enc.ivHex, { password: "BenchmarkPassword", saltHex: enc.saltHex });
    }
    const encTime = (performance.now() - encStart) / 1000;
    const encMBs = Math.round(((10 / encTime) * 10)) / 10;
    updated[1].value = `${encMBs} MB/s`;
    updated[1].status = "done";
    setResults([...updated]);

    // 3. Fountain Solver Benchmark
    updated[2].status = "running";
    setResults([...updated]);
    await new Promise((r) => setTimeout(r, 50));

    const K = 100;
    const chunkSize = 256;
    const chunks = Array.from({ length: K }, (_, i) => {
      const c = new Uint8Array(chunkSize);
      c.fill(i + 1);
      return c;
    });

    const fStart = performance.now();
    const encoder = new FountainEncoder(chunks);
    const decoder = new FountainDecoder(K, chunkSize);
    for (let seq = 0; seq < 300; seq++) {
      const p = encoder.generatePacket(seq);
      decoder.addPacket(seq, p.payload);
    }
    const fTime = (performance.now() - fStart) / 1000;
    const fOps = Math.round(300 / fTime);
    updated[2].value = `${fOps} pkts/s`;
    updated[2].status = "done";
    setResults([...updated]);

    // 4. QR Generation Benchmark
    updated[3].status = "running";
    setResults([...updated]);
    await new Promise((r) => setTimeout(r, 50));

    const offCanvas = document.createElement("canvas");
    offCanvas.width = 300;
    offCanvas.height = 300;
    const qrStart = performance.now();
    const payload = new Uint8Array(256);
    payload.fill(42);

    for (let i = 0; i < 30; i++) {
      await QRCode.toCanvas(offCanvas, [{ data: payload, mode: "byte" }] as any, {
        errorCorrectionLevel: "M",
        margin: 2,
      });
    }
    const qrTime = (performance.now() - qrStart) / 1000;
    const qrFps = Math.round(30 / qrTime);
    updated[3].value = `${qrFps} FPS`;
    updated[3].status = "done";
    setResults([...updated]);

    // 5. QR Optical Decode Benchmark
    updated[4].status = "running";
    setResults([...updated]);
    await new Promise((r) => setTimeout(r, 50));

    const ctx = offCanvas.getContext("2d")!;
    const imgData = ctx.getImageData(0, 0, 300, 300);
    const decStart = performance.now();
    for (let i = 0; i < 30; i++) {
      jsQR(imgData.data, 300, 300);
    }
    const decTime = (performance.now() - decStart) / 1000;
    const decRate = Math.round(30 / decTime);
    updated[4].value = `${decRate} scans/s`;
    updated[4].status = "done";
    setResults([...updated]);

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
              <Activity className="w-5 h-5 text-cyan-400" />
              <span>Performance Benchmarks</span>
            </h1>
            <p className="text-xs text-slate-400">
              Measure raw Web Crypto, QR rendering, and fountain solver throughput on this device
            </p>
          </div>
        </div>

        <button
          onClick={runAllBenchmarks}
          disabled={isRunning}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            isRunning
              ? "bg-slate-800 text-slate-400 cursor-not-allowed"
              : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
          }`}
        >
          {isRunning ? <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" /> : <Play className="w-4 h-4" />}
          <span>{isRunning ? "Benchmarking..." : "Run Benchmark Suite"}</span>
        </button>
      </div>

      {/* Benchmark Results Cards */}
      <div className="grid grid-cols-1 gap-3">
        {results.map((item, idx) => (
          <div
            key={idx}
            className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 flex items-center justify-between hover:border-slate-700 transition-colors"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {item.category === "crypto" && <Lock className="w-4 h-4 text-indigo-400" />}
                {item.category === "qr" && <QrCode className="w-4 h-4 text-cyan-400" />}
                {item.category === "erasure" && <Layers className="w-4 h-4 text-emerald-400" />}
                <h4 className="font-semibold text-sm text-slate-200">{item.name}</h4>
              </div>
              <p className="text-xs text-slate-400">{item.details}</p>
            </div>

            <div className="text-right">
              {item.status === "running" ? (
                <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-mono">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Measuring...</span>
                </div>
              ) : item.status === "done" ? (
                <div className="font-mono font-bold text-base text-cyan-400">
                  {item.value}
                </div>
              ) : (
                <span className="font-mono text-xs text-slate-600">Pending</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
