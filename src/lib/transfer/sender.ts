/**
 * QRDrop Sender Orchestration Engine
 * 
 * Manages the complete sender pipeline:
 * Files -> Packing -> SHA-256 -> AES-GCM Encryption -> Chunking -> Fountain Encoding -> Optical Transmission Loop
 */

import {
  TransferManifest,
  TransmissionMode,
  TRANSMISSION_PROFILES,
  PacketType,
  FileItemMetadata,
} from "./protocol/types";
import {
  encodePacket,
  generateTransferIdNum,
  formatTransferId,
} from "./protocol/binary";
import { packFiles, sliceIntoChunks } from "./chunking/packer";
import { encryptData, computeSHA256, bufferToHex } from "./crypto/webcrypto";
import { FountainEncoder } from "./erasure/fountain";
import { OpticalTransport } from "./transport/optical";

export interface SenderConfig {
  files: Array<{ file: File | Blob; name: string; type?: string; lastModified?: number }>;
  mode: TransmissionMode;
  password?: string;
  pairingCode?: string;
  onProgress?: (info: SenderProgressInfo) => void;
  onError?: (err: Error) => void;
}

export interface SenderProgressInfo {
  transferId: string;
  transferIdNum: number;
  status: "idle" | "preparing" | "transmitting" | "paused" | "completed" | "cancelled";
  sequence: number;
  totalChunks: number;
  totalBytes: number;
  encryptedBytes: number;
  currentFps: number;
  speedBytesPerSec: number;
  elapsedSeconds: number;
  estimatedTotalSeconds: number;
  files: FileItemMetadata[];
}

export class TransferSender {
  private config: SenderConfig;
  private transport: OpticalTransport | null = null;
  private manifest: TransferManifest | null = null;
  private manifestPacketBytes: Uint8Array | null = null;
  private encoder: FountainEncoder | null = null;
  private isRunning = false;
  private isPaused = false;
  private sequence = 0;
  private startTime = 0;
  private framesSent = 0;
  private animationFrameId: number | null = null;
  private lastFrameTimestamp = 0;
  private targetFps: number;
  private profile = TRANSMISSION_PROFILES.balanced;
  private filesMetadata: FileItemMetadata[] = [];
  private totalBytes = 0;
  private encryptedBytes = 0;

  constructor(config: SenderConfig) {
    this.config = config;
    this.profile = TRANSMISSION_PROFILES[config.mode] || TRANSMISSION_PROFILES.balanced;
    this.targetFps = this.profile.targetFps;
  }

  public setTransport(transport: OpticalTransport): void {
    this.transport = transport;
  }

  public setTargetFps(fps: number): void {
    this.targetFps = Math.max(1, Math.min(60, fps));
  }

  public getManifest(): TransferManifest | null {
    return this.manifest;
  }

  public isTransferActive(): boolean {
    return this.isRunning;
  }

  public isTransferPaused(): boolean {
    return this.isPaused;
  }

  /**
   * Prepares the transfer package (packing, encryption, chunking, fountain encoder setup).
   */
  public async prepare(): Promise<TransferManifest> {
    if (this.config.onProgress) {
      this.config.onProgress({
        transferId: "T-PREPARING",
        transferIdNum: 0,
        status: "preparing",
        sequence: 0,
        totalChunks: 0,
        totalBytes: 0,
        encryptedBytes: 0,
        currentFps: 0,
        speedBytesPerSec: 0,
        elapsedSeconds: 0,
        estimatedTotalSeconds: 0,
        files: [],
      });
    }

    // 1. Pack files
    const { packageBuffer, fileMetadata, totalBytes } = await packFiles(this.config.files);
    this.filesMetadata = fileMetadata;
    this.totalBytes = totalBytes;

    // 2. Original Hash
    const originalPackageHash = await computeSHA256(packageBuffer);

    // 3. Encrypt payload
    const encryptionResult = await encryptData(packageBuffer, {
      password: this.config.password,
      pairingCode: this.config.pairingCode,
    });

    const encryptedData = encryptionResult.ciphertext;
    this.encryptedBytes = encryptedData.length;
    const encryptedPackageHash = await computeSHA256(encryptedData);

    // 4. Slice into chunks
    const chunkSize = this.profile.chunkSize;
    const { chunks, totalChunks } = sliceIntoChunks(encryptedData, chunkSize);

    // 5. Transfer ID
    const transferIdNum = generateTransferIdNum();
    const transferId = formatTransferId(transferIdNum);

    // 6. Build Manifest
    this.manifest = {
      transferId,
      transferIdNum,
      createdAt: Date.now(),
      totalFiles: fileMetadata.length,
      totalBytes,
      encryptedBytes: this.encryptedBytes,
      totalChunks,
      chunkSize,
      isEncrypted: true,
      saltHex: encryptionResult.saltHex,
      ivHex: encryptionResult.ivHex,
      originalPackageHash,
      encryptedPackageHash,
      files: fileMetadata,
      compression: "none",
      protection: this.config.password ? "password" : this.config.pairingCode ? "pairing" : "none",
      pairingCode: this.config.pairingCode,
    };

    // 7. Create binary Manifest packet
    const enc = new TextEncoder();
    const manifestJsonBytes = enc.encode(JSON.stringify(this.manifest));
    this.manifestPacketBytes = encodePacket(
      {
        packetType: PacketType.MANIFEST,
        transferId: transferIdNum,
        sequence: 0,
        chunkIndex: 0,
        totalChunks,
      },
      manifestJsonBytes
    );

    // 8. Initialize Fountain Encoder
    this.encoder = new FountainEncoder(chunks);

    return this.manifest;
  }

