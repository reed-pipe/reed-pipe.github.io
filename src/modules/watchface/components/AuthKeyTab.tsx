import { useState } from 'react'
import { Card, Space, Typography, Button, Upload, Table, Tag, Alert, message } from 'antd'
import { UploadOutlined, CopyOutlined, KeyOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { extractAuthKeys, type AuthKeyEntry } from '../authkey'

const { Text, Paragraph } = Typography

export default function AuthKeyTab() {
  const [keys, setKeys] = useState<AuthKeyEntry[]>([])
  const [parsing, setParsing] = useState(false)
  const [fileName, setFileName] = useState('')

  const beforeUpload: UploadProps['beforeUpload'] = (file) => {
    setParsing(true)
    setFileName(file.name)
    extractAuthKeys(file as unknown as File)
      .then((res) => {
        setKeys(res)
        if (res.length === 0) message.warning('未从该文件中解析出密钥（确认是小米运动/健康导出的调试日志？）')
        else message.success(`解析出 ${res.length} 个设备密钥`)
      })
      .catch((e) => message.error('解析失败：' + (e as Error).message))
      .finally(() => setParsing(false))
    return false
  }

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      message.success('已复制')
    } catch {
      message.error('复制失败，请手动选中')
    }
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="warning"
        showIcon
        message="网页无法直接读取手机文件，需要你手动选日志文件"
        description={
          <Paragraph style={{ marginBottom: 0, fontSize: 13 }}>
            浏览器是沙箱，没有手机文件系统权限（原生 App 能直接读是因为申请了“所有文件访问”）。
            所以请先在手机里生成并找到日志，再用下方按钮把它选进来解析。
          </Paragraph>
        }
      />

      <Card size="small" title="① 在手机里生成日志">
        <Paragraph style={{ marginBottom: 0, fontSize: 13 }}>
          <b>小米运动健康（新版）：</b>「我的 → 设置 → 关于 → 连续点击版本号进入开发者/反馈」开启日志，复现一次连接后，日志在
          <Text code>/内部存储/Download/ResearchLog/</Text> 下的 <Text code>.zip</Text>。<br />
          <b>旧版小米运动：</b>日志在 <Text code>/Download/wearablelog/</Text> 下的 <Text code>*.log.zip</Text>。<br />
          把这个 zip 传到电脑、或直接在手机 Chrome 里选它。
        </Paragraph>
      </Card>

      <Card size="small" title="② 选择日志文件解析">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Upload beforeUpload={beforeUpload} maxCount={1} accept=".zip,.log,.txt" showUploadList={false}>
            <Button icon={<UploadOutlined />} loading={parsing}>选择日志 zip / log 文件</Button>
          </Upload>
          {fileName && <Text type="secondary" style={{ fontSize: 12 }}>已选择：{fileName}</Text>}
        </Space>
      </Card>

      {keys.length > 0 && (
        <Card size="small" title={<><KeyOutlined /> 解析结果（{keys.length}）</>}>
          <Table<AuthKeyEntry>
            size="small"
            rowKey={(r) => r.source + r.mac + r.key}
            dataSource={keys}
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: '设备', dataIndex: 'name', width: 120 },
              { title: 'MAC', dataIndex: 'mac', render: (v: string) => <Text code copyable>{v}</Text> },
              {
                title: '密钥 (authkey)',
                dataIndex: 'key',
                render: (v: string) => (
                  <Space>
                    <Text code style={{ wordBreak: 'break-all' }}>{v}</Text>
                    <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => copy(v)} />
                  </Space>
                ),
              },
              { title: '来源', dataIndex: 'source', width: 90, render: (v: string) => <Tag>{v}</Tag> },
            ]}
          />
        </Card>
      )}

      <Alert
        type="info"
        showIcon
        message="说明"
        description={
          <Paragraph style={{ marginBottom: 0, fontSize: 13 }}>
            解析逻辑一比一移植自原生 AuthKeyTool（支持新版 deviceKey 与旧版 encryptKey/token 两种格式）。
            全程在你浏览器本地完成，<b>不上传任何数据</b>。Mi Band 4 推表盘用不到这个密钥。
          </Paragraph>
        }
      />
    </Space>
  )
}
