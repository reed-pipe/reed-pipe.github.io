/**
 * 从小米运动 / 小米健康 导出的调试日志里提取手环绑定密钥（authkey）。
 *
 * 解析逻辑移植自原生 com.givemefive.ble.tools.AuthKeyTool：
 *   - 旧格式 (/Download/wearablelog/*.log.zip)：行含 encryptKey/token/mac/model
 *   - 新格式 (/Download/ResearchLog/*.zip)：deviceKey:XXXX（41 位 = 9 位 mac + 32 位 key）
 *   - main.log 里 addDeviceChangeListener 后的 JSON：device.detail.{token,mac}
 *
 * 浏览器无法直接读手机文件系统，需用户手动选日志 zip/文件，本函数在浏览器内解压并解析。
 */
import { unzipSync, strFromU8 } from 'fflate'

export interface AuthKeyEntry {
  mac: string
  key: string
  name: string
  source: string
}

/** 新格式：deviceKey:<9位mac><32位key> */
function parseNewFormat(text: string, out: AuthKeyEntry[], seen: Set<string>) {
  for (const line of text.split('\n')) {
    if (!line.includes('deviceKey:') || !line.includes(')')) continue
    for (const seg of line.split(')')) {
      const m = seg.match(/deviceKey:([a-zA-Z0-9:]+)/)
      if (m && m[1] && m[1].length === 41) {
        const v = m[1]
        const mac = v.slice(0, 9)
        const key = v.slice(9)
        if (!seen.has('new:' + mac)) {
          seen.add('new:' + mac)
          out.push({ mac, key, name: '设备 ' + mac, source: 'deviceKey' })
        }
      }
    }
  }
}

/** 旧格式：行含 encryptKey= 与 mac= */
function parseOldFormat(text: string, out: AuthKeyEntry[], seen: Set<string>) {
  for (const line of text.split('\n')) {
    if (!line.includes('encryptKey') || !line.includes('mac')) continue
    for (const seg of line.split('device')) {
      const macM = seg.match(/mac=([a-zA-Z0-9:]+)/)
      const keyM = seg.match(/encryptKey=([a-z0-9]+)/)
      if (macM && keyM && macM[1] && keyM[1]) {
        const mac = macM[1].replace(/,$/, '')
        const key = keyM[1]
        if (!seen.has('old:' + mac)) {
          seen.add('old:' + mac)
          out.push({ mac, key, name: '设备 ' + mac, source: 'encryptKey' })
        }
      }
    }
  }
}

/** main.log 里 addDeviceChangeListener 后跟的 JSON 块 */
function parseMainLogJson(text: string, out: AuthKeyEntry[], seen: Set<string>) {
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]!.includes('addDeviceChangeListener')) continue
    const next = lines[i + 1]
    if (!next || !next.trimStart().startsWith('{')) continue
    let buf = ''
    for (let j = i + 1; j < lines.length && j < i + 1000; j++) {
      if (lines[j]!.startsWith('20')) break // 下一条带时间戳的日志
      buf += lines[j]
    }
    try {
      const obj = JSON.parse(buf)
      const dev = obj?.deviceInfo?.device
      const token = dev?.detail?.token
      const mac = dev?.detail?.mac
      const name = dev?.name
      if (mac && token && !seen.has('json:' + mac)) {
        seen.add('json:' + mac)
        out.push({ mac, key: token, name: name || '设备 ' + mac, source: 'token' })
      }
    } catch { /* 非完整 JSON，跳过 */ }
  }
}

function collectLogs(name: string, buf: Uint8Array, logs: { name: string; text: string }[], depth = 0) {
  const isZip = name.toLowerCase().endsWith('.zip') || (buf[0] === 0x50 && buf[1] === 0x4b)
  if (isZip && depth < 3) {
    let entries: Record<string, Uint8Array>
    try {
      entries = unzipSync(buf)
    } catch {
      return
    }
    for (const [n, data] of Object.entries(entries)) {
      if (n.toLowerCase().endsWith('.zip')) {
        collectLogs(n, data, logs, depth + 1) // 嵌套 zip 递归
      } else if (/\.log$/i.test(n) || /\.txt$/i.test(n) || /XiaomiFit/i.test(n)) {
        logs.push({ name: n, text: strFromU8(data) })
      }
    }
  } else {
    logs.push({ name, text: strFromU8(buf) })
  }
}

/** 从用户选择的文件（zip 或 .log）中提取所有 authkey */
export async function extractAuthKeys(file: File): Promise<AuthKeyEntry[]> {
  const buf = new Uint8Array(await file.arrayBuffer())
  const logs: { name: string; text: string }[] = []
  collectLogs(file.name, buf, logs)

  const out: AuthKeyEntry[] = []
  const seen = new Set<string>()
  for (const { text } of logs) {
    parseNewFormat(text, out, seen)
    parseOldFormat(text, out, seen)
    parseMainLogJson(text, out, seen)
  }
  return out
}