  /**
   * Starts the optical transmission loop.
   */
  public async start(): Promise<void> {
    if (!this.transport) {
      throw new Error("OpticalTransport not configured for TransferSender.");
    }
    if (!this.manifest || !this.encoder) {
      await this.prepare();
    }

    this.isRunning = true;
    this.isPaused = false;
    this.sequence = 0;
    this.dataSequence = 0;
    this.framesSent = 0;
    this.startTime = performance.now();
    this.lastFrameTimestamp = performance.now();

    await this.transport.start();
    this.transmissionLoop();
  }

  public pause(): void {
    this.isPaused = true;
    this.notifyProgress();
  }

  public resume(): void {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      this.lastFrameTimestamp = performance.now();
      this.transmissionLoop();
    }
  }

  public async cancel(): Promise<void> {
    this.isRunning = false;
    this.isPaused = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.transport) {
      await this.transport.stop();
    }
    this.notifyProgress("cancelled");
  }

  private transmissionLoop = async (): Promise<void> => {
    if (!this.isRunning || this.isPaused) return;

    const now = performance.now();
    const frameIntervalMs = 1000 / this.targetFps;

    if (now - this.lastFrameTimestamp >= frameIntervalMs) {
      this.lastFrameTimestamp = now;
      await this.sendNextFrame();
    }

    this.animationFrameId = requestAnimationFrame(this.transmissionLoop);
  };

  private dataSequence = 0;

  /**
   * Generates and transmits the next frame packet.
   * Interleaves MANIFEST packets periodically without skipping data chunk sequences.
   */
  public async sendNextFrame(): Promise<Uint8Array | null> {
    if (!this.transport || !this.manifest || !this.encoder) return null;

    const transferIdNum = this.manifest.transferIdNum;
    const totalChunks = this.manifest.totalChunks;
    let packetBytes: Uint8Array;

    // Send MANIFEST packet at sequence 0 and every 8th frame to allow receivers to sync
    if (this.sequence % 8 === 0 && this.manifestPacketBytes) {
      packetBytes = this.manifestPacketBytes;
    } else {
      const chunkSeq = this.dataSequence++;
      const { degree, chunkIndex, payload } = this.encoder.generatePacket(chunkSeq);
      const packetType = chunkSeq < totalChunks ? PacketType.SYSTEMATIC_CHUNK : PacketType.FOUNTAIN_PARITY;

      packetBytes = encodePacket(
        {
          packetType,
          transferId: transferIdNum,
          sequence: chunkSeq,
          chunkIndex,
          totalChunks,
        },
        payload
      );
    }

    await this.transport.sendFrame(packetBytes);
    this.sequence++;
    this.framesSent++;
    this.notifyProgress();
    return packetBytes;
  }

  private notifyProgress(overrideStatus?: SenderProgressInfo["status"]): void {
    if (!this.config.onProgress || !this.manifest) return;

    const elapsed = (performance.now() - this.startTime) / 1000;
    const currentFps = elapsed > 0 ? this.framesSent / elapsed : 0;
    const speedBytesPerSec = currentFps * this.profile.chunkSize;
    const estimatedTotalSeconds =
      this.targetFps > 0
        ? (this.manifest.totalChunks * this.profile.redundancyMultiplier) / this.targetFps
        : 0;

    this.config.onProgress({
      transferId: this.manifest.transferId,
      transferIdNum: this.manifest.transferIdNum,
      status: overrideStatus || (this.isPaused ? "paused" : this.isRunning ? "transmitting" : "completed"),
      sequence: this.sequence,
      totalChunks: this.manifest.totalChunks,
      totalBytes: this.totalBytes,
      encryptedBytes: this.encryptedBytes,
      currentFps: Math.round(currentFps * 10) / 10,
      speedBytesPerSec: Math.round(speedBytesPerSec),
      elapsedSeconds: Math.round(elapsed),
      estimatedTotalSeconds: Math.round(estimatedTotalSeconds),
      files: this.filesMetadata,
    });
  }
}
