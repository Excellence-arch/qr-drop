/**
 * QRDrop Local Storage with IndexedDB
 * 
 * Stores:
 * - Local transfer history (metadata and reconstructed files for download)
 * - Active session chunks for resume capability
 * - User preferences (theme, audio, vibration, default transmission profile)
 */

import { openDB, IDBPDatabase } from "idb";
import { StoredTransferRecord, TransmissionMode } from "../transfer/protocol/types";

const DB_NAME = "qrdrop_storage_v1";
const DB_VERSION = 1;

export interface UserSettings {
  defaultMode: TransmissionMode;
  audioFeedback: boolean;
  hapticFeedback: boolean;
  theme: "dark" | "light" | "system";
  autoDownload: boolean;
  maxStoredTransfers: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  defaultMode: "balanced",
  audioFeedback: true,
  hapticFeedback: true,
  theme: "dark",
  autoDownload: false,
  maxStoredTransfers: 20,
};

let dbPromise: Promise<IDBPDatabase> | null = null;

async function getDB(): Promise<IDBPDatabase | null> {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("transfers")) {
          const transferStore = db.createObjectStore("transfers", { keyPath: "id" });
          transferStore.createIndex("by-date", "completedAt");
        }
        if (!db.objectStoreNames.contains("active_sessions")) {
          db.createObjectStore("active_sessions", { keyPath: "transferId" });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings");
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Saves a completed transfer record to IndexedDB.
 */
export async function saveTransferRecord(record: StoredTransferRecord): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    await db.put("transfers", record);
  } catch (err) {
    console.error("Failed to save transfer record:", err);
  }
}

/**
 * Retrieves all saved transfer records sorted newest to oldest.
 */
export async function getAllTransferRecords(): Promise<StoredTransferRecord[]> {
  try {
    const db = await getDB();
    if (!db) return [];
    const records = await db.getAllFromIndex("transfers", "by-date");
    return records.reverse();
  } catch (err) {
    console.error("Failed to fetch transfer records:", err);
    return [];
  }
}

/**
 * Deletes a single transfer record by ID.
 */
export async function deleteTransferRecord(id: string): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    await db.delete("transfers", id);
  } catch (err) {
    console.error("Failed to delete transfer record:", err);
  }
}

/**
 * Clears all local transfer history.
 */
export async function clearAllTransferRecords(): Promise<void> {
  try {
    const db = await getDB();
    if (!db) return;
    await db.clear("transfers");
  } catch (err) {
    console.error("Failed to clear transfer history:", err);
  }
}

/**
 * Gets user settings with default fallback.
 */
export async function getStoredSettings(): Promise<UserSettings> {
  try {
    const db = await getDB();
    if (!db) return DEFAULT_SETTINGS;
    const settings = await db.get("settings", "user_config");
    return { ...DEFAULT_SETTINGS, ...(settings || {}) };
  } catch (err) {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Updates user settings in IndexedDB.
 */
export async function saveStoredSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  try {
    const db = await getDB();
    if (!db) return DEFAULT_SETTINGS;
    const current = await getStoredSettings();
    const updated = { ...current, ...settings };
    await db.put("settings", updated, "user_config");
    return updated;
  } catch (err) {
    return DEFAULT_SETTINGS;
  }
}
