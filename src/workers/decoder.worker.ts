/**
 * QRDrop Background Decoder Worker
 * 
 * Offloads fountain decoding, bitwise solving, AES-GCM decryption, and SHA-256 verification.
 */

import { FountainDecoder } from "../lib/transfer/erasure/fountain";
import { decryptData, computeSHA256 } from "../lib/transfer/crypto/webcrypto";
import { unpackFiles } from "../lib/transfer/chunking/packer";
import { TransferManifest } from "../lib/transfer/protocol/types";

let decoder: FountainDecoder | null = null;
let manifest: TransferManifest | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === "INIT_DECODER") {
    manifest = payload.manifest;
    decoder = new FountainDecoder(manifest!.totalChunks, manifest!.chunkSize);
    self.postMessage({ type: "DECODER_INITIALIZED" });
  } else if (type === "ADD_PACKET") {
    if (!decoder) return;
    const { sequence, chunkPayload } = payload;
    const contributed = decoder.addPacket(sequence, chunkPayload);
    const status = decoder.getStatus();

    self.postMessage({
      type: "PACKET_PROCESSED",
      contributed,
      status,
      solvedBitmask: decoder.getSolvedBitmask(),
    });

    if (decoder.isComplete() && manifest) {
      try {
        self.postMessage({ type: "RECONSTRUCTION_STARTED" });
        const reconstructedEncrypted = decoder.reconstructData(manifest.encryptedBytes);

        // Verify SHA-256 of encrypted package
        const encryptedHash = await computeSHA256(reconstructedEncrypted);
        if (encryptedHash.toLowerCase() !== manifest.encryptedPackageHash.toLowerCase()) {
          throw new Error("Encrypted package SHA-256 verification mismatch.");
        }

        // Decrypt
        const decrypted = await decryptData(reconstructedEncrypted, manifest.ivHex || "", {
          password: payload.password,
          pairingCode: payload.pairingCode,
          saltHex: manifest.saltHex,
        });

        // Verify SHA-256 of original package
        const originalHash = await computeSHA256(decrypted);
        if (originalHash.toLowerCase() !== manifest.originalPackageHash.toLowerCase()) {
          throw new Error("Original package SHA-256 verification mismatch.");
        }

        // Unpack files
        const files = await unpackFiles(decrypted);

        self.postMessage({
          type: "RECONSTRUCTION_COMPLETE",
          files,
          manifest,
        });
      } catch (err: any) {
        self.postMessage({
          type: "DECODER_ERROR",
          error: err.message || "Reconstruction failed",
        });
      }
    }
  }
};
