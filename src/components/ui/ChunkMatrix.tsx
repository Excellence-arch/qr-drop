"use client";

import React from "react";

interface ChunkMatrixProps {
  totalChunks: number;
  solvedCount: number;
  solvedBitmask?: boolean[];
  maxBlocksToShow?: number;
}

export function ChunkMatrix({
  totalChunks,
  solvedCount,
  solvedBitmask,
  maxBlocksToShow = 144,
}: ChunkMatrixProps) {
  if (totalChunks <= 0) {
    return null;
  }

  // If total chunks exceeds maxBlocksToShow, sample down or bucket
  const shouldSample = totalChunks > maxBlocksToShow;
  const displayCount = shouldSample ? maxBlocksToShow : totalChunks;

  const blocks = Array.from({ length: displayCount }, (_, i) => {
    let isSolved = false;
    if (shouldSample) {
      const mappedIdx = Math.floor((i / displayCount) * totalChunks);
      isSolved = solvedBitmask ? !!solvedBitmask[mappedIdx] : i < (solvedCount / totalChunks) * displayCount;
    } else {
      isSolved = solvedBitmask ? !!solvedBitmask[i] : i < solvedCount;
    }
    return isSolved;
  });

  const percent = Math.min(100, Math.round((solvedCount / totalChunks) * 100));

  return (
    <div className="w-full bg-slate-900/80 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center justify-between text-xs mb-2">
        <span className="text-slate-400 font-mono">
          Reconstruction Matrix ({solvedCount} / {totalChunks} chunks)
        </span>
        <span className="font-mono font-semibold text-cyan-400">{percent}%</span>
      </div>

      <div
        className="grid gap-1 overflow-hidden"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(8px, 1fr))`,
          maxHeight: "120px",
        }}
      >
        {blocks.map((solved, idx) => (
          <div
            key={idx}
            className={`h-2.5 rounded-[2px] transition-all duration-300 ${
              solved
                ? "bg-gradient-to-tr from-cyan-500 to-indigo-400 shadow-[0_0_6px_rgba(0,240,255,0.4)] scale-100"
                : "bg-slate-800/80 border border-slate-700/50 scale-95 opacity-50"
            }`}
            title={`Chunk ${idx + 1}: ${solved ? "Solved" : "Pending"}`}
          />
        ))}
      </div>

      {shouldSample && (
        <p className="text-[10px] text-slate-500 mt-2 text-right">
          * Displaying aggregated view of {totalChunks} chunks
        </p>
      )}
    </div>
  );
}
