/**
 * QRDrop Systematic Luby Transform (LT) Fountain Codes
 * 
 * Provides rateless erasure-coding over optical transmission channels.
 * - Systematic Phase (packets 0..K-1): Direct chunks for zero-overhead reception under good conditions.
 * - Fountain Phase (packets >= K): XOR parity combinations drawn from the Robust Soliton Distribution.
 * - Receiver: Dual-mode decoder with O(K) Peeling Decoder (Belief Propagation) and GF(2) Gaussian Elimination fallback.
 */

// Simple deterministic PRNG (XorShift32) seeded per sequence
export class XorShift32 {
  private state: number;

  constructor(seed: number) {
    this.state = (seed === 0 ? 0x12345678 : seed) >>> 0;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return (this.state >>> 0) / 4294967296; // [0, 1)
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

/**
 * Robust Soliton Cumulative Distribution Function generator for LT codes.
 */
export function generateRobustSolitonCDF(K: number, c = 0.1, delta = 0.05): Float64Array {
  if (K <= 1) {
    const cdf = new Float64Array(2);
    cdf[1] = 1.0;
    return cdf;
  }

  const rho = new Float64Array(K + 1);
  rho[1] = 1.0 / K;
  for (let d = 2; d <= K; d++) {
    rho[d] = 1.0 / (d * (d - 1));
  }

  const tau = new Float64Array(K + 1);
  const R = c * Math.log(K / delta) * Math.sqrt(K);
  const pivot = Math.floor(K / R);

  for (let d = 1; d <= K; d++) {
    if (d < pivot) {
      tau[d] = R / (d * K);
    } else if (d === pivot) {
      tau[d] = (R * Math.log(R / delta)) / K;
    } else {
      tau[d] = 0;
    }
  }

  let beta = 0;
  for (let d = 1; d <= K; d++) {
    beta += rho[d] + tau[d];
  }

  const cdf = new Float64Array(K + 1);
  let cumulative = 0;
  for (let d = 1; d <= K; d++) {
    const mu = (rho[d] + tau[d]) / beta;
    cumulative += mu;
    cdf[d] = Math.min(1.0, cumulative);
  }
  cdf[K] = 1.0;

  return cdf;
}

/**
 * Samples a degree d from the precomputed Robust Soliton CDF using binary search.
 */
export function sampleDegree(cdf: Float64Array, rng: XorShift32): number {
  const K = cdf.length - 1;
  if (K <= 1) return 1;

  const p = rng.next();
  let low = 1;
  let high = K;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (cdf[mid] < p) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return Math.max(1, Math.min(K, low));
}

/**
 * Deterministically generates neighbor chunk indices for a given fountain packet sequence.
 */
export function getFountainNeighbors(
  sequence: number,
  K: number,
  cdf: Float64Array
): { degree: number; neighbors: number[] } {
  if (sequence < K) {
    // Systematic chunk: 1:1 mapping
    return { degree: 1, neighbors: [sequence] };
  }

  const rng = new XorShift32(sequence + 0x9e3779b9);
  const degree = sampleDegree(cdf, rng);

  // Sample 'degree' distinct indices from [0, K-1] using Fisher-Yates or set selection
  const neighbors: number[] = [];
  const chosen = new Set<number>();

  while (neighbors.length < degree) {
    const idx = rng.nextInt(0, K - 1);
    if (!chosen.has(idx)) {
      chosen.add(idx);
      neighbors.push(idx);
    }
  }

  return { degree, neighbors };
}

/**
 * Bitwise XOR combination of multiple byte arrays.
 */
export function xorBuffers(dest: Uint8Array, src: Uint8Array): void {
  const len = Math.min(dest.length, src.length);
  // Process 32-bit words for speed where possible
  const u32Len = Math.floor(len / 4);
  if (u32Len > 0 && dest.byteOffset % 4 === 0 && src.byteOffset % 4 === 0) {
    const dest32 = new Uint32Array(dest.buffer, dest.byteOffset, u32Len);
    const src32 = new Uint32Array(src.buffer, src.byteOffset, u32Len);
    for (let i = 0; i < u32Len; i++) {
      dest32[i] ^= src32[i];
    }
  }
  for (let i = u32Len * 4; i < len; i++) {
    dest[i] ^= src[i];
  }
}

/**
 * Fountain Packet Generator (Encoder)
 */
export class FountainEncoder {
  private chunks: Uint8Array[];
  private K: number;
  private chunkSize: number;
  private cdf: Float64Array;

  constructor(chunks: Uint8Array[]) {
    this.chunks = chunks;
    this.K = chunks.length;
    this.chunkSize = chunks[0]?.length || 0;
    this.cdf = generateRobustSolitonCDF(this.K);
  }

  public getTotalChunks(): number {
    return this.K;
  }

  public getChunkSize(): number {
    return this.chunkSize;
  }

  /**
   * Generates a packet payload for a given sequence number.
   * If sequence < K, returns systematic source chunk.
   * If sequence >= K, returns fountain XOR parity chunk.
   */
  public generatePacket(sequence: number): {
    degree: number;
    chunkIndex: number;
    payload: Uint8Array;
  } {
    if (sequence < this.K) {
      // Systematic
      const chunk = this.chunks[sequence];
      return {
        degree: 1,
        chunkIndex: sequence,
        payload: new Uint8Array(chunk),
      };
    }

    // Fountain parity
    const { degree, neighbors } = getFountainNeighbors(sequence, this.K, this.cdf);
    const combined = new Uint8Array(this.chunkSize);

    for (const idx of neighbors) {
      const sourceChunk = this.chunks[idx];
      xorBuffers(combined, sourceChunk);
    }

    return {
      degree,
      chunkIndex: degree,
      payload: combined,
    };
  }
}

/**
 * Incremental Fountain Decoder with Peeling & GF(2) Gauss-Jordan Elimination
 */
export interface FountainDecoderStatus {
  totalChunks: number;
  solvedCount: number;
  equationsCount: number;
  isComplete: boolean;
  progressRatio: number;
}

export class FountainDecoder {
  private K: number;
  private chunkSize: number;
  private cdf: Float64Array;
  private solved: (Uint8Array | null)[];
  private solvedCount = 0;
  private equations: Array<{
    neighbors: Set<number>;
    data: Uint8Array;
    sequence: number;
  }> = [];
  private processedSequences = new Set<number>();

  constructor(totalChunks: number, chunkSize: number) {
    this.K = totalChunks;
    this.chunkSize = chunkSize;
    this.cdf = generateRobustSolitonCDF(totalChunks);
    this.solved = new Array(totalChunks).fill(null);
  }

  public isComplete(): boolean {
    return this.solvedCount >= this.K;
  }

  public getSolvedCount(): number {
    return this.solvedCount;
  }

  public getTotalChunks(): number {
    return this.K;
  }

  public getStatus(): FountainDecoderStatus {
    return {
      totalChunks: this.K,
      solvedCount: this.solvedCount,
      equationsCount: this.equations.length,
      isComplete: this.isComplete(),
      progressRatio: this.K > 0 ? this.solvedCount / this.K : 0,
    };
  }

  public getSolvedBitmask(): boolean[] {
    return this.solved.map((s) => s !== null);
  }

  /**
   * Processes an incoming packet. Returns true if this packet contributed new information.
   */
  public addPacket(sequence: number, rawPayload: Uint8Array): boolean {
    if (this.isComplete()) {
      return false;
    }

    if (this.processedSequences.has(sequence)) {
      return false; // Duplicate frame
    }
    this.processedSequences.add(sequence);

    // Make a copy of payload sized to chunkSize
    const payload = new Uint8Array(this.chunkSize);
    payload.set(rawPayload.subarray(0, Math.min(rawPayload.length, this.chunkSize)));

    const { neighbors } = getFountainNeighbors(sequence, this.K, this.cdf);
    const activeNeighbors = new Set<number>(neighbors);

    // Substitute all currently solved chunks from the equation
    for (const idx of neighbors) {
      if (this.solved[idx] !== null) {
        xorBuffers(payload, this.solved[idx]!);
        activeNeighbors.delete(idx);
      }
    }

    if (activeNeighbors.size === 0) {
      return false; // Already fully known
    }

    if (activeNeighbors.size === 1) {
      // Degree 1: immediate resolution of new chunk
      const resolvedIdx = Array.from(activeNeighbors)[0];
      this.resolveChunk(resolvedIdx, payload);
      this.peel();
      return true;
    }

    // Degree > 1: store equation and attempt simplification with existing equations
    this.equations.push({
      neighbors: activeNeighbors,
      data: payload,
      sequence,
    });

    // Simplify with Gaussian reduction
    const simplified = this.reduceEquations();
    if (simplified) {
      this.peel();
      return true;
    }

    return true;
  }

  /**
   * Resolves chunk at index `idx` and updates solved table.
   */
  private resolveChunk(idx: number, data: Uint8Array): void {
    if (this.solved[idx] !== null) return;
    this.solved[idx] = data;
    this.solvedCount++;
  }

  /**
   * Peeling decoder: propagates newly solved chunks through equation graph.
   */
  private peel(): void {
    let progressed = true;
    while (progressed && !this.isComplete()) {
      progressed = false;
      const remainingEquations: typeof this.equations = [];

      for (const eq of this.equations) {
        // Remove any solved neighbors
        for (const idx of Array.from(eq.neighbors)) {
          if (this.solved[idx] !== null) {
            xorBuffers(eq.data, this.solved[idx]!);
            eq.neighbors.delete(idx);
          }
        }

        if (eq.neighbors.size === 0) {
          // Solved or redundant, drop
          continue;
        }

        if (eq.neighbors.size === 1) {
          const resolvedIdx = Array.from(eq.neighbors)[0];
          this.resolveChunk(resolvedIdx, eq.data);
          progressed = true;
        } else {
          remainingEquations.push(eq);
        }
      }

      this.equations = remainingEquations;
    }
  }

  /**
   * Gaussian elimination over GF(2) for equations when peeling halts.
   */
  private reduceEquations(): boolean {
    if (this.equations.length < 2) return false;

    let progress = false;
    // Map pivot index -> equation index
    const pivotMap = new Map<number, number>();

    for (let i = 0; i < this.equations.length; i++) {
      const eq = this.equations[i];
      if (eq.neighbors.size === 0) continue;

      const minPivot = Math.min(...Array.from(eq.neighbors));
      if (pivotMap.has(minPivot)) {
        const otherIdx = pivotMap.get(minPivot)!;
        const otherEq = this.equations[otherIdx];

        // XOR eq with otherEq to eliminate pivot
        xorBuffers(eq.data, otherEq.data);
        for (const n of Array.from(otherEq.neighbors)) {
          if (eq.neighbors.has(n)) {
            eq.neighbors.delete(n);
          } else {
            eq.neighbors.add(n);
          }
        }
        progress = true;
      } else {
        pivotMap.set(minPivot, i);
      }
    }

    return progress;
  }

  /**
   * Assembles the final reconstructed byte array.
   * Throws if transfer is not complete.
   */
  public reconstructData(expectedTotalBytes?: number): Uint8Array {
    if (!this.isComplete()) {
      throw new Error(
        `Cannot reconstruct: only ${this.solvedCount}/${this.K} chunks solved.`
      );
    }

    const totalAllocated = this.K * this.chunkSize;
    const output = new Uint8Array(totalAllocated);

    for (let i = 0; i < this.K; i++) {
      const chunk = this.solved[i]!;
      output.set(chunk, i * this.chunkSize);
    }

    if (expectedTotalBytes !== undefined && expectedTotalBytes < totalAllocated) {
      return output.subarray(0, expectedTotalBytes);
    }

    return output;
  }
}
