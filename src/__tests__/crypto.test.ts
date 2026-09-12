import { describe, it, expect } from "vitest";
import {
  encryptData,
  decryptData,
  computeSHA256,
  generateEphemeralKey,
} from "../lib/transfer/crypto/webcrypto";

describe("QRDrop Web Crypto Subsystem", () => {
  it("computes SHA-256 hex digest correctly", async () => {
    const data = new TextEncoder().encode("Hello QRDrop!");
    const hash = await computeSHA256(data);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("encrypts and decrypts with password using PBKDF2 + AES-GCM", async () => {
    const message = "Confidential optical transfer data payload 1234567890";
    const plaintext = new TextEncoder().encode(message);
    const password = "SuperSecretPassword#2026";

    const encrypted = await encryptData(plaintext, { password });
    expect(encrypted.ciphertext.length).toBeGreaterThan(plaintext.length);
    expect(encrypted.saltHex).toBeDefined();
    expect(encrypted.ivHex).toBeDefined();

    const decrypted = await decryptData(encrypted.ciphertext, encrypted.ivHex, {
      password,
      saltHex: encrypted.saltHex,
    });

    const recovered = new TextDecoder().decode(decrypted);
    expect(recovered).toBe(message);
  });

  it("rejects decryption when incorrect password is provided", async () => {
    const plaintext = new TextEncoder().encode("Secret File");
    const encrypted = await encryptData(plaintext, { password: "RightPassword" });

    await expect(
      decryptData(encrypted.ciphertext, encrypted.ivHex, {
        password: "WrongPassword",
        saltHex: encrypted.saltHex,
      })
    ).rejects.toThrow();
  });

  it("encrypts and decrypts using ephemeral AES-GCM key", async () => {
    const plaintext = new TextEncoder().encode("Ephemeral file payload");
    const { key, rawKeyHex } = await generateEphemeralKey();

    const encrypted = await encryptData(plaintext, { ephemeralKey: key });
    const decrypted = await decryptData(encrypted.ciphertext, encrypted.ivHex, {
      ephemeralKeyHex: rawKeyHex,
    });

    const recovered = new TextDecoder().decode(decrypted);
    expect(recovered).toBe("Ephemeral file payload");
  });
});
