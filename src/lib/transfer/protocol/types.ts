/**
 * QRDrop Optical Transfer Protocol - Core Type Definitions
 * 
 * Strict binary packet format for high-density optical camera communication.
 */

export const PROTOCOL_MAGIC = 0x5152; // 'QR' in 16-bit big-endian
export const PROTOCOL_VERSION = 1;
export const HEADER_SIZE_BYTES = 20;

export enum PacketType {
  MANIFEST = 0x01,         // Manifest metadata packet
  SYSTEMATIC_CHUNK = 0x02, // Direct 1:1 chunk
  FOUNTAIN_PARITY = 0x03,  // Rateless fountain XOR parity packet
  CONTROL_SYNC = 0x04,     // Optional sync indicator
}

export interface PacketHeader {
  magic: number;          // 2 bytes: 0x5152
  version: number;        // 1 byte: 0x01
  packetType: PacketType; // 1 byte
  transferId: number;     // 4 bytes: uint32 transfer ID
  sequence: number;       // 4 bytes: uint32 sequence/seed
  chunkIndex: number;     // 2 bytes: uint16 chunk index (for systematic) or degree (for fountain)
  totalChunks: number;    // 2 bytes: uint16 total source chunks K
  payloadLength: number;  // 2 bytes: uint16 payload length in bytes
  checksum: number;       // 2 bytes: CRC-16-CCITT or low 16-bits of CRC32 (or 4-byte CRC32)
}

export interface BinaryPacket {
  header: PacketHeader;
  payload: Uint8Array;
  rawBytes: Uint8Array;
}

export interface FileItemMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  originalHash: string; // SHA-256 in hex
}

export interface TransferManifest {
  transferId: string;           // e.g. "T-7F92A1C4"
  transferIdNum: number;        // uint32 numeric representation
  createdAt: number;
  totalFiles: number;
  totalBytes: number;
  encryptedBytes: number;
  totalChunks: number;          // K
  chunkSize: number;
  isEncrypted: boolean;
  saltHex?: string;             // PBKDF2 salt
  ivHex?: string;               // AES-GCM IV
  originalPackageHash: string;  // SHA-256 of combined payload before encryption
  encryptedPackageHash: string; // SHA-256 of payload after encryption
  files: FileItemMetadata[];
  compression: "none" | "deflate";
  protection: "none" | "password" | "pairing";
  pairingCode?: string;         // e.g. "847291"
}

export type TransmissionMode = "reliable" | "balanced" | "fast";

export interface TransmissionProfile {
  mode: TransmissionMode;
  chunkSize: number;
  qrErrorCorrection: "L" | "M" | "Q" | "H";
  targetFps: number;
  redundancyMultiplier: number;
  description: string;
}

export const TRANSMISSION_PROFILES: Record<TransmissionMode, TransmissionProfile> = {
  reliable: {
    mode: "reliable",
    chunkSize: 128,
    qrErrorCorrection: "M",
    targetFps: 8,
    redundancyMultiplier: 1.5,
    description: "Smaller payloads & higher error tolerance. Best for low light & older cameras.",
  },
  balanced: {
    mode: "balanced",
    chunkSize: 256,
    qrErrorCorrection: "M",
    targetFps: 14,
    redundancyMultiplier: 1.3,
    description: "Optimal balance between throughput and optical scanning reliability.",
  },
  fast: {
    mode: "fast",
    chunkSize: 480,
    qrErrorCorrection: "L",
    targetFps: 20,
    redundancyMultiplier: 1.2,
    description: "Maximum throughput for modern high-resolution displays and cameras.",
  },
};

export interface TransferProgress {
  transferId: string;
  status: "idle" | "preparing" | "transmitting" | "receiving" | "reconstructing" | "decrypting" | "verifying" | "completed" | "error" | "paused";
  totalChunks: number;
  receivedChunks: number;      // raw packets received
  uniqueChunks: number;        // unique linear equations collected
  solvedChunks: number;        // reconstructed original chunks
  progressPercent: number;
  speedBytesPerSec: number;
  etaSeconds: number;
  errorMessage?: string;
}

export interface StoredTransferRecord {
  id: string;
  name: string;
  filesCount: number;
  totalSize: number;
  direction: "send" | "receive";
  completedAt: number;
  verified: boolean;
  sha256: string;
  fileDataBlobs?: { name: string; type: string; size: number; blob: Blob }[];
}
