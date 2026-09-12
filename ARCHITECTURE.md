# QRDrop Architecture Documentation

## Overview

QRDrop is an offline, peer-to-peer file transfer system engineered for optical communication over an ad-hoc screen-to-camera channel.

```
┌─────────────────────────────────────────────────────────────┐
│                       SENDER DEVICE                         │
│                                                             │
│  [Arbitrary Files] ──> [Packer & Metadata Manifest]         │
│                              │                              │
│                              ▼                              │
│                     [SHA-256 Checksum]                      │
│                              │                              │
│                              ▼                              │
│                 [AES-256-GCM Encryption]                    │
│                              │                              │
│                              ▼                              │
│              [Fountain Encoder (Robust Soliton)]            │
│                              │                              │
│                              ▼                              │
│                [22-Byte Binary Frame Codec]                 │
│                              │                              │
│                              ▼                              │
│                   [QRSenderTransport]                       │
│                              │                              │
│                              ▼                              │
│                 [Display: Rapid QR Stream]                  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                      OPTICAL PHOTON STREAM
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                      RECEIVER DEVICE                        │
│                                                             │
│                  [Camera Video Stream]                      │
│                              │                              │
│                              ▼                              │
│             [Dual Scan Engine: BarcodeDetector / jsQR]      │
│                              │                              │
│                              ▼                              │
│                [CRC32 Frame Integrity Check]                │
│                              │                              │
│                              ▼                              │
│            [Fountain Decoder: Peeling + GF(2) Solver]       │
│                              │                              │
│                              ▼                              │
│                  [Reconstructed Encrypted]                  │
│                              │                              │
│                              ▼                              │
│                 [AES-256-GCM Decryption]                    │
│                              │                              │
│                              ▼                              │
│                  [SHA-256 Hash Validation]                  │
│                              │                              │
│                              ▼                              │
│                    [Blob Unpacker & Save]                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Transport Layer (`src/lib/transfer/transport/`)
The communication channel is decoupled behind the `OpticalTransport` interface:
- **`OpticalTransport`**: Interface requiring `start()`, `stop()`, `sendFrame()`, and `onFrameReceived()`.
- **`QRSenderTransport`**: Manages pixel-aligned double-buffered canvas rendering with error correction tuning and Screen Wake Lock API integration.
- **`QRReceiverTransport`**: Continuous camera stream analyzer leveraging hardware-accelerated `BarcodeDetector` when available, falling back to an optimized `jsQR` engine.

### 2. Erasure & Fountain Coding (`src/lib/transfer/erasure/`)
- **Systematic Luby Transform (LT) Codes**:
  - Systematic phase ($0 \le \text{seq} < K$): Sends raw source chunks with 0% overhead.
  - Fountain phase ($\text{seq} \ge K$): Sends XOR parity equations generated via the **Robust Soliton Distribution**.
  - **Peeling & Gaussian Elimination Decoder**: Solves chunks incrementally using linear belief propagation and GF(2) reduction.

### 3. Binary Protocol Codec (`src/lib/transfer/protocol/`)
Compact 22-byte binary framing:
- Magic: `0x5152` ('QR')
- Version: `0x01`
- Packet Type: MANIFEST (`0x01`), SYSTEMATIC_CHUNK (`0x02`), FOUNTAIN_PARITY (`0x03`)
- Transfer ID: 32-bit integer (`T-XXXXXXXX`)
- Checksum: 32-bit CRC32

### 4. Cryptographic Subsystem (`src/lib/transfer/crypto/`)
Built exclusively with the native browser **Web Crypto API**:
- **AES-256-GCM**: Authenticated encryption.
- **PBKDF2**: 100,000 iterations of SHA-256 with 128-bit salt for passphrase and 6-digit pairing code protection.
- **SHA-256**: Calculated pre-encryption and post-decryption for tamper verification.

### 5. Local State & Offline Caching (`src/lib/storage/` & `public/sw.js`)
- **IndexedDB**: Persistent local storage for transfer history and downloaded file blobs.
- **Service Worker (`sw.js`)**: Cache-First offline caching strategy enabling installation and standalone offline execution.
