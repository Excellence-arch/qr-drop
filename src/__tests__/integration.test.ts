import { describe, it, expect } from "vitest";
import { TransferSender } from "../lib/transfer/sender";
import { TransferReceiver } from "../lib/transfer/receiver";
import { OpticalTransport } from "../lib/transfer/transport/optical";

// Virtual loopback optical transport with simulated camera noise and frame loss
class VirtualOpticalChannel implements OpticalTransport {
  public packetsTransmitted: Uint8Array[] = [];
  public lossRate: number;
  private onFrameCb: ((bytes: Uint8Array) => Promise<void> | void) | null = null;

  constructor(lossRate = 0.2) {
    this.lossRate = lossRate;
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async sendFrame(packetBytes: Uint8Array): Promise<void> {
    this.packetsTransmitted.push(new Uint8Array(packetBytes));

    // Simulate optical transmission loss / dropped camera frames
    if (Math.random() >= this.lossRate) {
      if (this.onFrameCb) {
        await this.onFrameCb(new Uint8Array(packetBytes));
      }
    }
  }

  onFrameReceived(callback: (packetBytes: Uint8Array) => Promise<void> | void): void {
    this.onFrameCb = callback;
  }
}

describe("QRDrop End-to-End Optical Transfer Integration", () => {
  it("transfers multiple files end-to-end with 20% optical loss and encryption", async () => {
    // 1. Prepare sample files
    const file1Content = new TextEncoder().encode("Important Document #1\nOffline optical transfer is working!");
    const file2Content = new Uint8Array(4096);
    for (let i = 0; i < file2Content.length; i++) file2Content[i] = (i * 31) & 0xff;

    const files = [
      {
        file: new Blob([file1Content], { type: "text/plain" }),
        name: "test-document.txt",
        type: "text/plain",
      },
      {
        file: new Blob([file2Content], { type: "application/octet-stream" }),
        name: "test-binary.dat",
        type: "application/octet-stream",
      },
    ];

    const password = "TestTransferPassword123";
    const channel = new VirtualOpticalChannel(0.2); // 20% simulated frame drop

    let receiverCompleted = false;
    let reconstructedFiles: any[] = [];

    const receiver = new TransferReceiver({
      password,
      onComplete: (filesReceived) => {
        receiverCompleted = true;
        reconstructedFiles = filesReceived;
      },
    });

    channel.onFrameReceived(async (bytes) => {
      await receiver.handleIncomingPacketBytes(bytes);
    });

    const sender = new TransferSender({
      files,
      mode: "reliable",
      password,
    });
    sender.setTransport(channel);

    await sender.prepare();

    // Stream frames until receiver finishes
    let frames = 0;
    while (!receiverCompleted && frames < 800) {
      await sender.sendNextFrame();
      frames++;
    }

    expect(receiverCompleted).toBe(true);
    expect(reconstructedFiles.length).toBe(2);

    // Verify File 1
    const file1Result = reconstructedFiles.find((f) => f.metadata.name === "test-document.txt");
    expect(file1Result).toBeDefined();
    expect(file1Result.verified).toBe(true);
    const text = await file1Result.blob.text();
    expect(text).toContain("Important Document #1");

    // Verify File 2
    const file2Result = reconstructedFiles.find((f) => f.metadata.name === "test-binary.dat");
    expect(file2Result).toBeDefined();
    expect(file2Result.verified).toBe(true);
    expect(file2Result.metadata.size).toBe(4096);
  });
});
