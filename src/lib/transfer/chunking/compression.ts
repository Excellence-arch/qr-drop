/**
 * QRDrop Intelligent Compression
 * 
 * Determines whether to compress based on file MIME type and extension.
 * Uses native Web Compression Streams API (deflate).
 */

const ALREADY_COMPRESSED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "avif",
  "mp4", "webm", "mkv", "mov", "avi", "mp3", "aac", "ogg", "flac",
  "zip", "gz", "tgz", "bz2", "xz", "7z", "rar",
  "pdf", "docx", "xlsx", "pptx", "epub", "woff", "woff2",
]);

export function isCompressibleType(filename: string, mimeType?: string): boolean {
  if (mimeType) {
    if (mimeType.startsWith("text/") || mimeType === "application/json" || mimeType === "image/svg+xml") {
      return true;
    }
  }

  const parts = filename.toLowerCase().split(".");
  if (parts.length > 1) {
    const ext = parts.pop()!;
    if (ALREADY_COMPRESSED_EXTENSIONS.has(ext)) {
      return false;
    }
  }

  return true;
}

/**
 * Compresses data using native CompressionStream('deflate') if available.
 * Returns compressed data only if it is actually smaller.
 */
export async function compressDataIfBeneficial(
  data: Uint8Array,
  filename: string,
  mimeType?: string
): Promise<{ data: Uint8Array; compressed: boolean }> {
  if (!isCompressibleType(filename, mimeType)) {
    return { data, compressed: false };
  }

  if (typeof CompressionStream === "undefined" || data.length < 64) {
    return { data, compressed: false };
  }

  try {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      },
    });

    const compressedStream = stream.pipeThrough(new CompressionStream("deflate"));
    const reader = compressedStream.getReader();
    const chunks: Uint8Array[] = [];
    let totalSize = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        totalSize += value.length;
      }
    }

    // Only use compressed if it resulted in real savings
    if (totalSize < data.length * 0.95) {
      const result = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return { data: result, compressed: true };
    }
  } catch (err) {
    console.warn("Compression error, proceeding with raw bytes:", err);
  }

  return { data, compressed: false };
}

/**
 * Decompresses data using native DecompressionStream('deflate').
 */
export async function decompressData(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    return data;
  }

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });

  const decompressedStream = stream.pipeThrough(new DecompressionStream("deflate"));
  const reader = decompressedStream.getReader();
  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      totalSize += value.length;
    }
  }

  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
