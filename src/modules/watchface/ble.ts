/**
 * 小米手环 4 表盘推送 —— Web Bluetooth 实现
 *
 * 协议逆向自「表盘自定义工具」的 components/bleDialog.vue（Mi Band 4 DFU 流程），
 * 纯本地蓝牙写特征值，不依赖任何后端/登录/authkey。
 *
 * GATT:
 *   Service        00001530-0000-3512-2118-0009af100700
 *   Control(notify) 00001531  —— 写控制指令 + 接收设备状态通知
 *   Data           00001532  —— 写表盘数据分片
 *
 * 流程:
 *   1. 写控制 [1, fwtype, len(4,LE), crc32(4,LE)]            —— 开始
 *   2. 设备 notify [16,1,1] → 写控制 [3,1]，再按 180B 分片写 Data，
 *      每 100 片写一次控制 [0]，末尾补齐，最后写控制 [0]        —— 传数据
 *   3. 设备 notify [16,3,1] → 写控制 [4, crc32(4,LE)]          —— 校验
 *   4. 设备 notify [16,4,1] → 安装成功
 */

export const BLE_SERVICE = '00001530-0000-3512-2118-0009af100700'
export const BLE_CHAR_CONTROL = '00001531-0000-3512-2118-0009af100700'
export const BLE_CHAR_DATA = '00001532-0000-3512-2118-0009af100700'

const CHUNK_SIZE = 180

/** 标准 CRC32（反射，poly 0xEDB88320），与原 App getCrc 等价 */
const CRC32_TABLE: number[] = (() => {
  const t: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[i]!) & 0xff]!
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * 校验表盘文件头并返回 fwtype。
 *  - "HMDIAL" 开头        → fwtype 8（标准 Mi Band 4 表盘）
 *  - 偏移 13 处 "NERES"   → fwtype 130
 * 不匹配返回 null。
 */
export function detectFwType(d: Uint8Array): number | null {
  // "HMDIAL" = 72,77,68,73,65,76
  if (d.length > 10 && d[0] === 72 && d[1] === 77 && d[2] === 68 && d[3] === 73 && d[4] === 65 && d[5] === 76) {
    return 8
  }
  // "NERES" = 78,69,82,69,83 at offset 13
  if (d.length > 20 && d[13] === 78 && d[14] === 69 && d[15] === 82 && d[16] === 69 && d[17] === 83) {
    return 130
  }
  return null
}

function le32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]
}

export function isWebBluetoothAvailable(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth
}

/** 弹出系统选择框，挑选 Mi Smart Band 4 */
export async function requestBand(): Promise<BluetoothDevice> {
  if (!isWebBluetoothAvailable()) {
    throw new Error('当前浏览器不支持 Web Bluetooth，请使用安卓版 Chrome 或桌面 Chrome/Edge（iOS 不支持）')
  }
  return navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: 'Mi Smart Band 4' }],
    optionalServices: [BLE_SERVICE],
  })
}

export interface PushCallbacks {
  onStatus?: (msg: string) => void
  onProgress?: (percent: number) => void
}

/**
 * 把表盘数据推送到已选设备。会自动连接 GATT。
 * 成功 resolve，失败/设备报错 reject。
 */
export async function pushWatchface(
  device: BluetoothDevice,
  data: Uint8Array,
  cb: PushCallbacks = {},
): Promise<void> {
  const fwtype = detectFwType(data)
  if (fwtype === null) {
    throw new Error('不是有效的小米手环 4 表盘文件（文件头缺少 HMDIAL / NERES 标识）')
  }
  const crc = crc32(data)
  const total = data.length

  cb.onStatus?.('连接设备…')
  const gatt = await device.gatt!.connect()
  const svc = await gatt.getPrimaryService(BLE_SERVICE)
  const control = await svc.getCharacteristic(BLE_CHAR_CONTROL)
  const dataChar = await svc.getCharacteristic(BLE_CHAR_DATA)

  const writeCtrl = (arr: number[]) => control.writeValueWithResponse(new Uint8Array(arr))
  const writeData = async (chunk: Uint8Array) => {
    // 拷贝为 ArrayBuffer-backed 的 Uint8Array（满足 BufferSource 类型）
    const buf = new Uint8Array(chunk.length)
    buf.set(chunk)
    // 优先无应答写（快），不支持时回退
    try {
      await dataChar.writeValueWithoutResponse(buf)
    } catch {
      await dataChar.writeValueWithResponse(buf)
    }
  }

  return new Promise<void>((resolve, reject) => {
    let working = false
    let finished = false

    const cleanup = () => {
      control.removeEventListener('characteristicvaluechanged', onNotify)
      control.stopNotifications().catch(() => {})
    }
    const done = (err?: Error) => {
      if (finished) return
      finished = true
      cleanup()
      if (err) reject(err)
      else resolve()
    }

    async function sendData() {
      try {
        cb.onStatus?.('安装中…')
        await writeCtrl([3, 1])
        const fullChunks = Math.floor(total / CHUNK_SIZE)
        for (let i = 0; i < fullChunks; i++) {
          await writeData(data.subarray(i * CHUNK_SIZE, i * CHUNK_SIZE + CHUNK_SIZE))
          if (i > 0 && i % 100 === 0) await writeCtrl([0])
          cb.onProgress?.(Math.round(((i + 1) * CHUNK_SIZE / total) * 100))
        }
        if (fullChunks * CHUNK_SIZE < total) {
          await writeData(data.subarray(fullChunks * CHUNK_SIZE))
        }
        await writeCtrl([0])
        cb.onProgress?.(100)
        cb.onStatus?.('等待设备校验…')
      } catch (e) {
        done(e as Error)
      }
    }

    const onNotify = (ev: Event) => {
      const dv = (ev.target as BluetoothRemoteGATTCharacteristic).value
      if (!dv) return
      const b0 = dv.getUint8(0)
      const b1 = dv.byteLength > 1 ? dv.getUint8(1) : 0
      const b2 = dv.byteLength > 2 ? dv.getUint8(2) : 0
      if (b0 === 16 && b2 === 1) {
        if (b1 === 1) {
          if (working) return
          working = true
          void sendData()
        } else if (b1 === 3) {
          writeCtrl([4, ...le32(crc)]).catch((e) => done(e as Error))
        } else if (b1 === 4) {
          cb.onStatus?.('安装成功 ✅')
          done()
        }
      } else {
        done(new Error('设备返回同步失败（请确认手环在范围内、未被其他 App 占用）'))
      }
    }

    control
      .startNotifications()
      .then(() => {
        control.addEventListener('characteristicvaluechanged', onNotify)
        cb.onStatus?.('开始传输…')
        // startUploadFw: [1, fwtype, len(4,LE), crc(4,LE)]
        return writeCtrl([1, fwtype, ...le32(total), ...le32(crc)])
      })
      .catch((e) => done(e as Error))
  })
}
