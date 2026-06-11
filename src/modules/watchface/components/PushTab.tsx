import { useState, useRef } from 'react'
import { Card, Space, Typography, Button, Progress, Alert, Upload, Tag, message, theme } from 'antd'
import { ApiOutlined, UploadOutlined, SendOutlined, DisconnectOutlined, CheckCircleFilled } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { requestBand, pushWatchface, detectFwType, isWebBluetoothAvailable } from '../ble'

const { Text, Paragraph } = Typography

export default function PushTab() {
  const { token: { colorPrimary, colorSuccess, colorError, colorTextSecondary } } = theme.useToken()
  const supported = isWebBluetoothAvailable()

  const deviceRef = useRef<BluetoothDevice | null>(null)
  const [deviceName, setDeviceName] = useState<string | null>(null)
  const [connecting, setConnecting] = useState(false)

  const [fileData, setFileData] = useState<Uint8Array | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [fwType, setFwType] = useState<number | null>(null)

  const [pushing, setPushing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('')

  const handleConnect = async () => {
    setConnecting(true)
    try {
      const dev = await requestBand()
      deviceRef.current = dev
      setDeviceName(dev.name || dev.id)
      dev.addEventListener('gattserverdisconnected', () => {
        setDeviceName(null)
        deviceRef.current = null
        message.warning('手环连接已断开')
      })
      message.success('已选择设备：' + (dev.name || dev.id))
    } catch (e) {
      const msg = (e as Error).message
      if (!/cancel|user gesture|chooser/i.test(msg)) message.error(msg)
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = () => {
    try { deviceRef.current?.gatt?.disconnect() } catch { /* ignore */ }
    deviceRef.current = null
    setDeviceName(null)
  }

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
      const data = new Uint8Array(reader.result as ArrayBuffer)
      const t = detectFwType(data)
      setFileData(data)
      setFileName(file.name)
      setFwType(t)
      if (t === null) message.warning('文件头未识别（不是标准 Mi Band 4 表盘？）仍可尝试推送，但可能失败')
    }
    reader.readAsArrayBuffer(file)
    return false
  }

  const handlePush = async () => {
    if (!deviceRef.current) { message.error('请先连接手环'); return }
    if (!fileData) { message.error('请先选择表盘 .bin 文件'); return }
    setPushing(true)
    setProgress(0)
    setStatus('准备中…')
    try {
      await pushWatchface(deviceRef.current, fileData, { onStatus: setStatus, onProgress: setProgress })
      message.success('表盘安装成功！')
      setStatus('安装成功 ✅')
    } catch (e) {
      message.error('推送失败：' + (e as Error).message)
      setStatus('失败：' + (e as Error).message)
    } finally {
      setPushing(false)
    }
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      {!supported && (
        <Alert
          type="error"
          showIcon
          message="当前浏览器不支持 Web Bluetooth"
          description="请用安卓版 Chrome、或电脑上的 Chrome / Edge 打开本页（iOS Safari 不支持蓝牙）。手机需开启蓝牙与定位，且页面需经 HTTPS 访问。"
        />
      )}

      <Card size="small" title="① 连接手环">
        {deviceName ? (
          <Space wrap>
            <Tag icon={<CheckCircleFilled />} color="success">已选择：{deviceName}</Tag>
            <Button size="small" icon={<DisconnectOutlined />} onClick={handleDisconnect}>断开</Button>
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" icon={<ApiOutlined />} loading={connecting} disabled={!supported} onClick={handleConnect}>
              搜索并连接手环
            </Button>
            <Text type="secondary" style={{ fontSize: 12 }}>
              点击后在系统弹框里选择 “Mi Smart Band 4”。请先在小米运动里断开手环（同一时间只能连一个）。
            </Text>
          </Space>
        )}
      </Card>

      <Card size="small" title="② 选择表盘文件">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Upload beforeUpload={beforeUpload} maxCount={1} accept=".bin" showUploadList={false}>
            <Button icon={<UploadOutlined />}>选择 .bin 表盘文件</Button>
          </Upload>
          {fileName && (
            <Space wrap>
              <Text>{fileName}</Text>
              <Text type="secondary">{fileData ? (fileData.length / 1024).toFixed(1) + ' KB' : ''}</Text>
              {fwType === 8 && <Tag color="green">标准表盘 (fwtype 8)</Tag>}
              {fwType === 130 && <Tag color="blue">NERES (fwtype 130)</Tag>}
              {fwType === null && <Tag color="orange">未识别文件头</Tag>}
            </Space>
          )}
        </Space>
      </Card>

      <Card size="small" title="③ 推送到手环">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button type="primary" icon={<SendOutlined />} loading={pushing} disabled={!deviceName || !fileData} onClick={handlePush} block>
            开始推送
          </Button>
          {(pushing || progress > 0) && (
            <Progress
              percent={progress}
              status={status.startsWith('失败') ? 'exception' : progress >= 100 && !pushing ? 'success' : 'active'}
              strokeColor={status.startsWith('失败') ? colorError : colorPrimary}
            />
          )}
          {status && (
            <Text style={{ color: status.includes('成功') ? colorSuccess : colorTextSecondary, fontSize: 13 }}>{status}</Text>
          )}
        </Space>
      </Card>

      <Alert
        type="info"
        showIcon
        message="说明"
        description={
          <Paragraph style={{ marginBottom: 0, fontSize: 13 }}>
            · 推送协议逆向自米坛「表盘自定义工具」的 Mi Band 4 DFU 流程，纯本地，不需登录/联网。<br />
            · Mi Band 4 推表盘<b>不需要 authkey</b>；密钥读取在另一个标签页，是给其它型号/工具用的。<br />
            · 若搜不到手环：确认未被小米运动占用、蓝牙+定位已开、用 Chrome 且页面是 HTTPS。
          </Paragraph>
        }
      />
    </Space>
  )
}
