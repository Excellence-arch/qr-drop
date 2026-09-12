/**
 * QRDrop Cryptographic Subsystem
 * 
 * Uses standard Web Crypto API:
 * - AES-GCM (256-bit key, 96-bit random IV, 128-bit authentication tag)
 * - PBKDF2 with SHA-256 (100,000 iterations, 128-bit random salt)
 * - SHA-256 integrity verification
 */

export interface EncryptedPayload {
  ciphertext: Uint8Array;
  ivHex: string;
  saltHex?: string;
}

export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export function hexToBuffer(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, "");
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Computes SHA-256 hash of arbitrary byte buffer.
 * Returns hexadecimal digest string.
 */
export async function computeSHA256(data: Uint8Array): Promise<string> {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : (globalThis.crypto as Crypto);
  const hashBuffer = await cryptoObj.subtle.digest("SHA-256", data as any);
  return bufferToHex(hashBuffer);
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from a user password or pairing code.
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array,
  iterations = 100000
): Promise<CryptoKey> {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : (globalThis.crypto as Crypto);
  const enc = new TextEncoder();
  const passwordKey = await cryptoObj.subtle.importKey(
    "raw",
    enc.encode(password) as any,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return cryptoObj.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: iterations,
      hash: "SHA-256",
    },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Generates an ephemeral 256-bit AES-GCM key for transfers without user password.
 */
export async function generateEphemeralKey(): Promise<{
  key: CryptoKey;
  rawKeyHex: string;
}> {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : (globalThis.crypto as Crypto);
  const key = await cryptoObj.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  const exported = await cryptoObj.subtle.exportKey("raw", key);
  return {
    key,
    rawKeyHex: bufferToHex(exported),
  };
}

/**
 * Imports an ephemeral AES-GCM key from hex string.
 */
export async function importEphemeralKey(rawKeyHex: string): Promise<CryptoKey> {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : (globalThis.crypto as Crypto);
  const raw = hexToBuffer(rawKeyHex);
  return cryptoObj.subtle.importKey(
    "raw",
    raw as any,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Encrypts data using AES-GCM.
 */
export async function encryptData(
  plaintext: Uint8Array,
  options: {
    password?: string;
    pairingCode?: string;
    ephemeralKey?: CryptoKey;
  }
): Promise<EncryptedPayload> {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : (globalThis.crypto as Crypto);

  // Generate 12-byte random IV
  const iv = new Uint8Array(12);
  cryptoObj.getRandomValues(iv);

  let key: CryptoKey;
  let saltHex: string | undefined;

  if (options.password || options.pairingCode) {
    const secret = (options.password || "") + (options.pairingCode ? `:${options.pairingCode}` : "");
    const salt = new Uint8Array(16);
    cryptoObj.getRandomValues(salt);
    saltHex = bufferToHex(salt);
    key = await deriveKeyFromPassword(secret, salt);
  } else if (options.ephemeralKey) {
    key = options.ephemeralKey;
  } else {
    // Generate default random key
    const generated = await generateEphemeralKey();
    key = generated.key;
  }

  const encryptedBuffer = await cryptoObj.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv as any,
    },
    key,
    plaintext as any
  );

  return {
    ciphertext: new Uint8Array(encryptedBuffer),
    ivHex: bufferToHex(iv),
    saltHex,
  };
}

/**
 * Decrypts data using AES-GCM.
 */
export async function decryptData(
  ciphertext: Uint8Array,
  ivHex: string,
  options: {
    password?: string;
    pairingCode?: string;
    saltHex?: string;
    ephemeralKey?: CryptoKey;
    ephemeralKeyHex?: string;
  }
): Promise<Uint8Array> {
  const cryptoObj = typeof window !== "undefined" ? window.crypto : (globalThis.crypto as Crypto);
  const iv = hexToBuffer(ivHex);

  let key: CryptoKey;

  if (options.password || options.pairingCode) {
    if (!options.saltHex) {
      throw new Error("Missing PBKDF2 salt for password decryption.");
    }
    const secret = (options.password || "") + (options.pairingCode ? `:${options.pairingCode}` : "");
    const salt = hexToBuffer(options.saltHex);
    key = await deriveKeyFromPassword(secret, salt);
  } else if (options.ephemeralKey) {
    key = options.ephemeralKey;
  } else if (options.ephemeralKeyHex) {
    key = await importEphemeralKey(options.ephemeralKeyHex);
  } else {
    throw new Error("No decryption key or password provided.");
  }

  try {
    const decryptedBuffer = await cryptoObj.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv as any,
      },
      key,
      ciphertext as any
    );
    return new Uint8Array(decryptedBuffer);
  } catch {
    throw new Error("Decryption failed: Incorrect password or corrupted data.");
  }
}
