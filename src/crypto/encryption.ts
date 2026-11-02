import type { EncryptedVaultBundle, VaultItem } from '../types/vault';

const PBKDF2_ITERATIONS = 120_000;
const AES_KEY_LENGTH = 256;

// Convert ArrayBuffer / Uint8Array to Base64
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 to Uint8Array
export function base64ToBuffer(base64: string): Uint8Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// Generate cryptographically secure random bytes
export function generateRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

// Generate base64 salt (16 bytes)
export function generateSalt(length = 16): string {
  return bufferToBase64(generateRandomBytes(length));
}

// Derive AES-GCM 256-bit CryptoKey using PBKDF2 with SHA-256
export async function deriveKey(
  masterPassword: string,
  saltBase64: string,
  iterations = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveKey', 'deriveBits']
  );

  const salt = base64ToBuffer(saltBase64);

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

// Derive authentication hash to verify password without trial decryption
export async function deriveAuthHash(
  masterPassword: string,
  saltBase64: string
): Promise<string> {
  const enc = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(masterPassword),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // We add an "auth-verifier" domain separator to the salt
  const salt = base64ToBuffer(saltBase64);
  const authSalt = new Uint8Array(salt.length + 8);
  authSalt.set(salt);
  authSalt.set(enc.encode('AUTH-TAG'), salt.length);

  const derivedBits = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: authSalt as BufferSource,
      iterations: 20_000,
      hash: 'SHA-256',
    },
    passwordKey,
    256
  );

  return bufferToBase64(derivedBits);
}

// Encrypt vault items array to encrypted bundle
export async function encryptVault(
  items: VaultItem[],
  key: CryptoKey,
  saltBase64: string,
  authHash: string,
  hint?: string
): Promise<EncryptedVaultBundle> {
  const enc = new TextEncoder();
  const rawData = enc.encode(JSON.stringify(items));
  const iv = generateRandomBytes(12); // Standard 96-bit IV for AES-GCM

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    rawData
  );

  return {
    version: 1,
    salt: saltBase64,
    authHash,
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertextBuffer),
    hint,
    updatedAt: Date.now(),
  };
}

// Decrypt encrypted bundle back to vault items
export async function decryptVault(
  bundle: EncryptedVaultBundle,
  key: CryptoKey
): Promise<VaultItem[]> {
  const iv = base64ToBuffer(bundle.iv);
  const ciphertext = base64ToBuffer(bundle.ciphertext);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    ciphertext as BufferSource
  );

  const dec = new TextDecoder();
  const json = dec.decode(decryptedBuffer);
  return JSON.parse(json) as VaultItem[];
}

// Encrypt a single item for per-credential Firestore storage
export async function encryptSingleItem(
  item: VaultItem,
  key: CryptoKey
): Promise<{ iv: string; ciphertext: string }> {
  const enc = new TextEncoder();
  const rawData = enc.encode(JSON.stringify(item));
  const iv = generateRandomBytes(12);

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    rawData
  );

  return {
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(ciphertextBuffer),
  };
}

// Decrypt a single item from per-credential Firestore storage
export async function decryptSingleItem(
  ivBase64: string,
  ciphertextBase64: string,
  key: CryptoKey
): Promise<VaultItem> {
  const iv = base64ToBuffer(ivBase64);
  const ciphertext = base64ToBuffer(ciphertextBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
    },
    key,
    ciphertext as BufferSource
  );

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBuffer)) as VaultItem;
}
