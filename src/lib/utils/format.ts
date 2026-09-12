/**
 * QRDrop Data Formatting Helpers
 */

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0) return "0.0 KB/s";
  if (bytesPerSec >= 1024 * 1024) {
    return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
  }
  return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return "0s";
  if (seconds < 60) {
    return `${Math.ceil(seconds)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const remSecs = Math.ceil(seconds % 60);
  return `${mins}m ${remSecs}s`;
}

export function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop()!.toUpperCase() : "FILE";
}

export function truncateFilename(name: string, maxLen = 24): string {
  if (name.length <= maxLen) return name;
  const extIndex = name.lastIndexOf(".");
  if (extIndex > 0 && name.length - extIndex <= 6) {
    const ext = name.substring(extIndex);
    const base = name.substring(0, maxLen - ext.length - 3);
    return `${base}...${ext}`;
  }
  return `${name.substring(0, maxLen - 3)}...`;
}
