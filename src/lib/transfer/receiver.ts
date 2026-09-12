/**
 * QRDrop Receiver Orchestration Engine
 * 
 * Manages the complete receiver pipeline:
 * Camera Scanner -> Packet Decode -> CRC32 -> Fountain Decoder -> Reconstruction -> Hash Check -> AES-GCM Decrypt -> File Unpack
 */

import {
  TransferManifest,
  PacketType,
  FileItemMetadata,
} from "./protocol/types";
import {
  decodePacket,
  validatePacket,
  formatTransferId,
} from "./protocol/binary";
import { FountainDecoder } from "./erasure/fountain";
import { decryptData, computeSHA256 } from "./crypto/webcrypto";
import { unpackFiles } from "./chunking/packer";
import { sound, triggerHaptic } from "../utils/feedback";
import { saveTransferRecord } from "../storage/indexeddb";

export interface ReceiverProgressInfo {
  transferId?: string;
  status:
    | "idle"
    | "scanning"
    | "manifest_received"
    | "receiving_chunks"
    | "reconstructing"
    | "decrypting"
    | "verifying"
    | "completed"
    | "error";
  totalChunks: number;
  receivedChunks: number;
  solvedChunks: number;
  progressPercent: number;
  currentSpeedBytesPerSec: number;
  elapsedSeconds: number;
  etaSeconds: number;
  manifest?: TransferManifest;
  solvedBitmask?: boolean[];
  errorMessage?: string;
  unpackedFiles?: Array<{ metadata: FileItemMetadata; blob: Blob; verified: boolean }>;
}

export interface ReceiverConfig {
  password?: string;
  pairingCode?: string;
  onProgress?: (info: ReceiverProgressInfo) => void;
  onComplete?: (files: Array<{ metadata: FileItemMetadata; blob: Blob; verified: boolean }>, manifest: TransferManifest) => void;
  onError?: (err: Error) => void;
}

export class TransferReceiver {
  private config: ReceiverConfig;
  private currentTransferId: number | null = null;
  private manifest: TransferManifest | null = null;
  private decoder: FountainDecoder | null = null;
  private status: ReceiverProgressInfo["status"] = "idle";
  private rawPacketsCount = 0;
  private validPacketsCount = 0;
  private startTime = 0;
  private lastPacketTimestamp = 0;
  private isProcessingCompletion = false;
  private errorMessage = "";
  private unpackedFiles: Array<{ metadata: FileItemMetadata; blob: Blob; verified: boolean }> = [];

  constructor(config: ReceiverConfig) {
    this.config = config;
  }

  public setPassword(password: string): void {
    this.config.password = password;
  }

  public setPairingCode(code: string): void {
    this.config.pairingCode = code;
  }

  public reset(): void {
    this.currentTransferId = null;
    this.manifest = null;
    this.decoder = null;
    this.status = "scanning";
    this.rawPacketsCount = 0;
    this.validPacketsCount = 0;
    this.startTime = 0;
    this.lastPacketTimestamp = 0;
    this.isProcessingCompletion = false;
    this.errorMessage = "";
    this.unpackedFiles = [];
    this.notifyProgress();
  }

  /**
   * Processes a raw packet byte buffer received from the optical camera scanner.
   */
  public async handleIncomingPacketBytes(rawBytes: Uint8Array): Promise<void> {
    if (this.status === "completed" || this.isProcessingCompletion) {
      return;
    }

    this.rawPacketsCount++;
    const packet = decodePacket(rawBytes);
    if (!packet || !validatePacket(packet)) {
      return; // Corrupted packet or invalid header, silently drop
    }

    if (this.startTime === 0) {
      this.startTime = performance.now();
    }
    this.lastPacketTimestamp = performance.now();

    const { header, payload } = packet;

    // Handle Transfer Manifest packet
    if (header.packetType === PacketType.MANIFEST) {
      try {
        const dec = new TextDecoder();
        const manifestJson = dec.decode(payload);
        const manifest: TransferManifest = JSON.parse(manifestJson);

        const isNewManifest = !this.manifest || this.currentTransferId !== header.transferId;
        this.manifest = manifest;
        this.currentTransferId = header.transferId;

        if (!this.decoder) {
          this.decoder = new FountainDecoder(manifest.totalChunks, manifest.chunkSize);
        }

        if (isNewManifest) {
          this.status = "manifest_received";
          sound.playPacketScanned();
          triggerHaptic("light");
          this.notifyProgress();
        }

        // If decoder already solved all chunks, we can reconstruct immediately now that manifest is here
        if (this.decoder.isComplete() && !this.isProcessingCompletion) {
          await this.completeReconstruction();
        }
      } catch (err) {
        console.warn("Failed to parse manifest packet:", err);
      }
      return;
    }

    // Handle Data Chunk (Systematic or Fountain)
    if (header.packetType === PacketType.SYSTEMATIC_CHUNK || header.packetType === PacketType.FOUNTAIN_PARITY) {
      // If we haven't received the manifest yet, we can initialize decoder from header info
      if (!this.decoder) {
        this.currentTransferId = header.transferId;
        this.decoder = new FountainDecoder(header.totalChunks, payload.length);
        this.status = "receiving_chunks";
      }

      if (this.currentTransferId !== header.transferId) {
        return; // Packet from a different transfer
      }

      const contributed = this.decoder.addPacket(header.sequence, payload);
      if (contributed) {
        this.validPacketsCount++;
        this.status = "receiving_chunks";
        sound.playPacketScanned();
        triggerHaptic("light");
        this.notifyProgress();

        // Check if reconstruction is now complete
        if (this.decoder.isComplete() && !this.isProcessingCompletion) {
          if (this.manifest) {
            await this.completeReconstruction();
          } else {
            // Waiting for next manifest frame to decrypt
            this.status = "reconstructing";
            this.notifyProgress();
          }
        }
      }
    }
  }

