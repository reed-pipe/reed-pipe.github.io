/**
 * miwear 认证/会话加密核心（Xiaomi Watch S5 等）
 *
 * 移植自「表盘自定义工具」原生 com.givemefive.ble.xiaomi.i（= Gadgetbridge XiaomiAuthService）。
 * 全部用浏览器原生 Web Crypto 实现，无第三方依赖。
 *
 * 认证流程：
 *   1. 手机生成 16 字节随机 phoneNonce，发 PhoneNonce(Command type=1,subtype=26)
 *   2. 手表回 WatchNonce { nonce, hmac }
 *   3. deriveSessionKeys(deviceKey, phoneNonce, watchNonce)：
 *        HKDF-SHA256(IKM=deviceKey, salt=phoneNonce‖watchNonce, info="miwear-auth", L=64)
 *        → decKey[0:16] encKey[16:32] decNonce[32:36] encNonce[36:40]
 *   4. 校验 watchNonce.hmac == HMAC(decKey, watchNonce‖phoneNonce)
 *   5. 发 AuthStep3 { encryptedNonces=HMAC(encKey, phoneNonce‖watchNonce),
 *                     encryptedDeviceInfo=AES-CTR(AuthDeviceInfo) }  (type=1,subtype=27)
 */

export function hexToBytes(hex: string): Uint8Array {
  const h = hex.trim().replace(/^0x/i, '')
  const out = new Uint8Array(h.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16)
  return out
}

export function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

export function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(len)
  let o = 0
  for (const a of arrs) { out.set(a, o); o += a.length }
  return out
}

export function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n)
  crypto.getRandomValues(b)
  return b
}

export interface SessionKeys {
  decryptionKey: Uint8Array   // 16
  encryptionKey: Uint8Array   // 16
  decryptionNonce: Uint8Array // 4
  encryptionNonce: Uint8Array // 4
}

const utf8 = (s: string) => new TextEncoder().encode(s)

/** 拷贝为独立 ArrayBuffer，满足 Web Crypto 的 BufferSource 类型（TS5.9 泛型兼容） */
function toAB(u: Uint8Array): ArrayBuffer {
  const ab = new ArrayBuffer(u.length)
  new Uint8Array(ab).set(u)
  return ab
}

/** HKDF-SHA256，与 i.java 的自实现等价（标准 RFC5869） */
export async function deriveSessionKeys(
  deviceKey: Uint8Array,
  phoneNonce: Uint8Array,
  watchNonce: Uint8Array,
): Promise<SessionKeys> {
  const ikm = await crypto.subtle.importKey('raw', toAB(deviceKey), 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: toAB(concat(phoneNonce, watchNonce)), info: toAB(utf8('miwear-auth')) },
    ikm,
    64 * 8,
  )
  const out = new Uint8Array(bits)
  return {
    decryptionKey: out.slice(0, 16),
    encryptionKey: out.slice(16, 32),
    decryptionNonce: out.slice(32, 36),
    encryptionNonce: out.slice(36, 40),
  }
}

export async function hmacSha256(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', toAB(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, toAB(msg)))
}

export async function verifyWatchHmac(
  keys: SessionKeys,
  phoneNonce: Uint8Array,
  watchNonce: Uint8Array,
  watchHmac: Uint8Array,
): Promise<boolean> {
  const expect = await hmacSha256(keys.decryptionKey, concat(watchNonce, phoneNonce))
  if (expect.length !== watchHmac.length) return false
  let diff = 0
  for (let i = 0; i < expect.length; i++) diff |= expect[i]! ^ watchHmac[i]!
  return diff === 0
}

/**
 * AES-CTR 加/解密（控制通道）。
 * IV = encryptionNonce(4) ‖ packetCounter? —— 具体 IV 构造在 P1 联调时按 i.java 的 o()/q() 对齐。
 * 这里提供基础原语。
 */
export async function aesCtr(key: Uint8Array, iv16: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', toAB(key), { name: 'AES-CTR' }, false, ['encrypt', 'decrypt'])
  // AES-CTR 加解密同一操作
  const res = await crypto.subtle.encrypt({ name: 'AES-CTR', counter: toAB(iv16), length: 64 }, k, toAB(data))
  return new Uint8Array(res)
}

/** encryptedNonces = HMAC(encryptionKey, phoneNonce ‖ watchNonce) */
export async function buildEncryptedNonces(
  keys: SessionKeys,
  phoneNonce: Uint8Array,
  watchNonce: Uint8Array,
): Promise<Uint8Array> {
  return hmacSha256(keys.encryptionKey, concat(phoneNonce, watchNonce))
}
