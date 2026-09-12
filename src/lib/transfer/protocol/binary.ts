/**
 * QRDrop Binary Packet Serialization & Integrity Validation
 * 
 * Implements a high-density, low-overhead binary framing protocol.
 * Header format (22 bytes):
 * [0..1]   Magic 0x5152 ('QR')
 * [2]      Version (1 byte)
 * [3]      PacketType (1 byte)
 * [4..7]   TransferId (4 bytes uint32)
 * [8..11]  Sequence / Seed (4 bytes uint32)
 * [12..13] ChunkIndex / Degree (2 bytes uint16)
 * [14..15] TotalChunks K (2 bytes uint16)
 * [16..17] PayloadLength (2 bytes uint16)
 * [18..21] CRC32 Checksum (4 bytes uint32)
 * [22..N]  Payload
 */

import {
  PROTOCOL_MAGIC,
  PROTOCOL_VERSION,
  PacketType,
  PacketHeader,
  BinaryPacket,
} from "./types";

export const HEADER_SIZE = 22;

// Standard IEEE 802.3 CRC32 Table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c;
}

/**
 * Computes CRC32 checksum over multiple byte segments.
 */
export function computeCRC32(
  data: Uint8Array,
  start = 0,
  end = data.length,
  previousCrc = 0
): number {
  let crc = previousCrc ^ -1;
  for (let i = start; i < end; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Converts a 32-bit uint transfer ID to a human-readable string (e.g. "T-7F92A1C4")
 */
export function formatTransferId(idNum: number): string {
  const hex = (idNum >>> 0).toString(16).toUpperCase().padStart(8, "0");
  return `T-${hex}`;
}

/**
 * Parses a transfer ID string back to a 32-bit uint
 */
export function parseTransferId(str: string): number {
  const cleaned = str.replace(/^T-?/i, "").trim();
  const val = parseInt(cleaned, 16);
  return isNaN(val) ? 0 : val >>> 0;
}

/**
 * Generates a random 32-bit uint transfer ID
 */
export function generateTransferIdNum(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  }
  return (Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

/**
 * Encodes a header and payload into a single binary packet byte buffer.
 */
export function encodePacket(
  header: Omit<PacketHeader, "magic" | "version" | "payloadLength" | "checksum">,
  payload: Uint8Array
): Uint8Array {
  const payloadLength = payload.length;
  const totalLength = HEADER_SIZE + payloadLength;
  const buffer = new Uint8Array(totalLength);
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

  // Write header fields (0..17)
  view.setUint16(0, PROTOCOL_MAGIC, false);
  view.setUint8(2, PROTOCOL_VERSION);
  view.setUint8(3, header.packetType);
  view.setUint32(4, header.transferId >>> 0, false);
  view.setUint32(8, header.sequence >>> 0, false);
  view.setUint16(12, header.chunkIndex, false);
  view.setUint16(14, header.totalChunks, false);
  view.setUint16(16, payloadLength, false);

  // Copy payload to bytes [22..totalLength]
  buffer.set(payload, HEADER_SIZE);

  // Compute CRC32 over header fields [0..17] and payload [22..totalLength]
  let crc = computeCRC32(buffer, 0, 18);
  crc = computeCRC32(buffer, HEADER_SIZE, totalLength, crc);

  // Write CRC32 at [18..21]
  view.setUint32(18, crc, false);

  return buffer;
}

/**
 * Decodes a raw byte buffer into a structured BinaryPacket.
 * Returns null if the magic, version, or length is invalid.
 */
export function decodePacket(rawBytes: Uint8Array): BinaryPacket | null {
  if (!rawBytes || rawBytes.length < HEADER_SIZE) {
    return null;
  }

  const view = new DataView(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
  const magic = view.getUint16(0, false);
  if (magic !== PROTOCOL_MAGIC) {
    return null;
  }

  const version = view.getUint8(2);
  if (version !== PROTOCOL_VERSION) {
    return null;
  }

  const packetType = view.getUint8(3) as PacketType;
  const transferId = view.getUint32(4, false);
  const sequence = view.getUint32(8, false);
  const chunkIndex = view.getUint16(12, false);
  const totalChunks = view.getUint16(14, false);
  const payloadLength = view.getUint16(16, false);
  const checksum = view.getUint32(18, false);

  if (rawBytes.length < HEADER_SIZE + payloadLength) {
    return null;
  }

  const payload = rawBytes.subarray(HEADER_SIZE, HEADER_SIZE + payloadLength);

  const header: PacketHeader = {
    magic,
    version,
    packetType,
    transferId,
    sequence,
    chunkIndex,
    totalChunks,
    payloadLength,
    checksum,
  };

  return {
    header,
    payload,
    rawBytes,
  };
}

/**
 * Validates the packet's CRC32 integrity checksum.
 */
export function validatePacket(packet: BinaryPacket): boolean {
  if (!packet || !packet.rawBytes || packet.rawBytes.length < HEADER_SIZE) {
    return false;
  }

  const { header, rawBytes, payload } = packet;
  if (header.magic !== PROTOCOL_MAGIC || header.version !== PROTOCOL_VERSION) {
    return false;
  }

  if (rawBytes.length < HEADER_SIZE + header.payloadLength) {
    return false;
  }

  // Calculate expected CRC32
  let calculatedCrc = computeCRC32(rawBytes, 0, 18);
  calculatedCrc = computeCRC32(payload, 0, payload.length, calculatedCrc);

  return (header.checksum >>> 0) === (calculatedCrc >>> 0);
}

/**
 * Binary <-> Latin1 / Byte String conversions for QR compatibility.
 * ISO-8859-1 mapping preserves binary byte values 0x00-0xFF 1:1.
 */
export function bytesToBinaryString(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.byteLength;
  const CHUNK_SZ = 8192;
  for (let i = 0; i < len; i += CHUNK_SZ) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SZ, len));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return binary;
}

export function binaryStringToBytes(str: string): Uint8Array {
  const len = str.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff;
  }
  return bytes;
}
