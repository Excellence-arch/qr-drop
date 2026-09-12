/**
 * QRDrop Multi-File Packaging & Chunk Slicing
 * 
 * Packages multiple files into a unified binary bundle with manifest table of contents.
 * Slices arbitrary binary payloads into uniform K chunks for the fountain encoder.
 */

import { FileItemMetadata } from "../protocol/types";
import { computeSHA256 } from "../crypto/webcrypto";

export interface PackageHeaderTOC {
  version: 1;
  files: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    lastModified: number;
    hash: string;
    offset: number;
  }>;
}

/**
 * Packs multiple File objects or ArrayBuffers into a single contiguous binary buffer.
 */
export async function packFiles(
  fileItems: Array<{ file: File | Blob; name: string; type?: string; lastModified?: number }>
): Promise<{
  packageBuffer: Uint8Array;
  fileMetadata: FileItemMetadata[];
  totalBytes: number;
}> {
  const metadataList: FileItemMetadata[] = [];
  const fileBuffers: Uint8Array[] = [];

  for (let i = 0; i < fileItems.length; i++) {
    const item = fileItems[i];
    const arrayBuffer = await item.file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const hash = await computeSHA256(bytes);
    const id = `file_${i + 1}_${Math.random().toString(36).substring(2, 8)}`;

    metadataList.push({
      id,
      name: item.name,
      size: bytes.length,
      type: item.type || (item.file as File).type || "application/octet-stream",
      lastModified: item.lastModified || (item.file as File).lastModified || Date.now(),
      originalHash: hash,
    });
    fileBuffers.push(bytes);
  }

  // Create Table of Contents (TOC)
  let currentOffset = 0;
  const tocEntries = metadataList.map((m, idx) => {
    const entry = {
      id: m.id,
      name: m.name,
      size: m.size,
      type: m.type,
      lastModified: m.lastModified,
      hash: m.originalHash,
      offset: currentOffset,
    };
    currentOffset += m.size;
    return entry;
  });

  const toc: PackageHeaderTOC = {
    version: 1,
    files: tocEntries,
  };

  const enc = new TextEncoder();
  const tocJsonBytes = enc.encode(JSON.stringify(toc));

  // Package layout:
  // [0..3] TOC length (uint32 big-endian)
  // [4..4+TOC_LEN-1] TOC JSON
  // [data start..] concatenated file byte streams
  const totalPackageSize = 4 + tocJsonBytes.length + currentOffset;
  const packageBuffer = new Uint8Array(totalPackageSize);
  const view = new DataView(packageBuffer.buffer, packageBuffer.byteOffset, packageBuffer.byteLength);

  view.setUint32(0, tocJsonBytes.length, false);
  packageBuffer.set(tocJsonBytes, 4);

  let dataOffset = 4 + tocJsonBytes.length;
  for (const fBytes of fileBuffers) {
    packageBuffer.set(fBytes, dataOffset);
    dataOffset += fBytes.length;
  }

  return {
    packageBuffer,
    fileMetadata: metadataList,
    totalBytes: currentOffset,
  };
}

/**
 * Unpacks a reconstructed binary buffer back into individual files and verifies their SHA-256 hashes.
 */
export async function unpackFiles(
  packageBuffer: Uint8Array
): Promise<Array<{ metadata: FileItemMetadata; blob: Blob; verified: boolean }>> {
  const view = new DataView(packageBuffer.buffer, packageBuffer.byteOffset, packageBuffer.byteLength);
  if (packageBuffer.length < 4) {
    throw new Error("Invalid package buffer: too short.");
  }

  const tocLength = view.getUint32(0, false);
  if (packageBuffer.length < 4 + tocLength) {
    throw new Error("Invalid package buffer: TOC truncated.");
  }

  const dec = new TextDecoder();
  const tocJson = dec.decode(packageBuffer.subarray(4, 4 + tocLength));
  const toc: PackageHeaderTOC = JSON.parse(tocJson);

  const dataStart = 4 + tocLength;
  const results: Array<{ metadata: FileItemMetadata; blob: Blob; verified: boolean }> = [];

  for (const entry of toc.files) {
    const fileBytes = packageBuffer.subarray(
      dataStart + entry.offset,
      dataStart + entry.offset + entry.size
    );

    const actualHash = await computeSHA256(fileBytes);
    const verified = actualHash.toLowerCase() === entry.hash.toLowerCase();

    const blob = new Blob([fileBytes as any], { type: entry.type });

    results.push({
      metadata: {
        id: entry.id,
        name: entry.name,
        size: entry.size,
        type: entry.type,
        lastModified: entry.lastModified,
        originalHash: entry.hash,
      },
      blob,
      verified,
    });
  }

  return results;
}

/**
 * Slices a contiguous byte buffer into uniform chunks of size `chunkSize`.
 * The last chunk is zero-padded to `chunkSize` so all erasure operations are uniform.
 */
export function sliceIntoChunks(data: Uint8Array, chunkSize: number): {
  chunks: Uint8Array[];
  totalChunks: number;
  originalLength: number;
} {
  const originalLength = data.length;
  const totalChunks = Math.max(1, Math.ceil(originalLength / chunkSize));
  const chunks: Uint8Array[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const chunk = new Uint8Array(chunkSize);
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, originalLength);
    chunk.set(data.subarray(start, end), 0);
    chunks.push(chunk);
  }

  return {
    chunks,
    totalChunks,
    originalLength,
  };
}
