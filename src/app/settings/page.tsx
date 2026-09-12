"use client";

import React, { useEffect, useState } from "react";
import {
  Settings,
  Volume2,
  VolumeX,
  Vibrate,
  Sliders,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  Shield,
} from "lucide-react";
import Link from "next/link";
import {
  getStoredSettings,
  saveStoredSettings,
  UserSettings,
  clearAllTransferRecords,
} from "@/lib/storage/indexeddb";
import { TransmissionMode } from "@/lib/transfer/protocol/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    getStoredSettings().then((s) => setSettings(s));
  }, []);

  const updateSetting = async <K extends keyof UserSettings>(key: K, val: UserSettings[K]) => {
    if (!settings) return;
    const updated = { ...settings, [key]: val };
    setSettings(updated);
    await saveStoredSettings(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleClearData = async () => {
    if (confirm("Clear all transfer records and cache from IndexedDB?")) {
      await clearAllTransferRecords();
      alert("Local data cleared.");
    }
  };

  if (!settings) {
    return <div className="py-12 text-center text-xs text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
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
              <Settings className="w-5 h-5 text-cyan-400" />
              <span>Preferences</span>
            </h1>
            <p className="text-xs text-slate-400">Configure default optical streaming parameters</p>
          </div>
        </div>

        {savedNotice && (
          <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Saved</span>
          </span>
        )}
      </div>

      {/* Preferences List */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-6">
        {/* Default Profile */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Default Transmission Mode</span>
          </label>
          <div className="grid grid-cols-3 gap-2 pt-1">
            {(["reliable", "balanced", "fast"] as TransmissionMode[]).map((m) => (
              <button
                key={m}
                onClick={() => updateSetting("defaultMode", m)}
                className={`py-2 px-3 rounded-xl text-xs font-medium capitalize border transition-all ${
                  settings.defaultMode === m
                    ? "bg-indigo-600/20 border-indigo-500 text-slate-100 shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                    : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            Balanced is recommended for most smartphones and ambient lighting conditions.
          </p>
        </div>

        {/* Audio Feedback */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Volume2 className="w-4 h-4 text-cyan-400" />
              <span>Audio Scan Feedback</span>
            </div>
            <p className="text-xs text-slate-400">
              Play synthetic Web Audio blips when camera captures packets
            </p>
          </div>
          <button
            onClick={() => updateSetting("audioFeedback", !settings.audioFeedback)}
            className={`w-12 h-6 rounded-full transition-colors relative p-1 ${
              settings.audioFeedback ? "bg-indigo-600" : "bg-slate-800"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                settings.audioFeedback ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Haptic Vibration */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
              <Vibrate className="w-4 h-4 text-cyan-400" />
              <span>Haptic Vibration</span>
            </div>
            <p className="text-xs text-slate-400">
              Vibrate on successful packet capture and transfer verification
            </p>
          </div>
          <button
            onClick={() => updateSetting("hapticFeedback", !settings.hapticFeedback)}
            className={`w-12 h-6 rounded-full transition-colors relative p-1 ${
              settings.hapticFeedback ? "bg-indigo-600" : "bg-slate-800"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                settings.hapticFeedback ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Storage Reset */}
        <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-rose-300">Local Data Storage</h4>
            <p className="text-[11px] text-slate-500">Purge local IndexedDB records</p>
          </div>
          <button
            onClick={handleClearData}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 transition-colors flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Purge IndexedDB</span>
          </button>
        </div>
      </div>
    </div>
  );
}
