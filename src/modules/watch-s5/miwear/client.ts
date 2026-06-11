/**
 * miwear 客户端（Xiaomi Watch S5 等）—— Web Bluetooth。
 * v1：连接 + 枚举服务/特征 + 订阅通知 + 认证握手 + （认证后）推送 .face。
 *
 * ⚠️ 这是逆向得来的加密分包 BLE 协议，本文件按 SPEC.md 实现，但服务UUID/通道配对/
 *    CCM 等细节需真机联调。故内置详细日志（onLog），首测即可定位问题。
 */
import { deriveSessionKeys, hmacSha256, bytesToHex, concat, randomBytes, type SessionKeys } from './crypto'
import { ccmEncrypt, ccmDecrypt } from './ccm'
import * as proto from './proto'

// Gadgetbridge Xiaomi(加密 BLE) 服务与特征
const SERVICE = '0000fdab-0000-1000-8000-00805f9b34fb'
const CHAR_READ = '00000051-0000-1000-8000-00805f9b34fb'   // 通知（接收）
const CHAR_WRITE = '00000052-0000-1000-8000-00805f9b34fb'  // 写命令

type LogFn = (line: string) => void

export class MiwearClient {
  private device: BluetoothDevice | null = null
  private write: BluetoothRemoteGATTCharacteristic | null = null
  private keys: SessionKeys | null = null
  private encrypted = false
  private sendSeq = 0
  private deviceKey: Uint8Array
  private phoneNonce: Uint8Array = new Uint8Array(16)
  private log: LogFn
  // 接收重组缓冲（按特征）
  private rx: { total: number; got: number; buf: number[] } = { total: 0, got: 0, buf: [] }
  private onCommand: ((c: proto.ParsedCommand) => void) | null = null

  constructor(deviceKeyHex: string, log: LogFn) {
    const h = deviceKeyHex.trim().replace(/^0x/i, '')
    const k = new Uint8Array(h.length / 2)
    for (let i = 0; i < k.length; i++) k[i] = parseInt(h.substr(i * 2, 2), 16)
    this.deviceKey = k
    this.log = log
  }

  async connect(): Promise<void> {
    if (!navigator.bluetooth) throw new Error('浏览器不支持 Web Bluetooth（用安卓 Chrome / 桌面 Chrome）')
    this.log('请求设备…（在弹框选择你的 Watch S5）')
    this.device = await navigator.bluetooth.requestDevice({
      // 手表广播名未知，先放开选择 + 声明候选服务
      acceptAllDevices: true,
      optionalServices: [SERVICE, '0000fe95-0000-1000-8000-00805f9b34fb'],
    })
    this.log('已选择：' + (this.device.name || this.device.id))
    const gatt = await this.device.gatt!.connect()
    this.log('GATT 已连接，枚举服务…')

    // 枚举并打印所有服务/特征（关键调试信息）
    let svc: BluetoothRemoteGATTService | null = null
    try {
      const services = await gatt.getPrimaryServices()
      for (const s of services) {
        this.log('· service ' + s.uuid)
        if (s.uuid.toLowerCase() === SERVICE) svc = s
        try {
          const chs = await s.getCharacteristics()
          for (const c of chs) this.log('    char ' + c.uuid)
        } catch { /* ignore */ }
      }
    } catch (e) {
      this.log('枚举服务失败（多半是该服务不在 optionalServices 白名单）：' + (e as Error).message)
    }
    if (!svc) {
      this.log('⚠️ 未找到服务 ' + SERVICE + '。若上面列出了别的服务 UUID，请把它发我，我改 optionalServices。')
      throw new Error('未找到 miwear 服务（需按真机实际服务 UUID 调整）')
    }
    this.write = await svc.getCharacteristic(CHAR_WRITE)
    const read = await svc.getCharacteristic(CHAR_READ)
    await read.startNotifications()
    read.addEventListener('characteristicvaluechanged', (ev) => {
      const dv = (ev.target as BluetoothRemoteGATTCharacteristic).value
      if (dv) this.onChunk(new Uint8Array(dv.buffer))
    })
    this.log('已订阅通知（0051）。开始认证…')
  }

  /** 分包接收（对齐 k.java b()）：[seq:int16 LE][payload]；seq=0 为控制包 */
  private onChunk(data: Uint8Array): void {
    this.log('← ' + bytesToHex(data))
    if (data.length < 2) return
    const seq = data[0]! | (data[1]! << 8)
    if (seq !== 0) {
      for (let i = 2; i < data.length; i++) this.rx.buf.push(data[i]!)
      this.rx.got++
      if (seq === this.rx.total) this.finishRx()
      return
    }
    // 控制包
    const ctrl = data[2]
    if (ctrl === 0) {
      const numChunks = data[5]! | (data[6]! << 8)
      this.rx = { total: numChunks, got: 0, buf: [] }
      this.log(`  ↳ 分块开始, ${numChunks} 块`)
    } else if (ctrl === 2) {
      // 单包：[00 00][02][encFlag][payload]
      const enc = data[3] === 1
      const payload = data.subarray(4)
      void this.deliver(payload, enc)
    }
  }

