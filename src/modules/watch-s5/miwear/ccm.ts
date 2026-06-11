/**
 * AES-CCM（Web Crypto 不支持，这里手写）。
 * miwear 会话用 CCM：nonce 12 字节 → L=3，tag 4 字节（M=4），无 AAD。
 *
 * 用 AES-CTR 造出「单分组 AES 加密」原语：CTR(counter=B, 全0输入) = E(B)。
 * 以此实现 CBC-MAC（认证）+ CTR（加密），即 CCM。
 * 参考 NIST SP800-38C / RFC3610，与 BouncyCastle CCM(macSize=32) 对齐。
 */

const M = 4 // tag 字节
const NONCE_LEN = 12
const L = 15 - NONCE_LEN // = 3

function xor16(a: Uint8Array, b: Uint8Array): Uint8Array {
  const o = new Uint8Array(16)
  for (let i = 0; i < 16; i++) o[i] = a[i]! ^ b[i]!
  return o
}

async function importCtrKey(key: Uint8Array): Promise<CryptoKey> {
  const ab = new ArrayBuffer(key.length); new Uint8Array(ab).set(key)
  return crypto.subtle.importKey('raw', ab, { name: 'AES-CTR' }, false, ['encrypt'])
}

/** 单分组 AES 加密 E(block16)：CTR(counter=block, 输入全0) */
async function aesBlock(k: CryptoKey, block16: Uint8Array): Promise<Uint8Array> {
  const ctr = new ArrayBuffer(16); new Uint8Array(ctr).set(block16)
  const zeros = new ArrayBuffer(16)
  const out = await crypto.subtle.encrypt({ name: 'AES-CTR', counter: ctr, length: 128 }, k, zeros)
  return new Uint8Array(out)
}

function ctrBlock(nonce: Uint8Array, counter: number): Uint8Array {
  // A_i = flags(L-1) ‖ nonce(12) ‖ counter(L=3, big-endian)
  const a = new Uint8Array(16)
  a[0] = L - 1
  a.set(nonce, 1)
  a[13] = (counter >>> 16) & 0xff
  a[14] = (counter >>> 8) & 0xff
  a[15] = counter & 0xff
  return a
}

async function cbcMac(k: CryptoKey, nonce: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  // B0: flags = 8*((M-2)/2) + (L-1)  （Adata=0）
  const b0 = new Uint8Array(16)
  b0[0] = 8 * ((M - 2) / 2) + (L - 1)
  b0.set(nonce, 1)
  const len = data.length
  b0[13] = (len >>> 16) & 0xff
  b0[14] = (len >>> 8) & 0xff
  b0[15] = len & 0xff
  let x = await aesBlock(k, b0)
  // 无 AAD，直接处理消息块（零填充到 16）
  for (let off = 0; off < data.length; off += 16) {
    const block = new Uint8Array(16)
    block.set(data.subarray(off, Math.min(off + 16, data.length)))
    x = await aesBlock(k, xor16(x, block))
  }
  return x.slice(0, M)
}

async function ctrCrypt(k: CryptoKey, nonce: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  // 从 counter=1 开始的 keystream
  const out = new Uint8Array(data.length)
  for (let off = 0, i = 1; off < data.length; off += 16, i++) {
    const s = await aesBlock(k, ctrBlock(nonce, i))
    for (let j = 0; j < 16 && off + j < data.length; j++) out[off + j] = data[off + j]! ^ s[j]!
  }
  return out
}

/** 加密：返回 ciphertext ‖ encryptedTag(4) */
export async function ccmEncrypt(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  if (nonce.length !== NONCE_LEN) throw new Error('CCM nonce 必须 12 字节')
  const k = await importCtrKey(key)
  const tag = await cbcMac(k, nonce, plaintext)
  const s0 = await aesBlock(k, ctrBlock(nonce, 0))
  const encTag = new Uint8Array(M)
  for (let i = 0; i < M; i++) encTag[i] = tag[i]! ^ s0[i]!
  const ct = await ctrCrypt(k, nonce, plaintext)
  const out = new Uint8Array(ct.length + M)
  out.set(ct, 0); out.set(encTag, ct.length)
  return out
}

/** 解密：输入 ciphertext ‖ encryptedTag(4)，校验失败抛错 */
export async function ccmDecrypt(key: Uint8Array, nonce: Uint8Array, input: Uint8Array): Promise<Uint8Array> {
  if (nonce.length !== NONCE_LEN) throw new Error('CCM nonce 必须 12 字节')
  const k = await importCtrKey(key)
  const ct = input.subarray(0, input.length - M)
  const recvTag = input.subarray(input.length - M)
  const pt = await ctrCrypt(k, nonce, ct)
  const tag = await cbcMac(k, nonce, pt)
  const s0 = await aesBlock(k, ctrBlock(nonce, 0))
  for (let i = 0; i < M; i++) {
    if ((tag[i]! ^ s0[i]!) !== recvTag[i]!) throw new Error('CCM tag 校验失败')
  }
  return pt
}
