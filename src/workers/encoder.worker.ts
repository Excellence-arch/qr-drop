/**
 * QRDrop Background Encoder Worker
 * 
 * Offloads compute-heavy packing, hashing, encryption, and chunking off the main UI thread.
 */

import { packFiles, sliceIntoChunks } from "../lib/transfer/chunking/packer";
import { encryptData, computeSHA256 } from "../lib/transfer/crypto/webcrypto";
import { FountainEncoder } from "../lib/transfer/erasure/fountain";
import {
  generateTransferIdNum,
  formatTransferId,
  encodePacket,
} from "../lib/transfer/protocol/binary";
import {
  PacketType,
  TransferManifest,
  TRANSMISSION_PROFILES,
  TransmissionMode,
} from "../lib/transfer/protocol/types";

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === "PREPARE_TRANSFER") {
    try {
      const { files, mode, password, pairingCode } = payload;
      const profile = TRANSMISSION_PROFILES[mode as TransmissionMode] || TRANSMISSION_PROFILES.balanced;

      // 1. Pack files
      const { packageBuffer, fileMetadata, totalBytes } = await packFiles(files);
      const originalPackageHash = await computeSHA256(packageBuffer);

      // 2. Encrypt
      const encryptionResult = await encryptData(packageBuffer, {
        password,
        pairingCode,
      });
      const encryptedData = encryptionResult.ciphertext;
      const encryptedPackageHash = await computeSHA256(encryptedData);

      // 3. Slice into chunks
      const chunkSize = profile.chunkSize;
      const { chunks, totalChunks } = sliceIntoChunks(encryptedData, chunkSize);

      // 4. Transfer ID
      const transferIdNum = generateTransferIdNum();
      const transferId = formatTransferId(transferIdNum);

      const manifest: TransferManifest = {
        transferId,
        transferIdNum,
        createdAt: Date.now(),
        totalFiles: fileMetadata.length,
        totalBytes,
        encryptedBytes: encryptedData.length,
        totalChunks,
        chunkSize,
        isEncrypted: true,
        saltHex: encryptionResult.saltHex,
        ivHex: encryptionResult.ivHex,
        originalPackageHash,
        encryptedPackageHash,
        files: fileMetadata,
        compression: "none",
        protection: password ? "password" : pairingCode ? "pairing" : "none",
        pairingCode,
      };

      const enc = new TextEncoder();
      const manifestJsonBytes = enc.encode(JSON.stringify(manifest));
      const manifestPacketBytes = encodePacket(
        {
          packetType: PacketType.MANIFEST,
          transferId: transferIdNum,
          sequence: 0,
          chunkIndex: 0,
          totalChunks,
        },
        manifestJsonBytes
      );

      // Transferable chunks buffers
      self.postMessage({
        type: "TRANSFER_PREPARED",
        manifest,
        manifestPacketBytes,
        chunks,
      });
    } catch (err: any) {
      self.postMessage({
        type: "ENCODER_ERROR",
        error: err.message || "Worker preparation failed",
      });
    }
  }
};
