const VERIFY_PLAINTEXT = 'PA_VERIFY'
const PBKDF2_ITERATIONS = 100_000

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(hex.length / 2)
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function generateSalt(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)))
}

export async function deriveKey(
  password: string,
  saltHex: string,
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function encrypt(
  plaintext: string,
  key: CryptoKey,
): Promise<{ iv: string; ciphertext: string }> {
  const enc = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext),
  )
  return {
    iv: bytesToHex(iv),
    ciphertext: bytesToHex(new Uint8Array(encrypted)),
  }
}

export async function decrypt(
  ciphertextHex: string,
  ivHex: string,
  key: CryptoKey,
): Promise<string> {
  const dec = new TextDecoder()
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(ivHex) },
    key,
    hexToBytes(ciphertextHex),
  )
  return dec.decode(decrypted)
}

export async function exportKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key)
  return bytesToHex(new Uint8Array(raw))
}

export async function importKey(keyHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    hexToBytes(keyHex),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

export async function createVerifier(
  key: CryptoKey,
): Promise<string> {
  const { iv, ciphertext } = await encrypt(VERIFY_PLAINTEXT, key)
  return `${iv}:${ciphertext}`
}

export async function checkVerifier(
  verifier: string,
  key: CryptoKey,
): Promise<boolean> {
  try {
    const parts = verifier.split(':')
    const result = await decrypt(parts[1]!, parts[0]!, key)
    return result === VERIFY_PLAINTEXT
  } catch {
    return false
  }
}
