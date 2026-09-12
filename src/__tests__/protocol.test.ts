import { describe, it, expect } from "vitest";
import {
  encodePacket,
  decodePacket,
  validatePacket,
  computeCRC32,
  formatTransferId,
  parseTransferId,
  bytesToBinaryString,
  binaryStringToBytes,
} from "../lib/transfer/protocol/binary";
import { PacketType } from "../lib/transfer/protocol/types";

describe("QRDrop Binary Protocol", () => {
  it("computes standard CRC32 correctly", () => {
    const data = new TextEncoder().encode("123456789");
    const crc = computeCRC32(data);
    // Standard test vector for '123456789' is 0xCBF43926
    expect(crc).toBe(0xcbf43926);
  });

  it("encodes, decodes, and validates a binary packet accurately", () => {
    const payload = new Uint8Array([10, 20, 30, 40, 50, 60, 70, 80]);
    const transferId = 0x7f92a1c4;
    const rawPacket = encodePacket(
      {
        packetType: PacketType.SYSTEMATIC_CHUNK,
        transferId,
        sequence: 42,
        chunkIndex: 5,
        totalChunks: 100,
      },
      payload
    );

    expect(rawPacket.length).toBe(22 + payload.length);

    const decoded = decodePacket(rawPacket);
    expect(decoded).not.toBeNull();
    expect(decoded!.header.magic).toBe(0x5152);
    expect(decoded!.header.version).toBe(1);
    expect(decoded!.header.packetType).toBe(PacketType.SYSTEMATIC_CHUNK);
    expect(decoded!.header.transferId).toBe(transferId);
    expect(decoded!.header.sequence).toBe(42);
    expect(decoded!.header.chunkIndex).toBe(5);
    expect(decoded!.header.totalChunks).toBe(100);
    expect(decoded!.header.payloadLength).toBe(payload.length);
    expect(Array.from(decoded!.payload)).toEqual(Array.from(payload));

    const isValid = validatePacket(decoded!);
    expect(isValid).toBe(true);
  });

  it("detects corrupted packet payloads via CRC32 validation", () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    const rawPacket = encodePacket(
      {
        packetType: PacketType.FOUNTAIN_PARITY,
        transferId: 0x11223344,
        sequence: 10,
        chunkIndex: 3,
        totalChunks: 20,
      },
      payload
    );

    // Corrupt one bit in payload
    rawPacket[24] ^= 0x01;

    const decoded = decodePacket(rawPacket);
    expect(decoded).not.toBeNull();
    const isValid = validatePacket(decoded!);
    expect(isValid).toBe(false);
  });

  it("formats and parses human-readable Transfer IDs", () => {
    const idNum = 0x7f92a1c4;
    const formatted = formatTransferId(idNum);
    expect(formatted).toBe("T-7F92A1C4");
    expect(parseTransferId(formatted)).toBe(idNum);
    expect(parseTransferId("7F92A1C4")).toBe(idNum);
  });

  it("converts byte arrays to and from binary strings without loss", () => {
    const original = new Uint8Array(256);
    for (let i = 0; i < 256; i++) original[i] = i;

    const str = bytesToBinaryString(original);
    const converted = binaryStringToBytes(str);
    expect(Array.from(converted)).toEqual(Array.from(original));
  });
});
