"use client";

import React, { useEffect, useState } from "react";
import { Wifi, WifiOff, ShieldCheck, Zap } from "lucide-react";

export function OfflineBadge() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSwReady, setIsSwReady] = useState<boolean>(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setIsSwReady(true);
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
          !isOnline
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            : isSwReady
            ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
            : "bg-slate-800 text-slate-300 border-slate-700"
        }`}
        title={!isOnline ? "Device is in complete offline mode" : "PWA cached and offline ready"}
      >
        {!isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Offline Mode (Active)</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Offline Ready ✓</span>
          </>
        )}
      </div>
      <div className="hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-900/60 px-2 py-1 rounded-md border border-slate-800">
        <Zap className="w-3 h-3 text-cyan-400" />
        <span>P2P Optical</span>
      </div>
    </div>
  );
}