  /**
   * Finalizes the transfer once all K fountain chunks are resolved.
   */
  private async completeReconstruction(): Promise<void> {
    if (this.isProcessingCompletion) return;
    this.isProcessingCompletion = true;
    this.status = "reconstructing";
    this.notifyProgress();

    try {
      if (!this.decoder) {
        throw new Error("No active decoder available.");
      }

      // 1. Reconstruct encrypted payload
      const expectedEncryptedBytes = this.manifest ? this.manifest.encryptedBytes : undefined;
      const reconstructedEncrypted = this.decoder.reconstructData(expectedEncryptedBytes);

      // 2. Verify encrypted package SHA-256 if manifest present
      if (this.manifest?.encryptedPackageHash) {
        this.status = "verifying";
        this.notifyProgress();
        const computedEncryptedHash = await computeSHA256(reconstructedEncrypted);
        if (computedEncryptedHash.toLowerCase() !== this.manifest.encryptedPackageHash.toLowerCase()) {
          throw new Error("Encrypted package SHA-256 verification failed.");
        }
      }

      // 3. Decrypt payload
      this.status = "decrypting";
      this.notifyProgress();

      let decryptedPayload: Uint8Array;
      if (this.manifest?.isEncrypted) {
        decryptedPayload = await decryptData(reconstructedEncrypted, this.manifest.ivHex || "", {
          password: this.config.password,
          pairingCode: this.config.pairingCode,
          saltHex: this.manifest.saltHex,
        });
      } else {
        decryptedPayload = reconstructedEncrypted;
      }

      // 4. Verify original package SHA-256
      if (this.manifest?.originalPackageHash) {
        const computedOriginalHash = await computeSHA256(decryptedPayload);
        if (computedOriginalHash.toLowerCase() !== this.manifest.originalPackageHash.toLowerCase()) {
          throw new Error("Original package SHA-256 verification failed.");
        }
      }

      // 5. Unpack individual files
      this.status = "verifying";
      this.notifyProgress();
      const files = await unpackFiles(decryptedPayload);
      this.unpackedFiles = files;

      // 6. Complete and save record
      this.status = "completed";
      sound.playTransferSuccess();
      triggerHaptic("success");

      // Save to IndexedDB
      if (this.manifest) {
        const transferRecord = {
          id: this.manifest.transferId,
          name: files.map((f) => f.metadata.name).join(", "),
          filesCount: files.length,
          totalSize: this.manifest.totalBytes,
          direction: "receive" as const,
          completedAt: Date.now(),
          verified: files.every((f) => f.verified),
          sha256: this.manifest.originalPackageHash,
          fileDataBlobs: files.map((f) => ({
            name: f.metadata.name,
            type: f.metadata.type,
            size: f.metadata.size,
            blob: f.blob,
          })),
        };
        await saveTransferRecord(transferRecord);
      }

      this.notifyProgress();

      if (this.config.onComplete && this.manifest) {
        this.config.onComplete(files, this.manifest);
      }
    } catch (err: any) {
      this.status = "error";
      this.errorMessage = err.message || "Transfer completion error.";
      sound.playTransferError();
      triggerHaptic("warning");
      this.notifyProgress();
      if (this.config.onError) {
        this.config.onError(err);
      }
    } finally {
      this.isProcessingCompletion = false;
    }
  }

  private notifyProgress(): void {
    if (!this.config.onProgress) return;

    const totalChunks = this.decoder ? this.decoder.getTotalChunks() : this.manifest?.totalChunks || 0;
    const solvedChunks = this.decoder ? this.decoder.getSolvedCount() : 0;
    const progressPercent = totalChunks > 0 ? Math.round((solvedChunks / totalChunks) * 100) : 0;

    const elapsed = this.startTime > 0 ? (performance.now() - this.startTime) / 1000 : 0;
    const chunkSize = this.manifest?.chunkSize || 256;
    const currentSpeedBytesPerSec =
      elapsed > 0 ? Math.round((this.validPacketsCount * chunkSize) / elapsed) : 0;

    const remainingChunks = Math.max(0, totalChunks - solvedChunks);
    const packetsPerSec = elapsed > 0 ? this.validPacketsCount / elapsed : 0;
    const etaSeconds = packetsPerSec > 0 ? Math.ceil(remainingChunks / packetsPerSec) : 0;

    this.config.onProgress({
      transferId: this.manifest?.transferId || (this.currentTransferId ? formatTransferId(this.currentTransferId) : undefined),
      status: this.status,
      totalChunks,
      receivedChunks: this.validPacketsCount,
      solvedChunks,
      progressPercent,
      currentSpeedBytesPerSec,
      elapsedSeconds: Math.round(elapsed),
      etaSeconds,
      manifest: this.manifest || undefined,
      solvedBitmask: this.decoder?.getSolvedBitmask(),
      errorMessage: this.errorMessage || undefined,
      unpackedFiles: this.unpackedFiles.length > 0 ? this.unpackedFiles : undefined,
    });
  }
}
