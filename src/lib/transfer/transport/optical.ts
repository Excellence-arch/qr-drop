/**
 * QRDrop Optical Transport Abstraction Layer
 * 
 * Defines the generic OpticalTransport interface and provides QRTransport:
 * - High-speed Canvas rendering for transmitter with Frame Scheduler & Screen Wake Lock
 * - Dual-engine camera receiver (Hardware BarcodeDetector API + jsQR fallback)
 */

import QRCode from "qrcode";
import jsQR from "jsqr";
import { bytesToBinaryString, binaryStringToBytes } from "../protocol/binary";

export interface OpticalTransport {
  start(): Promise<void>;
  stop(): Promise<void>;
  sendFrame(packetBytes: Uint8Array): Promise<void>;
  onFrameReceived(callback: (packetBytes: Uint8Array) => void): void;
}

export interface QRTransportSenderConfig {
  canvas: HTMLCanvasElement;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  darkColor?: string;
  lightColor?: string;
}

export interface QRTransportReceiverConfig {
  video: HTMLVideoElement;
  onFrame: (packetBytes: Uint8Array) => void;
  targetScanFps?: number;
}

/**
 * Screen Wake Lock Manager
 */
export class WakeLockManager {
  private sentinel: any = null;

  public async acquire(): Promise<boolean> {
    if (typeof navigator !== "undefined" && "wakeLock" in navigator) {
      try {
        this.sentinel = await (navigator as any).wakeLock.request("screen");
        this.sentinel.addEventListener("release", () => {
          this.sentinel = null;
        });
        return true;
      } catch (err) {
        console.warn("Wake Lock not granted:", err);
      }
    }
    return false;
  }

  public release(): void {
    if (this.sentinel) {
      this.sentinel.release().catch(() => {});
      this.sentinel = null;
    }
  }
}

/**
 * QR Sender Optical Transport
 */
export class QRSenderTransport implements OpticalTransport {
  private canvas: HTMLCanvasElement;
  private errorCorrectionLevel: "L" | "M" | "Q" | "H";
  private darkColor: string;
  private lightColor: string;
  private wakeLock = new WakeLockManager();
  private isRunning = false;
  private currentFramePromise: Promise<void> | null = null;

  constructor(config: QRTransportSenderConfig) {
    this.canvas = config.canvas;
    this.errorCorrectionLevel = config.errorCorrectionLevel || "M";
    this.darkColor = config.darkColor || "#000000";
    this.lightColor = config.lightColor || "#ffffff";
  }

  public async start(): Promise<void> {
    this.isRunning = true;
    await this.wakeLock.acquire();
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    this.wakeLock.release();
  }

  public setErrorCorrectionLevel(ec: "L" | "M" | "Q" | "H"): void {
    this.errorCorrectionLevel = ec;
  }

  public async sendFrame(packetBytes: Uint8Array): Promise<void> {
    if (!this.isRunning || !this.canvas) return;

    // Convert raw binary bytes into QR byte segments or binary string
    // QRCode library in byte mode natively accepts Uint8Array or { data: Uint8Array, mode: 'byte' }
    const segments = [{ data: packetBytes, mode: "byte" as const }];

    try {
      await QRCode.toCanvas(this.canvas, segments as any, {
        errorCorrectionLevel: this.errorCorrectionLevel,
        margin: 2,
        color: {
          dark: this.darkColor,
          light: this.lightColor,
        },
      });
    } catch (err) {
      // Fallback with binary string if segments fail
      const binStr = bytesToBinaryString(packetBytes);
      await QRCode.toCanvas(this.canvas, binStr, {
        errorCorrectionLevel: this.errorCorrectionLevel,
        margin: 2,
        color: {
          dark: this.darkColor,
          light: this.lightColor,
        },
      });
    }
  }

  public onFrameReceived(): void {
    // Sender does not receive frames in simplex optical mode
  }
}

/**
 * QR Receiver Optical Transport with Dual Scan Engines (BarcodeDetector & jsQR)
 */
