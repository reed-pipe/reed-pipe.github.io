import { useState, useRef } from 'react'
import { Card, Space, Typography, Button, Alert, Input, message, theme, Tag } from 'antd'
import { ClockCircleOutlined, ApiOutlined } from '@ant-design/icons'
import { MiwearClient } from './miwear/client'

const { Text, Title, Paragraph } = Typography

// 用户 S5 已提取的设备密钥（可改）
const DEFAULT_KEY = '5223b3966cefc8d227b2b14bc173975d'

export default function WatchS5() {
  const { token: { colorPrimary, colorSuccess, colorError } } = theme.useToken()
  const supported = typeof navigator !== 'undefined' && !!navigator.bluetooth

  const [deviceKey, setDeviceKey] = useState(DEFAULT_KEY)
  const [busy, setBusy] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const clientRef = useRef<MiwearClient | null>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)

  const log = (line: string) => {
    setLogs((prev) => [...prev, line])
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 0)
  }

  const handleConnect = async () => {
    if (!/^[0-9a-fA-F]{32}$/.test(deviceKey.trim().replace(/^0x/i, ''))) {
      message.error('设备密钥应为 32 位十六进制'); return
    }
    setBusy(true); setAuthed(false); setLogs([])
    const client = new MiwearClient(deviceKey, log)
    clientRef.current = client
    try {
      await client.connect()
      await client.authenticate()
      setAuthed(true)
      message.success('连接 + 认证成功！')
    } catch (e) {
      log('❌ ' + (e as Error).message)
      message.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = () => {
    clientRef.current?.disconnect()
    clientRef.current = null
    setAuthed(false)
    log('已断开')
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <div>
        <Title level={4} style={{ marginBottom: 4 }}>
          <ClockCircleOutlined style={{ color: colorPrimary, marginRight: 8 }} />
          Watch S5 表盘工具
        </Title>
        <Text type="secondary">独立工具，逆向 miwear 协议直连 Xiaomi Watch S5。当前为「连接 + 认证」联调版。</Text>
      </div>

      {!supported && (
        <Alert type="error" showIcon message="浏览器不支持 Web Bluetooth"
          description="请用安卓版 Chrome 或桌面 Chrome/Edge，页面需 HTTPS。" />
      )}

      <Alert
        type="warning" showIcon
        message="测试前提"
        description={
          <Paragraph style={{ marginBottom: 0, fontSize: 13 }}>
            1. 先在<b>小米运动健康里把 Watch S5 断开/退出</b>（蓝牙同时只能连一个）。<br />
            2. 这是逆向协议的<b>首版联调</b>：很可能一次连不通；下方日志会把手表暴露的服务/特征、返回字节都打出来，<b>把日志发我</b>就能据此修。
          </Paragraph>
        }
      />

      <Card size="small" title="① 设备密钥 (authkey)">
        <Input value={deviceKey} onChange={(e) => setDeviceKey(e.target.value)} placeholder="32 位十六进制" />
        <Text type="secondary" style={{ fontSize: 12 }}>已预填从你手机日志提取的 S5 密钥；如换设备请替换。</Text>
      </Card>

      <Card size="small" title="② 连接并认证">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space>
            <Button type="primary" icon={<ApiOutlined />} loading={busy} disabled={!supported} onClick={handleConnect}>
              连接并认证
            </Button>
            <Button onClick={handleDisconnect} disabled={busy}>断开</Button>
            {authed && <Tag color="success">已认证</Tag>}
          </Space>
        </Space>
      </Card>

      {logs.length > 0 && (
        <Card size="small" title="日志（把这里的内容发我用于调试）">
          <pre style={{
            margin: 0, maxHeight: 360, overflow: 'auto', fontSize: 11, lineHeight: 1.5,
            background: '#1e1e1e', color: '#d4d4d4', padding: 10, borderRadius: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {logs.map((l, i) => (
              <div key={i} style={{
                color: l.startsWith('❌') || l.includes('失败') || l.includes('⚠️') ? '#f48771'
                  : l.includes('成功') || l.startsWith('✅') ? '#89d185' : undefined,
              }}>{l}</div>
            ))}
            <div ref={logEndRef} />
          </pre>
        </Card>
      )}

      <Alert
        type="info" showIcon
        message="路线图"
        description={
          <Paragraph style={{ marginBottom: 0, fontSize: 13, color: colorSuccess }}>
            <span style={{ color: 'inherit' }}>当前：连接 + 认证（命门，先打通）。</span><br />
            <span style={{ color: colorError }}>待认证通过后追加：DataUpload 推 .face → 表盘制作器。</span>
          </Paragraph>
        }
      />
    </Space>
  )
}
