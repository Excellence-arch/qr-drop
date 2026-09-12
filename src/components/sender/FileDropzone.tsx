"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Video,
  Music,
  File,
  X,
  Lock,
  KeyRound,
  Zap,
  Sliders,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { formatBytes, formatDuration, getFileExtension } from "@/lib/utils/format";
import { TransmissionMode, TRANSMISSION_PROFILES } from "@/lib/transfer/protocol/types";

export interface SelectedFileItem {
  file: File;
  id: string;
  name: string;
  size: number;
  type: string;
}

interface FileDropzoneProps {
  onStartTransfer: (
    files: SelectedFileItem[],
    options: {
      mode: TransmissionMode;
      password?: string;
      pairingCode?: string;
    }
  ) => void;
}

export function FileDropzone({ onStartTransfer }: FileDropzoneProps) {
  const [files, setFiles] = useState<SelectedFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<TransmissionMode>("balanced");
  const [protectionType, setProtectionType] = useState<"none" | "password" | "pairing">("none");
  const [password, setPassword] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const formatted: SelectedFileItem[] = newFiles.map((f) => ({
      file: f,
      id: `${f.name}_${f.size}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: f.name,
      size: f.size,
      type: f.type || "application/octet-stream",
    }));
    setFiles((prev) => [...prev, ...formatted]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const generateRandomPairingCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setPairingCode(code);
  };

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  const profile = TRANSMISSION_PROFILES[mode];
  const estimatedChunks = Math.max(1, Math.ceil(totalBytes / profile.chunkSize));
  const estimatedDurationSecs = Math.ceil((estimatedChunks * profile.redundancyMultiplier) / profile.targetFps);

  const getFileIcon = (type: string, name: string) => {
    if (type.startsWith("image/")) return ImageIcon;
    if (type.startsWith("video/")) return Video;
    if (type.startsWith("audio/")) return Music;
    if (type.includes("zip") || type.includes("tar") || type.includes("rar") || name.endsWith(".zip"))
      return FileArchive;
    if (type.includes("text") || type.includes("pdf") || name.endsWith(".txt") || name.endsWith(".pdf"))
      return FileText;
    return File;
  };

  const handleStart = () => {
    if (files.length === 0) return;
    onStartTransfer(files, {
      mode,
      password: protectionType === "password" ? password : undefined,
      pairingCode: protectionType === "pairing" ? pairingCode : undefined,
    });
  };

  return (
    <div className="space-y-6">
      {/* Drag & Drop Card */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${
          isDragging
            ? "border-cyan-400 bg-cyan-950/20 scale-[1.01] glow-cyan"
            : "border-slate-800 hover:border-indigo-500/50 bg-slate-900/40 hover:bg-slate-900/70"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
            <Upload className="w-7 h-7 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-200 text-base">
              Choose file or drag & drop here
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Supports photos, videos, documents, zip archives, and arbitrary binary files
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-slate-800/80 text-slate-300 border border-slate-700">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>100% On-Device Processing • Never Uploaded</span>
          </div>
        </div>
      </div>

      {/* Selected Files List */}
      {files.length > 0 && (
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-mono">
              Transfer Package ({files.length} {files.length === 1 ? "file" : "files"} • {formatBytes(totalBytes)})
            </h4>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFiles([]);
              }}
              className="text-xs text-rose-400 hover:text-rose-300 hover:underline"
            >
              Clear all
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {files.map((fileItem) => {
              const Icon = getFileIcon(fileItem.type, fileItem.name);
              return (
                <div
                  key={fileItem.id}
                  className="flex items-center justify-between bg-slate-950/60 border border-slate-800/80 rounded-xl p-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate max-w-[80%]">
                    <div className="p-1.5 rounded-lg bg-indigo-950/50 text-indigo-400 border border-indigo-800/40">
                      <Icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="truncate">
                      <p className="font-medium text-slate-200 truncate">{fileItem.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {formatBytes(fileItem.size)} • {getFileExtension(fileItem.name)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(fileItem.id);
                    }}
                    className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transmission Settings & Modes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Transmission Profile */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Transmission Mode</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(["reliable", "balanced", "fast"] as TransmissionMode[]).map((m) => {
              const p = TRANSMISSION_PROFILES[m];
              const isSelected = mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "bg-indigo-600/20 border-indigo-500 text-slate-100 shadow-[0_0_12px_rgba(99,102,241,0.25)]"
                      : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <p className="text-xs font-bold capitalize">{m}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.chunkSize}B • {p.targetFps}fps</p>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400">{profile.description}</p>
          {mode === "fast" && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Fast mode requires good screen brightness & high camera quality.</span>
            </div>
          )}
        </div>

        {/* Security & Password */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
            <Lock className="w-4 h-4 text-cyan-400" />
            <span>End-to-End Encryption</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setProtectionType("none")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                protectionType === "none"
                  ? "bg-indigo-600/20 border-indigo-500 text-slate-200"
                  : "bg-slate-950/40 border-slate-800 text-slate-400"
              }`}
            >
              Default
            </button>
            <button
              onClick={() => setProtectionType("password")}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                protectionType === "password"
                  ? "bg-indigo-600/20 border-indigo-500 text-slate-200"
                  : "bg-slate-950/40 border-slate-800 text-slate-400"
              }`}
            >
              Passcode
            </button>
            <button
              onClick={() => {
                setProtectionType("pairing");
                if (!pairingCode) generateRandomPairingCode();
              }}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors ${
                protectionType === "pairing"
                  ? "bg-indigo-600/20 border-indigo-500 text-slate-200"
                  : "bg-slate-950/40 border-slate-800 text-slate-400"
              }`}
            >
              Pairing Code
            </button>
          </div>

          {protectionType === "password" && (
            <div className="space-y-1">
              <input
                type="password"
                placeholder="Enter transfer password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <p className="text-[10px] text-slate-500">
                AES-256-GCM key derived with PBKDF2 (100,000 iterations).
              </p>
            </div>
          )}

          {protectionType === "pairing" && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="6-digit code"
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, ""))}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-center text-sm font-mono tracking-widest text-cyan-400 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={generateRandomPairingCode}
                  className="px-3 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
                >
                  Generate
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                The receiver will be prompted to enter this 6-digit code.
              </p>
            </div>
          )}

          {protectionType === "none" && (
            <p className="text-[11px] text-slate-400">
              Encrypted automatically with ephemeral 256-bit AES-GCM session key.
            </p>
          )}
        </div>
      </div>

      {/* Transfer Summary and Start Button */}
      {files.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-950/40 via-slate-900 to-cyan-950/40 border border-indigo-500/30 rounded-2xl p-5 space-y-4 shadow-lg">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800">
              <p className="text-[10px] uppercase font-mono text-slate-400">Total Size</p>
              <p className="text-sm font-bold font-mono text-slate-200 mt-0.5">{formatBytes(totalBytes)}</p>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800">
              <p className="text-[10px] uppercase font-mono text-slate-400">Total Chunks</p>
              <p className="text-sm font-bold font-mono text-cyan-400 mt-0.5">{estimatedChunks} frames</p>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800">
              <p className="text-[10px] uppercase font-mono text-slate-400">Target Speed</p>
              <p className="text-sm font-bold font-mono text-indigo-300 mt-0.5">
                {profile.targetFps} FPS ({(profile.targetFps * profile.chunkSize / 1024).toFixed(1)} KB/s)
              </p>
            </div>
            <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800">
              <p className="text-[10px] uppercase font-mono text-slate-400">Est. Time</p>
              <p className="text-sm font-bold font-mono text-emerald-400 mt-0.5">~{formatDuration(estimatedDurationSecs)}</p>
            </div>
          </div>

          <button
            onClick={handleStart}
            className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white shadow-lg shadow-indigo-500/25 hover:shadow-cyan-500/25 transition-all flex items-center justify-center gap-2 group"
          >
            <Zap className="w-4 h-4 text-cyan-200 group-hover:scale-110 transition-transform" />
            <span>Start Optical Transmission</span>
          </button>
        </div>
      )}
    </div>
  );
}
