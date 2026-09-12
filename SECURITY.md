# QRDrop Security & Cryptography Specification

## Security Principles

QRDrop is designed from first principles for strict **air-gapped**, zero-trust optical data transmission:
1. **Zero External Servers**: No authentication servers, no signaling servers, no WebSockets, no WebRTC STUN/TURN, and no telemetry.
2. **Local-Only Web Crypto**: All cryptographic primitives execute in the client's browser using native, hardware-accelerated Web Crypto API implementations.
3. **No Unencrypted Plaintext Broadcasts**: Every transfer package is encrypted before chunking.
4. **Independent Verifiable Integrity**: Multi-layer checksums (CRC32 per packet and SHA-256 over entire bundles) protect against bit flips, packet injection, and frame corruptions.

---

## Cryptographic Primitives

### 1. Symmetric Encryption: AES-256-GCM
- **Algorithm**: AES-GCM (Galois/Counter Mode).
- **Key Length**: 256 bits (32 bytes).
- **Initialization Vector (IV)**: 96 bits (12 bytes) cryptographically random, generated per transfer session via `crypto.getRandomValues()`.
- **Authentication Tag**: 128 bits (16 bytes) verified automatically by GCM upon decryption.

### 2. Key Derivation: PBKDF2
When password or 6-digit pairing code protection is selected:
- **Pseudo-Random Function**: HMAC-SHA-256.
- **Iteration Count**: 100,000 iterations.
- **Salt**: 128 bits (16 bytes) generated per session via `crypto.getRandomValues()`.

### 3. File & Package Integrity: SHA-256
- Pre-encryption SHA-256 digest is computed across all raw file bytes and stored in the manifest.
- Post-decryption SHA-256 digest is computed by the receiver to confirm bit-for-bit accuracy.

---

## Threat Model & Optical Channel Security

| Threat | Mitigation |
|---|---|
| **Eavesdropping / Visual Shoulder Surfing** | AES-256-GCM encryption ensures anyone recording the QR stream cannot read file contents without the passcode / session key. |
| **Frame Corruption / Glare / Flare** | 32-bit CRC32 checksum discards bad frames before decoding. AES-GCM auth tag and SHA-256 guarantee uncorrupted output. |
| **Packet Injection / Unrelated Streams** | 32-bit Transfer ID in every packet ensures packets from another simultaneous transfer are ignored. |
| **Network Man-in-the-Middle (MitM)** | Non-existent; the application operates with Wi-Fi, Cellular, and Bluetooth disabled. |
