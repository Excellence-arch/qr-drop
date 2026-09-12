# QRDrop Optical Binary Protocol Specification (v1.0)

## 1. Frame Layout & Header Format

Every optical QR code transmits an unpadded binary frame prefixed with a fixed 22-byte header:

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|       MAGIC (0x5152)          |  VERSION (0x01)| TYPE (0x01-04)|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       TRANSFER_ID (32-bit)                    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                      SEQUENCE / SEED (32-bit)                 |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|     CHUNK_INDEX / DEGREE      |        TOTAL_CHUNKS (K)       |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|         PAYLOAD_LENGTH        |        CRC32 (High 16-bits)   |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|      CRC32 (Low 16-bits)      |       PAYLOAD BYTES...        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+                               +
|                              ...                              |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

### Field Definitions

| Byte Offset | Field Name | Type | Description |
|---|---|---|---|
| `[0..1]` | `MAGIC` | `uint16` (Big-Endian) | Fixed magic bytes `0x51 0x52` (ASCII `'QR'`). |
| `[2]` | `VERSION` | `uint8` | Protocol version (`0x01`). |
| `[3]` | `PACKET_TYPE` | `uint8` | `0x01`: MANIFEST, `0x02`: SYSTEMATIC, `0x03`: FOUNTAIN_PARITY. |
| `[4..7]` | `TRANSFER_ID` | `uint32` (Big-Endian) | Unique 32-bit transfer session identifier. |
| `[8..11]` | `SEQUENCE` | `uint32` (Big-Endian) | Frame sequence number / PRNG seed for Soliton neighbors. |
| `[12..13]` | `CHUNK_INDEX` | `uint16` (Big-Endian) | Source chunk index ($0 \le i < K$) or parity degree $d$. |
| `[14..15]` | `TOTAL_CHUNKS` | `uint16` (Big-Endian) | Total number of source chunks $K$. |
| `[16..17]` | `PAYLOAD_LENGTH` | `uint16` (Big-Endian) | Length of the subsequent payload in bytes. |
| `[18..21]` | `CRC32` | `uint32` (Big-Endian) | IEEE 802.3 32-bit CRC checksum over header fields + payload. |
| `[22..N]` | `PAYLOAD` | `byte[]` | Raw payload bytes (Manifest JSON or XOR chunk data). |

---

## 2. Luby Transform Fountain Coding

### Robust Soliton Distribution
For a file partitioned into $K$ source blocks, fountain parity frames select degree $d \in [1, K]$ sampled from the Robust Soliton Distribution:

$$\mu(d) = \frac{\rho(d) + \tau(d)}{\beta}$$

Where:
- **Ideal Soliton $\rho(d)$**:
  $$\rho(1) = \frac{1}{K}, \quad \rho(d) = \frac{1}{d(d - 1)} \quad (2 \le d \le K)$$
- **Robust Component $\tau(d)$**:
  $$R = c \ln(K / \delta) \sqrt{K}$$
  $$\tau(d) = \begin{cases} \frac{R}{d \cdot K} & \text{for } 1 \le d < \lfloor K/R \rfloor \\ \frac{R \ln(R/\delta)}{K} & \text{for } d = \lfloor K/R \rfloor \\ 0 & \text{for } d > \lfloor K/R \rfloor \end{cases}$$
- **Normalization Factor $\beta$**:
  $$\beta = \sum_{d=1}^K (\rho(d) + \tau(d))$$

### Deterministic PRNG
Neighbor selection is calculated deterministically on both transmitter and receiver using **XorShift32** seeded by $\text{sequence} + \text{0x9E3779B9}$.

---

## 3. Peeling & Gaussian Elimination Decoder

1. **Substitution**: When a frame is received, all already-solved chunks are XORed out of the packet payload.
2. **Degree-1 Resolution**: If the residual degree is 1, the chunk is instantly resolved and propagated across all pending equations.
3. **GF(2) Gauss-Jordan Elimination**: Stored multi-degree equations are reduced over GF(2) using fast bitwise vector operations, guaranteeing 100% mathematical solvability as soon as $K$ linearly independent frames arrive.
