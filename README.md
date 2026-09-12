# QRDrop — 100% Offline Optical Peer-to-Peer File Transfer

> **Transfer files between devices using only your screen and camera. No internet, Wi-Fi, Bluetooth, cables, or cloud servers required.**

[![Tests](https://img.shields.io/badge/Tests-14%20Passed-10b981.svg)]()
[![PWA](https://img.shields.io/badge/PWA-100%25%20Offline%20Ready-6366f1.svg)]()
[![License](https://img.shields.io/badge/License-MIT-blue.svg)]()

---

## 🌟 Concept

**QRDrop** treats high-density, rapidly changing QR codes as an optical data communication channel.
- **Sender**: Encrypts and encodes files into a stream of **Systematic Luby Transform (LT) Fountain Codes** displayed on screen.
- **Receiver**: Points camera at sender's screen, scans incoming frames, and mathematically reconstructs the original file bit-for-bit with SHA-256 validation.
- **100% Offline**: Works in Airplane Mode, isolated cleanrooms, submarines, and remote environments with zero network infrastructure.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (tested on Node.js v24.20.0)
- Any modern web browser with camera access (Chrome, Safari, Firefox, Edge)

### Installation & Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Open in browser
# http://localhost:3000
```

### Production Build & Run

```bash
# Build production bundle
npm run build

# Start production server
npm start
```

### Automated Testing

```bash
# Run unit & integration tests
npm test
```

---

## 🔑 Key Features

- **Systematic Luby Transform Fountain Codes**: Infinite rateless packet broadcast. Missing frames, glare, defocusing, and out-of-order frames do not disrupt the transfer.
- **22-Byte Compact Binary Protocol**: Low overhead with per-packet 32-bit CRC32 corruption validation.
- **Web Crypto AES-256-GCM**: Client-side encryption with PBKDF2 (100,000 iterations) for passcodes and 6-digit numeric pairing codes.
- **Multi-File Packaging**: Transfer arbitrary file formats (photos, videos, PDFs, ZIP archives, arbitrary binaries) in a single bundle.
- **Dual-Engine Optical Scanner**: Hardware-accelerated native `BarcodeDetector` with CPU-optimized `jsQR` fallback.
- **Adaptive Transmission Profiles**:
  - **Reliable**: 128B / 8 FPS — Ideal for older devices and poor lighting.
  - **Balanced**: 256B / 14 FPS — Recommended default.
  - **Fast**: 480B / 20 FPS — Maximum throughput for modern displays and cameras.
- **PWA & Offline First**: Full service worker caching with installable standalone app shell.
- **Zero Telemetry**: No tracking, no cookies, no third-party CDNs, no remote databases.

---

## 📚 Technical Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — System architecture, transport layers, and data pipelines.
- [PROTOCOL.md](./PROTOCOL.md) — 22-byte binary framing, packet types, and Robust Soliton fountain algorithms.
- [SECURITY.md](./SECURITY.md) — Web Crypto implementation, threat modeling, and key derivation.
- [PERFORMANCE.md](./PERFORMANCE.md) — Throughput benchmarks, camera frame rate optimization, and memory management.
