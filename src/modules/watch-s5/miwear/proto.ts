/**
 * miwear protobuf 最小编解码（手写，按 XiaomiProto 确切字段号）。
 * 只覆盖认证 + 文件上传 + 表盘安装所需的消息，避免引入完整 protobufjs。
 *
 * 字段号来自 jadx 的 XiaomiProto：
 *   Command:  type=1, subtype=2, auth=3, watchface=6, dataUpload=24, status=100
 *   Auth:     phoneNonce=30, watchNonce=31, authStep3=32, authStep4=33
 *   PhoneNonce/WatchNonce: nonce=1, (WatchNonce.hmac=2)
 *   AuthStep3: encryptedNonces=1, encryptedDeviceInfo=2
 *   DataUpload: dataUploadRequest=1, dataUploadAck=2
 *   DataUploadRequest: type=1, md5Sum=2, size=3
 *   DataUploadAck: md5Sum=1, resumePosition=4, chunkSize=5
 *   Watchface: watchfaceList=1, watchfaceId=2, installStatus=5,
 *              watchfaceInstallStart=6, watchfaceInstallFinish=7
 */

// ---------- 低层 wire ----------
class Writer {
  private parts: number[] = []
  varint(v: number) {
    let n = v >>> 0
    if (v < 0) n = v // 不处理负
    while (n > 0x7f) { this.parts.push((n & 0x7f) | 0x80); n >>>= 7 }
    this.parts.push(n)
    return this
  }
  private tag(field: number, wire: number) { return this.varint((field << 3) | wire) }
  uint(field: number, v: number) { this.tag(field, 0); return this.varint(v) }
  bytes(field: number, b: Uint8Array) {
    this.tag(field, 2); this.varint(b.length)
    for (let i = 0; i < b.length; i++) this.parts.push(b[i]!)
    return this
  }
  msg(field: number, b: Uint8Array) { return this.bytes(field, b) }
  finish(): Uint8Array { return new Uint8Array(this.parts) }
}

interface Field { field: number; wire: number; value: number | Uint8Array }

function parse(buf: Uint8Array): Map<number, Field[]> {
  const out = new Map<number, Field[]>()
  let p = 0
  const rvarint = () => {
    let shift = 0, result = 0
    for (;;) {
      const b = buf[p++]!
      result |= (b & 0x7f) << shift
      if (!(b & 0x80)) break
      shift += 7
    }
    return result >>> 0
  }
  while (p < buf.length) {
    const key = rvarint()
    const field = key >>> 3
    const wire = key & 7
    let value: number | Uint8Array
    if (wire === 0) value = rvarint()
    else if (wire === 2) { const len = rvarint(); value = buf.slice(p, p + len); p += len }
    else if (wire === 5) { value = buf.slice(p, p + 4); p += 4 }
    else if (wire === 1) { value = buf.slice(p, p + 8); p += 8 }
    else throw new Error('unsupported wire type ' + wire)
    if (!out.has(field)) out.set(field, [])
    out.get(field)!.push({ field, wire, value })
  }
  return out
}

const getBytes = (m: Map<number, Field[]>, f: number): Uint8Array | undefined => {
  const v = m.get(f)?.[0]?.value
  return v instanceof Uint8Array ? v : undefined
}
const getUint = (m: Map<number, Field[]>, f: number): number | undefined => {
  const v = m.get(f)?.[0]?.value
  return typeof v === 'number' ? v : undefined
}

// ---------- 消息构造 ----------

/** PhoneNonce 认证第一步：Command{type=1,subtype=26,auth{phoneNonce{nonce}}} */
export function buildPhoneNonceCommand(phoneNonce: Uint8Array): Uint8Array {
  const phoneNonceMsg = new Writer().bytes(1, phoneNonce).finish()
  const auth = new Writer().msg(30, phoneNonceMsg).finish()
  return new Writer().uint(1, 1).uint(2, 26).msg(3, auth).finish()
}

/** AuthStep3：Command{type=1,subtype=27,auth{authStep3{encNonces,encDevInfo}}} */
export function buildAuthStep3Command(encryptedNonces: Uint8Array, encryptedDeviceInfo: Uint8Array): Uint8Array {
  const step3 = new Writer().bytes(1, encryptedNonces).bytes(2, encryptedDeviceInfo).finish()
  const auth = new Writer().msg(32, step3).finish()
  return new Writer().uint(1, 1).uint(2, 27).msg(3, auth).finish()
}

/** AuthDeviceInfo（明文，随后 AES-CTR 加密）：unknown1=0,phoneApiLevel,phoneName,unknown3=224,region
 *  字段号按 i.java t()：setUnknown1(0),setPhoneApiLevel,setPhoneName,setUnknown3(224),setRegion
 *  对应 AuthDeviceInfo 字段（推断 1..5；联调时若不符再调） */
export function buildAuthDeviceInfo(apiLevel: number, phoneName: string, region: string): Uint8Array {
  const enc = new TextEncoder()
  return new Writer()
    .uint(1, 0)
    .uint(2, apiLevel)
    .bytes(3, enc.encode(phoneName))
    .uint(4, 224)
    .bytes(5, enc.encode(region))
    .finish()
}

export interface ParsedCommand {
  type?: number
  subtype?: number
  auth?: Map<number, Field[]>
  watchface?: Map<number, Field[]>
  dataUpload?: Map<number, Field[]>
  status?: number
}

export function parseCommand(buf: Uint8Array): ParsedCommand {
  const m = parse(buf)
  const sub = (f: number) => { const b = getBytes(m, f); return b ? parse(b) : undefined }
  return {
    type: getUint(m, 1),
    subtype: getUint(m, 2),
    auth: sub(3),
    watchface: sub(6),
    dataUpload: sub(24),
    status: getUint(m, 100),
  }
}

export interface WatchNonce { nonce: Uint8Array; hmac: Uint8Array }
export function parseWatchNonce(auth: Map<number, Field[]>): WatchNonce | null {
  const wn = getBytes(auth, 31)
  if (!wn) return null
  const m = parse(wn)
  const nonce = getBytes(m, 1), hmac = getBytes(m, 2)
  if (!nonce || !hmac) return null
  return { nonce, hmac }
}

// ---------- DataUpload ----------
/** DataUploadRequest：Command{type,subtype, dataUpload{ dataUploadRequest{type,md5Sum,size} }} */
export function buildDataUploadRequest(
  cmdType: number, cmdSubtype: number, uploadType: number, md5: Uint8Array, size: number,
): Uint8Array {
  const req = new Writer().uint(1, uploadType).bytes(2, md5).uint(3, size).finish()
  const du = new Writer().msg(1, req).finish()
  return new Writer().uint(1, cmdType).uint(2, cmdSubtype).msg(24, du).finish()
}

export interface DataUploadAck { resumePosition: number; chunkSize: number }
export function parseDataUploadAck(dataUpload: Map<number, Field[]>): DataUploadAck | null {
  const ack = getBytes(dataUpload, 2)
  if (!ack) return null
  const m = parse(ack)
  return { resumePosition: getUint(m, 4) ?? 0, chunkSize: getUint(m, 5) ?? 2048 }
}

export { Writer as ProtoWriter, parse as protoParse }
