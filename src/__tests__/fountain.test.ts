import { describe, it, expect } from "vitest";
import {
  FountainEncoder,
  FountainDecoder,
  xorBuffers,
} from "../lib/transfer/erasure/fountain";

describe("QRDrop Fountain Erasure Coding", () => {
  it("XORs buffers accurately", () => {
    const dest = new Uint8Array([0xaa, 0x55, 0xff, 0x00]);
    const src = new Uint8Array([0x55, 0xaa, 0xff, 0x12]);
    xorBuffers(dest, src);
    expect(Array.from(dest)).toEqual([0xff, 0xff, 0x00, 0x12]);
  });

  it("reconstructs data perfectly with 0% packet loss (systematic chunks)", () => {
    const K = 10;
    const chunkSize = 64;
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < K; i++) {
      const c = new Uint8Array(chunkSize);
      c.fill(i + 1);
      chunks.push(c);
    }

    const encoder = new FountainEncoder(chunks);
    const decoder = new FountainDecoder(K, chunkSize);

    for (let seq = 0; seq < K; seq++) {
      const packet = encoder.generatePacket(seq);
      const added = decoder.addPacket(seq, packet.payload);
      expect(added).toBe(true);
    }

    expect(decoder.isComplete()).toBe(true);
    expect(decoder.getSolvedCount()).toBe(K);

    const reconstructed = decoder.reconstructData();
    expect(reconstructed.length).toBe(K * chunkSize);
    for (let i = 0; i < K; i++) {
      const slice = reconstructed.subarray(i * chunkSize, (i + 1) * chunkSize);
      expect(slice[0]).toBe(i + 1);
    }
  });

  it("reconstructs data with 30% packet loss using fountain parity packets", () => {
    const K = 20;
    const chunkSize = 128;
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < K; i++) {
      const c = new Uint8Array(chunkSize);
      for (let j = 0; j < chunkSize; j++) c[j] = (i * 17 + j) & 0xff;
      chunks.push(c);
    }

    const encoder = new FountainEncoder(chunks);
    const decoder = new FountainDecoder(K, chunkSize);

    // Simulate 30% packet loss: skip 30% of systematic packets
    let seq = 0;
    while (!decoder.isComplete() && seq < K * 4) {
      // 30% loss rate simulated
      if (Math.random() > 0.3) {
        const packet = encoder.generatePacket(seq);
        decoder.addPacket(seq, packet.payload);
      }
      seq++;
    }

    expect(decoder.isComplete()).toBe(true);
    const reconstructed = decoder.reconstructData();

    // Verify bit-for-bit exact reconstruction
    for (let i = 0; i < K; i++) {
      const originalSlice = chunks[i];
      const reconstructedSlice = reconstructed.subarray(i * chunkSize, (i + 1) * chunkSize);
      expect(Array.from(reconstructedSlice)).toEqual(Array.from(originalSlice));
    }
  });

  it("handles out-of-order and duplicate packets gracefully", () => {
    const K = 8;
    const chunkSize = 32;
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < K; i++) {
      const c = new Uint8Array(chunkSize);
      c.fill(i + 10);
      chunks.push(c);
    }

    const encoder = new FountainEncoder(chunks);
    const decoder = new FountainDecoder(K, chunkSize);

    // Out-of-order order: [7, 3, 1, 5, 0, 2, 4, 6] + duplicates
    const sequenceOrder = [7, 3, 3, 1, 5, 5, 0, 2, 4, 6, 7];

    for (const seq of sequenceOrder) {
      const packet = encoder.generatePacket(seq);
      decoder.addPacket(seq, packet.payload);
    }

    expect(decoder.isComplete()).toBe(true);
    const reconstructed = decoder.reconstructData();
    for (let i = 0; i < K; i++) {
      expect(reconstructed[i * chunkSize]).toBe(i + 10);
    }
  });
});