export class QRReceiverTransport implements OpticalTransport {
  private video: HTMLVideoElement;
  private onFrameCallback: ((packetBytes: Uint8Array) => void) | null = null;
  private isScanning = false;
  private animationFrameId: number | null = null;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D | null;
  private barcodeDetector: any = null;
  private targetScanIntervalMs: number;
  private lastScanTimestamp = 0;
  private lastDetectedText = "";
  private lastDetectedTimestamp = 0;

  constructor(config: QRTransportReceiverConfig) {
    this.video = config.video;
    this.onFrameCallback = config.onFrame;
    this.targetScanIntervalMs = 1000 / (config.targetScanFps || 30);

    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCtx = this.offscreenCanvas.getContext("2d", { willReadFrequently: true });

    // Initialize BarcodeDetector if available in browser
    if (typeof window !== "undefined" && "BarcodeDetector" in window) {
      try {
        this.barcodeDetector = new (window as any).BarcodeDetector({
          formats: ["qr_code"],
        });
      } catch (err) {
        console.warn("BarcodeDetector initialization failed, using jsQR:", err);
      }
    }
  }

  public async start(): Promise<void> {
    this.isScanning = true;
    this.lastDetectedText = "";
    this.lastDetectedTimestamp = 0;
    this.scanLoop();
  }

  public async stop(): Promise<void> {
    this.isScanning = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public async sendFrame(): Promise<void> {
    // Receiver is receive-only
  }

  public onFrameReceived(callback: (packetBytes: Uint8Array) => void): void {
    this.onFrameCallback = callback;
  }

  private scanLoop = async (): Promise<void> => {
    if (!this.isScanning) return;

    const now = performance.now();
    if (
      this.video.readyState === this.video.HAVE_ENOUGH_DATA &&
      now - this.lastScanTimestamp >= this.targetScanIntervalMs
    ) {
      this.lastScanTimestamp = now;
      await this.detectFrame();
    }

    this.animationFrameId = requestAnimationFrame(this.scanLoop);
  };

  private async detectFrame(): Promise<void> {
    const video = this.video;
    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;
    if (vWidth === 0 || vHeight === 0) return;

    // 1. Try Hardware-Accelerated BarcodeDetector
    if (this.barcodeDetector) {
      try {
        const barcodes = await this.barcodeDetector.detect(video);
        if (barcodes && barcodes.length > 0) {
          const raw = barcodes[0].rawValue;
          if (raw) {
            this.handleDetectedData(raw, barcodes[0].rawBytes);
            return;
          }
        }
      } catch {
        // Fallback to canvas + jsQR on detector error
      }
    }

    // 2. jsQR Engine Fallback (CPU optimized with moderate frame size)
    if (!this.offscreenCtx) return;

    // Scale canvas to max 640px dimension for optimal speed/accuracy trade-off
    const maxDim = 640;
    let targetW = vWidth;
    let targetH = vHeight;
    if (targetW > maxDim || targetH > maxDim) {
      if (targetW > targetH) {
        targetH = Math.round((targetH * maxDim) / targetW);
        targetW = maxDim;
      } else {
        targetW = Math.round((targetW * maxDim) / targetH);
        targetH = maxDim;
      }
    }

    if (this.offscreenCanvas.width !== targetW || this.offscreenCanvas.height !== targetH) {
      this.offscreenCanvas.width = targetW;
      this.offscreenCanvas.height = targetH;
    }

    this.offscreenCtx.drawImage(video, 0, 0, targetW, targetH);
    const imageData = this.offscreenCtx.getImageData(0, 0, targetW, targetH);
    const code = jsQR(imageData.data, targetW, targetH, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.binaryData) {
      const bytes = new Uint8Array(code.binaryData);
      this.handleDetectedBytes(bytes);
    } else if (code && code.data) {
      this.handleDetectedData(code.data);
    }
  }

  private handleDetectedData(strData: string, rawBytes?: Uint8Array): void {
    if (rawBytes && rawBytes.length > 0) {
      this.handleDetectedBytes(rawBytes);
      return;
    }
    const bytes = binaryStringToBytes(strData);
    this.handleDetectedBytes(bytes);
  }

  private handleDetectedBytes(bytes: Uint8Array): void {
    if (this.onFrameCallback) {
      this.onFrameCallback(bytes);
    }
  }
}
