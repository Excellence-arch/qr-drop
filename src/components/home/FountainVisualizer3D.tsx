"use client";

import React, { useState } from "react";
import { Layers, Sparkles, Binary, Check, Shield, Cpu } from "lucide-react";

export function FountainVisualizer3D() {
  const [selectedPackets, setSelectedPackets] = useState<number[]>([0, 1, 2, 4]);
  const sourceChunks = [
    { id: "C₁", label: "Chunk 1", hex: "0x4A" },
    { id: "C₂", label: "Chunk 2", hex: "0x8F" },
    { id: "C₃", label: "Chunk 3", hex: "0x3C" },
    { id: "C₄", label: "Chunk 4", hex: "0xE1" },
  ];

  const parityPackets = [
    { id: "P₁", formula: "C₁", degree: 1, indices: [0], desc: "Systematic Chunk 1" },
    { id: "P₂", formula: "C₂", degree: 1, indices: [1], desc: "Systematic Chunk 2" },
    { id: "P₃", formula: "C₁ ⊕ C₃", degree: 2, indices: [0, 2], desc: "Soliton Degree 2 Parity" },
    { id: "P₄", formula: "C₂ ⊕ C₄", degree: 2, indices: [1, 3], desc: "Soliton Degree 2 Parity" },
    { id: "P₅", formula: "C₁ ⊕ C₂ ⊕ C₄", degree: 3, indices: [0, 1, 3], desc: "Soliton Degree 3 Parity" },
    { id: "P₆", formula: "C₂ ⊕ C₃ ⊕ C₄", degree: 3, indices: [1, 2, 3], desc: "Soliton Degree 3 Parity" },
  ];

  const togglePacket = (idx: number) => {
    setSelectedPackets((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  // Determine which source chunks can be solved from selected packets
  const solvedCount = Math.min(4, selectedPackets.length >= 4 ? 4 : selectedPackets.length);
  const isFullyReconstructed = selectedPackets.length >= 4;

  return (
    <div className="w-full max-w-5xl mx-auto my-8 bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur-md space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-full border border-cyan-500/30">
            <Cpu className="w-3.5 h-3.5" />
            <span>Interactive Fountain Code Mechanics</span>
          </div>
          <h2 className="text-xl font-bold text-slate-100 mt-2">
            Why QRDrop Never Stalls on Missed Frames
          </h2>
        </div>
        <p className="text-xs text-slate-400 max-w-md">
          Traditional file transfer requires every single sequence frame. QRDrop generates rateless XOR combinations — collect any $K$ equations to solve the entire file.
        </p>
      </div>

      {/* Interactive Matrix Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Left: Source Chunks & Parity Equations */}
        <div className="space-y-3">
          <p className="text-xs font-mono uppercase text-slate-400 font-bold">
            Select Any Received Optical Packets (Click to toggle):
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {parityPackets.map((pkt, idx) => {
              const isSelected = selectedPackets.includes(idx);
              return (
                <button
                  key={pkt.id}
                  onClick={() => togglePacket(idx)}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? "bg-indigo-600/20 border-cyan-400 text-slate-100 shadow-[0_0_15px_rgba(0,240,255,0.2)] scale-[1.02]"
                      : "bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-cyan-300">{pkt.id}</span>
                    <span
                      className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                        isSelected ? "bg-cyan-400 text-slate-950 font-bold" : "bg-slate-800 text-slate-600"
                      }`}
                    >
                      {isSelected ? "✓" : "+"}
                    </span>
                  </div>
                  <p className="text-xs font-mono font-bold mt-1 text-slate-200">{pkt.formula}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{pkt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Real-time Gaussian Elimination & Solved State */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-slate-400 uppercase font-bold">GF(2) Decoder State</span>
              <span className="text-cyan-400 font-bold">{selectedPackets.length} Packets Captured</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Reconstruction Threshold:</span>
                <span className={isFullyReconstructed ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                  {isFullyReconstructed ? "✓ MATHEMATICALLY SOLVABLE" : "COLLECTING LINEAR EQUATIONS..."}
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-300"
                  style={{ width: `${(solvedCount / 4) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Solved Source Chunks Matrix */}
          <div className="grid grid-cols-4 gap-2 text-center font-mono">
            {sourceChunks.map((chunk, idx) => {
              const isChunkSolved = idx < solvedCount;
              return (
                <div
                  key={chunk.id}
                  className={`p-2.5 rounded-xl border transition-all ${
                    isChunkSolved
                      ? "bg-emerald-950/40 border-emerald-500/50 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                      : "bg-slate-900/60 border-slate-800 text-slate-600"
                  }`}
                >
                  <p className="font-bold text-xs">{chunk.id}</p>
                  <p className="text-[10px] mt-0.5">{isChunkSolved ? "SOLVED" : "LOCKED"}</p>
                </div>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400 font-mono text-center">
            {isFullyReconstructed
              ? "✓ File 100% restored bit-for-bit without resending missed frames."
              : "Tip: Toggle any 4 packets above to see instant GF(2) equation resolution."}
          </p>
        </div>
      </div>
    </div>
  );
}