  private async finishRx(): Promise<void> {
    const payload = new Uint8Array(this.rx.buf)
    await this.deliver(payload, this.encrypted)
    this.rx = { total: 0, got: 0, buf: [] }
  }

  private async deliver(payload: Uint8Array, enc: boolean): Promise<void> {
    try {
      let bytes = payload
      if (enc && this.keys) {
        const nonce = concat(this.keys.decryptionNonce, new Uint8Array(8)) // decNonce(4)‖0‖0
        bytes = await ccmDecrypt(this.keys.decryptionKey, nonce, payload)
      }
      const cmd = proto.parseCommand(bytes)
      this.log(`  ↳ Command type=${cmd.type} subtype=${cmd.subtype}`)
      this.onCommand?.(cmd)
    } catch (e) {
      this.log('  ↳ 解析失败：' + (e as Error).message)
    }
  }

  /** 发送一个原始命令字节（单包优先）。encrypt=会话加密 */
  private async send(payload: Uint8Array, encrypt: boolean): Promise<void> {
    if (!this.write) throw new Error('未连接')
    let body = payload
    if (encrypt && this.keys) {
      const seq = this.sendSeq++
      const nonce = concat(this.keys.encryptionNonce, new Uint8Array([0, 0, 0, 0, seq & 0xff, (seq >> 8) & 0xff, 0, 0]))
      body = await ccmEncrypt(this.keys.encryptionKey, nonce, payload)
    }
    // 单包：[00 00][02][encFlag][body]
    const pkt = new Uint8Array(4 + body.length)
    pkt[0] = 0; pkt[1] = 0; pkt[2] = 2; pkt[3] = encrypt ? 1 : 0
    pkt.set(body, 4)
    this.log('→ ' + bytesToHex(pkt))
    await this.write.writeValueWithResponse(pkt.buffer as ArrayBuffer)
  }

  /** 认证握手 */
  async authenticate(timeoutMs = 15000): Promise<void> {
    this.phoneNonce = randomBytes(16)
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { this.onCommand = null; reject(new Error('认证超时（手表无响应/框架不符）')) }, timeoutMs)
      this.onCommand = async (cmd) => {
        try {
          if (cmd.type === 1 && cmd.subtype === 26 && cmd.auth) {
            const wn = proto.parseWatchNonce(cmd.auth)
            if (!wn) { this.log('收到 auth 但无 WatchNonce'); return }
            this.log('收到 WatchNonce，派生会话密钥…')
            this.keys = await deriveSessionKeys(this.deviceKey, this.phoneNonce, wn.nonce)
            this.log('decKey=' + bytesToHex(this.keys.decryptionKey) + ' encKey=' + bytesToHex(this.keys.encryptionKey))
            // 校验 watch hmac
            const expect = await hmacSha256(this.keys.decryptionKey, concat(wn.nonce, this.phoneNonce))
            if (bytesToHex(expect) !== bytesToHex(wn.hmac)) this.log('⚠️ watch hmac 不匹配（密钥可能不对）')
            // AuthStep3
            const encNonces = await hmacSha256(this.keys.encryptionKey, concat(this.phoneNonce, wn.nonce))
            const devInfo = proto.buildAuthDeviceInfo(33, 'Web', 'CN')
            const ccmNonce = concat(this.keys.encryptionNonce, new Uint8Array(8))
            const encDevInfo = await ccmEncrypt(this.keys.encryptionKey, ccmNonce, devInfo)
            await this.send(proto.buildAuthStep3Command(encNonces, encDevInfo), false)
            this.log('已发 AuthStep3，等待确认…')
          } else if (cmd.type === 1 && (cmd.subtype === 27 || cmd.status === 0)) {
            this.log('✅ 认证成功！会话已加密')
            this.encrypted = true
            clearTimeout(timer); this.onCommand = null; resolve()
          }
        } catch (e) {
          clearTimeout(timer); this.onCommand = null; reject(e as Error)
        }
      }
      this.log('发送 PhoneNonce…')
      this.send(proto.buildPhoneNonceCommand(this.phoneNonce), false).catch((e) => {
        clearTimeout(timer); reject(e as Error)
      })
    })
  }

  disconnect(): void {
    try { this.device?.gatt?.disconnect() } catch { /* ignore */ }
  }
}
